import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Message } from '../../types/chat.types';
import { useAuthStore } from '../../store/auth.store';
import { useConversationStore } from '../../store/conversation.store';
import { Check, CheckCheck, Clock, FileText, Download, CornerUpLeft, Trash2, SmilePlus, Forward, Star, Info, Copy, Pin, MoreHorizontal, ChevronRight, Pencil, AlertCircle, RotateCcw, Sparkles } from 'lucide-react';
import { patchMessageInCache, removeMessageFromCache } from '../../utils/message.utils';
import { parseMarkdown } from '../../utils/markdown';
import { Avatar } from '../layout/Avatar';
import { DisappearingTimer } from './DisappearingTimer';
import { VoiceMessageBubble } from './VoiceMessageBubble';
import { useQueryClient } from '@tanstack/react-query';
import { useUiStore } from '../../store/ui.store';
import { messagesApi } from '../../api/messages.api';
import { ReactionDetailSheet } from './ReactionDetailSheet';
import { ReadReceiptSheet } from './ReadReceiptSheet';
import { LinkPreviewCard } from './LinkPreviewCard';
import { ImageViewer } from './ImageViewer';
import { getSenderColor } from '../../utils/senderColors';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

interface MessageBubbleProps {
  message: Message;
  isGroup: boolean;
  isLatest?: boolean;
  isFirstInGroup?: boolean;
  isLastInGroup?: boolean;
  isUnread?: boolean;
  onReplyClick?: (message: Message) => void;
  onForward?: (message: Message) => void;
  onEdit?: (message: Message, decryptedText: string) => void;
  onPromoteHighlight?: (messageId: string) => void;
  onRetry?: (tempId: string) => void;
  searchQuery?: string;
  isHighlighted?: boolean;
}

