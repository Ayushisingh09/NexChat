import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { friendsApi, type Friend } from '../api/friends.api';
import { usersApi } from '../api/users.api';
import { useAuthStore } from '../store/auth.store';
import { conversationsApi } from '../api/conversations.api';
import { ListItem } from '../components/layout/ListItem';
import { MobileNav } from '../components/layout/MobileNav';
import { TopBar } from '../components/layout/TopBar';
import {
  X, Check, Loader2, Search, MessageCircle, Trash2, Send, Users, UserCheck, Clock, UserPlus, UserRoundPlus,
} from 'lucide-react';

const PAGE_SIZE = 20;

type FriendsTab = 'all' | 'received' | 'sent' | 'add';

const FriendsPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<FriendsTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);
  const [addUsername, setAddUsername] = useState('');
  const [addResult, setAddResult] = useState<{ id: string; displayName: string | null; avatar: string | null } | null>(null);
  const [addError, setAddError] = useState('');

  const { data: friendsData = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends-with-presence'],
    queryFn: () => friendsApi.listWithPresence(),
    refetchInterval: 60_000,
  });

  const { data: receivedData = [], isLoading: receivedLoading } = useQuery({
    queryKey: ['friend-requests-received'],
    queryFn: () => friendsApi.pendingReceived(),
    refetchInterval: 30_000,
  });

  const { data: sentData = [], isLoading: sentLoading } = useQuery({
    queryKey: ['friend-requests-sent'],
    queryFn: () => friendsApi.pendingSent(),
    refetchInterval: 30_000,
  });

  const removeMutation = useMutation({
    mutationFn: (friendId: string) => friendsApi.removeFriend(friendId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friends-with-presence'] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => friendsApi.acceptRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-received'] });
      queryClient.invalidateQueries({ queryKey: ['friends-with-presence'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (requestId: string) => friendsApi.rejectRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-received'] });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: (requestId: string) => friendsApi.cancelRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
    },
  });

  const sendRequestMutation = useMutation({
    mutationFn: (userId: string) => friendsApi.sendRequest(userId),
    onSuccess: () => {
      setAddResult(null);
      setAddUsername('');
      setAddError('');
      queryClient.invalidateQueries({ queryKey: ['friend-requests-sent'] });
    },
    onError: (err: any) => {
      setAddError(err.response?.data?.message || 'Failed to send request');
    },
  });

  const startChat = async (friend: Friend) => {
    try {
      const conv = await conversationsApi.create({
        participantIds: [friend.id],
        type: 'DIRECT',
      });
      navigate('/chat');
      setTimeout(() => {
        const { useConversationStore } = require('../store/conversation.store');
        useConversationStore.getState().setActiveConversation(conv);
      }, 100);
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friendsData;
    const q = searchQuery.toLowerCase();
    return friendsData.filter(
      (f) =>
        f.displayName?.toLowerCase().includes(q) ||
        f.username?.toLowerCase().includes(q),
    );
  }, [friendsData, searchQuery]);

  const paginatedFriends = useMemo(() => {
    const end = (page + 1) * PAGE_SIZE;
    return filteredFriends.slice(0, end);
  }, [filteredFriends, page]);

  const hasMore = paginatedFriends.length < filteredFriends.length;

  const lookupUser = async () => {
    if (!addUsername.trim()) return;
    setAddError('');
    setAddResult(null);
    try {
      const users = await usersApi.search(addUsername.trim());
      if (users.length === 0) {
        setAddError('No user found');
        return;
      }
      const u = users[0] as { id: string; displayName: string | null; avatar: string | null };
      const alreadyFriend = friendsData.some((f) => f.id === u.id);
      if (alreadyFriend) {
        setAddError('Already friends');
        return;
      }
      if (u.id === currentUser?.id) {
        setAddError("That's you!");
        return;
      }
      setAddResult(u);
    } catch {
      setAddError('Search failed');
    }
  };

  const tabs: { key: FriendsTab; label: string; icon: React.ReactNode; count?: number }[] = [
    { key: 'all', label: 'Friends', icon: <Users className="w-4 h-4" />, count: friendsData.length },
    { key: 'received', label: 'Pending', icon: <UserCheck className="w-4 h-4" />, count: receivedData.length },
    { key: 'sent', label: 'Sent', icon: <Send className="w-4 h-4" />, count: sentData.length },
    { key: 'add', label: 'Add Friend', icon: <UserPlus className="w-4 h-4" /> },
  ];

  const renderSkeleton = () => (
    <div className="space-y-2 pt-2">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/[0.03] animate-pulse">
          <div className="w-10 h-10 rounded-full bg-white/[0.06]" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-28 rounded bg-white/[0.06]" />
            <div className="h-2.5 w-20 rounded bg-white/[0.04]" />
          </div>
          <div className="flex gap-1.5">
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
            <div className="w-8 h-8 rounded-lg bg-white/[0.06]" />
          </div>
        </div>
      ))}
    </div>
  );

  const renderEmptyState = (icon: React.ReactNode, title: string, subtitle?: string) => (
    <div className="flex flex-col items-center justify-center py-20 text-wa-secondary">
      <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
        {icon}
      </div>
      <p className="text-sm font-medium text-wa-primary">{title}</p>
      {subtitle && <p className="text-xs mt-1.5 text-wa-secondary/70">{subtitle}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-wa-chat text-white flex flex-col">
      <TopBar title="Friends" onBack={() => navigate('/chat')} className="shrink-0" />

      {/* Tabs */}
      <div className="flex gap-1.5 px-4 pt-3 pb-1 overflow-x-auto shrink-0">
        {tabs.map((t) => {
          const isActive = tab === t.key;
          const hasBadge = t.count !== undefined && t.count > 0;
          return (
            <button type="button"
              key={t.key}
              onClick={() => { setTab(t.key); setPage(0); }}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-wa-accent/20 text-wa-accent border border-wa-accent/45 shadow-glow'
                  : 'bg-wa-sidebar/60 text-wa-secondary border border-transparent hover:text-wa-primary hover:bg-white/[0.04]'
              }`}
            >
              {t.icon} {t.label}
              {hasBadge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none ${
                  isActive
                    ? 'bg-wa-accent/40 text-wa-accent'
                    : 'bg-wa-accent/25 text-wa-accent/90'
                }`}>
                  {t.count! > 99 ? '99+' : t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 md:pb-4">
        {tab === 'all' && (
          <div className="space-y-3 pt-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-secondary/60" />
              <input
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
                placeholder="Search friends..."
                className="w-full bg-wa-sidebar/70 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-wa-accent/40 border border-white/[0.06] placeholder:text-wa-secondary/40"
              />
            </div>

            {friendsLoading ? renderSkeleton() : paginatedFriends.length === 0 ? (
              renderEmptyState(
                <Users className="w-6 h-6 text-wa-secondary/60" />,
                searchQuery ? 'No friends match your search' : 'No friends yet',
                searchQuery ? 'Try a different name' : 'Find people using the Add Friend tab',
              )
            ) : (
              <div className="space-y-1">
                {paginatedFriends.map((friend) => {
                  const isRemoving = removeMutation.isPending && removeMutation.variables === friend.id;
                  return (
                    <ListItem
                      key={friend.id}
                      className="glass rounded-xl px-4 py-3 border border-white/[0.06] hover:border-white/[0.12] transition-all"
                      avatar={{ src: friend.avatar, name: friend.displayName }}
                      primaryText={friend.displayName || 'Unknown'}
                      secondaryText={friend.username ? `@${friend.username}` : undefined}
                      indicator={
                        <div className="flex items-center gap-1.5">
                          {(friend as any).isOnline ? (
                            <span className="relative flex w-2.5 h-2.5">
                              <span className="absolute inset-0 rounded-full bg-green-500 animate-ping opacity-30" />
                              <span className="relative w-2.5 h-2.5 rounded-full bg-green-500" />
                            </span>
                          ) : (
                            <span className="w-2 h-2 rounded-full bg-white/[0.12]" />
                          )}
                        </div>
                      }
                      actions={
                        <div className="flex items-center gap-1">
                          <button type="button"
                            onClick={() => startChat(friend)}
                            className="p-2 text-wa-secondary/70 hover:text-wa-accent hover:bg-wa-accent/10 rounded-lg transition-all"
                            title="Start chat"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button type="button"
                            onClick={() => removeMutation.mutate(friend.id)}
                            disabled={isRemoving}
                            className="p-2 text-wa-secondary/70 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50"
                            title="Remove friend"
                          >
                            {isRemoving
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Trash2 className="w-4 h-4" />}
                          </button>
                        </div>
                      }
                    />
                  );
                })}
                {hasMore && (
                  <button type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="w-full py-3 text-sm font-semibold text-wa-accent hover:text-wa-accent/80 transition-colors"
                  >
                    Load more ({filteredFriends.length - paginatedFriends.length} remaining)
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'received' && (
          <div className="pt-3">
            {receivedLoading ? renderSkeleton() : receivedData.length === 0 ? (
              renderEmptyState(
                <UserRoundPlus className="w-6 h-6 text-wa-secondary/60" />,
                'No pending requests',
                'Friend requests from other users will appear here',
              )
            ) : (
              <div className="space-y-1.5">
                {receivedData.map((req) => {
                  const isAccepting = acceptMutation.isPending && acceptMutation.variables === req.id;
                  const isRejecting = rejectMutation.isPending && rejectMutation.variables === req.id;
                  return (
                    <div
                      key={req.id}
                      className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] hover:border-white/[0.12] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-wa-accent/30 to-wa-accent/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {req.sender.avatar ? (
                            <img src={req.sender.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <UserRoundPlus className="w-5 h-5 text-wa-accent/70" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-wa-primary truncate">
                            {req.sender.displayName || 'Unknown'}
                          </p>
                          <p className="text-xs text-wa-secondary/70 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {new Date(req.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button type="button"
                            onClick={() => acceptMutation.mutate(req.id)}
                            disabled={isAccepting || isRejecting}
                            className="p-2 bg-wa-green/15 text-wa-green rounded-xl hover:bg-wa-green/25 transition-all disabled:opacity-50"
                            title="Accept"
                          >
                            {isAccepting
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <Check className="w-4 h-4" />}
                          </button>
                          <button type="button"
                            onClick={() => rejectMutation.mutate(req.id)}
                            disabled={isAccepting || isRejecting}
                            className="p-2 bg-red-500/10 text-red-400 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                            title="Reject"
                          >
                            {isRejecting
                              ? <Loader2 className="w-4 h-4 animate-spin" />
                              : <X className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'sent' && (
          <div className="pt-3">
            {sentLoading ? renderSkeleton() : sentData.length === 0 ? (
              renderEmptyState(
                <Send className="w-6 h-6 text-wa-secondary/60" />,
                'No sent requests',
                'Requests you send will appear here',
              )
            ) : (
              <div className="space-y-1.5">
                {sentData.map((req) => {
                  const target = req.receiver;
                  const isCancelling = cancelMutation.isPending && cancelMutation.variables === req.id;
                  return (
                    <div
                      key={req.id}
                      className="glass rounded-xl px-4 py-3.5 border border-white/[0.06] hover:border-white/[0.12] transition-all"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500/30 to-amber-500/10 flex items-center justify-center shrink-0 overflow-hidden">
                          {target?.avatar ? (
                            <img src={target.avatar} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Send className="w-5 h-5 text-amber-400/70" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-wa-primary truncate">
                            {target?.displayName || 'Unknown'}
                          </p>
                          <p className="text-xs text-wa-secondary/70 flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            Sent {new Date(req.createdAt).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <button type="button"
                          onClick={() => cancelMutation.mutate(req.id)}
                          disabled={isCancelling}
                          className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-400 bg-red-500/10 rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50"
                          title="Cancel request"
                        >
                          {isCancelling
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <X className="w-3.5 h-3.5" />}
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'add' && (
          <div className="pt-3 max-w-lg mx-auto w-full space-y-4">
            <div className="glass rounded-xl p-5 border border-white/[0.06]">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-wa-accent/15 flex items-center justify-center">
                  <Search className="w-4 h-4 text-wa-accent" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-wa-primary">Find by Username</h3>
                  <p className="text-xs text-wa-secondary/70">Search for someone to add</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  value={addUsername}
                  onChange={(e) => setAddUsername(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && lookupUser()}
                  placeholder="Enter username..."
                  className="flex-1 bg-wa-sidebar/70 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-wa-accent/40 border border-white/[0.06] placeholder:text-wa-secondary/40"
                />
                <button type="button"
                  onClick={lookupUser}
                  className="px-4 py-2.5 bg-wa-accent text-white text-sm font-bold rounded-xl hover:brightness-110 transition-all active:scale-95"
                >
                  Search
                </button>
              </div>

              {addError && (
                <div className="flex items-center gap-1.5 mt-3 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <X className="w-3 h-3 text-red-400 shrink-0" />
                  <p className="text-xs text-red-400">{addError}</p>
                </div>
              )}

              {addResult && (
                <div className="mt-4 p-3 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-gradient-to-br from-wa-accent/30 to-wa-accent/10 shrink-0">
                      {addResult.avatar ? (
                        <img src={addResult.avatar} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <UserPlus className="w-5 h-5 text-wa-accent/70" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-wa-primary truncate">
                        {addResult.displayName || 'Unknown'}
                      </p>
                    </div>
                    <button type="button"
                      onClick={() => sendRequestMutation.mutate(addResult.id)}
                      disabled={sendRequestMutation.isPending}
                      className="flex items-center gap-1.5 px-4 py-2 bg-wa-accent text-white text-xs font-bold rounded-xl hover:brightness-110 transition-all disabled:opacity-50 active:scale-95"
                    >
                      {sendRequestMutation.isPending ? (
                        <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending</>
                      ) : (
                        <><UserPlus className="w-3.5 h-3.5" /> Add Friend</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <MobileNav />
    </div>
  );
};

export default FriendsPage;
