import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Check, CheckCheck, Loader2 } from 'lucide-react';
import { messagesApi } from '../../api/messages.api';
import { ListItem } from '../layout/ListItem';
import type { ReadReceiptUser } from '../../types/chat.types';

interface ReadReceiptSheetProps {
  messageId: string;
  onClose: () => void;
}

const UserRow: React.FC<{ user: ReadReceiptUser }> = ({ user }) => (
  <ListItem
    className="px-2 py-2 rounded-lg hover:bg-wa-sidebar-hover/50"
    avatar={{ src: user.avatar, name: user.displayName }}
    primaryText={user.displayName}
  />
);

export const ReadReceiptSheet: React.FC<ReadReceiptSheetProps> = ({ messageId, onClose }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['read-by', messageId],
    queryFn: () => messagesApi.readBy(messageId),
  });

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4 select-none animate-fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[440px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 glass border-b border-wa-border">
          <h3 className="font-bold text-wa-primary text-sm">Message Info</h3>
          <button type="button" onClick={onClose} className="p-1 hover:bg-wa-sidebar-hover rounded-full transition">
            <X className="w-4 h-4 text-wa-secondary" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-xs text-wa-secondary">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="flex-grow overflow-y-auto p-2 space-y-1">
            <div className="flex items-center gap-2 px-2 pt-1 pb-1 text-[11px] font-bold uppercase tracking-wider text-sky-400">
              <CheckCheck className="w-3.5 h-3.5" /> Read by {data?.readBy.length || 0}
            </div>
            {data?.readBy.length ? (
              data.readBy.map((u) => <UserRow key={u.id} user={u} />)
            ) : (
              <div className="px-2 py-1.5 text-[11px] text-wa-secondary">No one yet</div>
            )}

            <div className="flex items-center gap-2 px-2 pt-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-wa-secondary">
              <Check className="w-3.5 h-3.5" /> Delivered to {data?.deliveredTo.length || 0}
            </div>
            {data?.deliveredTo.length ? (
              data.deliveredTo.map((u) => <UserRow key={u.id} user={u} />)
            ) : (
              <div className="px-2 py-1.5 text-[11px] text-wa-secondary">No one yet</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
