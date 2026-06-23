import { Response, NextFunction } from 'express';
import { Server } from 'socket.io';
import { prisma } from '../../config/database';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { successResponse } from '../../utils/response';

const STORY_TTL_MS = 24 * 60 * 60 * 1000;
const VIEWERS_PAGE_SIZE = 100;
const FEED_LIMIT = 200;

/** Emoji the client offers in the quick-reaction bar. */
const ALLOWED_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/** Only these fontStyle values are accepted — must match the FONTS array in CreateStoryModal. */
const ALLOWED_FONT_STYLES = ['font-story-sans', 'font-story-serif', 'font-story-mono', 'font-story-cursive'];

/** Ids of users the given user shares a DIRECT conversation with (their "contacts"). */
const getContactIds = async (userId: string): Promise<string[]> => {
  const directConvs = await prisma.conversation.findMany({
    where: {
      type: 'DIRECT',
      participants: { some: { userId } },
    },
    select: { participants: { select: { userId: true } } },
  });
  const ids = new Set<string>();
  for (const conv of directConvs) {
    for (const p of conv.participants) {
      if (p.userId !== userId) ids.add(p.userId);
    }
  }
  return [...ids];
};

export class StoriesController {
  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { type, mediaUrl, caption, bgColor, fontStyle } = req.body as {
        type?: string;
        mediaUrl?: string;
        caption?: string;
        bgColor?: string;
        fontStyle?: string;
      };

      if (type !== 'IMAGE' && type !== 'VIDEO' && type !== 'TEXT') {
        return res.status(400).json({ success: false, message: 'Invalid story type' });
      }
      if ((type === 'IMAGE' || type === 'VIDEO') && !mediaUrl) {
        return res.status(400).json({ success: false, message: 'mediaUrl is required for media stories' });
      }
      if (type === 'TEXT' && (!caption || !caption.trim())) {
        return res.status(400).json({ success: false, message: 'caption is required for text stories' });
      }
      if (caption && caption.length > 700) {
        return res.status(400).json({ success: false, message: 'Caption is too long' });
      }
      // Validate bgColor: hex color or a gradient from the allowed set.
      if (bgColor && !GRADIENT_BG_COLORS.includes(bgColor) && !/^#[0-9a-fA-F]{6}$/.test(bgColor)) {
        return res.status(400).json({ success: false, message: 'Invalid bgColor' });
      }
      // Validate fontStyle against an allowlist to prevent CSS injection.
      if (fontStyle && !ALLOWED_FONT_STYLES.includes(fontStyle)) {
        return res.status(400).json({ success: false, message: 'Invalid fontStyle' });
      }

      const story = await prisma.story.create({
        data: {
          userId: currentUserId,
          type: type as any,
          mediaUrl: mediaUrl || null,
          caption: caption?.trim() || null,
          bgColor: bgColor || null,
          fontStyle: fontStyle || null,
          expiresAt: new Date(Date.now() + STORY_TTL_MS),
        },
        include: {
          user: { select: { id: true, displayName: true, avatar: true } },
        },
      });

      // Notify contacts via a single room emit per contact (still per-contact
      // because each contact has their own user room).
      const io = req.app.get('io') as Server;
      const contactIds = await getContactIds(currentUserId);
      for (const contactId of contactIds) {
        io.to(`user:${contactId}`).emit('story:new', story);
      }

