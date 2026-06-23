import React, { useEffect, useRef, lazy, Suspense } from 'react';

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
import { PENDING_CHAT_KEY } from './InviteResolver';
import { AppLayout } from '../components/layout/AppLayout';
import { Sidebar } from '../components/sidebar/Sidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import { EmptyChat } from '../components/chat/EmptyChat';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { useUiStore } from '../store/ui.store';
import { useQuery } from '@tanstack/react-query';
import { storiesApi } from '../api/stories.api';
import { orderStoryFeed } from '../utils/stories.utils';

const NewChatModal = lazy(() => import('../components/modals/NewChatModal').then(m => ({ default: m.NewChatModal })));
const NewGroupModal = lazy(() => import('../components/modals/NewGroupModal').then(m => ({ default: m.NewGroupModal })));
const ContactInfoModal = lazy(() => import('../components/modals/ContactInfoModal').then(m => ({ default: m.ContactInfoModal })));
const StarredMessagesModal = lazy(() => import('../components/modals/StarredMessagesModal').then(m => ({ default: m.StarredMessagesModal })));
const PinnedMessagesModal = lazy(() => import('../components/modals/PinnedMessagesModal').then(m => ({ default: m.PinnedMessagesModal })));
const FriendRequestsModal = lazy(() => import('../components/modals/FriendRequestsModal').then(m => ({ default: m.FriendRequestsModal })));
const AppLockGate = lazy(() => import('../components/AppLockGate').then(m => ({ default: m.AppLockGate })));
const StoryViewer = lazy(() => import('../components/stories/StoryViewer').then(m => ({ default: m.StoryViewer })));
const CreateStoryModal = lazy(() => import('../components/stories/CreateStoryModal').then(m => ({ default: m.CreateStoryModal })));

const ChatPage: React.FC = () => {
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
  const handledInvite = useRef(false);

  const storyViewerIndex = useUiStore((state) => state.storyViewerIndex);
  const setStoryViewerIndex = useUiStore((state) => state.setStoryViewerIndex);
  const isCreateStoryOpen = useUiStore((state) => state.isCreateStoryOpen);
  const setCreateStoryOpen = useUiStore((state) => state.setCreateStoryOpen);
  const { data: rawStoriesFeed = [] } = useQuery({
    queryKey: ['stories'],
    queryFn: storiesApi.feed,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
  });
  // Must match StoriesBar's ordering so the index it passes lines up.
  const storiesFeed = orderStoryFeed(rawStoriesFeed, currentUser?.id);

  // Global typing indicator via MQTT
  useMqttSubscription('typing/*', (_topic, payload: { conversationId: string; userId: string; displayName: string; action: 'start' | 'stop' }) => {
    if (payload.userId === currentUser?.id) return;
    if (payload.action === 'start') {
      setTyping(payload.conversationId, payload.userId, payload.displayName);
    } else {
      clearTyping(payload.conversationId, payload.userId);
    }
  });

  // Open a chat from a /u/:username deep link stashed by InviteResolver.
  useEffect(() => {
    if (handledInvite.current) return;
    const username = sessionStorage.getItem(PENDING_CHAT_KEY);
    if (!username) return;
    handledInvite.current = true;
    sessionStorage.removeItem(PENDING_CHAT_KEY);

    (async () => {
      try {
        const target = await usersApi.getByUsername(username);
        if (!target?.id || target.id === currentUser?.id) return;
        const chat = await conversationsApi.create({ type: 'DIRECT', participantIds: [target.id] });
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        setActiveConversation(chat);
      } catch {
        /* invalid/unknown username — ignore */
      }
    })();
  }, [currentUser?.id, queryClient, setActiveConversation]);

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

      <Suspense fallback={null}>
        <NewChatModal />
        <NewGroupModal />
        <ContactInfoModal />
        <StarredMessagesModal />
        <PinnedMessagesModal />
        <FriendRequestsModal />
        <AppLockGate />
      </Suspense>

      {storyViewerIndex !== null && storiesFeed.length > 0 && (
        <Suspense fallback={null}>
          <StoryViewer
            feed={storiesFeed}
            initialGroupIndex={Math.min(storyViewerIndex, storiesFeed.length - 1)}
            onClose={() => setStoryViewerIndex(null)}
          />
        </Suspense>
      )}
      {isCreateStoryOpen && (
        <Suspense fallback={null}>
          <CreateStoryModal onClose={() => setCreateStoryOpen(false)} />
        </Suspense>
      )}
    </>
  );
};

export default ChatPage;
