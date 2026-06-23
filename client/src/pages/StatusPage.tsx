import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { storiesApi } from '../api/stories.api';
import { useAuthStore } from '../store/auth.store';
import { useUiStore } from '../store/ui.store';
import { Avatar } from '../components/layout/Avatar';
import { StoryRing } from '../components/stories/StoryRing';
import { StoryViewer } from '../components/stories/StoryViewer';
import { CreateStoryModal } from '../components/stories/CreateStoryModal';
import { MobileNav } from '../components/layout/MobileNav';
import { TopBar } from '../components/layout/TopBar';
import { orderStoryFeed } from '../utils/stories.utils';
import { Plus, ChevronLeft, Image } from 'lucide-react';

const formatTimeAgo = (date: Date) => {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const storyCountLabel = (n: number) => `${n} ${n === 1 ? 'update' : 'updates'}`;

function FeedSkeleton() {
  return (
    <div className="space-y-1">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-3 rounded-2xl">
          <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-28 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.06)' }} />
            <div className="h-2.5 w-20 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
          </div>
          <div className="w-12 h-4 rounded animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
        </div>
      ))}
    </div>
  );
}

const StatusPage: React.FC = () => {
  const navigate = useNavigate();
  const currentUser = useAuthStore((state) => state.user);
  const isCreateStoryOpen = useUiStore((state) => state.isCreateStoryOpen);
  const setCreateStoryOpen = useUiStore((state) => state.setCreateStoryOpen);

  const { data: feed = [], isLoading, isError } = useQuery({
    queryKey: ['stories'],
    queryFn: storiesApi.feed,
    refetchInterval: 60_000,
  });

  const orderedFeed = useMemo(() => orderStoryFeed(feed, currentUser?.id), [feed, currentUser?.id]);
  const myGroup = useMemo(() => orderedFeed.find((g) => g.userId === currentUser?.id), [orderedFeed, currentUser?.id]);
  const otherGroups = useMemo(() => orderedFeed.filter((g) => g.userId !== currentUser?.id), [orderedFeed, currentUser?.id]);

  // Build a userId→index map so we can look up the feed index in O(1) instead
  // of O(N) indexOf per item.
  const feedIndexByUser = useMemo(() => {
    const map = new Map<string, number>();
    orderedFeed.forEach((g, i) => map.set(g.userId, i));
    return map;
  }, [orderedFeed]);

  // Snapshot the feed + the selected index so background refetches can't shift
  // the viewer's position while it's open.
  const [viewerSnapshot, setViewerSnapshot] = useState<{ feed: typeof orderedFeed; idx: number } | null>(null);

  const openViewer = (userId: string) => {
    const currentFeed = orderedFeed;
    const currentMap = feedIndexByUser;

    const idx = currentMap.get(userId);
    if (idx === undefined) {
      console.error('[StatusPage] Cannot open viewer — user not in feed', {
        userId,
        feedLength: currentFeed.length,
      });
      return;
    }
    const target = currentFeed[idx];

    if (!target || target.stories.length === 0) {
      console.error('[StatusPage] Cannot open viewer — no stories for user', {
        userId,
        idx,
        feedLength: currentFeed.length,
        hasTarget: !!target,
        storyCount: target?.stories?.length,
      });
      return;
    }

    setViewerSnapshot({ feed: currentFeed, idx });
  };

  if (viewerSnapshot) {
    return (
      <StoryViewer
        feed={viewerSnapshot.feed}
        initialGroupIndex={Math.min(viewerSnapshot.idx, viewerSnapshot.feed.length - 1)}
        onClose={() => setViewerSnapshot(null)}
      />
    );
  }

  return (
    <>
      <div className="min-h-screen bg-wa-chat text-white pb-20 md:pb-0">
        <div className="max-w-lg mx-auto px-3 sm:px-4 py-4 sm:py-6">
          <TopBar title="Status" onBack={() => navigate('/chat')} backIcon="chevron" glass={false} className="mb-8" />

          {/* My status */}
          <div className="glass rounded-2xl p-5 border border-white/10 mb-6">
            <div className="flex items-center gap-4">
              <button type="button"
                onClick={() =>
                  myGroup ? openViewer(currentUser!.id) : setCreateStoryOpen(true)
                }
                className="relative shrink-0 group"
                aria-label={myGroup ? 'View your status' : 'Add a status'}
              >
                <StoryRing stories={myGroup?.stories} size="md">
                  <Avatar src={currentUser?.avatar} name={currentUser?.displayName} size="lg" />
                </StoryRing>
                {!myGroup && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-wa-accent text-white rounded-full flex items-center justify-center ring-2 ring-[#0b0b0e] group-hover:scale-110 transition-transform">
                    <Plus className="w-3 h-3" strokeWidth={3} />
                  </span>
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm truncate">My Status</p>
                {myGroup ? (
                  <p className="text-xs text-wa-secondary mt-0.5">
                    {storyCountLabel(myGroup.stories.length)} ·{' '}
                    {formatTimeAgo(new Date(myGroup.stories[myGroup.stories.length - 1]?.createdAt))}
                  </p>
                ) : (
                  <p className="text-xs text-wa-secondary mt-0.5">Tap to add a status update</p>
                )}
              </div>
              <button type="button"
                onClick={() => setCreateStoryOpen(true)}
                className="shrink-0 w-9 h-9 rounded-full bg-wa-accent/15 text-wa-accent hover:bg-wa-accent/25 flex items-center justify-center transition"
                aria-label="Add status"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* Recent updates */}
          {isError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <Image className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-sm font-semibold text-wa-primary mb-1">Failed to load statuses</p>
              <p className="text-xs text-wa-secondary">Pull down to refresh</p>
            </div>
          ) : isLoading ? (
            <FeedSkeleton />
          ) : otherGroups.length > 0 ? (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-wa-secondary mb-3 px-1">
                Recent Updates
              </h2>
              <div className="space-y-1">
                {otherGroups.map((group) => (
                  <button type="button"
                    key={group.userId}
                    onClick={() => openViewer(group.userId)}
                    className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-white/[0.06] transition text-left group"
                  >
                    <StoryRing stories={group.stories} size="md">
                      <Avatar
                        src={group.user.avatar}
                        name={group.user.displayName}
                        size="md"
                        className="ring-2 ring-white/10"
                      />
                    </StoryRing>
                    <div className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold truncate group-hover:text-wa-accent transition-colors">
                        {group.user.displayName}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-wa-secondary">
                        <span>{storyCountLabel(group.stories.length)}</span>
                        <span>·</span>
                        <span>
                          {formatTimeAgo(new Date(group.stories[group.stories.length - 1]?.createdAt))}
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-[#4a4a52] rotate-180 group-hover:text-wa-secondary transition" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-[#4a4a52]">
              <div className="w-16 h-16 rounded-full bg-white/[0.03] flex items-center justify-center mb-4">
                <Image className="w-7 h-7" />
              </div>
              <p className="text-sm font-medium">No recent updates</p>
              <p className="text-xs mt-1">Friend status updates will appear here</p>
            </div>
          )}
        </div>
      </div>
      <MobileNav />
      {isCreateStoryOpen && <CreateStoryModal onClose={() => setCreateStoryOpen(false)} />}
    </>
  );
};

export default StatusPage;
