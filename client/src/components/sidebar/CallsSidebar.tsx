import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useAuthStore } from '../../store/auth.store';
import { useCallHistory } from '../../hooks/useCallHistory';
import { Avatar } from '../layout/Avatar';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Loader2, Search, Star, Trash2, X, MoreVertical, UserPlus, Video,
} from 'lucide-react';
import {
  getFavorites, toggleFavorite,
  getHiddenCalls, hideCall,
} from '../../utils/callPrefs';
import { useUiStore } from '../../store/ui.store';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatCallTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'short' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getDateSection(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' });
  return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
}

interface CallsSidebarProps {
  filter: 'all' | 'incoming' | 'outgoing' | 'missed';
  onFilterChange: (f: 'all' | 'incoming' | 'outgoing' | 'missed') => void;
  onSelectCall: (call: any) => void;
  onCallUser: (userId: string, displayName: string | null, avatar: string | null, isVideo?: boolean) => void;
  selectedCallId?: string;
}

const SENTINEL_ID = 'call-list-sentinel';

export const CallsSidebar: React.FC<CallsSidebarProps> = ({
  filter,
  onFilterChange,
  onSelectCall,
  onCallUser,
  selectedCallId,
}) => {
  const currentUser = useAuthStore((s) => s.user);
  const { data: calls = [], fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } = useCallHistory();
  const setCallPickerOpen = useUiStore((s) => s.setCallPickerOpen);
  const [searchQuery, setSearchQuery] = useState('');
  const [hiddenCalls, setHiddenCalls] = useState<string[]>(() => getHiddenCalls());
  const [favs, setFavs] = useState<string[]>(() => getFavorites());
  const [contextMenu, setContextMenu] = useState<{ callId: string; x: number; y: number } | null>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Infinite scroll via IntersectionObserver ──
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const getOtherUser = useCallback((call: any) => {
    return call.callerId === currentUser?.id ? call.callee : call.caller;
  }, [currentUser]);

  const getCallDirection = useCallback((call: any) => {
    return call.callerId === currentUser?.id ? 'outgoing' : 'incoming';
  }, [currentUser]);

  const visibleCalls = useMemo(() => {
    let result = calls.filter((c: any) => !hiddenCalls.includes(c.id));

    if (filter === 'incoming') result = result.filter((c: any) => c.calleeId === currentUser?.id);
    else if (filter === 'outgoing') result = result.filter((c: any) => c.callerId === currentUser?.id);
    else if (filter === 'missed') result = result.filter((c: any) => c.status === 'MISSED' && c.calleeId === currentUser?.id);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c: any) => {
        const other = getOtherUser(c);
        return other.displayName?.toLowerCase().includes(q);
      });
    }

    return result;
  }, [calls, hiddenCalls, filter, searchQuery, currentUser, getOtherUser]);

  const groupedCalls = useMemo(() => {
    const groups: { label: string; calls: typeof visibleCalls }[] = [];
    let lastLabel = '';
    for (const call of visibleCalls) {
      const label = getDateSection(call.createdAt);
      if (label !== lastLabel) {
        groups.push({ label, calls: [] });
        lastLabel = label;
      }
      groups[groups.length - 1].calls.push(call);
    }
    return groups;
  }, [visibleCalls]);

  const favoriteUsers = useMemo(() => {
    if (favs.length === 0) return [];
    const seen = new Set<string>();
    const users: { id: string; displayName: string | null; avatar: string | null }[] = [];
    for (const call of calls) {
      const other = getOtherUser(call);
      if (favs.includes(other.id) && !seen.has(other.id)) {
        seen.add(other.id);
        users.push({ id: other.id, displayName: other.displayName, avatar: other.avatar });
      }
    }
    return users;
  }, [calls, favs, getOtherUser]);

  const handleToggleFavorite = useCallback((userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = toggleFavorite(userId);
    setFavs(next);
  }, []);

  const handleHideCall = useCallback((callId: string) => {
    const next = hideCall(callId);
    setHiddenCalls(next);
    setContextMenu(null);
  }, []);

  const handleClearHistory = useCallback(() => {
    const allIds = calls.map((c: any) => c.id);
    setHiddenCalls((prev: string[]) => [...prev, ...allIds]);
    setContextMenu(null);
  }, [calls]);

  const handleContextMenu = useCallback((e: React.MouseEvent, callId: string) => {
    e.preventDefault();
    setContextMenu({ callId, x: e.clientX, y: e.clientY });
  }, []);

  const getStatusText = (call: any) => {
    const videoTag = call.isVideo ? ' · Video' : '';
    if (call.status === 'MISSED') return 'Missed' + videoTag;
    if (call.status === 'REJECTED') return 'Declined' + videoTag;
    if (call.status === 'ENDED' && call.duration) return formatDuration(call.duration) + videoTag;
    return (getCallDirection(call) === 'outgoing' ? 'Outgoing' : 'Incoming') + videoTag;
  };

  return (
    <div className="flex flex-col h-full bg-[#0d0d11]/80 text-wa-primary border-r border-white/[0.06]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 h-[64px] shrink-0">
        <h1 className="text-lg font-bold text-white tracking-tight">Calls</h1>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCallPickerOpen(true)}
            className="p-2 text-zinc-400 hover:text-emerald-400 hover:bg-white/[0.06] rounded-xl transition-colors"
            title="Call anyone"
          >
            <UserPlus className="w-4 h-4" />
          </button>
          {calls.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="p-2 text-zinc-400 hover:text-red-400 hover:bg-white/[0.06] rounded-xl transition-colors"
              title="Clear call history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="px-4 pb-2 shrink-0">
        <div className="relative flex items-center bg-white/[0.04] rounded-xl px-3 py-2 ring-1 ring-transparent focus-within:ring-emerald-500/30 transition-shadow">
          <Search className="w-4 h-4 text-zinc-500 mr-2.5 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search calls"
            className="bg-transparent border-none text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none w-full"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} className="ml-1 p-0.5 hover:bg-white/[0.06] rounded-full transition-colors">
              <X className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          )}
        </div>
      </div>

      {/* Favorites quick-dial strip */}
      {favoriteUsers.length > 0 && (
        <div className="px-5 pb-2 shrink-0">
          <div className="flex items-center gap-1.5 mb-2">
            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Favorites</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {favoriteUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => onCallUser(user.id, user.displayName, user.avatar)}
                className="flex flex-col items-center gap-1 min-w-[52px] group"
              >
                <div className="relative ring-2 ring-transparent group-hover:ring-emerald-500/40 rounded-full transition-all duration-200">
                  <Avatar src={user.avatar} name={user.displayName} size="sm" className="w-10 h-10" />
                </div>
                <span className="text-[10px] text-zinc-400 truncate w-full text-center group-hover:text-zinc-200 transition-colors">{user.displayName}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex px-4 pb-3 gap-1.5 shrink-0">
        {(['all', 'incoming', 'outgoing', 'missed'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onFilterChange(f)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-all ${
              filter === f
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.04]'
            }`}
          >
            {f === 'all' ? 'All' : f === 'missed' ? 'Missed' : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Call list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-zinc-500 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading calls...</span>
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-red-400" />
            </div>
            <p className="text-sm font-semibold text-zinc-100 mb-1">Failed to load calls</p>
            <p className="text-xs text-zinc-500">Try again later</p>
          </div>
        ) : visibleCalls.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-zinc-500" />
            </div>
            <p className="text-sm font-semibold text-zinc-100 mb-1">
              {searchQuery ? 'No matching calls' : 'No calls yet'}
            </p>
            <p className="text-xs text-zinc-500">
              {searchQuery ? 'Try a different search' : filter === 'missed' ? 'No missed calls' : ''}
            </p>
          </div>
        ) : (
          <div>
            {groupedCalls.map((group) => (
              <div key={group.label}>
                <div className="px-5 py-2 sticky top-0 bg-[#0d0d11] z-10">
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-zinc-500">
                    {group.label}
                  </span>
                </div>
                <div className="space-y-0.5 px-2">
                  {group.calls.map((call: any) => {
                    const other = getOtherUser(call);
                    const missed = call.status === 'MISSED' && getCallDirection(call) === 'incoming';
                    const timeStr = formatCallTime(call.createdAt);
                    const isSelected = selectedCallId === call.id;
                    const isFav = favs.includes(other.id);

                    return (
                      <div
                        key={call.id}
                        onClick={() => onSelectCall(call)}
                        onContextMenu={(e) => handleContextMenu(e, call.id)}
                        className={`flex items-center gap-3 px-3 py-3 rounded-xl cursor-pointer transition-all group ${
                          isSelected
                            ? 'bg-emerald-500/8 ring-1 ring-emerald-500/20'
                            : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="relative shrink-0">
                          <Avatar src={other.avatar} name={other.displayName} size="md" />
                          <span className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center ring-[2px] ring-[#0d0d11] ${
                            missed ? 'bg-red-500' : 'bg-emerald-500'
                          }`}>
                            {missed ? (
                              <PhoneMissed className="w-2 h-2 text-white" />
                            ) : getCallDirection(call) === 'outgoing' ? (
                              <PhoneOutgoing className="w-2 h-2 text-white" />
                            ) : (
                              <PhoneIncoming className="w-2 h-2 text-white" />
                            )}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm font-semibold truncate ${
                              missed ? 'text-red-400' : 'text-zinc-100'
                            }`}>
                              {other.displayName}
                            </span>
                            {isFav && <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[11px] ${missed ? 'text-red-400' : 'text-zinc-500'}`}>
                              {getStatusText(call)}
                            </span>
                            <span className="text-[10px] text-zinc-600">·</span>
                            <span className="text-[10px] text-zinc-600">{timeStr}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={(e) => handleToggleFavorite(other.id, e)}
                            className={`p-1.5 rounded-lg transition-all ${
                              isFav
                                ? 'text-amber-400'
                                : 'text-zinc-500 hover:text-amber-400 hover:bg-white/[0.06]'
                            }`}
                            title={isFav ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            <Star className="w-3.5 h-3.5" fill={isFav ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onCallUser(other.id, other.displayName, other.avatar, call.isVideo);
                            }}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-emerald-400 hover:bg-white/[0.06] transition-all"
                            title={call.isVideo ? 'Video call back' : 'Call back'}
                          >
                            {call.isVideo ? <Video className="w-3.5 h-3.5" /> : <Phone className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleContextMenu(e, call.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.06] transition-all"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {/* Infinite scroll sentinel */}
            <div ref={sentinelRef} id={SENTINEL_ID} className="h-4" />
            {isFetchingNextPage && (
              <div className="flex items-center justify-center py-4 text-zinc-500 text-xs gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading more...
              </div>
            )}
            {!hasNextPage && calls.length > 0 && (
              <div className="py-4 text-center text-[10px] text-zinc-600">All caught up</div>
            )}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            ref={contextRef}
            className="fixed z-50 bg-[#18181b] border border-white/[0.08] rounded-xl shadow-pop py-1.5 min-w-[160px] animate-scale-in"
            style={{ top: contextMenu.y, left: contextMenu.x }}
          >
            {(() => {
              const call = calls.find((c: any) => c.id === contextMenu.callId);
              const other = call ? getOtherUser(call) : null;
              return (
                <>
                  {other && (
                    <button
                      type="button"
                      onClick={() => {
                        handleToggleFavorite(other.id, new MouseEvent('click') as any);
                        setContextMenu(null);
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-zinc-200 hover:bg-white/[0.06] flex items-center gap-2"
                    >
                      <Star className="w-3.5 h-3.5 text-amber-400" />
                      {favs.includes(other.id) ? 'Remove from favorites' : 'Add to favorites'}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleHideCall(contextMenu.callId)}
                    className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete from history
                  </button>
                </>
              );
            })()}
          </div>
        </>
      )}
    </div>
  );
};
