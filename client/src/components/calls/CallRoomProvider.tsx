import React, { useCallback } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import { VideoPresets } from 'livekit-client';
import { useCallStore } from '../../store/call.store';
import { CallRoomBridge } from './CallRoomBridge';

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://livekit.92lrcorps.xyz';

export const CallRoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, status, isVideoCall } = useCallStore();

  const handleDisconnected = useCallback(() => {
    // LiveKit disconnected — attempt to get a fresh token and reconnect
    const { callId } = useCallStore.getState();
    if (!callId || useCallStore.getState().status !== 'ongoing') return;

    import('../../api/calls.api').then(({ callsApi }) => {
      callsApi.getToken(callId).then((res) => {
        // Update token in store — LiveKitRoom will reconnect with the new token
        useCallStore.getState().accept(res.token, res.roomName);
      }).catch(() => {
        // Failed to get reconnection token — end the call
        callsApi.end(callId).catch(() => {});
        useCallStore.getState().reset();
      });
    });
  }, []);

  if (status !== 'ongoing' || !token) return null;

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      audio={true}
      video={isVideoCall}
      onDisconnected={handleDisconnected}
      options={{
        // adaptiveStream adjusts received quality to the size of the <video>
        // element. Since the remote tile is full-screen, it will request the
        // highest simulcast layer — good. dynacast pauses layers nobody is
        // watching, which is harmless in a 1:1 call.
        adaptiveStream: true,
        dynacast: true,
        // Capture the local camera at 720p by default instead of letting the
        // browser pick a low default resolution.
        videoCaptureDefaults: {
          resolution: VideoPresets.h720.resolution,
        },
        publishDefaults: {
          // Explicit target: 720p @ 1.7 Mbps / 30 fps (matches VideoPresets.h720).
          videoEncoding: VideoPresets.h720.encoding,
          // Simulcast lets the SFU forward a lower layer when the network/CPU
          // can't sustain 720p, instead of dropping frames for everyone.
          simulcast: true,
          videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360],
          // VP8 for broadest cross-browser/codec compatibility on a self-hosted
          // server (H264 hardware encode isn't guaranteed available).
          videoCodec: 'vp8',
          // Enable DTX so silence on the audio track doesn't waste bandwidth.
          dtx: true,
          red: true,
        },
      }}
    >
      <CallRoomBridge />
      {children}
    </LiveKitRoom>
  );
};
