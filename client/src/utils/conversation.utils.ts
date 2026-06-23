import type { Conversation } from '../types/chat.types';

export const sortConversations = (conversations: Conversation[]): Conversation[] => {
  const now = Date.now();
  return [...conversations].sort((a, b) => {
    // 1. Pinned first (most-recently pinned on top)
    if (a.pinnedAt && b.pinnedAt) {
      return new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
    }
    if (a.pinnedAt) return -1;
    if (b.pinnedAt) return 1;

    // 2. Online users next (DIRECT conversations only)
    const aOnline = a.type === 'DIRECT' && a.participants.some((p) => p.isOnline);
    const bOnline = b.type === 'DIRECT' && b.participants.some((p) => p.isOnline);
    if (aOnline && !bOnline) return -1;
    if (!aOnline && bOnline) return 1;

    // 3. Muted conversations go lower
    const aMuted = a.mutedUntil && new Date(a.mutedUntil).getTime() > now;
    const bMuted = b.mutedUntil && new Date(b.mutedUntil).getTime() > now;
    if (aMuted && !bMuted) return 1;
    if (!aMuted && bMuted) return -1;

    // 4. By latest activity
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
};
