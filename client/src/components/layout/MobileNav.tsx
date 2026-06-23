import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageCircle, Circle, Compass, UserRoundPlus, Phone, Sparkles } from 'lucide-react';
import { useMissedCallCount } from '../../hooks/useMissedCallCount';
import { usePendingFriendRequestCount } from '../../hooks/usePendingFriendRequestCount';

/**
 * Bottom tab bar for mobile (hidden on md+ where the left dock takes over).
 * Renders the primary app destinations as a "home" navbar.
 */
export const MobileNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const path = location.pathname;
  const missedCount = useMissedCallCount();
  const pendingFriendCount = usePendingFriendRequestCount();
  const items = [
    { key: 'calls',    icon: Phone,         label: 'Calls',   active: path.startsWith('/calls'),    onClick: () => navigate('/calls') },
    { key: 'status',   icon: Circle,        label: 'Status',  active: path.startsWith('/status'),   onClick: () => navigate('/status') },
    { key: 'cipher',   icon: Sparkles,      label: 'Cipher',  active: path.startsWith('/cipher'),   onClick: () => navigate('/cipher') },
    { key: 'chats',    icon: MessageCircle, label: 'Chats',   active: path.startsWith('/chat'),     onClick: () => navigate('/chat') },
    { key: 'groups',    icon: Compass,       label: 'Groups',  active: path.startsWith('/groups'),  onClick: () => navigate('/groups') },
    { key: 'friends',  icon: UserRoundPlus, label: 'Friends', active: path.startsWith('/friends'),  onClick: () => navigate('/friends') },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 h-16 glass border-t border-white/[0.07] flex items-stretch px-1 pb-[env(safe-area-inset-bottom)]">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <button type="button"
            key={it.key}
            onClick={it.onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 rounded-2xl mx-0.5 my-1.5 transition-colors ${
              it.active ? 'text-wa-accent' : 'text-zinc-400 active:bg-white/[0.06]'
            }`}
          >
            <span className={`relative flex items-center justify-center transition-all duration-300 ${it.active ? '-translate-y-0.5' : ''}`}>
              <Icon className={`w-[22px] h-[22px] transition-all duration-300 ${it.active ? 'drop-shadow-[0_0_8px_rgba(16,185,129,0.6)]' : ''}`} strokeWidth={it.active ? 2.4 : 2} />
              {it.active && <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />}
              {it.key === 'calls' && missedCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                  {missedCount > 99 ? '99+' : missedCount}
                </span>
              )}
              {it.key === 'friends' && pendingFriendCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-wa-accent text-white text-[9px] font-bold">
                  {pendingFriendCount > 99 ? '99+' : pendingFriendCount}
                </span>
              )}
            </span>
            <span className="text-[10px] font-medium leading-none">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
