import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { FriendsService } from './service';
import { successResponse } from '../../utils/response';
import { UsersService } from '../users/service';
import { NotificationQueueService } from '../../services/notificationQueue';
import { logger } from '../../utils/logger';

export class FriendsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friends = await FriendsService.getFriends(req.user!.id);
      return successResponse(res, 'Friends fetched successfully', friends);
    } catch (error) {
      return next(error);
    }
  }

  static async listWithPresence(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const friends = await FriendsService.getFriends(req.user!.id);
      const presenceResults = await Promise.all(
        friends.map(async (friend) => {
          const isOnline = await (await import('../../config/redis')).redis.get(`presence:${friend.id}`);
          return { ...friend, isOnline: isOnline === 'online' };
        })
      );
      return successResponse(res, 'Friends fetched successfully', presenceResults);
    } catch (error) {
      return next(error);
    }
  }

  static async sendRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { userId } = req.body;
      const result = await FriendsService.sendRequest(req.user!.id, userId);
      void FriendsController.pushFriendRequestNotification(req.user!, result);
      return successResponse(res, 'Friend request sent', result, 201);
    } catch (error) {
      return next(error);
    }
  }

  private static async pushFriendRequestNotification(currentUser: { id: string; displayName?: string | null }, request: { id: string; sender?: { id: string; displayName?: string | null }; receiver?: { id: string; displayName?: string | null } }) {
    try {
      const receiverId = request.receiver?.id;
      if (!receiverId) return;
      const senderName = request.sender?.displayName || currentUser.displayName || 'Someone';
      const presence = await UsersService.getPresence(receiverId);
      if (presence.isOnline) return;
      await NotificationQueueService.enqueue({
        userId: receiverId,
        type: 'friend_request',
        title: 'Friend Request',
        body: `${senderName} sent you a friend request`,
        data: {
          senderId: request.sender?.id || currentUser.id,
          senderName,
          requestId: request.id,
        },
      });
    } catch (err) {
      logger.error('Failed to push friend request notification:', err);
    }
  }

  static async acceptRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const result = await FriendsService.acceptRequest(req.user!.id, requestId);
      return successResponse(res, 'Friend request accepted', result);
    } catch (error) {
      return next(error);
    }
  }

  static async rejectRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const result = await FriendsService.rejectRequest(req.user!.id, requestId);
      return successResponse(res, 'Friend request rejected', result);
    } catch (error) {
      return next(error);
    }
  }

  static async cancelRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { requestId } = req.params;
      const result = await FriendsService.cancelRequest(req.user!.id, requestId);
      return successResponse(res, 'Friend request cancelled', result);
    } catch (error) {
      return next(error);
    }
  }

  static async removeFriend(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { friendId } = req.params;
      const result = await FriendsService.removeFriend(req.user!.id, friendId);
      return successResponse(res, result.removed ? 'Friend removed' : 'Not friends', result);
    } catch (error) {
      return next(error);
    }
  }

  static async pendingReceived(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requests = await FriendsService.getPendingReceived(req.user!.id);
      return successResponse(res, 'Pending requests fetched', requests);
    } catch (error) {
      return next(error);
    }
  }

  static async pendingSent(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const requests = await FriendsService.getPendingSent(req.user!.id);
      return successResponse(res, 'Sent requests fetched', requests);
    } catch (error) {
      return next(error);
    }
  }
}
