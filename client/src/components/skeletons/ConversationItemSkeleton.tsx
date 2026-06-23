import React from 'react';

export const ConversationItemSkeleton: React.FC = () => {
  return (
    <div className="flex items-center justify-between px-3 py-3 h-[72px] border-b border-white/[0.04]">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-[42px] h-[42px] rounded-full animate-pulse bg-white/[0.06] shrink-0" />
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="w-28 h-3 rounded animate-pulse bg-white/[0.06]" />
          <div className="w-48 h-2.5 rounded animate-pulse bg-white/[0.05]" />
        </div>
      </div>
      <div className="w-8 h-2.5 rounded animate-pulse bg-white/[0.05] shrink-0 self-start mt-2" />
    </div>
  );
};
