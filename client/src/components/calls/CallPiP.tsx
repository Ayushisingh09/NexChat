import React, { useState, useRef, useEffect } from 'react';
import { Track } from 'livekit-client';
import { useTracks, ParticipantTile } from '@livekit/components-react';
import { useCallStore, type ConnectionQuality } from '../../store/call.store';
import { Avatar } from '../layout/Avatar';
import { Maximize2 } from 'lucide-react';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function QualityDot({ quality }: { quality: ConnectionQuality }) {
  const color =
    quality === 'excellent' ? 'bg-emerald-400' :
    quality === 'good' ? 'bg-yellow-400' :
    quality === 'poor' ? 'bg-red-400' : 'bg-zinc-500';
  return <span className={`inline-block w-1.5 h-1.5 rounded-full ${color}`} />;
}

export const CallPiP: React.FC = () => {
  const {
    participant, duration, toggleMinimize, isMuted,
    remoteQuality, isReconnecting, localRtt,
  } = useCallStore();

  const remoteVideoTracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
    .filter((t) => !t.participant.isLocal);

  const [pos, setPos] = useState({ x: 16, y: 80 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const maxX = window.innerWidth - 200;
    const maxY = window.innerHeight - 80;
    setPos({
      x: Math.max(0, Math.min(maxX, dragRef.current.origX + dx)),
      y: Math.max(0, Math.min(maxY, dragRef.current.origY + dy)),
    });
  };

  const onPointerUp = () => {
    setDragging(false);
    dragRef.current = null;
  };

  useEffect(() => {
    if (!dragging) return;
    const up = () => { setDragging(false); dragRef.current = null; };
    window.addEventListener('pointerup', up);
    return () => window.removeEventListener('pointerup', up);
  }, [dragging]);

  return (
    <div
      className="fixed z-[55] select-none"
      style={{ left: pos.x, top: pos.y, touchAction: 'none' }}
    >
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-2xl bg-zinc-900  border border-white/10 shadow-pop cursor-grab active:cursor-grabbing ${
          dragging ? 'scale-105' : ''
        } transition-transform duration-150`}
      >
        <div className="relative w-10 h-10 rounded-lg overflow-hidden shrink-0">
          {remoteVideoTracks.length > 0 ? (
            <ParticipantTile
              trackRef={remoteVideoTracks[0]}
              className="w-full h-full"
              disableSpeakingIndicator
            />
          ) : (
            <Avatar src={participant?.avatar} name={participant?.displayName} size="sm" />
          )}
          {isReconnecting && (
            <div className="absolute inset-0 bg-amber-500/30 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">...</span>
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span className="text-xs font-medium text-white truncate max-w-[100px]">
            {participant?.displayName}
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-mono text-wa-accent">
              {formatDuration(duration)}
            </span>
            <QualityDot quality={remoteQuality} />
            {localRtt != null && (
              <span className="text-[9px] font-mono text-white/40">{localRtt}ms</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 ml-1">
          {isMuted && (
            <span className="text-[9px] bg-red-500/20 text-red-400 px-1 py-0.5 rounded font-medium">
              Muted
            </span>
          )}
          <button type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleMinimize();
            }}
            className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
            title="Expand"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
