import type { Response, NextFunction, Request } from 'express';
import { prisma } from '../../config/database';
import { env } from '../../config/env';
import type { AuthenticatedRequest } from '../../middlewares/auth';
import { successResponse, errorResponse } from '../../utils/response';
import { CallService, webhookReceiver } from './service';
import { logger } from '../../utils/logger';
import { UsersService } from '../users/service';
import { NotificationQueueService } from '../../services/notificationQueue';

export class CallController {
  /** Initiate a call: create DB record, notify callee via socket (no token yet). */
  static async initiate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const callerId = req.user!.id;
      const { userId: calleeId, isVideo = false } = req.body;

      if (!calleeId || calleeId === callerId) {
        return errorResponse(res, 'Invalid callee', null, 400);
      }

      if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_HOST) {
        return errorResponse(res, 'Calling is not configured', null, 503);
      }

      const callee = await prisma.user.findUnique({ where: { id: calleeId } });
      if (!callee) {
        return errorResponse(res, 'User not found', null, 404);
      }

      // Auto-cleanup stale calls stuck in RINGING/ONGOING for >2 minutes
      const staleThreshold = new Date(Date.now() - 2 * 60 * 1000);
      await prisma.call.updateMany({
        where: {
          status: { in: ['RINGING', 'ONGOING'] },
          createdAt: { lt: staleThreshold },
        },
        data: { status: 'MISSED', endedAt: new Date() },
      });

      const ongoing = await prisma.call.findFirst({
        where: {
          status: { in: ['RINGING', 'ONGOING'] },
          OR: [{ callerId }, { calleeId: callerId }],
        },
      });
      if (ongoing) {
        return errorResponse(res, 'You are already in a call', null, 409);
      }

      const calleeOngoing = await prisma.call.findFirst({
        where: {
          status: { in: ['RINGING', 'ONGOING'] },
          OR: [{ callerId: calleeId }, { calleeId: calleeId }],
        },
      });
      if (calleeOngoing) {
        return errorResponse(res, 'Callee is busy', null, 409);
      }

      const roomName = CallService.generateRoomName(callerId, calleeId);

      const call = await prisma.call.create({
        data: { callerId, calleeId, roomName, isVideo },
      });

      const caller = await prisma.user.findUnique({
        where: { id: callerId },
        select: { id: true, displayName: true, avatar: true },
      });

      const io = req.app.get('io') as import('socket.io').Server;

      // Lazy token: no token sent during ringing — tokens generated only on accept
      io.to(`user:${calleeId}`).emit('call:invite', {
        callId: call.id,
        roomName,
        caller: { id: callerId, displayName: caller?.displayName ?? null, avatar: caller?.avatar ?? null },
      });

      io.to(`user:${callerId}`).emit('call:ringing', {
        callId: call.id,
        roomName,
        callee: { id: calleeId, displayName: callee.displayName, avatar: callee.avatar },
      });

      // FCM push to callee if offline
      void CallController.pushCallNotification(callee, caller, call.id, roomName, call.isVideo);

      // Auto-timeout after CALL_TIMEOUT_MS
      setTimeout(async () => {
        const existing = await prisma.call.findUnique({ where: { id: call.id } });
        if (existing && existing.status === 'RINGING') {
          await prisma.call.update({
            where: { id: call.id },
            data: { status: 'MISSED', endedAt: new Date() },
          });

          // Create missed call message
          try {
            const callerPart = await prisma.participant.findFirst({
              where: { userId: callerId, conversation: { type: 'DIRECT', participants: { some: { userId: calleeId } } } },
              select: { conversationId: true },
            });
            let convId = callerPart?.conversationId;
            if (!convId) {
              const conv = await prisma.conversation.create({
                data: { type: 'DIRECT', participants: { create: [{ userId: callerId }, { userId: calleeId }] } },
              });
              convId = conv.id;
            }
            const callerUser = await prisma.user.findUnique({ where: { id: callerId }, select: { displayName: true } });
            const callMsg = await prisma.message.create({
              data: {
                conversationId: convId,
                senderId: callerId,
                content: JSON.stringify({ type: 'call', callId: call.id, status: 'MISSED', duration: 0, callerName: callerUser?.displayName }),
                type: 'TEXT',
              },
              include: { sender: { select: { id: true, displayName: true, avatar: true } } },
            });

            // Emit to personal rooms like regular messages + refresh sidebar
            await prisma.conversation.update({ where: { id: convId }, data: { createdAt: new Date() } }).catch(() => {});
            const participants = await prisma.participant.findMany({ where: { conversationId: convId }, select: { userId: true } });
            participants.forEach((p) => {
              io.to(`user:${p.userId}`).emit('message:new', callMsg);
            });
          } catch (err) {
            logger.error('Failed to create missed call message:', err);
          }

          io.to(`user:${callerId}`).emit('call:missed', { callId: call.id, roomName });
          io.to(`user:${calleeId}`).emit('call:missed', { callId: call.id, roomName });
        }
      }, env.CALL_TIMEOUT_MS);

      return successResponse(res, 'Call initiated', { callId: call.id, roomName });
    } catch (err) {
      return next(err);
    }
  }

  /** Accept an incoming call — generates tokens lazily, then notifies both parties. */
  static async accept(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { callId } = req.params;

      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return errorResponse(res, 'Call not found', null, 404);
      if (call.calleeId !== userId) return errorResponse(res, 'Unauthorized', null, 403);
      if (call.status !== 'RINGING') return errorResponse(res, 'Call is not ringing', null, 409);

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'ONGOING', startedAt: new Date() },
      });

      // Lazy token generation — only now that both parties are ready
      const callerToken = await CallService.generateToken(call.callerId, call.roomName);
      const calleeToken = await CallService.generateToken(call.calleeId, call.roomName);

      const io = req.app.get('io') as import('socket.io').Server;

      // Send tokens to both parties so they can connect to the LiveKit room
      io.to(`user:${call.callerId}`).emit('call:accepted', {
        callId,
        roomName: call.roomName,
        token: callerToken,
      });
      io.to(`user:${call.calleeId}`).emit('call:accepted', {
        callId,
        roomName: call.roomName,
        token: calleeToken,
      });

      return successResponse(res, 'Call accepted', { callId, roomName: call.roomName });
    } catch (err) {
      return next(err);
    }
  }

  /** Reject an incoming call */
  static async reject(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { callId } = req.params;

      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return errorResponse(res, 'Call not found', null, 404);
      if (call.calleeId !== userId) return errorResponse(res, 'Unauthorized', null, 403);
      if (call.status !== 'RINGING') return errorResponse(res, 'Call is not ringing', null, 409);

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'REJECTED' },
      });

      const io = req.app.get('io') as import('socket.io').Server;
      io.to(`user:${call.callerId}`).emit('call:rejected', { callId, roomName: call.roomName });

      return successResponse(res, 'Call rejected');
    } catch (err) {
      return next(err);
    }
  }

  /** End an ongoing call */
  static async end(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { callId } = req.params;

      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return errorResponse(res, 'Call not found', null, 404);
      if (call.callerId !== userId && call.calleeId !== userId)
        return errorResponse(res, 'Unauthorized', null, 403);
      if (call.status !== 'ONGOING') return errorResponse(res, 'Call is not ongoing', null, 409);

      const now = new Date();
      const duration = call.startedAt ? Math.round((now.getTime() - call.startedAt.getTime()) / 1000) : 0;

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'ENDED', endedAt: now, duration },
      });

      const io = req.app.get('io') as import('socket.io').Server;

      // Create a call event message in the conversation
      try {
        // Find or create a DIRECT conversation between caller and callee
        const callerParticipation = await prisma.participant.findFirst({
          where: { userId: call.callerId, conversation: { type: 'DIRECT', participants: { some: { userId: call.calleeId } } } },
          select: { conversationId: true },
        });
        let conversationId = callerParticipation?.conversationId;
        if (!conversationId) {
          const conv = await prisma.conversation.create({
            data: {
              type: 'DIRECT',
              participants: { create: [{ userId: call.callerId }, { userId: call.calleeId }] },
            },
          });
          conversationId = conv.id;
        }

        const callerUser = await prisma.user.findUnique({ where: { id: call.callerId }, select: { displayName: true } });

        const callMsg = await prisma.message.create({
          data: {
            conversationId,
            senderId: call.callerId,
            content: JSON.stringify({ type: 'call', callId: call.id, status: call.status, duration, callerName: callerUser?.displayName }),
            type: 'TEXT',
          },
          include: { sender: { select: { id: true, displayName: true, avatar: true } } },
        });

        // Emit to personal rooms like regular messages + refresh sidebar
        await prisma.conversation.update({ where: { id: conversationId }, data: { createdAt: new Date() } }).catch(() => {});
        const participants = await prisma.participant.findMany({ where: { conversationId }, select: { userId: true } });
        participants.forEach((p) => {
          io.to(`user:${p.userId}`).emit('message:new', callMsg);
        });
      } catch (err) {
        logger.error('Failed to create call message:', err);
      }

      io.to(`user:${call.callerId}`).emit('call:ended', { callId, roomName: call.roomName, duration });
      io.to(`user:${call.calleeId}`).emit('call:ended', { callId, roomName: call.roomName, duration });

      return successResponse(res, 'Call ended', { duration });
    } catch (err) {
      return next(err);
    }
  }

  /** Cancel a ringing call (caller only) */
  static async cancel(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const callerId = req.user!.id;
      const { callId } = req.params;

      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return errorResponse(res, 'Call not found', null, 404);
      if (call.callerId !== callerId) return errorResponse(res, 'Unauthorized', null, 403);
      if (call.status !== 'RINGING') return errorResponse(res, 'Call is not ringing', null, 409);

      await prisma.call.update({
        where: { id: callId },
        data: { status: 'CANCELLED' },
      });

      const io = req.app.get('io') as import('socket.io').Server;
      io.to(`user:${call.calleeId}`).emit('call:cancelled', { callId, roomName: call.roomName });

      return successResponse(res, 'Call cancelled');
    } catch (err) {
      return next(err);
    }
  }

  /** Generate a LiveKit token for an ongoing call (for reconnection) */
  static async token(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { callId } = req.params;

      const call = await prisma.call.findUnique({ where: { id: callId } });
      if (!call) return errorResponse(res, 'Call not found', null, 404);
      if (call.callerId !== userId && call.calleeId !== userId)
        return errorResponse(res, 'Unauthorized', null, 403);
      if (call.status !== 'ONGOING') return errorResponse(res, 'Call is not ongoing', null, 409);

      const token = await CallService.generateToken(userId, call.roomName);
      return successResponse(res, 'Token generated', { token, roomName: call.roomName });
    } catch (err) {
      return next(err);
    }
  }

  /** Check for any pending (ringing) incoming calls for the current user. */
  static async pending(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const call = await prisma.call.findFirst({
        where: { calleeId: userId, status: 'RINGING' },
        orderBy: { createdAt: 'desc' },
        include: {
          caller: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      if (!call) return successResponse(res, 'No pending calls', null);
      return successResponse(res, 'Pending call found', {
        callId: call.id,
        roomName: call.roomName,
        caller: call.caller,
        isVideo: call.isVideo,
      });
    } catch (err) {
      return next(err);
    }
  }

  /** Get call history for the current user — cursor-based pagination */
  static async history(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 50);

      const calls = await prisma.call.findMany({
        where: {
          OR: [{ callerId: userId }, { calleeId: userId }],
          ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        include: {
          caller: { select: { id: true, displayName: true, avatar: true } },
          callee: { select: { id: true, displayName: true, avatar: true } },
        },
      });

      const hasMore = calls.length > limit;
      if (hasMore) calls.pop();

      const nextCursor = hasMore && calls.length > 0 ? calls[calls.length - 1].createdAt.toISOString() : null;

      return successResponse(res, 'Call history', { calls, nextCursor });
    } catch (err) {
      return next(err);
    }
  }

  private static async pushCallNotification(
    callee: { id: string; displayName: string | null; notificationsEnabled?: boolean | null },
    caller: { id: string; displayName: string | null } | null,
    callId: string,
    roomName: string,
    isVideo: boolean,
  ) {
    try {
      const callerName = caller?.displayName || 'Someone';
      const presence = await UsersService.getPresence(callee.id);
      if (presence.isOnline) return;
      await NotificationQueueService.enqueue({
        userId: callee.id,
        type: 'call',
        title: isVideo ? 'Video Call' : 'Voice Call',
        body: `${callerName} is calling...`,
        data: {
          callerId: caller?.id || '',
          callerName,
          callId,
          roomName,
          isVideo: String(isVideo),
        },
      });
    } catch (err) {
      logger.error('Failed to push call notification:', err);
    }
  }

  /** LiveKit webhook handler — receives room/participant lifecycle events */
  static async webhook(req: Request, res: Response) {
    try {
      const authHeader = req.headers.authorization || '';
      const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      const event = await webhookReceiver.receive(body, authHeader);

      if (event.event === 'room_finished') {
        const roomName = event.room?.name;
        if (!roomName) {
          res.status(200).json({ ok: true });
          return;
        }

        // Find the call record for this room
        const call = await prisma.call.findFirst({
          where: { roomName, status: 'ONGOING' },
        });

        if (call) {
          const now = new Date();
          const duration = call.startedAt
            ? Math.round((now.getTime() - call.startedAt.getTime()) / 1000)
            : 0;

          await prisma.call.update({
            where: { id: call.id },
            data: { status: 'ENDED', endedAt: now, duration },
          });

          logger.info(`LiveKit room_finished: ${roomName}, duration: ${CallService.formatCallDuration(duration)}`);
        }
      }

      if (event.event === 'participant_left') {
        const roomName = event.room?.name;
        const participantIdentity = event.participant?.identity;
        if (roomName && participantIdentity) {
          logger.info(`LiveKit participant_left: ${participantIdentity} from room ${roomName}`);
        }
      }

      if (event.event === 'room_started') {
        const roomName = event.room?.name;
        if (roomName) {
          logger.info(`LiveKit room_started: ${roomName}`);
        }
      }

      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error('LiveKit webhook error:', err);
      res.status(200).json({ ok: true }); // Always 200 to LiveKit
    }
  }
}
