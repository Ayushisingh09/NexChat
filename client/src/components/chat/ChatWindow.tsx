import React, { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Conversation, Message } from '../../types/chat.types';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TypingIndicator } from './TypingIndicator';
import { ForwardModal } from '../modals/ForwardModal';
import { ScheduledPanel } from '../modals/ScheduledPanel';
import { SearchResults } from './SearchResults';
import { useMessages } from '../../hooks/useMessages';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useAuthStore } from '../../store/auth.store';
import { useConversationStore } from '../../store/conversation.store';
import { useTypingStore } from '../../store/typing.store';
import { useMqttSubscription, useMqttPublish } from '../../hooks/useMqtt';
import { callsApi } from '../../api/calls.api';
import { Upload } from 'lucide-react';
import { CircularProgress } from './CircularProgress';
import { UploadCard } from '../ui/upload-card';


interface ChatWindowProps {
  conversation: Conversation;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({ conversation }) => {
  const currentUser = useAuthStore((state) => state.user);
  const blockedUserIds = useConversationStore((state) => state.blockedUserIds);

  const otherParticipant = conversation.type === 'DIRECT'
    ? conversation.participants.find((p) => p.id !== currentUser?.id)
    : null;

  const {
    messages,
    isLoading,
    error,
    refetch,
    loadMore,
    hasMore,
    isFetchingNextPage,
    sendMessage,
    retryMessage,
    editMessage,
    scheduleMessage,
  } = useMessages(conversation.id);

  const { uploadFile, uploading, progress } = useMediaUpload();

  // Fetch call history for this conversation (filters to calls between current user and other participant)
  const { data: callHistory = [] } = useQuery({
    queryKey: ['call-history', conversation.id],
    queryFn: async () => {
      if (conversation.type !== 'DIRECT' || !otherParticipant) return [];
      const { calls: allCalls } = await callsApi.history();
      return allCalls.filter(
        (c) =>
          (c.callerId === currentUser?.id && c.calleeId === otherParticipant.id) ||
          (c.callerId === otherParticipant.id && c.calleeId === currentUser?.id)
      );
    },
    staleTime: 30000,
    enabled: conversation.type === 'DIRECT',
  });

  // Drag and drop state & handlers
  const [isDragging, setIsDragging] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      setIsDragging(false);
      dragCounterRef.current = 0;
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      await handleAttachFile(file);
    }
  };

  useEffect(() => {
    setIsDragging(false);
    dragCounterRef.current = 0;
  }, [conversation.id]);

  // State controls
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [forwardMessage, setForwardMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [editingText, setEditingText] = useState('');

  // Uploading previews — show local thumbnails before upload completes
  const [uploadingPreviews, setUploadingPreviews] = useState<{ id: string; objectUrl: string; fileName: string }[]>([]);

  // Search overlay state — full-screen Discord-style
  const [showSearch, setShowSearch] = useState(false);
  const [showScheduled, setShowScheduled] = useState(false);
  const [scrollToId, setScrollToId] = useState<string | null>(null);

  const storeScrollToId = useConversationStore((state) => state.scrollToMessageId);
  const setStoreScrollToId = useConversationStore((state) => state.setScrollToMessageId);

  // Derive the display name for the search overlay header
  const conversationName = conversation.type === 'GROUP'
    ? conversation.name || 'Group'
    : otherParticipant?.displayName || 'Chat';

  const handleJumpToMessage = (messageId: string) => {
    // Reset first so re-clicking the same message still triggers a scroll
    setScrollToId(null);
    requestAnimationFrame(() => setScrollToId(messageId));
  };

  useEffect(() => {
    if (storeScrollToId) {
      handleJumpToMessage(storeScrollToId);
      setStoreScrollToId(null);
    }
  }, [storeScrollToId, setStoreScrollToId]);

  // Typing states
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const typingUserRef = useRef<string>('');
  const setTyping = useTypingStore((s) => s.setTyping);
  const clearTyping = useTypingStore((s) => s.clearTyping);
  const { publish } = useMqttPublish();

  // MQTT typing subscription
  const typingTopic = `typing/${conversation.id}`;
  useMqttSubscription(typingTopic, (_topic, payload: { userId: string; displayName: string; action: 'start' | 'stop' }) => {
    if (payload.userId === currentUser?.id) return;
    if (payload.action === 'start') {
      typingUserRef.current = payload.displayName;
      setIsOtherTyping(true);
      setTyping(conversation.id, payload.userId, payload.displayName);
    } else {
      setIsOtherTyping(false);
      clearTyping(conversation.id, payload.userId);
    }
  });

  const handleSend = (
    content: string,
    type: 'TEXT' | 'IMAGE' | 'FILE' | 'AUDIO',
    mentionedUserIds?: string[],
    mentionEveryone?: boolean
  ) => {
    sendMessage({
      conversationId: conversation.id,
      content,
      type,
      replyToId: replyTo?.id,
      mentionedUserIds,
      mentionEveryone,
    });
    setReplyTo(null);
  };

  const handleSchedule = async (content: string, scheduledAt: string) => {
    try {
      await scheduleMessage(content, scheduledAt, replyTo?.id);
      setReplyTo(null);
      setShowScheduled(true);
    } catch (err) {
      console.error('Failed to schedule message:', err);
    }
  };

  const isAdmin =
    conversation.type === 'GROUP' &&
    conversation.participants.find((p) => p.id === currentUser?.id)?.role === 'ADMIN';

  const handleStartEdit = (message: Message, decryptedText: string) => {
    setReplyTo(null);
    setEditingMessage(message);
    setEditingText(decryptedText);
  };

  const handleSubmitEdit = (content: string) => {
    if (editingMessage) {
      editMessage(editingMessage.id, content);
    }
    setEditingMessage(null);
    setEditingText('');
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setEditingText('');
  };

  const handleTypingStart = () => {
    if (currentUser) {
      publish(typingTopic, {
        userId: currentUser.id,
        displayName: currentUser.displayName,
        action: 'start',
      });
    }
  };

  const handleTypingStop = () => {
    if (currentUser) {
      publish(typingTopic, {
        userId: currentUser.id,
        action: 'stop',
      });
    }
  };

  // Upload attachments and send
  const handleAttachFile = async (file: File) => {
    const previewId = `upload-${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);

    setUploadingPreviews((prev) => [...prev, { id: previewId, objectUrl, fileName: file.name }]);

    try {
      const { publicUrl, type } = await uploadFile(file);
      setUploadingPreviews((prev) => prev.filter((p) => p.id !== previewId));
      URL.revokeObjectURL(objectUrl);

      if (publicUrl) {
        sendMessage({
          conversationId: conversation.id,
          content: file.name,
          type,
          mediaUrl: publicUrl,
          replyToId: replyTo?.id,
        });
        setReplyTo(null);
      }
    } catch (err: any) {
      setUploadingPreviews((prev) => prev.filter((p) => p.id !== previewId));
      URL.revokeObjectURL(objectUrl);
      console.error('Upload attachment failed:', err);
      const { showToast } = await import('../layout/ToastHost');
      showToast(err?.message || 'Upload failed. Try again.');
    }
  };

  return (
    <div
      className={`flex flex-col h-full relative animate-fade-in w-full max-w-full min-w-0 overflow-x-hidden ${conversation.type === 'GROUP' ? 'group-chat-bg' : 'bg-wa-chat'}`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Top Chat Header */}
      <ChatHeader
        conversation={conversation}
        onSearchClick={() => setShowSearch(true)}
      />

      {/* Message List area */}
      <div className="flex-1 overflow-hidden relative w-full min-w-0">
        <MessageList
          messages={messages}
          isGroup={conversation.type === 'GROUP'}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          hasMore={hasMore}
          onLoadMore={loadMore}
          isFetchingNextPage={isFetchingNextPage}
          onReplyClick={setReplyTo}
          onForward={setForwardMessage}
          onEdit={handleStartEdit}
          onRetryMessage={retryMessage}
          conversationId={conversation.id}
          unreadCount={conversation.unreadCount}
          scrollToMessageId={scrollToId}
          callHistory={callHistory}
          typingIndicator={
            <div className="px-4 py-2">
              <TypingIndicator
                show={isOtherTyping}
                displayName={conversation.type === 'GROUP' ? typingUserRef.current : undefined}
              />
            </div>
          }
        />
      </div>

      {/* Uploading previews with circular progress */}
      {uploadingPreviews.length > 0 && (
        <div className="px-4 py-2 flex gap-3 overflow-x-auto shrink-0 border-t border-white/[0.04]">
          {uploadingPreviews.map((preview) => (
            <div key={preview.id} className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 ring-1 ring-white/[0.08] group">
              <img src={preview.objectUrl} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <CircularProgress percent={progress} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Upload Progress Card */}
      {uploading && (
        <div className="px-4 py-2 shrink-0 animate-fade-in flex justify-center">
          <UploadCard
            status="uploading"
            progress={progress}
            title="Uploading file"
            description={progress < 100 ? "Your file is being uploaded..." : "Processing your file..."}
            primaryButtonText="Cancel"
            onPrimaryButtonClick={() => {
              setUploadingPreviews([]);
            }}
          />
        </div>
      )}

      {/* Message Input panel */}
      {otherParticipant && blockedUserIds.includes(otherParticipant.id) ? (
        <div className="bg-[#1f2c34] border-t border-white/[0.04] p-4 text-center text-sm text-wa-secondary select-none shrink-0 flex flex-col items-center justify-center space-y-2">
          <span>You blocked this contact. Unblock to send messages.</span>
          <button type="button"
            onClick={async () => {
              try {
                await useConversationStore.getState().unblockUser(otherParticipant.id);
              } catch (err) {
                console.error(err);
              }
            }}
            className="text-wa-accent hover:underline text-xs font-semibold uppercase tracking-wider"
          >
            Unblock
          </button>
        </div>
      ) : (
        <MessageInput
          conversationId={conversation.id}
          isGroup={conversation.type === 'GROUP'}
          isAdmin={isAdmin}
          isAnnouncementMode={conversation.isAnnouncementMode}
          participants={conversation.participants}
          currentUserId={currentUser?.id}
          onSend={handleSend}
          onSchedule={handleSchedule}
          onTypingStart={handleTypingStart}
          onTypingStop={handleTypingStop}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onAttachFile={handleAttachFile}
          editingMessage={editingMessage}
          editingText={editingText}
          onSubmitEdit={handleSubmitEdit}
          onCancelEdit={handleCancelEdit}
        />
      )}

      {/* Forward message picker */}
      <ForwardModal message={forwardMessage} onClose={() => setForwardMessage(null)} />

      {/* Scheduled messages panel */}
      {showScheduled && (
        <ScheduledPanel conversationId={conversation.id} onClose={() => setShowScheduled(false)} />
      )}

      {/* Glass-themed centered search overlay */}
      <SearchResults
        conversationId={conversation.id}
        conversationName={conversationName}
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
        onJump={handleJumpToMessage}
      />

      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-wa-chat/80 flex flex-col items-center justify-center p-6 pointer-events-none transition-all duration-300">
          <div className="border-2 border-dashed border-wa-accent/50 rounded-3xl w-full h-full flex flex-col items-center justify-center gap-4 animate-pulse-border bg-wa-chat/20">
            <div className="w-16 h-16 rounded-2xl bg-[#2a3a45] flex items-center justify-center text-wa-accent">
              <Upload size={32} className="animate-bounce" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-semibold text-wa-primary">Upload to {conversationName}</h3>
              <p className="text-sm text-wa-secondary mt-1">Drop files here to instantly attach them</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

