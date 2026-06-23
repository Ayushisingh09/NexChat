import { Router, Response, NextFunction } from 'express';
import { verifyAccessToken, authHandler, AuthenticatedRequest } from '../middlewares/auth';
import { cipherDailyLimit, incrementCipherUsage } from '../middlewares/cipherLimit';
import { attachCipherTier, TieredRequest } from '../middlewares/cipherTier';
import { chat, streamFromProvider } from '../services/cipherService';
import { successResponse, errorResponse } from '../utils/response';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { getTier } from '../config/cipherTiers';
import { verifyAdminToken } from '../modules/admin/middleware';

const router = Router();

// --- Admin routes (no verifyAccessToken - uses verifyAdminToken only) ---

router.put(
  '/admin/tier',
  verifyAdminToken,
  authHandler(async (req: AuthenticatedRequest, res: Response) => {
    const { userId, tierIndex } = req.body as { userId?: string; tierIndex?: number };
    if (!userId || typeof tierIndex !== 'number' || tierIndex < 0 || tierIndex > 4) {
      return errorResponse(res, 'Invalid userId or tierIndex (0-4)', null, 400);
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return errorResponse(res, 'User not found', null, 404);
    await prisma.user.update({
      where: { id: userId },
      data: { cipherTier: tierIndex },
    });
    return successResponse(res, 'Tier updated', { userId, tierIndex, tier: getTier(tierIndex).name });
  })
);

router.get(
  '/admin/users',
  verifyAdminToken,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = (req.query.search as string || '').trim();
      const where: any = {};
      if (search) {
        where.OR = [
          { username: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { displayName: { contains: search, mode: 'insensitive' } },
        ];
      }
      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: { id: true, username: true, displayName: true, email: true, cipherTier: true, createdAt: true },
        }),
        prisma.user.count({ where }),
      ]);
      return successResponse(res, 'Users fetched', {
        users: users.map((u) => ({ ...u, tierName: getTier(u.cipherTier).name })),
        total, page, totalPages: Math.ceil(total / limit),
      });
    } catch (error) {
      return next(error);
    }
  })
);

router.get(
  '/admin/analytics',
  verifyAdminToken,
  authHandler(async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const today = new Date(new Date().toISOString().slice(0, 10));

      const [tokenAgg, totalMessages, totalConversations, feedbackGroups, distinctUsers, todayAgg, activeToday] = await Promise.all([
        prisma.cipherMessage.aggregate({ _sum: { tokensUsed: true, promptTokens: true, completionTokens: true }, _count: { _all: true } }),
        prisma.cipherMessage.count({ where: { role: 'user' } }),
        prisma.cipherConversation.count(),
        prisma.cipherFeedback.groupBy({ by: ['feedbackType'], _count: { _all: true } }),
        prisma.cipherMessage.findMany({ distinct: ['userId'], select: { userId: true } }),
        prisma.cipherUsage.aggregate({ where: { date: today }, _sum: { tokensUsed: true, messageCount: true } }),
        prisma.cipherUsage.count({ where: { date: today } }),
      ]);

      const goodCount = feedbackGroups.find((g) => g.feedbackType === 'good')?._count._all || 0;
      const badCount = feedbackGroups.find((g) => g.feedbackType === 'bad')?._count._all || 0;
      const totalFeedbacks = goodCount + badCount;
      const totalTokens = tokenAgg._sum.tokensUsed || 0;
      const totalUsers = distinctUsers.length;

      return successResponse(res, 'Analytics fetched', {
        totalTokens,
        promptTokens: tokenAgg._sum.promptTokens || 0,
        completionTokens: tokenAgg._sum.completionTokens || 0,
        totalMessages,
        totalAiMessages: tokenAgg._count._all || 0,
        totalConversations,
        totalUsers,
        todayTokens: todayAgg._sum.tokensUsed || 0,
        todayMessages: todayAgg._sum.messageCount || 0,
        activeUsersToday: activeToday,
        avgTokensPerChat: totalMessages ? Math.round(totalTokens / totalMessages) : 0,
        totalFeedbacks,
        goodCount,
        badCount,
        goodRatio: totalFeedbacks ? Math.round((goodCount / totalFeedbacks) * 100) : 0,
      });
    } catch (error) {
      return next(error);
    }
  })
);

