import { useState, useEffect } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { messagesApi } from '../api/messages.api';
import type { Message } from '../types/chat.types';

/**
 * Cross-conversation global message search with 300ms debounce.
 * Used by the sidebar global search to find messages across all chats.
 */
export const useGlobalSearch = (query: string) => {
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

  const result = useInfiniteQuery({
    queryKey: ['global-message-search', debouncedQuery],
    queryFn: ({ pageParam }) => messagesApi.globalSearch(debouncedQuery, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
    enabled: debouncedQuery.length > 1,
  });

  const messages: Message[] = result.data ? result.data.pages.flatMap((p) => p.messages) : [];

  return { ...result, messages, debouncedQuery };
};
