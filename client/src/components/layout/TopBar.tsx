import React from 'react';
import { ArrowLeft, ChevronLeft } from 'lucide-react';

interface TopBarProps {
  title: string;
  onBack?: () => void;
  backIcon?: 'arrow' | 'chevron';
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  glass?: boolean;
  sticky?: boolean;
  className?: string;
}

export const TopBar: React.FC<TopBarProps> = ({
  title,
  onBack,
  backIcon = 'arrow',
  leftAction,
  rightAction,
  glass = true,
  sticky = false,
  className = '',
}) => {
  const BackIcon = backIcon === 'chevron' ? ChevronLeft : ArrowLeft;

  return (
    <div
      className={`${sticky ? 'sticky top-0 z-10 ' : ''}${
        glass ? 'glass border-b border-wa-border ' : ''
      }${className}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {leftAction ? (
          <div className="shrink-0">{leftAction}</div>
        ) : onBack ? (
          <button type="button"
            onClick={onBack}
            className="p-1.5 text-wa-secondary hover:text-white rounded-xl hover:bg-white/5 transition shrink-0"
          >
            <BackIcon className="w-5 h-5" />
          </button>
        ) : null}
        <h1 className="text-lg font-bold truncate flex-1">{title}</h1>
        {rightAction && (
          <div className="shrink-0">{rightAction}</div>
        )}
      </div>
    </div>
  );
};
