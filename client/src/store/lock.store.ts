import { create } from 'zustand';
import { hashPin } from '../utils/pin';

const PIN_KEY = 'nexchat_pin';

const readHasPin = () => {
  try {
    return !!localStorage.getItem(PIN_KEY);
  } catch {
    return false;
  }
};

interface LockState {
  hasPin: boolean;
  locked: boolean;
  setPin: (pin: string) => Promise<void>;
  removePin: (pin: string) => Promise<boolean>;
  unlock: (pin: string) => Promise<boolean>;
  lock: () => void;
}

const initialHasPin = readHasPin();

export const useLockStore = create<LockState>((set, get) => ({
  hasPin: initialHasPin,
  // If a PIN is set, the app starts locked on every fresh load.
  locked: initialHasPin,

  setPin: async (pin) => {
    const hash = await hashPin(pin);
    localStorage.setItem(PIN_KEY, hash);
    set({ hasPin: true, locked: false });
  },

  removePin: async (pin) => {
    const stored = localStorage.getItem(PIN_KEY);
    if (stored) {
      const hash = await hashPin(pin);
      if (hash !== stored) return false;
    }
    localStorage.removeItem(PIN_KEY);
    set({ hasPin: false, locked: false });
    return true;
  },

  unlock: async (pin) => {
    const stored = localStorage.getItem(PIN_KEY);
    if (!stored) {
      set({ locked: false });
      return true;
    }
    const hash = await hashPin(pin);
    if (hash === stored) {
      set({ locked: false });
      return true;
    }
    return false;
  },

  lock: () => {
    if (get().hasPin) set({ locked: true });
  },
}));
