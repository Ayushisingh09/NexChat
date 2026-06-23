import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usersApi } from '../../api/users.api';
import { conversationsApi } from '../../api/conversations.api';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import { useAuthStore } from '../../store/auth.store';
import { useConversationStore } from '../../store/conversation.store';
import { searchLocalIndex, type IndexedMessage } from '../../utils/searchIndex';
import type { User, Conversation, Message } from '../../types/chat.types';
import { User as UserIcon, MessageSquare, Loader2, Search, ArrowRight, Lock, Users, Image } from 'lucide-react';
import { Avatar } from '../layout/Avatar';

interface GlobalSearchResultsProps {
  query: string;
  onSelectConversation: (conv: Conversation) => void;
  onCloseSearch: () => void;
}

/** Highlight query match within text */
const HighlightMatch: React.FC<{ text: string; query: string }> = ({ text, query }) => {
  if (!query) return <>{text}</>;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={`hl-${i}`} className="bg-wa-green/30 text-wa-green rounded px-0.5 font-semibold">
            {part}
          </mark>
        ) : (
          <React.Fragment key={`hl-${i}`}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

/** A single message search result card */
const MessageResultCard: React.FC<{
  message: Message;
  query: string;
  index: number;
  onClick: () => void;
}> = ({ message, query, index, onClick }) => {
  const currentUser = useAuthStore((s) => s.user);
  const decryptedText = message.type === 'TEXT' ? (message.content || '') : '';

  const senderName = message.sender?.displayName || 'Unknown';
  const conv = (message as any).conversation;
  const convName = conv?.type === 'GROUP'
    ? conv.name || 'Group'
    : conv?.participants?.find((p: any) => p.userId !== currentUser?.id)?.user?.displayName || senderName;

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

  const time = new Date(message.createdAt).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
  });

  return (
    <button type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-wa-sidebar-hover/80 transition-all duration-200 group/card border border-transparent hover:border-wa-border/40 animate-slide-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green shrink-0 mt-0.5">
          <MessageSquare className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-wa-primary truncate">{convName}</span>
            <span className="text-[10px] text-wa-secondary shrink-0">{time}</span>
          </div>
          <p className="text-[12px] text-wa-secondary line-clamp-2 leading-relaxed">
            <span className="text-wa-primary/70 font-medium">{senderName}:</span>{' '}
            <HighlightMatch text={label} query={query} />
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-wa-secondary opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 mt-2" />
      </div>
    </button>
  );
};

