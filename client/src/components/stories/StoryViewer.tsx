import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Trash2, Eye, Send, Heart, Loader2, ImageOff, Volume2, VolumeX, Pause } from 'lucide-react';
import { storiesApi, type StoryFeedGroup } from '../../api/stories.api';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../layout/Avatar';
import { formatMessageTime } from '../../utils/time.utils';
import { conversationsApi } from '../../api/conversations.api';
import { messagesApi } from '../../api/messages.api';
import { useConversationStore } from '../../store/conversation.store';
import { useSocketStore } from '../../store/socket.store';

interface StoryViewerProps {
  feed: StoryFeedGroup[];
  initialGroupIndex: number;
  onClose: () => void;
}

const IMAGE_DURATION = 5000;
const TEXT_DURATION = 6000;
const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

/** Only these fontStyle class names are allowed — must match the server allowlist. */
const SAFE_FONT_STYLES = new Set(['font-story-sans', 'font-story-serif', 'font-story-mono', 'font-story-cursive']);

export const StoryViewer: React.FC<StoryViewerProps> = ({ feed, initialGroupIndex, onClose }) => {
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const socket = useSocketStore((state) => state.socket);

  // Snapshot the feed for this viewing session so background refetches
  // (e.g. mark-as-viewed invalidations re-ordering the list) can't shift
  // indices mid-view and jump/blank the screen.
  const [groups] = useState<StoryFeedGroup[]>(feed);

  const [groupIdx, setGroupIdx] = useState(() =>
    Math.min(Math.max(initialGroupIndex, 0), Math.max(feed.length - 1, 0)),
  );
  const [storyIdx, setStoryIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showViewers, setShowViewers] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [sentReaction, setSentReaction] = useState<string | null>(null);
  const [showReactionBar, setShowReactionBar] = useState(false);
  const [mediaLoaded, setMediaLoaded] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const [muted, setMuted] = useState(true);

  // Use a ref for progress to avoid triggering React re-renders at 60fps.
  // The progress bar element is updated via direct DOM manipulation.
  const progressRef = useRef(0);
  const progressBarsRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const rafRef = useRef<number | null>(null);
  const elapsedRef = useRef(0);
  const lastTsRef = useRef(0);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressInfo = useRef<{ x: number; y: number; t: number; held: boolean } | null>(null);
  const groupIdxRef = useRef(groupIdx);
  const storyIdxRef = useRef(storyIdx);
  groupIdxRef.current = groupIdx;
  storyIdxRef.current = storyIdx;

  const group = groups[groupIdx];
  const story = group?.stories[storyIdx];
  const isOwn = group?.userId === currentUser?.id;

  const hasMedia = !!(story && story.type !== 'TEXT' && story.mediaUrl);
  const isVideo = story?.type === 'VIDEO' && !!story.mediaUrl;
  const isImage = story?.type === 'IMAGE';

  // Update progress bars via direct DOM to avoid 60fps re-renders.
  const updateProgressBars = useCallback((pct: number) => {
    progressRef.current = pct;
    const container = progressBarsRef.current;
    if (!container) return;
    const bars = container.children;
    const idx = storyIdxRef.current;
    for (let i = 0; i < bars.length; i++) {
      const bar = (bars[i] as HTMLElement).querySelector('div') as HTMLElement;
      if (!bar) continue;
      if (i < idx) {
        bar.style.transform = 'scaleX(1)';
        bar.style.transition = 'transform 0.2s linear';
      } else if (i === idx) {
        bar.style.transform = `scaleX(${pct})`;
        bar.style.transition = 'none';
      } else {
        bar.style.transform = 'scaleX(0)';
        bar.style.transition = 'transform 0.2s linear';
      }
    }
  }, []);

  // ─── Navigation ───
  const goNext = useCallback(() => {
    updateProgressBars(0);
    elapsedRef.current = 0;
    const g = groups[groupIdxRef.current];
    const si = storyIdxRef.current;
    const gi = groupIdxRef.current;
    if (g && si < g.stories.length - 1) {
      setStoryIdx((i) => i + 1);
    } else if (gi < groups.length - 1) {
      setGroupIdx((g) => g + 1);
      setStoryIdx(0);
    } else {
      onClose();
    }
  }, [groups.length, onClose, updateProgressBars]);

  const goPrev = useCallback(() => {
    updateProgressBars(0);
    elapsedRef.current = 0;
    const si = storyIdxRef.current;
    const gi = groupIdxRef.current;
    if (si > 0) {
      setStoryIdx((i) => i - 1);
    } else if (gi > 0) {
      const prevGroup = groups[gi - 1];
      setGroupIdx((g) => g - 1);
      setStoryIdx(Math.max(prevGroup.stories.length - 1, 0));
    } else {
      elapsedRef.current = 0;
    }
  }, [groups, updateProgressBars]);

  // ─── Reset per-story transient state ───
  useEffect(() => {
    setMediaLoaded(false);
    setMediaError(false);
    setShowViewers(false);
    setSentReaction(null);
    setShowReactionBar(false);
    updateProgressBars(0);
    elapsedRef.current = 0;

    // For IMAGE/VIDEO stories with null mediaUrl, mark as loaded immediately
    // so timerActive can start and the story progresses automatically.
    if (story && story.type !== 'TEXT' && !story.mediaUrl) {
      setMediaLoaded(true);
      setMediaError(true);
    }
  }, [story?.id, updateProgressBars]);

  // ─── Mark as viewed ───
  useEffect(() => {
    if (story && !isOwn && !story.viewed) {
      storiesApi
        .markViewed(story.id)
        .then(() => queryClient.invalidateQueries({ queryKey: ['stories'] }))
        .catch(() => undefined);
    }
  }, [story, isOwn, queryClient]);

  // ─── Live reaction + view updates on own stories ───
  useEffect(() => {
    if (!socket || !isOwn || !story) return;
    const onReaction = (payload: { storyId: string }) => {
      if (payload.storyId === story.id) {
        queryClient.invalidateQueries({ queryKey: ['story-views', story.id] });
      }
    };
    const onViewed = (payload: { storyId: string }) => {
      if (payload.storyId === story.id) {
        queryClient.invalidateQueries({ queryKey: ['story-views', story.id] });
      }
    };
    socket.on('story:reaction', onReaction);
    socket.on('story:viewed', onViewed);
    return () => {
      socket.off('story:reaction', onReaction);
      socket.off('story:viewed', onViewed);
    };
  }, [socket, isOwn, story, queryClient]);

  const { data: viewsData } = useQuery({
    queryKey: ['story-views', story?.id],
    queryFn: () => storiesApi.getViews(story!.id),
    enabled: !!story && isOwn && showViewers,
  });
  const viewers = viewsData?.viewers ?? [];
  const reactionSummary = viewsData?.reactionSummary ?? {};

  // ─── Smooth progress (rAF) for IMAGE / TEXT stories ───
  const timerActive =
    !!story &&
    !isVideo &&
    !paused &&
    !showViewers &&
    (story.type === 'TEXT' || mediaLoaded || mediaError);

  useEffect(() => {
    if (!timerActive || !story) return;
    const duration = story.type === 'TEXT' ? TEXT_DURATION : IMAGE_DURATION;
    lastTsRef.current = performance.now();

    const tick = (now: number) => {
      const dt = now - lastTsRef.current;
      lastTsRef.current = now;
      elapsedRef.current += dt;
      const pct = Math.min(elapsedRef.current / duration, 1);
      updateProgressBars(pct);
      if (pct >= 1) {
        goNext();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [timerActive, story?.id, goNext, updateProgressBars]);

  // ─── Video play/pause sync ───
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (paused || showViewers) v.pause();
    else v.play().catch(() => undefined);
  }, [paused, showViewers, story?.id]);

  // ─── Actions ───
  const handleSendReply = async (text: string) => {
    if (!text.trim() || sendingReply || !story || !group) return;
    setSendingReply(true);
    try {
      // Server's conversation create endpoint already reuses existing DIRECT conversations.
      const conversation = await conversationsApi.create({
        type: 'DIRECT',
        participantIds: [group.userId],
      });
      const content = JSON.stringify({
        isStoryReply: true,
        storyId: story.id,
        storyType: story.type,
        storyMedia: story.mediaUrl,
        storyText: story.type === 'TEXT' ? story.caption : story.caption || '',
        storyBgColor: story.bgColor,
        storyFontStyle: story.fontStyle,
        replyText: text.trim(),
      });
      await messagesApi.create({ conversationId: conversation.id, content, type: 'TEXT' });
      useConversationStore.getState().setActiveConversation(conversation);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onClose();
    } catch {
      /* ignore */
    } finally {
      setSendingReply(false);
    }
  };

  const handleReact = async (emoji: string) => {
    if (!story || isOwn) return;
    setSentReaction(emoji);
    setShowReactionBar(false);
    try {
      await storiesApi.react(story.id, emoji);
    } catch {
      setSentReaction(null);
      return;
    }
    setTimeout(() => setSentReaction(null), 1200);
  };

  const handleDelete = async () => {
    if (!story) return;
    try {
      await storiesApi.delete(story.id);
      queryClient.invalidateQueries({ queryKey: ['stories'] });
      goNext();
    } catch {
      /* ignore */
    }
  };

  // ─── Press / tap / hold interaction ───
  const beginPress = (x: number, y: number) => {
    pressInfo.current = { x, y, t: performance.now(), held: false };
    pressTimer.current = setTimeout(() => {
      if (pressInfo.current) {
        pressInfo.current.held = true;
        setPaused(true);
      }
    }, 220);
  };

  const endPress = (x: number, y: number, width: number) => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    const info = pressInfo.current;
    pressInfo.current = null;
    if (!info) return;

    if (info.held) {
      setPaused(false);
      return;
    }

    const dx = x - info.x;
    const dy = y - info.y;
    if (dy > 90 && Math.abs(dy) > Math.abs(dx)) {
      onClose();
      return;
    }
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) goPrev();
      else goNext();
      return;
    }
    if (x < width * 0.32) goPrev();
    else goNext();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-nav]')) return;
    beginPress(e.clientX, e.clientY);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    if (!pressInfo.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    endPress(e.clientX, e.clientY, rect.width);
  };

  // ─── Keyboard ───
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
      else if (e.key === ' ') {
        e.preventDefault();
        setPaused((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  const blurBg =
    hasMedia && !isVideo && story?.mediaUrl
      ? { backgroundImage: `url(${story.mediaUrl})` }
      : undefined;

  // Validate fontStyle against the allowlist — never inject raw server strings.
  const safeFontStyle = story?.fontStyle && SAFE_FONT_STYLES.has(story.fontStyle) ? story.fontStyle : '';

  // Feed empty or invalid index. Previously this returned null — but because
  // StatusPage renders ONLY the viewer while open, a null return blanked the
  // whole screen with no error UI (the reported black-screen bug). Render a
  // visible, dismissible fallback and log the state so the failure is never
  // silent again.
  if (!group || !story) {
    console.error('[StoryViewer] No renderable story — feed/index mismatch', {
      feedLength: groups.length,
      groupIdx,
      storyIdx,
      hasGroup: !!group,
      groupStoryCount: group?.stories?.length,
    });
    return (
      <div className="fixed inset-0 z-[80] bg-black flex flex-col items-center justify-center gap-4 px-6 text-center text-white/80">
        <ImageOff className="w-10 h-10 text-white/60" />
        <p className="text-sm font-medium">This status is unavailable</p>
        <button
          onClick={onClose}
          className="px-5 py-2.5 rounded-full bg-white/15 hover:bg-white/25 text-sm font-semibold text-white transition active:scale-95"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] bg-black overflow-hidden select-none touch-none"
      style={{ WebkitOverflowScrolling: 'touch' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        if (pressTimer.current) clearTimeout(pressTimer.current);
        if (pressInfo.current?.held) setPaused(false);
        pressInfo.current = null;
      }}
    >
      {/* ─── Centered media stage ─── */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-full h-full sm:max-w-[420px] sm:my-3 sm:rounded-2xl overflow-hidden bg-[#0a0a0a] sm:shadow-pop">
          {/* Blurred fill behind contained media */}
          {blurBg && (
            <div
              className="absolute inset-0 bg-center bg-cover scale-125"
              style={{ ...blurBg, filter: 'blur(34px) brightness(0.45)' }}
            />
          )}

          {/* Media */}
          <div key={story.id} className="absolute inset-0">
            {story.type === 'TEXT' ? (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ background: story.bgColor || '#1a1a2e' }}
              />
            ) : mediaError ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/70 bg-[#0a0a0a]">
                <ImageOff className="w-10 h-10" />
                <p className="text-xs font-medium">This status is unavailable</p>
              </div>
            ) : isVideo && story.mediaUrl ? (
              <video
                ref={videoRef}
                src={story.mediaUrl}
                className="w-full h-full object-contain relative"
                autoPlay
                muted={muted}
                playsInline
                onLoadedData={() => setMediaLoaded(true)}
                onError={() => {
                  setMediaError(true);
                  setMediaLoaded(true);
                }}
                onTimeUpdate={(e) => {
                  const v = e.currentTarget;
                  if (v.duration > 0 && isFinite(v.duration)) {
                    updateProgressBars(v.currentTime / v.duration);
                  }
                }}
                onEnded={goNext}
              />
            ) : isImage && story.mediaUrl ? (
              <img
                src={story.mediaUrl}
                alt="Status"
                className="w-full h-full object-contain relative"
                onLoad={() => setMediaLoaded(true)}
                onError={() => {
                  setMediaError(true);
                  setMediaLoaded(true);
                }}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-white/70 bg-[#0a0a0a]">
                <ImageOff className="w-10 h-10" />
                <p className="text-xs font-medium">Media unavailable</p>
              </div>
            )}
          </div>

          {/* Loading shimmer */}
          {hasMedia && !mediaLoaded && !mediaError && (
            <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-3 bg-[#0a0a0a]">
              <Loader2 className="w-8 h-8 text-white/70 animate-spin" />
              <span className="text-xs text-white/50">Loading...</span>
            </div>
          )}

          {/* Scrim */}
          <div
            className="absolute inset-0 z-[6] pointer-events-none"
            style={{
              background:
                'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 18%, transparent 68%, rgba(0,0,0,0.6) 100%)',
            }}
          />

          {/* Progress bars — updated via ref/DOM, not React state */}
          <div className="absolute top-0 left-0 right-0 z-30 px-2.5 pt-[max(env(safe-area-inset-top),0.5rem)] pb-1">
            <div ref={progressBarsRef} className="flex gap-1">
              {group.stories.map((s) => (
                <div
                  key={s.id}
                  className="flex-1 h-[3px] rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.4)' }}
                >
                  <div
                    className="h-full bg-white rounded-full origin-left"
                    style={{ transform: 'scaleX(0)', transition: 'transform 0.2s linear' }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Header */}
          <div className="absolute top-[calc(max(env(safe-area-inset-top),0.5rem)+10px)] left-0 right-0 z-30 px-3 py-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar src={group.user.avatar} name={group.user.displayName} size="sm" />
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-white leading-tight drop-shadow-md truncate">
                    {isOwn ? 'Your status' : group.user.displayName}
                  </p>
                  <p className="text-[10.5px] text-white/65 drop-shadow-sm">
                    {formatMessageTime(story.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-0.5 shrink-0" data-no-nav>
                {paused && (
                  <span className="flex items-center gap-1 text-[10px] text-white/60 pr-1">
                    <Pause className="w-3 h-3" /> Paused
                  </span>
                )}
                {isVideo && !mediaError && (
                  <button
                    onClick={() => setMuted((m) => !m)}
                    aria-label={muted ? 'Unmute' : 'Mute'}
                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition"
                  >
                    {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                )}
                {isOwn && (
                  <button
                    onClick={handleDelete}
                    aria-label="Delete"
                    className="p-2 text-white/70 hover:text-red-400 hover:bg-white/10 rounded-full transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Text story content */}
          {story.type === 'TEXT' && (
            <div className="absolute inset-0 z-10 flex items-center justify-center px-7 pointer-events-none">
              <p
                className={`text-lg sm:text-2xl font-semibold text-center break-words leading-relaxed max-w-full text-white drop-shadow-lg ${safeFontStyle}`}
              >
                {story.caption}
              </p>
            </div>
          )}

          {/* Caption overlay (image/video) */}
          {story.type !== 'TEXT' && story.caption && (
            <div className={`absolute left-0 right-0 px-3 z-20 ${isOwn ? 'bottom-16' : 'bottom-28'}`}>
              <p
                className="text-white text-sm text-center rounded-xl px-3 py-2 break-words max-h-28 overflow-y-auto"
                style={{
                  background: 'rgba(0,0,0,0.45)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                }}
              >
                {story.caption}
              </p>
            </div>
          )}

          {/* Reaction pop */}
          {sentReaction && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none">
              <span className="text-6xl animate-reaction-pop block">{sentReaction}</span>
            </div>
          )}

          {/* Reply input (others' stories) */}
          {!isOwn && (
            <div
              data-no-nav
              className="absolute bottom-0 left-0 right-0 z-30 px-2.5 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-2"
            >
              {showReactionBar && (
                <div
                  className="flex items-center justify-around rounded-full px-2 py-2 mb-2 animate-slide-up"
                  style={{
                    background: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(16px)',
                    WebkitBackdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                >
                  {REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReact(emoji)}
                      className="text-2xl hover:scale-125 active:scale-95 transition cursor-pointer"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendReply(replyText);
                }}
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={() => setShowReactionBar((v) => !v)}
                  aria-label="React"
                  className="p-2.5 text-white rounded-full transition shrink-0 active:scale-95"
                  style={{
                    background: 'rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                  }}
                >
                  <Heart className={`w-4 h-4 ${showReactionBar ? 'fill-current text-rose-400' : ''}`} />
                </button>
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  onFocus={() => setPaused(true)}
                  onBlur={() => setPaused(false)}
                  placeholder={`Reply to ${group.user.displayName || 'status'}...`}
                  className="flex-1 text-white text-sm rounded-full px-4 py-2.5 focus:outline-none placeholder-white/45"
                  style={{
                    background: 'rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}
                />
                <button
                  type="submit"
                  disabled={!replyText.trim() || sendingReply}
                  aria-label="Send reply"
                  className="p-2.5 bg-white text-black hover:bg-white/90 rounded-full transition disabled:opacity-40 shrink-0 active:scale-95"
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          )}

          {/* Viewers toggle (own stories) */}
          {isOwn && !showViewers && (
            <button
              data-no-nav
              onClick={() => setShowViewers(true)}
              className="absolute left-1/2 -translate-x-1/2 flex items-center gap-1.5 text-white/80 hover:text-white text-xs z-30 rounded-full px-4 py-2 transition active:scale-95"
              style={{
                bottom: 'max(env(safe-area-inset-bottom), 1rem)',
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <Eye className="w-3.5 h-3.5" />
              {viewsData ? `${viewers.length} ` : ''}Viewers
            </button>
          )}

          {/* Viewers sheet */}
          {isOwn && showViewers && (
            <div
              data-no-nav
              className="absolute bottom-0 left-0 right-0 max-h-[55%] border-t border-white/[0.06] rounded-t-2xl z-40 overflow-y-auto p-4 animate-slide-up"
              style={{ background: '#0d0d0d' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                  Viewed by {viewers.length}
                </p>
                <div className="flex items-center gap-2">
                  {Object.keys(reactionSummary).length > 0 && (
                    <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                      {Object.entries(reactionSummary).map(([emoji, count]) => (
                        <span key={emoji} className="flex items-center gap-0.5">
                          <span className="text-sm">{emoji}</span>
                          {count}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={() => setShowViewers(false)}
                    aria-label="Close viewers"
                    className="p-1 text-zinc-500 hover:text-white rounded-full transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {viewers.length === 0 ? (
                <p className="text-xs text-zinc-600 py-6 text-center">No views yet</p>
              ) : (
                viewers.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-3 px-1 py-2 hover:bg-white/[0.06] rounded-lg transition"
                  >
                    <Avatar src={v.avatar} name={v.displayName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-semibold text-white truncate">{v.displayName}</p>
                      <p className="text-[10.5px] text-zinc-500">{formatMessageTime(v.viewedAt)}</p>
                    </div>
                    {v.reactionEmoji && <span className="text-base shrink-0">{v.reactionEmoji}</span>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
