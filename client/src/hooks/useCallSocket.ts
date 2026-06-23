import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocketStore } from '../store/socket.store';
import { useCallStore, type CallParticipant } from '../store/call.store';
import { useAuthStore } from '../store/auth.store';
import { playIncomingRing, playCallAccepted, playCallEnded, playCallRejected, stopAllSounds } from '../utils/callSounds';
import { showCallNotification, closeCallNotification, requestNotificationPermission } from '../utils/callNotifications';
import { callsApi } from '../api/calls.api';

export function useCallSocket() {
  const socket = useSocketStore((s) => s.socket);
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const { setIncoming, setOutgoing, accept, setOngoing, reset } = useCallStore();

  useEffect(() => {
    if (!socket) return;

    const handleIncoming = (data: {
      callId: string;
      roomName: string;
      caller: CallParticipant;
    }) => {
      if (data.caller.id === currentUser?.id) return;
      setIncoming(data.callId, data.roomName, '', data.caller);
      playIncomingRing();
      requestNotificationPermission().then((granted) => {
        if (granted) {
          showCallNotification({
            title: `Incoming call from ${data.caller.displayName || 'Unknown'}`,
            body: 'Tap to answer',
            icon: data.caller.avatar || undefined,
            tag: 'nexchat-call',
            onClick: () => { window.focus(); },
          });
        }
      });
    };

    const handleRinging = (data: {
      callId: string;
      roomName: string;
      callee: CallParticipant;
    }) => {
      if (data.callee.id !== currentUser?.id) return;
    };

    const handleAccepted = (data: { callId: string; roomName: string; token: string }) => {
      stopAllSounds();
      closeCallNotification();
      playCallAccepted();
      accept(data.token, data.roomName);
    };

    const handleRejected = () => {
      stopAllSounds();
      closeCallNotification();
      playCallRejected();
      reset();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleEnded = () => {
      stopAllSounds();
      closeCallNotification();
      playCallEnded();
      reset();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    const handleCancelled = () => {
      stopAllSounds();
      closeCallNotification();
      reset();
    };

    const handleMissed = () => {
      stopAllSounds();
      closeCallNotification();
      playCallRejected();
      reset();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    };

    socket.on('call:invite', handleIncoming);
    socket.on('call:ringing', handleRinging);
    socket.on('call:accepted', handleAccepted);
    socket.on('call:rejected', handleRejected);
    socket.on('call:ended', handleEnded);
    socket.on('call:cancelled', handleCancelled);
    socket.on('call:missed', handleMissed);

    return () => {
      socket.off('call:invite', handleIncoming);
      socket.off('call:ringing', handleRinging);
      socket.off('call:accepted', handleAccepted);
      socket.off('call:rejected', handleRejected);
      socket.off('call:ended', handleEnded);
      socket.off('call:cancelled', handleCancelled);
      socket.off('call:missed', handleMissed);
    };
  }, [socket, currentUser, setIncoming, setOutgoing, accept, setOngoing, reset, queryClient]);

  // Check for pending incoming calls when socket connects (user may have opened
  // browser while someone was already calling them).
  useEffect(() => {
    if (!socket || !currentUser) return;
    const checkPending = async () => {
      try {
        const pending = await callsApi.pending();
        if (pending && useCallStore.getState().status === 'idle') {
          setIncoming(pending.callId, pending.roomName, '', pending.caller);
          playIncomingRing();
          requestNotificationPermission().then((granted) => {
            if (granted) {
              showCallNotification({
                title: `Incoming call from ${pending.caller.displayName || 'Unknown'}`,
                body: 'Tap to answer',
                icon: pending.caller.avatar || undefined,
                tag: 'nexchat-call',
                onClick: () => { window.focus(); },
              });
            }
          });
        }
      } catch {
        // Ignore — non-critical.
      }
    };
    checkPending();
  }, [socket, currentUser, setIncoming]);
}
