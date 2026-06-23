'use client';

import * as React from 'react';
import { X, ArrowDownCircle, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UploadCardProps {
  status: 'uploading' | 'success' | 'error';
  progress?: number;
  title: string;
  description: string;
  primaryButtonText: string;
  onPrimaryButtonClick?: () => void;
  secondaryButtonText?: string;
  onSecondaryButtonClick?: () => void;
}

export const UploadCard: React.FC<UploadCardProps> = ({
  status,
  progress = 0,
  title,
  description,
  primaryButtonText,
  onPrimaryButtonClick,
  secondaryButtonText,
  onSecondaryButtonClick,
}) => {
  const renderIcon = () => {
    switch (status) {
      case 'uploading':
        return <ArrowDownCircle className="w-8 h-8 text-blue-400 animate-pulse" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-emerald-400" />;
      case 'error':
        return <XCircle className="w-8 h-8 text-red-400" />;
      default:
        return null;
    }
  };

  return (
    <div className={cn(
      'w-full max-w-sm rounded-2xl border overflow-hidden',
      status === 'uploading' && 'bg-[#1a2332] border-blue-500/30',
      status === 'success' && 'bg-[#1a2332] border-emerald-500/30',
      status === 'error' && 'bg-[#1a2332] border-red-500/30',
    )}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          {renderIcon()}
          <div>
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            <p className="text-xs text-zinc-400 mt-0.5">{description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onSecondaryButtonClick}
          className="p-1 rounded-full hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {status === 'uploading' && (
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-zinc-400">Uploading...</span>
            <span className="text-xs font-mono text-blue-400">{progress}%</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={onPrimaryButtonClick}
            className="mt-3 w-full py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
          >
            {primaryButtonText}
          </button>
        </div>
      )}

      {(status === 'success' || status === 'error') && (
        <div className="px-4 py-3 flex gap-2">
          <button
            type="button"
            onClick={onPrimaryButtonClick}
            className={cn(
              "flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-colors",
              status === 'success'
                ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                : "bg-red-500 hover:bg-red-600 text-white"
            )}
          >
            {primaryButtonText}
          </button>
          {secondaryButtonText && (
            <button
              type="button"
              onClick={onSecondaryButtonClick}
              className="flex-1 py-2 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition-colors"
            >
              {secondaryButtonText}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