router.get(
  '/admin/user-analytics',
  verifyAdminToken,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const search = (req.query.search as string || '').trim();

      // When searching, restrict to users matching the query.
      let restrictIds: string[] | null = null;
      if (search) {
        const matches = await prisma.user.findMany({
          where: {
            OR: [
              { username: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { displayName: { contains: search, mode: 'insensitive' } },
            ],
          },
          select: { id: true },
          take: 500,
        });
        restrictIds = matches.map((m) => m.id);
        if (restrictIds.length === 0) {
          return successResponse(res, 'User analytics fetched', { users: [], page, totalPages: 1, total: 0 });
        }
      }

      const baseWhere = restrictIds ? { userId: { in: restrictIds } } : undefined;

      const grouped = await prisma.cipherMessage.groupBy({
        by: ['userId'],
        where: baseWhere,
        _sum: { tokensUsed: true },
        _count: { _all: true },
        _max: { createdAt: true },
        orderBy: { _sum: { tokensUsed: 'desc' } },
        skip: (page - 1) * limit,
        take: limit,
      });

      const distinctUsers = await prisma.cipherMessage.findMany({ where: baseWhere, distinct: ['userId'], select: { userId: true } });
      const totalUsers = distinctUsers.length;

      const userIds = grouped.map((g) => g.userId);
      const users = await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: { id: true, displayName: true, username: true, email: true, avatar: true },
      });
      const userMap = new Map(users.map((u) => [u.id, u]));

      const chatCounts = await prisma.cipherMessage.groupBy({
        by: ['userId'],
        where: { userId: { in: userIds }, role: 'user' },
        _count: { _all: true },
      });
      const chatMap = new Map(chatCounts.map((c) => [c.userId, c._count._all]));

      const rows = grouped.map((g) => ({
        userId: g.userId,
        displayName: userMap.get(g.userId)?.displayName || null,
        username: userMap.get(g.userId)?.username || null,
        email: userMap.get(g.userId)?.email || null,
        avatar: userMap.get(g.userId)?.avatar || null,
        totalChats: chatMap.get(g.userId) || 0,
        totalTokens: g._sum.tokensUsed || 0,
        lastActive: g._max.createdAt,
      }));

      return successResponse(res, 'User analytics fetched', {
        users: rows,
        page,
        totalPages: Math.max(1, Math.ceil(totalUsers / limit)),
        total: totalUsers,
      });
    } catch (error) {
      return next(error);
    }
  })
);

router.get(
  '/admin/feedback',
  verifyAdminToken,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
      const filter = (req.query.type as string || '').trim();
      const where: any = {};
      if (filter === 'good' || filter === 'bad') where.feedbackType = filter;

      const [feedback, total] = await Promise.all([
        prisma.cipherFeedback.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { user: { select: { id: true, displayName: true, username: true, avatar: true } } },
        }),
        prisma.cipherFeedback.count({ where }),
      ]);

      return successResponse(res, 'Feedback fetched', {
        feedback,
        page,
        totalPages: Math.max(1, Math.ceil(total / limit)),
        total,
      });
    } catch (error) {
      return next(error);
    }
  })
);

router.use(verifyAccessToken);

function validateMessage(message: unknown): string | null {
  if (!message || typeof message !== 'string' || !message.trim()) {
    return 'Message is required';
  }
  if (message.length > 2000) {
    return 'Message too long (max 2000 chars)';
  }
  return null;
}

