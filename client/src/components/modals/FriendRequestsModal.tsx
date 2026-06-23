import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Check, X as XIcon, Send, UserPlus, Loader2 } from 'lucide-react';
import { friendsApi } from '../../api/friends.api';
import { usersApi } from '../../api/users.api';
import { useUiStore } from '../../store/ui.store';
import { Avatar } from '../layout/Avatar';
import { showToast } from '../layout/ToastHost';

export const FriendRequestsModal: React.FC = () => {
  const isOpen = useUiStore((state) => state.isFriendRequestsOpen);
  const setOpen = useUiStore((state) => state.setFriendRequestsOpen);
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const [searchUsername, setSearchUsername] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<{ id: string; displayName: string | null; avatar?: string | null } | null>(null);
  const [sending, setSending] = useState(false);

  const { data: received = [], isLoading: loadingReceived } = useQuery({
    queryKey: ['friends', 'pending', 'received'],
    queryFn: friendsApi.pendingReceived,
    enabled: isOpen,
  });

  const { data: sent = [], isLoading: loadingSent } = useQuery({
    queryKey: ['friends', 'pending', 'sent'],
    queryFn: friendsApi.pendingSent,
    enabled: isOpen,
  });

  const handleSearch = async () => {
    if (!searchUsername.trim()) return;
    setSearching(true);
    setSearchResult(null);
    try {
      const user = await usersApi.getByUsername(searchUsername.trim());
      setSearchResult(user);
    } catch {
      showToast('User not found');
    } finally {
      setSearching(false);
    }
  };

  const handleSendRequest = async (userId: string) => {
    setSending(true);
    try {
      await friendsApi.sendRequest(userId);
      showToast('Friend request sent!');
      setSearchUsername('');
      setSearchResult(null);
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to send request');
    } finally {
      setSending(false);
    }
  };

  const handleAccept = async (requestId: string) => {
    try {
      await friendsApi.acceptRequest(requestId);
      showToast('Friend request accepted!');
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to accept');
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await friendsApi.rejectRequest(requestId);
      showToast('Request rejected');
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to reject');
    }
  };

  const handleCancel = async (requestId: string) => {
    try {
      await friendsApi.cancelRequest(requestId);
      showToast('Request cancelled');
      queryClient.invalidateQueries({ queryKey: ['friends', 'pending'] });
    } catch (err: any) {
      showToast(err?.response?.data?.message || 'Failed to cancel');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 select-none animate-fade-in" onClick={() => setOpen(false)}>
      <div
        className="w-full sm:max-w-md glass border border-white/10 rounded-2xl shadow-pop flex flex-col max-h-[88vh] sm:max-h-[85vh] animate-scale-in origin-bottom"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-wa-accent/15 text-wa-accent flex items-center justify-center">
              <UserPlus className="w-[18px] h-[18px]" />
            </span>
            <h2 className="text-[16px] font-bold text-white">Friends</h2>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="p-2 text-zinc-400 hover:text-white rounded-xl hover:bg-white/[0.06] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search section */}
        <div className="px-5 pt-4 pb-3 shrink-0">
          <div className="flex items-center gap-2 rounded-2xl bg-white/[0.04] border border-white/10 focus-within:border-emerald-500/50 px-2 pl-3.5 py-1.5 transition-colors">
            <input
              value={searchUsername}
              onChange={(e) => setSearchUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Add a friend by username…"
              className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
            />
            <button type="button"
              onClick={handleSearch}
              disabled={searching || !searchUsername.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-wa-accent hover:bg-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition active:scale-95"
            >
              {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Find
            </button>
          </div>
          {searchResult && (
            <div className="flex items-center justify-between mt-2.5 px-3 py-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.07] animate-slide-up">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar src={searchResult.avatar} name={searchResult.displayName} size="sm" />
                <span className="text-sm font-semibold text-white truncate">{searchResult.displayName}</span>
              </div>
              <button type="button"
                onClick={() => handleSendRequest(searchResult.id)}
                disabled={sending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-wa-accent bg-wa-accent/10 border border-emerald-500/40 rounded-xl hover:bg-wa-accent/20 transition shrink-0"
              >
                {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                Add
              </button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 px-5 pb-3 shrink-0">
          {(['received', 'sent'] as const).map((t) => (
            <button type="button"
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-2 rounded-xl text-[12.5px] font-semibold transition-all ${
                tab === t
                  ? 'bg-white/[0.08] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                  : 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-200'
              }`}
            >
              {t === 'received' ? 'Received' : 'Sent'}
              <span className={`ml-1.5 text-[11px] ${tab === t ? 'text-wa-accent' : 'text-zinc-600'}`}>
                {t === 'received' ? received.length : sent.length}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 min-h-[160px]">
          {tab === 'received' && (
            loadingReceived ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : received.length === 0 ? (
              <EmptyState text="No incoming requests" />
            ) : (
              received.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-white/[0.06] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={req.sender.avatar} name={req.sender.displayName} size="md" />
                    <span className="text-sm font-semibold text-white truncate">{req.sender.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button"
                      onClick={() => handleAccept(req.id)}
                      className="w-9 h-9 flex items-center justify-center text-wa-accent bg-wa-accent/10 hover:bg-wa-accent/20 rounded-xl transition active:scale-90"
                      title="Accept"
                    >
                      <Check className="w-[18px] h-[18px]" />
                    </button>
                    <button type="button"
                      onClick={() => handleReject(req.id)}
                      className="w-9 h-9 flex items-center justify-center text-red-400 bg-red-500/[0.08] hover:bg-red-500/20 rounded-xl transition active:scale-90"
                      title="Reject"
                    >
                      <XIcon className="w-[18px] h-[18px]" />
                    </button>
                  </div>
                </div>
              ))
            )
          )}
          {tab === 'sent' && (
            loadingSent ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>
            ) : sent.length === 0 ? (
              <EmptyState text="No sent requests" />
            ) : (
              sent.map((req) => (
                <div key={req.id} className="flex items-center justify-between px-3 py-2.5 rounded-2xl hover:bg-white/[0.06] transition">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar src={req.receiver?.avatar} name={req.receiver?.displayName} size="md" />
                    <span className="text-sm font-semibold text-white truncate">{req.receiver?.displayName}</span>
                  </div>
                  <button type="button"
                    onClick={() => handleCancel(req.id)}
                    className="px-3 py-1.5 text-xs font-semibold text-red-400 bg-red-500/[0.08] border border-red-500/25 rounded-xl hover:bg-red-500/20 transition shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ))
            )
          )}
        </div>
      </div>
    </div>
  );
};

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
    <span className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-zinc-600">
      <UserPlus className="w-5 h-5" />
    </span>
    <p className="text-[13px] text-zinc-500">{text}</p>
  </div>
);
