import { Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { prisma } from '../../config/database';
import { successResponse } from '../../utils/response';
import { UsersService } from '../users/service';
import { messageVisibilityWhere } from '../messages/visibility';

export class ConversationsController {
  static async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id!;

      const conversations = await prisma.conversation.findMany({
        where: {
          participants: {
            some: { userId },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                id: true,
                displayName: true,
                avatar: true,
                email: true,
                phone: true,
                showEmail: true,
                  bio: true,
                  createdAt: true,
                  username: true,
                },
              },
            },
          },
          messages: {
            where: {
              deletedFromUsers: {
                none: {
                  userId,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              content: true,
              type: true,
              status: true,
              createdAt: true,
              senderId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      // Map presence and unreadCount. Each conversation's unread count + presence
      // lookups run independently, so process them all in parallel instead of
      // awaiting one conversation at a time (was an N+1 of serial count queries).
      const mapped = await Promise.all(
        conversations.map(async (c) => {
          const myParticipant = c.participants.find((p) => p.userId === userId);
          const clearedAt = myParticipant?.clearedAt;

          // Get latest message, filtering by clearedAt
          let lastMessage: any = c.messages[0] || null;
          if (lastMessage && clearedAt && new Date(lastMessage.createdAt).getTime() <= new Date(clearedAt).getTime()) {
            lastMessage = null;
          }

          // For DIRECT chat, hide if cleared/deleted and no new message
          if (c.type === 'DIRECT' && clearedAt && !lastMessage) {
            return null;
          }

          // Unread count + participant presence resolved concurrently.
          const [unreadCount, participantsWithPresence] = await Promise.all([
            prisma.message.count({
              where: {
                conversationId: c.id,
                senderId: { not: userId },
                status: { not: 'READ' },
                createdAt: clearedAt ? { gt: clearedAt } : undefined,
                deletedFromUsers: {
                  none: {
                    userId,
                  },
                },
              },
            }),
            Promise.all(
              c.participants.map(async (p) => {
                const presence = await UsersService.getPresence(p.user.id);
                return {
                  ...p.user,
                  role: p.role,
                  isOnline: presence.isOnline,
                  lastSeen: presence.lastSeen,
                };
              })
            ),
          ]);

          return {
            id: c.id,
            type: c.type,
            name: c.name,
            avatar: c.avatar,
            participants: participantsWithPresence,
            lastMessage,
            unreadCount,
            updatedAt: lastMessage ? lastMessage.createdAt : c.createdAt,
            pinnedAt: myParticipant?.pinnedAt || null,
            mutedUntil: myParticipant?.mutedUntil || null,
            archivedAt: myParticipant?.archivedAt || null,
            disappearingTtlSeconds: c.disappearingTtlSeconds ?? null,
            description: c.description ?? null,
            isAnnouncementMode: c.isAnnouncementMode,
            requiresApproval: c.requiresApproval,
            isPublic: c.isPublic,
            invitePermission: c.invitePermission,
            messagePermission: c.messagePermission,
            editPermission: c.editPermission,
            notificationPreference: myParticipant?.notificationPreference || 'ALL',
          };
        })
      );

      const mappedConversations = mapped.filter((c): c is NonNullable<typeof c> => c !== null);

      // Sort: pinned conversations first (most recently pinned on top), then by latest activity
      mappedConversations.sort((a, b) => {
        if (a.pinnedAt && b.pinnedAt) {
          return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
        }
        if (a.pinnedAt) return -1;
        if (b.pinnedAt) return 1;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });

      return successResponse(res, 'Conversations fetched successfully', mappedConversations);
    } catch (error) {
      return next(error);
    }
  }


  static async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { type, name, avatar, participantIds, description } = req.body;

      if (type === 'DIRECT') {
        const targetUserId = participantIds[0];
        if (!targetUserId) {
          throw new Error('Participant ID is required for direct conversation');
        }

        // Check if direct conversation already exists
        const existing = await prisma.conversation.findFirst({
          where: {
            type: 'DIRECT',
            AND: [
              { participants: { some: { userId: currentUserId } } },
              { participants: { some: { userId: targetUserId } } },
            ],
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    avatar: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        });

        if (existing) {
          // Map presence for participants
          const participantsWithPresence = await Promise.all(
            existing.participants.map(async (p) => {
              const presence = await UsersService.getPresence(p.user.id);
              return {
                ...p.user,
                role: p.role,
                isOnline: presence.isOnline,
                lastSeen: presence.lastSeen,
              };
            })
          );

          return successResponse(res, 'Conversation already exists', {
            id: existing.id,
            type: existing.type,
            name: existing.name,
            avatar: existing.avatar,
            participants: participantsWithPresence,
            unreadCount: 0,
            updatedAt: existing.createdAt,
          });
        }

        // Create new direct conversation
        const newConv = await prisma.conversation.create({
          data: {
            type: 'DIRECT',
            participants: {
              create: [
                { userId: currentUserId, role: 'MEMBER' },
                { userId: targetUserId, role: 'MEMBER' },
              ],
            },
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    avatar: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        });

        const participantsWithPresence = await Promise.all(
          newConv.participants.map(async (p) => {
            const presence = await UsersService.getPresence(p.user.id);
            return {
              ...p.user,
              role: p.role,
              isOnline: presence.isOnline,
              lastSeen: presence.lastSeen,
            };
          })
        );

        return successResponse(res, 'Direct conversation created successfully', {
          id: newConv.id,
          type: newConv.type,
          name: newConv.name,
          avatar: newConv.avatar,
          participants: participantsWithPresence,
          unreadCount: 0,
          updatedAt: newConv.createdAt,
        }, 201);
      } else {
        // Create GROUP conversation
        if (!name) {
          throw new Error('Group name is required');
        }

        const newGroup = await prisma.conversation.create({
          data: {
            type: 'GROUP',
            name,
            avatar: avatar || null,
            description: description || null,
            participants: {
              create: [
                { userId: currentUserId, role: 'ADMIN' },
                ...participantIds.map((id: string) => ({ userId: id, role: 'MEMBER' })),
              ],
            },
          },
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    displayName: true,
                    avatar: true,
                    email: true,
                    phone: true,
                  },
                },
              },
            },
          },
        });

        // Audit logs for group creation
        await prisma.groupAuditLog.create({
          data: {
            conversationId: newGroup.id,
            actorId: currentUserId,
            action: 'CREATE',
            details: 'Group created',
          },
        });

        for (const uid of participantIds) {
          await prisma.groupAuditLog.create({
            data: {
              conversationId: newGroup.id,
              actorId: currentUserId,
              action: 'MEMBER_ADD',
              targetId: uid,
            },
          });
        }

        const participantsWithPresence = await Promise.all(
          newGroup.participants.map(async (p) => {
            const presence = await UsersService.getPresence(p.user.id);
            return {
              ...p.user,
              role: p.role,
              isOnline: presence.isOnline,
              lastSeen: presence.lastSeen,
            };
          })
        );

        return successResponse(res, 'Group conversation created successfully', {
          id: newGroup.id,
          type: newGroup.type,
          name: newGroup.name,
          avatar: newGroup.avatar,
          participants: participantsWithPresence,
          unreadCount: 0,
          updatedAt: newGroup.createdAt,
        }, 201);
      }
    } catch (error) {
      return next(error);
    }
  }

  static async clear(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      await prisma.participant.update({
        where: {
          userId_conversationId: {
            userId: currentUserId,
            conversationId: id,
          },
        },
        data: {
          clearedAt: new Date(),
        },
      });

      return successResponse(res, 'Conversation cleared successfully');
    } catch (error) {
      return next(error);
    }
  }

  static async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const conv = await prisma.conversation.findUnique({
        where: { id },
        include: {
          participants: true,
        },
      });

      if (!conv) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      if (conv.type === 'DIRECT') {
        // Direct chat: set clearedAt so it hides for current user, keep row to maintain convo link
        await prisma.participant.update({
          where: {
            userId_conversationId: {
              userId: currentUserId,
              conversationId: id,
            },
          },
          data: {
            clearedAt: new Date(),
          },
        });
      } else {
        // Group chat: delete participant row (leave group)
        const deletedParticipant = await prisma.participant.delete({
          where: {
            userId_conversationId: {
              userId: currentUserId,
              conversationId: id,
            },
          },
        });

        // Audit log
        await prisma.groupAuditLog.create({
          data: {
            conversationId: id,
            actorId: currentUserId,
            action: 'LEAVE',
          },
        });

        if (deletedParticipant.role === 'ADMIN') {
          await ConversationsController.handleAdminHandover(id, currentUserId, req.app.get('io'));
        }
      }

      // Check if conversation has no participants left, and delete it to clean up
      const participantsCount = await prisma.participant.count({
        where: { conversationId: id },
      });

      if (participantsCount === 0) {
        await prisma.conversation.delete({
          where: { id },
        });
      }

      return successResponse(res, 'Conversation deleted successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Update group name/avatar (admin only)
  static async updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { name, avatar, description, isAnnouncementMode, requiresApproval, isPublic, invitePermission, messagePermission, editPermission } = req.body;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant || participant.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can update group settings' });
      }

      const currentGroup = await prisma.conversation.findUnique({
        where: { id },
        select: { name: true, avatar: true, description: true, isAnnouncementMode: true, requiresApproval: true, isPublic: true, invitePermission: true, messagePermission: true, editPermission: true },
      });

      if (!currentGroup) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }

       const data: { 
         name?: string; 
         avatar?: string | null; 
         description?: string | null; 
         isAnnouncementMode?: boolean; 
         requiresApproval?: boolean;
         isPublic?: boolean;
         invitePermission?: string;
         messagePermission?: string;
         editPermission?: string;
       } = {};
       const auditLogDetails: string[] = [];

       if (typeof name === 'string') {
         data.name = name;
         if (currentGroup.name !== name) auditLogDetails.push(`Changed name to "${name}"`);
       }
       if (typeof avatar === 'string') {
         data.avatar = avatar === '' ? null : avatar;
         if (currentGroup.avatar !== data.avatar) auditLogDetails.push(data.avatar ? 'Updated avatar' : 'Removed avatar');
       }
       if (typeof description === 'string') {
         data.description = description === '' ? null : description;
         if (currentGroup.description !== data.description) auditLogDetails.push(data.description ? `Changed description to "${description}"` : 'Removed description');
       }
       if (typeof isAnnouncementMode === 'boolean') {
         data.isAnnouncementMode = isAnnouncementMode;
         if (currentGroup.isAnnouncementMode !== isAnnouncementMode) auditLogDetails.push(isAnnouncementMode ? 'Enabled Announcement Mode' : 'Disabled Announcement Mode');
       }
       if (typeof requiresApproval === 'boolean') {
         data.requiresApproval = requiresApproval;
         if (currentGroup.requiresApproval !== requiresApproval) auditLogDetails.push(requiresApproval ? 'Enabled admin approval requirements' : 'Disabled admin approval requirements');
       }
       if (typeof isPublic === 'boolean') {
         data.isPublic = isPublic;
         if (currentGroup.isPublic !== isPublic) auditLogDetails.push(isPublic ? 'Made group public' : 'Made group private');
       }
       if (typeof invitePermission === 'string') {
         data.invitePermission = invitePermission;
         if (currentGroup.invitePermission !== invitePermission) auditLogDetails.push(`Changed invite permission to ${invitePermission}`);
       }
       if (typeof messagePermission === 'string') {
         data.messagePermission = messagePermission;
         if (currentGroup.messagePermission !== messagePermission) auditLogDetails.push(`Changed message permission to ${messagePermission}`);
       }
       if (typeof editPermission === 'string') {
         data.editPermission = editPermission;
         if (currentGroup.editPermission !== editPermission) auditLogDetails.push(`Changed edit permission to ${editPermission}`);
       }

      await prisma.conversation.update({ where: { id }, data });

      if (auditLogDetails.length > 0) {
        await prisma.groupAuditLog.create({
          data: {
            conversationId: id,
            actorId: currentUserId,
            action: 'SETTINGS_EDIT',
            details: auditLogDetails.join(', '),
          },
        });
      }

      const conv = await ConversationsController.buildConversationPayload(id, currentUserId);

      const globalIo = req.app.get('io') as any;
      if (globalIo && conv) {
        conv.participants.forEach((p: any) => {
          globalIo.to(`user:${p.id}`).emit('conversation:updated', conv);
        });
      }

      return successResponse(res, 'Group updated successfully', conv);
    } catch (error) {
      return next(error);
    }
  }

  // Add participants (admin only)
  static async addParticipants(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { userIds } = req.body as { userIds: string[] };

      if (!Array.isArray(userIds) || userIds.length === 0) {
        return res.status(400).json({ success: false, message: 'userIds must be a non-empty array' });
      }

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant || participant.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can add participants' });
      }

      await prisma.participant.createMany({
        data: userIds.map((uid) => ({ userId: uid, conversationId: id, role: 'MEMBER' as const })),
        skipDuplicates: true,
      });

      for (const uid of userIds) {
        await prisma.groupAuditLog.create({
          data: {
            conversationId: id,
            actorId: currentUserId,
            action: 'MEMBER_ADD',
            targetId: uid,
          },
        });
      }

      const conv = await ConversationsController.buildConversationPayload(id, currentUserId);

      const globalIo = req.app.get('io') as any;
      if (globalIo && conv) {
        conv.participants.forEach((p: any) => {
          globalIo.to(`user:${p.id}`).emit('conversation:participants_added', conv);
        });
      }

      return successResponse(res, 'Participants added successfully', conv);
    } catch (error) {
      return next(error);
    }
  }

  // Remove participant (admin removes others, or self-leave)
  static async removeParticipant(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id, userId } = req.params;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (userId !== currentUserId && (!participant || participant.role !== 'ADMIN')) {
        return res.status(403).json({ success: false, message: 'Only admins can remove other participants' });
      }

      const deletedParticipant = await prisma.participant.delete({
        where: { userId_conversationId: { userId, conversationId: id } },
      });

      await prisma.groupAuditLog.create({
        data: {
          conversationId: id,
          actorId: currentUserId,
          action: userId === currentUserId ? 'LEAVE' : 'MEMBER_REMOVE',
          targetId: userId === currentUserId ? undefined : userId,
        },
      });

      if (deletedParticipant.role === 'ADMIN') {
        await ConversationsController.handleAdminHandover(id, userId, req.app.get('io'));
      }

      const count = await prisma.participant.count({ where: { conversationId: id } });
      if (count === 0) {
        await prisma.conversation.delete({ where: { id } });
      }

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        globalIo.to(`user:${userId}`).emit('conversation:removed', { conversationId: id });
        if (count > 0) {
          const conv = await ConversationsController.buildConversationPayload(id, currentUserId);
          if (conv) {
            conv.participants.forEach((p: any) => {
              globalIo.to(`user:${p.id}`).emit('conversation:participant_removed', {
                conversationId: id,
                removedUserId: userId,
                conversation: conv,
              });
            });
          }
        }
      }

      return successResponse(res, 'Participant removed successfully');
    } catch (error) {
      return next(error);
    }
  }

  // Update a participant's role (admin only)
  static async updateParticipantRole(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id, userId } = req.params;
      const { role } = req.body as { role: 'ADMIN' | 'MEMBER' };

      if (role !== 'ADMIN' && role !== 'MEMBER') {
        return res.status(400).json({ success: false, message: 'Invalid role' });
      }

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant || participant.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can change roles' });
      }

      await prisma.participant.update({
        where: { userId_conversationId: { userId, conversationId: id } },
        data: { role },
      });

      await prisma.groupAuditLog.create({
        data: {
          conversationId: id,
          actorId: currentUserId,
          action: 'ROLE_CHANGE',
          targetId: userId,
          details: role === 'ADMIN' ? 'Promoted to ADMIN' : 'Dismissed as ADMIN',
        },
      });

      const conv = await ConversationsController.buildConversationPayload(id, currentUserId);

      const globalIo = req.app.get('io') as any;
      if (globalIo && conv) {
        conv.participants.forEach((p: any) => {
          globalIo.to(`user:${p.id}`).emit('conversation:role_changed', {
            conversationId: id,
            userId,
            role,
            conversation: conv,
          });
        });
      }

      return successResponse(res, 'Role updated successfully', conv);
    } catch (error) {
      return next(error);
    }
  }

  // Toggle pin for the current user's participant record
  static async togglePin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        select: { pinnedAt: true },
      });

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const updated = await prisma.participant.update({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        data: { pinnedAt: participant.pinnedAt ? null : new Date() },
        select: { pinnedAt: true },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        globalIo.to(`user:${currentUserId}`).emit('conversation:pin_toggled', {
          conversationId: id,
          pinnedAt: updated.pinnedAt,
        });
      }

      return successResponse(res, participant.pinnedAt ? 'Conversation unpinned' : 'Conversation pinned', {
        pinnedAt: updated.pinnedAt,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Set disappearing-message TTL (admin only in groups; either party in DMs)
  static async setDisappearing(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { ttlSeconds } = req.body as { ttlSeconds: number | null };

      if (ttlSeconds !== null && (typeof ttlSeconds !== 'number' || ttlSeconds <= 0)) {
        return res.status(400).json({ success: false, message: 'ttlSeconds must be a positive number or null' });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: { participants: { select: { userId: true, role: true } } },
      });
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const me = conversation.participants.find((p) => p.userId === currentUserId);
      if (!me) {
        return res.status(403).json({ success: false, message: 'Not a participant' });
      }
      if (conversation.type === 'GROUP' && me.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can change this setting' });
      }

      await prisma.conversation.update({
        where: { id },
        data: { disappearingTtlSeconds: ttlSeconds },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        conversation.participants.forEach((p) => {
          globalIo.to(`user:${p.userId}`).emit('conversation:disappearing_changed', {
            conversationId: id,
            ttlSeconds,
          });
        });
      }

      return successResponse(res, 'Disappearing messages updated', { ttlSeconds });
    } catch (error) {
      return next(error);
    }
  }

  // Mute/unmute a conversation for the current user
  static async mute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { duration } = req.body as { duration: '8h' | '1w' | 'always' | 'off' };

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        select: { id: true },
      });
      if (!participant) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      let mutedUntil: Date | null = null;
      const now = Date.now();
      if (duration === '8h') mutedUntil = new Date(now + 8 * 60 * 60 * 1000);
      else if (duration === '1w') mutedUntil = new Date(now + 7 * 24 * 60 * 60 * 1000);
      else if (duration === 'always') mutedUntil = new Date('9999-12-31T23:59:59Z');
      else mutedUntil = null; // 'off'

      await prisma.participant.update({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        data: { mutedUntil },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        globalIo.to(`user:${currentUserId}`).emit('conversation:mute_toggled', {
          conversationId: id,
          mutedUntil,
        });
      }

      return successResponse(res, mutedUntil ? 'Conversation muted' : 'Conversation unmuted', { mutedUntil });
    } catch (error) {
      return next(error);
    }
  }

  // Archive/unarchive a conversation for the current user
  static async archive(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { archived } = req.body as { archived: boolean };

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        select: { id: true },
      });
      if (!participant) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const archivedAt = archived ? new Date() : null;

      await prisma.participant.update({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        data: { archivedAt },
      });

      const globalIo = req.app.get('io') as any;
      if (globalIo) {
        globalIo.to(`user:${currentUserId}`).emit('conversation:archive_toggled', {
          conversationId: id,
          archivedAt,
        });
      }

      return successResponse(res, archived ? 'Conversation archived' : 'Conversation unarchived', { archivedAt });
    } catch (error) {
      return next(error);
    }
  }

  // Create an invite link for a group (admin only)
  static async createInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { expiresInHours, maxUses } = req.body as { expiresInHours?: number; maxUses?: number };

      const conversation = await prisma.conversation.findUnique({
        where: { id },
        include: { participants: { where: { userId: currentUserId }, select: { role: true } } },
      });
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }
      if (conversation.type !== 'GROUP') {
        return res.status(400).json({ success: false, message: 'Only group conversations support invite links' });
      }
      const me = conversation.participants[0];
      if (!me || me.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can create invite links' });
      }

      const expiresAt =
        typeof expiresInHours === 'number' && expiresInHours > 0
          ? new Date(Date.now() + expiresInHours * 3600 * 1000)
          : null;
      const cappedUses =
        typeof maxUses === 'number' && maxUses > 0 ? Math.min(Math.floor(maxUses), 1000) : null;

      const invite = await prisma.groupInvite.create({
        data: {
          token: randomBytes(16).toString('hex'),
          conversationId: id,
          createdById: currentUserId,
          expiresAt,
          maxUses: cappedUses,
        },
        select: { token: true, expiresAt: true, maxUses: true, useCount: true, revoked: true, createdAt: true },
      });

      return successResponse(res, 'Invite link created', invite, 201);
    } catch (error) {
      return next(error);
    }
  }

  // List active invites for a group (admin only)
  static async listInvites(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const me = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        select: { role: true },
      });
      if (!me || me.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can view invite links' });
      }

      const invites = await prisma.groupInvite.findMany({
        where: { conversationId: id, revoked: false },
        orderBy: { createdAt: 'desc' },
        select: { token: true, expiresAt: true, maxUses: true, useCount: true, revoked: true, createdAt: true },
      });

      return successResponse(res, 'Invites fetched', invites);
    } catch (error) {
      return next(error);
    }
  }

  // Revoke an invite (admin only)
  static async revokeInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { token } = req.params;

      const invite = await prisma.groupInvite.findUnique({
        where: { token },
        select: { conversationId: true },
      });
      if (!invite) {
        return res.status(404).json({ success: false, message: 'Invite not found' });
      }

      const me = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: invite.conversationId } },
        select: { role: true },
      });
      if (!me || me.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can revoke invite links' });
      }

      await prisma.groupInvite.update({ where: { token }, data: { revoked: true } });
      return successResponse(res, 'Invite revoked');
    } catch (error) {
      return next(error);
    }
  }

  /** Validate an invite token; returns the invite + conversation or an error reason. */
  private static async resolveInvite(token: string) {
    const invite = await prisma.groupInvite.findUnique({
      where: { token },
      include: {
        conversation: {
          select: { id: true, type: true, name: true, avatar: true, _count: { select: { participants: true } } },
        },
      },
    });
    if (!invite || invite.revoked) return { error: 'This invite link is no longer valid.' as const };
    if (invite.conversation.type !== 'GROUP') return { error: 'This invite link is invalid.' as const };
    if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) return { error: 'This invite link has expired.' as const };
    if (invite.maxUses !== null && invite.useCount >= invite.maxUses) {
      return { error: 'This invite link has reached its usage limit.' as const };
    }
    return { invite };
  }

  // Preview an invite (any authenticated user) — for the join screen
  static async previewInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;
      const result = await ConversationsController.resolveInvite(token);
      if ('error' in result) {
        return res.status(410).json({ success: false, message: result.error });
      }
      const { conversation } = result.invite;
      return successResponse(res, 'Invite preview', {
        conversationId: conversation.id,
        name: conversation.name,
        avatar: conversation.avatar,
        memberCount: conversation._count.participants,
      });
    } catch (error) {
      return next(error);
    }
  }

  // Join a group via an invite token
  static async joinViaInvite(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { token } = req.params;

      const result = await ConversationsController.resolveInvite(token);
      if ('error' in result) {
        return res.status(410).json({ success: false, message: result.error });
      }
      const conversationId = result.invite.conversationId;

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { requiresApproval: true },
      });

      const existing = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId } },
        select: { id: true },
      });

      if (existing) {
        const conv = await ConversationsController.buildConversationPayload(conversationId, currentUserId);
        return successResponse(res, 'Already a member', conv);
      }

      if (conversation?.requiresApproval) {
        const request = await prisma.joinRequest.upsert({
          where: {
            conversationId_userId: { conversationId, userId: currentUserId },
          },
          update: { status: 'PENDING' },
          create: { conversationId, userId: currentUserId, status: 'PENDING' },
          include: {
            user: { select: { id: true, displayName: true, avatar: true } },
          },
        });

        // Notify admins
        const admins = await prisma.participant.findMany({
          where: { conversationId, role: 'ADMIN' },
          select: { userId: true },
        });

        const globalIo = req.app.get('io') as any;
        if (globalIo) {
          admins.forEach((adm) => {
            globalIo.to(`user:${adm.userId}`).emit('group:join_request_created', {
              conversationId,
              request,
            });
          });
        }

        return successResponse(res, 'Join request submitted. Waiting for admin approval.', {
          requiresApproval: true,
          request,
        });
      }

      await prisma.participant.create({
        data: { userId: currentUserId, conversationId, role: 'MEMBER' },
      });
      await prisma.groupInvite.update({
        where: { token },
        data: { useCount: { increment: 1 } },
      });

      // Audit log
      await prisma.groupAuditLog.create({
        data: {
          conversationId,
          actorId: currentUserId,
          action: 'JOIN',
          details: 'Joined via invite link',
        },
      });

      // Notify existing participants of the new member
      const globalIo = req.app.get('io') as any;
      const conv = await ConversationsController.buildConversationPayload(conversationId, currentUserId);
      if (globalIo && conv) {
        conv.participants.forEach((p: any) => {
          globalIo.to(`user:${p.id}`).emit('conversation:participants_added', conv);
        });
      }

      return successResponse(res, 'Joined group successfully', conv);
    } catch (error) {
      return next(error);
    }
  }

  /** Build the same conversation shape used by list() for a single conversation. */
  private static async buildConversationPayload(conversationId: string, viewerId: string) {
    const c = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                email: true,
                phone: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            content: true,
            type: true,
            status: true,
            createdAt: true,
            senderId: true,
          },
        },
      },
    });

    if (!c) return null;

    const myParticipant = c.participants.find((p) => p.userId === viewerId);

    const participantsWithPresence = await Promise.all(
      c.participants.map(async (p) => {
        const presence = await UsersService.getPresence(p.user.id);
        const showEmail = (p.user as any).showEmail;
        const user = {
          ...p.user,
          role: p.role,
          isOnline: presence.isOnline,
          lastSeen: presence.lastSeen,
        };
        // Only expose email to others when showEmail is true
        if (user.id !== viewerId && !showEmail) {
          delete (user as any).email;
        }
        delete (user as any).showEmail;
        return user;
      })
    );

    return {
      id: c.id,
      type: c.type,
      name: c.name,
      avatar: c.avatar,
      participants: participantsWithPresence,
      lastMessage: c.messages[0] || null,
      unreadCount: 0,
      updatedAt: c.messages[0]?.createdAt || c.createdAt,
      pinnedAt: myParticipant?.pinnedAt || null,
      mutedUntil: myParticipant?.mutedUntil || null,
      archivedAt: myParticipant?.archivedAt || null,
      disappearingTtlSeconds: c.disappearingTtlSeconds ?? null,
      description: c.description ?? null,
      isAnnouncementMode: c.isAnnouncementMode,
      requiresApproval: c.requiresApproval,
      isPublic: c.isPublic,
      invitePermission: c.invitePermission,
      messagePermission: c.messagePermission,
      editPermission: c.editPermission,
      notificationPreference: myParticipant?.notificationPreference || 'ALL',
    };
  }

  // Find oldest member and promote them to ADMIN if no admins left
  private static async handleAdminHandover(conversationId: string, _leftUserId: string, globalIo: any) {
    try {
      const remainingAdmins = await prisma.participant.count({
        where: {
          conversationId,
          role: 'ADMIN',
        },
      });

      if (remainingAdmins === 0) {
        const oldestMember = await prisma.participant.findFirst({
          where: { conversationId },
          orderBy: { joinedAt: 'asc' },
        });

        if (oldestMember) {
          await prisma.participant.update({
            where: { id: oldestMember.id },
            data: { role: 'ADMIN' },
          });

          await prisma.groupAuditLog.create({
            data: {
              conversationId,
              actorId: oldestMember.userId,
              action: 'ROLE_CHANGE',
              targetId: oldestMember.userId,
              details: 'Automatically promoted to ADMIN (Handover)',
            },
          });

          const conv = await ConversationsController.buildConversationPayload(conversationId, oldestMember.userId);
          if (globalIo && conv) {
            conv.participants.forEach((p: any) => {
              globalIo.to(`user:${p.id}`).emit('conversation:role_changed', {
                conversationId,
                userId: oldestMember.userId,
                role: 'ADMIN',
                conversation: conv,
              });
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed admin handover:', err);
    }
  }

  // List pending join requests (admin only)
  static async listJoinRequests(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant || participant.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can view join requests' });
      }

      const requests = await prisma.joinRequest.findMany({
        where: { conversationId: id, status: 'PENDING' },
        include: {
          user: {
            select: { id: true, displayName: true, avatar: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return successResponse(res, 'Join requests fetched', requests);
    } catch (error) {
      return next(error);
    }
  }

  // Resolve (approve/reject) a join request (admin only)
  static async resolveJoinRequest(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id, requestId } = req.params;
      const { action } = req.body as { action: 'APPROVE' | 'REJECT' };

      if (action !== 'APPROVE' && action !== 'REJECT') {
        return res.status(400).json({ success: false, message: 'Invalid action. Must be APPROVE or REJECT' });
      }

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant || participant.role !== 'ADMIN') {
        return res.status(403).json({ success: false, message: 'Only admins can resolve join requests' });
      }

      const request = await prisma.joinRequest.findFirst({
        where: { id: requestId, conversationId: id, status: 'PENDING' },
      });

      if (!request) {
        return res.status(404).json({ success: false, message: 'Join request not found' });
      }

      if (action === 'APPROVE') {
        await prisma.$transaction([
          prisma.joinRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED' },
          }),
          prisma.participant.create({
            data: { userId: request.userId, conversationId: id, role: 'MEMBER' },
          }),
          prisma.groupAuditLog.create({
            data: {
              conversationId: id,
              actorId: currentUserId,
              action: 'REQUEST_APPROVE',
              targetId: request.userId,
            },
          }),
        ]);

        const globalIo = req.app.get('io') as any;
        const conv = await ConversationsController.buildConversationPayload(id, currentUserId);
        if (globalIo && conv) {
          globalIo.to(`user:${request.userId}`).emit('group:join_request_resolved', {
            conversationId: id,
            status: 'APPROVED',
            conversation: conv,
          });
          conv.participants.forEach((p: any) => {
            globalIo.to(`user:${p.id}`).emit('conversation:participants_added', conv);
          });
        }
      } else {
        await prisma.$transaction([
          prisma.joinRequest.update({
            where: { id: requestId },
            data: { status: 'REJECTED' },
          }),
          prisma.groupAuditLog.create({
            data: {
              conversationId: id,
              actorId: currentUserId,
              action: 'REQUEST_REJECT',
              targetId: request.userId,
            },
          }),
        ]);

        const globalIo = req.app.get('io') as any;
        if (globalIo) {
          globalIo.to(`user:${request.userId}`).emit('group:join_request_resolved', {
            conversationId: id,
            status: 'REJECTED',
          });
        }
      }

      return successResponse(res, `Join request ${action === 'APPROVE' ? 'approved' : 'rejected'}`);
    } catch (error) {
      return next(error);
    }
  }

  // List group audit logs (available to all participants)
  static async listAuditLogs(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant) {
        return res.status(403).json({ success: false, message: 'Not a participant of this group' });
      }

      const logs = await prisma.groupAuditLog.findMany({
        where: { conversationId: id },
        include: {
          actor: { select: { id: true, displayName: true } },
          target: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      return successResponse(res, 'Audit logs fetched', logs);
    } catch (error) {
      return next(error);
    }
  }

  // Update participant notification preference
  static async updateNotificationPreference(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const { preference } = req.body as { preference: 'ALL' | 'MENTIONS_ONLY' | 'MUTE' };

      if (preference !== 'ALL' && preference !== 'MENTIONS_ONLY' && preference !== 'MUTE') {
        return res.status(400).json({ success: false, message: 'Invalid preference. Must be ALL, MENTIONS_ONLY, or MUTE' });
      }

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      await prisma.participant.update({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
        data: { notificationPreference: preference },
      });

      return successResponse(res, 'Notification preference updated successfully', { preference });
    } catch (error) {
      return next(error);
    }
  }

  // List participants with pagination
  static async listParticipants(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id } = req.params;
      const offset = parseInt(req.query.offset as string) || 0;
      const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId: id } },
      });

      if (!participant) {
        return res.status(404).json({ success: false, message: 'Conversation not found' });
      }

      const [participants, total] = await Promise.all([
        prisma.participant.findMany({
          where: { conversationId: id },
          skip: offset,
          take: limit,
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatar: true,
                email: true,
                phone: true,
                bio: true,
                username: true,
                createdAt: true,
              },
            },
          },
          orderBy: [{ role: 'asc' }, { joinedAt: 'asc' }],
        }),
        prisma.participant.count({ where: { conversationId: id } }),
      ]);

      const participantsWithPresence = await Promise.all(
        participants.map(async (p) => {
          const pres = await UsersService.getPresence(p.user.id);
          return {
            ...p.user,
            role: p.role,
            isOnline: pres.isOnline,
            lastSeen: pres.lastSeen,
            joinedAt: p.joinedAt,
          };
        })
      );

      return successResponse(res, 'Participants fetched successfully', {
        participants: participantsWithPresence,
        total,
        offset,
        limit,
        hasMore: offset + limit < total,
      });
    } catch (error) {
      return next(error);
    }
  }

  /**
   * Single optimized endpoint for contact info sidebar.
   * Returns stats, mutual connections, and friend status in one handler
   * so the client needs only one API call instead of four.
   */
  static async getContactDetails(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const currentUserId = req.user?.id!;
      const { id: conversationId } = req.params;

      const participant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId: currentUserId, conversationId } },
        select: { clearedAt: true },
      });
      if (!participant) {
        return res.status(403).json({ success: false, message: 'Not a participant' });
      }

      const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { type: true, participants: { select: { userId: true } } },
      });
      if (!conversation || conversation.type !== 'DIRECT') {
        return res.status(400).json({ success: false, message: 'Only supported for direct conversations' });
      }

      const otherUserId = conversation.participants.find((p) => p.userId !== currentUserId)?.userId;
      if (!otherUserId) {
        return res.status(400).json({ success: false, message: 'No other participant' });
      }

      // ── Stats (shared content counts) ──
      const baseWhere: any = {
        ...messageVisibilityWhere({ conversationId, currentUserId }),
        isDeleted: false,
      };
      if (participant.clearedAt) {
        baseWhere.createdAt = { gt: participant.clearedAt };
      }

      const [mediaCount, fileCount, linkCount, voiceCount] = await Promise.all([
        prisma.message.count({ where: { ...baseWhere, type: { in: ['IMAGE', 'VIDEO'] }, mediaUrl: { not: null } } }),
        prisma.message.count({ where: { ...baseWhere, type: 'FILE', mediaUrl: { not: null } } }),
        prisma.message.count({ where: { ...baseWhere, type: 'TEXT', content: { contains: 'http' } } }),
        prisma.message.count({ where: { ...baseWhere, type: 'AUDIO', mediaUrl: { not: null } } }),
      ]);

      // ── Mutual connections ──
      const [currentUserGroups, otherUserGroups, myFriends, otherFriends, friendRequest] = await Promise.all([
        prisma.participant.findMany({ where: { userId: currentUserId }, select: { conversationId: true } }),
        prisma.participant.findMany({ where: { userId: otherUserId }, select: { conversationId: true } }),
        prisma.friendship.findMany({ where: { userId: currentUserId }, select: { friendId: true } }),
        prisma.friendship.findMany({ where: { userId: otherUserId }, select: { friendId: true } }),
        prisma.friendRequest.findFirst({
          where: {
            OR: [
              { senderId: currentUserId, receiverId: otherUserId },
              { senderId: otherUserId, receiverId: currentUserId },
            ],
            status: 'PENDING',
          },
          select: { senderId: true, receiverId: true },
        }),
      ]);

      const currentGroupIds = new Set(currentUserGroups.filter((g) => g.conversationId !== conversationId).map((g) => g.conversationId));
      const mutualGroupIds = otherUserGroups
        .filter((g) => g.conversationId !== conversationId && currentGroupIds.has(g.conversationId))
        .map((g) => g.conversationId);
      const mutualGroups = mutualGroupIds.length;

      const myFriendIds = new Set(myFriends.map((f) => f.friendId));
      const mutualFriends = otherFriends.filter((f) => myFriendIds.has(f.friendId)).length;

      // ── Friend status ──
      const isFriend = myFriendIds.has(otherUserId);
      let friendStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none' = 'none';
      if (isFriend) {
        friendStatus = 'friend';
      } else if (friendRequest) {
        friendStatus = friendRequest.senderId === currentUserId ? 'pending_sent' : 'pending_received';
      }

      return successResponse(res, 'Contact details fetched', {
        stats: { media: mediaCount, files: fileCount, links: linkCount, voice: voiceCount },
        mutualGroups,
        mutualGroupIds,
        mutualFriends,
        friendStatus,
      });
    } catch (error) {
      return next(error);
    }
  }

  // ══════════════════════════════════════════════════
  // PUBLIC GROUPS BROWSE
  // ══════════════════════════════════════════════════

  static async listPublicGroups(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { search, page = '1', limit = '20' } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      const take = Number(limit);

      const where: any = { type: 'GROUP', isPublic: true };
      if (search && typeof search === 'string') {
        where.name = { contains: search, mode: 'insensitive' };
      }

      const [groups, total] = await Promise.all([
        prisma.conversation.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip,
          take,
          include: {
            participants: { select: { userId: true } },
          },
        }),
        prisma.conversation.count({ where }),
      ]);

      const groupsWithStatus = groups.map((g) => ({
        id: g.id,
        name: g.name,
        avatar: g.avatar,
        description: g.description,
        memberCount: g.participants.length,
        isPublic: g.isPublic,
        requiresApproval: g.requiresApproval,
        isAnnouncementMode: g.isAnnouncementMode,
        isMember: g.participants.some((p) => p.userId === userId),
      }));

      return successResponse(res, 'Public groups', {
        groups: groupsWithStatus,
        pagination: { page: Number(page), limit: take, total, pages: Math.ceil(total / take) },
      });
    } catch (error) {
      return next(error);
    }
  }

  static async joinPublicGroup(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;
      const { id: conversationId } = req.params;

      const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
      if (!conversation) {
        return res.status(404).json({ success: false, message: 'Group not found' });
      }
      if (conversation.type !== 'GROUP') {
        return res.status(400).json({ success: false, message: 'Not a group' });
      }
      if (!conversation.isPublic) {
        return res.status(403).json({ success: false, message: 'This group is private' });
      }

      const existingParticipant = await prisma.participant.findUnique({
        where: { userId_conversationId: { userId, conversationId } },
      });
      if (existingParticipant) {
        return res.status(409).json({ success: false, message: 'Already a member' });
      }

      if (conversation.requiresApproval) {
        const existingRequest = await prisma.joinRequest.findFirst({
          where: { conversationId, userId, status: 'PENDING' },
        });
        if (existingRequest) {
          return res.status(409).json({ success: false, message: 'Join request already pending' });
        }
        await prisma.joinRequest.create({
          data: { conversationId, userId, status: 'PENDING' },
        });
        return successResponse(res, 'Join request sent', { requiresApproval: true });
      }

      await prisma.participant.create({
        data: { conversationId, userId, role: 'MEMBER' },
      });

      return successResponse(res, 'Joined group', { requiresApproval: false, conversationId });
    } catch (error) {
      return next(error);
    }
  }
}

