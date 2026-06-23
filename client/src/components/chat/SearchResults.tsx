import React, { useRef, useEffect } from 'react';
import { useMessageSearch } from '../../hooks/useMessageSearch';
import type { Message } from '../../types/chat.types';
import { Loader2, Search, X, ChevronUp, ChevronDown, Hash } from 'lucide-react';
import { Avatar } from '../layout/Avatar';

interface SearchOverlayProps {
  conversationId: string;
  conversationName: string;
  isOpen: boolean;
  onClose: () => void;
  onJump: (messageId: string) => void;
}

/** Message result row */
const SearchResultRow: React.FC<{
  message: Message;
  query: string;
  index: number;
  isActive: boolean;
  onJump: (id: string) => void;
}> = ({ message, query, index, isActive, onJump }) => {
  const decryptedText = message.type === 'TEXT' ? (message.content || '') : '';
  const rowRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isActive && rowRef.current) {
      rowRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [isActive]);

  const label =
    message.type === 'TEXT'
      ? decryptedText
      : message.type === 'IMAGE'
        ? '📷 Photo'
        : message.type === 'AUDIO'
          ? '🎵 Voice message'
          : message.type === 'VIDEO'
            ? '🎥 Video'
            : `📄 ${message.content || 'File'}`;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = query ? label.split(new RegExp(`(${escaped})`, 'gi')) : [label];

  const senderName = message.sender?.displayName || 'Unknown';

  const date = new Date(message.createdAt);
  const timeStr = date.toLocaleDateString([], {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <button type="button"
      ref={rowRef}
      onClick={() => onJump(message.id)}
      className={`w-full text-left px-5 py-3.5 flex items-start gap-3.5 transition-all duration-150 group/row border-b border-white/[0.04] ${
        isActive
          ? 'bg-wa-green/10'
          : 'hover:bg-white/[0.06]'
      }`}
      style={{
        animation: `searchSlideUp ${Math.min(220 + index * 30, 420)}ms cubic-bezier(0.16, 1, 0.3, 1) both`,
        animationDelay: `${Math.min(index * 25, 200)}ms`,
      }}
    >
      {/* Avatar */}
      <Avatar
        src={message.sender?.avatar}
        name={senderName}
        size="md"
        className="ring-1 ring-white/10 shrink-0 mt-0.5"
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[14px] font-semibold text-wa-primary truncate">
            {senderName}
          </span>
          <span className="text-[11px] text-wa-secondary ml-auto shrink-0">
            {timeStr}
          </span>
        </div>
        <p className="text-[13.5px] text-wa-secondary leading-relaxed">
          {parts.map((p, i) =>
            p.toLowerCase() === query.toLowerCase() ? (
              <mark key={`hl-${i}`} className="bg-wa-green/25 text-wa-green rounded-sm px-0.5 font-semibold">
                {p}
              </mark>
            ) : (
              <React.Fragment key={`hl-${i}`}>{p}</React.Fragment>
            )
          )}
        </p>
      </div>
    </button>
  );
};

