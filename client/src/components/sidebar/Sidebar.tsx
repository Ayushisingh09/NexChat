import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore } from '../../store/ui.store';
import { useConversationStore } from '../../store/conversation.store';
import { authApi } from '../../api/auth.api';
import { SearchBar } from './SearchBar';
import { ConversationList } from './ConversationList';
import type { Conversation } from '../../types/chat.types';
import { MessageSquarePlus, Archive, ChevronDown, ChevronRight, Settings, UserCog, Link2, Check, LogOut, ChevronUp, UserRoundPlus } from 'lucide-react';
import { GlobalSearchResults } from './GlobalSearchResults';
import { Avatar } from '../layout/Avatar';
import { usePendingFriendRequestCount } from '../../hooks/usePendingFriendRequestCount';


interface SidebarProps {
  conversations: Conversation[];
  isLoading: boolean;
  isFetching?: boolean;
  error: any;
  onRetry: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  conversations,
  isLoading,
  isFetching = false,
  error,
  onRetry,
}) => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);

  const activeConversation = useConversationStore((state) => state.activeConversation);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);

  const setNewChatOpen = useUiStore((state) => state.setNewChatOpen);
  const setFriendRequestsOpen = useUiStore((state) => state.setFriendRequestsOpen);
  const pendingFriendCount = usePendingFriendRequestCount();

  const [searchQuery, setSearchQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [chatFilter, setChatFilter] = useState<'ALL' | 'DIRECT' | 'GROUP'>('ALL');

  // Profile config popover
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [profileMenuOpen]);

  const openSettings = () => {
    setProfileMenuOpen(false);
    navigate('/settings');
  };

  const copyProfileLink = async () => {
    const uname = (currentUser as any)?.username;
    if (!uname) { openSettings(); return; }
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/u/${uname}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* ignore */ }
  };

  const handleLogout = async () => {
    setProfileMenuOpen(false);
    try { if (refreshToken) await authApi.logout(refreshToken); } catch { /* ignore */ }
    clearAuth();
  };

  const handleSelectConversation = (conversation: Conversation) => {
    setActiveConversation(conversation);
    if (conversation.type === 'GROUP') {
      navigate(`/group/${conversation.id}`, { replace: true });
    } else if (conversation.type === 'DIRECT') {
      const other = conversation.participants?.find((p) => p.id !== currentUser?.id);
      if (other?.username) {
        navigate(`/dm/${other.username}`, { replace: true });
      } else {
        navigate('/chat', { replace: true });
      }
    } else {
      navigate('/chat', { replace: true });
    }
  };

  const activeConversations = useMemo(() => conversations.filter((c) => !c.archivedAt && (chatFilter === 'ALL' || c.type === chatFilter)), [conversations, chatFilter]);
  const archivedConversations = useMemo(() => conversations.filter((c) => c.archivedAt && (chatFilter === 'ALL' || c.type === chatFilter)), [conversations, chatFilter]);

  return (
    <div className="flex flex-col h-full bg-wa-sidebar/80 text-wa-primary glass border-r border-wa-border/50 pb-16 md:pb-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-3 h-[60px] glass border-b border-white/[0.06] shrink-0 select-none">
        <h1 className="text-[17px] font-bold text-white tracking-tight">Messages</h1>
        <div className="flex items-center gap-0.5">
          {/* Quick "add friend" — also available in the mobile bottom nav */}
          <button
            type="button"
            onClick={() => setFriendRequestsOpen(true)}
            title="Add Friend"
            aria-label="Add friend"
            className="relative p-2 text-wa-secondary hover:text-white hover:bg-wa-sidebar-hover rounded-full transition-all duration-150 active:scale-90"
          >
            <UserRoundPlus className="w-5 h-5" />
            {pendingFriendCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-wa-accent text-white text-[9px] font-bold shadow-glow">
                {pendingFriendCount > 99 ? '99+' : pendingFriendCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setNewChatOpen(true)}
            title="New Chat"
            aria-label="Start a new chat"
            className="p-2 text-wa-secondary hover:text-white hover:bg-wa-sidebar-hover rounded-full transition-all duration-150 active:scale-90"
          >
            <MessageSquarePlus className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <SearchBar onSearch={setSearchQuery} />

      {/* Filter Tabs */}
      {!searchQuery && (
        <div className="flex px-4 pb-2.5 pt-0.5 gap-2 shrink-0">
          {(['ALL', 'DIRECT', 'GROUP'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setChatFilter(filter)}
              className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-150 ${
                chatFilter === filter
                  ? 'bg-wa-green/20 text-wa-green border border-wa-green/45'
                  : 'bg-transparent text-wa-secondary border border-transparent hover:bg-wa-sidebar-hover hover:text-wa-primary'
              }`}
            >
              {filter === 'ALL' ? 'All' : filter === 'DIRECT' ? 'Direct' : 'Groups'}
            </button>
          ))}
        </div>
      )}

      {/* Conversation List or Global Search Results */}
      {searchQuery ? (
        <GlobalSearchResults
          query={searchQuery}
          onSelectConversation={setActiveConversation}
          onCloseSearch={() => setSearchQuery('')}
        />
      ) : (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Archived section header */}
          {archivedConversations.length > 0 && (
            <button
              type="button"
              onClick={() => setShowArchived((v) => !v)}
              className="flex items-center justify-between px-4 py-2.5 border-b border-wa-border/60 hover:bg-wa-sidebar-hover transition shrink-0 select-none"
            >
              <div className="flex items-center space-x-3 text-wa-secondary">
                <Archive className="w-4 h-4" />
                <span className="text-[13px] font-semibold">Archived</span>
                <span className="text-[11px] text-wa-secondary">{archivedConversations.length}</span>
              </div>
              {showArchived ? (
                <ChevronDown className="w-4 h-4 text-wa-secondary" />
              ) : (
                <ChevronRight className="w-4 h-4 text-wa-secondary" />
              )}
            </button>
          )}

          <ConversationList
            conversations={showArchived ? archivedConversations : activeConversations}
            activeId={activeConversation?.id}
            onSelect={handleSelectConversation}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={onRetry}
            searchQuery={searchQuery}
          />
        </div>
      )}

      {/* Profile Panel — click to open config popover */}
      <div ref={profileMenuRef} className="relative shrink-0 mt-auto">
        {/* Popover menu */}
        {profileMenuOpen && (
          <div className="absolute bottom-[calc(100%-2px)] left-2 right-2 mb-2 z-50 glass rounded-2xl shadow-pop border border-white/10 p-1.5 animate-scale-in origin-bottom">
            <div className="flex items-center gap-2.5 px-2.5 py-2 mb-1 border-b border-white/[0.06]">
              <Avatar src={currentUser?.avatar} name={currentUser?.displayName} size="sm" />
              <div className="flex flex-col min-w-0 leading-tight">
                <span className="text-[13px] font-semibold text-white truncate">{currentUser?.displayName}</span>
                <span className="text-[11px] text-wa-accent/80 truncate">@{(currentUser as any)?.username || 'user'}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={openSettings}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13px] text-zinc-200 hover:bg-white/[0.06] transition-colors"
            >
              <UserCog className="w-4 h-4 text-zinc-400" /> Profile &amp; Settings
            </button>
            <button
              type="button"
              onClick={copyProfileLink}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13px] text-zinc-200 hover:bg-white/[0.06] transition-colors"
            >
              {copied ? <Check className="w-4 h-4 text-wa-accent" /> : <Link2 className="w-4 h-4 text-zinc-400" />}
              {copied ? 'Link copied' : 'Copy profile link'}
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-2.5 py-2 rounded-xl text-[13px] text-red-400 hover:bg-red-500/[0.1] transition-colors"
            >
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
        )}

        {/* Bar */}
        <div className="h-14 bg-[#0d0d11] border-t border-white/[0.07] px-2 py-2 flex items-center gap-1 select-none">
          <button
            type="button"
            onClick={() => setProfileMenuOpen((v) => !v)}
            className={`flex-1 flex items-center gap-2.5 min-w-0 px-1.5 py-1.5 rounded-xl transition-colors ${
              profileMenuOpen ? 'bg-white/[0.06]' : 'hover:bg-white/[0.06]'
            }`}
            title="Account settings"
          >
            <div className="relative shrink-0">
              <Avatar src={currentUser?.avatar} name={currentUser?.displayName} size="sm" />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10b981] ring-2 ring-black/40" />
            </div>
            <div className="flex flex-col min-w-0 leading-tight text-left">
              <span className="text-xs font-semibold text-white truncate">{currentUser?.displayName}</span>
              <span className="text-[10px] text-zinc-500 truncate">@{(currentUser as any)?.username || 'user'}</span>
            </div>
            <ChevronUp className={`w-4 h-4 text-zinc-500 ml-auto shrink-0 transition-transform duration-200 ${profileMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openSettings}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg transition-all shrink-0"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
