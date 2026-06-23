import { api } from './axios';

export interface Friend {
  id: string;
  displayName: string | null;
  avatar: string | null;
  username: string | null;
}

export interface FriendRequest {
  id: string;
  sender: { id: string; displayName: string | null; avatar: string | null; username?: string | null };
  receiver?: { id: string; displayName: string | null; avatar: string | null; username?: string | null };
  createdAt: string;
}

export const friendsApi = {
  list: async (): Promise<Friend[]> => {
    const res = await api.get('/friends');
    return res.data.data;
  },
  listWithPresence: async (): Promise<(Friend & { isOnline: boolean })[]> => {
    const res = await api.get('/friends/presence');
    return res.data.data;
  },
  sendRequest: async (userId: string) => {
    const res = await api.post('/friends/request', { userId });
    return res.data.data;
  },
  acceptRequest: async (requestId: string) => {
    const res = await api.post(`/friends/accept/${requestId}`);
    return res.data.data;
  },
  rejectRequest: async (requestId: string) => {
    const res = await api.post(`/friends/reject/${requestId}`);
    return res.data.data;
  },
  cancelRequest: async (requestId: string) => {
    const res = await api.post(`/friends/cancel/${requestId}`);
    return res.data.data;
  },
  removeFriend: async (friendId: string) => {
    const res = await api.delete(`/friends/${friendId}`);
    return res.data.data;
  },
  pendingReceived: async (): Promise<FriendRequest[]> => {
    const res = await api.get('/friends/pending/received');
    return res.data.data;
  },
  pendingSent: async (): Promise<FriendRequest[]> => {
    const res = await api.get('/friends/pending/sent');
    return res.data.data;
  },
};
