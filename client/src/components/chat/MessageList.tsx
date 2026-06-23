import React, { useRef, useState, useEffect, useLayoutEffect, useMemo } from 'react';
import type { Message } from '../../types/chat.types';
import type { CallRecord } from '../../api/calls.api';
import type { MessageListItem } from '../../utils/message.utils';
import { MessageBubble } from './MessageBubble';
import { CallLogSummary } from '../calls/CallLogSummary';
import { groupMessagesByDate } from '../../utils/message.utils';
import { saveScrollState, getScrollState } from '../../utils/scrollMemory';
import { MessageListSkeleton } from '../skeletons/MessageListSkeleton';
import { ScrollToBottom } from './ScrollToBottom';
import { useVirtualizer } from '@tanstack/react-virtual';
import { RefreshCw } from 'lucide-react';
import { GradientBackground } from '../ui/gradient-background';

type CallListItem = { type: 'CALL'; id: string; call: CallRecord };
type CallSummaryListItem = { type: 'CALL_SUMMARY'; id: string; calls: CallRecord[] };
type ListItem = MessageListItem | CallListItem | CallSummaryListItem;

interface MessageListProps {
  messages: Message[];
  isGroup: boolean;
  isLoading: boolean;
  error: any;
  onRetry: () => void;
  hasMore: boolean;
  onLoadMore: () => void;
  isFetchingNextPage: boolean;
  onReplyClick?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onEdit?: (message: Message, decryptedText: string) => void;
  onPromoteHighlight?: (messageId: string) => void;
  onRetryMessage?: (tempId: string) => void;
  conversationId?: string;
  unreadCount?: number;
  searchQuery?: string;
  scrollToMessageId?: string | null;
  callHistory?: CallRecord[];
  typingIndicator?: React.ReactNode;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isGroup,
  isLoading,
  error,
  onRetry,
  hasMore,
  onLoadMore,
  isFetchingNextPage,
  onReplyClick,
  onForward,
  onEdit,
  onPromoteHighlight,
  onRetryMessage,
  conversationId,
  unreadCount,
  searchQuery = '',
  scrollToMessageId = null,
  callHistory = [],
  typingIndicator,
}) => {
  const [parentRef, setParentRef] = useState<HTMLDivElement | null>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Snapshot the first unread message once per conversation, so the "Unread
  // messages" divider stays put while reading instead of jumping as you scroll.
  const firstUnreadIdRef = useRef<string | null>(null);
  const unreadSnapshotConvRef = useRef<string | undefined>(undefined);
  if (unreadSnapshotConvRef.current !== conversationId && messages.length > 0) {
    unreadSnapshotConvRef.current = conversationId;
    firstUnreadIdRef.current =
      unreadCount && unreadCount > 0 && unreadCount <= messages.length
        ? messages[messages.length - unreadCount]?.id ?? null
        : null;
  }

  const listItems = useMemo((): ListItem[] => {
    const filteredMessages = messages.filter((msg) => {
      try {
        const parsed = JSON.parse(msg.content);
        return parsed.type !== 'call';
      } catch {
        return true;
      }
    });
    const msgItems = groupMessagesByDate(filteredMessages, firstUnreadIdRef.current);

    if (callHistory.length === 0) return msgItems;

    const allItems: ListItem[] = [...msgItems];

    for (const call of callHistory) {
      const callTime = new Date(call.createdAt).getTime();
      let insertIndex = allItems.length;

      for (let i = allItems.length - 1; i >= 0; i--) {
        const item = allItems[i];
        let itemTime = 0;
        if (item.type === 'MESSAGE' && item.message) {
          itemTime = new Date(item.message.createdAt).getTime();
        } else if (item.type === 'CALL' && item.call) {
          itemTime = new Date(item.call.createdAt).getTime();
        }
        if (itemTime <= callTime) {
          insertIndex = i + 1;
          break;
        }
      }

      allItems.splice(insertIndex, 0, { type: 'CALL', id: `call-${call.id}`, call });
    }

    const collapsed: ListItem[] = [];
    let i = 0;
    while (i < allItems.length) {
      if (allItems[i].type === 'CALL') {
        const groupStart = i;
        while (i < allItems.length && allItems[i].type === 'CALL') i++;
        const callGroup = allItems.slice(groupStart, i) as CallListItem[];
        if (callGroup.length > 1) {
          collapsed.push({
            type: 'CALL_SUMMARY',
            id: `call-summary-${callGroup[0].id}`,
            calls: callGroup.map((c) => c.call),
          });
        } else {
          collapsed.push(callGroup[0]);
        }
      } else {
        collapsed.push(allItems[i]);
        i++;
      }
    }

    return collapsed;
  }, [messages, callHistory, firstUnreadIdRef.current]);

  const lastMessageId = useMemo(
    () => [...listItems].reverse().find((i) => i.type === 'MESSAGE')?.id,
    [listItems],
  );

  const rowVirtualizer = useVirtualizer({
    count: parentRef ? listItems.length : 0,
    getScrollElement: () => parentRef,
    estimateSize: (index) => {
      const item = listItems[index];
      if (item.type === 'DIVIDER' || item.type === 'UNREAD') return 40;
      if (item.type === 'CALL') return 60;
      if (item.type === 'CALL_SUMMARY') return 60;
      return 48;
    },
    overscan: 20,
  });

  useEffect(() => {
    if (!scrollToMessageId) return;
    const index = listItems.findIndex((item) => item.id === scrollToMessageId);
    if (index !== -1) {
      rowVirtualizer.scrollToIndex(index, { align: 'center' });
    } else if (hasMore && !isFetchingNextPage && !isLoading) {
      onLoadMore();
    }
  }, [scrollToMessageId, listItems, rowVirtualizer, hasMore, isFetchingNextPage, isLoading, onLoadMore]);

  // Whether the viewport is pinned to the latest message, and whether we've
  // already restored the saved position for this mount.
  const atBottomRef = useRef(true);
  const didRestoreRef = useRef(false);

  const scrollToBottom = () => {
    const container = parentRef;
    if (container) {
      container.scrollTop = container.scrollHeight;
      atBottomRef.current = true;
    }
  };

  // Scroll handling is throttled to one read per animation frame so fast
  // flicks don't fire a burst of layout reads / state updates / localStorage
  // writes. Persistence is additionally debounced, and load-more is locked
  // until the in-flight page settles so we never queue duplicate fetches.
  const scrollRafRef = useRef<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadMoreLockRef = useRef(false);

  const processScroll = () => {
    scrollRafRef.current = null;
    const container = parentRef;
    if (!container) return;

    const distanceToBottom = container.scrollHeight - container.clientHeight - container.scrollTop;
    const atBottom = distanceToBottom < 80;
    atBottomRef.current = atBottom;
    const wantBtn = distanceToBottom > 300;
    setShowScrollBottom((prev) => (prev === wantBtn ? prev : wantBtn));

    // Persist position only after the initial restore so transient programmatic
    // scrolls during mount don't overwrite the remembered spot. Debounced
    // because localStorage writes are comparatively expensive.
    if (conversationId && didRestoreRef.current) {
      const top = container.scrollTop;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveScrollState(conversationId, { top, atBottom });
      }, 200);
    }

    // Load older messages a little before the very top for a seamless feel.
    if (
      container.scrollTop < 400 &&
      hasMore &&
      !isFetchingNextPage &&
      !isLoading &&
      !loadMoreLockRef.current
    ) {
      loadMoreLockRef.current = true;
      onLoadMore();
    }
  };

  const handleScroll = () => {
    if (scrollRafRef.current != null) return;
    scrollRafRef.current = requestAnimationFrame(processScroll);
  };

  // Release the load-more lock once the page fetch settles.
  useEffect(() => {
    if (!isFetchingNextPage) loadMoreLockRef.current = false;
  }, [isFetchingNextPage]);

  // Flush pending frame/timer on unmount.
  useEffect(
    () => () => {
      if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current);
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    },
    [],
  );

  // Restore the remembered scroll position (or land at the bottom) when the
  // conversation opens. Single RAF lets the virtualizer measure real row heights
  // before we pin the scroll position.
  useLayoutEffect(() => {
    const container = parentRef;
    if (!container || didRestoreRef.current || listItems.length === 0) return;

    const saved = conversationId ? getScrollState(conversationId) : undefined;
    requestAnimationFrame(() => {
      if (saved && !saved.atBottom) {
        container.scrollTop = saved.top;
        atBottomRef.current = false;
      } else {
        container.scrollTop = container.scrollHeight;
        atBottomRef.current = true;
      }
      didRestoreRef.current = true;
    });
  }, [parentRef, conversationId, listItems.length]);

  // Keep pinned to the latest message as new messages arrive — but only if the
  // user was already at the bottom (don't yank them down while reading history).
  useEffect(() => {
    const container = parentRef;
    if (!container || !didRestoreRef.current) return;
    if (atBottomRef.current) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }, [messages.length, parentRef]);

  const previousScrollHeightRef = useRef<number>(0);
  const anchorItemRef = useRef<{ id: string; index: number } | null>(null);

  // Before loading older messages, snap the first visible item as an anchor.
  useEffect(() => {
    if (!isFetchingNextPage || !parentRef) return;
    previousScrollHeightRef.current = parentRef.scrollHeight;
    const virtualItems = rowVirtualizer.getVirtualItems();
    if (virtualItems.length > 0) {
      const first = virtualItems[0];
      const item = listItems[first.index];
      if (item) {
        anchorItemRef.current = { id: item.id, index: first.index };
      }
    }
  }, [isFetchingNextPage, parentRef, rowVirtualizer, listItems]);

  // After new older messages arrive, restore scroll position using
  // scrollHeight-delta so real (measured) row heights — not estimateSize
  // guesses — determine where the viewport lands. Double rAF lets layout
  // flush before we read scrollHeight, and image load events correct any
  // additional drift from lazy-loaded media.
  useEffect(() => {
    const anchor = anchorItemRef.current;
    if (!anchor || !parentRef) {
      previousScrollHeightRef.current = 0;
      return;
    }

    const container = parentRef;
    const prevHeight = previousScrollHeightRef.current;
    let totalDelta = 0;

    const applyDelta = () => {
      requestAnimationFrame(() => {
        const delta = container.scrollHeight - prevHeight;
        const extra = delta - totalDelta;
        if (extra > 0) {
          container.scrollTop += extra;
          totalDelta += extra;
        } else if (totalDelta === 0) {
          // Fallback: if the height didn't increase at all, use the old
          // scrollToIndex as a sanity check.
          const newIndex = listItems.findIndex((i) => i.id === anchor.id);
          if (newIndex !== -1) {
            rowVirtualizer.scrollToIndex(newIndex, { align: 'auto' });
          }
        }
      });
    };

    // Primary correction — double rAF so the browser has laid out new rows
    // and the virtualizer has run measureElement before we read scrollHeight.
    requestAnimationFrame(() => {
      requestAnimationFrame(applyDelta);
    });

    // Image-load correction — each lazy image that finishes loading may
    // expand the item height beyond what scrollHeight reflected at layout
    // time, pushing visible content down.  Re-run applyDelta to compensate.
    const imageLoadHandlers: (() => void)[] = [];
    container.querySelectorAll('img').forEach((img) => {
      if (!img.complete) {
        const handler = () => { applyDelta(); };
        img.addEventListener('load', handler, { once: true });
        imageLoadHandlers.push(() => img.removeEventListener('load', handler));
      }
    });

    anchorItemRef.current = null;
    previousScrollHeightRef.current = 0;

    return () => {
      imageLoadHandlers.forEach((fn) => fn());
    };
  }, [messages, parentRef, rowVirtualizer, listItems]);

  if (isLoading) {
    return <MessageListSkeleton />;
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-3 bg-wa-chat">
        <p className="text-sm text-wa-secondary">Couldn't load messages</p>
        <button type="button"
          onClick={onRetry}
          className="flex items-center space-x-2 px-4 py-2 bg-wa-surface-2 hover:bg-wa-active border border-white/[0.06] rounded-xl text-wa-primary text-sm font-semibold transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div
      className="relative flex-grow flex flex-col h-full min-w-0 max-w-full"
    >
      <GradientBackground />
      <div
        ref={setParentRef}
        onScroll={handleScroll}
        className="flex-grow overflow-y-auto overflow-x-hidden px-3 sm:px-4 py-3 relative min-w-0 z-10"
        style={{
          outline: 'none',
        }}
      >
        {isFetchingNextPage && (
          <div className="sticky top-1 z-20 flex justify-center py-1 pointer-events-none">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-wa-surface-2/90 border border-white/[0.06] text-[11px] font-medium text-wa-secondary shadow-glow">
              <RefreshCw className="w-3 h-3 animate-spin" />
              Loading older messages
            </div>
          </div>
        )}

        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
            zIndex: 10,
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const item = listItems[virtualRow.index];
            if (!item) return null;

            return (
              <div
                key={item.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                  contain: 'layout style',
                }}
              >
                {item.type === 'DIVIDER' ? (
                  <div className="flex justify-center my-4 select-none">
                    <span className="bg-wa-surface-2/80 border border-white/[0.06] text-wa-secondary text-[10.5px] font-semibold tracking-wider rounded-full px-3.5 py-1 uppercase">
                      {item.content}
                    </span>
                  </div>
                ) : item.type === 'UNREAD' ? (
                  <div className="flex items-center gap-3 my-4 px-2 select-none">
                    <div className="flex-1 h-px bg-wa-accent/20" />
                    <span className="text-[10px] font-semibold tracking-wider text-wa-accent uppercase">
                      {item.content}
                    </span>
                    <div className="flex-1 h-px bg-wa-accent/20" />
                  </div>
                ) : item.type === 'CALL' ? (
                  <CallLogSummary calls={[item.call]} />
                ) : item.type === 'CALL_SUMMARY' ? (
                  <CallLogSummary calls={item.calls} />
                ) : item.message ? (
                  <MessageBubble
                    message={item.message}
                    isGroup={isGroup}
                    isLatest={item.id === lastMessageId}
                    isFirstInGroup={item.isFirstInGroup}
                    isLastInGroup={item.isLastInGroup}
                    isUnread={item.isUnread}
                    onReplyClick={onReplyClick}
                    onForward={onForward}
                    onEdit={onEdit}
                    onPromoteHighlight={onPromoteHighlight}
                    onRetry={onRetryMessage}
                    searchQuery={searchQuery}
                    isHighlighted={item.id === scrollToMessageId}
                  />
                ) : null}
              </div>
            );
          })}
        </div>

        {typingIndicator}
      </div>

      {scrollToMessageId && !listItems.some((item) => item.id === scrollToMessageId) && hasMore && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-30 animate-fade-in">
          <div className="bg-wa-surface px-5 py-3.5 rounded-2xl flex items-center gap-3 border border-white/[0.08] shadow-elevated">
            <RefreshCw className="w-4 h-4 text-wa-accent animate-spin" />
            <span className="text-xs font-semibold text-wa-primary">Loading conversation history...</span>
          </div>
        </div>
      )}

      <ScrollToBottom show={showScrollBottom} onClick={scrollToBottom} />
    </div>
  );
};
