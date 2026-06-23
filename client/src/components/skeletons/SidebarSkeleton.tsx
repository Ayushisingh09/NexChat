import React from 'react';
import { ConversationItemSkeleton } from './ConversationItemSkeleton';

export const SidebarSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-[#111114]">
      <div className="flex items-center justify-between p-3 h-[60px] border-b border-white/5">
        <div className="w-9 h-9 rounded-full animate-pulse bg-white/[0.06]" />
        <div className="flex gap-4">
          <div className="w-5 h-5 rounded animate-pulse bg-white/[0.06]" />
          <div className="w-5 h-5 rounded animate-pulse bg-white/[0.06]" />
        </div>
      </div>
      <div className="p-2 border-b border-white/5">
        <div className="w-full h-[36px] rounded-xl animate-pulse bg-white/[0.05]" />
      </div>
      <div className="flex-1 overflow-y-auto">
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
        <ConversationItemSkeleton />
      </div>
    </div>
  );
};
