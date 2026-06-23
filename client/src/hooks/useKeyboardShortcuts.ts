import { useEffect } from 'react';

export const useKeyboardShortcuts = () => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === 'k') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-search-input]');
        if (input) {
          input.focus();
          input.select();
        }
      }

      if (e.key === 'f') {
        const activeConv = document.querySelector('[data-conversation-search]');
        if (activeConv) {
          e.preventDefault();
          (activeConv as HTMLElement).click();
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);
};
