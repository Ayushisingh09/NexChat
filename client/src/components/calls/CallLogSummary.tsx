import React, { useState } from 'react';
import type { CallRecord } from '../../api/calls.api';
import { useAuthStore } from '../../store/auth.store';
import { ChevronDown, PhoneIncoming, PhoneOutgoing, PhoneMissed } from 'lucide-react';
import { cn } from '../../lib/utils';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

interface CallLogSummaryProps {
  calls: CallRecord[];
}

export const CallLogSummary: React.FC<CallLogSummaryProps> = ({ calls }) => {
  const [expanded, setExpanded] = useState(false);
  const currentUser = useAuthStore((s) => s.user);

  const missedCount = calls.filter((c) => c.status === 'MISSED' || c.status === 'REJECTED').length;
  const isSingle = calls.length === 1;

  if (isSingle) {
    const call = calls[0];
    const isOutgoing = call.callerId === currentUser?.id;
    const missed = call.status === 'MISSED' || call.status === 'REJECTED';
    const isOwn = isOutgoing;
    const icon = missed ? <PhoneMissed className="w-4 h-4" /> : isOutgoing ? <PhoneOutgoing className="w-4 h-4" /> : <PhoneIncoming className="w-4 h-4" />;
    const label = missed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming';
    const time = new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <div className={cn("flex", isOwn ? "justify-end mr-1 sm:mr-2" : "justify-start ml-1 sm:ml-2", "my-2")}>
        <div className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl shadow-sm max-w-[320px]",
          isOwn ? "bg-[#005c4b]" : "bg-[#1f2c34]"
        )}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            missed 
              ? "bg-red-500/20 text-red-400" 
              : isOwn 
                ? "bg-white/20 text-white" 
                : "bg-wa-accent/20 text-wa-accent"
          )}>
            {icon}
          </div>
          <div className="flex flex-col min-w-0">
            <span className={cn(
              "text-[13px] font-semibold truncate",
              missed ? "text-red-400" : isOwn ? "text-white" : "text-wa-accent"
            )}>{label}</span>
            <span className={cn(
              "text-[10px]",
              isOwn ? "text-white/60" : "text-wa-secondary"
            )}>{time}{call.duration ? ` · ${formatDuration(call.duration)}` : ''}</span>
          </div>
        </div>
      </div>
    );
  }

  const timeRange = `${new Date(calls[calls.length - 1].createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
  const icon = missedCount > 0 ? <PhoneMissed className="w-4 h-4" /> : <PhoneOutgoing className="w-4 h-4" />;

  return (
    <div className="flex justify-center my-2">
      <div className="flex flex-col items-center max-w-[320px] w-full transition-all duration-200 ease-out">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl w-full shadow-sm",
            missedCount > 0 ? "bg-[#005c4b]" : "bg-[#1f2c34]"
          )}
        >
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
            missedCount > 0 
              ? "bg-red-500/20 text-red-400" 
              : "bg-white/20 text-white"
          )}>
            {icon}
          </div>
          <div className="flex flex-col min-w-0 text-left flex-1">
            <span className={cn(
              "text-[13px] font-semibold truncate",
              missedCount > 0 ? "text-red-400" : "text-white"
            )}>
              {calls.length} calls
            </span>
            <span className={cn(
              "text-[10px]",
              missedCount > 0 ? "text-red-400/60" : "text-white/60"
            )}>{timeRange}{missedCount > 0 ? ` · ${missedCount} missed` : ''}</span>
          </div>
          <ChevronDown className={cn(
            "w-4 h-4 transition-transform duration-200 ease-out",
            missedCount > 0 ? "text-red-400/60" : "text-white/60",
            expanded ? "rotate-180" : ""
          )} />
        </button>
        {expanded && (
          <div className="flex flex-col gap-1 mt-1.5 w-full transition-all duration-200 ease-out">
            {calls.map((call) => {
              const isOutgoing = call.callerId === currentUser?.id;
              const missed = call.status === 'MISSED' || call.status === 'REJECTED';
              const isOwn = isOutgoing;
              const ico = missed ? <PhoneMissed className="w-3.5 h-3.5" /> : isOutgoing ? <PhoneOutgoing className="w-3.5 h-3.5" /> : <PhoneIncoming className="w-3.5 h-3.5" />;
              const lbl = missed ? 'Missed' : isOutgoing ? 'Outgoing' : 'Incoming';
              const t = new Date(call.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              return (
                <div key={call.id} className={cn(
                  "flex items-center gap-3 px-4 py-2 rounded-lg",
                  isOwn ? "bg-[#005c4b]/80" : "bg-[#1f2c34]/80"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                    missed 
                      ? "bg-red-500/20 text-red-400" 
                      : isOwn 
                        ? "bg-white/15 text-white" 
                        : "bg-wa-accent/15 text-wa-accent"
                  )}>
                    {ico}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className={cn(
                      "text-[12px] font-medium",
                      missed ? "text-red-400" : isOwn ? "text-white" : "text-wa-accent"
                    )}>{lbl}</span>
                    <span className={cn(
                      "text-[10px]",
                      isOwn ? "text-white/50" : "text-wa-secondary/60"
                    )}>{t}{call.duration ? ` · ${formatDuration(call.duration)}` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
