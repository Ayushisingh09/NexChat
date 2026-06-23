import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Clock, Trash2 } from 'lucide-react';
import type { Message } from '../../types/chat.types';
import { messagesApi } from '../../api/messages.api';


interface ScheduledPanelProps {
  conversationId: string;
  onClose: () => void;
}

const ScheduledRow: React.FC<{ message: Message; onCancel: (id: string) => void }> = ({ message, onCancel }) => {
  const decryptedText = message.content || '';
  const when = message.scheduledAt ? new Date(message.scheduledAt) : null;

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg hover:bg-wa-sidebar-hover/40 transition">
      <div className="min-w-0 flex-1">
        <p className="text-sm text-wa-primary break-words line-clamp-3">{decryptedText || '…'}</p>
        {when && (
          <p className="text-[11px] text-wa-green mt-1 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {when.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
      </div>
      <button type="button"
        onClick={() => onCancel(message.id)}
        className="p-1.5 text-wa-secondary hover:text-red-400 hover:bg-wa-sidebar-hover rounded-full transition shrink-0"
        aria-label="Cancel scheduled message"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
};

export const ScheduledPanel: React.FC<ScheduledPanelProps> = ({ conversationId, onClose }) => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['scheduled', conversationId],
    queryFn: () => messagesApi.getScheduled(conversationId),
  });

  const messages = data?.messages || [];

  const cancel = async (id: string) => {
    try {
      await messagesApi.cancelScheduled(id);
      queryClient.setQueryData(['scheduled', conversationId], (old: any) => {
        if (!old) return old;
        return { ...old, messages: old.messages.filter((m: Message) => m.id !== id) };
      });
    } catch (err) {
      console.error('Failed to cancel scheduled message:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[70vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 glass border-b border-wa-border shrink-0">
          <h3 className="font-bold text-wa-primary text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-wa-green" /> Scheduled messages
          </h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-wa-sidebar-hover rounded-full transition">
            <X className="w-5 h-5 text-wa-secondary" />
          </button>
        </div>

        <div className="p-2 overflow-y-auto">
          {isLoading ? (
            <div className="text-center text-xs text-wa-secondary py-8">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-xs text-wa-secondary py-8">No scheduled messages</div>
          ) : (
            messages.map((m) => <ScheduledRow key={m.id} message={m} onCancel={cancel} />)
          )}
        </div>
      </div>
    </div>
  );
};
