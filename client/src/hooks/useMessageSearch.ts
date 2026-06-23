import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { messagesApi } from '../api/messages.api';

export const useMessageSearch = (conversationId: string | undefined, query: string) => {
  const trimmed = query.trim();
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    if (!trimmed) {
      setDebouncedQuery('');
      return;
    }
    const timer = setTimeout(() => setDebouncedQuery(trimmed), 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const { data: allMessages = [], isLoading } = useQuery({
    queryKey: ['messages-search-history', conversationId],
    queryFn: async () => {
      const res = await messagesApi.list(conversationId!, undefined, 1000);
      return res.messages;
    },
    enabled: !!conversationId,
    staleTime: 10000,
  });

  const matches = useMemo(() => {
    if (!debouncedQuery) return [];
    const lowerQuery = debouncedQuery.toLowerCase();

    return allMessages.filter((m) => {
      let textToSearch = '';
      if (m.type === 'TEXT') {
        textToSearch = m.content || '';
      } else if (m.type === 'IMAGE') {
        textToSearch = '📷 photo';
      } else if (m.type === 'AUDIO') {
        textToSearch = '🎵 voice message';
      } else if (m.type === 'VIDEO') {
        textToSearch = '🎥 video';
      } else {
        textToSearch = m.content || '';
      }

      const senderName = m.sender?.displayName || '';
      return (
        textToSearch.toLowerCase().includes(lowerQuery) ||
        senderName.toLowerCase().includes(lowerQuery)
      );
    });
  }, [debouncedQuery, allMessages]);

  return {
    matches,
    isLoading,
    isFetching: false,
    hasNextPage: false,
    fetchNextPage: () => {},
    isFetchingNextPage: false,
    debouncedQuery,
  };
};
