import { useSyncExternalStore } from 'react';

/**
 * A single shared 1-second ticker for the whole app. Instead of every
 * disappearing-message bubble spinning up its own setInterval, they all
 * subscribe to this one clock — one timer drives every countdown.
 *
 * The interval only runs while at least one component is subscribed.
 */
let now = Date.now();
let interval: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

const tick = () => {
  now = Date.now();
  listeners.forEach((l) => l());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  if (!interval) {
    interval = setInterval(tick, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && interval) {
      clearInterval(interval);
      interval = null;
    }
  };
};

const getSnapshot = () => now;

/** Returns the shared "current time" (ms), updated once per second. */
export const useNow = (): number => useSyncExternalStore(subscribe, getSnapshot);
