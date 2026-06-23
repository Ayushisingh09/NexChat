import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Pin, Loader2, ArrowRight } from 'lucide-react';
import { messagesApi } from '../../api/messages.api';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import { useConversationStore } from '../../store/conversation.store';
import type { Message } from '../../types/chat.types';

const PinnedRow: React.FC<{ 
  message: Message; 
  onUnpin: (id: string) => void;
  onJump: () => void;
}> = ({ message, onUnpin, onJump }) => {
  const currentUser = useAuthStore((state) => state.user);
  const decryptedText = message.type === 'TEXT' ? (message.content || '') : '';

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

  const senderLabel = message.senderId === currentUser?.id ? 'You' : message.sender?.displayName || 'Unknown';

  const time = new Date(message.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-wa-sidebar-hover rounded-lg transition group">
      <div className="min-w-0 flex-grow cursor-pointer" onClick={onJump} title="Jump to message">
        <div className="flex items-center gap-2 text-[11px] text-wa-secondary mb-0.5">
          <span className="font-semibold text-wa-primary">{senderLabel}</span>
          <span>· {time}</span>
        </div>
        <p className="text-[13px] text-wa-primary truncate group-hover:text-wa-green transition">{message.isDeleted ? 'This message was deleted' : label}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button type="button"
          onClick={onJump}
          title="Jump to message"
          className="p-1 text-wa-secondary hover:text-wa-green hover:bg-wa-sidebar-hover rounded-full transition"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
        <button type="button"
          onClick={() => onUnpin(message.id)}
          title="Unpin message"
          className="p-1 text-wa-green hover:bg-wa-sidebar-hover rounded-full transition"
        >
          <Pin className="w-3.5 h-3.5 fill-current rotate-[45deg]" />
        </button>
      </div>
    </div>
  );
};

export const PinnedMessagesModal: React.FC = () => {
  const isOpen = useUiStore((state) => state.isPinnedOpen);
  const setOpen = useUiStore((state) => state.setPinnedOpen);
  const activeConversation = useConversationStore((state) => state.activeConversation);
  const setScrollToMessageId = useConversationStore((state) => state.setScrollToMessageId);

  const { data: messages = [], isLoading, refetch } = useQuery({
    queryKey: ['pinned', activeConversation?.id],
    queryFn: () => messagesApi.listPinned(activeConversation!.id),
    enabled: isOpen && !!activeConversation?.id,
  });

  if (!isOpen || !activeConversation) return null;

  const handleUnpin = async (id: string) => {
    try {
      await messagesApi.togglePin(id);
      refetch();
    } catch (err) {
      console.error('Failed to unpin:', err);
    }
  };

  const handleJump = (messageId: string) => {
    setScrollToMessageId(messageId);
    setOpen(false);
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 select-none animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[500px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 glass border-b border-wa-border">
          <h3 className="font-bold text-wa-primary text-base flex items-center gap-2">
            <Pin className="w-4 h-4 text-wa-green fill-current" /> Pinned Messages
          </h3>
          <button type="button" onClick={() => setOpen(false)} className="p-1 hover:bg-wa-sidebar-hover rounded-full transition">
            <X className="w-5 h-5 text-wa-secondary" />
          </button>
        </div>

        <div className="flex-grow overflow-y-auto p-2">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-wa-secondary">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading…
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center text-wa-secondary">
              <Pin className="w-8 h-8" />
              <p className="text-sm">No pinned messages yet</p>
              <p className="text-[11px] max-w-[245px]">Pin important messages so everyone in the chat can easily find them.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {messages.map((m) => (
                <PinnedRow 
                  key={m.id} 
                  message={m} 
                  onUnpin={handleUnpin} 
                  onJump={() => handleJump(m.id)} 
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
