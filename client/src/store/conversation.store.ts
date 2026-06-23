import { create } from 'zustand';
import type { Conversation } from '../types/chat.types';
import { usersApi } from '../api/users.api';

interface ConversationState {
  activeConversation: Conversation | null;
  setActiveConversation: (conversation: Conversation | null) => void;
  blockedUserIds: string[];
  fetchBlockedUsers: () => Promise<void>;
  blockUser: (userId: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  scrollToMessageId: string | null;
  setScrollToMessageId: (id: string | null) => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  activeConversation: null,
  setActiveConversation: (conversation) => set({ activeConversation: conversation }),
  blockedUserIds: [],
  scrollToMessageId: null,
  setScrollToMessageId: (id) => set({ scrollToMessageId: id }),
  fetchBlockedUsers: async () => {
    try {
      const users = await usersApi.getBlocked();
      set({ blockedUserIds: users.map((u: any) => u.id) });
    } catch (error) {
      console.error('Failed to fetch blocked users:', error);
    }
  },
  blockUser: async (userId) => {
    try {
      await usersApi.block(userId);
      set((state) => ({
        blockedUserIds: [...state.blockedUserIds, userId]
      }));
    } catch (error) {
      console.error('Failed to block user:', error);
      throw error;
    }
  },
  unblockUser: async (userId) => {
    try {
      await usersApi.unblock(userId);
      set((state) => ({
        blockedUserIds: state.blockedUserIds.filter((id) => id !== userId)
      }));
    } catch (error) {
      console.error('Failed to unblock user:', error);
      throw error;
    }
  },
}));
