const MIC_KEY = 'nexchat:call:micOn';
const FAV_KEY = 'nexchat:call:favorites';
const HIDDEN_KEY = 'nexchat:call:hidden';

let _callLock = false;

export function acquireCallLock(): boolean {
  if (_callLock) return false;
  _callLock = true;
  setTimeout(() => { _callLock = false; }, 5000);
  return true;
}

function readArray(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeArray(key: string, value: string[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy-mode errors */
  }
}

export function getMicOn(): boolean {
  try {
    return localStorage.getItem(MIC_KEY) !== 'false';
  } catch {
    return true;
  }
}

export function setMicOn(on: boolean): void {
  try {
    localStorage.setItem(MIC_KEY, on ? 'true' : 'false');
  } catch {
    /* ignore */
  }
}

export function getFavorites(): string[] {
  return readArray(FAV_KEY);
}

export function isFavorite(userId: string): boolean {
  return getFavorites().includes(userId);
}

export function toggleFavorite(userId: string): string[] {
  const current = getFavorites();
  const next = current.includes(userId)
    ? current.filter((id) => id !== userId)
    : [userId, ...current];
  writeArray(FAV_KEY, next);
  return next;
}

export function getHiddenCalls(): string[] {
  return readArray(HIDDEN_KEY);
}

export function hideCall(callId: string): string[] {
  const next = Array.from(new Set([...getHiddenCalls(), callId]));
  writeArray(HIDDEN_KEY, next);
  return next;
}

export function hideCalls(callIds: string[]): string[] {
  const next = Array.from(new Set([...getHiddenCalls(), ...callIds]));
  writeArray(HIDDEN_KEY, next);
  return next;
}