      return successResponse(res, 'Story posted', story, 201);
    } catch (error) {
      return next(error);
    }
  }

  /** Active stories from the user's contacts and themselves, grouped by author. */
  static async feed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const contactIds = await getContactIds(currentUserId);

      const stories = await prisma.story.findMany({
        where: {
          userId: { in: [...contactIds, currentUserId] },
          expiresAt: { gt: new Date() },
        },
        include: {
          user: { select: { id: true, displayName: true, avatar: true } },
          views: { where: { viewerId: currentUserId }, select: { id: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: FEED_LIMIT,
      });

      const grouped: Record<
        string,
        { user: { id: string; displayName: string | null; avatar: string | null }; stories: any[] }
      > = {};
      for (const s of stories) {
        if (!grouped[s.userId]) grouped[s.userId] = { user: s.user, stories: [] };
        grouped[s.userId].stories.push({
          id: s.id,
          type: s.type,
          mediaUrl: s.mediaUrl,
          caption: s.caption,
          bgColor: s.bgColor,
          fontStyle: s.fontStyle,
          createdAt: s.createdAt,
          expiresAt: s.expiresAt,
          viewed: s.views.length > 0,
        });
      }

      // Own stories first, then most-recently-updated contacts.
      const feed = Object.entries(grouped)
        .map(([userId, group]) => ({ userId, ...group }))
        .sort((a, b) => {
          if (a.userId === currentUserId) return -1;
          if (b.userId === currentUserId) return 1;
          const lastA = a.stories[a.stories.length - 1].createdAt as Date;
          const lastB = b.stories[b.stories.length - 1].createdAt as Date;
          return lastB.getTime() - lastA.getTime();
        });

      return successResponse(res, 'Stories feed', feed);
    } catch (error) {
      return next(error);
    }
  }

  static async markViewed(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const story = await prisma.story.findUnique({ where: { id }, select: { userId: true, expiresAt: true } });
      if (!story || story.expiresAt <= new Date()) {
        return res.status(404).json({ success: false, message: 'Story not found' });
      }
      if (story.userId === currentUserId) {
        return successResponse(res, 'Own story', { viewed: false });
      }

      await prisma.storyView.upsert({
        where: { storyId_viewerId: { storyId: id, viewerId: currentUserId } },
        create: { storyId: id, viewerId: currentUserId },
        update: {},
      });

      // Notify the story author in real time so an open viewers sheet updates.
      const io = req.app.get('io') as Server;
      const viewer = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { id: true, displayName: true, avatar: true },
      });
      io.to(`user:${story.userId}`).emit('story:viewed', { storyId: id, viewer });

      return successResponse(res, 'Story marked viewed', { viewed: true });
    } catch (error) {
      return next(error);
    }
  }

  /** Viewer list — owner only. Paginated. */
  static async getViews(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);

      const story = await prisma.story.findUnique({ where: { id }, select: { userId: true } });
      if (!story) {
        return res.status(404).json({ success: false, message: 'Story not found' });
      }
      if (story.userId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'You can only see viewers of your own stories' });
      }

      const skip = (page - 1) * VIEWERS_PAGE_SIZE;
      const [views, reactions, totalCount] = await Promise.all([
        prisma.storyView.findMany({
          where: { storyId: id },
          include: { viewer: { select: { id: true, displayName: true, avatar: true } } },
          orderBy: { viewedAt: 'desc' },
          skip,
          take: VIEWERS_PAGE_SIZE,
        }),
        prisma.storyReaction.findMany({
          where: { storyId: id },
          select: { userId: true, emoji: true },
        }),
        prisma.storyView.count({ where: { storyId: id } }),
      ]);

      const reactionByUser = new Map(reactions.map((r) => [r.userId, r.emoji]));
      const summary: Record<string, number> = {};
      for (const r of reactions) summary[r.emoji] = (summary[r.emoji] ?? 0) + 1;

      return successResponse(res, 'Story views', {
        viewers: views.map((v) => ({
          ...v.viewer,
          viewedAt: v.viewedAt,
          reactionEmoji: reactionByUser.get(v.viewer.id) ?? null,
        })),
        reactionSummary: summary,
        totalCount,
        page,
        hasMore: skip + views.length < totalCount,
      });
    } catch (error) {
      return next(error);
    }
  }

  /** React to a story with one emoji from the allowed set (one reaction per user). */
  static async react(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { emoji } = req.body as { emoji?: string };

      if (!emoji || !ALLOWED_REACTIONS.includes(emoji)) {
        return res.status(400).json({ success: false, message: 'Invalid reaction' });
      }

      const story = await prisma.story.findUnique({
        where: { id },
        select: { userId: true, expiresAt: true },
      });
      if (!story || story.expiresAt <= new Date()) {
        return res.status(404).json({ success: false, message: 'Story not found' });
      }
      if (story.userId === currentUserId) {
        return res.status(400).json({ success: false, message: 'You cannot react to your own story' });
      }

      await prisma.storyReaction.upsert({
        where: { storyId_userId: { storyId: id, userId: currentUserId } },
        create: { storyId: id, userId: currentUserId, emoji },
        update: { emoji },
      });

      // Notify the story author so an open viewers sheet updates live.
      const io = req.app.get('io') as Server;
      const reactor = await prisma.user.findUnique({
        where: { id: currentUserId },
        select: { id: true, displayName: true, avatar: true },
      });
      io.to(`user:${story.userId}`).emit('story:reaction', { storyId: id, emoji, user: reactor });

      return successResponse(res, 'Reaction saved', { emoji });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const story = await prisma.story.findUnique({ where: { id }, select: { userId: true } });
      if (!story) {
        return res.status(404).json({ success: false, message: 'Story not found' });
      }
      if (story.userId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'You can only delete your own stories' });
      }

      await prisma.story.delete({ where: { id } });

      const io = req.app.get('io') as Server;
      const contactIds = await getContactIds(currentUserId);
      for (const contactId of contactIds) {
        io.to(`user:${contactId}`).emit('story:deleted', { storyId: id, userId: currentUserId });
      }

      return successResponse(res, 'Story deleted', { id });
    } catch (error) {
      return next(error);
    }
  }
}

/**
 * Exact gradient strings accepted from the client CreateStoryModal. MUST stay
 * in sync with the BACKGROUNDS array in
 * client/src/components/stories/CreateStoryModal.tsx — solid hex values pass
 * via the regex check, but gradients are matched literally against this list.
 */
const GRADIENT_BG_COLORS = [
  'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
  'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
  'linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)',
  'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
  'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  // Legacy gradients kept valid so stories created before this change still render.
  'linear-gradient(135deg, #1f4037 0%, #99f2c8 100%)',
  'linear-gradient(135deg, #fc4a1a 0%, #f7b733 100%)',
];
