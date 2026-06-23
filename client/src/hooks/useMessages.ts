import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef } from 'react';
import { messagesApi } from '../api/messages.api';
import { patchMessageInCache, removeMessageFromCache } from '../utils/message.utils';
import type { SendMessagePayload } from '../api/messages.api';
import { useSocketStore } from '../store/socket.store';
import { useAuthStore } from '../store/auth.store';
import { useMessageQueueStore } from '../store/messageQueue.store';
import { removeFromIndex } from '../utils/searchIndex';
import type { Message, Conversation } from '../types/chat.types';

export const useMessages = (conversationId: string | undefined) => {
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);
  const currentUser = useAuthStore((state) => state.user);
  const markReadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Fetch Paginated Message History via TanStack Infinite Query
  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: ({ pageParam }) =>
      messagesApi.list(conversationId!, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
    enabled: !!conversationId,
    // Cache opened conversations so revisiting shows messages instantly (no
    // skeleton/reload). Live updates still arrive via socket while mounted, and a
    // quiet background refetch after staleTime reconciles anything missed.
    staleTime: 1000 * 30,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });

  // Flat array of all loaded messages, de-duplicated by id. The optimistic-send
  // path and the socket `message:new` echo can briefly leave both a temp bubble
  // and its server counterpart (or two copies of the same id) in the cache while
  // a race settles; dedup here guarantees the UI never renders a message twice.
  const messages = useMemo(() => {
    if (!data) return [] as Message[];
    const seen = new Set<string>();
    const out: Message[] = [];
    for (const page of data.pages) {
      for (const m of page.messages) {
        if (seen.has(m.id)) continue;
        seen.add(m.id);
        out.push(m);
      }
    }
    out.sort(
      (a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      },
    );
    return out;
  }, [data]);

  // Refs for values used inside socket handlers — avoids re-registering all 9
  // listeners every time the user object or message list changes.
  const conversationIdRef = useRef(conversationId);
  conversationIdRef.current = conversationId;
  const currentUserIdRef = useRef(currentUser?.id);
  currentUserIdRef.current = currentUser?.id;

  // 2. Real-time Socket sync — handlers defined outside the effect so they are
  //    stable references; they read latest state through refs.
  const handleNewMessage = (newMsg: Message) => {
    const convId = conversationIdRef.current;
    const uid = currentUserIdRef.current;
    if (newMsg.conversationId !== convId) return;

    queryClient.setQueryData(['messages', convId], (old: any) => {
      if (!old) return old;

      // The useMemo layer above already deduplicates by id, but guard here
      // for the rare case where setQueryData runs before useMemo recalculates.
      const exists = old.pages.some((page: any) =>
        page.messages.some((m: Message) => m.id === newMsg.id)
      );
      if (exists) return old;

      // Resolve HTTP vs Socket race: if a server echo arrives before onSuccess,
      // replace the matching optimistic bubble instead of duplicating.
      if (newMsg.senderId === uid) {
        let replaced = false;
        const updatedPages = old.pages.map((page: any) => {
          const updatedMessages = page.messages.map((m: Message) => {
            if (m.id.startsWith('temp-') && m.content === newMsg.content) {
              replaced = true;
              return newMsg;
            }
            return m;
          });
          return { ...page, messages: updatedMessages };
        });
        if (replaced) return { ...old, pages: updatedPages };
      }

      // Append to the latest page.
      return {
        ...old,
        pages: old.pages.map((page: any, index: number) => {
          if (index === old.pages.length - 1) {
            return { ...page, messages: [...page.messages, newMsg] };
          }
          return page;
        }),
      };
    });
  };

  const handleMessagesRead = (readData: { conversationId: string; readByUserId: string }) => {
    const uid = currentUserIdRef.current;
    if (readData.conversationId !== conversationIdRef.current) return;
    if (readData.readByUserId === uid) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, '*', (m) =>
      m.senderId === uid ? { ...m, status: 'READ' as const } : m,
    );
  };

  const handleMessagesDelivered = (deliveredData: { conversationId: string; deliveredToUserId: string }) => {
    const uid = currentUserIdRef.current;
    if (deliveredData.conversationId !== conversationIdRef.current) return;
    if (deliveredData.deliveredToUserId === uid) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, '*', (m) =>
      m.senderId === uid && m.status === 'SENT' ? { ...m, status: 'DELIVERED' as const } : m,
    );
  };

  const handleMessageDeletedEveryone = (deletedMsg: Message) => {
    removeFromIndex(deletedMsg.id);
    if (deletedMsg.conversationId !== conversationIdRef.current) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, deletedMsg.id, (m) => ({
      ...m,
      isDeleted: true,
      content: 'This message was deleted',
      mediaUrl: undefined,
    }));
  };

  const handleReaction = (data: { conversationId: string; messageId: string; userId: string; emoji: string; action: 'add' | 'remove' }) => {
    if (data.conversationId !== conversationIdRef.current) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, data.messageId, (m) => {
      const reactions = m.reactions ? [...m.reactions] : [];
      const idx = reactions.findIndex((r) => r.userId === data.userId && r.emoji === data.emoji);
      if (data.action === 'add') {
        if (idx === -1) reactions.push({ userId: data.userId, emoji: data.emoji });
      } else if (idx !== -1) {
        reactions.splice(idx, 1);
      }
      return { ...m, reactions };
    });
  };

  const handleMessagePin = (data: { conversationId: string; messageId: string; pinned: boolean; pinnedById: string | null }) => {
    if (data.conversationId !== conversationIdRef.current) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, data.messageId, (m) => ({
      ...m,
      pinnedAt: data.pinned ? new Date().toISOString() : null,
      pinnedById: data.pinnedById,
    }));
  };

  const handleMessageEdited = (editedMsg: Message) => {
    if (editedMsg.conversationId !== conversationIdRef.current) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, editedMsg.id, (m) => ({
      ...m,
      content: editedMsg.content,
      editedAt: editedMsg.editedAt,
    }));
  };

  const handleMessageExpired = (data: { conversationId: string; messageId: string }) => {
    removeFromIndex(data.messageId);
    if (data.conversationId !== conversationIdRef.current) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, data.messageId, (m) => ({
      ...m,
      isExpired: true,
    }));
    setTimeout(() => {
      removeMessageFromCache(queryClient, conversationIdRef.current!, data.messageId);
    }, 450);
  };

  const handlePollVoted = (data: { conversationId: string; messageId: string; userId: string; optionIndex: number | null }) => {
    if (data.conversationId !== conversationIdRef.current) return;
    patchMessageInCache(queryClient, conversationIdRef.current!, data.messageId, (m) => {
      const votes = (m.pollVotes || []).filter((v) => v.userId !== data.userId);
      if (data.optionIndex !== null) {
        votes.push({ userId: data.userId, optionIndex: data.optionIndex });
      }
      return { ...m, pollVotes: votes };
    });
  };

  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('join_conversation', conversationId);

    socket.on('message:new', handleNewMessage);
    socket.on('messages:read_watermark', handleMessagesRead);
    socket.on('messages:delivered', handleMessagesDelivered);
    socket.on('message:deleted_everyone', handleMessageDeletedEveryone);
    socket.on('message:reaction', handleReaction);
    socket.on('message:pin', handleMessagePin);
    socket.on('message:edited', handleMessageEdited);
    socket.on('message:expired', handleMessageExpired);
    socket.on('poll:voted', handlePollVoted);

    return () => {
      socket.emit('leave_conversation', conversationId);
      socket.off('message:new', handleNewMessage);
      socket.off('messages:read_watermark', handleMessagesRead);
      socket.off('messages:delivered', handleMessagesDelivered);
      socket.off('message:deleted_everyone', handleMessageDeletedEveryone);
      socket.off('message:reaction', handleReaction);
      socket.off('message:pin', handleMessagePin);
      socket.off('message:edited', handleMessageEdited);
      socket.off('message:expired', handleMessageExpired);
      socket.off('poll:voted', handlePollVoted);
    };
  }, [socket, conversationId, queryClient]);

  // 3. Mark messages as read — debounced so new messages arriving via socket
  //    don't fire a POST per message. Also re-triggers on tab focus.
  useEffect(() => {
    if (!conversationId) return;

    const triggerMarkRead = () => {
      if (document.visibilityState !== 'visible') return;
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      markReadTimerRef.current = setTimeout(async () => {
        try {
          await messagesApi.markAsRead(conversationId);
          queryClient.setQueryData<Conversation[]>(['conversations'], (oldConvs) => {
            if (!oldConvs) return [];
            return oldConvs.map((c) =>
              c.id === conversationId ? { ...c, unreadCount: 0 } : c
            );
          });
        } catch (err) {
          console.error('Failed to mark messages as read:', err);
        }
      }, 800);
    };

    triggerMarkRead();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') triggerMarkRead();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      if (markReadTimerRef.current) clearTimeout(markReadTimerRef.current);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [conversationId, queryClient]);

  // 3. Send Message Mutation with Optimistic Updates
  const sendMutation = useMutation({
    mutationFn: async (payload: SendMessagePayload) => {
      return messagesApi.create({
        ...payload,
      });
    },
    onMutate: async (newMsgPayload) => {
      await queryClient.cancelQueries({ queryKey: ['messages', conversationId] });

      const previousMessages = queryClient.getQueryData(['messages', conversationId]);

      // Optimistic message object
      const tempId = `temp-${Date.now()}`;
      const optimisticMessage: Message = {
        id: tempId,
        conversationId: conversationId!,
        senderId: currentUser?.id || '',
        content: newMsgPayload.content,
        type: newMsgPayload.type,
        mediaUrl: newMsgPayload.mediaUrl,
        status: 'PENDING',
        createdAt: new Date().toISOString(),
        mentionedUserIds: newMsgPayload.mentionedUserIds,
      };

      // Prepend the optimistic message to the cache
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return { pages: [{ messages: [optimisticMessage], nextCursor: null }], pageParams: [] };
        return {
          ...old,
          pages: old.pages.map((page: any, index: number) => {
            if (index === old.pages.length - 1) {
              return {
                ...page,
                messages: [...page.messages, optimisticMessage],
              };
            }
            return page;
          }),
        };
      });

      return { previousMessages, tempId };
    },
    onError: (err, newMsgPayload, context) => {
      const tempId = context?.tempId;
      if (!tempId) return;
      // Keep the optimistic bubble but flag it FAILED so the user can retry,
      // and persist the original payload to the offline queue for auto-retry on
      // reconnect. (We deliberately do NOT roll back to previousMessages.)
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: Message) =>
              m.id === tempId ? { ...m, status: 'FAILED' } : m
            ),
          })),
        };
      });
      useMessageQueueStore.getState().enqueue({
        tempId,
        conversationId: conversationId!,
        payload: newMsgPayload,
        error: (err as any)?.message,
      });
    },
    onSuccess: (savedMsg, _newMsgPayload, context) => {
      // Replace optimistic temp ID with actual server database message
      queryClient.setQueryData(['messages', conversationId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: any) => ({
            ...page,
            messages: page.messages.map((m: Message) =>
              m.id === context?.tempId ? savedMsg : m
            ),
          })),
        };
      });
    },
  });

  // Retry a previously failed send: drop the FAILED bubble + queue entry, then
  // re-send the original payload (creates a fresh bubble).
  const retryMessage = (tempId: string) => {
    const item = useMessageQueueStore.getState().queue.find((q) => q.tempId === tempId);
    if (!item) return;
    queryClient.setQueryData(['messages', conversationId], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          messages: page.messages.filter((m: Message) => m.id !== tempId),
        })),
      };
    });
    useMessageQueueStore.getState().remove(tempId);
    sendMutation.mutate(item.payload);
  };

  // Auto-flush this conversation's queued sends when the socket reconnects.
  useEffect(() => {
    if (!socket || !conversationId) return;
    const flush = () => {
      useMessageQueueStore
        .getState()
        .forConversation(conversationId)
        .forEach((item) => retryMessage(item.tempId));
    };
    socket.on('connect', flush);
    return () => {
      socket.off('connect', flush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, conversationId]);

  // Edit a text message
  const editMessage = async (messageId: string, content: string) => {
    // Snapshot so a failure can revert just this change instead of refetching
    // the whole conversation (which would lose the user's scroll position).
    const snapshot = queryClient.getQueryData(['messages', conversationId]);
    patchMessageInCache(queryClient, conversationId!, messageId, (m) => ({
      ...m,
      content,
      editedAt: new Date().toISOString(),
    }));

    try {
      await messagesApi.edit(messageId, content);
    } catch (err) {
      console.error('Failed to edit message:', err);
      if (snapshot) queryClient.setQueryData(['messages', conversationId], snapshot);
    }
  };

  // Schedule a text message for a future time.
  const scheduleMessage = async (plaintext: string, scheduledAt: string, replyToId?: string) => {
    await messagesApi.create({
      conversationId: conversationId!,
      content: plaintext,
      type: 'TEXT',
      replyToId,
      scheduledAt,
    });
    queryClient.invalidateQueries({ queryKey: ['scheduled', conversationId] });
  };

  // Create a poll
  const sendPoll = async (question: string, options: string[]) => {
    const cleaned = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleaned.length < 2) return;
    sendMutation.mutate({
      conversationId: conversationId!,
      content: JSON.stringify({ question: question.trim(), options: cleaned }),
      type: 'POLL',
      pollOptionCount: cleaned.length,
    });
  };

  // Cast/clear a single-choice vote; optimistic, reconciled by the poll:voted echo.
  const votePoll = async (messageId: string, optionIndex: number) => {
    const uid = currentUser?.id;
    if (!uid) return;
    const snapshot = queryClient.getQueryData(['messages', conversationId]);
    patchMessageInCache(queryClient, conversationId!, messageId, (m) => {
      const existing = (m.pollVotes || []).find((v) => v.userId === uid);
      const votes = (m.pollVotes || []).filter((v) => v.userId !== uid);
      if (!existing || existing.optionIndex !== optionIndex) {
        votes.push({ userId: uid, optionIndex });
      }
      return { ...m, pollVotes: votes };
    });
    try {
      await messagesApi.pollVote(messageId, optionIndex);
    } catch (err) {
      console.error('Failed to vote on poll:', err);
      if (snapshot) queryClient.setQueryData(['messages', conversationId], snapshot);
    }
  };

  return {
    messages,
    isLoading,
    error,
    refetch,
    loadMore: fetchNextPage,
    hasMore: !!hasNextPage,
    isFetchingNextPage,
    sendMessage: sendMutation.mutate,
    retryMessage,
    editMessage,
    scheduleMessage,
    sendPoll,
    votePoll,
  };
};
