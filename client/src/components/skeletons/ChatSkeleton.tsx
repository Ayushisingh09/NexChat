import React from 'react';
import { ChatHeaderSkeleton } from './ChatHeaderSkeleton';
import { MessageListSkeleton } from './MessageListSkeleton';

export const ChatSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col h-full bg-wa-chat">
      <ChatHeaderSkeleton />
      <div className="flex-1 overflow-hidden">
        <MessageListSkeleton />
      </div>
      <div className="flex items-center gap-2 px-4 py-3 bg-[#0f0f13] border-t border-white/[0.04]">
        <div className="w-5 h-5 rounded-full animate-pulse bg-white/[0.06] shrink-0" />
        <div className="flex-1 h-10 rounded-xl animate-pulse bg-white/[0.05]" />
        <div className="w-5 h-5 rounded animate-pulse bg-white/[0.06] shrink-0" />
      </div>
    </div>
  );
};
