import React from 'react';
import { SidebarSkeleton } from './SidebarSkeleton';
import { ChatSkeleton } from './ChatSkeleton';

export const FullPageSkeleton: React.FC = () => {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-wa-chat text-white">
      <div className="w-[30%] min-w-[320px] max-w-[400px] h-full shrink-0 hidden md:block border-r border-white/5">
        <SidebarSkeleton />
      </div>
      <div className="flex-1 h-full">
        <ChatSkeleton />
      </div>
    </div>
  );
};
