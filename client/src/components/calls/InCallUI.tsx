import React, { useEffect, useRef, useState } from 'react';
import { Track } from 'livekit-client';
import { useTracks, ParticipantTile, RoomAudioRenderer } from '@livekit/components-react';
import { useCallStore, type ConnectionQuality, type ScreenShareQuality } from '../../store/call.store';
import { useLiveKitCall } from '../../hooks/useLiveKitCall';
import { DevicePicker } from './DevicePicker';
import { CameraSwitchButton } from './CameraSwitchButton';
import { Avatar } from '../layout/Avatar';
import {
  Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff, Minimize2,
  AlertTriangle, Headphones, HeadphoneOff, Volume2,
  Smile, ChevronDown, ChevronUp, Share2,
} from 'lucide-react';

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function QualityIndicator({ quality, label }: { quality: ConnectionQuality; label: string }) {
  const color =
    quality === 'excellent' ? 'bg-emerald-400' :
    quality === 'good' ? 'bg-yellow-400' :
    quality === 'poor' ? 'bg-red-400' : 'bg-zinc-500';
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-end gap-0.5">
        <span className={`w-1 h-1.5 rounded-sm ${quality !== 'unknown' ? color : 'bg-zinc-600'}`} />
        <span className={`w-1 h-2 rounded-sm ${quality === 'excellent' || quality === 'good' ? color : 'bg-zinc-600'}`} />
        <span className={`w-1 h-2.5 rounded-sm ${quality === 'excellent' ? color : 'bg-zinc-600'}`} />
      </div>
      <span className="text-[10px] uppercase tracking-wide text-white/60">{label}</span>
    </div>
  );
}

function ConnectionBadge({ quality, rtt }: { quality: ConnectionQuality; rtt: number | null }) {
  const dotColor =
    quality === 'excellent' ? 'bg-emerald-400' :
    quality === 'good' ? 'bg-yellow-400' :
    quality === 'poor' ? 'bg-red-400 animate-pulse' : 'bg-zinc-500';

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      {rtt != null && (
        <span className="text-[10px] font-mono text-white/50">{rtt}ms</span>
      )}
    </div>
  );
}

function WeakConnectionBanner({ quality, rtt }: { quality: ConnectionQuality; rtt: number | null }) {
  if (quality !== 'poor') return null;
  return (
    <div className="absolute bottom-24 inset-x-0 z-[55] flex items-center justify-center px-4 pointer-events-none">
      <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-red-500/15 border border-red-400/25 shadow-lg">
        <AlertTriangle className="w-4 h-4 text-red-300 shrink-0" />
        <span className="text-xs font-medium text-red-200">Weak connection</span>
        {rtt != null && (
          <span className="text-[10px] font-mono text-red-300/70">{rtt}ms</span>
        )}
      </div>
    </div>
  );
}

function ControlButton({
  onClick, active, danger, accent, title, children, size = 'default',
}: {
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  title: string;
  children: React.ReactNode;
  size?: 'default' | 'sm';
}) {
  const base = size === 'sm'
    ? 'flex items-center justify-center w-10 h-10 rounded-full border transition-all duration-200 shadow-lg active:scale-90 '
    : 'flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-200 shadow-lg active:scale-90 ';
  const variant = danger
    ? 'bg-gradient-to-br from-red-500 to-red-600 hover:from-red-500 hover:to-red-500 border-red-400/40 text-white shadow-red-500/40 hover:scale-105'
    : accent
      ? 'bg-wa-accent/85 hover:bg-wa-accent border-emerald-300/40 text-white'
      : active
        ? 'bg-white/85 hover:bg-white border-white/60 text-zinc-900'
        : 'bg-white/10 hover:bg-white/20 border-white/15 text-white';
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title} className={`${base} ${variant}`}>
      {children}
    </button>
  );
}

/** Quick emoji reaction during call */
const CALL_EMOJIS = ['👍', '❤️', '😂', '🎉', '🔥', '👋'];

