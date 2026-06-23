import React, { useState, useRef, useEffect } from 'react';
import type { Conversation, User } from '../../types/chat.types';
import { useAuthStore } from '../../store/auth.store';
import { useConversationStore } from '../../store/conversation.store';
import { useUiStore } from '../../store/ui.store';
import { ArrowLeft, Search, MoreVertical, Pin, Phone, Video, PhoneCall } from 'lucide-react';
import { formatLastSeen } from '../../utils/time.utils';
import { Avatar } from '../layout/Avatar';
import { Users } from 'lucide-react';
import { callsApi } from '../../api/calls.api';
import { useCallStore } from '../../store/call.store';
import { playOutgoingRing } from '../../utils/callSounds';
import { requestNotificationPermission } from '../../utils/callNotifications';

interface ChatHeaderProps {
  conversation: Conversation;
  onSearchClick?: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ conversation, onSearchClick }) => {
  const currentUser = useAuthStore((state) => state.user);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);
  const setContactInfoOpen = useUiStore((state) => state.setContactInfoOpen);
  const setPinnedOpen = useUiStore((state) => state.setPinnedOpen);
  const setOutgoing = useCallStore((state) => state.setOutgoing);
  const callStatus = useCallStore((state) => state.status);
  const [showCallMenu, setShowCallMenu] = useState(false);
  const callMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (callMenuRef.current && !callMenuRef.current.contains(e.target as Node)) {
        setShowCallMenu(false);
      }
    };
    if (showCallMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showCallMenu]);

  const getOtherParticipant = (): User | null => {
    if (conversation.type === 'GROUP' || !currentUser) return null;
    return conversation.participants.find((p) => p.id !== currentUser.id) || null;
  };

  const otherParticipant = getOtherParticipant();
  const displayName = conversation.type === 'GROUP'
    ? conversation.name
    : otherParticipant?.displayName || 'Chat';

  const isOnline = conversation.type === 'DIRECT' && !!otherParticipant?.isOnline;

  const getPresenceText = () => {
    if (conversation.type === 'GROUP') {
      return `${conversation.participants.length} participants`;
    }
    if (!otherParticipant) return '';
    if (otherParticipant.isOnline) return 'Online';
    if (otherParticipant.lastSeen) {
      return `Last seen ${formatLastSeen(otherParticipant.lastSeen)}`;
    }
    return 'Offline';
  };

  const handleCall = async (isVideo: boolean) => {
    if (!otherParticipant?.id) return;
    if (callStatus !== 'idle') return;
    const { acquireCallLock } = await import('../../utils/callPrefs');
    if (!acquireCallLock()) return;
    // Request notification permission so we can alert on incoming calls
    requestNotificationPermission();
    try {
      const res = await callsApi.initiate(otherParticipant.id);
      setOutgoing(res.callId, res.roomName, '', {
        id: otherParticipant.id,
        displayName: otherParticipant.displayName,
        avatar: otherParticipant.avatar ?? null,
      }, isVideo);
      playOutgoingRing();
    } catch (err: any) {
      console.error('Failed to initiate call:', err);
      const msg = err?.response?.data?.message || 'Could not start call. Please try again.';
      const { showToast } = await import('../layout/ToastHost');
      showToast(msg);
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 min-h-[60px] safe-top bar-glass border-b border-white/[0.04] shrink-0 select-none z-10">
      <div className="flex items-center space-x-2 min-w-0">
        <button
          type="button"
          onClick={() => setActiveConversation(null)}
          aria-label="Close chat"
          className="icon-btn p-1.5 shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div
          onClick={() => setContactInfoOpen(true)}
          className="flex items-center space-x-3 cursor-pointer hover:bg-wa-sidebar-hover/50 p-1 pr-3 rounded-xl transition-colors duration-150 min-w-0"
        >
          {conversation.type === 'GROUP' ? (
            <div className="relative w-10 h-10 shrink-0">
              <Avatar
                src={conversation.avatar}
                name={displayName}
                size="md"
                className="ring-2 ring-wa-chat"
              />
              {conversation.participants.length > 1 && (
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-wa-surface border-2 border-wa-chat flex items-center justify-center">
                  <span className="text-[8px] font-bold text-wa-accent">{conversation.participants.length}</span>
                </div>
              )}
            </div>
          ) : (
            <Avatar
              src={otherParticipant?.avatar}
              name={displayName}
              size="md"
              presence={isOnline ? 'online' : 'offline'}
              showRing={!!otherParticipant?.avatar}
            />
          )}
          <div className="min-w-0">
            <h3 className="text-[15px] font-semibold text-wa-primary truncate leading-tight">
              {displayName}
            </h3>
            {conversation.type === 'GROUP' ? (
              <p className="text-[11px] truncate leading-tight mt-0.5 text-wa-secondary/70 flex items-center gap-1">
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-wa-accent/10 text-wa-accent text-[9px] font-semibold">
                  <Users className="w-2.5 h-2.5" />
                  {conversation.participants.length} members
                </span>
              </p>
            ) : (
              <p className={`text-[11px] truncate leading-tight mt-0.5 ${isOnline ? 'text-green-400 font-medium' : 'text-wa-secondary/70'}`}>
                {isOnline && <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 align-middle animate-presence-in" />}
                {getPresenceText()}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center space-x-0.5">
        {conversation.type === 'DIRECT' && otherParticipant && (
          <div ref={callMenuRef} className="relative">
            <button
              type="button"
              onClick={() => setShowCallMenu((v) => !v)}
              title="Call"
              aria-label="Call"
              disabled={callStatus !== 'idle'}
              className="icon-btn p-2"
            >
              <PhoneCall className="w-4 h-4" />
            </button>
            {showCallMenu && (
              <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] bg-wa-surface border border-white/[0.08] rounded-xl shadow-pop overflow-hidden animate-scale-in origin-top-right">
                <button
                  type="button"
                  onClick={() => { handleCall(false); setShowCallMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-wa-primary hover:bg-white/[0.06] transition"
                >
                  <Phone className="w-4 h-4 text-wa-accent" />
                  Voice Call
                </button>
                <button
                  type="button"
                  onClick={() => { handleCall(true); setShowCallMenu(false); }}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 text-sm text-wa-primary hover:bg-white/[0.06] transition"
                >
                  <Video className="w-4 h-4 text-wa-accent" />
                  Video Call
                </button>
              </div>
            )}
          </div>
        )}

        {onSearchClick && (
          <button
            type="button"
            data-conversation-search
            onClick={onSearchClick}
            title="Search Messages (Cmd+F)"
            aria-label="Search messages"
            className="icon-btn p-2"
          >
            <Search className="w-4 h-4" />
          </button>
        )}

        <button
          type="button"
          onClick={() => setPinnedOpen(true)}
          title="Pinned Messages"
          aria-label="Pinned messages"
          className="icon-btn p-2"
        >
          <Pin className="w-4 h-4 rotate-[45deg]" />
        </button>

        <button
          type="button"
          onClick={() => setContactInfoOpen(true)}
          title="Contact Info"
          aria-label="Contact info"
          className="icon-btn p-2"
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