const MessageBubbleComponent: React.FC<MessageBubbleProps> = ({
  message,
  isGroup,
  isLatest = false,
  isFirstInGroup = true,
  isLastInGroup = true,
  isUnread = false,
  onReplyClick,
  onForward,
  onEdit,
  onPromoteHighlight,
  onRetry,
  searchQuery = '',
  isHighlighted = false,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const activeConversation = useConversationStore((state) => state.activeConversation);
  const isSent = message.senderId === currentUser?.id;
  const decryptedText = message.type === 'TEXT' && !message.isDeleted ? (message.content || '') : '';
  const decryptedReplyText = message.replyTo?.content || '';

  const queryClient = useQueryClient();

  const senderName =
    message.sender?.displayName ||
    activeConversation?.participants.find((p) => p.id === message.senderId)?.displayName ||
    'Unknown';

  const [starred, setStarred] = useState(!!message.starred);
  useEffect(() => setStarred(!!message.starred), [message.starred]);

  const isPinned = !!message.pinnedAt;

  const handleTogglePin = async () => {
    setMenuAnchor(null);
    try {
      await messagesApi.togglePin(message.id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const [showDeleteOptions, setShowDeleteOptions] = useState(false);

  interface FloatingEmoji {
    id: number;
    emoji: string;
    x: number;
    y: number;
  }

  const [floatingEmojis, setFloatingEmojis] = useState<FloatingEmoji[]>([]);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);

  const triggerEmojiBurst = (emoji: string) => {
    const newEmojis: FloatingEmoji[] = [];
    const baseId = Date.now();
    for (let i = 0; i < 6; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 40 + Math.random() * 30;
      newEmojis.push({
        id: baseId + i,
        emoji,
        x: Math.cos(angle) * distance,
        y: Math.sin(angle) * distance,
      });
    }
    setFloatingEmojis((prev) => [...prev, ...newEmojis]);
    setTimeout(() => {
      setFloatingEmojis((prev) => prev.filter((item) => !newEmojis.includes(item)));
    }, 700);
  };

  const renderWithMentions = (str: string): React.ReactNode => {
    const withMarkdown = parseMarkdown(str);
    if (!isGroup || !activeConversation) return withMarkdown;
    const names = activeConversation.participants
      .map((p) => p.displayName)
      .filter((n): n is string => !!n);
    names.push('everyone');
    const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const regex = new RegExp(`(@(?:${escaped.join('|')}))`, 'g');
    const myName = activeConversation.participants.find((p) => p.id === currentUser?.id)?.displayName;

    const parts = str.split(regex);
    if (parts.length === 1) return withMarkdown;

    return parts.map((part, i) => {
      if (part.startsWith('@') && names.includes(part.slice(1))) {
        const isMe = (myName && part.slice(1) === myName) || part.slice(1) === 'everyone';
        return (
          <span key={`part-${i}`} className={`font-semibold ${isMe ? 'text-primary bg-primary/10 rounded px-0.5' : 'text-primary bg-primary/10 rounded px-0.5'}`}>
            {part}
          </span>
        );
      }
      if (!part) return null;
      return <React.Fragment key={`part-${i}`}>{parseMarkdown(part)}</React.Fragment>;
    });
  };

  const handleCopy = () => {
    try {
      const textToCopy = message.type === 'TEXT' ? decryptedText : message.mediaUrl || message.content;
      navigator.clipboard.writeText(textToCopy || '');
    } catch (err) {
      console.error('Failed to copy message:', err);
    }
  };

  const handleToggleStar = async () => {
    setMenuAnchor(null);
    const next = !starred;
    setStarred(next);
    try {
      const res = await messagesApi.toggleStar(message.id);
      setStarred(res.starred);
      patchMessageInCache(queryClient, message.conversationId, message.id, (m) => ({
        ...m,
        starred: res.starred,
      }));
    } catch (err) {
      console.error('Failed to toggle star:', err);
      setStarred(!next);
    }
  };

  const [showReactionBar, setShowReactionBar] = useState(false);
  const [showReactionDetail, setShowReactionDetail] = useState(false);
  const [showReadReceipts, setShowReadReceipts] = useState(false);

  const groupedReactions = React.useMemo(() => {
    const map: Record<string, { count: number; mine: boolean }> = {};
    (message.reactions || []).forEach((r) => {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, mine: false };
      map[r.emoji].count++;
      if (r.userId === currentUser?.id) map[r.emoji].mine = true;
    });
    return map;
  }, [message.reactions, currentUser?.id]);

  const handleToggleReaction = async (emoji: string) => {
    setShowReactionBar(false);
    setMenuAnchor(null);
    triggerEmojiBurst(emoji);

    const wasMine = groupedReactions[emoji]?.mine;
    const prevReactions = message.reactions;

    // Optimistic update
    patchMessageInCache(queryClient, message.conversationId, message.id, (m) => {
      const reactions = m.reactions ? [...m.reactions] : [];
      if (wasMine) {
        return { ...m, reactions: reactions.filter((r) => !(r.userId === currentUser?.id && r.emoji === emoji)) };
      }
      reactions.push({ userId: currentUser!.id, emoji });
      return { ...m, reactions };
    });

    try {
      await messagesApi.toggleReaction(message.id, emoji);
    } catch (err) {
      // Rollback on failure
      patchMessageInCache(queryClient, message.conversationId, message.id, () => ({
        ...message,
        reactions: prevReactions,
      }));
      console.error('Failed to toggle reaction:', err);
    }
  };

  const prevReactionsLength = React.useRef(message.reactions?.length || 0);
  useEffect(() => {
    const currentLength = message.reactions?.length || 0;
    if (currentLength > prevReactionsLength.current) {
      const lastReaction = message.reactions?.[currentLength - 1];
      if (lastReaction && lastReaction.userId !== currentUser?.id) {
        triggerEmojiBurst(lastReaction.emoji);
      }
    }
    prevReactionsLength.current = currentLength;
  }, [message.reactions, currentUser?.id]);

  const handleDeleteForMe = async () => {
    try {
      await messagesApi.delete(message.id, 'ME');
      removeMessageFromCache(queryClient, message.conversationId, message.id);
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMenuAnchor(null);
    } catch (err) {
      console.error('Failed to delete message for me:', err);
    }
  };

  const handleDeleteForEveryone = async () => {
    try {
      await messagesApi.delete(message.id, 'EVERYONE');
      patchMessageInCache(queryClient, message.conversationId, message.id, (m) => ({
        ...m,
        isDeleted: true,
        content: 'This message was deleted',
        mediaUrl: undefined,
      }));
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      setMenuAnchor(null);
    } catch (err) {
      console.error('Failed to delete message for everyone:', err);
    }
  };

  const [menuAnchor, setMenuAnchor] = useState<DOMRect | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handleClose = () => {
      setMenuAnchor(null);
      setShowReactionBar(false);
      setShowDeleteOptions(false);
    };
    if (menuAnchor || showReactionBar) {
      window.addEventListener('click', handleClose);
      window.addEventListener('contextmenu', handleClose);
      window.addEventListener('resize', handleClose);
    }
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('resize', handleClose);
    };
  }, [menuAnchor, showReactionBar]);

  useEffect(() => {
    if (!menuAnchor) setMenuPos(null);
  }, [menuAnchor]);

  const handleOptionsClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setShowDeleteOptions(false);
    setMenuAnchor(e.currentTarget.getBoundingClientRect());
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowReactionBar(false);
    setShowDeleteOptions(false);
    const x = e.clientX;
    const y = e.clientY;
    setMenuAnchor({
      top: y, bottom: y, left: x, right: x, width: 0, height: 0, x, y,
      toJSON: () => ({}),
    } as DOMRect);
  };

  useLayoutEffect(() => {
    if (!menuAnchor || !menuRef.current) return;
    const { width, height } = menuRef.current.getBoundingClientRect();
    const margin = 8;
    let left = isSent ? menuAnchor.right - width : menuAnchor.left;
    left = Math.min(Math.max(margin, left), Math.max(margin, window.innerWidth - width - margin));
    const spaceBelow = window.innerHeight - menuAnchor.bottom;
    let top = spaceBelow < height + margin ? menuAnchor.top - height - 6 : menuAnchor.bottom + 6;
    top = Math.min(Math.max(margin, top), Math.max(margin, window.innerHeight - height - margin));
    setMenuPos({ top, left });
  }, [menuAnchor, isSent, showDeleteOptions]);

  const formattedTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const renderStatusTicks = () => {
    if (!isSent) return null;
    switch (message.status) {
      case 'PENDING':
        return <Clock className="w-3 h-3 text-white/40 inline" />;
      case 'SENT':
        return <Check className="w-3 h-3 text-white/40 inline" />;
      case 'DELIVERED':
        return <CheckCheck className="w-3 h-3 text-white/50 inline" />;
      case 'READ':
        return <CheckCheck className="w-3 h-3 text-primary inline" />;
      case 'FAILED':
        return (
          <button
            type="button"
            onClick={() => onRetry?.(message.id)}
            title="Failed to send — tap to retry"
            aria-label="Failed to send. Tap to retry."
            className="inline-flex items-center gap-0.5 text-red-400 hover:text-red-300 transition-colors"
          >
            <AlertCircle className="w-3 h-3" />
            <RotateCcw className="w-2.5 h-2.5" />
          </button>
        );
      default:
        return null;
    }
  };

  const [dragX, setDragX] = useState(0);
  const dragStartRef = useRef<{ x: number; y: number; active: boolean } | null>(null);
  const SWIPE_TRIGGER = 56;
  const swipeDir = isSent ? -1 : 1;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    dragStartRef.current = { x: e.clientX, y: e.clientY, active: false };
  };
  const handlePointerMove = (e: React.PointerEvent) => {
    const s = dragStartRef.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    const along = dx * swipeDir;
    if (!s.active) {
      if (Math.abs(dy) > Math.abs(dx) || along < 6) return;
      s.active = true;
    }
    setDragX(Math.max(0, Math.min(72, along)) * swipeDir);
  };
  const handlePointerEnd = () => {
    const s = dragStartRef.current;
    dragStartRef.current = null;
    if (s?.active && Math.abs(dragX) >= SWIPE_TRIGGER) onReplyClick?.(message);
    setDragX(0);
  };
  const swipeProgress = Math.min(1, Math.abs(dragX) / SWIPE_TRIGGER);

  const renderMeta = () => (
    <span className="inline-flex items-center gap-1 select-none align-bottom whitespace-nowrap">
      {message.expiresAt && !message.isExpired && (
        <DisappearingTimer message={message} ttlSeconds={activeConversation?.disappearingTtlSeconds} />
      )}
      {starred && <Star className="w-2.5 h-2.5 text-amber-400 fill-current" />}
      {isPinned && <Pin className="w-2.5 h-2.5 text-sky-400 fill-current rotate-45" />}
      {message.editedAt && <span className="text-[9px] text-white/60 italic">edited</span>}
      <span className="text-[9.5px] text-white/60 uppercase tracking-wide tabular-nums">{formattedTime}</span>
      {isSent && (
        <span key={message.status} className="inline-flex items-center animate-pop-in">
          {renderStatusTicks()}
        </span>
      )}
    </span>
  );

  const msgAnimation = isLatest
    ? isSent
      ? 'animate-msg-in-right'
      : 'animate-msg-in-left'
    : '';

  if (message.isDeleted) {
    return (
      <div className={`flex ${isSent ? 'justify-end' : 'justify-start'} mb-3 ${msgAnimation}`}>
        <div onContextMenu={(e) => e.preventDefault()} className={`px-3.5 py-2 rounded-md text-zinc-500 italic bubble-glass ${
          isSent ? 'bubble-glass-sent' : 'bubble-glass-received'
        }`}>
          This message was deleted
        </div>
      </div>
    );
  }

  const bubbleBorderRadius = isSent
    ? `rounded-md`
    : `rounded-md`;

  return (
    <div className={`flex ${isSent ? 'justify-end mr-1 sm:mr-2 pl-12' : 'justify-start ml-1 sm:ml-2 pr-12'} items-end gap-2 ${isLastInGroup ? 'mb-3' : 'mb-0.5'} group/bubble relative min-w-0 ${msgAnimation} ${message.isExpired ? 'animate-msg-expire' : ''}`}>
      {isGroup && !isSent && isFirstInGroup && (
        <div className="w-7 shrink-0 self-end mb-0.5">
          <div
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              useUiStore.getState().setProfileOpen(true);
            }}
            className="rounded-full p-[2px]"
            style={{ background: getSenderColor(message.senderId) }}
          >
            <Avatar
              src={message.sender?.avatar || activeConversation?.participants.find((p) => p.id === message.senderId)?.avatar}
              name={senderName}
              size="xs"
              className="ring-2 ring-wa-chat"
            />
          </div>
        </div>
      )}
      {dragX !== 0 && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-0 flex items-center justify-center text-primary ${
            isSent ? 'right-2' : 'left-2'
          }`}
          style={{ opacity: swipeProgress, transform: `translateY(-50%) scale(${0.6 + swipeProgress * 0.4})` }}
        >
          <CornerUpLeft className="w-5 h-5" />
        </div>
      )}
      <div
        onContextMenu={handleContextMenu}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        style={{
          transform: dragX ? `translateX(${dragX}px)` : undefined,
          transition: dragX ? 'none' : 'transform 0.22s var(--ease-spring)',
          touchAction: 'pan-y',
        }}
        className={`relative ${bubbleBorderRadius} flex flex-col select-text cursor-pointer text-sm ${
          message.type === 'IMAGE'
            ? 'bg-transparent border-none shadow-none max-w-[80%]'
            : `bubble-glass ${
                isSent
                  ? `bubble-glass-sent ${message.replyTo ? 'min-w-[160px]' : 'min-w-[80px]'}`
                  : `bubble-glass-received ${message.replyTo ? 'min-w-[160px]' : 'min-w-[68px]'}`
              } max-w-[80%] px-3 py-2 leading-relaxed`
        } ${
          isHighlighted ? 'animate-highlight-flash' : ''
        } ${isUnread ? (isSent ? 'border-r-2 border-primary/30' : 'border-l-2 border-primary/30') : ''}`}
      >
        {/* Options button (top corner) */}
        {!message.isDeleted && (
          <button
            type="button"
            onClick={handleOptionsClick}
            className="absolute -top-2 -right-2 p-1 rounded bg-background hover:bg-accent text-muted-foreground hover:text-foreground opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 z-20 cursor-pointer"
            title="Options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>
        )}
        {floatingEmojis.map((fe) => (
          <span
            key={fe.id}
            className="absolute pointer-events-none text-lg select-none z-50 animate-emoji-particle"
            style={{
              '--tx': `${fe.x}px`,
              '--ty': `${fe.y}px`,
              left: '50%',
              top: '50%',
            } as React.CSSProperties}
          >
            {fe.emoji}
          </span>
        ))}
        {/* Reply button */}
        <button
          type="button"
          onClick={() => onReplyClick?.(message)}
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center bg-background hover:bg-accent text-muted-foreground hover:text-foreground w-7 h-7 rounded z-20 opacity-0 scale-90 group-hover/bubble:opacity-100 group-hover/bubble:scale-100 transition-all duration-200 ${
            isSent ? '-left-9' : '-right-9'
          }`}
          title="Reply"
          aria-label="Reply to message"
        >
          <CornerUpLeft className="w-3.5 h-3.5" />
        </button>

        {/* React button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowReactionBar((v) => !v);
          }}
          className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center bg-background hover:bg-accent text-muted-foreground hover:text-foreground w-7 h-7 rounded z-20 opacity-0 scale-90 group-hover/bubble:opacity-100 group-hover/bubble:scale-100 transition-all duration-200 ${
            isSent ? '-left-[4.5rem]' : '-right-[4.5rem]'
          }`}
          title="React"
          aria-label="Add reaction"
        >
          <SmilePlus className="w-3.5 h-3.5" />
        </button>

        {showReactionBar && (
          <div
            className="group/reactions absolute -top-14 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 bg-[#1f2c34] border border-white/[0.08] rounded-2xl px-3 py-2 shadow-lg animate-scale-in origin-bottom"
          >
            {REACTION_EMOJIS.map((emoji, idx) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleReaction(emoji);
                }}
                className={`w-9 h-9 flex items-center justify-center text-xl rounded-xl hover:bg-white/[0.08] transition-all duration-150 hover:scale-[1.4] active:scale-90 animate-reaction-pop group-hover/reactions:opacity-60 hover:!opacity-100 ${
                  groupedReactions[emoji]?.mine ? 'bg-emerald-500/20 ring-1 ring-emerald-500/30' : ''
                }`}
                style={{ animationDelay: `${idx * 40}ms` }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {isGroup && !isSent && isFirstInGroup && (
          <span className="text-xs font-semibold mb-0.5 flex items-center gap-1.5 select-none" style={{ color: getSenderColor(message.senderId) }}>
            <span className="truncate">{senderName}</span>
            {activeConversation?.participants.find((p) => p.id === message.senderId)?.role === 'ADMIN' && (
              <span className="border border-primary/35 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded uppercase scale-90 shrink-0">
                Admin
              </span>
            )}
          </span>
        )}

        {message.forwardedFromId && (
          <span className="flex items-center gap-1 text-[10px] italic text-muted-foreground mb-0.5 select-none">
            <Forward className="w-2.5 h-2.5" /> Forwarded
          </span>
        )}

        {message.replyTo && (
          <div className="bg-[#0e0e11]/40 border-l-[3px] border-wa-accent/70 rounded-r-lg pl-3 pr-2.5 py-1.5 mb-2 text-xs text-zinc-300 leading-normal select-none">
            {message.replyTo.isDeleted ? (
              <span className="italic">Original message was deleted</span>
            ) : (
              <>
                <span className="font-semibold text-foreground block mb-0.5 text-[11px]">
                  {message.replyTo.senderId === currentUser?.id
                    ? 'You'
                    : activeConversation?.participants.find((p) => p.id === message.replyTo!.senderId)?.displayName || 'Participant'}
                </span>
                <span className="line-clamp-2 truncate">
                  {message.replyTo.type === 'IMAGE' ? 'Photo' : decryptedReplyText}
                </span>
              </>
            )}
          </div>
        )}

        <div
          className={`text-[14.5px] leading-relaxed break-words min-w-0 ${
            message.type === 'TEXT' ? 'pb-0.5' : 'pb-2'
          }`}
        >
          {message.type === 'TEXT' && (() => {
            let isStoryReply = false;
            let storyData: {
              storyId?: string;
              storyType?: 'IMAGE' | 'VIDEO' | 'TEXT';
              storyMedia?: string;
              storyText?: string;
              storyBgColor?: string;
              storyFontStyle?: string;
              replyText?: string;
            } = {};

            try {
              if (decryptedText.startsWith('{"isStoryReply":')) {
                const parsed = JSON.parse(decryptedText);
                if (parsed.isStoryReply) {
                  isStoryReply = true;
                  storyData = parsed;
                }
              }
            } catch (err) {}

            if (isStoryReply) {
              return (
                <div className="flex flex-col gap-2">
                  <div className="bg-wa-sidebar/45 rounded-lg border-l-[3px] border-wa-accent/70 p-2 text-xs text-muted-foreground select-none flex items-center gap-3 overflow-hidden min-w-[180px] max-w-full">
                    {storyData.storyType === 'TEXT' ? (
                      <div
                        className={`w-10 h-10 rounded shrink-0 flex items-center justify-center p-1 text-[7px] text-white text-center leading-tight select-none overflow-hidden ${storyData.storyFontStyle || ''}`}
                        style={{ background: storyData.storyBgColor || '#1f2c33' }}
                      >
                        <span className="line-clamp-3">{storyData.storyText}</span>
                      </div>
                    ) : storyData.storyMedia ? (
                      <div className="w-10 h-10 rounded overflow-hidden shrink-0 bg-black/40 border border-white/5 relative flex items-center justify-center">
                        {storyData.storyType === 'VIDEO' ? (
                          <video src={storyData.storyMedia} className="object-cover w-full h-full" muted />
                        ) : (
                          <img src={storyData.storyMedia} alt="Story thumb" className="object-cover w-full h-full" />
                        )}
                      </div>
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-foreground block mb-0.5 text-[10px]">Replied to status</span>
                      <span className="line-clamp-2 text-[10px] italic">
                        {storyData.storyType === 'TEXT' ? 'Text status' : (storyData.storyText || 'Media status')}
                      </span>
                    </div>
                  </div>
                  <span>
                    <span className="float-right ml-2 mt-1 leading-none">{renderMeta()}</span>
                    {searchQuery ? (
                      (storyData.replyText || '').split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                        part.toLowerCase() === searchQuery.toLowerCase() ? (
                          <mark key={`hl-${i}`} className="bg-yellow-500 text-black rounded px-0.5">{part}</mark>
                        ) : (
                          renderWithMentions(part)
                        )
                      )
                    ) : (
                      renderWithMentions(storyData.replyText || '')
                    )}
                  </span>
                </div>
              );
            }

            return (
              <span>
                <span className="float-right ml-2 mt-1 leading-none">{renderMeta()}</span>
                {searchQuery ? (
                  decryptedText.split(new RegExp(`(${searchQuery})`, 'gi')).map((part, i) =>
                    part.toLowerCase() === searchQuery.toLowerCase() ? (
                      <mark key={`hl-${i}`} className="bg-yellow-500 text-black rounded px-0.5">{part}</mark>
                    ) : (
                      renderWithMentions(part)
                    )
                  )
                ) : (
                  renderWithMentions(decryptedText)
                )}
              </span>
            );
          })()}

          {message.type === 'TEXT' && !message.isDeleted && (
            <LinkPreviewCard text={decryptedText} isSent={isSent} />
          )}

          {message.type === 'IMAGE' && message.mediaUrl && (
            <div
              className="relative overflow-hidden cursor-pointer rounded-xl"
            >
              <img
                src={message.mediaUrl}
                alt="Image attachment"
                className="block w-full h-auto max-h-[400px] object-cover transition-transform duration-300 hover:scale-105"
                onClick={() => setViewerImageUrl(message.mediaUrl!)}
                loading="lazy"
              />
            </div>
          )}

          {message.type === 'AUDIO' && message.mediaUrl && (
            <VoiceMessageBubble mediaUrl={message.mediaUrl} isOwn={isSent} />
          )}

          {message.type === 'FILE' && message.mediaUrl && (
            <div className="flex items-center justify-between gap-3 w-full max-w-[260px] bg-accent/50 p-2.5 rounded-xl border border-white/[0.04]">
              <div className="flex items-center space-x-3 min-w-0">
                <FileText className="w-8 h-8 text-primary shrink-0" />
                <div className="min-w-0">
                  <span className="text-[13px] font-semibold block truncate">
                    {message.content || 'Attached File'}
                  </span>
                  <span className="text-[9px] text-muted-foreground">Document</span>
                </div>
              </div>
              <a
                href={message.mediaUrl}
                download
                target="_blank"
                rel="noreferrer"
                className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-white/[0.06] rounded-full transition"
              >
                <Download className="w-5 h-5" />
              </a>
            </div>
          )}
        </div>

        {message.type !== 'TEXT' && (
          <div className="self-end flex items-center mt-1 h-3">{renderMeta()}</div>
        )}

        {Object.keys(groupedReactions).length > 0 && (
          <div
            className="flex flex-wrap gap-1.5 mt-2 justify-center"
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowReactionDetail(true);
            }}
          >
            {Object.entries(groupedReactions).map(([emoji, info]) => (
              <button
                key={emoji}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleReaction(emoji);
                }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs leading-none transition-all duration-150 hover:scale-110 active:scale-95 animate-reaction-pill ${
                  info.mine
                    ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40 text-white'
                    : 'bg-white/[0.06] ring-1 ring-white/[0.08] text-zinc-300 hover:bg-white/[0.1]'
                }`}
                title={info.mine ? 'Remove your reaction' : 'React'}
              >
                <span className="text-[14px]">{emoji}</span>
                {info.count > 1 && <span className="font-semibold text-[11px]">{info.count}</span>}
              </button>
            ))}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowReactionDetail(true);
              }}
              title="See who reacted"
              className="flex items-center justify-center w-6 h-6 rounded-full text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-all"
            >
              <Info className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {menuAnchor && createPortal(
        <div
          ref={menuRef}
          onContextMenu={(e) => e.preventDefault()}
          className="fixed bg-popover border border-border rounded-lg shadow-md py-1 w-40 z-50 select-none text-sm animate-scale-in origin-top font-sans"
          style={{
            top: menuPos ? `${menuPos.top}px` : '-9999px',
            left: menuPos ? `${menuPos.left}px` : '-9999px',
            visibility: menuPos ? 'visible' : 'hidden',
          }}
        >
          {showDeleteOptions ? (
            <>
              <div className="px-4 py-2 text-xs text-muted-foreground font-bold uppercase tracking-wider flex items-center justify-between border-b border-white/[0.06] mb-1">
                <span>Delete Message</span>
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteOptions(false);
                  }}
                  className="text-primary hover:text-primary-3 text-[11px] font-semibold cursor-pointer uppercase bg-transparent border-none outline-none"
                >
                  Back
                </button>
              </div>
              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteForMe();
                  setMenuAnchor(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
              >
                <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                <span>Delete for me</span>
              </button>
              {isSent && (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteForEveryone();
                    setMenuAnchor(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
                >
                  <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Delete for everyone</span>
                </button>
              )}
            </>
          ) : (
            <>
              {isSent && !message.id.startsWith('temp-') && (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowReadReceipts(true);
                    setMenuAnchor(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
                >
                  <Info className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Message info</span>
                </button>
              )}

              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onReplyClick?.(message);
                  setMenuAnchor(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
              >
                <CornerUpLeft className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Reply</span>
              </button>

              {onEdit && isSent && message.type === 'TEXT' && !message.id.startsWith('temp-') && (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit(message, decryptedText);
                    setMenuAnchor(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
                >
                  <Pencil className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Edit</span>
                </button>
              )}

              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopy();
                  setMenuAnchor(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
              >
                <Copy className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>Copy</span>
              </button>

              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  setShowReactionBar(true);
                  setMenuAnchor(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
              >
                <SmilePlus className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>React</span>
              </button>

              {onForward && (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onForward(message);
                    setMenuAnchor(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
                >
                  <Forward className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Forward</span>
                </button>
              )}

              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePin();
                  setMenuAnchor(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
              >
                <Pin className="w-4 h-4 text-muted-foreground shrink-0" />
                <span>{isPinned ? 'Unpin' : 'Pin'}</span>
              </button>

              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleToggleStar();
                  setMenuAnchor(null);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
              >
                <Star className={`w-4 h-4 text-muted-foreground shrink-0 ${starred ? 'fill-amber-400 text-amber-400' : ''}`} />
                <span>{starred ? 'Unstar' : 'Star'}</span>
              </button>

              {onPromoteHighlight && (
                <button type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onPromoteHighlight(message.id);
                    setMenuAnchor(null);
                  }}
                  className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center space-x-3 cursor-pointer bg-transparent border-none outline-none"
                >
                  <Sparkles className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span>Promote to Highlight</span>
                </button>
              )}

              <div className="border-t border-white/[0.06] my-1" />

              <button type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDeleteOptions(true);
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition text-[13px] font-medium text-foreground flex items-center justify-between cursor-pointer bg-transparent border-none outline-none"
              >
                <div className="flex items-center space-x-3">
                  <Trash2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>Delete</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {showReactionDetail && (
        <ReactionDetailSheet messageId={message.id} onClose={() => setShowReactionDetail(false)} />
      )}
      {showReadReceipts && (
        <ReadReceiptSheet messageId={message.id} onClose={() => setShowReadReceipts(false)} />
      )}
      {viewerImageUrl && (
        <ImageViewer src={viewerImageUrl} onClose={() => setViewerImageUrl(null)} />
      )}
    </div>
  );
};

export const MessageBubble = React.memo(MessageBubbleComponent);
