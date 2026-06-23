import React, { useMemo } from 'react';
import type { Conversation } from '../../types/chat.types';
import { ConversationItem } from './ConversationItem';
import { ConversationItemSkeleton } from '../skeletons/ConversationItemSkeleton';
import { RefreshCw } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  activeId?: string;
  onSelect: (conversation: Conversation) => void;
  isLoading: boolean;
  isFetching?: boolean;
  error: any;
  onRetry: () => void;
  searchQuery: string;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeId,
  onSelect,
  isLoading,
  isFetching = false,
  error,
  onRetry,
  searchQuery,
}) => {
  const showSkeleton = isLoading || (conversations.length === 0 && isFetching);

  if (showSkeleton) {
    return (
      <div className="flex-1 overflow-y-auto">
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-6 h-full text-center space-y-3">
        <p className="text-sm text-wa-secondary">Couldn't load chats</p>
        <button type="button"
          onClick={onRetry}
          className="flex items-center space-x-2 px-4 py-2 bg-wa-surface-2 hover:bg-wa-active rounded-xl text-wa-primary text-sm font-semibold transition"
        >
          <RefreshCw className="w-4 h-4" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  const filtered = useMemo(() => conversations.filter((c) => {
    if (c.type === 'GROUP') {
      return c.name?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    const otherParticipant = c.participants.find((p) => p.displayName);
    return otherParticipant?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
  }), [conversations, searchQuery]);

  if (filtered.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 h-full text-center text-sm text-wa-secondary">
        {searchQuery ? 'No chats match your search' : 'No chats yet. Click new chat to start!'}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {filtered.map((c, index) => (
        <div
          key={c.id}
          className="animate-slide-up"
          style={{
            // Capped stagger so long lists don't lag the reveal
            animationDelay: `${Math.min(index, 12) * 30}ms`,
            animationFillMode: 'both',
          }}
        >
          <ConversationItem
            conversation={c}
            isActive={c.id === activeId}
            onClick={() => onSelect(c)}
          />
        </div>
      ))}
    </div>
  );
};
