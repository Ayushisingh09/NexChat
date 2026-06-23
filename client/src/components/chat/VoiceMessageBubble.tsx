import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, Pause, AlertTriangle } from 'lucide-react';
import { cn } from '../../lib/utils';

interface VoiceMessageBubbleProps {
  mediaUrl: string;
  isOwn: boolean;
}

const buildBars = (seedStr: string, count = 32): number[] => {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) seed = (seed * 31 + seedStr.charCodeAt(i)) >>> 0;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    seed = (seed * 1103515245 + 12345) >>> 0;
    bars.push(0.25 + (seed % 1000) / 1333);
  }
  return bars;
};

const SPEEDS = [1, 1.5, 2];

const formatDuration = (secs: number) => {
  if (!isFinite(secs) || isNaN(secs)) return '0:00';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

export const VoiceMessageBubble: React.FC<VoiceMessageBubbleProps> = ({ mediaUrl, isOwn }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const barsRef = useRef(buildBars(mediaUrl));

  useEffect(() => {
    const audio = new Audio(mediaUrl);
    audio.crossOrigin = 'anonymous';
    audio.preload = 'metadata';
    audioRef.current = audio;
    setLoading(true);
    setLoadError(false);
    setDuration(0);
    setCurrentTime(0);

    const onLoaded = () => {
      if (audio.duration === Infinity) {
        audio.currentTime = 1e7;
        audio.ontimeupdate = () => {
          audio.ontimeupdate = null;
          audio.currentTime = 0;
          setDuration(audio.duration);
          setLoading(false);
        };
      } else {
        setDuration(audio.duration);
        setLoading(false);
      }
    };
    const onTime = () => setCurrentTime(audio.currentTime);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      audio.currentTime = 0;
    };
    const onError = () => {
      setLoadError(true);
      setLoading(false);
    };

    audio.addEventListener('loadedmetadata', onLoaded);
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoaded);
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audioRef.current = null;
    };
  }, [mediaUrl]);

  const togglePlay = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.playbackRate = SPEEDS[speedIdx];
      audio.play().catch(() => undefined);
      setIsPlaying(true);
    }
  }, [isPlaying, speedIdx]);

  const cycleSpeed = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) audioRef.current.playbackRate = SPEEDS[next];
  }, [speedIdx]);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio || !duration || !isFinite(duration)) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  const progress = duration > 0 && isFinite(duration) ? currentTime / duration : 0;

  if (loadError) {
    return (
      <div className="flex items-center gap-2 w-[260px] py-2 px-2 select-none text-wa-secondary/60 text-xs">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
        <span>Audio unavailable</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 w-[260px] max-w-full min-w-0 select-none">
      <button type="button"
        onClick={togglePlay}
        aria-label={isPlaying ? 'Pause voice message' : 'Play voice message'}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition shrink-0 active:scale-90",
          isOwn 
            ? "bg-blue-400/20 hover:bg-blue-400/30 text-blue-300" 
            : "bg-wa-surface-2 hover:bg-wa-surface-2/80 text-wa-secondary"
        )}
      >
        {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
      </button>

      <div className="flex-grow min-w-0 flex flex-col gap-1.5">
        <div
          className="flex items-center gap-[2px] h-8 cursor-pointer"
          onClick={seekTo}
          role="slider"
          aria-label="Seek"
          aria-valuemin={0}
          aria-valuemax={Math.round(duration)}
          aria-valuenow={Math.round(currentTime)}
        >
          {barsRef.current.map((h, i) => {
            const played = i / barsRef.current.length <= progress;
            return (
              <div
                key={i}
                className={cn(
                  "flex-1 rounded-full transition-colors duration-100",
                  isOwn 
                    ? (played ? 'bg-white' : 'bg-white/30')
                    : (played ? 'bg-wa-accent' : 'bg-wa-secondary/30')
                )}
                style={{ height: `${Math.round(h * 100)}%`, minWidth: '2px' }}
              />
            );
          })}
        </div>
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-[10px] tabular-nums",
            isOwn ? "text-white/70" : "text-wa-secondary"
          )}>
            {loading ? 'loading...' : (isPlaying || currentTime > 0 ? formatDuration(currentTime) : formatDuration(duration))}
          </span>
          <button type="button"
            onClick={cycleSpeed}
            aria-label="Playback speed"
            className={cn(
              "text-[10px] font-bold rounded-full px-2 py-0.5 transition shrink-0 tabular-nums",
              isOwn 
                ? "text-white/70 hover:text-white bg-white/10 hover:bg-white/20" 
                : "text-wa-secondary hover:text-wa-primary bg-wa-surface-2/50 hover:bg-wa-surface-2"
            )}
          >
            {SPEEDS[speedIdx]}x
          </button>
        </div>
      </div>
    </div>
  );
};
