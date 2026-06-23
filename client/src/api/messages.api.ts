import { api } from './axios';
import type { Message, ReadReceiptUser } from '../types/chat.types';

export interface SendMessagePayload {
  conversationId: string;
  content: string;
  type: 'TEXT' | 'IMAGE' | 'AUDIO' | 'VIDEO' | 'FILE' | 'POLL';
  mediaUrl?: string;
  replyToId?: string;
  mentionedUserIds?: string[];
  mentionEveryone?: boolean;
  scheduledAt?: string;
  pollOptionCount?: number;
}

export interface FetchMessagesResponse {
  messages: Message[];
  nextCursor: string | null;
}

export interface ReactionGroup {
  count: number;
  users: { id: string; displayName: string | null }[];
}

export const messagesApi = {
  list: async (conversationId: string, cursor?: string, limit: number = 25): Promise<FetchMessagesResponse> => {
    const params: any = { limit };
    if (cursor) {
      params.cursor = cursor;
    }
    const res = await api.get(`/messages/${conversationId}`, { params });
    return res.data.data;
  },

  search: async (conversationId: string, q: string, cursor?: string): Promise<FetchMessagesResponse> => {
    const res = await api.get(`/messages/${conversationId}/search`, {
      params: { q, cursor, limit: 25 },
    });
    return res.data.data;
  },

  globalSearch: async (q: string, cursor?: string): Promise<FetchMessagesResponse> => {
    const res = await api.get('/messages/global-search', {
      params: { q, cursor, limit: 20 },
    });
    return res.data.data;
  },

  create: async (payload: SendMessagePayload): Promise<Message> => {
    const res = await api.post('/messages', payload);
    return res.data.data;
  },

  edit: async (messageId: string, content: string): Promise<Message> => {
    const res = await api.patch(`/messages/${messageId}`, { content });
    return res.data.data;
  },

  toggleStar: async (messageId: string): Promise<{ starred: boolean }> => {
    const res = await api.post(`/messages/${messageId}/star`);
    return res.data.data;
  },

  getStarred: async (cursor?: string): Promise<FetchMessagesResponse> => {
    const res = await api.get('/messages/starred', { params: { cursor, limit: 25 } });
    return res.data.data;
  },

  getStats: async (conversationId: string): Promise<{
    media: number; files: number; links: number; voice: number;
    mutualGroups: number; mutualFriends: number;
  }> => {
    const res = await api.get(`/messages/${conversationId}/stats`);
    return res.data.data;
  },

  listMedia: async (
    conversationId: string,
    category: 'MEDIA' | 'DOCS' = 'MEDIA',
    cursor?: string
  ): Promise<{ messages: Message[]; nextCursor: string | null }> => {
    const res = await api.get(`/messages/${conversationId}/media`, {
      params: { category, cursor, limit: 30 },
    });
    return res.data.data;
  },

  forward: async (messageId: string, targetConversationId: string): Promise<Message> => {
    const res = await api.post('/messages/forward', { messageId, targetConversationId });
    return res.data.data;
  },

  toggleReaction: async (messageId: string, emoji: string): Promise<{ action: 'add' | 'remove'; emoji: string }> => {
    const res = await api.post(`/messages/${messageId}/reactions`, { emoji });
    return res.data.data;
  },

  togglePin: async (messageId: string): Promise<{ pinned: boolean }> => {
    const res = await api.post(`/messages/${messageId}/pin`);
    return res.data.data;
  },

  listPinned: async (conversationId: string): Promise<Message[]> => {
    const res = await api.get(`/messages/${conversationId}/pinned`);
    return res.data.data;
  },

  getReactions: async (messageId: string): Promise<Record<string, ReactionGroup>> => {
    const res = await api.get(`/messages/${messageId}/reactions`);
    return res.data.data;
  },

  readBy: async (
    messageId: string
  ): Promise<{ readBy: ReadReceiptUser[]; deliveredTo: ReadReceiptUser[] }> => {
    const res = await api.get(`/messages/${messageId}/read-by`);
    return res.data.data;
  },

  markAsRead: async (conversationId: string): Promise<any> => {
    const res = await api.post(`/messages/read/${conversationId}`);
    return res.data.data;
  },

  delete: async (messageId: string, type: 'ME' | 'EVERYONE'): Promise<any> => {
    const res = await api.delete(`/messages/${messageId}`, { data: { type } });
    return res.data.data;
  },

  pollVote: async (messageId: string, optionIndex: number): Promise<{ optionIndex: number | null }> => {
    const res = await api.post(`/messages/${messageId}/poll-vote`, { optionIndex });
    return res.data.data;
  },

  getPollVotes: async (
    messageId: string
  ): Promise<Record<number, { id: string; displayName: string | null; avatar: string | null }[]>> => {
    const res = await api.get(`/messages/${messageId}/poll-votes`);
    return res.data.data;
  },

  getScheduled: async (conversationId: string): Promise<{ messages: Message[] }> => {
    const res = await api.get(`/messages/${conversationId}/scheduled`);
    return res.data.data;
  },

  cancelScheduled: async (messageId: string): Promise<{ id: string }> => {
    const res = await api.delete(`/messages/scheduled/${messageId}`);
    return res.data.data;
  },
};
