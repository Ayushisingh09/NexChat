import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import { useNotifications } from '../hooks/useNotifications';
import { useTabBadge } from '../hooks/useTabBadge';
import { useConversations } from '../hooks/useConversations';
import { useConversationStore } from '../store/conversation.store';
import { useAuthStore } from '../store/auth.store';
import { useTypingStore } from '../store/typing.store';
import { useMqttSubscription } from '../hooks/useMqtt';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { AppLayout } from '../components/layout/AppLayout';
import { Sidebar } from '../components/sidebar/Sidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { EmptyChat } from '../components/chat/EmptyChat';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NewChatModal } from '../components/modals/NewChatModal';
import { NewGroupModal } from '../components/modals/NewGroupModal';
import { ContactInfoModal } from '../components/modals/ContactInfoModal';
import { StarredMessagesModal } from '../components/modals/StarredMessagesModal';
import { PinnedMessagesModal } from '../components/modals/PinnedMessagesModal';
import { FriendRequestsModal } from '../components/modals/FriendRequestsModal';
import { AppLockGate } from '../components/AppLockGate';
import { FullPageSkeleton } from '../components/skeletons/FullPageSkeleton';

const GroupPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  useSocket();
  useNotifications();
  useTabBadge();
  useKeyboardShortcuts();

  const { conversations, isLoading, isFetching, error, refetch } = useConversations();
  const activeConversation = useConversationStore((state) => state.activeConversation);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);
  const currentUser = useAuthStore((state) => state.user);
  const setTyping = useTypingStore((state) => state.setTyping);
  const clearTyping = useTypingStore((state) => state.clearTyping);

  // Global typing indicator via MQTT
  useMqttSubscription('typing/*', (_topic, payload: { conversationId: string; userId: string; displayName: string; action: 'start' | 'stop' }) => {
    if (payload.userId === currentUser?.id) return;
    if (payload.action === 'start') {
      setTyping(payload.conversationId, payload.userId, payload.displayName);
    } else {
      clearTyping(payload.conversationId, payload.userId);
    }
  });

  // Auto-select the group by URL param id
  useEffect(() => {
    if (!id || !conversations || isLoading) return;
    const match = conversations.find((c) => c.id === id && c.type === 'GROUP');
    if (match) {
      setActiveConversation(match);
    } else {
      navigate('/chat', { replace: true });
    }
  }, [id, conversations, isLoading, setActiveConversation, navigate]);

  if (isLoading) return <FullPageSkeleton />;

  return (
    <>
      <AppLayout
        sidebar={
          <Sidebar
            conversations={conversations}
            isLoading={isLoading}
            isFetching={isFetching}
            error={error}
            onRetry={refetch}
          />
        }
        chat={
          activeConversation ? (
            <ErrorBoundary>
              <ChatWindow conversation={activeConversation} />
            </ErrorBoundary>
          ) : (
            <EmptyChat />
          )
        }
      />

      <NewChatModal />
      <NewGroupModal />
      <ContactInfoModal />
      <StarredMessagesModal />
      <PinnedMessagesModal />
      <FriendRequestsModal />
      <AppLockGate />
    </>
  );
};

export default GroupPage;
