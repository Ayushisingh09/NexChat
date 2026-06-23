import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../hooks/useSocket';
import { useNotifications } from '../hooks/useNotifications';
import { useTabBadge } from '../hooks/useTabBadge';
import { useConversations } from '../hooks/useConversations';
import { useConversationStore } from '../store/conversation.store';
import { useAuthStore } from '../store/auth.store';
import { useTypingStore } from '../store/typing.store';
import { useMqttSubscription } from '../hooks/useMqtt';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { usersApi } from '../api/users.api';
import { conversationsApi } from '../api/conversations.api';
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

const DirectMessagePage: React.FC = () => {
  const { username } = useParams<{ username: string }>();
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
  const queryClient = useQueryClient();
  const resolvedRef = useRef(false);

  // Global typing indicator via MQTT
  useMqttSubscription('typing/*', (_topic, payload: { conversationId: string; userId: string; displayName: string; action: 'start' | 'stop' }) => {
    if (payload.userId === currentUser?.id) return;
    if (payload.action === 'start') {
      setTyping(payload.conversationId, payload.userId, payload.displayName);
    } else {
      clearTyping(payload.conversationId, payload.userId);
    }
  });

  // Resolve DM by username param
  useEffect(() => {
    if (!username || resolvedRef.current) return;

    const resolveDm = async () => {
      try {
        const target = await usersApi.getByUsername(username);
        if (!target?.id || target.id === currentUser?.id) {
          navigate('/chat', { replace: true });
          return;
        }

        // Check if DM already exists in conversation list
        if (conversations && !isLoading) {
          const existing = conversations.find(
            (c) =>
              c.type === 'DIRECT' &&
              c.participants?.some((p) => p.id === target.id)
          );
          if (existing) {
            setActiveConversation(existing);
            resolvedRef.current = true;
            return;
          }
        }

        // Create new DM
        const chat = await conversationsApi.create({
          type: 'DIRECT',
          participantIds: [target.id],
        });
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        setActiveConversation(chat);
        resolvedRef.current = true;
      } catch {
        navigate('/chat', { replace: true });
      }
    };

    resolveDm();
  }, [username, conversations, isLoading, currentUser?.id, queryClient, setActiveConversation, navigate]);

  // Also try to find existing DM from loaded conversations
  useEffect(() => {
    if (!username || !conversations || isLoading || resolvedRef.current) return;
    const match = conversations.find(
      (c) =>
        c.type === 'DIRECT' &&
        c.participants?.some(
          (p) => p.username?.toLowerCase() === username.toLowerCase()
        )
    );
    if (match) {
      setActiveConversation(match);
      resolvedRef.current = true;
    }
  }, [username, conversations, isLoading, setActiveConversation]);

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

export default DirectMessagePage;
