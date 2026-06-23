import { api } from './axios';
import type { User } from '../types/chat.types';

export interface Session {
  id: string;
  browser: string;
  os: string;
  ip: string | null;
  lastUsedAt: string;
  createdAt: string;
  current: boolean;
}

export const usersApi = {
  getSessions: async (): Promise<Session[]> => {
    const res = await api.get('/users/sessions');
    return res.data.data;
  },

  revokeSession: async (id: string): Promise<void> => {
    await api.delete(`/users/sessions/${id}`);
  },

  revokeOtherSessions: async (): Promise<{ revoked: number }> => {
    const res = await api.post('/users/sessions/revoke-others');
    return res.data.data;
  },

  search: async (q: string): Promise<User[]> => {
    const res = await api.get('/users/search', { params: { q } });
    return res.data.data;
  },

  saveFcmToken: async (fcmToken: string): Promise<any> => {
    const res = await api.post('/users/fcm-token', { fcmToken });
    return res.data.data;
  },

  getBlocked: async (): Promise<User[]> => {
    const res = await api.get('/users/blocked');
    return res.data.data;
  },

  block: async (blockedId: string): Promise<any> => {
    const res = await api.post('/users/block', { blockedId });
    return res.data.data;
  },

  unblock: async (blockedId: string): Promise<any> => {
    const res = await api.post('/users/unblock', { blockedId });
    return res.data.data;
  },

  getMe: async (): Promise<User> => {
    const res = await api.get('/users/me');
    return res.data.data;
  },

  getByUsername: async (username: string): Promise<User> => {
    const res = await api.get(`/users/by-username/${encodeURIComponent(username)}`);
    return res.data.data;
  },

  updateProfile: async (data: {
    displayName?: string;
    avatar?: string | null;
    bio?: string | null;
    username?: string | null;
    lastSeenVisibility?: 'EVERYONE' | 'NOBODY';
    readReceiptsEnabled?: boolean;
    notificationsEnabled?: boolean;
    notificationSound?: boolean;
    isPublic?: boolean;
  }): Promise<User> => {
    const res = await api.put('/users/profile', data);
    return res.data.data;
  },

  changeUsername: async (username: string, password: string) => {
    const res = await api.put('/users/username', { username, password });
    return res.data;
  },

  sendEmailChangeOtp: async (newEmail: string, password: string) => {
    const res = await api.post('/users/email/change-send-otp', { newEmail, password });
    return res.data;
  },

  confirmEmailChange: async (code: string) => {
    const res = await api.post('/users/email/change-confirm', { code });
    return res.data;
  },

  deleteAccount: async (password: string) => {
    const res = await api.delete('/users/me', { data: { password } });
    return res.data;
  },
};
