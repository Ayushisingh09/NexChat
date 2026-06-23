import { api } from './axios';

export interface Story {
  id: string;
  type: 'IMAGE' | 'VIDEO' | 'TEXT';
  mediaUrl: string | null;
  caption: string | null;
  bgColor: string | null;
  fontStyle: string | null;
  createdAt: string;
  expiresAt: string;
  viewed: boolean;
}

export interface StoryFeedGroup {
  userId: string;
  user: { id: string; displayName: string | null; avatar: string | null };
  stories: Story[];
}

export interface StoryViewer {
  id: string;
  displayName: string | null;
  avatar: string | null;
  viewedAt: string;
  reactionEmoji: string | null;
}

export interface StoryViewsResponse {
  viewers: StoryViewer[];
  reactionSummary: Record<string, number>;
}

export const storiesApi = {
  create: async (payload: {
    type: 'IMAGE' | 'VIDEO' | 'TEXT';
    mediaUrl?: string;
    caption?: string;
    bgColor?: string;
    fontStyle?: string;
  }): Promise<Story> => {
    const res = await api.post('/stories', payload);
    return res.data.data;
  },

  feed: async (): Promise<StoryFeedGroup[]> => {
    const res = await api.get('/stories/feed');
    return res.data.data;
  },

  markViewed: async (storyId: string): Promise<void> => {
    await api.post(`/stories/${storyId}/view`);
  },

  getViews: async (storyId: string): Promise<StoryViewsResponse> => {
    const res = await api.get(`/stories/${storyId}/views`);
    return res.data.data;
  },

  react: async (storyId: string, emoji: string): Promise<void> => {
    await api.post(`/stories/${storyId}/react`, { emoji });
  },

  delete: async (storyId: string): Promise<void> => {
    await api.delete(`/stories/${storyId}`);
  },
};