router.post(
  '/chat',
  attachCipherTier,
  cipherDailyLimit(),
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { message, conversationId, customPrompt } = req.body as {
        message?: string;
        conversationId?: string;
        customPrompt?: string;
      };

      const msgError = validateMessage(message);
      if (msgError) {
        return errorResponse(res, msgError, null, 400);
      }

      let convId = conversationId;
      if (!convId) {
        const conv = await prisma.cipherConversation.create({
          data: { userId, title: message!.slice(0, 80) },
        });
        convId = conv.id;
      } else {
        const conv = await prisma.cipherConversation.findFirst({
          where: { id: convId, userId },
        });
        if (!conv) {
          return errorResponse(res, 'Conversation not found', null, 404);
        }
      }

      const history = await prisma.cipherMessage.findMany({
        where: { conversationId: convId, userId },
        orderBy: { createdAt: 'asc' },
        take: env.CIPHER_MAX_HISTORY,
        select: { role: true, content: true },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });

      const result = await chat(
        userId,
        message!,
        history.map((m) => ({ role: m.role, content: m.content })),
        user?.displayName || undefined,
        customPrompt || undefined
      );

      await prisma.cipherMessage.createMany({
        data: [
          {
            conversationId: convId,
            userId,
            role: 'user',
            content: message!,
          },
          {
            conversationId: convId,
            userId,
            role: 'assistant',
            content: result.content,
            tokensUsed: result.tokensUsed,
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            provider: result.provider,
          },
        ],
      });

      await prisma.cipherConversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() },
      });

      await incrementCipherUsage(req, result.tokensUsed);

      await prisma.cipherUsage.upsert({
        where: {
          userId_date: {
            userId,
            date: new Date(new Date().toISOString().slice(0, 10)),
          },
        },
        create: {
          userId,
          date: new Date(new Date().toISOString().slice(0, 10)),
          tokensUsed: result.tokensUsed,
          messageCount: 1,
        },
        update: {
          tokensUsed: { increment: result.tokensUsed },
          messageCount: { increment: 1 },
        },
      });

      const assistantMsg = await prisma.cipherMessage.findFirst({
        where: { conversationId: convId, userId, role: 'assistant' },
        orderBy: { createdAt: 'desc' },
      });

      const dailyKey = `cipher:usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
      let dailyUsed = result.tokensUsed;
      try {
        const { redis } = await import('../config/redis');
        const val = await redis.get(dailyKey);
        dailyUsed = parseInt(val || '0', 10);
      } catch {}

      const tierLimit = (req as any).userTier?.dailyTokenLimit;
      const chatDailyLimit = tierLimit === Infinity ? null : (tierLimit ?? env.CIPHER_DAILY_TOKEN_LIMIT);

      return successResponse(res, 'Message sent', {
        message: {
          id: assistantMsg?.id,
          role: 'assistant',
          content: result.content,
          createdAt: assistantMsg?.createdAt,
        },
        conversationId: convId,
        usage: {
          tokensUsed: result.tokensUsed,
          dailyUsed,
          dailyLimit: chatDailyLimit,
          provider: result.provider,
        },
      });
    } catch (error: any) {
      if (error.code === 'AI_UNAVAILABLE') {
        return errorResponse(res, error.message, null, 503);
      }
      return next(error);
    }
  })
);

router.post(
  '/chat/stream',
  attachCipherTier,
  cipherDailyLimit(),
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id;
      const { message, conversationId, customPrompt } = req.body as { message?: string; conversationId?: string; customPrompt?: string };

      const msgError = validateMessage(message);
      if (msgError) {
        return errorResponse(res, msgError, null, 400);
      }

      let convId = conversationId;
      if (!convId) {
        const conv = await prisma.cipherConversation.create({
          data: { userId, title: message!.slice(0, 80) },
        });
        convId = conv.id;
      } else {
        const conv = await prisma.cipherConversation.findFirst({
          where: { id: convId, userId },
        });
        if (!conv) {
          return errorResponse(res, 'Conversation not found', null, 404);
        }
      }

      await prisma.cipherMessage.create({
        data: { conversationId: convId, userId, role: 'user', content: message! },
      });

      const history = await prisma.cipherMessage.findMany({
        where: { conversationId: convId, userId },
        orderBy: { createdAt: 'asc' },
        take: env.CIPHER_MAX_HISTORY,
        select: { role: true, content: true },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      res.write(`data: ${JSON.stringify({ conversationId: convId })}\n\n`);

      const recentHistory = history.slice(-env.CIPHER_MAX_HISTORY);
      const messages = [
        ...recentHistory.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message! },
      ];

      let fullContent = '';
      let finalTokensUsed = 0;
      let finalPromptTokens = 0;
      let finalCompletionTokens = 0;
      let finalProvider = 'nim';

      const gen = streamFromProvider(messages, user?.displayName || undefined, customPrompt || undefined);
      for await (const chunk of gen) {
        if (chunk.token) {
          fullContent += chunk.token;
          res.write(`data: ${JSON.stringify({ token: chunk.token })}\n\n`);
        } else if (chunk.done && chunk.tokensUsed !== undefined) {
          finalTokensUsed = chunk.tokensUsed;
          finalPromptTokens = chunk.promptTokens || 0;
          finalCompletionTokens = chunk.completionTokens || 0;
          finalProvider = chunk.provider || 'nim';
        } else if (chunk.error) {
          res.write(`data: ${JSON.stringify({ error: chunk.error })}\n\n`);
          res.end();
          return;
        }
      }

      const assistantMsg = await prisma.cipherMessage.create({
        data: {
          conversationId: convId,
          userId,
          role: 'assistant',
          content: fullContent,
          tokensUsed: finalTokensUsed,
          promptTokens: finalPromptTokens,
          completionTokens: finalCompletionTokens,
          provider: finalProvider,
        },
      });

      await prisma.cipherConversation.update({
        where: { id: convId },
        data: { updatedAt: new Date() },
      });

      await incrementCipherUsage(req, finalTokensUsed);

      await prisma.cipherUsage.upsert({
        where: { userId_date: { userId, date: new Date(new Date().toISOString().slice(0, 10)) } },
        create: { userId, date: new Date(new Date().toISOString().slice(0, 10)), tokensUsed: finalTokensUsed, messageCount: 1 },
        update: { tokensUsed: { increment: finalTokensUsed }, messageCount: { increment: 1 } },
      });

      const dailyKey = `cipher:usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
      let dailyUsed = finalTokensUsed;
      try {
        const { redis } = await import('../config/redis');
        const val = await redis.get(dailyKey);
        dailyUsed = parseInt(val || '0', 10);
      } catch {}

      const tierLimit = (req as any).userTier?.dailyTokenLimit;
      const streamDailyLimit = tierLimit === Infinity ? null : (tierLimit ?? env.CIPHER_DAILY_TOKEN_LIMIT);

      res.write(`data: ${JSON.stringify({
        done: true,
        messageId: assistantMsg.id,
        conversationId: convId,
        tokensUsed: finalTokensUsed,
        dailyUsed,
        dailyLimit: streamDailyLimit,
        provider: finalProvider,
      })}\n\n`);
      res.end();
      return;
    } catch (error: any) {
      if (!res.headersSent) {
        if (error.code === 'AI_UNAVAILABLE') {
          return errorResponse(res, error.message, null, 503);
        }
        return res.status(500).json({ success: false, message: 'Internal server error' });
      }
      res.write(`data: ${JSON.stringify({ error: 'Internal server error' })}\n\n`);
      res.end();
      return;
    }
  }
);

