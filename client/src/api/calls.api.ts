import { api } from './axios';

export interface CallRecord {
  id: string;
  callerId: string;
  calleeId: string;
  roomName: string;
  status: string;
  isVideo: boolean;
  startedAt: string | null;
  endedAt: string | null;
  duration: number | null;
  createdAt: string;
  caller: { id: string; displayName: string | null; avatar: string | null };
  callee: { id: string; displayName: string | null; avatar: string | null };
}

export interface InitiateResponse {
  callId: string;
  roomName: string;
}

export interface TokenResponse {
  token: string;
  roomName: string;
}

export const callsApi = {
  initiate: async (userId: string, isVideo = false): Promise<InitiateResponse> => {
    const res = await api.post('/calls/initiate', { userId, isVideo });
    return res.data.data;
  },

  accept: async (callId: string): Promise<CallRecord> => {
    const res = await api.post(`/calls/${callId}/accept`);
    return res.data.data;
  },

  reject: async (callId: string): Promise<void> => {
    await api.post(`/calls/${callId}/reject`);
  },

  end: async (callId: string): Promise<{ duration: number }> => {
    const res = await api.post(`/calls/${callId}/end`);
    return res.data.data;
  },

  cancel: async (callId: string): Promise<void> => {
    await api.post(`/calls/${callId}/cancel`);
  },

  getToken: async (callId: string): Promise<TokenResponse> => {
    const res = await api.get(`/calls/${callId}/token`);
    return res.data.data;
  },

  history: async (cursor?: string, limit = 30): Promise<{ calls: CallRecord[]; nextCursor: string | null }> => {
    const params: any = { limit };
    if (cursor) params.cursor = cursor;
    const res = await api.get('/calls', { params });
    return res.data.data;
  },

  pending: async (): Promise<{ callId: string; roomName: string; caller: { id: string; displayName: string | null; avatar: string | null }; isVideo: boolean } | null> => {
    const res = await api.get('/calls/pending');
    return res.data.data;
  },
};
