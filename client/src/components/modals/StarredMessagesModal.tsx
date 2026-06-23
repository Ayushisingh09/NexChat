import React from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { X, Star, Loader2 } from 'lucide-react';
import { messagesApi } from '../../api/messages.api';
import { useUiStore } from '../../store/ui.store';
import { useAuthStore } from '../../store/auth.store';
import type { Message } from '../../types/chat.types';

const StarredRow: React.FC<{ message: Message; onUnstar: (id: string) => void }> = ({ message, onUnstar }) => {
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

  const conv = (message as any).conversation as { name?: string; type?: string } | undefined;
  const senderLabel = message.senderId === currentUser?.id ? 'You' : message.sender?.displayName || 'Unknown';

  const time = new Date(message.createdAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="flex items-start justify-between gap-3 px-3 py-2.5 hover:bg-wa-sidebar-hover rounded-lg transition">
      <div className="min-w-0 flex-grow">
        <div className="flex items-center gap-2 text-[11px] text-wa-secondary mb-0.5">
          <span className="font-semibold text-wa-primary">{senderLabel}</span>
          {conv?.name && <span>· {conv.name}</span>}
          <span>· {time}</span>
        </div>
        <p className="text-[13px] text-wa-primary truncate">{message.isDeleted ? 'This message was deleted' : label}</p>
      </div>
      <button type="button"
        onClick={() => onUnstar(message.id)}
        title="Unstar"
        className="p-1 text-amber-400 hover:bg-wa-sidebar-hover rounded-full transition shrink-0"
      >
        <Star className="w-4 h-4 fill-current" />
      </button>
    </div>
  );
};

export const StarredMessagesModal: React.FC = () => {
  const isOpen = useUiStore((state) => state.isStarredOpen);
  const setOpen = useUiStore((state) => state.setStarredOpen);

  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage, refetch } = useInfiniteQuery({
    queryKey: ['starred'],
    queryFn: ({ pageParam }) => messagesApi.getStarred(pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
    initialPageParam: undefined as string | undefined,
    enabled: isOpen,
  });

  if (!isOpen) return null;

  const messages: Message[] = data ? data.pages.flatMap((p) => p.messages) : [];

  const handleUnstar = async (id: string) => {
    try {
      await messagesApi.toggleStar(id);
      refetch();
    } catch (err) {
      console.error('Failed to unstar:', err);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 select-none animate-fade-in"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[560px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 glass border-b border-wa-border">
          <h3 className="font-bold text-wa-primary text-base flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400 fill-current" /> Starred Messages
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
              <Star className="w-8 h-8" />
              <p className="text-sm">No starred messages yet</p>
              <p className="text-[11px] max-w-[240px]">Long-press or right-click a message and tap Star to save it here.</p>
            </div>
          ) : (
            <>
              {messages.map((m) => (
                <StarredRow key={m.id} message={m} onUnstar={handleUnstar} />
              ))}
              {hasNextPage && (
                <button type="button"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="w-full py-2 text-xs font-semibold text-wa-green hover:bg-wa-sidebar-hover rounded-lg transition"
                >
                  {isFetchingNextPage ? 'Loading…' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
