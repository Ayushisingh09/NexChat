import { api } from './axios';
import { useAuthStore } from '../store/auth.store';

export interface CipherMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
  tokensUsed: number;
  provider: string;
  createdAt: string;
}

export interface CipherConversation {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  _count?: { messages: number };
}

export interface ChatResponse {
  message: {
    id: string;
    role: string;
    content: string;
    createdAt: string;
  };
  conversationId: string;
  usage: {
    tokensUsed: number;
    dailyUsed: number;
    dailyLimit: number | null;
    provider: string;
  };
}

export interface UsageResponse {
  tokensUsed: number;
  messageCount: number;
  dailyLimit: number | null;
  remaining: number | null;
  resetsAt: string;
}

export interface TierInfo {
  tierIndex: number;
  tier: {
    name: string;
    dailyTokenLimit: number | null;
    priority: number;
    features: {
      customPrompt: boolean;
      voiceInput: boolean;
      exportChat: boolean;
      search: boolean;
      branching: boolean;
      regenerate: boolean;
    };
  };
}

export interface AdminUser {
  id: string;
  username: string | null;
  displayName: string | null;
  email: string | null;
  cipherTier: number;
  tierName: string;
  createdAt: string;
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onConversationId?: (id: string) => void;
  onDone: (result: {
    messageId: string;
    conversationId: string;
    tokensUsed: number;
    dailyUsed: number;
    dailyLimit: number | null;
    provider: string;
  }) => void;
  onError: (error: string) => void;
}

export const cipherApi = {
  chat: async (message: string, conversationId?: string, customPrompt?: string): Promise<ChatResponse> => {
    const res = await api.post('/cipher/chat', { message, conversationId, customPrompt });
    return res.data.data;
  },

  chatStream: async (message: string, conversationId: string | undefined, customPrompt: string | undefined, callbacks: StreamCallbacks): Promise<void> => {
    const token = useAuthStore.getState().accessToken;
    const baseURL = api.defaults.baseURL;

    const response = await fetch(`${baseURL}/cipher/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message, conversationId, customPrompt }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      callbacks.onError(data?.message || `Error ${response.status}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response body');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmed.slice(6));
            if (data.token) {
              callbacks.onToken(data.token);
            } else if (data.conversationId && !data.done) {
              callbacks.onConversationId?.(data.conversationId);
            } else if (data.done) {
              callbacks.onDone(data);
              return;
            } else if (data.error) {
              callbacks.onError(data.error);
              return;
            }
          } catch {}
        }
      }

      const remaining = buffer.trim();
      if (remaining.startsWith('data: ')) {
        try {
          const data = JSON.parse(remaining.slice(6));
          if (data.done) {
            callbacks.onDone(data);
            return;
          } else if (data.error) {
            callbacks.onError(data.error);
            return;
          }
        } catch {}
      }
    } finally {
      reader.releaseLock();
    }
  },

  getHistory: async (conversationId?: string, limit = 50): Promise<CipherMessage[]> => {
    const params: any = { limit };
    if (conversationId) params.conversationId = conversationId;
    const res = await api.get('/cipher/history', { params });
    return res.data.data;
  },

  getConversations: async (page = 1, limit = 30): Promise<CipherConversation[]> => {
    const res = await api.get('/cipher/conversations', { params: { page, limit } });
    return res.data.data;
  },

  createConversation: async (title?: string): Promise<CipherConversation> => {
    const res = await api.post('/cipher/conversations', { title });
    return res.data.data;
  },

  updateConversation: async (id: string, title: string): Promise<CipherConversation> => {
    const res = await api.put(`/cipher/conversations/${id}`, { title });
    return res.data.data;
  },

  deleteConversation: async (id: string): Promise<void> => {
    await api.delete(`/cipher/conversations/${id}`);
  },

  getUsage: async (): Promise<UsageResponse> => {
    const res = await api.get('/cipher/usage');
    return res.data.data;
  },

  clearHistory: async (): Promise<void> => {
    await api.delete('/cipher/history');
  },

  getTier: async (): Promise<TierInfo> => {
    const res = await api.get('/cipher/tier');
    return res.data.data;
  },

  regenerateMessage: async (messageId: string): Promise<{ id: string; content: string; tokensUsed: number; provider: string }> => {
    const res = await api.post(`/cipher/messages/${messageId}/regenerate`);
    return res.data.data;
  },

  searchMessages: async (q: string): Promise<CipherMessage[]> => {
    const res = await api.get('/cipher/search', { params: { q } });
    return res.data.data;
  },

  exportConversation: async (conversationId: string, format: 'md' | 'json' = 'md'): Promise<void> => {
    const token = useAuthStore.getState().accessToken;
    const baseURL = api.defaults.baseURL;
    const response = await fetch(`${baseURL}/cipher/conversations/${conversationId}/export?format=${format}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cipher-${conversationId}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  createBranch: async (conversationId: string, messageId?: string): Promise<CipherConversation> => {
    const res = await api.post(`/cipher/conversations/${conversationId}/branch`, { messageId });
    return res.data.data;
  },

  adminGetUsers: async (page = 1, limit = 20, search?: string): Promise<{ users: AdminUser[]; total: number; page: number; totalPages: number }> => {
    const params: any = { page, limit };
    if (search) params.search = search;
    const res = await api.get('/cipher/admin/users', { params });
    return res.data.data;
  },

  adminUpdateTier: async (userId: string, tierIndex: number): Promise<void> => {
    await api.put('/cipher/admin/tier', { userId, tierIndex });
  },

  submitFeedback: async (messageId: string, feedbackType: 'good' | 'bad', reason?: string): Promise<void> => {
    await api.post('/cipher/feedback', { messageId, feedbackType, reason });
  },
};
