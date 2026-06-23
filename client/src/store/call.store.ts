import { create } from 'zustand';
import { getMicOn } from '../utils/callPrefs';

export interface CallParticipant {
  id: string;
  displayName: string | null;
  avatar: string | null;
}

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'unknown';
export type ScreenShareQuality = '480p' | '720p' | '1080p' | 'source';
export type NoiseSuppression = 'off' | 'low' | 'high';

export interface CallState {
  callId: string | null;
  roomName: string | null;
  token: string | null;
  participant: CallParticipant | null;
  direction: 'outgoing' | 'incoming' | null;
  status: 'idle' | 'ringing' | 'ongoing';
  liveKitConnected: boolean;
  isMuted: boolean;
  isDeafened: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isScreenShareAudio: boolean;
  screenShareQuality: ScreenShareQuality;
  noiseSuppression: NoiseSuppression;
  isMinimized: boolean;
  duration: number;
  isVideoCall: boolean;

  // Reconnection state
  isReconnecting: boolean;
  reconnectAttempt: number;

  // Network quality
  localQuality: ConnectionQuality;
  remoteQuality: ConnectionQuality;
  localRtt: number | null;

  // Active speaker
  activeSpeakerId: string | null;

  // Screen share layout
  hasScreenShare: boolean;

  // Emoji reactions during call
  callEmojis: Array<{ id: string; emoji: string; x: number; y: number }>;

  setIncoming: (callId: string, roomName: string, token: string, caller: CallParticipant) => void;
  setOutgoing: (callId: string, roomName: string, token: string, callee: CallParticipant, isVideo?: boolean) => void;
  accept: (token: string, roomName: string) => void;
  setIsVideoCall: (isVideo: boolean) => void;
  reject: () => void;
  setOngoing: () => void;
  setEnded: () => void;
  setLiveKitConnected: (connected: boolean) => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  toggleVideo: () => void;
  toggleScreenShare: () => void;
  toggleScreenShareAudio: () => void;
  setScreenShareQuality: (quality: ScreenShareQuality) => void;
  setNoiseSuppression: (level: NoiseSuppression) => void;
  toggleMinimize: () => void;
  setDuration: (duration: number) => void;
  setReconnecting: (reconnecting: boolean, attempt?: number) => void;
  setLocalQuality: (quality: ConnectionQuality) => void;
  setRemoteQuality: (quality: ConnectionQuality) => void;
  setLocalRtt: (rtt: number | null) => void;
  setActiveSpeaker: (participantId: string | null) => void;
  setHasScreenShare: (has: boolean) => void;
  addCallEmoji: (emoji: string, x: number, y: number) => void;
  removeCallEmoji: (id: string) => void;
  reset: () => void;
}

const initialState = {
  callId: null,
  roomName: null,
  token: null,
  participant: null,
  direction: null,
  status: 'idle' as const,
  liveKitConnected: false,
  isMuted: false,
  isDeafened: false,
  isVideoOff: false,
  isScreenSharing: false,
  isScreenShareAudio: false,
  screenShareQuality: '720p' as const,
  noiseSuppression: 'high' as const,
  isMinimized: false,
  duration: 0,
  isVideoCall: false,
  isReconnecting: false,
  reconnectAttempt: 0,
  localQuality: 'unknown' as const,
  remoteQuality: 'unknown' as const,
  localRtt: null,
  activeSpeakerId: null,
  hasScreenShare: false,
  callEmojis: [],
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,

  setIncoming: (callId, roomName, token, caller) =>
    set({ callId, roomName, token, participant: caller, direction: 'incoming', status: 'ringing', isMuted: !getMicOn() }),

  setOutgoing: (callId, roomName, token, callee, isVideo = false) =>
    set({ callId, roomName, token, participant: callee, direction: 'outgoing', status: 'ringing', isVideoCall: isVideo, isMuted: !getMicOn() }),

  accept: (token, roomName) => set({ token, roomName, status: 'ongoing' }),
  setIsVideoCall: (isVideo) => set({ isVideoCall: isVideo }),
  reject: () => set({ ...initialState, isMuted: !getMicOn() }),

  setOngoing: () => set({ status: 'ongoing' }),
  setEnded: () => set({ ...initialState, isMuted: !getMicOn() }),

  setLiveKitConnected: (connected) => set({ liveKitConnected: connected, isReconnecting: false, reconnectAttempt: 0 }),

  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleDeafen: () => set((s) => ({ isDeafened: !s.isDeafened })),
  toggleVideo: () => set((s) => ({ isVideoOff: !s.isVideoOff })),
  toggleScreenShare: () => set((s) => ({ isScreenSharing: !s.isScreenSharing })),
  toggleScreenShareAudio: () => set((s) => ({ isScreenShareAudio: !s.isScreenShareAudio })),
  setScreenShareQuality: (quality) => set({ screenShareQuality: quality }),
  setNoiseSuppression: (level) => set({ noiseSuppression: level }),
  toggleMinimize: () => set((s) => ({ isMinimized: !s.isMinimized })),

  setDuration: (duration) => set({ duration }),

  setReconnecting: (reconnecting, attempt = 0) =>
    set({ isReconnecting: reconnecting, reconnectAttempt: attempt }),

  setLocalQuality: (quality) => set({ localQuality: quality }),
  setRemoteQuality: (quality) => set({ remoteQuality: quality }),
  setLocalRtt: (rtt) => set({ localRtt: rtt }),

  setActiveSpeaker: (participantId) => set({ activeSpeakerId: participantId }),

  setHasScreenShare: (has) => set({ hasScreenShare: has }),

  addCallEmoji: (emoji, x, y) => set((s) => ({
    callEmojis: [...s.callEmojis, { id: `emoji-${Date.now()}-${Math.random()}`, emoji, x, y }],
  })),

  removeCallEmoji: (id) => set((s) => ({
    callEmojis: s.callEmojis.filter((e) => e.id !== id),
  })),

  reset: () => set(initialState),
}));
