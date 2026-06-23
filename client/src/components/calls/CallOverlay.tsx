import React, { useEffect } from 'react';
import { useCallStore } from '../../store/call.store';
import { useCallSocket } from '../../hooks/useCallSocket';
import { callsApi } from '../../api/calls.api';
import { IncomingCallModal } from './IncomingCallModal';
import { OutgoingCallModal } from './OutgoingCallModal';
import { InCallUI } from './InCallUI';
import { CallPiP } from './CallPiP';
import { CallRoomProvider } from './CallRoomProvider';
import { stopAllSounds, playCallEnded } from '../../utils/callSounds';

export const CallOverlay: React.FC = () => {
  useCallSocket();

  const { status, direction, isMinimized, callId } = useCallStore();

  // Stop sounds when call ends
  useEffect(() => {
    if (status === 'idle') {
      stopAllSounds();
    }
  }, [status]);

  // Auto-end call if LiveKit disconnects unexpectedly
  useEffect(() => {
    if (status !== 'ongoing' || !callId) return;
    const unsub = useCallStore.subscribe((state, prev) => {
      if (prev.liveKitConnected && !state.liveKitConnected && state.status === 'ongoing') {
        callsApi.end(callId).catch(() => {});
        playCallEnded();
        useCallStore.getState().reset();
      }
    });
    return unsub;
  }, [status, callId]);

  if (status === 'idle') return null;

  if (status === 'ringing' && direction === 'incoming') {
    return <IncomingCallModal />;
  }

  if (status === 'ringing' && direction === 'outgoing') {
    return <OutgoingCallModal />;
  }

  if (status === 'ongoing') {
    const ui = isMinimized ? <CallPiP /> : <InCallUI />;
    return <CallRoomProvider>{ui}</CallRoomProvider>;
  }

  return null;
};
