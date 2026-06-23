import { useState, useEffect } from 'react';

import fallbackBg from '../assets/background.jpg';

const LS_BG = 'nexchat_bg_url';
const LIVE_BG_URL = 'https://api.92lrcorps.xyz/uploads/1782103673618-file_000000006f207208b68c08a5e674a930.jpg';
const DB_NAME = 'nexchat-wallpaper';
const DB_STORE = 'images';
const DB_KEY = 'chat-bg';

function openDB(): Promise<IDBObjectStore> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE);
      }
    };
    req.onsuccess = () => {
      const tx = req.result.transaction(DB_STORE, 'readwrite');
      resolve(tx.objectStore(DB_STORE));
    };
    req.onerror = () => reject(req.error);
  });
}

async function getCachedBlob(): Promise<Blob | null> {
  try {
    const store = await openDB();
    return new Promise((resolve) => {
      const get = store.get(DB_KEY);
      get.onsuccess = () => resolve(get.result ?? null);
      get.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function setCachedBlob(blob: Blob): Promise<void> {
  try {
    const store = await openDB();
    return new Promise((resolve, reject) => {
      const put = store.put(blob, DB_KEY);
      put.onsuccess = () => resolve();
      put.onerror = () => reject(put.error);
    });
  } catch {}
}

async function fetchAndCache(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('fetch failed');
    const blob = await res.blob();
    await setCachedBlob(blob);
    return URL.createObjectURL(blob);
  } catch {
    return '';
  }
}

export function useChatBackground() {
  const [bgUrl, setBgUrl] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;

    async function init() {
      // 1. User-uploaded wallpaper (localStorage) takes priority
      const userBg = localStorage.getItem(LS_BG);
      if (userBg) {
        if (!cancelled) setBgUrl(userBg);
        return;
      }

      // 2. Fallback: IndexedDB cache or bundled asset
      const cached = await getCachedBlob();
      if (!cancelled) {
        if (cached) {
          objectUrl = URL.createObjectURL(cached);
          setBgUrl(objectUrl);
        } else {
          setBgUrl(fallbackBg);
        }
      }

      if (!cached) {
        const live = await fetchAndCache(LIVE_BG_URL);
        if (!cancelled && live) {
          if (objectUrl) URL.revokeObjectURL(objectUrl);
          objectUrl = live;
          setBgUrl(live);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, []);

  return bgUrl;
}
