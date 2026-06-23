import type { QueryClient } from '@tanstack/react-query';
import type { Message } from '../types/chat.types';

/**
 * Map a single message inside the infinite-query messages cache to a new value.
 * Centralizes the nested `pages -> messages` traversal that several mutations share.
 */
export const patchMessageInCache = (
  queryClient: QueryClient,
  conversationId: string,
  messageId: string,
  updater: (m: Message) => Message
): void => {
  queryClient.setQueryData(['messages', conversationId], (old: any) => {
    if (!old) return old;
    // Wildcard '*' patches every message (used by batch status updates).
    const matchAll = messageId === '*';
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        messages: page.messages.map((m: Message) =>
          matchAll || m.id === messageId ? updater(m) : m
        ),
      })),
    };
  });
};

/** Remove a single message from the infinite-query messages cache. */
export const removeMessageFromCache = (
  queryClient: QueryClient,
  conversationId: string,
  messageId: string
): void => {
  queryClient.setQueryData(['messages', conversationId], (old: any) => {
    if (!old) return old;
    return {
      ...old,
      pages: old.pages.map((page: any) => ({
        ...page,
        messages: page.messages.filter((m: Message) => m.id !== messageId),
      })),
    };
  });
};

export interface MessageListItem {
  type: 'MESSAGE' | 'DIVIDER' | 'UNREAD';
  id: string;
  message?: Message;
  content?: string;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isUnread?: boolean;
}

// Consecutive messages from the same sender within this window are grouped.
const SAME_GROUP_GAP_MS = 5 * 60 * 1000;

export const groupMessagesByDate = (
  messages: Message[],
  firstUnreadId?: string | null
): MessageListItem[] => {
  const list: MessageListItem[] = [];
  let lastDateString = '';

  messages.forEach((msg) => {
    const msgDate = new Date(msg.createdAt);
    const dateString = msgDate.toLocaleDateString([], {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (dateString !== lastDateString) {
      // Get human readable divider text
      const now = new Date();
      const yesterday = new Date();
      yesterday.setDate(now.getDate() - 1);

      let content = dateString;
      if (msgDate.toDateString() === now.toDateString()) {
        content = 'Today';
      } else if (msgDate.toDateString() === yesterday.toDateString()) {
        content = 'Yesterday';
      } else {
        content = msgDate.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' });
      }

      list.push({
        type: 'DIVIDER',
        id: `divider-${msg.id}`,
        content,
      });
      lastDateString = dateString;
    }

    // Unread separator immediately before the first unseen message
    if (firstUnreadId && msg.id === firstUnreadId) {
      list.push({ type: 'UNREAD', id: `unread-${msg.id}`, content: 'Unread messages' });
    }

    list.push({
      type: 'MESSAGE',
      id: msg.id,
      message: msg,
    });
  });

  let foundUnread = false;

  for (let i = 0; i < list.length; i++) {
    const item = list[i];

    if (item.type === 'UNREAD') {
      foundUnread = true;
      continue;
    }

    if (item.type === 'MESSAGE' && item.message) {
      if (foundUnread) {
        item.isUnread = true;
      }

      const prev = list[i - 1];
      const next = list[i + 1];
      const prevMsg = prev?.type === 'MESSAGE' ? prev.message : undefined;
      const nextMsg = next?.type === 'MESSAGE' ? next.message : undefined;
      const t = new Date(item.message.createdAt).getTime();

      item.isFirstInGroup =
        !prevMsg ||
        prevMsg.senderId !== item.message.senderId ||
        t - new Date(prevMsg.createdAt).getTime() > SAME_GROUP_GAP_MS;

      item.isLastInGroup =
        !nextMsg ||
        nextMsg.senderId !== item.message.senderId ||
        new Date(nextMsg.createdAt).getTime() - t > SAME_GROUP_GAP_MS;
    }
  }

  return list;
};
