import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Conversation } from '../types/chat.types';

const BASE_TITLE = 'NexChat';

/**
 * Reflects total unread messages in the browser tab title, e.g. "(3) NexChat".
 * Reads the shared ['conversations'] cache (enabled:false → no extra fetch, but
 * still re-renders on cache updates). Muted conversations are excluded so the
 * tab badge matches what the user actually gets notified about. Seen messages
 * never count because their unreadCount is already 0 (see useConversations).
 */
export const useTabBadge = () => {
  const { data: conversations } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    enabled: false,
  });

  useEffect(() => {
    const now = Date.now();
    const total = (conversations || []).reduce((sum, c) => {
      const muted = c.mutedUntil && new Date(c.mutedUntil).getTime() > now;
      return sum + (muted ? 0 : c.unreadCount || 0);
    }, 0);

    document.title = total > 0 ? `(${total > 99 ? '99+' : total}) ${BASE_TITLE}` : BASE_TITLE;
  }, [conversations]);

  // Restore the plain title when this unmounts (e.g. logout).
  useEffect(() => () => {
    document.title = BASE_TITLE;
  }, []);
};
