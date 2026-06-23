import { create } from 'zustand';
import type { User } from '../types/chat.types';
import { clearSearchIndex } from '../utils/searchIndex';

// Access tokens are kept in-memory only (not persisted to disk).
// The refresh token is stored in sessionStorage (cleared on tab close)
// rather than localStorage, reducing the XSS exposure window.
// Long-term fix: migrate refresh token to an HttpOnly, Secure, SameSite cookie.
const SESSION_REFRESH_KEY = 'chat_refresh_token';
const USER_KEY = 'chat_user';

function getPersistedUser(): User | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  updateUser: (user: User) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: getPersistedUser(),
  accessToken: null,
  refreshToken: sessionStorage.getItem(SESSION_REFRESH_KEY),
  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    sessionStorage.setItem(SESSION_REFRESH_KEY, refreshToken);
    set({ user, accessToken, refreshToken });
  },
  updateUser: (user) => {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    set({ user });
  },
  clearAuth: () => {
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(SESSION_REFRESH_KEY);
    clearSearchIndex();
    set({ user: null, accessToken: null, refreshToken: null });
  },
}));
