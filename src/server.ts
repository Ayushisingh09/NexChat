import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { env } from './config/env';
import { connectDatabase, prisma } from './config/database';
import { redis } from './config/redis';
import jwt from 'jsonwebtoken';
import authRoutes from './modules/auth/routes';
import userRoutes from './modules/users/routes';
import conversationRoutes from './modules/conversations/routes';
import inviteRoutes from './modules/conversations/inviteRoutes';
import messageRoutes from './modules/messages/routes';
import mediaRoutes from './modules/media/routes';
import storyRoutes from './modules/stories/routes';
import friendRoutes from './modules/friends/routes';
import callRoutes from './modules/calls/routes';
import cipherRoutes from './routes/cipher';
import reportRoutes from './modules/reports/routes';
import adminRoutes from './modules/admin/routes';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { arcjetProtection } from './middlewares/arcjet';
import { logger } from './utils/logger';
import path from 'path';
import { BlockCache } from './utils/blockCache';
import { PresenceService } from './utils/presenceService';
import { startExpirySweep } from './utils/expirySweep';
import { startScheduledSweep } from './utils/scheduledSweep';
import { startNotificationSweep } from './utils/notificationSweep';

const app = express();
const httpServer = createServer(app);

// Trust the first proxy hop (nginx) so rate-limiter/X-Forwarded-For works correctly
app.set('trust proxy', 1);

// Configure socket.io
const io = new Server(httpServer, {
  cors: {
    origin: env.FRONTEND_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.set('io', io);

// Configure Redis adapter for Socket.io
const pubClient = redis;
const subClient = redis.duplicate();
subClient.on('error', (err) => {
  logger.error('Redis subClient error:', err);
});

io.adapter(createAdapter(pubClient, subClient));

// Socket.io connection authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Authentication error: Token is required'));
  }
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as { id: string };
    socket.data = { userId: decoded.id };
    next();
  } catch (err) {
    return next(new Error('Authentication error: Invalid or expired token'));
  }
});

// Per-socket token bucket: caps chatty events without touching Redis.
const SOCKET_BUCKET_CAPACITY = 120; // burst
const SOCKET_REFILL_PER_SEC = 2; // sustained ~120 events/min
const SOCKET_ABUSE_DISCONNECT = 200; // consecutive dropped events before disconnect

const createSocketThrottle = (socket: import('socket.io').Socket) => {
  let tokens = SOCKET_BUCKET_CAPACITY;
  let lastRefill = Date.now();
  let dropped = 0;

  return (): boolean => {
    const now = Date.now();
    tokens = Math.min(SOCKET_BUCKET_CAPACITY, tokens + ((now - lastRefill) / 1000) * SOCKET_REFILL_PER_SEC);
    lastRefill = now;

    if (tokens >= 1) {
      tokens -= 1;
      dropped = 0;
      return true;
    }

    dropped += 1;
    if (dropped >= SOCKET_ABUSE_DISCONNECT) {
      logger.warn(`Disconnecting socket ${socket.id} for sustained event flooding`);
      socket.disconnect(true);
    }
    return false;
  };
};

