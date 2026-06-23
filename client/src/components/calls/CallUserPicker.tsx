import React, { useState, useEffect } from 'react';
import { useUiStore } from '../../store/ui.store';
import { usersApi } from '../../api/users.api';
import type { User } from '../../types/chat.types';
import { X, Search, Phone, Video } from 'lucide-react';
import { Avatar } from '../layout/Avatar';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface CallUserPickerProps {
  onCallUser: (userId: string, displayName: string | null, avatar: string | null, isVideo?: boolean) => void;
}

export const CallUserPicker: React.FC<CallUserPickerProps> = ({ onCallUser }) => {
  const isOpen = useUiStore((s) => s.isCallPickerOpen);
  const setOpen = useUiStore((s) => s.setCallPickerOpen);

  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useFocusTrap<HTMLDivElement>(isOpen, () => setOpen(false));

  useEffect(() => {
    if (!isOpen) return;

    const fetchUsers = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await usersApi.search(searchQuery.trim());
        setUsers(res);
      } catch (err) {
        console.error('Failed to fetch users:', err);
        setError('Failed to fetch contacts');
      } finally {
        setLoading(false);
      }
    };

    if (!searchQuery.trim()) {
      fetchUsers();
      return;
    }

    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen]);

  const handleCall = (user: User, isVideo: boolean) => {
    onCallUser(user.id, user.displayName ?? null, user.avatar ?? null, isVideo);
    setOpen(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60  flex items-center justify-center z-50 p-4 select-none animate-fade-in" onClick={() => setOpen(false)}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="call-picker-title" tabIndex={-1} className="w-full max-w-md bg-wa-sidebar border border-wa-border rounded-2xl shadow-pop overflow-hidden flex flex-col max-h-[480px] animate-scale-in focus:outline-none" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 glass border-b border-wa-border">
          <h3 id="call-picker-title" className="font-bold text-wa-primary text-base flex items-center gap-2">
            <Phone className="w-5 h-5 text-wa-green" />
            <span>Start a Call</span>
          </h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="p-1.5 hover:bg-wa-sidebar-hover rounded-full transition-all duration-150 active:scale-90"
          >
            <X className="w-5 h-5 text-wa-secondary" />
          </button>
        </div>

        {/* Search */}
        <div className="p-4 shrink-0">
          {error && (
            <div className="mb-3 p-2.5 text-xs bg-red-950/30 border border-red-500/50 rounded-lg text-red-200 animate-slide-down">
              {error}
            </div>
          )}
          <div className="relative flex items-center bg-wa-surface rounded-xl px-3 py-2 ring-1 ring-transparent focus-within:ring-wa-green/40 transition-shadow duration-200">
            <Search className="w-4 h-4 text-wa-secondary mr-2.5 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contacts by name"
              className="bg-transparent border-none text-xs text-wa-primary placeholder-wa-secondary focus:outline-none w-full"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex-grow overflow-y-auto px-4 pb-4">
          <div className="space-y-1">
            {loading ? (
              <div className="space-y-3 pt-2">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 py-2 px-1">
                    <div className="w-9 h-9 rounded-full bg-wa-sidebar-hover animate-pulse shrink-0" />
                    <div className="flex-1 space-y-1.5 min-w-0">
                      <div className="w-24 h-3 bg-wa-sidebar-hover animate-pulse rounded" />
                      <div className="w-36 h-2.5 bg-wa-sidebar-hover animate-pulse rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : users.length === 0 ? (
              <div className="text-center text-xs text-wa-secondary py-6">
                No contacts found
              </div>
            ) : (
              users.slice(0, 15).map((user) => (
                <div
                  key={user.id}
                  className="flex items-center space-x-3 py-2.5 hover:bg-wa-sidebar-hover rounded-xl px-2 transition-colors duration-150 select-none"
                >
                  <div className="relative shrink-0">
                    <Avatar
                      src={user.avatar}
                      name={user.displayName}
                      size="md"
                      className="w-9 h-9 ring-1 ring-white/5"
                    />
                    <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full ring-2 ring-wa-sidebar ${
                      user.isOnline ? 'presence-dot-online' : 'presence-dot-offline'
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-semibold block text-wa-primary truncate">
                      {user.displayName}
                    </span>
                    <span className="text-xs text-wa-secondary block truncate">
                      {user.username ? `@${user.username}` : ''}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleCall(user, false)}
                      className="p-2 text-wa-secondary hover:text-wa-accent hover:bg-wa-sidebar-hover rounded-full transition-all active:scale-90"
                      title="Voice call"
                    >
                      <Phone className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCall(user, true)}
                      className="p-2 text-wa-secondary hover:text-blue-400 hover:bg-wa-sidebar-hover rounded-full transition-all active:scale-90"
                      title="Video call"
                    >
                      <Video className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
