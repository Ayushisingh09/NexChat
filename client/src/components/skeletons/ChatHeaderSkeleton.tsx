import React from 'react';

export const ChatHeaderSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between px-4 py-3 h-[60px] bg-[#0f0f13] border-b border-white/[0.04]">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full animate-pulse bg-white/[0.06]" />
        <div className="space-y-1.5">
          <div className="w-28 h-3 rounded animate-pulse bg-white/[0.06]" />
          <div className="w-16 h-2.5 rounded animate-pulse bg-white/[0.05]" />
        </div>
      </div>
      <div className="flex gap-4">
        <div className="w-5 h-5 rounded animate-pulse bg-white/[0.06]" />
        <div className="w-5 h-5 rounded animate-pulse bg-white/[0.06]" />
      </div>
    </div>
  );
};
