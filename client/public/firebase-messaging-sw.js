/* global importScripts, firebase */
// Firebase Cloud Messaging service worker — handles push notifications while the app
// is backgrounded or closed. This file runs outside the Vite bundle, so the config
// must be hard-coded (these web config values are not secrets).
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// PWA installability
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
self.addEventListener('fetch', () => {});

firebase.initializeApp({
  apiKey: 'AIzaSyA4B-Izvb5VJgDjbvYXepnskg-yDVH4iyk',
  authDomain: 'authzen-4f8e6.firebaseapp.com',
  projectId: 'authzen-4f8e6',
  storageBucket: 'authzen-4f8e6.firebasestorage.app',
  messagingSenderId: '474347724740',
  appId: '1:474347724740:web:8a42dad23201811be4ce91',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'New message';
  const type = payload.data?.type;
  self.registration.showNotification(title, {
    body: payload.notification?.body || '',
    icon: '/logo.png',
    data: payload.data,
    badge: '/logo.png',
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data;
  const type = data?.type;
  let url = '/';
  if (type === 'friend_request') {
    url = '/friends';
  } else if (type === 'call') {
    url = '/';
  } else if (type === 'new_message') {
    if (data?.conversationId) {
      url = `/conversation/${data.conversationId}`;
    }
  }
  event.waitUntil(clients.openWindow(url));
});
