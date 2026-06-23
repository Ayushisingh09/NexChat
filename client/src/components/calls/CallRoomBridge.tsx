import { useEffect } from 'react';
import { useRoomContext } from '@livekit/components-react';
import {
  RoomEvent,
  ConnectionState,
  ConnectionQuality as LKConnectionQuality,
  Track,
  type Participant,
} from 'livekit-client';
import { useCallStore, type ConnectionQuality } from '../../store/call.store';

function mapQuality(q: LKConnectionQuality): ConnectionQuality {
  switch (q) {
    case LKConnectionQuality.Excellent:
      return 'excellent';
    case LKConnectionQuality.Good:
      return 'good';
    case LKConnectionQuality.Poor:
      return 'poor';
    default:
      return 'unknown';
  }
}

/**
 * Headless bridge that lives INSIDE <LiveKitRoom>. It is the single place that
 * translates real LiveKit room events into our Zustand call store.
 *
 * Previously `setLiveKitConnected` was declared in the store but never invoked
 * anywhere, so `liveKitConnected` stayed `false` for the whole call — which is
 * why the UI was stuck on "Connecting..." and the duration timer (gated on that
 * flag) never started, even though media was flowing.
 */
export const CallRoomBridge: React.FC = () => {
  const room = useRoomContext();

  // --- Room/connection events -> store ---
  useEffect(() => {
    if (!room) return;
    const store = () => useCallStore.getState();

    const syncConnectionState = () => {
      switch (room.state) {
        case ConnectionState.Connected:
          // Clears reconnecting flag too (see store impl).
          store().setLiveKitConnected(true);
          break;
        case ConnectionState.Reconnecting:
          store().setReconnecting(true, store().reconnectAttempt + 1);
          break;
        case ConnectionState.Disconnected:
          store().setLiveKitConnected(false);
          break;
        // Connecting: leave UI in its "Connecting..." state.
      }
    };

    const onQualityChanged = (q: LKConnectionQuality, participant: Participant) => {
      if (participant.isLocal) store().setLocalQuality(mapQuality(q));
      else store().setRemoteQuality(mapQuality(q));
    };

    const onActiveSpeakers = (speakers: Participant[]) => {
      store().setActiveSpeaker(speakers[0]?.identity ?? null);
    };

    const syncScreenShare = () => {
      let has = false;
      room.remoteParticipants.forEach((p) => {
        if (p.getTrackPublication(Track.Source.ScreenShare)) has = true;
      });
      if (room.localParticipant.getTrackPublication(Track.Source.ScreenShare)) has = true;
      store().setHasScreenShare(has);
    };

    // Prime initial values (the Connected event may have already fired before
    // this component mounted).
    syncConnectionState();
    syncScreenShare();

    room.on(RoomEvent.ConnectionStateChanged, syncConnectionState);
    room.on(RoomEvent.Connected, syncConnectionState);
    room.on(RoomEvent.Reconnecting, syncConnectionState);
    room.on(RoomEvent.Reconnected, syncConnectionState);
    room.on(RoomEvent.ConnectionQualityChanged, onQualityChanged);
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
    room.on(RoomEvent.TrackSubscribed, syncScreenShare);
    room.on(RoomEvent.TrackUnsubscribed, syncScreenShare);
    room.on(RoomEvent.LocalTrackPublished, syncScreenShare);
    room.on(RoomEvent.LocalTrackUnpublished, syncScreenShare);

    return () => {
      room.off(RoomEvent.ConnectionStateChanged, syncConnectionState);
      room.off(RoomEvent.Connected, syncConnectionState);
      room.off(RoomEvent.Reconnecting, syncConnectionState);
      room.off(RoomEvent.Reconnected, syncConnectionState);
      room.off(RoomEvent.ConnectionQualityChanged, onQualityChanged);
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers);
      room.off(RoomEvent.TrackSubscribed, syncScreenShare);
      room.off(RoomEvent.TrackUnsubscribed, syncScreenShare);
      room.off(RoomEvent.LocalTrackPublished, syncScreenShare);
      room.off(RoomEvent.LocalTrackUnpublished, syncScreenShare);
    };
  }, [room]);

  // --- Duration timer ---
  // Lives here (not in InCallUI) so it keeps ticking when the call is minimized
  // to the PiP. Starts only once the room actually reports Connected.
  const liveKitConnected = useCallStore((s) => s.liveKitConnected);
  useEffect(() => {
    if (!liveKitConnected) return;
    const id = setInterval(() => {
      useCallStore.getState().setDuration(useCallStore.getState().duration + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [liveKitConnected]);

  // --- RTT polling via WebRTC stats ---
  // Access the underlying RTCPeerConnection through LiveKit's internal engine
  // to read currentRoundTripTime. No extra network calls — the browser tracks
  // this internally and LiveKit updates it every ~2s.
  useEffect(() => {
    if (!room || !liveKitConnected) return;
    const id = setInterval(async () => {
      try {
        const publisher = (room as any).engine?.pcManager?.publisher;
        if (!publisher) return;
        const stats: RTCStatsReport = await publisher.getStats();
        stats.forEach((report) => {
          if (report.type === 'candidate-pair' && report.nominated && report.currentRoundTripTime != null) {
            useCallStore.getState().setLocalRtt(Math.round(report.currentRoundTripTime * 1000));
          }
        });
      } catch {
        // getStats() may fail if the room is disconnecting — ignore silently.
      }
    }, 2000);
    return () => clearInterval(id);
  }, [room, liveKitConnected]);

  return null;
};