// Socket.io connection handler
io.on('connection', async (socket) => {
  const userId = socket.data.userId;
  if (!userId) return;

  const allowEvent = createSocketThrottle(socket);

  logger.info(`Client connected: ${socket.id} (User: ${userId})`);

  // Join personal user room to receive global message events/notifications
  socket.join(`user:${userId}`);
  logger.info(`User ${userId} joined their personal room: user:${userId}`);

  // Hydrate blocklist in Redis cache
  await BlockCache.hydrate(userId);

  // Set presence heartbeats in Redis
  await PresenceService.heartbeat(userId, io);

  // Mark all SENT messages received by this user as DELIVERED
  try {
    const userConversations = await prisma.participant.findMany({
      where: { userId },
      select: { conversationId: true },
    });
    const conversationIds = userConversations.map((uc) => uc.conversationId);

    if (conversationIds.length > 0) {
      const result = await prisma.message.updateMany({
        where: {
          conversationId: { in: conversationIds },
          senderId: { not: userId },
          status: 'SENT',
        },
        data: {
          status: 'DELIVERED',
        },
      });

      if (result.count > 0) {
        // Notify conversation participants that their sent messages were
        // delivered. Fetch every conversation's participants in one query
        // instead of a findUnique per conversation (was N+1 on each connect).
        const convs = await prisma.conversation.findMany({
          where: { id: { in: conversationIds } },
          select: { id: true, participants: { select: { userId: true } } },
        });
        for (const conv of convs) {
          conv.participants.forEach((p) => {
            io.to(`user:${p.userId}`).emit('messages:delivered', {
              conversationId: conv.id,
              deliveredToUserId: userId,
            });
          });
        }
      }
    }
  } catch (err) {
    logger.error(`Failed to update message delivery status for user ${userId}:`, err);
  }

  // Basic events
  socket.on('join_conversation', (conversationId: string) => {
    socket.join(conversationId);
    logger.info(`User ${userId} joined room: ${conversationId}`);
  });

  socket.on('leave_conversation', (conversationId: string) => {
    socket.leave(conversationId);
    logger.info(`User ${userId} left room: ${conversationId}`);
  });

  // NOTE: there is intentionally no `send_message` relay here. Messages are
  // persisted and broadcast exclusively from the REST controller after the DB
  // write succeeds, so clients never receive a message that wasn't saved.

  // ── MQTT-style pub/sub over Socket.io ──
  // Clients subscribe to topics; when a message is published to a topic,
  // it is relayed to all subscribers of that exact topic or wildcard patterns.
  const mqttTopics = new Map<string, Set<string>>(); // topic -> Set<socketId>

  socket.on('mqtt:subscribe', (topic: string) => {
    if (!topic || typeof topic !== 'string') return;
    socket.join(`mqtt:${topic}`);
    if (!mqttTopics.has(topic)) mqttTopics.set(topic, new Set());
    mqttTopics.get(topic)!.add(socket.id);
    logger.debug(`[MQTT] ${userId} subscribed to ${topic}`);
  });

  socket.on('mqtt:unsubscribe', (topic: string) => {
    if (!topic || typeof topic !== 'string') return;
    socket.leave(`mqtt:${topic}`);
    mqttTopics.get(topic)?.delete(socket.id);
    logger.debug(`[MQTT] ${userId} unsubscribed from ${topic}`);
  });

  socket.on('mqtt:publish', (data: { topic: string; payload: any }) => {
    if (!data?.topic || !allowEvent()) return;
    // Extract conversationId from topic pattern typing/{conversationId}
    const conversationId = data.topic.startsWith('typing/')
      ? data.topic.split('/')[1]
      : null;

    // Broadcast mqtt:message to all subscribers of this exact topic
    io.to(`mqtt:${data.topic}`).emit('mqtt:message', {
      topic: data.topic,
      payload: data.payload,
    });

    // Also broadcast to wildcard subscribers (typing/*)
    if (conversationId) {
      io.to('mqtt:typing/*').emit('mqtt:message', {
        topic: data.topic,
        payload: { ...data.payload, conversationId },
      });
    }

    // Relay old typing:start/typing:stop for backward compat
    if (data.topic.startsWith('typing/') && data.payload) {
      const payload = data.payload as { userId: string; displayName?: string; action: string };
      if (data.payload.action === 'start') {
        socket.to(conversationId!).emit('typing:start', {
          conversationId,
          userId: payload.userId || userId,
          displayName: payload.displayName,
        });
      } else if (data.payload.action === 'stop') {
        socket.to(conversationId!).emit('typing:stop', {
          conversationId,
          userId: payload.userId || userId,
        });
      }
    }
  });

  // Clean up MQTT subscriptions on disconnect
  socket.on('disconnect', () => {
    mqttTopics.forEach((sockets, topic) => {
      sockets.delete(socket.id);
      if (sockets.size === 0) mqttTopics.delete(topic);
    });
  });

  socket.on('heartbeat', async () => {
    await PresenceService.heartbeat(userId, io);
  });

  // ── Call socket events ──
  // These are relayed through the server for auth verification / logging;
  // the actual signaling for WebRTC negotiation is handled client-to-client
  // via LiveKit. The REST API handles lifecycle (initiate/accept/reject/end).

  socket.on('call:accept', async (data: { callId: string }) => {
    if (!allowEvent()) return;
    try {
      const call = await prisma.call.findUnique({ where: { id: data.callId } });
      if (!call || call.calleeId !== userId) return;
      if (call.status !== 'RINGING') return;
      await prisma.call.update({
        where: { id: data.callId },
        data: { status: 'ONGOING', startedAt: new Date() },
      });

      // Lazy token generation — generate only now that both parties are ready
      const { CallService } = await import('./modules/calls/service');
      const callerToken = await CallService.generateToken(call.callerId, call.roomName);
      const calleeToken = await CallService.generateToken(call.calleeId, call.roomName);

      io.to(`user:${call.callerId}`).emit('call:accepted', {
        callId: data.callId,
        roomName: call.roomName,
        token: callerToken,
      });
      io.to(`user:${call.calleeId}`).emit('call:accepted', {
        callId: data.callId,
        roomName: call.roomName,
        token: calleeToken,
      });
    } catch (err) {
      logger.error(`call:accept error for user ${userId}:`, err);
    }
  });

  socket.on('call:reject', async (data: { callId: string }) => {
    if (!allowEvent()) return;
    try {
      const call = await prisma.call.findUnique({ where: { id: data.callId } });
      if (!call || call.calleeId !== userId) return;
      if (call.status !== 'RINGING') return;
      await prisma.call.update({
        where: { id: data.callId },
        data: { status: 'REJECTED' },
      });
      socket.to(`user:${call.callerId}`).emit('call:rejected', {
        callId: data.callId,
        roomName: call.roomName,
      });
    } catch (err) {
      logger.error(`call:reject error for user ${userId}:`, err);
    }
  });

  socket.on('call:end', async (data: { callId: string }) => {
    if (!allowEvent()) return;
    try {
      const call = await prisma.call.findUnique({ where: { id: data.callId } });
      if (!call) return;
      if (call.callerId !== userId && call.calleeId !== userId) return;
      if (call.status !== 'ONGOING') return;
      const now = new Date();
      const duration = call.startedAt ? Math.round((now.getTime() - call.startedAt.getTime()) / 1000) : 0;
      await prisma.call.update({
        where: { id: data.callId },
        data: { status: 'ENDED', endedAt: now, duration },
      });
      io.to(`user:${call.callerId}`).emit('call:ended', {
        callId: data.callId, roomName: call.roomName, duration,
      });
      io.to(`user:${call.calleeId}`).emit('call:ended', {
        callId: data.callId, roomName: call.roomName, duration,
      });
    } catch (err) {
      logger.error(`call:end error for user ${userId}:`, err);
    }
  });

  socket.on('call:cancel', async (data: { callId: string }) => {
    if (!allowEvent()) return;
    try {
      const call = await prisma.call.findUnique({ where: { id: data.callId } });
      if (!call || call.callerId !== userId) return;
      if (call.status !== 'RINGING') return;
      await prisma.call.update({
        where: { id: data.callId },
        data: { status: 'CANCELLED' },
      });
      socket.to(`user:${call.calleeId}`).emit('call:cancelled', {
        callId: data.callId, roomName: call.roomName,
      });
    } catch (err) {
      logger.error(`call:cancel error for user ${userId}:`, err);
    }
  });

  socket.on('disconnect', async () => {
    logger.info(`Client disconnected: ${socket.id} (User: ${userId})`);
    await PresenceService.handleDisconnect(userId, io);
  });
});

