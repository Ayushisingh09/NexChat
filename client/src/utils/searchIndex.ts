// Local full-text index over messages.

export interface IndexedMessage {
  messageId: string;
  conversationId: string;
  senderId: string;
  plaintext: string;
  createdAt: string;
}

const DB_NAME = 'nexchat_search';
const STORE = 'messages';

function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'messageId' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

const pending = new Map<string, IndexedMessage>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** Queue a message for indexing; writes are batched. */
export function indexMessage(entry: IndexedMessage): void {
  if (!entry.plaintext || entry.plaintext.startsWith('[🔒')) return;
  pending.set(entry.messageId, entry);
  if (!flushTimer) {
    flushTimer = setTimeout(flush, 1000);
  }
}

async function flush(): Promise<void> {
  flushTimer = null;
  if (pending.size === 0) return;
  const entries = [...pending.values()];
  pending.clear();
  try {
    const db = await getDB();
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    for (const e of entries) store.put(e);
  } catch (err) {
    console.error('Search index write failed:', err);
  }
}

export function removeFromIndex(messageId: string): void {
  pending.delete(messageId);
  getDB()
    .then((db) => db.transaction(STORE, 'readwrite').objectStore(STORE).delete(messageId))
    .catch(() => undefined);
}

/** Case-insensitive substring search, newest first. */
export async function searchLocalIndex(query: string, limit = 20): Promise<IndexedMessage[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  try {
    const db = await getDB();
    return await new Promise((resolve, reject) => {
      const results: IndexedMessage[] = [];
      const tx = db.transaction(STORE, 'readonly');
      const index = tx.objectStore(STORE).index('createdAt');
      const cursorReq = index.openCursor(null, 'prev');
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (!cursor || results.length >= limit) {
          resolve(results);
          return;
        }
        const entry = cursor.value as IndexedMessage;
        if (entry.plaintext.toLowerCase().includes(q)) {
          results.push(entry);
        }
        cursor.continue();
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
  } catch (err) {
    console.error('Search index read failed:', err);
    return [];
  }
}

export async function clearSearchIndex(): Promise<void> {
  pending.clear();
  try {
    const db = await getDB();
    await new Promise<void>((resolve, reject) => {
      const req = db.transaction(STORE, 'readwrite').objectStore(STORE).clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* best effort */
  }
}
