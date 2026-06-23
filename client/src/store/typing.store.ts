import { create } from 'zustand';

interface TypingUser {
  userId: string;
  displayName: string;
}

interface TypingState {
  typingUsers: Record<string, TypingUser>;
  setTyping: (conversationId: string, userId: string, displayName: string) => void;
  clearTyping: (conversationId: string, userId: string) => void;
  clearConversationTyping: (conversationId: string) => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  typingUsers: {},
  setTyping: (conversationId, userId, displayName) =>
    set((state) => {
      const key = `${conversationId}:${userId}`;
      if (state.typingUsers[key]) return state;
      return { typingUsers: { ...state.typingUsers, [key]: { userId, displayName } } };
    }),
  clearTyping: (conversationId, userId) =>
    set((state) => {
      const key = `${conversationId}:${userId}`;
      if (!state.typingUsers[key]) return state;
      const next = { ...state.typingUsers };
      delete next[key];
      return { typingUsers: next };
    }),
  clearConversationTyping: (conversationId) =>
    set((state) => {
      const prefix = `${conversationId}:`;
      let changed = false;
      const next: Record<string, TypingUser> = {};
      for (const key in state.typingUsers) {
        if (!key.startsWith(prefix)) {
          next[key] = state.typingUsers[key];
        } else {
          changed = true;
        }
      }
      return changed ? { typingUsers: next } : state;
    }),
}));