function EmojiReactionBar({ onReact }: { onReact: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <ControlButton onClick={() => setOpen(!open)} active={open} title="React">
        <Smile className="w-5 h-5" />
      </ControlButton>
      {open && (
        <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex gap-1 bg-zinc-900/95 border border-white/10 rounded-2xl px-3 py-2 shadow-xl animate-scale-in origin-bottom">
          {CALL_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => { onReact(emoji); setOpen(false); }}
              className="w-10 h-10 flex items-center justify-center text-xl rounded-xl hover:bg-white/10 transition-all hover:scale-125 active:scale-90"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Screen share quality picker */
function ScreenShareQualityPicker({ quality, onChange }: { quality: ScreenShareQuality; onChange: (q: ScreenShareQuality) => void }) {
  const [open, setOpen] = useState(false);
  const qualities: ScreenShareQuality[] = ['480p', '720p', '1080p', 'source'];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-medium text-white transition-all border border-white/10"
        title="Screen share quality"
      >
        <Share2 className="w-3 h-3" />
        {quality}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/10 rounded-xl py-1 shadow-xl min-w-[100px] animate-scale-in origin-bottom">
          {qualities.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => { onChange(q); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-white/10 transition-colors ${quality === q ? 'text-emerald-400 font-medium' : 'text-white'}`}
            >
              {q === 'source' ? 'Source (Original)' : q.toUpperCase()}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Noise suppression picker */
function NoiseSuppressionPicker({ level, onChange }: { level: string; onChange: (l: 'off' | 'low' | 'high') => void }) {
  const [open, setOpen] = useState(false);
  const levels: Array<{ key: 'off' | 'low' | 'high'; label: string }> = [
    { key: 'off', label: 'Off' },
    { key: 'low', label: 'Low' },
    { key: 'high', label: 'High' },
  ];

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/10 hover:bg-white/20 text-[10px] font-medium text-white transition-all border border-white/10"
        title="Noise suppression"
      >
        <Volume2 className="w-3 h-3" />
        NS:{level}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/10 rounded-xl py-1 shadow-xl min-w-[80px] animate-scale-in origin-bottom">
          {levels.map((l) => (
            <button
              key={l.key}
              type="button"
              onClick={() => { onChange(l.key); setOpen(false); }}
              className={`w-full px-3 py-1.5 text-xs text-left hover:bg-white/10 transition-colors ${level === l.key ? 'text-emerald-400 font-medium' : 'text-white'}`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const InCallUI: React.FC = () => {
  const {
    participant, duration,
    liveKitConnected, isReconnecting, reconnectAttempt,
    localQuality, remoteQuality, localRtt, hasScreenShare,
    isDeafened,
    screenShareQuality, noiseSuppression, callEmojis,
    toggleMinimize, toggleDeafen,
  } = useCallStore();

  const {
    isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled,
    setMuted, setCameraEnabled, setScreenShareEnabled,
    setScreenShareQuality, setNoiseSuppression,
  } = useLiveKitCall();

  const allTracks = useTracks([Track.Source.Camera, Track.Source.ScreenShare], { onlySubscribed: true });
  const remoteVideoTracks = allTracks.filter((t) => !t.participant.isLocal && t.source === Track.Source.Camera);
  const screenShareTracks = allTracks.filter((t) => !t.participant.isLocal && t.source === Track.Source.ScreenShare);
  const localTracks = useTracks([Track.Source.Camera], { onlySubscribed: false }).filter((t) => t.participant.isLocal);

  const showLocalPip = isCameraEnabled && localTracks.length > 0;

  const [pip, setPip] = useState<{ x: number; y: number }>(() => ({
    x: window.innerWidth - 140,
    y: window.innerHeight - 280,
  }));
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);

  const onPipDown = (e: React.PointerEvent) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: pip.x, oy: pip.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPipMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setPip({
      x: Math.max(8, Math.min(window.innerWidth - 120, dragRef.current.ox + dx)),
      y: Math.max(8, Math.min(window.innerHeight - 150, dragRef.current.oy + dy)),
    });
  };
  const onPipUp = () => { dragRef.current = null; };

  useEffect(() => {
    useCallStore.setState({ isMuted: !isMicrophoneEnabled, isVideoOff: !isCameraEnabled });
  }, [isMicrophoneEnabled, isCameraEnabled]);

  const handleEndCall = () => {
    const { callId: cid } = useCallStore.getState();
    if (cid) {
      import('../../api/calls.api').then(({ callsApi }) => callsApi.end(cid));
    }
    useCallStore.getState().reset();
  };

  const handleMute = () => {
    setMuted(isMicrophoneEnabled);
    useCallStore.setState({ isMuted: isMicrophoneEnabled });
  };

  const handleDeafen = () => {
    const newDeafened = !isDeafened;
    toggleDeafen();
    if (newDeafened) {
      setMuted(true);
    }
  };

  const handleVideo = async () => {
    const newEnabled = !isCameraEnabled;
    await setCameraEnabled(newEnabled);
  };

  const handleScreenShare = async () => {
    const newEnabled = !isScreenShareEnabled;
    await setScreenShareEnabled(newEnabled);
    useCallStore.setState({ isScreenSharing: newEnabled });
  };

  const handleEmojiReact = (emoji: string) => {
    const { addCallEmoji } = useCallStore.getState();
    const x = Math.random() * 80 + 10;
    const y = Math.random() * 60 + 20;
    addCallEmoji(emoji, x, y);
    // Auto-remove after animation
    setTimeout(() => {
      const state = useCallStore.getState();
      const lastEmoji = state.callEmojis[state.callEmojis.length - 1];
      if (lastEmoji) state.removeCallEmoji(lastEmoji.id);
    }, 2000);
  };

  const stateLabel = liveKitConnected
    ? (isReconnecting ? `Reconnecting... (${reconnectAttempt})` : formatDuration(duration))
    : 'Connecting...';

  const hasRemoteVideo = remoteVideoTracks.length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-gradient-to-br from-[#0b0b0e] via-[#0d0d12] to-[#16121d] font-sans">
      <RoomAudioRenderer />

      {/* Reconnecting banner */}
      {isReconnecting && (
        <div className="absolute top-0 inset-x-0 z-[70] flex items-center justify-center gap-2 py-2 bg-amber-500/15 border-b border-amber-400/30">
          <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
          <span className="text-sm font-medium text-amber-200">
            Reconnecting…{reconnectAttempt > 1 && ` (${reconnectAttempt})`}
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 relative overflow-hidden">
        {hasScreenShare && screenShareTracks.length > 0 ? (
          <div className="flex h-full">
            <div className="flex-1 relative bg-black">
              {screenShareTracks.map((trackRef) => (
                <ParticipantTile key={`ss-${trackRef.participant.identity}`} trackRef={trackRef} className="w-full h-full [&_video]:object-contain" disableSpeakingIndicator />
              ))}
            </div>
            <div className="w-44 flex flex-col gap-2 p-2 bg-black/40 border-l border-white/10">
              {remoteVideoTracks.map((trackRef) => (
                <div key={`cam-${trackRef.participant.identity}`} className="rounded-xl overflow-hidden aspect-video border border-white/10">
                  <ParticipantTile trackRef={trackRef} className="w-full h-full [&_video]:object-cover" disableSpeakingIndicator />
                </div>
              ))}
              {localTracks.map((trackRef) => (
                <div key="local-cam" className="rounded-xl overflow-hidden aspect-video border border-white/15">
                  <ParticipantTile trackRef={trackRef} className="w-full h-full [&_video]:object-cover" disableSpeakingIndicator />
                </div>
              ))}
            </div>
          </div>
        ) : hasRemoteVideo ? (
          <div className="absolute inset-0 bg-black">
            {remoteVideoTracks.map((trackRef) => (
              <ParticipantTile
                key={trackRef.participant.identity}
                trackRef={trackRef}
                className="w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                disableSpeakingIndicator
              />
            ))}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(16,185,129,0.12),transparent_60%)]" />
            <div className="relative">
              <Avatar src={participant?.avatar} name={participant?.displayName} size="2xl" showRing />
            </div>
            <p className="relative text-2xl font-semibold text-white">{participant?.displayName}</p>
            {!liveKitConnected && !isReconnecting && (
              <p className="relative text-sm text-white/50 animate-pulse tracking-wide">Connecting…</p>
            )}
          </div>
        )}

        {/* Local self-view PiP */}
        {showLocalPip && (
          <div
            onPointerDown={onPipDown}
            onPointerMove={onPipMove}
            onPointerUp={onPipUp}
            style={{ left: pip.x, top: pip.y, touchAction: 'none' }}
            className="absolute w-28 h-40 sm:w-32 sm:h-44 rounded-2xl overflow-hidden border border-white/20 shadow-pop bg-black/60 z-20 cursor-grab active:cursor-grabbing"
          >
            {localTracks.map((trackRef) => (
              <ParticipantTile key="local" trackRef={trackRef} className="w-full h-full [&_video]:object-cover [&_video]:-scale-x-100" disableSpeakingIndicator />
            ))}
          </div>
        )}

        {/* Top status bar */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-4 py-2 rounded-2xl bg-white/8 border border-white/15 shadow-lg">
          <span className={`w-2 h-2 rounded-full ${liveKitConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-pulse'}`} />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-medium text-white max-w-[40vw] truncate">{participant?.displayName}</span>
            <span className="text-xs font-mono text-white/70">{stateLabel}</span>
          </div>
          <div className="flex items-center gap-3 pl-3 ml-1 border-l border-white/10">
            <ConnectionBadge quality={localQuality} rtt={localRtt} />
            <div className="hidden sm:flex items-center gap-3">
              <QualityIndicator quality={localQuality} label="You" />
              <QualityIndicator quality={remoteQuality} label="Them" />
            </div>
          </div>
        </div>

        {/* Floating emoji reactions */}
        {callEmojis.map((e) => (
          <div
            key={e.id}
            className="absolute text-3xl pointer-events-none animate-emoji-particle z-[65]"
            style={{ left: `${e.x}%`, top: `${e.y}%` }}
          >
            {e.emoji}
          </div>
        ))}

        {/* Screen share quality & noise suppression controls (top-right) */}
        {isScreenShareEnabled && (
          <div className="absolute top-3 right-3 z-10 flex items-center gap-2">
            <ScreenShareQualityPicker quality={screenShareQuality} onChange={setScreenShareQuality} />
          </div>
        )}
      </div>

      {/* Weak connection warning */}
      <WeakConnectionBanner quality={localQuality} rtt={localRtt} />

      {/* Controls */}
      <div className="relative z-20 flex justify-center pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-3">
        <div className="relative flex items-center gap-2 px-3 py-3 rounded-full bg-white/10 border border-white/15 shadow-pop">
          {/* Device pickers float above */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 flex gap-2">
            <DevicePicker kind="audioinput" />
            {isCameraEnabled && <CameraSwitchButton />}
          </div>

          {/* Mute */}
          <ControlButton onClick={handleMute} active={!isMicrophoneEnabled} title={isMicrophoneEnabled ? 'Mute' : 'Unmute'}>
            {isMicrophoneEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </ControlButton>

          {/* Deafen */}
          <ControlButton onClick={handleDeafen} active={isDeafened} title={isDeafened ? 'Undeafen' : 'Deafen'}>
            {isDeafened ? <HeadphoneOff className="w-5 h-5" /> : <Headphones className="w-5 h-5" />}
          </ControlButton>

          {/* Camera */}
          <ControlButton onClick={handleVideo} accent={!isCameraEnabled} active={false} title={isCameraEnabled ? 'Turn camera off' : 'Enable video'}>
            {isCameraEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </ControlButton>

          {/* Screen Share */}
          <ControlButton onClick={handleScreenShare} active={isScreenShareEnabled} title={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}>
            <MonitorUp className="w-5 h-5" />
          </ControlButton>

          {/* Screen Share Audio */}
          {isScreenShareEnabled && (
            <ControlButton
              onClick={() => useCallStore.setState({ isScreenShareAudio: !useCallStore.getState().isScreenShareAudio })}
              active={useCallStore.getState().isScreenShareAudio}
              size="sm"
              title="Share audio"
            >
              <Volume2 className="w-4 h-4" />
            </ControlButton>
          )}

          {/* Noise Suppression */}
          <NoiseSuppressionPicker level={noiseSuppression} onChange={setNoiseSuppression} />

          {/* Emoji Reactions */}
          <EmojiReactionBar onReact={handleEmojiReact} />

          {/* Minimize */}
          <ControlButton onClick={toggleMinimize} title="Minimize">
            <Minimize2 className="w-5 h-5" />
          </ControlButton>

          {/* End Call */}
          <ControlButton onClick={handleEndCall} danger title="End call">
            <PhoneOff className="w-5 h-5" />
          </ControlButton>
        </div>
      </div>
    </div>
  );
};
