import { useEffect, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '../store/socket.store';
import { useAuthStore } from '../store/auth.store';
import { useConversationStore } from '../store/conversation.store';
import { getToken } from 'firebase/messaging';
import { usersApi } from '../api/users.api';
import { messagingPromise, VAPID_KEY, isValidVapidKey } from '../lib/firebase';
import { showMessageToast } from '../components/layout/ToastHost';
import type { Conversation, Message } from '../types/chat.types';

export const useNotifications = () => {
  const socket = useSocketStore((state) => state.socket);
  const currentUser = useAuthStore((state) => state.user);
  const activeConversation = useConversationStore((state) => state.activeConversation);
  const queryClient = useQueryClient();
  const activeConvRef = useRef(activeConversation);
  activeConvRef.current = activeConversation;

  // Request browser Notification permissions
  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support desktop notifications.');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }

    return false;
  }, []);

  // Display a native (OS) notification — only when the tab is hidden.
  const showNotification = useCallback(
    (title: string, options?: NotificationOptions, onClick?: () => void) => {
      if (Notification.permission !== 'granted') return;
      if (document.visibilityState === 'visible') return;

      try {
        const notification = new Notification(title, {
          icon: '/logo.png',
          badge: '/logo.png',
          ...options,
        });

        notification.onclick = () => {
          window.focus();
          onClick?.();
          notification.close();
        };
      } catch (err) {
        console.error('Failed to show notification:', err);
      }
    },
    []
  );

  // Register FCM token
  const registerFcmToken = useCallback(async () => {
    try {
      const hasPermission = await requestPermission();
      if (!hasPermission) return;

      const messaging = await messagingPromise;
      if (!messaging) {
        console.warn('FCM not supported in this browser; skipping push registration.');
        return;
      }

      if (!VAPID_KEY) {
        console.warn('VITE_FIREBASE_VAPID_KEY is not set; skipping push registration.');
        return;
      }

      if (!isValidVapidKey(VAPID_KEY)) {
        console.warn(
          'VITE_FIREBASE_VAPID_KEY is malformed; skipping push registration. ' +
            'It must be the Web Push certificate "Key pair" public key from Firebase Console ' +
            '(Project Settings > Cloud Messaging > Web Push certificates) — an ~87-char base64url ' +
            'string starting with "B", with no surrounding quotes or whitespace.'
        );
        return;
      }

      const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swRegistration,
      });

      if (!token) {
        console.warn('No FCM token returned.');
        return;
      }

      // Skip the API call if this device already saved this exact token for this user.
      const dedupeKey = `fcm:saved:${useAuthStore.getState().user?.id}`;
      if (localStorage.getItem(dedupeKey) === token) return;

      await usersApi.saveFcmToken(token);
      localStorage.setItem(dedupeKey, token);
      console.log('FCM token registered successfully.');
    } catch (err) {
      console.error('Failed to register FCM token:', err);
    }
  }, [requestPermission]);

  // Handle incoming socket messages to trigger notifications
  useEffect(() => {
    if (!socket || !currentUser) return;

    const handleNewMessage = (message: Message) => {
      // Don't notify for your own messages
      if (message.senderId === currentUser.id) return;

      // Respect the user's global notifications switch (account-wide opt-out).
      if (currentUser.notificationsEnabled === false) return;

      const visible = document.visibilityState === 'visible';
      const isActive = activeConvRef.current?.id === message.conversationId;

      // Seen: actively viewing this conversation with the tab focused → the
      // message is read on arrival, so no notification and no badge.
      if (isActive && visible) return;

      // Don't notify for muted conversations — unless the current user is mentioned
      const isMentioned = !!message.mentionedUserIds?.includes(currentUser.id);
      const convs = queryClient.getQueryData<Conversation[]>(['conversations']);
      const conv = convs?.find((c) => c.id === message.conversationId);
      if (!isMentioned && conv?.mutedUntil && new Date(conv.mutedUntil).getTime() > Date.now()) {
        return;
      }

      // Clicking the notification/toast jumps to that conversation.
      const openConversation = () => {
        if (conv) useConversationStore.getState().setActiveConversation(conv);
        window.focus();
      };

      let text = message.content;
      if (message.type === 'IMAGE') {
        text = '📷 Photo';
      } else if (message.type === 'AUDIO') {
        text = '🎵 Voice message';
      } else if (message.type === 'VIDEO') {
        text = '🎥 Video';
      } else if (message.type === 'FILE') {
        text = `📄 ${message.content || 'File'}`;
      }

      const senderName = message.sender?.displayName || conv?.name || 'New message';

      if (visible) {
        showMessageToast({ title: senderName, body: text, onClick: openConversation });
      } else {
        showNotification(
          senderName,
          { body: text, tag: message.conversationId, renotify: true, icon: message.sender?.avatar || '/logo.png' } as any,
          openConversation
        );
      }
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
    };
  }, [socket, currentUser, showNotification, queryClient]);

  // Fetch blocked users and register FCM token on mount if authenticated
  useEffect(() => {
    if (currentUser) {
      registerFcmToken();
      useConversationStore.getState().fetchBlockedUsers();
    }
  }, [currentUser, registerFcmToken]);

  // Re-check the token when the tab regains focus — FCM rotates tokens silently.
  useEffect(() => {
    if (!currentUser) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') registerFcmToken();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentUser, registerFcmToken]);

  return { requestPermission, showNotification };
};