// Apply basic Express middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  strictTransportSecurity: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', env.R2_PUBLIC_URL || ''].filter(Boolean),
      connectSrc: ["'self'", env.FRONTEND_URL || '', env.R2_PUBLIC_URL || '', env.LIVEKIT_HOST || ''].filter(Boolean),
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      mediaSrc: ["'self'", 'blob:', env.SERVER_URL || '', env.LIVEKIT_HOST || ''].filter(Boolean),
      frameSrc: ["'self'", env.LIVEKIT_HOST || ''].filter(Boolean),
      objectSrc: ["'none'"],
      upgradeInsecureRequests: [],
    },
  },
}));
const allowedOrigins = [
  env.FRONTEND_URL || 'http://localhost:5173',
  env.ADMIN_FRONTEND_URL || 'http://localhost:5174',
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: env.NODE_ENV === 'development' ? 10000 : 500, // Limit each IP to 10000 requests in dev, 500 in prod
  message: 'Too many requests from this IP, please try again after 15 minutes',
});
app.use(limiter);

// Arcjet bot protection (applied to all /api routes)
app.use('/api', arcjetProtection);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/cipher', cipherRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Liveness — the process is up and serving.
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Readiness — dependencies (Postgres + Redis) are reachable. Returns 503 if
// either is down so an orchestrator can hold traffic until the app can serve.
app.get('/health/ready', async (_req, res) => {
  const checks: { db: boolean; redis: boolean } = { db: false, redis: false };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = true;
  } catch (err) {
    logger.error('Readiness DB check failed:', err);
  }
  try {
    checks.redis = (await redis.ping()) === 'PONG';
  } catch (err) {
    logger.error('Readiness Redis check failed:', err);
  }

  const ready = checks.db && checks.redis;
  res.status(ready ? 200 : 503).json({ status: ready ? 'READY' : 'NOT_READY', checks });
});

// Error handling middleware
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDatabase();
  startExpirySweep(io);
  startScheduledSweep(io);
  startNotificationSweep();
  httpServer.listen(env.PORT, () => {
    logger.info(`Server running on port ${env.PORT} in ${env.NODE_ENV} mode.`);
  });
};

startServer().catch((error) => {
  logger.error('Failed to start server:', error);
  process.exit(1);
});
