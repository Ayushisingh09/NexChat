import React from 'react';

interface TypingIndicatorProps {
  displayName?: string;
  show: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({ displayName, show }) => {
  if (!show) return null;

  return (
    <div className="flex items-center gap-2 text-wa-accent animate-fade-in">
      <span className="flex gap-[3px] items-center">
        <span className="w-[5px] h-[5px] rounded-full bg-wa-accent animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1s' }} />
        <span className="w-[5px] h-[5px] rounded-full bg-wa-accent animate-bounce" style={{ animationDelay: '150ms', animationDuration: '1s' }} />
        <span className="w-[5px] h-[5px] rounded-full bg-wa-accent animate-bounce" style={{ animationDelay: '300ms', animationDuration: '1s' }} />
      </span>
      <span className="text-[13px] italic font-medium">
        {displayName ? `${displayName} is typing` : 'typing'}
      </span>
    </div>
  );
};
