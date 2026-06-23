import { useEffect } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { callsApi, type CallRecord } from '../api/calls.api';
import { useSocketStore } from '../store/socket.store';

export const CALL_HISTORY_KEY = ['call-history'] as const;

export function useCallHistory() {
  const queryClient = useQueryClient();
  const socket = useSocketStore((s) => s.socket);

  const query = useInfiniteQuery({
    queryKey: CALL_HISTORY_KEY,
    queryFn: ({ pageParam }) => callsApi.history(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const allCalls: CallRecord[] = (query.data?.pages ?? []).flatMap((p) => p.calls);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: CALL_HISTORY_KEY });
    socket.on('call:ended', refresh);
    socket.on('call:missed', refresh);
    socket.on('call:rejected', refresh);
    return () => {
      socket.off('call:ended', refresh);
      socket.off('call:missed', refresh);
      socket.off('call:rejected', refresh);
    };
  }, [socket, queryClient]);

  return { ...query, data: allCalls, allCalls };
}
