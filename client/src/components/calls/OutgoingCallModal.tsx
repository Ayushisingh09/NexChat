import React, { useEffect, useRef } from 'react';
import { useCallStore } from '../../store/call.store';
import { useSocketStore } from '../../store/socket.store';
import { Avatar } from '../layout/Avatar';
import { PhoneOff, Mic, MicOff } from 'lucide-react';
import { stopAllSounds, playCallRejected } from '../../utils/callSounds';
import { setMicOn } from '../../utils/callPrefs';
import { motion, AnimatePresence } from 'framer-motion';

const AUTO_CANCEL_MS = 40_000;

export const OutgoingCallModal: React.FC = () => {
  const socket = useSocketStore((s) => s.socket);
  const { callId, participant, reset, isVideoCall, isMuted, toggleMute } = useCallStore();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMuteToggle = () => {
    toggleMute();
    setMicOn(isMuted);
  };

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      if (callId) {
        socket?.emit('call:cancel', { callId });
      }
      stopAllSounds();
      playCallRejected();
      reset();
    }, AUTO_CANCEL_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [callId, socket, reset]);

  const handleCancel = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    stopAllSounds();
    playCallRejected();
    if (callId) {
      socket?.emit('call:cancel', { callId });
    }
    reset();
  };

  if (!participant) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center gap-10"
      >
        <div className="relative">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-emerald-500/20"
          />
          <motion.div
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 rounded-full bg-emerald-500/10"
          />
          <Avatar src={participant.avatar} name={participant.displayName} size="2xl" showRing />
        </div>

        <div className="text-center space-y-3">
          <h2 className="text-2xl font-bold text-white">{participant.displayName}</h2>
          <p className="text-sm font-medium text-emerald-400 tracking-wider uppercase animate-pulse">
            {isVideoCall ? 'Video Calling...' : 'Calling...'}
          </p>
        </div>

        <div className="flex items-center gap-6">
          <button
            type="button"
            onClick={handleMuteToggle}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-transform hover:scale-110"
            title={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg shadow-red-500/20 transition-transform hover:scale-110 active:scale-95"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
