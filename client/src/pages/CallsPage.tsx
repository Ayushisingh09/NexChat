import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversationStore } from '../store/conversation.store';
import { conversationsApi } from '../api/conversations.api';
import { AppLayout } from '../components/layout/AppLayout';
import { CallsSidebar } from '../components/sidebar/CallsSidebar';
import { CallUserPicker } from '../components/calls/CallUserPicker';
import type { CallRecord } from '../api/calls.api';
import { Avatar } from '../components/layout/Avatar';
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  ArrowLeft, Video, Clock, CalendarDays, MessageCircle,
} from 'lucide-react';
import { playOutgoingRing } from '../utils/callSounds';
import { useAuthStore } from '../store/auth.store';

function formatDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return d.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

const CallsPage: React.FC = () => {
  const navigate = useNavigate();
  const setActiveConversation = useConversationStore((s) => s.setActiveConversation);
  const currentUser = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<'all' | 'incoming' | 'outgoing' | 'missed'>('all');
  const [selectedCall, setSelectedCall] = useState<CallRecord | null>(null);

  const handleCallUser = async (userId: string, displayName: string | null, avatar: string | null, isVideo = false) => {
    try {
      const { acquireCallLock } = await import('../utils/callPrefs');
      if (!acquireCallLock()) return;
      const { callsApi } = await import('../api/calls.api');
      const { useCallStore } = await import('../store/call.store');
      const res = await callsApi.initiate(userId, isVideo);
      useCallStore.getState().setOutgoing(res.callId, res.roomName, '', {
        id: userId,
        displayName,
        avatar,
      }, isVideo);
      playOutgoingRing();
    } catch (err) {
      console.error('Failed to initiate call:', err);
    }
  };

  const handleSelectCall = (call: CallRecord) => {
    setSelectedCall(call);
  };

  const handleOpenChat = async (call: CallRecord) => {
    const otherId = call.callerId === currentUser?.id ? call.calleeId : call.callerId;
    try {
      const conversations = await conversationsApi.list();
      const existing = conversations.find(
        (c) => c.type === 'DIRECT' && c.participants.some((p) => p.id === otherId)
      );
      if (existing) {
        setActiveConversation(existing);
        navigate('/chat');
      } else {
        const chat = await conversationsApi.create({ type: 'DIRECT', participantIds: [otherId] });
        setActiveConversation(chat);
        navigate('/chat');
      }
    } catch (err) {
      console.error('Failed to open chat:', err);
    }
  };

  const renderCallDetail = () => {
    if (!selectedCall) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0a0a0e] p-8">
          <div className="relative mb-6">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center ring-1 ring-white/[0.06]">
              <Phone className="w-10 h-10 text-emerald-400/60" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center ring-2 ring-[#0a0a0e]">
              <PhoneMissed className="w-4 h-4 text-amber-400" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-zinc-200 mb-2">No call selected</h3>
          <p className="text-sm text-zinc-500 text-center max-w-xs leading-relaxed">
            Pick a call from the list to view details, or start a new one
          </p>
        </div>
      );
    }

    const call = selectedCall;
    const other = call.callerId === currentUser?.id ? call.callee : call.caller;
    const missed = call.status === 'MISSED';
    const rejected = call.status === 'REJECTED';
    const answered = call.status === 'ENDED' && (call.duration ?? 0) > 0;

    const direction = call.callerId === currentUser?.id ? 'outgoing' : 'incoming';

    return (
      <div className="flex-1 flex flex-col bg-[#0a0a0e] overflow-y-auto">
        {/* Mobile back button */}
        <div className="md:hidden flex items-center px-4 py-3 shrink-0">
          <button type="button"
            onClick={() => setSelectedCall(null)}
            className="flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Avatar section */}
          <div className="relative mb-6">
            <div className={`p-1 rounded-full bg-gradient-to-b ${missed || rejected ? 'from-red-500/30 to-red-500/5' : 'from-emerald-500/30 to-emerald-500/5'}`}>
              <Avatar src={other.avatar} name={other.displayName} size="2xl" className="w-28 h-28" />
            </div>
            <div className={`absolute -bottom-1 -right-1 w-10 h-10 rounded-xl flex items-center justify-center ring-[3px] ring-[#0a0a0e] ${
              missed || rejected ? 'bg-red-500/20' : 'bg-emerald-500/20'
            }`}>
              {missed ? (
                <PhoneMissed className="w-5 h-5 text-red-400" />
              ) : rejected ? (
                <PhoneMissed className="w-5 h-5 text-red-400" />
              ) : direction === 'outgoing' ? (
                <PhoneOutgoing className="w-5 h-5 text-emerald-400" />
              ) : (
                <PhoneIncoming className="w-5 h-5 text-emerald-400" />
              )}
            </div>
          </div>

          <h2 className="text-xl font-bold text-white mb-1">{other.displayName}</h2>
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium mb-8 ${
            missed || rejected
              ? 'bg-red-500/10 text-red-400'
              : 'bg-emerald-500/10 text-emerald-400'
          }`}>
            {missed ? 'Missed Call' : rejected ? 'Declined' : 'Answered'}
          </div>

          {/* Details card */}
          <div className="w-full max-w-sm bg-white/[0.03] border border-white/[0.06] rounded-2xl overflow-hidden divide-y divide-white/[0.04]">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <CalendarDays className="w-4 h-4 text-zinc-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Date</p>
                <p className="text-sm text-zinc-200 font-medium mt-0.5">{formatDate(call.createdAt)}</p>
              </div>
            </div>
            {call.startedAt && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Time</p>
                  <p className="text-sm text-zinc-200 font-medium mt-0.5">
                    {new Date(call.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {call.endedAt && ` – ${new Date(call.endedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                  </p>
                </div>
              </div>
            )}
            {answered && (
              <div className="flex items-center gap-3 px-4 py-3.5">
                <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Duration</p>
                  <p className="text-sm text-zinc-200 font-medium mt-0.5">{formatDuration(call.duration)}</p>
                </div>
              </div>
            )}
            <div className="flex items-center gap-3 px-4 py-3.5">
              {call.isVideo ? (
                <Video className="w-4 h-4 text-blue-400 shrink-0" />
              ) : (
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Type</p>
                <p className="text-sm text-zinc-200 font-medium mt-0.5">{call.isVideo ? 'Video Call' : 'Voice Call'}</p>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2.5 mt-6 w-full max-w-sm">
            <button type="button"
              onClick={() => handleCallUser(other.id, other.displayName, other.avatar)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white font-semibold text-sm transition-all active:scale-[0.97] shadow-lg shadow-emerald-500/20"
            >
              <Phone className="w-4 h-4" />
              Voice
            </button>
            <button type="button"
              onClick={() => handleCallUser(other.id, other.displayName, other.avatar, true)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white font-semibold text-sm transition-all active:scale-[0.97] shadow-lg shadow-blue-500/20"
            >
              <Video className="w-4 h-4" />
              Video
            </button>
            <button type="button"
              onClick={() => handleOpenChat(call)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.09] text-zinc-200 font-semibold text-sm border border-white/[0.06] transition-all active:scale-[0.97]"
            >
              <MessageCircle className="w-4 h-4" />
              Chat
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <AppLayout
        sidebar={
          <CallsSidebar
            filter={filter}
            onFilterChange={setFilter}
            onSelectCall={handleSelectCall}
            onCallUser={handleCallUser}
            selectedCallId={selectedCall?.id}
          />
        }
        chat={renderCallDetail()}
      />
      <CallUserPicker onCallUser={handleCallUser} />
    </>
  );
};

export default CallsPage;
