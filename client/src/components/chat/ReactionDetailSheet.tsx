import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Loader2 } from 'lucide-react';
import { messagesApi } from '../../api/messages.api';
import { useAuthStore } from '../../store/auth.store';
import { Avatar } from '../layout/Avatar';

interface ReactionDetailSheetProps {
  messageId: string;
  onClose: () => void;
}

export const ReactionDetailSheet: React.FC<ReactionDetailSheetProps> = ({ messageId, onClose }) => {
  const currentUser = useAuthStore((state) => state.user);
  const [activeEmoji, setActiveEmoji] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['reactions', messageId],
    queryFn: () => messagesApi.getReactions(messageId),
  });

  const emojis = data ? Object.keys(data) : [];
  const selected = activeEmoji || emojis[0] || null;
  const allUsers = data ? Object.values(data).flatMap((g) => g.users) : [];
  const totalCount = allUsers.length;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-[#1f2c34] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[480px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
          <h3 className="font-bold text-white text-sm">Reactions</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-white/[0.06] rounded-full transition"
          >
            <X className="w-4 h-4 text-zinc-400" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-xs text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : emojis.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">No reactions yet</div>
        ) : (
          <>
            {/* Emoji tabs */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.06] overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveEmoji('__all')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full shrink-0 transition-all ${
                  selected === '__all' || activeEmoji === '__all'
                    ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                    : 'text-zinc-400 hover:bg-white/[0.06]'
                }`}
              >
                <span className="text-sm">👍</span>
                <span>All {totalCount}</span>
              </button>
              {emojis.map((emoji) => (
                <button
                  type="button"
                  key={emoji}
                  onClick={() => setActiveEmoji(emoji)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full shrink-0 transition-all ${
                    selected === emoji && activeEmoji !== '__all'
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30'
                      : 'text-zinc-400 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className="text-sm">{emoji}</span>
                  <span>{data![emoji].count}</span>
                </button>
              ))}
            </div>

            {/* User list */}
            <div className="flex-grow overflow-y-auto p-2">
              {(activeEmoji === '__all'
                ? allUsers
                : selected && data
                  ? data[selected].users
                  : []
              ).map((u, i) => (
                <div
                  key={`${u.id}-${i}`}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.04] transition-colors"
                >
                  <Avatar src={null} name={u.displayName} size="sm" />
                  <span className="text-sm text-white">
                    {u.id === currentUser?.id ? 'You' : u.displayName}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
