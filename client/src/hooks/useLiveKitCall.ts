import { useCallback } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { VideoPresets } from 'livekit-client';
import { callsApi } from '../api/calls.api';
import { useCallStore, type ScreenShareQuality } from '../store/call.store';

export function useLiveKitCall() {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();

  const { isScreenShareAudio } = useCallStore();

  const setMuted = useCallback(
    async (muted: boolean) => {
      await localParticipant?.setMicrophoneEnabled(!muted);
    },
    [localParticipant],
  );

  const setDeafened = useCallback(
    async (deafened: boolean) => {
      // Deafen mutes speaker output (handled in InCallUI via room.audioTracks)
      // and optionally mutes mic too
      if (deafened) {
        await localParticipant?.setMicrophoneEnabled(false);
      }
    },
    [localParticipant],
  );

  const setCameraEnabled = useCallback(
    async (enabled: boolean) => {
      if (!localParticipant) return;
      await localParticipant.setCameraEnabled(
        enabled,
        enabled ? { resolution: VideoPresets.h720.resolution } : undefined,
        enabled
          ? {
              videoEncoding: VideoPresets.h720.encoding,
              simulcast: true,
              videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
              videoCodec: 'vp8',
            }
          : undefined,
      );
    },
    [localParticipant],
  );

  const setScreenShareEnabled = useCallback(
    async (enabled: boolean) => {
      if (!localParticipant) return;
      if (enabled) {
        await localParticipant.setScreenShareEnabled(true, {
          audio: isScreenShareAudio,
        });
      } else {
        await localParticipant.setScreenShareEnabled(false);
      }
    },
    [localParticipant, isScreenShareAudio],
  );

  const setScreenShareQualityInternal = useCallback(
    async (quality: ScreenShareQuality) => {
      useCallStore.getState().setScreenShareQuality(quality);
    },
    [],
  );

  const setNoiseSuppressionInternal = useCallback(
    async (level: 'off' | 'low' | 'high') => {
      useCallStore.getState().setNoiseSuppression(level);
      // LiveKit's noise cancellation is enabled via room options
      // This is a UI toggle that affects the room reconnection
    },
    [],
  );

  const getTokenForReconnect = useCallback(async (callId: string): Promise<string | null> => {
    try {
      const res = await callsApi.getToken(callId);
      return res.token;
    } catch {
      return null;
    }
  }, []);

  return {
    localParticipant,
    isMicrophoneEnabled,
    isCameraEnabled,
    isScreenShareEnabled,
    setMuted,
    setDeafened,
    setCameraEnabled,
    setScreenShareEnabled,
    setScreenShareQuality: setScreenShareQualityInternal,
    setNoiseSuppression: setNoiseSuppressionInternal,
    getTokenForReconnect,
  };
}