router.get(
  '/history',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const conversationId = req.query.conversationId as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

      const where: any = { userId };
      if (conversationId) {
        where.conversationId = conversationId;
      }

      const messages = await prisma.cipherMessage.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      return successResponse(res, 'History fetched', messages);
    } catch (error) {
      return next(error);
    }
  })
);

router.get(
  '/conversations',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 30));
      const skip = (page - 1) * limit;

      const conversations = await prisma.cipherConversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: {
          _count: { select: { messages: true } },
        },
      });

      return successResponse(res, 'Conversations fetched', conversations);
    } catch (error) {
      return next(error);
    }
  })
);

router.post(
  '/conversations',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { title } = req.body as { title?: string };

      const conversation = await prisma.cipherConversation.create({
        data: {
          userId,
          title: title?.slice(0, 80) || 'New conversation',
        },
      });

      return successResponse(res, 'Conversation created', conversation, 201);
    } catch (error) {
      return next(error);
    }
  })
);

router.put(
  '/conversations/:id',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;
      const { title } = req.body as { title?: string };

      const conv = await prisma.cipherConversation.findFirst({
        where: { id, userId },
      });
      if (!conv) {
        return errorResponse(res, 'Conversation not found', null, 404);
      }

      const updated = await prisma.cipherConversation.update({
        where: { id },
        data: { title: title?.slice(0, 80) || conv.title },
      });

      return successResponse(res, 'Conversation updated', updated);
    } catch (error) {
      return next(error);
    }
  })
);

router.delete(
  '/conversations/:id',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { id } = req.params;

      const conv = await prisma.cipherConversation.findFirst({
        where: { id, userId },
      });
      if (!conv) {
        return errorResponse(res, 'Conversation not found', null, 404);
      }

      await prisma.cipherConversation.delete({ where: { id } });

      return successResponse(res, 'Conversation deleted', { success: true });
    } catch (error) {
      return next(error);
    }
  })
);

