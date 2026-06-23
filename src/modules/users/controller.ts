import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { UsersService } from './service';
import { prisma } from '../../config/database';
import { successResponse } from '../../utils/response';
import { BlockCache } from '../../utils/blockCache';
import { updateProfileSchema } from './dto';

export class UsersController {
  static async me(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const user = await UsersService.getMe(userId);
      return successResponse(res, 'Profile fetched successfully', user);
    } catch (error) {
      return next(error);
    }
  }

  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const q = req.query.q as string || '';
      const currentUserId = req.user?.id;

      // Get blocked user IDs to exclude from results
      const blocks = await prisma.block.findMany({
        where: {
          OR: [
            { blockerId: currentUserId },
            { blockedId: currentUserId },
          ],
        },
        select: { blockerId: true, blockedId: true },
      });
      const blockedIds = new Set<string>();
      for (const b of blocks) {
        if (b.blockerId === currentUserId) blockedIds.add(b.blockedId);
        if (b.blockedId === currentUserId) blockedIds.add(b.blockerId);
      }

      // Only show public users or users who share a conversation with the searcher
      const conversationUserIds = await prisma.participant.findMany({
        where: { conversation: { participants: { some: { userId: currentUserId } } } },
        select: { userId: true },
      });
      const contactIds = new Set(conversationUserIds.map((p) => p.userId));
      contactIds.delete(currentUserId!);

      const users = await prisma.user.findMany({
        where: {
          id: { not: currentUserId, notIn: [...blockedIds] },
          AND: [
            {
              OR: [
                { displayName: { contains: q, mode: 'insensitive' } },
                { email: { contains: q, mode: 'insensitive' } },
                { phone: { contains: q } },
              ],
            },
            {
              OR: [
                { isPublic: true },
                { id: { in: [...contactIds] } },
              ],
            },
          ],
        },
        select: {
          id: true,
          displayName: true,
          avatar: true,
          lastSeen: true,
          username: true,
        },
        take: 20,
      });

      // Fetch online status from Redis/presence
      const usersWithPresence = await Promise.all(
        users.map(async (u) => {
          const presence = await UsersService.getPresence(u.id);
          return {
            ...u,
            isOnline: presence.isOnline,
            lastSeen: presence.lastSeen,
          };
        })
      );

      return successResponse(res, 'Users fetched successfully', usersWithPresence);
    } catch (error) {
      return next(error);
    }
  }


  static async saveFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const { fcmToken } = req.body;
      const result = await UsersService.saveFcmToken(userId, fcmToken);
      return successResponse(res, 'FCM token saved successfully', result);
    } catch (error) {
      return next(error);
    }
  }

  static async getBlocked(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const blocks = await prisma.block.findMany({
        where: { blockerId: currentUserId },
        select: {
          blockedId: true,
          blocked: { select: { id: true, displayName: true, avatar: true } },
        },
      });
      const users = blocks.map((b) => b.blocked);
      return successResponse(res, 'Blocked users fetched successfully', users);
    } catch (error) {
      return next(error);
    }
  }

  static async block(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { blockedId } = req.body;

      if (!blockedId) {
        return res.status(400).json({ success: false, message: 'Blocked user ID is required' });
      }

      if (currentUserId === blockedId) {
        return res.status(400).json({ success: false, message: 'You cannot block yourself' });
      }

      const existingBlock = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId,
          },
        },
      });

      if (existingBlock) {
        return successResponse(res, 'User already blocked');
      }

      try {
        await BlockCache.addBlock(currentUserId, blockedId);
      } catch (err) {
        return next(err);
      }

      return successResponse(res, 'User blocked successfully', null, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async unblock(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { blockedId } = req.body;

      if (!blockedId) {
        return res.status(400).json({ success: false, message: 'Blocked user ID is required' });
      }

      const existingBlock = await prisma.block.findUnique({
        where: {
          blockerId_blockedId: {
            blockerId: currentUserId,
            blockedId,
          },
        },
      });

      if (!existingBlock) {
        return res.status(404).json({ success: false, message: 'Block not found' });
      }

      try {
        await BlockCache.removeBlock(currentUserId, blockedId);
      } catch (err) {
        return next(err);
      }

      return successResponse(res, 'User unblocked successfully');
    } catch (error) {
      return next(error);
    }
  }

  static async getByUsername(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { username } = req.params;
      const user = await UsersService.getByUsername(username, req.user?.id);
      return successResponse(res, 'User fetched successfully', user);
    } catch (error) {
      return next(error);
    }
  }

  static async listSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const sessions = await UsersService.listSessions(userId, req.user?.sid);
      return successResponse(res, 'Sessions fetched successfully', sessions);
    } catch (error) {
      return next(error);
    }
  }

  static async revokeSession(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const { id } = req.params;
      await UsersService.revokeSession(userId, id);
      return successResponse(res, 'Session revoked successfully', null);
    } catch (error) {
      return next(error);
    }
  }

  static async revokeOtherSessions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const result = await UsersService.revokeOtherSessions(userId, req.user?.sid);
      return successResponse(res, 'Other sessions revoked successfully', result);
    } catch (error) {
      return next(error);
    }
  }

  static async deleteAccount(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const { password } = req.body;
      if (!password) return res.status(400).json({ success: false, message: 'Password is required' });
      await UsersService.deleteAccount(userId, password);
      return successResponse(res, 'Account deleted successfully', null);
    } catch (error) {
      return next(error);
    }
  }

  static async updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: parsed.error.format(),
        });
      }

      const updated = await UsersService.updateProfile(userId, parsed.data);
      return successResponse(res, 'Profile updated successfully', updated);
    } catch (error) {
      return next(error);
    }
  }
}
