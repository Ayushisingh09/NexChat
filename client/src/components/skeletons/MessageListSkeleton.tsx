import React from 'react';

export const MessageListSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto flex-grow h-full bg-wa-chat">
      <div className="flex justify-start">
        <div className="max-w-[65%] w-56 h-12 rounded-2xl rounded-tl-[4px] animate-pulse bg-white/[0.05]" />
      </div>
      <div className="flex justify-end">
        <div className="max-w-[65%] w-48 h-10 rounded-2xl rounded-tr-[4px] animate-pulse bg-wa-accent/20" />
      </div>
      <div className="flex justify-start">
        <div className="max-w-[65%] w-64 h-14 rounded-2xl rounded-tl-[4px] animate-pulse bg-white/[0.05]" />
      </div>
      <div className="flex justify-end">
        <div className="max-w-[65%] w-52 h-12 rounded-2xl rounded-tr-[4px] animate-pulse bg-wa-accent/20" />
      </div>

      <div className="flex justify-center my-1">
        <div className="w-24 h-[18px] rounded-full animate-pulse bg-white/[0.04]" />
      </div>

      <div className="flex justify-start">
        <div className="max-w-[65%] w-60 h-10 rounded-2xl rounded-tl-[4px] animate-pulse bg-white/[0.05]" />
      </div>
      <div className="flex justify-end">
        <div className="max-w-[65%] w-64 h-14 rounded-2xl rounded-tr-[4px] animate-pulse bg-wa-accent/20" />
      </div>
      <div className="flex justify-start">
        <div className="max-w-[65%] w-48 h-12 rounded-2xl rounded-tl-[4px] animate-pulse bg-white/[0.05]" />
      </div>
      <div className="flex justify-end">
        <div className="max-w-[65%] w-56 h-10 rounded-2xl rounded-tr-[4px] animate-pulse bg-wa-accent/20" />
      </div>
    </div>
  );
};
