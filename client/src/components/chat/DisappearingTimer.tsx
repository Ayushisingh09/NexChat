import React, { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { Message } from '../../types/chat.types';
import { useNow } from '../../hooks/useNow';
import { patchMessageInCache, removeMessageFromCache } from '../../utils/message.utils';

interface DisappearingTimerProps {
  message: Message;
  ttlSeconds?: number | null;
}

/**
 * Countdown ring for a disappearing message. Subscribes to the shared 1s
 * `useNow` clock (so only expiring bubbles tick, not every message) and writes
 * the expiry → fade → removal into the messages cache when time runs out.
 */
const DisappearingTimerComponent: React.FC<DisappearingTimerProps> = ({ message, ttlSeconds }) => {
  const now = useNow();
  const queryClient = useQueryClient();
  const expiredHandled = useRef(false);

  const expiresMs = message.expiresAt ? new Date(message.expiresAt).getTime() : 0;
  const difference = expiresMs - now;

  useEffect(() => {
    if (message.isExpired || difference > 0 || expiredHandled.current) return;
    expiredHandled.current = true;

    // Collapse animation, then drop from cache.
    patchMessageInCache(queryClient, message.conversationId, message.id, (m) => ({ ...m, isExpired: true }));
    const t = setTimeout(() => {
      removeMessageFromCache(queryClient, message.conversationId, message.id);
    }, 450);
    return () => clearTimeout(t);
  }, [difference, message.isExpired, message.conversationId, message.id, queryClient]);

  if (difference <= 0) return null;

  const hours = Math.floor(difference / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  let label: string;
  if (hours >= 24) label = `${Math.round(hours / 24)}d remaining`;
  else if (hours > 0) label = `${hours}h ${minutes}m remaining`;
  else if (minutes > 0) label = `${minutes}m ${seconds}s remaining`;
  else label = `${seconds}s remaining`;

  const totalTtl = ttlSeconds ? ttlSeconds * 1000 : 86400 * 1000;
  const pct = Math.max(0, Math.min(100, (difference / totalTtl) * 100));
  const ringColor = pct > 50 ? '#10b981' : pct > 15 ? '#f59e0b' : '#ef4444';
  const isCritical = pct <= 15;

  return (
    <div className="relative group/timer inline-flex items-center">
      <svg className={`w-3.5 h-3.5 mr-0.5 cursor-help ${isCritical ? 'animate-pulse' : ''}`} viewBox="0 0 20 20">
        <circle cx="10" cy="10" r="7.5" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.8" />
        <circle
          cx="10"
          cy="10"
          r="7.5"
          fill="none"
          stroke={ringColor}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray={47.1}
          strokeDashoffset={47.1 - (pct / 100) * 47.1}
          className="transition-all duration-1000 origin-center -rotate-90"
        />
        <path d="M10 6.5 v3.5 h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" fill="none" className="text-wa-primary" />
      </svg>
      <span className="pointer-events-none absolute bottom-full mb-1 right-0 bg-wa-surface border border-white/[0.06] text-[9.5px] text-wa-primary rounded-lg px-2 py-1 whitespace-nowrap shadow-elevated opacity-0 group-hover/timer:opacity-100 transition-opacity duration-150 z-30 font-sans normal-case select-none">
        Disappears in {label}
      </span>
    </div>
  );
};

export const DisappearingTimer = React.memo(DisappearingTimerComponent);
