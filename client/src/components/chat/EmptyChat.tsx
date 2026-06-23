import React from 'react';
import { MessageCircle, Shield, Zap } from 'lucide-react';

export const EmptyChat: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-wa-chat text-center p-8 select-none border-l border-wa-border relative overflow-hidden">
      {/* Subtle ambient glow */}
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[400px] h-[400px] rounded-full bg-emerald-500/[0.06] blur-[100px]" />
      </div>

      <div className="space-y-6 max-w-md animate-slide-up">
        {/* Logo */}
        <div className="relative mx-auto">
          <div className="w-24 h-24 mx-auto rounded-[24px] overflow-hidden bg-wa-surface ring-1 ring-white/10 shadow-lg">
            <img
              src="/logo.png"
              alt="NexChat"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-wa-chat">
            <span className="text-[8px] text-white font-bold">✓</span>
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            NexChat Web
          </h2>
          <p className="text-sm text-wa-secondary leading-relaxed max-w-xs mx-auto">
            Private messaging platform. Select a conversation to start chatting.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="flex items-center justify-center gap-4 text-[11px] text-wa-secondary/70">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-emerald-400/70" />
            <span>Secure</span>
          </div>
          <span className="text-white/10">•</span>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-emerald-400/70" />
            <span>Real-time</span>
          </div>
          <span className="text-white/10">•</span>
          <div className="flex items-center gap-1.5">
            <MessageCircle className="w-3.5 h-3.5 text-emerald-400/70" />
            <span>Private</span>
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center justify-center">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.06] text-[11px] text-wa-secondary">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Select a conversation to start
          </span>
        </div>
      </div>
    </div>
  );
};