router.get(
  '/usage',
  attachCipherTier,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const tieredReq = req as TieredRequest;
      const tierLimit = tieredReq.userTier?.dailyTokenLimit;
      const dailyLimit = tierLimit === Infinity ? null : (tierLimit ?? env.CIPHER_DAILY_TOKEN_LIMIT);
      const today = new Date(new Date().toISOString().slice(0, 10));

      const usage = await prisma.cipherUsage.findUnique({
        where: { userId_date: { userId, date: today } },
      });

      const dailyKey = `cipher:usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
      let redisUsage = 0;
      try {
        const { redis } = await import('../config/redis');
        const val = await redis.get(dailyKey);
        redisUsage = parseInt(val || '0', 10);
      } catch {}

      const tokensUsed = Math.max(usage?.tokensUsed || 0, redisUsage);
      const remaining = dailyLimit === null ? null : Math.max(0, dailyLimit - tokensUsed);

      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      tomorrow.setUTCHours(0, 0, 0, 0);

      return successResponse(res, 'Usage fetched', {
        tokensUsed,
        messageCount: usage?.messageCount || 0,
        dailyLimit,
        remaining,
        resetsAt: tomorrow.toISOString(),
      });
    } catch (error) {
      return next(error);
    }
  })
);

router.delete(
  '/history',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;

      await prisma.cipherConversation.deleteMany({ where: { userId } });

      const today = new Date(new Date().toISOString().slice(0, 10));
      await prisma.cipherUsage.upsert({
        where: { userId_date: { userId, date: today } },
        create: { userId, date: today, tokensUsed: 0, messageCount: 0 },
        update: { tokensUsed: 0 },
      });

      const dailyKey = `cipher:usage:${userId}:${new Date().toISOString().slice(0, 10)}`;
      try {
        const { redis } = await import('../config/redis');
        await redis.del(dailyKey);
      } catch {}

      return successResponse(res, 'History cleared', { success: true });
    } catch (error) {
      return next(error);
    }
  })
);

// --- Tier info ---

function sanitizeTier(tier: any) {
  if (!tier) return tier;
  return {
    ...tier,
    dailyTokenLimit: tier.dailyTokenLimit === Infinity ? null : tier.dailyTokenLimit,
  };
}

router.get(
  '/tier',
  attachCipherTier,
  authHandler(async (req: AuthenticatedRequest, res: Response) => {
    const tieredReq = req as TieredRequest;
    return successResponse(res, 'Tier info', {
      tierIndex: tieredReq.userTierIndex ?? 0,
      tier: sanitizeTier(tieredReq.userTier),
    });
  })
);

// --- Regenerate last AI message ---

router.post(
  '/messages/:id/regenerate',
  attachCipherTier,
  cipherDailyLimit(),
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const messageId = req.params.id;

      const originalMsg = await prisma.cipherMessage.findFirst({
        where: { id: messageId, userId, role: 'assistant' },
      });
      if (!originalMsg) return errorResponse(res, 'Message not found', null, 404);

      const conversation = await prisma.cipherConversation.findFirst({
        where: { id: originalMsg.conversationId, userId },
      });
      if (!conversation) return errorResponse(res, 'Conversation not found', null, 404);

      const history = await prisma.cipherMessage.findMany({
        where: { conversationId: originalMsg.conversationId, userId, createdAt: { lt: originalMsg.createdAt } },
        orderBy: { createdAt: 'asc' },
        take: env.CIPHER_MAX_HISTORY,
        select: { role: true, content: true },
      });

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { displayName: true },
      });

      const result = await chat(
        userId,
        history.filter((m) => m.role === 'user').pop()?.content || '',
        history,
        user?.displayName || undefined
      );

      await prisma.cipherMessage.update({
        where: { id: messageId },
        data: { content: result.content, tokensUsed: result.tokensUsed, provider: result.provider },
      });

      await incrementCipherUsage(req, result.tokensUsed);

      await prisma.cipherUsage.upsert({
        where: { userId_date: { userId, date: new Date(new Date().toISOString().slice(0, 10)) } },
        create: { userId, date: new Date(new Date().toISOString().slice(0, 10)), tokensUsed: result.tokensUsed, messageCount: 0 },
        update: { tokensUsed: { increment: result.tokensUsed } },
      });

      return successResponse(res, 'Message regenerated', {
        id: messageId, content: result.content, tokensUsed: result.tokensUsed, provider: result.provider,
      });
    } catch (error: any) {
      if (error.code === 'AI_UNAVAILABLE') return errorResponse(res, error.message, null, 503);
      return next(error);
    }
  })
);

// --- Search messages ---

router.get(
  '/search',
  attachCipherTier,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const q = (req.query.q as string || '').trim();
      if (!q || q.length < 2) return errorResponse(res, 'Query too short (min 2 chars)', null, 400);

      const tieredReq = req as TieredRequest;
      if (!tieredReq.userTier?.features.search) {
        return errorResponse(res, 'Search not available on your plan', null, 403);
      }

      const messages = await prisma.cipherMessage.findMany({
        where: {
          userId,
          content: { contains: q, mode: 'insensitive' },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true, content: true, role: true, createdAt: true, conversationId: true,
        },
      });

      return successResponse(res, 'Search results', messages);
    } catch (error) {
      return next(error);
    }
  })
);

// --- Export conversation ---

router.get(
  '/conversations/:id/export',
  attachCipherTier,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const convId = req.params.id;
      const format = (req.query.format as string) || 'md';

      const tieredReq = req as TieredRequest;
      if (!tieredReq.userTier?.features.exportChat) {
        return errorResponse(res, 'Export not available on your plan', null, 403);
      }

      const conv = await prisma.cipherConversation.findFirst({ where: { id: convId, userId } });
      if (!conv) return errorResponse(res, 'Conversation not found', null, 404);

      const messages = await prisma.cipherMessage.findMany({
        where: { conversationId: convId, userId },
        orderBy: { createdAt: 'asc' },
        select: { role: true, content: true, createdAt: true },
      });

      if (format === 'json') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${conv.title}.json"`);
        return res.json({ title: conv.title, exportedAt: new Date().toISOString(), messages });
      }

      let md = `# ${conv.title}\n\n_Exported from Cipher on ${new Date().toLocaleString()}_\n\n---\n\n`;
      for (const m of messages) {
        const label = m.role === 'user' ? 'You' : 'Cipher';
        md += `**${label}** _(${new Date(m.createdAt).toLocaleString()})_\n\n${m.content}\n\n---\n\n`;
      }

      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${conv.title}.md"`);
      return res.send(md);
    } catch (error) {
      return next(error);
    }
  })
);

