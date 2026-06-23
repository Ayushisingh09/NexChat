import React from 'react';
import { ArrowDown } from 'lucide-react';

interface ScrollToBottomProps {
  show: boolean;
  onClick: () => void;
  unreadCount?: number;
}

export const ScrollToBottom: React.FC<ScrollToBottomProps> = ({
  show,
  onClick,
  unreadCount = 0,
}) => {
  if (!show) return null;

  return (
    <button type="button"
      onClick={onClick}
      aria-label="Scroll to latest messages"
      className="absolute bottom-24 right-4 sm:right-6 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-wa-surface-2/90 hover:bg-wa-active text-wa-secondary hover:text-wa-accent flex items-center justify-center shadow-elevated transition-all duration-200 ease-spring hover:scale-110 active:scale-90 z-30 focus:outline-none select-none animate-scale-in border border-white/[0.06]"
    >
      <ArrowDown className="w-5 h-5" strokeWidth={2.5} />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-wa-accent text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-glow">
          {unreadCount}
        </span>
      )}
    </button>
  );
};