export const SearchResults: React.FC<SearchOverlayProps> = ({
  conversationId,
  conversationName,
  isOpen,
  onClose,
  onJump,
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = React.useState(0);
  const [activeJumpId, setActiveJumpId] = React.useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const { matches, isLoading, isFetching, hasNextPage, fetchNextPage, isFetchingNextPage, debouncedQuery } =
    useMessageSearch(isOpen ? conversationId : undefined, searchQuery);

  useEffect(() => {
    setCurrentMatchIndex(0);
    setActiveJumpId(null);
  }, [debouncedQuery]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    } else {
      setSearchQuery('');
      setActiveJumpId(null);
      setCurrentMatchIndex(0);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (matches.length > 0) {
          const newIdx = currentMatchIndex > 0 ? currentMatchIndex - 1 : matches.length - 1;
          setCurrentMatchIndex(newIdx);
          setActiveJumpId(matches[newIdx].id);
        }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (matches.length > 0) {
          const newIdx = currentMatchIndex < matches.length - 1 ? currentMatchIndex + 1 : 0;
          setCurrentMatchIndex(newIdx);
          setActiveJumpId(matches[newIdx].id);
        }
      } else if (e.key === 'Enter' && matches.length > 0) {
        e.preventDefault();
        const id = matches[currentMatchIndex]?.id;
        if (id) {
          onJump(id);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, currentMatchIndex, matches, onClose, onJump]);

  const handleResultClick = (messageId: string) => {
    const idx = matches.findIndex((m) => m.id === messageId);
    if (idx !== -1) setCurrentMatchIndex(idx);
    setActiveJumpId(messageId);
    onJump(messageId);
    onClose();
  };

  const handlePrev = () => {
    if (matches.length === 0) return;
    const newIdx = currentMatchIndex > 0 ? currentMatchIndex - 1 : matches.length - 1;
    setCurrentMatchIndex(newIdx);
    setActiveJumpId(matches[newIdx].id);
  };

  const handleNext = () => {
    if (matches.length === 0) return;
    const newIdx = currentMatchIndex < matches.length - 1 ? currentMatchIndex + 1 : 0;
    setCurrentMatchIndex(newIdx);
    setActiveJumpId(matches[newIdx].id);
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-6">
      {/* Backdrop — dark blur matching app theme */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        style={{ animation: 'searchFadeIn 200ms ease-out forwards' }}
      />

      {/* ── Glass Panel ─ centered ────────────────── */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-[640px] max-h-[80vh] flex flex-col rounded-2xl overflow-hidden ring-1 ring-white/[0.08]"
        style={{
          background: 'linear-gradient(165deg, rgba(13,13,15,0.92) 0%, rgba(20,20,22,0.96) 100%)',
          backdropFilter: 'blur(40px) saturate(150%)',
          WebkitBackdropFilter: 'blur(40px) saturate(150%)',
          boxShadow: '0 25px 60px -15px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)',
          animation: 'searchPanelIn 280ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
        }}
      >
        {/* ── Header ─────────────────────────────── */}
        <div className="shrink-0 px-5 pt-4 pb-3 border-b border-white/[0.06]">
          {/* Channel name */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Hash className="w-4 h-4 text-wa-green shrink-0" />
              <span className="text-[14px] font-bold text-wa-primary truncate">
                {conversationName}
              </span>
              <span className="text-[11px] text-wa-secondary">— Search</span>
            </div>
            <button type="button"
              onClick={onClose}
              className="p-1.5 text-wa-secondary hover:text-wa-primary hover:bg-white/[0.06] rounded-lg transition-all active:scale-90"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search input */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 w-4 h-4 text-wa-secondary" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-wa-primary placeholder-wa-secondary/50 focus:outline-none focus:border-wa-green/40 focus:ring-1 focus:ring-wa-green/20 focus:bg-white/[0.06] transition-all duration-200"
            />
            {/* Nav arrows inside input area */}
            {debouncedQuery && (
              <div className="absolute right-2 flex items-center gap-1">
                {matches.length > 0 && (
                  <span className="text-[11px] text-wa-secondary font-medium tabular-nums mr-1">
                    {currentMatchIndex + 1}/{matches.length}
                  </span>
                )}
                <button type="button"
                  onClick={handlePrev}
                  disabled={matches.length <= 1}
                  className="p-1 text-wa-secondary hover:text-wa-primary hover:bg-white/[0.06] rounded disabled:opacity-25 transition-all active:scale-90"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button type="button"
                  onClick={handleNext}
                  disabled={matches.length <= 1}
                  className="p-1 text-wa-secondary hover:text-wa-primary hover:bg-white/[0.06] rounded disabled:opacity-25 transition-all active:scale-90"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Results ─────────────────────────────── */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {(isLoading || (isFetching && matches.length === 0)) && debouncedQuery ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Loader2 className="w-7 h-7 animate-spin text-wa-green" />
              <span className="text-sm text-wa-secondary">Searching…</span>
            </div>
          ) : !debouncedQuery ? (
            /* Initial state */
            <div className="flex flex-col items-center justify-center py-14 gap-4 select-none">
              <div className="w-16 h-16 rounded-2xl bg-wa-green/[0.08] flex items-center justify-center">
                <Search className="w-7 h-7 text-wa-green/50" />
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-wa-primary">Search Messages</p>
                <p className="text-[12px] text-wa-secondary mt-1">Type to search through the conversation history</p>
              </div>
              <div className="flex items-center gap-3 mt-1 text-[10px] text-wa-secondary/70">
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-wa-secondary/80 font-mono border border-white/[0.06]">↑↓</kbd>
                  Navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-wa-secondary/80 font-mono border border-white/[0.06]">Enter</kbd>
                  Jump
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="px-1.5 py-0.5 bg-white/[0.06] rounded text-wa-secondary/80 font-mono border border-white/[0.06]">Esc</kbd>
                  Close
                </span>
              </div>
            </div>
          ) : matches.length === 0 && !isFetching ? (
            /* No results */
            <div className="flex flex-col items-center justify-center py-14 gap-3 select-none">
              <div className="w-14 h-14 rounded-2xl bg-white/[0.03] flex items-center justify-center">
                <Search className="w-6 h-6 text-wa-secondary/40" />
              </div>
              <p className="text-[13px] text-wa-secondary">
                No results for "<span className="text-wa-primary font-medium">{debouncedQuery}</span>"
              </p>
              <p className="text-[11px] text-wa-secondary/60">Try different keywords</p>
            </div>
          ) : (
            /* Results list */
            <div>
              <div className="sticky top-0 z-10 px-5 py-2 border-b border-white/[0.04]"
                style={{ background: 'rgba(13,13,15,0.85)', backdropFilter: 'blur(12px)' }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-wa-secondary">
                    {matches.length} result{matches.length === 1 ? '' : 's'}
                  </span>
                  {isFetching && <Loader2 className="w-3 h-3 animate-spin text-wa-green ml-auto" />}
                </div>
              </div>

              {matches.map((m, idx) => (
                <SearchResultRow
                  key={m.id}
                  message={m}
                  query={debouncedQuery}
                  index={idx}
                  isActive={m.id === activeJumpId}
                  onJump={handleResultClick}
                />
              ))}

              {hasNextPage && (
                <div className="p-4 flex justify-center">
                  <button type="button"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="px-5 py-2 text-[12px] font-semibold text-wa-primary bg-wa-green/15 hover:bg-wa-green/25 border border-wa-green/20 rounded-xl transition-all duration-200 flex items-center gap-2 active:scale-95 disabled:opacity-50"
                  >
                    {isFetchingNextPage ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
                    ) : (
                      'Load More Results'
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom hint bar */}
        <div className="shrink-0 px-5 py-2 border-t border-white/[0.04] flex items-center justify-center gap-4 text-[10px] text-wa-secondary/50 select-none">
          <span>Click a result to jump to it in the chat</span>
        </div>
      </div>

      {/* Inline keyframes */}
      <style>{`
        @keyframes searchFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes searchPanelIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes searchSlideUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};