// --- Branch conversation ---

router.post(
  '/conversations/:id/branch',
  attachCipherTier,
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const convId = req.params.id;
      const { messageId } = req.body as { messageId?: string };

      const tieredReq = req as TieredRequest;
      if (!tieredReq.userTier?.features.branching) {
        return errorResponse(res, 'Branching not available on your plan', null, 403);
      }

      const conv = await prisma.cipherConversation.findFirst({ where: { id: convId, userId } });
      if (!conv) return errorResponse(res, 'Conversation not found', null, 404);

      const branchPoint = messageId
        ? await prisma.cipherMessage.findFirst({ where: { id: messageId, conversationId: convId, userId } })
        : null;

      const history = await prisma.cipherMessage.findMany({
        where: {
          conversationId: convId, userId,
          ...(branchPoint ? { createdAt: { lte: branchPoint.createdAt } } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      const newConv = await prisma.cipherConversation.create({
        data: { userId, title: `${conv.title} (branch)` },
      });

      if (history.length > 0) {
        await prisma.cipherMessage.createMany({
          data: history.map((m) => ({
            conversationId: newConv.id,
            userId,
            role: m.role,
            content: m.content,
            tokensUsed: m.tokensUsed || 0,
            provider: m.provider || '',
          })),
        });
      }

      return successResponse(res, 'Branch created', newConv, 201);
    } catch (error) {
      return next(error);
    }
  })
);

// --- Feedback on an AI message ---

router.post(
  '/feedback',
  authHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const { messageId, feedbackType, reason } = req.body as { messageId?: string; feedbackType?: string; reason?: string };

      if (!messageId || (feedbackType !== 'good' && feedbackType !== 'bad')) {
        return errorResponse(res, 'messageId and feedbackType (good|bad) are required', null, 400);
      }

      const aiMsg = await prisma.cipherMessage.findFirst({
        where: { id: messageId, userId, role: 'assistant' },
      });
      if (!aiMsg) return errorResponse(res, 'Message not found', null, 404);

      const promptMsg = await prisma.cipherMessage.findFirst({
        where: { conversationId: aiMsg.conversationId, userId, role: 'user', createdAt: { lt: aiMsg.createdAt } },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      });

      const cleanReason = (reason || '').trim().slice(0, 1000) || null;

      const feedback = await prisma.cipherFeedback.upsert({
        where: { messageId },
        create: {
          messageId,
          userId,
          promptText: promptMsg?.content || '',
          responseText: aiMsg.content,
          feedbackType,
          reason: cleanReason,
          tokensUsed: aiMsg.tokensUsed,
        },
        update: { feedbackType, reason: cleanReason },
      });

      return successResponse(res, 'Feedback recorded', { id: feedback.id, feedbackType: feedback.feedbackType });
    } catch (error) {
      return next(error);
    }
  })
);

export default router;
