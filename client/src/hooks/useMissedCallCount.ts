import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { CALL_HISTORY_KEY } from './useCallHistory';
import type { CallRecord } from '../api/calls.api';

export function useMissedCallCount() {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const data = queryClient.getQueryData(CALL_HISTORY_KEY) as
    | { pages: { calls: CallRecord[] }[] }
    | undefined;
  const calls: CallRecord[] = data?.pages?.flatMap((p) => p.calls) ?? [];
  return calls.filter(
    (c) => c.status === 'MISSED' && c.calleeId === currentUser?.id
  ).length;
}
