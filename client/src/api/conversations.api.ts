import { api } from './axios';
import type { Conversation, User } from '../types/chat.types';

export interface CreateConversationPayload {
  type: 'DIRECT' | 'GROUP';
  name?: string;
  avatar?: string;
  description?: string;
  participantIds: string[];
}

export const conversationsApi = {
  list: async (): Promise<Conversation[]> => {
    const res = await api.get('/conversations');
    return res.data.data;
  },

  create: async (payload: CreateConversationPayload): Promise<Conversation> => {
    const res = await api.post('/conversations', payload);
    return res.data.data;
  },

  clear: async (id: string): Promise<any> => {
    const res = await api.post(`/conversations/${id}/clear`);
    return res.data.data;
  },

  delete: async (id: string): Promise<any> => {
    const res = await api.delete(`/conversations/${id}`);
    return res.data.data;
  },

  togglePin: async (id: string): Promise<{ pinnedAt: string | null }> => {
    const res = await api.post(`/conversations/${id}/pin`);
    return res.data.data;
  },

  mute: async (id: string, duration: '8h' | '1w' | 'always' | 'off'): Promise<{ mutedUntil: string | null }> => {
    const res = await api.post(`/conversations/${id}/mute`, { duration });
    return res.data.data;
  },

  archive: async (id: string, archived: boolean): Promise<{ archivedAt: string | null }> => {
    const res = await api.post(`/conversations/${id}/archive`, { archived });
    return res.data.data;
  },

  setDisappearing: async (id: string, ttlSeconds: number | null): Promise<{ ttlSeconds: number | null }> => {
    const res = await api.post(`/conversations/${id}/disappearing`, { ttlSeconds });
    return res.data.data;
  },

  updateGroup: async (
    id: string,
    data: {
      name?: string;
      avatar?: string;
      description?: string;
      isAnnouncementMode?: boolean;
      requiresApproval?: boolean;
      isPublic?: boolean;
      invitePermission?: string;
      messagePermission?: string;
      editPermission?: string;
    }
  ): Promise<Conversation> => {
    const res = await api.put(`/conversations/${id}/group`, data);
    return res.data.data;
  },

  listJoinRequests: async (id: string): Promise<any[]> => {
    const res = await api.get(`/conversations/${id}/join-requests`);
    return res.data.data;
  },

  resolveJoinRequest: async (id: string, requestId: string, action: 'APPROVE' | 'REJECT'): Promise<any> => {
    const res = await api.post(`/conversations/${id}/join-requests/${requestId}/resolve`, { action });
    return res.data.data;
  },

  listAuditLogs: async (id: string): Promise<any[]> => {
    const res = await api.get(`/conversations/${id}/audit-log`);
    return res.data.data;
  },

  updateNotificationPreference: async (id: string, preference: 'ALL' | 'MENTIONS_ONLY' | 'MUTE'): Promise<any> => {
    const res = await api.post(`/conversations/${id}/notification-preference`, { preference });
    return res.data.data;
  },

  addParticipants: async (id: string, userIds: string[]): Promise<Conversation> => {
    const res = await api.post(`/conversations/${id}/participants`, { userIds });
    return res.data.data;
  },

  removeParticipant: async (id: string, userId: string): Promise<any> => {
    const res = await api.delete(`/conversations/${id}/participants/${userId}`);
    return res.data.data;
  },

  updateParticipantRole: async (id: string, userId: string, role: 'ADMIN' | 'MEMBER'): Promise<Conversation> => {
    const res = await api.put(`/conversations/${id}/participants/${userId}/role`, { role });
    return res.data.data;
  },

  createInvite: async (
    id: string,
    opts?: { expiresInHours?: number; maxUses?: number }
  ): Promise<GroupInvite> => {
    const res = await api.post(`/conversations/${id}/invites`, opts || {});
    return res.data.data;
  },

  listInvites: async (id: string): Promise<GroupInvite[]> => {
    const res = await api.get(`/conversations/${id}/invites`);
    return res.data.data;
  },

  revokeInvite: async (token: string): Promise<void> => {
    await api.delete(`/invites/${token}`);
  },

  previewInvite: async (token: string): Promise<InvitePreview> => {
    const res = await api.get(`/invites/${token}`);
    return res.data.data;
  },

  joinViaInvite: async (token: string): Promise<Conversation> => {
    const res = await api.post(`/invites/${token}/join`);
    return res.data.data;
  },

  getParticipants: async (id: string, offset = 0, limit = 30): Promise<PaginatedParticipants> => {
    const res = await api.get(`/conversations/${id}/participants`, { params: { offset, limit } });
    return res.data.data;
  },

  getContactDetails: async (conversationId: string): Promise<{
    stats: { media: number; files: number; links: number; voice: number };
    mutualGroups: number;
    mutualGroupIds: string[];
    mutualFriends: number;
    friendStatus: 'friend' | 'pending_sent' | 'pending_received' | 'none';
  }> => {
    const res = await api.get(`/conversations/${conversationId}/contact-details`);
    return res.data.data;
  },

  publicGroups: async (params?: { search?: string; page?: number; limit?: number }): Promise<PublicGroupsResponse> => {
    const res = await api.get('/conversations/public-groups', { params });
    return res.data.data;
  },

  joinGroup: async (conversationId: string): Promise<{ requiresApproval: boolean; conversationId?: string }> => {
    const res = await api.post(`/conversations/${conversationId}/join`);
    return res.data.data;
  },
};

export interface GroupInvite {
  token: string;
  expiresAt: string | null;
  maxUses: number | null;
  useCount: number;
  revoked: boolean;
  createdAt: string;
}

export interface PaginatedParticipants {
  participants: (User & { role: string; isOnline: boolean; lastSeen?: string; joinedAt: string })[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface InvitePreview {
  conversationId: string;
  name: string | null;
  avatar: string | null;
  memberCount: number;
}

export interface PublicGroup {
  id: string;
  name: string | null;
  avatar: string | null;
  description: string | null;
  memberCount: number;
  isPublic: boolean;
  requiresApproval: boolean;
  isAnnouncementMode: boolean;
  isMember: boolean;
}

export interface PublicGroupsResponse {
  groups: PublicGroup[];
  pagination: { page: number; limit: number; total: number; pages: number };
}
