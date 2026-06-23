import { useQuery } from '@tanstack/react-query';
import { friendsApi } from '../api/friends.api';

export function usePendingFriendRequestCount(): number {
  const { data } = useQuery({
    queryKey: ['friend-requests-received'],
    queryFn: () => friendsApi.pendingReceived(),
    refetchInterval: 30_000,
    staleTime: 1000 * 25,
    refetchOnWindowFocus: false,
  });
  return data?.length ?? 0;
}
