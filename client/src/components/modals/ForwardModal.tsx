import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Search, Check, Forward, MessageSquare } from 'lucide-react';
import type { Conversation, Message } from '../../types/chat.types';
import { conversationsApi } from '../../api/conversations.api';
import { messagesApi } from '../../api/messages.api';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../layout/Avatar';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ForwardModalProps {
  message: Message | null;
  onClose: () => void;
}

export const ForwardModal: React.FC<ForwardModalProps> = ({ message, onClose }) => {
  const currentUser = useAuthStore((state) => state.user);
  const [searchQuery, setSearchQuery] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);

  const { data: conversations = [], isLoading } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: conversationsApi.list,
    enabled: !!message,
  });

  const dialogRef = useFocusTrap<HTMLDivElement>(!!message, onClose);

  if (!message) return null;

  const getName = (c: Conversation) => {
    if (c.type === 'GROUP') return c.name || 'Group';
    const other = c.participants.find((p) => p.id !== currentUser?.id);
    return other?.displayName || 'Chat';
  };

  const getAvatar = (c: Conversation) => {
    if (c.type === 'GROUP') return c.avatar;
    return c.participants.find((p) => p.id !== currentUser?.id)?.avatar;
  };

  const filtered = conversations.filter((c) =>
    getName(c).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleForward = async (conversationId: string) => {
    if (sendingTo || sentTo.includes(conversationId)) return;
    setSendingTo(conversationId);
    try {
      await messagesApi.forward(message.id, conversationId);
      setSentTo((prev) => [...prev, conversationId]);
    } catch (err) {
      console.error('Failed to forward message:', err);
    } finally {
      setSendingTo(null);
    }
  };

  const messagePreview = message.type === 'TEXT'
    ? (message.content || '').slice(0, 80) + ((message.content || '').length > 80 ? '...' : '')
    : message.type === 'IMAGE'
      ? '📷 Photo'
      : message.type === 'AUDIO'
        ? '🎤 Voice Message'
        : message.type === 'FILE'
          ? '📎 File'
          : 'Message';

  const senderName = message.sender?.displayName || 'Unknown';

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="forward-title"
        tabIndex={-1}
        className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[500px] animate-scale-in focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 glass border-b border-wa-border">
          <h3 id="forward-title" className="font-bold text-wa-primary text-base flex items-center gap-2">
            <Forward className="w-4 h-4 text-wa-green" /> Forward to
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-wa-sidebar-hover rounded-full transition">
            <X className="w-5 h-5 text-wa-secondary" />
          </button>
        </div>

        {/* Message Preview */}
        <div className="px-4 py-3 border-b border-wa-border bg-wa-surface/30">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-wa-accent/15 flex items-center justify-center shrink-0 mt-0.5">
              <MessageSquare className="w-4 h-4 text-wa-accent" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] text-wa-secondary uppercase tracking-wider font-semibold block mb-0.5">
                Forwarding from {senderName}
              </span>
              <p className="text-[12px] text-wa-primary/80 line-clamp-2 leading-snug">
                {messagePreview}
              </p>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="p-4 pb-2">
          <div className="relative flex items-center bg-[#18181b] rounded-lg px-3 py-1.5 border border-wa-border">
            <Search className="w-4 h-4 text-wa-secondary mr-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats"
              className="bg-transparent border-none text-xs text-wa-primary placeholder-wa-secondary focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="px-2 pb-3 flex-grow overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 pt-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <div className="w-8 h-8 rounded-full bg-wa-sidebar-hover animate-pulse shrink-0" />
                  <div className="h-3 w-28 bg-wa-sidebar-hover animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-xs text-wa-secondary py-6">No chats found</div>
          ) : (
            filtered.map((c) => {
              const sent = sentTo.includes(c.id);
              return (
                <div
                  key={c.id}
                  onClick={() => handleForward(c.id)}
                  className="flex items-center justify-between py-2 px-2 cursor-pointer hover:bg-wa-sidebar-hover/40 rounded-lg transition"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <Avatar src={getAvatar(c)} name={getName(c)} size="sm" className="shrink-0" />
                    <span className="text-sm font-semibold truncate text-wa-primary">{getName(c)}</span>
                  </div>
                  {sent ? (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-wa-green shrink-0">
                      <Check className="w-3.5 h-3.5" /> Sent
                    </span>
                  ) : sendingTo === c.id ? (
                    <span className="text-[11px] text-wa-secondary shrink-0">Sending…</span>
                  ) : (
                    <span className="text-[11px] font-semibold text-wa-green shrink-0">Send</span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-wa-top-bar border-t border-wa-border flex justify-end shrink-0">
          <button type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-wa-secondary hover:text-wa-primary transition"
          >
            {sentTo.length > 0 ? 'Done' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  );
};
