import { create } from 'zustand';
import type { SendMessagePayload } from '../api/messages.api';

/**
 * A message send that failed (offline, server error) and is awaiting retry.
 * `tempId` matches the optimistic bubble left in the message cache with status 'FAILED'.
 */
export interface QueuedMessage {
  tempId: string;
  conversationId: string;
  payload: SendMessagePayload;
  error?: string;
  retryCount: number;
  queuedAt: number;
}

const STORAGE_KEY = 'nexchat_message_queue';

const load = (): QueuedMessage[] => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
};

const save = (queue: QueuedMessage[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* quota / serialization issues are non-fatal */
  }
};

interface MessageQueueState {
  queue: QueuedMessage[];
  /** Add or replace (by tempId) a failed message. */
  enqueue: (item: Omit<QueuedMessage, 'retryCount' | 'queuedAt'> & { retryCount?: number }) => void;
  /** Drop a message from the queue (on successful retry or manual delete). */
  remove: (tempId: string) => void;
  /** All queued messages for one conversation, oldest first. */
  forConversation: (conversationId: string) => QueuedMessage[];
}

export const useMessageQueueStore = create<MessageQueueState>((set, get) => ({
  queue: load(),

  enqueue: (item) => {
    const next = [
      ...get().queue.filter((q) => q.tempId !== item.tempId),
      { ...item, retryCount: item.retryCount ?? 0, queuedAt: Date.now() },
    ];
    save(next);
    set({ queue: next });
  },

  remove: (tempId) => {
    const next = get().queue.filter((q) => q.tempId !== tempId);
    save(next);
    set({ queue: next });
  },

  forConversation: (conversationId) =>
    get()
      .queue.filter((q) => q.conversationId === conversationId)
      .sort((a, b) => a.queuedAt - b.queuedAt),
}));
