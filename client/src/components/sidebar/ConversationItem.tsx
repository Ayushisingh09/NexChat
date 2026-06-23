import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Conversation, User } from '../../types/chat.types';
import { useAuthStore } from '../../store/auth.store';
import { formatMessageTime } from '../../utils/time.utils';
import {
  Check, CheckCheck, Clock, Pin, BellOff, Timer, Phone, PhoneMissed,
  MoreVertical, Users,
} from 'lucide-react';
import { Avatar } from '../layout/Avatar';
import { useUiStore } from '../../store/ui.store';
import { useTypingStore } from '../../store/typing.store';
import { useCallStore } from '../../store/call.store';
import { useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../../api/conversations.api';
import { sortConversations } from '../../utils/conversation.utils';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export const ConversationItem: React.FC<ConversationItemProps> = React.memo(({
  conversation,
  isActive,
  onClick,
}) => {
  const currentUser = useAuthStore((state) => state.user);
  const setProfileOpen = useUiStore((state) => state.setProfileOpen);
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const isGroup = conversation.type === 'GROUP';

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

  const handleMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpen(!menuOpen);
  }, [menuOpen]);

  const isPinned = !!conversation.pinnedAt;

  // Check if there's an ongoing call with this conversation's participant
  const callStatus = useCallStore((s) => s.status);
  const callParticipant = useCallStore((s) => s.participant);
  const isOnCall = callStatus === 'ongoing' && conversation.type === 'DIRECT' && callParticipant?.id === conversation.participants.find((p) => p.id !== currentUser?.id)?.id;

  const handleTogglePin = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinnedAt = isPinned ? null : new Date().toISOString();
    queryClient.setQueryData<Conversation[]>(['conversations'], (old) => {
      if (!old) return old;
      const updated = old.map((c) =>
        c.id === conversation.id ? { ...c, pinnedAt: newPinnedAt } : c
      );
      return sortConversations(updated);
    });
    try {
      await conversationsApi.togglePin(conversation.id);
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  };

  const getOtherParticipant = (): User | null => {
    if (conversation.type === 'GROUP' || !currentUser) return null;
    const other = conversation.participants.find((p) => p.id !== currentUser.id);
    return other || null;
  };

  const otherParticipant = getOtherParticipant();
  const displayName = conversation.type === 'GROUP'
    ? conversation.name
    : otherParticipant?.displayName || 'Chat';

  const isOnline = conversation.type === 'DIRECT' && !!otherParticipant?.isOnline;
  const isMuted = !!conversation.mutedUntil && new Date(conversation.mutedUntil).getTime() > Date.now();

  let draft = '';
  if (!isActive) {
    try {
      draft = localStorage.getItem(`draft:${conversation.id}`) || '';
    } catch {
      draft = '';
    }
  }

  const typingUser = useTypingStore((s) => {
    for (let i = 0; i < conversation.participants.length; i++) {
      const val = s.typingUsers[`${conversation.id}:${conversation.participants[i].id}`];
      if (val) return val;
    }
    return null;
  });
  const isTyping = !!typingUser;

  const lastMessage = conversation.lastMessage;
  const decryptedText = lastMessage?.content || '';

  const PREVIEW_MAX_LENGTH = 42;

  const truncateText = (text: string, limit: number): string => {
    if (text.length <= limit) return text;
    return text.slice(0, limit).trimEnd() + '...';
  };

  const getLastMessagePreview = () => {
    if (!lastMessage) return '';
    if (lastMessage.isDeleted) return 'This message was deleted';

    // Detect call event messages
    if (lastMessage.type === 'TEXT' && lastMessage.content?.startsWith('{')) {
      try {
        const parsed = JSON.parse(lastMessage.content);
        if (parsed.type === 'call') {
          const missed = parsed.status === 'MISSED';
          const rejected = parsed.status === 'REJECTED';
          const duration = parsed.duration;
          const durText = duration > 0 ? ` · ${Math.floor(duration / 60)}m ${duration % 60}s` : '';
          if (missed) return `Missed call${durText}`;
          if (rejected) return `Declined${durText}`;
          return `Call ended${durText}`;
        }
      } catch { /* not a call event */ }
    }

    switch (lastMessage.type) {
      case 'IMAGE': return 'Photo';
      case 'AUDIO': return 'Voice Message';
      case 'VIDEO': return 'Video';
      case 'FILE': return 'File';
      default: return truncateText(decryptedText, PREVIEW_MAX_LENGTH);
    }
  };

  // Detect if last message is a call event for styling
  const isCallLastMessage = (() => {
    if (!lastMessage || lastMessage.type !== 'TEXT' || !lastMessage.content?.startsWith('{')) return null;
    try {
      const parsed = JSON.parse(lastMessage.content);
      if (parsed.type === 'call') return parsed.status;
    } catch { /* not a call event */ }
    return null;
  })();

  const renderStatusTicks = () => {
    if (!lastMessage || lastMessage.senderId !== currentUser?.id) return null;
    switch (lastMessage.status) {
      case 'PENDING': return <Clock className="w-3.5 h-3.5 text-wa-secondary shrink-0" />;
      case 'SENT': return <Check className="w-3.5 h-3.5 text-wa-secondary shrink-0" />;
      case 'DELIVERED': return <CheckCheck className="w-3.5 h-3.5 text-wa-secondary shrink-0" />;
      case 'READ': return <CheckCheck className="w-3.5 h-3.5 text-sky-400 shrink-0" />;
      default: return null;
    }
  };

  const itemRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = itemRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--x', `${e.clientX - rect.left}px`);
    el.style.setProperty('--y', `${e.clientY - rect.top}px`);
  };

  return (
    <div
      ref={itemRef}
      onMouseMove={handleMouseMove}
      onClick={onClick}
      className={`group/conv relative flex items-center justify-between mx-2 px-3 py-[11px] rounded-2xl cursor-pointer transition-all duration-200 ease-spring select-none glow-hover ${
        isActive
          ? 'conv-active'
          : isGroup
            ? 'bg-violet-500/[0.03] hover:bg-white/[0.06]'
            : 'bg-transparent hover:bg-white/[0.06]'
      }`}
    >
      {isGroup && !isActive && (
        <span className="absolute left-1 top-2.5 bottom-2.5 w-[3px] rounded-full bg-gradient-to-b from-violet-500/60 to-sky-500/60 origin-center" />
      )}
      <span
        className={`absolute left-1 top-2.5 bottom-2.5 w-[3px] rounded-full origin-center transition-transform duration-200 ease-spring ${
          isActive
            ? `scale-y-100 ${isGroup ? 'bg-gradient-to-b from-violet-400 to-sky-400' : 'bg-wa-accent'}`
            : 'scale-y-0 bg-wa-accent'
        }`}
      />
      <div className="flex items-center space-x-3.5 flex-grow min-w-0">
        {/* Avatar with presence dot */}
        <div
          className="relative shrink-0"
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setProfileOpen(true);
          }}
        >
          <Avatar
            src={conversation.type === 'GROUP' ? conversation.avatar : otherParticipant?.avatar}
            name={displayName}
            size="lg"
            shape={isGroup ? 'squircle' : 'circle'}
            presence={conversation.type === 'DIRECT' ? (isOnline ? 'online' : 'offline') : undefined}
          />
          {isGroup && (
            <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-wa-accent border-2 border-wa-sidebar flex items-center justify-center">
              <Users className="w-2 h-2 text-white" />
            </span>
          )}
        </div>

        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-center mb-0.5">
            <h4 className="text-[15px] font-semibold text-wa-primary truncate leading-tight flex items-center gap-1.5">
              {isGroup && <Users className="w-3.5 h-3.5 text-wa-accent shrink-0" />}
              {displayName}
            </h4>
            {lastMessage && (
              <span className="text-[11px] text-wa-secondary/70 shrink-0 ml-2 leading-tight">
                {formatMessageTime(lastMessage.createdAt)}
              </span>
            )}
          </div>

          <div className="flex items-center">
            <div className="flex items-center space-x-1 min-w-0 flex-grow mr-2 text-[13px] text-wa-secondary leading-tight">
              {draft ? (
                <span className="truncate">
                  <span className="text-wa-accent font-semibold">Draft: </span>
                  {truncateText(draft, PREVIEW_MAX_LENGTH)}
                </span>
              ) : isTyping ? (
                <span className="flex items-center gap-1.5 text-wa-accent">
                  <span className="flex gap-[2px] items-center">
                    <span className="w-1 h-1 rounded-full bg-wa-accent animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-wa-accent animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-wa-accent animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                  <span className="italic text-[13px]">
                    {conversation.type === 'GROUP' ? `${typingUser!.displayName} is typing` : 'typing'}
                  </span>
                </span>
              ) : isOnCall ? (
                <span className="flex items-center gap-1.5 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[13px] font-medium">On call</span>
                </span>
              ) : lastMessage ? (
                <>
                  {renderStatusTicks()}
                  {isCallLastMessage ? (
                    <span className={`flex items-center gap-1 truncate ${
                      isCallLastMessage === 'MISSED' || isCallLastMessage === 'REJECTED'
                        ? 'text-red-400' : 'text-wa-accent'
                    }`}>
                      {(isCallLastMessage === 'MISSED' || isCallLastMessage === 'REJECTED')
                        ? <PhoneMissed className="w-3.5 h-3.5 shrink-0" />
                        : <Phone className="w-3.5 h-3.5 shrink-0" />
                      }
                      {getLastMessagePreview()}
                    </span>
                  ) : (
                    <span className="truncate">{getLastMessagePreview()}</span>
                  )}
                </>
              ) : isGroup ? (
                <span className="flex items-center gap-1 text-wa-accent/70">
                  <Users className="w-3 h-3 shrink-0" />
                  <span>{conversation.participants.length} member{conversation.participants.length !== 1 ? 's' : ''}</span>
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {conversation.disappearingTtlSeconds && (
                <Timer className="w-3 h-3 text-wa-green/60" />
              )}
              {isMuted && <BellOff className="w-3.5 h-3.5 text-wa-secondary/60" />}

              {/* Group context menu trigger */}
              {isGroup && (
                <div className="relative">
                  <button type="button"
                    ref={btnRef}
                    onClick={handleMenuClick}
                    title="Group options"
                    aria-label="Group options"
                    className={`p-1 rounded-full hover:bg-wa-sidebar-hover transition active:scale-90 ${
                      menuOpen
                        ? 'text-wa-green opacity-100'
                        : 'text-wa-secondary/50 opacity-0 group-hover/conv:opacity-100'
                    }`}
                  >
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>

                  {menuOpen && (
                    <div
                      ref={menuRef}
                      className="absolute right-0 top-full mt-1 z-50 w-52 bg-wa-surface border border-white/[0.06] rounded-2xl shadow-elevated py-1.5 animate-scale-in origin-top-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="px-4 py-2 text-xs text-wa-secondary">No options</div>
                    </div>
                  )}
                </div>
              )}

              <button type="button"
                onClick={handleTogglePin}
                title={isPinned ? 'Unpin chat' : 'Pin chat'}
                aria-label={isPinned ? 'Unpin chat' : 'Pin chat'}
                className={`p-1 rounded-full hover:bg-wa-sidebar-hover transition active:scale-90 ${
                  isPinned
                    ? 'text-wa-green opacity-100'
                    : 'text-wa-secondary/50 opacity-0 group-hover/conv:opacity-100'
                }`}
              >
                <Pin className={`w-3 h-3 ${isPinned ? 'fill-current' : ''}`} />
              </button>
              {conversation.unreadCount > 0 && (
                <span className={`font-bold text-[11px] px-1.5 min-w-[20px] h-[18px] rounded-full flex items-center justify-center animate-pop-in ${
                  isMuted
                    ? 'bg-wa-secondary/40 text-wa-sidebar'
                    : isGroup
                      ? 'bg-wa-accent text-white'
                      : 'bg-wa-accent text-white'
                }`}>
                  {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

ConversationItem.displayName = 'ConversationItem';