/** Result card for a locally indexed message. */
const LocalResultCard: React.FC<{
  entry: IndexedMessage;
  query: string;
  index: number;
  conversationName: string;
  onClick: () => void;
}> = ({ entry, query, index, conversationName, onClick }) => {
  const time = new Date(entry.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
  return (
    <button type="button"
      onClick={onClick}
      className="w-full text-left p-3 rounded-xl hover:bg-wa-sidebar-hover/80 transition-all duration-200 group/card border border-transparent hover:border-wa-border/40 animate-slide-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms`, animationFillMode: 'both' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-wa-green/10 flex items-center justify-center text-wa-green shrink-0 mt-0.5">
          <Lock className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className="text-[13px] font-semibold text-wa-primary truncate">{conversationName}</span>
            <span className="text-[10px] text-wa-secondary shrink-0">{time}</span>
          </div>
          <p className="text-[12px] text-wa-secondary line-clamp-2 leading-relaxed">
            <HighlightMatch text={entry.plaintext} query={query} />
          </p>
        </div>
        <ArrowRight className="w-3.5 h-3.5 text-wa-secondary opacity-0 group-hover/card:opacity-100 transition-opacity shrink-0 mt-2" />
      </div>
    </button>
  );
};

export const GlobalSearchResults: React.FC<GlobalSearchResultsProps> = ({
  query,
  onSelectConversation,
  onCloseSearch,
}) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [localResults, setLocalResults] = useState<IndexedMessage[]>([]);
  const queryClient = useQueryClient();

  const {
    messages: searchMessages,
    isLoading: messagesLoading,
    isFetching: messagesFetching,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    debouncedQuery,
  } = useGlobalSearch(query);

  useEffect(() => {
    if (!query.trim()) {
      setContacts([]);
      return;
    }

    setContactsLoading(true);
    const debounce = setTimeout(async () => {
      try {
        const results = await usersApi.search(query.trim());
        setContacts(results);
      } catch (err) {
        console.error('Contact search failed:', err);
      } finally {
        setContactsLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounce);
  }, [query]);

      // Local message index search
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setLocalResults([]);
      return;
    }
    const debounce = setTimeout(async () => {
      setLocalResults(await searchLocalIndex(q));
    }, 250);
    return () => clearTimeout(debounce);
  }, [query]);

  const conversationNameFor = (conversationId: string): string => {
    const convs = queryClient.getQueryData<Conversation[]>(['conversations']);
    const conv = convs?.find((c) => c.id === conversationId);
    if (!conv) return 'Chat';
    if (conv.type === 'GROUP') return conv.name || 'Group';
    const currentUserId = useAuthStore.getState().user?.id;
    return conv.participants.find((p) => p.id !== currentUserId)?.displayName || 'Chat';
  };

  const handleOpenLocalResult = (entry: IndexedMessage) => {
    const convs = queryClient.getQueryData<Conversation[]>(['conversations']);
    const conv = convs?.find((c) => c.id === entry.conversationId);
    if (!conv) return;
    useConversationStore.getState().setScrollToMessageId(entry.messageId);
    onSelectConversation(conv);
    onCloseSearch();
  };

  // Avoid duplicates: skip server hits already found locally
  const localIds = new Set(localResults.map((r) => r.messageId));

  const handleStartContactChat = async (userId: string) => {
    try {
      const chat = await conversationsApi.create({
        type: 'DIRECT',
        participantIds: [userId],
      });
      onSelectConversation(chat);
      onCloseSearch();
    } catch (err) {
      console.error('Failed to create chat:', err);
    }
  };

  const handleOpenMessageChat = (message: Message) => {
    const conv = (message as any).conversation;
    if (!conv) return;
    // Build a lightweight conversation object for navigation
    const conversation: Conversation = {
      id: conv.id,
      type: conv.type,
      name: conv.name,
      avatar: conv.avatar,
      participants: conv.participants?.map((p: any) => ({
        id: p.userId || p.user?.id,
        displayName: p.user?.displayName,
        avatar: p.user?.avatar,
        isOnline: false,
        lastSeen: '',
      })) || [],
      unreadCount: 0,
      updatedAt: message.createdAt,
    };
    useConversationStore.getState().setScrollToMessageId(message.id);
    onSelectConversation(conversation);
    onCloseSearch();
  };

  const convs = queryClient.getQueryData<Conversation[]>(['conversations']);
  const matchingGroupsCount = (convs || []).filter(
    (c) => c.type === 'GROUP' && c.name?.toLowerCase().includes(query.trim().toLowerCase())
  ).length;
  const isEmptyState = !contactsLoading && !messagesLoading && contacts.length === 0 && searchMessages.length === 0 && localResults.length === 0 && matchingGroupsCount === 0 && debouncedQuery.length > 0;

  if (!query.trim()) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none">
        <div className="w-16 h-16 rounded-2xl bg-wa-green/10 flex items-center justify-center mb-4">
          <Search className="w-7 h-7 text-wa-green/60" />
        </div>
        <p className="text-sm text-wa-secondary">Search contacts and messages</p>
        <p className="text-[11px] text-wa-secondary/60 mt-1">Type at least 2 characters to search messages</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto select-none bg-wa-sidebar">
      {/* Contacts Section */}
      <div className="p-3 pb-1">
        <h4 className="text-[11px] font-bold text-wa-green uppercase tracking-wider px-1 mb-2 flex items-center gap-2">
          <UserIcon className="w-3 h-3" />
          Contacts
          {contactsLoading && <Loader2 className="w-3 h-3 animate-spin text-wa-secondary" />}
        </h4>

        {contacts.length === 0 && !contactsLoading ? (
          <p className="text-[11px] text-wa-secondary/70 px-1 pb-2">No contacts found</p>
        ) : (
          <div className="space-y-0.5">
            {contacts.slice(0, 6).map((contact, idx) => (
              <button type="button"
                key={contact.id}
                onClick={() => handleStartContactChat(contact.id)}
                className="w-full flex items-center gap-3 p-2.5 hover:bg-wa-sidebar-hover rounded-xl cursor-pointer transition-all duration-200 group/contact animate-slide-up"
                style={{ animationDelay: `${idx * 35}ms`, animationFillMode: 'both' }}
              >
                <Avatar
                  src={contact.avatar}
                  name={contact.displayName}
                  size="sm"
                  className="ring-1 ring-white/5"
                />
                <div className="min-w-0 flex-1 text-left">
                  <span className="text-[13px] font-semibold block text-wa-primary truncate">
                    <HighlightMatch text={contact.displayName || ''} query={query} />
                  </span>
                  <span className="text-[10px] text-wa-secondary block truncate">
                    {contact.username ? `@${contact.username}` : ''}
                  </span>
                </div>
                {contact.isOnline && (
                  <span className="w-2 h-2 rounded-full bg-online-dot shrink-0" />
                )}
              </button>
            ))}
            {contacts.length > 6 && (
              <p className="text-[10px] text-wa-secondary text-center py-1">
                +{contacts.length - 6} more contacts
              </p>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="mx-3 border-t border-wa-border/40" />

      {/* Groups Section */}
      {(() => {
        const matchingGroups = (convs || []).filter(
          (c) => c.type === 'GROUP' && c.name?.toLowerCase().includes(query.trim().toLowerCase())
        );
        if (matchingGroups.length === 0) return null;
        return (
          <>
            <div className="p-3 pb-1">
              <h4 className="text-[11px] font-bold text-wa-green uppercase tracking-wider px-1 mb-2 flex items-center gap-2">
                <Users className="w-3 h-3" />
                Groups
              </h4>
              <div className="space-y-0.5">
                {matchingGroups.slice(0, 5).map((group, idx) => {
                  const memberCount = group.participants?.length || 0;
                  return (
                    <button type="button"
                      key={group.id}
                      onClick={() => {
                        onSelectConversation(group);
                        onCloseSearch();
                      }}
                      className="w-full flex items-center gap-3 p-2.5 hover:bg-wa-sidebar-hover rounded-xl cursor-pointer transition-all duration-200 group/contact animate-slide-up"
                      style={{ animationDelay: `${idx * 35}ms`, animationFillMode: 'both' }}
                    >
                      <Avatar
                        src={group.avatar}
                        name={group.name || 'Group'}
                        size="sm"
                        className="ring-1 ring-white/5 shrink-0"
                      />
                      <div className="min-w-0 flex-1 text-left">
                        <span className="text-[13px] font-semibold block text-wa-primary truncate">
                          <HighlightMatch text={group.name || 'Group'} query={query} />
                        </span>
                        <span className="text-[10px] text-wa-secondary block truncate">
                          {memberCount} participant{memberCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-wa-secondary opacity-0 group-hover/contact:opacity-100 transition-opacity shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="mx-3 border-t border-wa-border/40" />
          </>
        );
      })()}

      {/* Media Section */}
      {(() => {
        const mediaResults = searchMessages.filter(
          (m) => ['IMAGE', 'VIDEO', 'AUDIO'].includes(m.type)
        ).filter((m) => !localIds.has(m.id));
        if (mediaResults.length === 0) return null;
        return (
          <div className="p-3 pb-1">
            <h4 className="text-[11px] font-bold text-wa-green uppercase tracking-wider px-1 mb-2 flex items-center gap-2">
              <Image className="w-3 h-3" />
              Media
            </h4>
            <div className="space-y-0.5">
              {mediaResults.slice(0, 4).map((msg, idx) => {
                const conv = (msg as any).conversation;
                const senderName = msg.sender?.displayName || 'Unknown';
                const typeLabel =
                  msg.type === 'IMAGE' ? '📷 Photo' :
                  msg.type === 'VIDEO' ? '🎥 Video' :
                  '🎵 Voice message';
                return (
                  <button type="button"
                    key={msg.id}
                    onClick={() => handleOpenMessageChat(msg)}
                    className="w-full text-left p-3 rounded-xl hover:bg-wa-sidebar-hover/80 transition-all duration-200 group/card border border-transparent hover:border-wa-border/40 animate-slide-up"
                    style={{ animationDelay: `${Math.min(idx, 8) * 40}ms`, animationFillMode: 'both' }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-lg bg-wa-sidebar-hover flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-white/5">
                        {msg.type === 'IMAGE' && msg.mediaUrl ? (
                          <img src={msg.mediaUrl} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Image className="w-4 h-4 text-wa-secondary" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <span className="text-[13px] font-semibold text-wa-primary truncate">{typeLabel}</span>
                          <span className="text-[10px] text-wa-secondary shrink-0">
                            {new Date(msg.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </span>
                        </div>
                        <p className="text-[11px] text-wa-secondary truncate">
                          {senderName} · {conv?.name || conv?.participants?.find((p: any) => p.userId !== msg.senderId)?.user?.displayName || 'Chat'}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* Divider */}
      <div className="mx-3 border-t border-wa-border/40" />

      {/* Messages Section */}
      <div className="p-3 pb-2">
        <h4 className="text-[11px] font-bold text-wa-green uppercase tracking-wider px-1 mb-2 flex items-center gap-2">
          <MessageSquare className="w-3 h-3" />
          Messages
          {(messagesLoading || messagesFetching) && searchMessages.length === 0 && (
            <Loader2 className="w-3 h-3 animate-spin text-wa-secondary" />
          )}
        </h4>

        {searchMessages.length === 0 && localResults.length === 0 && !messagesLoading && !messagesFetching ? (
          <p className="text-[11px] text-wa-secondary/70 px-1 pb-2">
            {debouncedQuery.length <= 1
              ? 'Type at least 2 characters to search messages'
              : 'No messages found'}
          </p>
        ) : (
          <div className="space-y-0.5">
            {localResults.map((entry, idx) => (
              <LocalResultCard
                key={`local-${entry.messageId}`}
                entry={entry}
                query={query.trim()}
                index={idx}
                conversationName={conversationNameFor(entry.conversationId)}
                onClick={() => handleOpenLocalResult(entry)}
              />
            ))}
            {searchMessages.filter((m) => !localIds.has(m.id)).map((msg, idx) => (
              <MessageResultCard
                key={msg.id}
                message={msg}
                query={debouncedQuery}
                index={localResults.length + idx}
                onClick={() => handleOpenMessageChat(msg)}
              />
            ))}

            {hasNextPage && (
              <button type="button"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="w-full py-2.5 text-[11px] font-semibold text-wa-green hover:bg-wa-sidebar-hover rounded-xl transition-all duration-200 flex items-center justify-center gap-2"
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more results'
                )}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {isEmptyState && (
        <div className="flex flex-col items-center justify-center py-8 text-center animate-fade-in">
          <div className="w-12 h-12 rounded-xl bg-wa-sidebar-hover flex items-center justify-center mb-3">
            <Search className="w-5 h-5 text-wa-secondary/50" />
          </div>
          <p className="text-xs text-wa-secondary">No results for "{debouncedQuery}"</p>
          <p className="text-[10px] text-wa-secondary/60 mt-1">Try a different search term</p>
        </div>
      )}
    </div>
  );
};
