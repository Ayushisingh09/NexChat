import { initializeApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Sanitize: strip accidental surrounding quotes and whitespace/newlines that
// otherwise make PushManager.subscribe throw "applicationServerKey is not valid".
const rawVapidKey = (import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined) ?? '';
export const VAPID_KEY = rawVapidKey.trim().replace(/^['"]|['"]$/g, '');

// A valid Web Push key is a base64url-encoded uncompressed P-256 public key:
// 65 bytes that decode from an ~87-char base64url string starting with "B" (0x04).
export function isValidVapidKey(key: string): boolean {
  if (!key) return false;
  try {
    const base64 = key.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(key.length / 4) * 4, '=');
    const bytes = atob(base64);
    return bytes.length === 65 && bytes.charCodeAt(0) === 0x04;
  } catch {
    return false;
  }
}

const isConfigured = firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId;

let app: ReturnType<typeof initializeApp> | null = null;
if (isConfigured) {
  app = initializeApp(firebaseConfig);
}

// getMessaging throws in unsupported environments (e.g. no service worker / Safari private mode),
// so gate it behind isSupported().
export const messagingPromise: Promise<Messaging | null> =
  app && isConfigured
    ? isSupported().then((supported) => (supported ? getMessaging(app) : null))
    : Promise.resolve(null);
