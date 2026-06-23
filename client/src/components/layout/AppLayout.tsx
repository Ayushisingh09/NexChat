import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversationStore } from '../../store/conversation.store';
import { useAuthStore } from '../../store/auth.store';
import { useUiStore, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from '../../store/ui.store';
import { authApi } from '../../api/auth.api';
import { Avatar } from './Avatar';
import { MobileNav } from './MobileNav';
import { useMissedCallCount } from '../../hooks/useMissedCallCount';
import {
  MessageCircle, Circle, Compass, UserRoundPlus,
  Settings, LogOut, Phone, Sparkles,
} from 'lucide-react';

interface AppLayoutProps {
  sidebar: React.ReactNode;
  chat: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ sidebar, chat }) => {
  const navigate = useNavigate();
  const activeConversation = useConversationStore((state) => state.activeConversation);
  const sidebarWidth = useUiStore((state) => state.sidebarWidth);
  const setSidebarWidth = useUiStore((state) => state.setSidebarWidth);
  const currentUser = useAuthStore((state) => state.user);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const missedCount = useMissedCallCount();

  const [showSidebar, setShowSidebar] = useState(true);
  const [animating, setAnimating] = useState(false);

  // ── Resizable sidebar (desktop) ──────────────────────────────────────
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  const startResize = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsResizing(true);
    let latest = sidebarWidth;
    const onMove = (ev: PointerEvent) => {
      const rect = sidebarRef.current?.getBoundingClientRect();
      if (!rect || !sidebarRef.current) return;
      const raw = ev.clientX - rect.left;
      latest = Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, raw));
      // Update the CSS var live for a smooth drag without re-rendering.
      sidebarRef.current.style.setProperty('--sidebar-w', `${latest}px`);
    };
    const onUp = () => {
      setIsResizing(false);
      setSidebarWidth(latest);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const resetWidth = () => setSidebarWidth(320);

  useEffect(() => {
    setAnimating(true);
    if (activeConversation) {
      setShowSidebar(false);
    } else {
      setShowSidebar(true);
    }
    const timer = setTimeout(() => setAnimating(false), 300);
    return () => clearTimeout(timer);
  }, [activeConversation]);

  const handleLogout = async () => {
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch { /* ignore */ }
    clearAuth();
  };

  const dockButtons = [
    {
      icon: Phone,
      label: 'Calls',
      onClick: () => navigate('/calls'),
    },
    {
      icon: Circle,
      label: 'Status',
      onClick: () => navigate('/status'),
    },
    {
      icon: Sparkles,
      label: 'Cipher',
      onClick: () => navigate('/cipher'),
    },
    {
      icon: MessageCircle,
      label: 'Chats',
      active: true,
      onClick: () => navigate('/chat'),
    },
    {
      icon: Compass,
      label: 'Groups',
      onClick: () => navigate('/groups'),
    },
    {
      icon: UserRoundPlus,
      label: 'Friends',
      onClick: () => navigate('/friends'),
    },
  ];

  return (
    <div className="flex h-screen w-screen bg-wa-chat text-wa-primary overflow-hidden">
      {/* Left Dock */}
      <div className="hidden md:flex w-[72px] h-screen bg-[#0d0d11] border-r border-wa-border flex-col justify-between py-4 items-center shrink-0 select-none z-30">
        {/* Top: Profile */}
        <button type="button"
          onClick={() => navigate('/settings')}
          className="relative group focus:outline-none"
        >
          <div className="relative">
            <Avatar
              src={currentUser?.avatar}
              name={currentUser?.displayName}
              size="md"
              className="ring-2 ring-[#10b981] ring-offset-2 ring-offset-[#0d0d11] animate-pulse"
            />
          </div>
        </button>

        {/* Middle: Nav Icons */}
        <div className="flex flex-col items-center gap-1.5">
          {dockButtons.map((btn) => (
            <div key={btn.label} className="relative flex items-center justify-center">
              {btn.active && (
                <span className="absolute -left-[18px] w-1 h-8 bg-wa-accent rounded-r" />
              )}
              <button type="button"
                onClick={btn.onClick}
                title={btn.label}
                className="p-2.5 text-zinc-400 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 rounded-lg hover:bg-white/5 relative"
              >
                <btn.icon className="w-5 h-5" />
                {btn.label === 'Calls' && missedCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold">
                    {missedCount > 99 ? '99+' : missedCount}
                  </span>
                )}
              </button>
            </div>
          ))}
        </div>

        {/* Bottom: Settings & Logout */}
        <div className="flex flex-col items-center gap-1.5">
          <button type="button"
            onClick={() => navigate('/settings')}
            title="Settings"
            className="p-2.5 text-zinc-400 hover:text-white hover:scale-110 active:scale-95 transition-all duration-200 rounded-lg hover:bg-white/5"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button type="button"
            onClick={handleLogout}
            title="Log Out"
            className="p-2.5 text-zinc-400 hover:text-red-400 hover:scale-110 active:scale-95 transition-all duration-200 rounded-lg hover:bg-white/5"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <div
        ref={sidebarRef}
        className={`relative w-full md:w-[var(--sidebar-w)] md:min-w-[var(--sidebar-min)] md:max-w-[var(--sidebar-max)] h-full shrink-0 border-r border-wa-border ease-[cubic-bezier(0.16,1,0.3,1)] ${
          isResizing ? '' : 'transition-transform duration-300'
        } ${
          animating ? 'relative' : ''
        } ${
          showSidebar
            ? 'translate-x-0 md:translate-x-0'
            : '-translate-x-full md:translate-x-0'
        } ${!animating && showSidebar ? 'block' : ''} ${
          !animating && !showSidebar ? 'hidden md:block' : ''
        }`}
        style={{
          zIndex: showSidebar ? 10 : 1,
          ['--sidebar-w' as string]: `${sidebarWidth}px`,
          ['--sidebar-min' as string]: `${SIDEBAR_MIN_WIDTH}px`,
          ['--sidebar-max' as string]: `${SIDEBAR_MAX_WIDTH}px`,
        } as React.CSSProperties}
      >
        {sidebar}

        {/* Resize handle (desktop only) */}
        <div
          onPointerDown={startResize}
          onDoubleClick={resetWidth}
          title="Drag to resize · double-click to reset"
          className="hidden md:block absolute top-0 right-0 z-40 h-full w-2 translate-x-1/2 cursor-col-resize group/resize"
        >
          <span
            className={`absolute inset-y-0 right-[3px] w-[2px] rounded-full transition-colors duration-150 ${
              isResizing ? 'bg-wa-green' : 'bg-transparent group-hover/resize:bg-wa-green/50'
            }`}
          />
        </div>
      </div>

      {/* Chat Window */}
      <div
        className={`flex-grow h-full min-w-0 max-w-full transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          !showSidebar
            ? 'translate-x-0'
            : 'translate-x-full md:translate-x-0'
        } ${!animating && !showSidebar ? 'block' : ''} ${
          !animating && showSidebar ? 'hidden md:block' : ''
        }`}
        style={{ zIndex: showSidebar ? 1 : 10 }}
      >
        {chat}
      </div>

      {/* Mobile bottom navigation — only on the chat-list view so it never
          covers an open conversation's input. */}
      {!activeConversation && <MobileNav />}
    </div>
  );
};
