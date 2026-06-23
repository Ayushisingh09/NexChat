import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { conversationsApi } from '../api/conversations.api';
import { useSocketStore } from '../store/socket.store';
import { useConversationStore } from '../store/conversation.store';
import { useAuthStore } from '../store/auth.store';
import { sortConversations } from '../utils/conversation.utils';
import type { Conversation, Message } from '../types/chat.types';

export const useConversations = () => {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);

  const { data: conversations = [], isLoading, isFetching, error, refetch } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: conversationsApi.list,
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // Listen on socket events to update active previews & unread counts instantly in the list
  useEffect(() => {
    if (!socket) return;

    const handleNewMessageGlobal = (newMsg: Message) => {
      const currentUserId = useAuthStore.getState().user?.id;
      const activeConvId = useConversationStore.getState().activeConversation?.id;

      // A message counts as "seen" only when its conversation is open AND the
      // tab is visible — then we don't add to the unread badge. (An open chat in
      // a hidden/backgrounded tab still badges, and clears when you return.)
      const isSeen =
        newMsg.conversationId === activeConvId && document.visibilityState === 'visible';
      const shouldIncrement = newMsg.senderId !== currentUserId && !isSeen;

      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return [];

        const hasConv = oldConvs.some((c) => c.id === newMsg.conversationId);
        if (!hasConv) {
          // Invalidate cache to pull the new conversation details from the database
          queryClient.invalidateQueries({ queryKey: ['conversations'] });
          return oldConvs;
        }

        return oldConvs.map((c) => {
          if (c.id === newMsg.conversationId) {
            return {
              ...c,
              lastMessage: newMsg,
              // If we should increment, add 1, otherwise add 0
              unreadCount: c.unreadCount + (shouldIncrement ? 1 : 0),
              updatedAt: newMsg.createdAt,
            };
          }
          return c;
        });
      });
    };

    const handleUserPresence = (presenceData: { userId: string; isOnline: boolean; lastSeen?: string }) => {
      // 1. Update conversations query cache — skip if user is in no conversations
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return [];
        let anyChanged = false;
        const updated = oldConvs.map((c) => {
          const p = c.participants.find((x) => x.id === presenceData.userId);
          if (!p) return c;
          anyChanged = true;
          return {
            ...c,
            participants: c.participants.map((x) =>
              x.id === presenceData.userId
                ? { ...x, isOnline: presenceData.isOnline, lastSeen: presenceData.lastSeen || x.lastSeen }
                : x
            ),
          };
        });
        return anyChanged ? updated : oldConvs;
      });

      // 2. Update active conversation in Zustand store
      const activeConv = useConversationStore.getState().activeConversation;
      if (activeConv) {
        const hasUser = activeConv.participants.some((p) => p.id === presenceData.userId);
        if (hasUser) {
          const updatedParticipants = activeConv.participants.map((p) => {
            if (p.id === presenceData.userId) {
              return {
                ...p,
                isOnline: presenceData.isOnline,
                lastSeen: presenceData.lastSeen || p.lastSeen,
              };
            }
            return p;
          });
          useConversationStore.getState().setActiveConversation({
            ...activeConv,
            participants: updatedParticipants,
          });
        }
      }
    };

    const handleMessageDeletedEveryoneGlobal = (deletedMsg: Message) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return [];
        return oldConvs.map((c) => {
          if (c.id === deletedMsg.conversationId && c.lastMessage?.id === deletedMsg.id) {
            return {
              ...c,
              lastMessage: c.lastMessage
                ? {
                    ...c.lastMessage,
                    isDeleted: true,
                    content: 'This message was deleted',
                    mediaUrl: undefined,
                  }
                : undefined,
            };
          }
          return c;
        });
      });
    };

    const handleMessagesReadGlobal = (data: { conversationId: string; readByUserId: string }) => {
      const currentUserId = useAuthStore.getState().user?.id;
      if (data.readByUserId === currentUserId) {
        queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
          if (!oldConvs) return [];
          return oldConvs.map((c) =>
            c.id === data.conversationId ? { ...c, unreadCount: 0 } : c
          );
        });
      }
    };

    socket.on('message:new', handleNewMessageGlobal);
    socket.on('messages:read_watermark', handleMessagesReadGlobal);
    socket.on('user:presence', handleUserPresence);
    socket.on('message:deleted_everyone', handleMessageDeletedEveryoneGlobal);

    const handlePinToggled = (data: { conversationId: string; pinnedAt: string | null }) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        const updated = oldConvs.map((c) =>
          c.id === data.conversationId ? { ...c, pinnedAt: data.pinnedAt } : c
        );
        return sortConversations(updated);
      });
    };

    const handleConversationUpdated = (payload: Conversation | { conversation: Conversation }) => {
      const conv = 'conversation' in payload ? payload.conversation : payload;
      if (!conv || !conv.id) {
        queryClient.invalidateQueries({ queryKey: ['conversations'] });
        return;
      }
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        return oldConvs.map((c) =>
          c.id === conv.id ? {
            ...c,
            name: conv.name,
            avatar: conv.avatar,
            description: conv.description ?? c.description,
            participants: conv.participants,
            isAnnouncementMode: conv.isAnnouncementMode ?? c.isAnnouncementMode,
            requiresApproval: conv.requiresApproval ?? c.requiresApproval,
            isPublic: conv.isPublic ?? c.isPublic,
            invitePermission: conv.invitePermission ?? c.invitePermission,
            messagePermission: conv.messagePermission ?? c.messagePermission,
            editPermission: conv.editPermission ?? c.editPermission,
            disappearingTtlSeconds: conv.disappearingTtlSeconds ?? c.disappearingTtlSeconds,
          } : c
        );
      });
      const active = useConversationStore.getState().activeConversation;
      if (active && active.id === conv.id) {
        useConversationStore.getState().setActiveConversation({
          ...active,
          name: conv.name,
          avatar: conv.avatar,
          description: conv.description ?? active.description,
          participants: conv.participants,
          isAnnouncementMode: conv.isAnnouncementMode ?? active.isAnnouncementMode,
          requiresApproval: conv.requiresApproval ?? active.requiresApproval,
          isPublic: conv.isPublic ?? active.isPublic,
          invitePermission: conv.invitePermission ?? active.invitePermission,
          messagePermission: conv.messagePermission ?? active.messagePermission,
          editPermission: conv.editPermission ?? active.editPermission,
          disappearingTtlSeconds: conv.disappearingTtlSeconds ?? active.disappearingTtlSeconds,
        });
      }
    };

    const handleParticipantsChanged = () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleConversationRemoved = (data: { conversationId: string }) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        return oldConvs.filter((c) => c.id !== data.conversationId);
      });
      const active = useConversationStore.getState().activeConversation;
      if (active && active.id === data.conversationId) {
        useConversationStore.getState().setActiveConversation(null);
      }
    };

    const handleMuteToggled = (data: { conversationId: string; mutedUntil: string | null }) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        return oldConvs.map((c) =>
          c.id === data.conversationId ? { ...c, mutedUntil: data.mutedUntil } : c
        );
      });
    };

    const handleArchiveToggled = (data: { conversationId: string; archivedAt: string | null }) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        return oldConvs.map((c) =>
          c.id === data.conversationId ? { ...c, archivedAt: data.archivedAt } : c
        );
      });
    };

    const handleDisappearingChanged = (data: { conversationId: string; ttlSeconds: number | null }) => {
      queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
        if (!oldConvs) return oldConvs;
        return oldConvs.map((c) =>
          c.id === data.conversationId ? { ...c, disappearingTtlSeconds: data.ttlSeconds } : c
        );
      });
      const active = useConversationStore.getState().activeConversation;
      if (active && active.id === data.conversationId) {
        useConversationStore.getState().setActiveConversation({
          ...active,
          disappearingTtlSeconds: data.ttlSeconds,
        });
      }
    };

    socket.on('conversation:pin_toggled', handlePinToggled);
    socket.on('conversation:mute_toggled', handleMuteToggled);
    socket.on('conversation:archive_toggled', handleArchiveToggled);
    socket.on('conversation:disappearing_changed', handleDisappearingChanged);
    socket.on('conversation:updated', handleConversationUpdated);
    socket.on('conversation:participants_added', handleConversationUpdated);
    socket.on('conversation:participant_removed', handleParticipantsChanged);
    socket.on('conversation:role_changed', handleConversationUpdated);
    socket.on('conversation:removed', handleConversationRemoved);

    // Community events — invalidate community queries on relevant changes
    const handleCommunityEvent = (data: { communityId?: string; conversationId?: string }) => {
      const id = data?.communityId;
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['community', id] });
        queryClient.invalidateQueries({ queryKey: ['communities-explore'] });
        queryClient.invalidateQueries({ queryKey: ['communities-trending'] });
        queryClient.invalidateQueries({ queryKey: ['communities-featured'] });
      }
    };
    socket.on('community:updated', handleCommunityEvent);
    socket.on('community:promoted', handleCommunityEvent);
    socket.on('community:demoted', handleCommunityEvent);
    socket.on('community:highlight_added', handleCommunityEvent);
    socket.on('community:event_created', handleCommunityEvent);

    return () => {
      socket.off('message:new', handleNewMessageGlobal);
      socket.off('messages:read_watermark', handleMessagesReadGlobal);
      socket.off('user:presence', handleUserPresence);
      socket.off('message:deleted_everyone', handleMessageDeletedEveryoneGlobal);
      socket.off('conversation:pin_toggled', handlePinToggled);
      socket.off('conversation:mute_toggled', handleMuteToggled);
      socket.off('conversation:archive_toggled', handleArchiveToggled);
      socket.off('conversation:disappearing_changed', handleDisappearingChanged);
      socket.off('conversation:updated', handleConversationUpdated);
      socket.off('conversation:participants_added', handleConversationUpdated);
      socket.off('conversation:participant_removed', handleParticipantsChanged);
      socket.off('conversation:role_changed', handleConversationUpdated);
      socket.off('conversation:removed', handleConversationRemoved);
      socket.off('community:updated', handleCommunityEvent);
      socket.off('community:promoted', handleCommunityEvent);
      socket.off('community:demoted', handleCommunityEvent);
      socket.off('community:highlight_added', handleCommunityEvent);
      socket.off('community:event_created', handleCommunityEvent);
    };
  }, [socket, queryClient]);

  return {
    conversations,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};
