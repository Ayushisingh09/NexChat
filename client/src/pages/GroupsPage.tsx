import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { conversationsApi, type PublicGroup } from '../api/conversations.api';
import { useConversationStore } from '../store/conversation.store';
import { Avatar } from '../components/layout/Avatar';
import { MobileNav } from '../components/layout/MobileNav';
import { TopBar } from '../components/layout/TopBar';
import { Search, Users, Loader2, ChevronDown, X, Check } from 'lucide-react';

export const GroupsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['public-groups', searchQuery, page],
    queryFn: () => conversationsApi.publicGroups({ search: searchQuery || undefined, page, limit: 20 }),
    placeholderData: (prev) => prev,
  });

  const joinMutation = useMutation({
    mutationFn: (conversationId: string) => conversationsApi.joinGroup(conversationId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['public-groups'] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      if (!result.requiresApproval && result.conversationId) {
        navigate('/chat');
      }
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    setPage(1);
  };

  const groups = data?.groups || [];
  const pagination = data?.pagination;
  const totalPages = pagination?.pages || 1;

  return (
    <div className="min-h-screen bg-wa-chat text-wa-primary">
      <div className="sticky top-0 z-10 bg-wa-sidebar border-b border-wa-border">
        <TopBar
          title="Groups"
          onBack={() => navigate(-1)}
          backIcon="chevron"
        />

        <form onSubmit={handleSearch} className="px-4 pb-3">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-wa-secondary group-focus-within:text-wa-accent transition-colors" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search public groups..."
              className="w-full bg-wa-surface rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-wa-accent/60 border border-white/[0.06] transition-all"
            />
            {searchInput && (
              <button type="button" onClick={() => { setSearchInput(''); setSearchQuery(''); setPage(1); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-white/10 transition">
                <X className="w-3.5 h-3.5 text-wa-secondary" />
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {isError && (
          <div className="text-center py-16 text-wa-secondary">
            <p className="text-sm font-semibold mb-1">Failed to load groups</p>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ['public-groups'] })} className="px-4 py-2 bg-wa-accent/20 text-wa-accent rounded-lg text-xs font-semibold hover:bg-wa-accent/30 transition mt-2">Try again</button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-wa-accent" /></div>
        ) : groups.length === 0 ? (
          <div className="text-center py-16 text-wa-secondary">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-wa-surface flex items-center justify-center">
              <Users className="w-7 h-7 text-wa-secondary/40" />
            </div>
            <p className="text-sm font-semibold mb-1">{searchQuery ? 'No groups found' : 'No public groups yet'}</p>
            <p className="text-xs text-wa-secondary/60">{searchQuery ? 'Try a different search' : 'Groups will appear here when created'}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {groups.map((group) => (
              <GroupCard
                key={group.id}
                group={group}
                onJoin={() => joinMutation.mutate(group.id)}
                isJoining={joinMutation.isPending}
                onClick={() => {
                  if (group.isMember) {
                    useConversationStore.getState().setActiveConversation({
                      id: group.id,
                      type: 'GROUP',
                      name: group.name,
                      avatar: group.avatar,
                      participants: [],
                      unreadCount: 0,
                      updatedAt: new Date().toISOString(),
                      isPublic: group.isPublic,
                      requiresApproval: group.requiresApproval,
                      isAnnouncementMode: group.isAnnouncementMode,
                    } as any);
                    navigate('/chat');
                  }
                }}
              />
            ))}

            {page < totalPages && (
              <button type="button" onClick={() => setPage((p) => p + 1)} className="w-full mt-4 py-3 text-xs font-semibold text-wa-accent hover:bg-white/5 rounded-xl transition flex items-center justify-center gap-2 border border-dashed border-white/10">
                <ChevronDown className="w-3.5 h-3.5" />
                Load more ({pagination ? pagination.total - groups.length : 0} remaining)
              </button>
            )}
          </div>
        )}
      </div>
      <MobileNav />
    </div>
  );
};

const GroupCard: React.FC<{
  group: PublicGroup;
  onJoin: () => void;
  isJoining: boolean;
  onClick: () => void;
}> = ({ group, onJoin, isJoining, onClick }) => (
  <div
    onClick={group.isMember ? onClick : undefined}
    className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
      group.isMember
        ? 'bg-wa-surface/50 border-white/[0.06] cursor-pointer hover:bg-wa-surface'
        : 'bg-wa-sidebar border-white/[0.04] hover:border-wa-accent/30'
    }`}
  >
    <Avatar src={group.avatar} name={group.name || ''} size="md" className="ring-1 ring-white/10" />
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <p className="text-sm font-semibold truncate">{group.name || 'Unnamed Group'}</p>
        {group.isAnnouncementMode && <span className="text-[9px] px-1.5 py-0.5 bg-wa-accent/10 text-wa-accent rounded font-bold uppercase">Announcement</span>}
      </div>
      {group.description && <p className="text-xs text-wa-secondary truncate mt-0.5">{group.description}</p>}
      <div className="flex items-center gap-2 mt-1 text-[11px] text-wa-secondary">
        <span className="flex items-center gap-1"><Users className="w-3 h-3" />{group.memberCount} members</span>
        {group.requiresApproval && <span className="text-wa-accent/70">• Requires approval</span>}
      </div>
    </div>
    <div className="shrink-0">
      {group.isMember ? (
        <span className="flex items-center gap-1 px-3 py-1.5 bg-wa-accent/10 text-wa-accent rounded-lg text-xs font-semibold">
          <Check className="w-3 h-3" /> Joined
        </span>
      ) : (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onJoin(); }}
          disabled={isJoining}
          className="px-3 py-1.5 bg-wa-accent text-white rounded-lg text-xs font-semibold hover:bg-emerald-600 transition disabled:opacity-50"
        >
          {isJoining ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Join'}
        </button>
      )}
    </div>
  </div>
);

export default GroupsPage;
