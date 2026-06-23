import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { conversationsApi } from '../api/conversations.api';
import { useAuthStore } from '../store/auth.store';
import { useConversationStore } from '../store/conversation.store';
import { Users, Loader2, AlertTriangle, Check, Globe, Shield, ArrowLeft, Sparkles } from 'lucide-react';

const JoinGroupPage: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const setActiveConversation = useConversationStore((state) => state.setActiveConversation);

  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [requested, setRequested] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => conversationsApi.previewInvite(token!),
    enabled: !!token && !!user,
    retry: false,
  });

  if (!user) {
    try {
      sessionStorage.setItem('pendingInvite', token || '');
    } catch { /* ignore */ }
    navigate('/auth', { replace: true });
    return null;
  }

  const handleJoin = async () => {
    if (!token) return;
    setJoining(true);
    setJoinError(null);
    try {
      const res = await conversationsApi.joinViaInvite(token);
      if ((res as any).requiresApproval) {
        setRequested(true);
      } else {
        await queryClient.invalidateQueries({ queryKey: ['conversations'] });
        setActiveConversation(res);
        navigate('/chat', { replace: true });
      }
    } catch (err: any) {
      setJoinError(err?.response?.data?.message || 'Failed to join group');
      setJoining(false);
    }
  };

  const invalidMessage =
    (error as any)?.response?.data?.message || 'This invite link is no longer valid.';

  return (
    <div className="min-h-screen flex items-center justify-center bg-wa-chat p-4">
      <div className="max-w-sm w-full mx-auto bg-wa-sidebar/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-lg overflow-hidden relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <Loader2 className="w-8 h-8 animate-spin text-wa-accent mb-4" />
            <p className="text-sm text-wa-secondary">Loading invite…</p>
          </div>
        ) : error ? (
          <>
            {/* Error Status Badge */}
            <div className="absolute top-3 right-3 px-2.5 py-0.5 text-xs rounded-full bg-red-900/50 text-red-300 font-medium">
              Invalid
            </div>

            {/* Error Header */}
            <div className="p-6 text-center border-b border-white/[0.06]">
              <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center mb-3">
                <AlertTriangle className="w-8 h-8 text-red-400" />
              </div>
              <h2 className="text-lg font-semibold text-white">Invite Unavailable</h2>
              <p className="text-sm text-wa-secondary mt-1">{invalidMessage}</p>
            </div>

            {/* Error Action */}
            <div className="p-5">
              <button type="button"
                onClick={() => navigate('/chat', { replace: true })}
                className="w-full py-3 bg-wa-accent text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition flex items-center justify-center gap-2"
              >
                Go to Chats
              </button>
            </div>
          </>
        ) : data ? (
          requested ? (
            <>
              {/* Success Status Badge */}
              <div className="absolute top-3 right-3 px-2.5 py-0.5 text-xs rounded-full bg-emerald-900/50 text-emerald-300 font-medium">
                Pending
              </div>

              {/* Success Header */}
              <div className="p-6 text-center border-b border-white/[0.06]">
                <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center mb-3">
                  <Check className="w-8 h-8 text-emerald-400" />
                </div>
                <h2 className="text-lg font-semibold text-white">Request Sent</h2>
                <p className="text-sm text-wa-secondary mt-2 leading-relaxed px-2">
                  Your request to join <strong className="text-white">{data.name}</strong> was submitted. An administrator must approve it before you can participate.
                </p>
              </div>

              {/* Success Action */}
              <div className="p-5">
                <button type="button"
                  onClick={() => navigate('/chat', { replace: true })}
                  className="w-full py-3 bg-wa-accent text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 transition flex items-center justify-center gap-2"
                >
                  Go to Chats
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Online Status Badge */}
              <div className="absolute top-3 right-3 px-2.5 py-0.5 text-xs rounded-full bg-emerald-900/50 text-emerald-300 font-medium">
                Open
              </div>

              {/* Group Avatar & Info */}
              <div className="p-6 text-center border-b border-white/[0.06]">
                <div className="relative w-20 h-20 mx-auto mb-4">
                  {data.avatar ? (
                    <img
                      src={data.avatar}
                      alt={data.name || 'Group'}
                      className="w-full h-full rounded-full object-cover ring-2 ring-white/10"
                    />
                  ) : (
                    <div className="w-full h-full rounded-full bg-gradient-to-br from-wa-accent/20 to-wa-accent/5 flex items-center justify-center ring-2 ring-white/10">
                      <span className="text-2xl font-bold text-wa-accent">
                        {(data.name || 'G')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-wa-accent flex items-center justify-center border-2 border-wa-sidebar">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                </div>

                <h2 className="text-xl font-bold text-white">
                  {data.name || 'Group'}
                </h2>
                <p className="text-sm text-wa-secondary mt-1 flex items-center justify-center gap-1.5">
                  <Users className="w-4 h-4" /> {data.memberCount} member{data.memberCount === 1 ? '' : 's'}
                </p>
              </div>

              {/* Group Details */}
              <div className="px-5 py-4 space-y-3">
                <div className="flex items-center justify-between text-sm text-wa-secondary">
                  <div className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-wa-accent" />
                    Public Group
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-wa-accent" />
                    Invite Only
                  </div>
                </div>

                {joinError && (
                  <div className="bg-red-950/30 border border-red-500/30 rounded-xl px-4 py-2.5">
                    <p className="text-xs text-red-300">{joinError}</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-2 pt-2">
                  <button type="button"
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full py-3 bg-wa-accent text-white text-sm font-semibold rounded-xl hover:bg-emerald-600 disabled:opacity-60 transition flex items-center justify-center gap-2"
                  >
                    {joining ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Joining…
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        Join Group
                      </>
                    )}
                  </button>
                  <button type="button"
                    onClick={() => navigate('/chat', { replace: true })}
                    className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-wa-secondary text-sm font-medium rounded-xl transition flex items-center justify-center gap-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Not now
                  </button>
                </div>
              </div>
            </>
          )
        ) : null}
      </div>
    </div>
  );
};

export default JoinGroupPage;
