import React, { useEffect } from 'react';
import { useCallStore } from '../../store/call.store';
import { useSocketStore } from '../../store/socket.store';
import { callsApi } from '../../api/calls.api';
import { Avatar } from '../layout/Avatar';
import { PhoneOff, Phone, Minimize2, Mic, MicOff } from 'lucide-react';
import { stopAllSounds, playCallRejected } from '../../utils/callSounds';
import { setMicOn } from '../../utils/callPrefs';
import { motion, AnimatePresence } from 'framer-motion';

export const IncomingCallModal: React.FC = () => {
  const socket = useSocketStore((s) => s.socket);
  const { callId, participant, reject, toggleMinimize, isMinimized, isMuted, toggleMute } = useCallStore();

  const handleReject = () => {
    stopAllSounds();
    playCallRejected();
    if (callId) socket?.emit('call:reject', { callId });
    reject();
  };

  const handleAccept = async () => {
    stopAllSounds();
    if (!callId) return;
    try {
      await callsApi.accept(callId);
    } catch (err) {
      console.error('Failed to accept call:', err);
      reject();
    }
  };

  const handleMinimize = () => {
    toggleMinimize();
  };

  const handleMuteToggle = () => {
    toggleMute();
    setMicOn(isMuted);
  };

  useEffect(() => {
    playCallRejected;
    return () => {};
  }, []);

  if (!participant) return null;

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('');
  };

  // Minimized state — small floating banner
  if (isMinimized) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed bottom-24 right-4 z-[55]"
      >
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#1f2c34]/95 border border-white/10 shadow-2xl max-w-[280px] backdrop-blur-lg">
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-[#2a3a45] flex items-center justify-center text-white font-semibold">
              {getInitials(participant.displayName)}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#1f2c34]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-white truncate">{participant.displayName}</p>
            <p className="text-[10px] text-emerald-400 animate-pulse">Incoming call...</p>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={handleMuteToggle}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all active:scale-90"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={handleReject}
              className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white transition-all active:scale-90"
              title="Decline"
            >
              <PhoneOff className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleAccept}
              className="p-2 rounded-full bg-emerald-500/80 hover:bg-emerald-500 text-white transition-all active:scale-90 animate-pulse"
              title="Accept"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Full incoming call screen
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed inset-0 z-[60] bg-black/90 flex flex-col items-center justify-center gap-8"
      >
        <motion.div
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Avatar src={participant.avatar} name={participant.displayName} size="2xl" showRing />
        </motion.div>

        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold text-white">{participant.displayName}</h2>
          <p className="text-sm text-zinc-400 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Incoming call...
          </p>
        </div>

        <div className="flex items-center gap-8">
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
            onClick={handleMinimize}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-transform hover:scale-110"
            title="Minimize"
          >
            <Minimize2 className="w-5 h-5 text-white" />
          </button>
          <button
            type="button"
            onClick={handleReject}
            className="w-16 h-16 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition-transform hover:scale-110"
          >
            <PhoneOff className="w-7 h-7 text-white" />
          </button>
          <button
            type="button"
            onClick={handleAccept}
            className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 flex items-center justify-center transition-transform hover:scale-110 animate-pulse"
          >
            <Phone className="w-7 h-7 text-white" />
          </button>
        </div>
        <p className="text-xs text-zinc-500">Tap to accept, decline, or minimize</p>
      </motion.div>
    </AnimatePresence>
  );
};
