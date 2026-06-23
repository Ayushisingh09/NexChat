import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { prisma } from '../../config/database';
import { successResponse } from '../../utils/response';
import { UsersService } from '../users/service';
import { BlockCache } from '../../utils/blockCache';
import { firebaseAdmin } from '../../config/firebase';
import { logger } from '../../utils/logger';
import { messageVisibilityWhere } from './visibility';

export class MessagesController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const cursor = req.query.cursor as string;
      const limit = parseInt(req.query.limit as string) || 25;
      const currentUserId = req.user?.id!;

      // Fetch clearedAt for current participant
      const participant = await prisma.participant.findUnique({
        where: {
          userId_conversationId: {
            userId: currentUserId,
            conversationId,
          },
        },
        select: {
          clearedAt: true,
        },
      });

      const clearedAt = participant?.clearedAt;

      let whereClause: any = messageVisibilityWhere({
        conversationId,
        currentUserId,
        excludeScheduled: true,
      });

      if (cursor) {
        const cursorMessage = await prisma.message.findUnique({
          where: { id: cursor },
        });
        if (cursorMessage) {
          whereClause.createdAt = {
            lt: cursorMessage.createdAt,
            ...(clearedAt ? { gt: clearedAt } : {}),
          };
        }
      } else if (clearedAt) {
        whereClause.createdAt = { gt: clearedAt };
      }

      const messages = await prisma.message.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              senderId: true,
              isDeleted: true,
            },
          },
          reactions: {
            select: { emoji: true, userId: true },
          },
          stars: {
            where: { userId: currentUserId },
            select: { id: true },
          },
          pollVotes: {
            select: { userId: true, optionIndex: true },
          },
        },
      });

      // Reverse messages to return them in chronological order (oldest first)
      const chronologicalMessages = messages.reverse().map((m) => {
        const { stars, ...rest } = m as typeof m & { stars: { id: string }[] };
        return { ...rest, starred: stars.length > 0 };
      });

      return successResponse(res, 'Messages fetched successfully', {
        messages: chronologicalMessages,
        nextCursor: messages.length === limit ? messages[0].id : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { conversationId, content, type, mediaUrl, replyToId, mentionedUserIds, mentionEveryone, scheduledAt, pollOptionCount } = req.body;

      // Scheduled send: a future timestamp parks the message until the sweep fires it.
      const scheduledDate = scheduledAt ? new Date(scheduledAt) : null;
      const isScheduled = !!scheduledDate && !isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now();

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        include: {
          participants: {
            select: { userId: true, role: true },
          },
        },
      });

      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      if (conversation.type === 'GROUP' && (conversation as any).isAnnouncementMode) {
        const myParticipant = conversation.participants.find((p) => p.userId === currentUserId);
        if (!myParticipant || myParticipant.role !== 'ADMIN') {
          return res.status(403).json({ success: false, message: 'Only admins can send messages in this group.' });
        }
      }

      // Only honor mentions that are actual participants of the conversation
      const participantIdSet = new Set(conversation.participants.map((p) => p.userId));
      let validMentions: string[] = Array.isArray(mentionedUserIds)
        ? [...new Set(mentionedUserIds.filter((uid: unknown): uid is string => typeof uid === 'string' && participantIdSet.has(uid)))]
        : [];

      // @everyone: group admins only — expands to all other participants,
      // which routes through the existing mention mute-bypass push path.
      if (mentionEveryone === true && conversation.type === 'GROUP') {
        const senderParticipant = conversation.participants.find((p) => p.userId === currentUserId);
        if (senderParticipant?.role === 'ADMIN') {
          validMentions = conversation.participants
            .map((p) => p.userId)
            .filter((uid) => uid !== currentUserId);
        }
      }

      const msgType = type || 'TEXT';
      const pollCount =
        msgType === 'POLL' && typeof pollOptionCount === 'number' && pollOptionCount >= 2 && pollOptionCount <= 12
          ? pollOptionCount
          : null;

      let initialStatus: 'SENT' | 'DELIVERED' = 'SENT';
      if (conversation.type === 'DIRECT') {
        const otherParticipant = conversation.participants.find(p => p.userId !== currentUserId);
        if (otherParticipant) {
          // Check if blocked using the O(1) Redis Cache
          const isBlocked = await BlockCache.isBlocked(currentUserId, otherParticipant.userId);
          if (isBlocked) {
            return res.status(403).json({ success: false, message: 'Messaging is blocked between you and this contact.' });
          }

          // Check if the recipient is online (skip for scheduled — recomputed at fire time)
          if (!isScheduled) {
            const presence = await UsersService.getPresence(otherParticipant.userId);
            if (presence.isOnline) {
              initialStatus = 'DELIVERED';
            }
          }
        }
      }

      // Disappearing-message expiry (per-conversation TTL). For scheduled sends the
      // window starts when the message actually fires, so it's stamped by the sweep.
      const convTtl = (conversation as { disappearingTtlSeconds?: number | null }).disappearingTtlSeconds;
      const expiresAt = !isScheduled && convTtl ? new Date(Date.now() + convTtl * 1000) : null;

      const message = await prisma.message.create({
        data: {
          conversationId,
          senderId: currentUserId,
          content,
          type: msgType,
          mediaUrl,
          replyToId: replyToId || undefined,
          status: initialStatus,
          mentionedUserIds: validMentions,
          expiresAt,
          scheduledAt: isScheduled ? scheduledDate : null,
          pollOptionCount: pollCount,
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
          replyTo: {
            select: {
              id: true,
              content: true,
              type: true,
              senderId: true,
              isDeleted: true,
            },
          },
        },
      });

      // Parked for later — don't fan out, push, or resurface chats yet.
      if (isScheduled) {
        return successResponse(res, 'Message scheduled successfully', message, 201);
      }

      // Bump conversation's timestamp so sorting reflects last message time
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { createdAt: new Date() },
      }).catch(() => {});

      // Emit real-time update to all participants via their personal rooms
      const globalIo = (req.app.get('io') as any);
      if (globalIo) {
        conversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('message:new', message);
        });
      }

      // Un-archive for recipients who aren't muted (a new message resurfaces the chat,
      // but a muted+archived chat stays archived). Fire-and-forget.
      const now = new Date();
      prisma.participant
        .updateMany({
          where: {
            conversationId,
            userId: { not: currentUserId },
            archivedAt: { not: null },
            OR: [{ mutedUntil: null }, { mutedUntil: { lt: now } }],
          },
          data: { archivedAt: null },
        })
        .then((r) => {
          if (r.count > 0 && globalIo) {
            conversation.participants.forEach((p) => {
              if (p.userId !== currentUserId) {
                globalIo.to(`user:${p.userId}`).emit('conversation:archive_toggled', {
                  conversationId,
                  archivedAt: null,
                });
              }
            });
          }
        })
        .catch(() => {});

      // Send push notifications to offline, non-muted participants (fire-and-forget).
      // Mentioned users are notified even if they've muted the conversation.
      void MessagesController.sendPushToOfflineParticipants({
        participantIds: conversation.participants.map((p) => p.userId),
        senderId: currentUserId,
        conversationId,
        messageId: message.id,
        content,
        type: type || 'TEXT',
        mentionedUserIds: validMentions,
      });

      return successResponse(res, 'Message sent successfully', message, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async markAsRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { conversationId } = req.params;

      // Find unread messages in this conversation not sent by current user
      const unreadMessages = await prisma.message.findMany({
        where: {
          conversationId,
          senderId: { not: currentUserId },
          status: { not: 'READ' },
        },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
      });

      const hasUnread = unreadMessages.length > 0;
      if (hasUnread) {
        // Atomically update status and create MessageRead records
        await prisma.$transaction([
          prisma.message.updateMany({
            where: {
              conversationId,
              senderId: { not: currentUserId },
              status: { not: 'READ' },
            },
            data: { status: 'READ' as const },
          }),
          prisma.messageRead.createMany({
            data: unreadMessages.map((m) => ({
              messageId: m.id,
              userId: currentUserId,
              readAt: new Date(),
            })),
            skipDuplicates: true,
          }),
          prisma.participant.update({
            where: {
              userId_conversationId: {
                userId: currentUserId,
                conversationId,
              },
            },
            data: {
              readWatermarkId: unreadMessages[unreadMessages.length - 1].id,
            },
          }),
        ]);

        // Honor the reader's "read receipts" privacy setting: when disabled, we still
        // record their own watermark (for their unread state) but never tell others.
        const me = await prisma.user.findUnique({
          where: { id: currentUserId },
          select: { readReceiptsEnabled: true },
        });
        const shareReceipts = me?.readReceiptsEnabled !== false;

        // Emit read watermark event to each participant's personal room so ticks update globally
        const globalIo = (req.app.get('io') as any);
        if (globalIo && shareReceipts) {
          const conv = await prisma.conversation.findUnique({
            where: { id: conversationId },
            include: { participants: true },
          });
          if (conv) {
            const latestMsg = unreadMessages[unreadMessages.length - 1];
            conv.participants.forEach((p) => {
              globalIo.to(`user:${p.userId}`).emit('messages:read_watermark', {
                conversationId,
                readByUserId: currentUserId,
                watermarkId: latestMsg.id,
                watermarkTime: latestMsg.createdAt,
              });
            });
          }
        }
      }

      return successResponse(res, 'Messages marked as read successfully', {
        markedRead: unreadMessages.length,
        latestMessageId: hasUnread ? unreadMessages[unreadMessages.length - 1].id : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { type } = req.body; // "ME" | "EVERYONE"

      if (type !== 'ME' && type !== 'EVERYONE') {
        return res.status(400).json({ success: false, message: 'Invalid deletion type' });
      }

      const msg = await prisma.message.findUnique({
        where: { id },
        include: {
          conversation: {
            include: {
              participants: true,
            },
          },
        },
      });

      if (!msg) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      if (type === 'EVERYONE') {
        if (msg.senderId !== currentUserId) {
          return res.status(403).json({ success: false, message: 'You can only delete your own messages for everyone' });
        }

        // Update the message in DB
        const updatedMsg = await prisma.message.update({
          where: { id },
          data: {
            isDeleted: true,
            content: 'This message was deleted',
            type: 'TEXT',
            mediaUrl: null,
          },
          include: {
            sender: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
              },
            },
            replyTo: {
              select: {
                id: true,
                content: true,
                type: true,
                senderId: true,
              },
            },
          },
        });

        // Broadcast to all conversation participants via Socket.io
        const globalIo = req.app.get('io') as any;
        if (globalIo) {
          msg.conversation.participants.forEach((p) => {
            globalIo.to(`user:${p.userId}`).emit('message:deleted_everyone', updatedMsg);
          });
        }

        return successResponse(res, 'Message deleted for everyone', updatedMsg);
      } else {
        // "ME" - create a MessageDelete record
        await prisma.messageDelete.upsert({
          where: {
            messageId_userId: {
              messageId: id,
              userId: currentUserId,
            },
          },
          create: {
            messageId: id,
            userId: currentUserId,
          },
          update: {},
        });

        return successResponse(res, 'Message deleted for me', { id });
      }
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Fire-and-forget FCM push to participants who are currently offline.
   * Uses firebase-admin's modular messaging API; silently no-ops in mock mode.
   */
  static async sendPushToOfflineParticipants(opts: {
    participantIds: string[];
    senderId: string;
    conversationId: string;
    messageId: string;
    content: string;
    type: string;
    mentionedUserIds?: string[];
  }) {
    if (!firebaseAdmin) return;
    const mentioned = new Set(opts.mentionedUserIds || []);

    try {
      const { getMessaging } = await import('firebase-admin/messaging');
      const messaging = getMessaging(firebaseAdmin);

      const sender = await prisma.user.findUnique({
        where: { id: opts.senderId },
        select: { displayName: true },
      });

      const body =
        opts.type === 'TEXT' ? opts.content : `Sent ${opts.type === 'IMAGE' ? 'a photo' : `a ${opts.type.toLowerCase()}`}`;

      const now = new Date();
      const recipientIds = opts.participantIds.filter((id) => id !== opts.senderId);
      if (recipientIds.length === 0) return;

      // Resolve presence + participant settings + user tokens for every recipient
      // up front in three batched round-trips, rather than 3 serial queries per
      // participant inside the loop (was 3×N round-trips for an N-member group).
      const [presences, participantRows, userRows] = await Promise.all([
        Promise.all(
          recipientIds.map((id) => UsersService.getPresence(id).catch(() => ({ isOnline: false }))),
        ),
        prisma.participant.findMany({
          where: { conversationId: opts.conversationId, userId: { in: recipientIds } },
          select: { userId: true, mutedUntil: true, notificationPreference: true },
        }),
        prisma.user.findMany({
          where: { id: { in: recipientIds } },
          select: { id: true, fcmToken: true, notificationsEnabled: true },
        }),
      ]);

      const presenceById = new Map(recipientIds.map((id, i) => [id, presences[i]]));
      const participantById = new Map(participantRows.map((p) => [p.userId, p]));
      const userById = new Map(userRows.map((u) => [u.id, u]));

      for (const participantId of recipientIds) {
        if (presenceById.get(participantId)?.isOnline) continue;

        const participant = participantById.get(participantId);
        const preference = participant?.notificationPreference || 'ALL';

        if (preference === 'MUTE') {
          continue;
        }

        if (preference === 'MENTIONS_ONLY' && !mentioned.has(participantId)) {
          continue;
        }

        // Skip muted participants (legacy mutedUntil) — unless they were mentioned in this message
        if (!mentioned.has(participantId) && participant?.mutedUntil && participant.mutedUntil > now) {
          continue;
        }

        const user = userById.get(participantId);
        if (!user?.fcmToken) continue;
        // Respect the user's global notifications switch (mentions do not override
        // a fully disabled inbox — that is a deliberate, account-wide opt-out).
        if (user.notificationsEnabled === false) continue;

        messaging
          .send({
            token: user.fcmToken,
            notification: {
              title: sender?.displayName || 'New message',
              body,
            },
            data: {
              conversationId: opts.conversationId,
              messageId: opts.messageId,
              type: 'new_message',
            },
          })
          .catch(async (err: unknown) => {
            const code = (err as { code?: string })?.code;
            if (
              code === 'messaging/registration-token-not-registered' ||
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/invalid-argument'
            ) {
              // Token is dead — clear it so we stop retrying every message.
              await prisma.user
                .update({ where: { id: participantId }, data: { fcmToken: null } })
                .catch(() => undefined);
              logger.info(`Cleared stale FCM token for user ${participantId}`);
            } else {
              logger.error(`FCM send failed for user ${participantId}:`, err);
            }
          });
      }
    } catch (err) {
      logger.error('Failed to dispatch push notifications:', err);
    }
  }

  static async search(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const q = ((req.query.q as string) || '').trim();
      const cursor = req.query.cursor as string;
      const limit = parseInt(req.query.limit as string) || 25;
      const currentUserId = req.user?.id!;

      if (!q) {
        return successResponse(res, 'Search results fetched successfully', {
          messages: [],
          nextCursor: null,
        });
      }

      // Ensure the requester is a participant
      const participant = await prisma.participant.findUnique({
        where: {
          userId_conversationId: { userId: currentUserId, conversationId },
        },
        select: { clearedAt: true },
      });

      if (!participant) {
        return res.status(403).json({ success: false, message: 'Not a participant' });
      }

      const whereClause: any = {
        ...messageVisibilityWhere({ conversationId, currentUserId }),
        isDeleted: false,
        content: { contains: q, mode: 'insensitive' },
      };

      if (participant.clearedAt) {
        whereClause.createdAt = { gt: participant.clearedAt };
      }

      if (cursor) {
        const cursorMessage = await prisma.message.findUnique({ where: { id: cursor } });
        if (cursorMessage) {
          whereClause.createdAt = { ...whereClause.createdAt, lt: cursorMessage.createdAt };
        }
      }

      const messages = await prisma.message.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        include: {
          sender: { select: { id: true, displayName: true, avatar: true } },
          replyTo: { select: { id: true, content: true, type: true, senderId: true, isDeleted: true } },
        },
      });

      return successResponse(res, 'Search results fetched successfully', {
        messages,
        nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async forward(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { messageId, targetConversationId } = req.body;

      if (!messageId || !targetConversationId) {
        return res.status(400).json({ success: false, message: 'messageId and targetConversationId are required' });
      }

      const original = await prisma.message.findUnique({ where: { id: messageId } });
      if (!original || original.isDeleted) {
        return res.status(404).json({ success: false, message: 'Original message not found' });
      }

      const targetConversation = await prisma.conversation.findUnique({
        where: { id: targetConversationId },
        include: { participants: { select: { userId: true } } },
      });

      if (!targetConversation) {
        return res.status(404).json({ success: false, message: 'Target conversation not found' });
      }

      const isParticipant = targetConversation.participants.some((p) => p.userId === currentUserId);
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'You are not a participant in the target conversation' });
      }

      const forwarded = await prisma.message.create({
        data: {
          conversationId: targetConversationId,
          senderId: currentUserId,
          content: original.content,
          type: original.type,
          mediaUrl: original.mediaUrl,
          forwardedFromId: original.id,
          status: 'SENT',
        },
        include: {
          sender: { select: { id: true, displayName: true, avatar: true } },
          replyTo: { select: { id: true, content: true, type: true, senderId: true, isDeleted: true } },
        },
      });

      await prisma.conversation
        .update({ where: { id: targetConversationId }, data: { createdAt: new Date() } })
        .catch(() => {});

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        targetConversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('message:new', forwarded);
        });
      }

      void MessagesController.sendPushToOfflineParticipants({
        participantIds: targetConversation.participants.map((p) => p.userId),
        senderId: currentUserId,
        conversationId: targetConversationId,
        messageId: forwarded.id,
        content: forwarded.content,
        type: forwarded.type,
      });

      return successResponse(res, 'Message forwarded successfully', forwarded, 201);
    } catch (error) {
      return next(error);
    }
  }

  static async toggleReaction(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: messageId } = req.params;
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ success: false, message: 'emoji is required' });
      }

      const existing = await prisma.reaction.findUnique({
        where: {
          messageId_userId_emoji: { messageId, userId: currentUserId, emoji },
        },
      });

      let action: 'add' | 'remove';
      if (existing) {
        await prisma.reaction.delete({ where: { id: existing.id } });
        action = 'remove';
      } else {
        await prisma.reaction.create({
          data: { messageId, userId: currentUserId, emoji },
        });
        action = 'add';
      }

      // Broadcast to all participants of the message's conversation
      const msg = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          conversationId: true,
          conversation: { select: { participants: { select: { userId: true } } } },
        },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo && msg) {
        msg.conversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('message:reaction', {
            conversationId: msg.conversationId,
            messageId,
            userId: currentUserId,
            emoji,
            action,
          });
        });
      }

      return successResponse(res, `Reaction ${action === 'add' ? 'added' : 'removed'} successfully`, { action, emoji });
    } catch (error) {
      return next(error);
    }
  }

  // Shared pin: any participant can pin/unpin a message for the whole
  // conversation. State lives on the message and is broadcast to all members.
  static async togglePin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: messageId } = req.params;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          pinnedAt: true,
          conversationId: true,
          conversation: { select: { participants: { select: { userId: true } } } },
        },
      });

      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }

      const isParticipant = message.conversation.participants.some((p) => p.userId === currentUserId);
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Not a participant of this conversation' });
      }

      const willPin = !message.pinnedAt;
      await prisma.message.update({
        where: { id: messageId },
        data: {
          pinnedAt: willPin ? new Date() : null,
          pinnedById: willPin ? currentUserId : null,
        },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        message.conversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('message:pin', {
            conversationId: message.conversationId,
            messageId,
            pinned: willPin,
            pinnedById: willPin ? currentUserId : null,
          });
        });
      }

      return successResponse(res, willPin ? 'Message pinned' : 'Message unpinned', { pinned: willPin });
    } catch (error) {
      return next(error);
    }
  }

  static async listPinned(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { conversationId } = req.params;
      const currentUserId = req.user?.id!;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId } },
      });

      if (!participant) {
        return res.status(403).json({ success: false, message: 'Not a participant of this conversation' });
      }

      const pinnedMessages = await prisma.message.findMany({
        where: {
          conversationId,
          pinnedAt: { not: null },
          isDeleted: false,
        },
        include: {
          sender: {
            select: {
              id: true,
              displayName: true,
              avatar: true,
            },
          },
        },
        orderBy: { pinnedAt: 'desc' },
      });

      return successResponse(res, 'Pinned messages fetched successfully', pinnedMessages);
    } catch (error) {
      return next(error);
    }
  }

  static async getReactions(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id: messageId } = req.params;

      const reactions = await prisma.reaction.findMany({
        where: { messageId },
        include: {
          user: { select: { id: true, displayName: true } },
        },
      });

      const grouped: Record<string, { count: number; users: { id: string; displayName: string | null }[] }> = {};
      for (const r of reactions) {
        if (!grouped[r.emoji]) {
          grouped[r.emoji] = { count: 0, users: [] };
        }
        grouped[r.emoji].count++;
        grouped[r.emoji].users.push(r.user);
      }

      return successResponse(res, 'Reactions fetched successfully', grouped);
    } catch (error) {
      return next(error);
    }
  }

  // Who voted for which poll option, grouped by option index.
  static async getPollVotes(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: messageId } = req.params;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, type: true, conversationId: true },
      });
      if (!message || message.type !== 'POLL') {
        return res.status(404).json({ success: false, message: 'Poll not found' });
      }

      const isParticipant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: message.conversationId } },
      });
      if (!isParticipant) {
        return res.status(403).json({ success: false, message: 'Not a participant of this conversation' });
      }

      const votes = await prisma.pollVote.findMany({
        where: { messageId },
        include: {
          user: { select: { id: true, displayName: true, avatar: true } },
        },
        orderBy: { createdAt: 'asc' },
      });

      const grouped: Record<number, { id: string; displayName: string | null; avatar: string | null }[]> = {};
      for (const v of votes) {
        if (!grouped[v.optionIndex]) grouped[v.optionIndex] = [];
        grouped[v.optionIndex].push(v.user);
      }

      return successResponse(res, 'Poll votes fetched successfully', grouped);
    } catch (error) {
      return next(error);
    }
  }

  // Who has read / had delivered a specific message (group receipts).
  static async readBy(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: messageId } = req.params;

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: { id: true, senderId: true, createdAt: true, conversationId: true },
      });
      if (!message) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }
      if (message.senderId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'You can only view receipts for your own messages' });
      }

      // Other participants and their read/delivered watermarks
      const participants = await prisma.participant.findMany({
        where: { conversationId: message.conversationId, userId: { not: currentUserId } },
        select: {
          userId: true,
          readWatermarkId: true,
          user: { select: { id: true, displayName: true, avatar: true, readReceiptsEnabled: true } },
        },
      });

      // Resolve each watermark's timestamp so we can compare positions chronologically
      const watermarkIds = [
        ...new Set(participants.map((p) => p.readWatermarkId).filter((x): x is string => !!x)),
      ];
      const watermarkMsgs = watermarkIds.length
        ? await prisma.message.findMany({
            where: { id: { in: watermarkIds } },
            select: { id: true, createdAt: true },
          })
        : [];
      const watermarkTime = new Map(watermarkMsgs.map((m) => [m.id, m.createdAt.getTime()]));

      const readBy: { id: string; displayName: string | null; avatar: string | null }[] = [];
      const deliveredTo: { id: string; displayName: string | null; avatar: string | null }[] = [];
      const msgTime = message.createdAt.getTime();

      for (const p of participants) {
        const { readReceiptsEnabled, ...userInfo } = p.user;
        const readAt = p.readWatermarkId ? watermarkTime.get(p.readWatermarkId) : undefined;
        // Participants who turned read receipts off never appear as "read".
        if (readReceiptsEnabled !== false && readAt !== undefined && readAt >= msgTime) {
          readBy.push(userInfo);
        } else {
          // No explicit per-user delivery watermark is tracked; the message was
          // fanned out to every participant, so treat the rest as "delivered".
          deliveredTo.push(userInfo);
        }
      }

      return successResponse(res, 'Read receipts fetched successfully', { readBy, deliveredTo });
    } catch (error) {
      return next(error);
    }
  }

  static async edit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { content } = req.body;

      if (typeof content !== 'string' || !content.trim()) {
        return res.status(400).json({ success: false, message: 'content is required' });
      }

      const msg = await prisma.message.findUnique({
        where: { id },
        include: { conversation: { include: { participants: { select: { userId: true } } } } },
      });

      if (!msg) {
        return res.status(404).json({ success: false, message: 'Message not found' });
      }
      if (msg.senderId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'You can only edit your own messages' });
      }
      if (msg.isDeleted) {
        return res.status(400).json({ success: false, message: 'Cannot edit a deleted message' });
      }
      if (msg.type !== 'TEXT') {
        return res.status(400).json({ success: false, message: 'Only text messages can be edited' });
      }

      const updated = await prisma.message.update({
        where: { id },
        data: { content, editedAt: new Date() },
        include: {
          sender: { select: { id: true, displayName: true, avatar: true } },
          replyTo: { select: { id: true, content: true, type: true, senderId: true, isDeleted: true } },
          reactions: { select: { emoji: true, userId: true } },
        },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        msg.conversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('message:edited', updated);
        });
      }

      return successResponse(res, 'Message edited successfully', updated);
    } catch (error) {
      return next(error);
    }
  }

  static async toggleStar(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: messageId } = req.params;

      const existing = await prisma.star.findUnique({
        where: { messageId_userId: { messageId, userId: currentUserId } },
      });

      let starred: boolean;
      if (existing) {
        await prisma.star.delete({ where: { id: existing.id } });
        starred = false;
      } else {
        const msg = await prisma.message.findUnique({ where: { id: messageId }, select: { id: true } });
        if (!msg) {
          return res.status(404).json({ success: false, message: 'Message not found' });
        }
        await prisma.star.create({ data: { messageId, userId: currentUserId } });
        starred = true;
      }

      return successResponse(res, starred ? 'Message starred' : 'Message unstarred', { starred });
    } catch (error) {
      return next(error);
    }
  }

  static async getStarred(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const cursor = req.query.cursor as string;
      const limit = parseInt(req.query.limit as string) || 25;

      const stars = await prisma.star.findMany({
        where: { userId: currentUserId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        include: {
          message: {
            include: {
              sender: { select: { id: true, displayName: true, avatar: true } },
              conversation: { select: { id: true, type: true, name: true, avatar: true } },
            },
          },
        },
      });

      const messages = stars
        .filter((s) => s.message)
        .map((s) => ({ ...s.message, starred: true }));

      return successResponse(res, 'Starred messages fetched successfully', {
        messages,
        nextCursor: stars.length === limit ? stars[stars.length - 1].id : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async listMedia(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { conversationId } = req.params;
      const category = (req.query.category as string) || 'MEDIA'; // MEDIA | DOCS
      const cursor = req.query.cursor as string;
      const limit = parseInt(req.query.limit as string) || 30;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId } },
        select: { clearedAt: true },
      });
      if (!participant) {
        return res.status(403).json({ success: false, message: 'Not a participant' });
      }

      const types = category === 'DOCS' ? ['FILE'] : ['IMAGE', 'VIDEO', 'AUDIO'];

      const whereClause: any = {
        ...messageVisibilityWhere({ conversationId, currentUserId }),
        isDeleted: false,
        type: { in: types },
        mediaUrl: { not: null },
      };
      if (participant.clearedAt) {
        whereClause.createdAt = { gt: participant.clearedAt };
      }
      if (cursor) {
        const cursorMessage = await prisma.message.findUnique({ where: { id: cursor } });
        if (cursorMessage) {
          whereClause.createdAt = { ...whereClause.createdAt, lt: cursorMessage.createdAt };
        }
      }

      const messages = await prisma.message.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        select: {
          id: true,
          type: true,
          mediaUrl: true,
          content: true,
          createdAt: true,
          senderId: true,
        },
      });

      return successResponse(res, 'Media fetched successfully', {
        messages,
        nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Cast/replace/clear a single-choice vote on a POLL message.
  static async pollVote(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: messageId } = req.params;
      const { optionIndex } = req.body as { optionIndex?: number };

      if (typeof optionIndex !== 'number' || optionIndex < 0 || !Number.isInteger(optionIndex)) {
        return res.status(400).json({ success: false, message: 'optionIndex is required' });
      }

      const message = await prisma.message.findUnique({
        where: { id: messageId },
        select: {
          id: true,
          type: true,
          pollOptionCount: true,
          conversationId: true,
          conversation: { select: { participants: { select: { userId: true } } } },
        },
      });
      if (!message || message.type !== 'POLL') {
        return res.status(404).json({ success: false, message: 'Poll not found' });
      }
      if (!message.conversation.participants.some((p) => p.userId === currentUserId)) {
        return res.status(403).json({ success: false, message: 'Not a participant' });
      }
      if (message.pollOptionCount != null && optionIndex >= message.pollOptionCount) {
        return res.status(400).json({ success: false, message: 'Invalid option' });
      }

      // Single-choice: tapping your current selection again clears the vote.
      const existing = await prisma.pollVote.findUnique({
        where: { messageId_userId: { messageId, userId: currentUserId } },
      });

      let resultIndex: number | null;
      if (existing && existing.optionIndex === optionIndex) {
        await prisma.pollVote.delete({ where: { id: existing.id } });
        resultIndex = null;
      } else {
        await prisma.pollVote.upsert({
          where: { messageId_userId: { messageId, userId: currentUserId } },
          create: { messageId, userId: currentUserId, optionIndex },
          update: { optionIndex },
        });
        resultIndex = optionIndex;
      }

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        message.conversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('poll:voted', {
            conversationId: message.conversationId,
            messageId,
            userId: currentUserId,
            optionIndex: resultIndex,
          });
        });
      }

      return successResponse(res, 'Vote recorded', { optionIndex: resultIndex });
    } catch (error) {
      return next(error);
    }
  }

  // Current user's pending scheduled messages for a conversation.
  static async getScheduled(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { conversationId } = req.params;

      const messages = await prisma.message.findMany({
        where: { conversationId, senderId: currentUserId, scheduledAt: { not: null } },
        orderBy: { scheduledAt: 'asc' },
        include: {
          sender: { select: { id: true, displayName: true, avatar: true } },
          replyTo: { select: { id: true, content: true, type: true, senderId: true, isDeleted: true } },
        },
      });

      return successResponse(res, 'Scheduled messages fetched successfully', { messages });
    } catch (error) {
      return next(error);
    }
  }

  // Cancel a pending scheduled message (hard delete — it never reached anyone).
  static async cancelScheduled(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const msg = await prisma.message.findUnique({
        where: { id },
        select: { senderId: true, scheduledAt: true },
      });
      if (!msg || msg.scheduledAt == null) {
        return res.status(404).json({ success: false, message: 'Scheduled message not found' });
      }
      if (msg.senderId !== currentUserId) {
        return res.status(403).json({ success: false, message: 'You can only cancel your own scheduled messages' });
      }

      await prisma.message.delete({ where: { id } });
      return successResponse(res, 'Scheduled message cancelled', { id });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Fire any scheduled messages whose time has come. Converts each into a normal
   * message (stamps createdAt = now, clears scheduledAt) and fans it out. Called on
   * an interval from the server bootstrap. Returns the number fired.
   */
  static async runScheduledSweep(io: any): Promise<number> {
    const now = new Date();
    const due = await prisma.message.findMany({
      where: { scheduledAt: { not: null, lte: now } },
      select: { id: true, conversationId: true },
    });

    for (const d of due) {
      try {
        const conversation = await prisma.conversation.findUnique({
          where: { id: d.conversationId },
          select: {
            disappearingTtlSeconds: true,
            participants: { select: { userId: true } },
          },
        });

        if (!conversation) {
          await prisma.message.delete({ where: { id: d.id } }).catch(() => {});
          continue;
        }

        const fireTime = new Date();
        const expiresAt = conversation.disappearingTtlSeconds
          ? new Date(fireTime.getTime() + conversation.disappearingTtlSeconds * 1000)
          : null;

        const message = await prisma.message.update({
          where: { id: d.id },
          data: { scheduledAt: null, createdAt: fireTime, expiresAt, status: 'SENT' },
          include: {
            sender: { select: { id: true, displayName: true, avatar: true } },
            replyTo: { select: { id: true, content: true, type: true, senderId: true, isDeleted: true } },
          },
        });

        await prisma.conversation
          .update({ where: { id: d.conversationId }, data: { createdAt: fireTime } })
          .catch(() => {});

        conversation.participants.forEach((p) => {
          io.to(`user:${p.userId}`).emit('message:new', message);
        });

        prisma.participant
          .updateMany({
            where: {
              conversationId: d.conversationId,
              userId: { not: message.senderId },
              archivedAt: { not: null },
              OR: [{ mutedUntil: null }, { mutedUntil: { lt: fireTime } }],
            },
            data: { archivedAt: null },
          })
          .then((r) => {
            if (r.count > 0) {
              conversation.participants.forEach((p) => {
                if (p.userId !== message.senderId) {
                  io.to(`user:${p.userId}`).emit('conversation:archive_toggled', {
                    conversationId: d.conversationId,
                    archivedAt: null,
                  });
                }
              });
            }
          })
          .catch(() => {});

        void MessagesController.sendPushToOfflineParticipants({
          participantIds: conversation.participants.map((p) => p.userId),
          senderId: message.senderId,
          conversationId: d.conversationId,
          messageId: message.id,
          content: message.content,
          type: message.type,
        });
      } catch (err) {
        logger.error(`Failed to fire scheduled message ${d.id}:`, err);
      }
    }

    return due.length;
  }

  /**
   * Global cross-conversation message search.
   * Searches messages across ALL conversations the current user participates in.
   * Returns results with conversation metadata for sidebar display.
   */
  static async globalSearch(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const q = ((req.query.q as string) || '').trim();
      const cursor = req.query.cursor as string;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!q) {
        return successResponse(res, 'Global search results', { messages: [], nextCursor: null });
      }

      // Get all conversation IDs the user participates in, along with clearedAt
      const participations = await prisma.participant.findMany({
        where: { userId: currentUserId },
        select: { conversationId: true, clearedAt: true },
      });

      if (participations.length === 0) {
        return successResponse(res, 'Global search results', { messages: [], nextCursor: null });
      }

      const conversationIds = participations.map((p) => p.conversationId);
      const clearedMap = new Map(
        participations.filter((p) => p.clearedAt).map((p) => [p.conversationId, p.clearedAt!])
      );

      const whereClause: any = {
        ...messageVisibilityWhere({ conversationId: { in: conversationIds }, currentUserId, excludeScheduled: true }),
        isDeleted: false,
        content: { contains: q, mode: 'insensitive' },
      };

      if (cursor) {
        const cursorMessage = await prisma.message.findUnique({ where: { id: cursor } });
        if (cursorMessage) {
          whereClause.createdAt = { lt: cursorMessage.createdAt };
        }
      }

      const messages = await prisma.message.findMany({
        where: whereClause,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit,
        include: {
          sender: { select: { id: true, displayName: true, avatar: true } },
          conversation: {
            select: {
              id: true,
              type: true,
              name: true,
              avatar: true,
              participants: {
                select: {
                  userId: true,
                  user: { select: { id: true, displayName: true, avatar: true } },
                },
              },
            },
          },
        },
      });

      // Filter out messages that were sent before the user cleared the chat
      const filtered = messages.filter((m) => {
        const cleared = clearedMap.get(m.conversationId);
        if (cleared && m.createdAt <= cleared) return false;
        return true;
      });

      return successResponse(res, 'Global search results', {
        messages: filtered,
        nextCursor: messages.length === limit ? messages[messages.length - 1].id : null,
      });
    } catch (error) {
      return next(error);
    }
  }

  static async getStats(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { conversationId } = req.params;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId } },
        select: { clearedAt: true },
      });
      if (!participant) {
        return res.status(403).json({ success: false, message: 'Not a participant' });
      }

      const baseWhere: any = {
        ...messageVisibilityWhere({ conversationId, currentUserId }),
        isDeleted: false,
      };
      if (participant.clearedAt) {
        baseWhere.createdAt = { gt: participant.clearedAt };
      }

      const [mediaCount, fileCount, linkCount, voiceCount] = await Promise.all([
        prisma.message.count({
          where: { ...baseWhere, type: { in: ['IMAGE', 'VIDEO'] }, mediaUrl: { not: null } },
        }),
        prisma.message.count({
          where: { ...baseWhere, type: 'FILE', mediaUrl: { not: null } },
        }),
        prisma.message.count({
          where: { ...baseWhere, type: 'TEXT', content: { contains: 'http' } },
        }),
        prisma.message.count({
          where: { ...baseWhere, type: 'AUDIO', mediaUrl: { not: null } },
        }),
      ]);

      let mutualGroups = 0;
      let mutualFriends = 0;

      // For DIRECT conversations, also compute mutual connections
      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { type: true, participants: { select: { userId: true } } },
      });

      if (conversation?.type === 'DIRECT') {
        const otherUserId = conversation.participants.find((p) => p.userId !== currentUserId)?.userId;
        if (otherUserId) {
          // Mutual groups
          const currentUserGroups = await prisma.participant.findMany({
            where: { userId: currentUserId },
            select: { conversationId: true },
          });
          const otherUserGroups = await prisma.participant.findMany({
            where: { userId: otherUserId },
            select: { conversationId: true },
          });
          const currentGroupIds = new Set(
            currentUserGroups
              .filter((g) => g.conversationId !== conversationId)
              .map((g) => g.conversationId)
          );
          mutualGroups = otherUserGroups.filter(
            (g) => g.conversationId !== conversationId && currentGroupIds.has(g.conversationId)
          ).length;

          // Mutual friends: friends of currentUser who are also friends of otherUser
          const myFriends = await prisma.friendship.findMany({
            where: { userId: currentUserId },
            select: { friendId: true },
          });
          const otherFriends = await prisma.friendship.findMany({
            where: { userId: otherUserId },
            select: { friendId: true },
          });
          const myFriendIds = new Set(myFriends.map((f) => f.friendId));
          mutualFriends = otherFriends.filter((f) => myFriendIds.has(f.friendId)).length;
        }
      }

      return successResponse(res, 'Stats fetched', {
        media: mediaCount,
        files: fileCount,
        links: linkCount,
        voice: voiceCount,
        mutualGroups,
        mutualFriends,
      });
    } catch (error) {
      return next(error);
    }
  }
}

