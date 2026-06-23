import React from 'react';

const SHORTCUTS = [
  { keys: 'Ctrl + K', desc: 'Search messages & chats' },
  { keys: 'Ctrl + N', desc: 'New chat' },
  { keys: 'Ctrl + Shift + M', desc: 'Mute / unmute conversation' },
  { keys: 'Escape', desc: 'Close modal / cancel' },
  { keys: 'Enter', desc: 'Send message' },
  { keys: 'Shift + Enter', desc: 'New line in message' },
  { keys: 'Arrow Up', desc: 'Edit last message' },
  { keys: 'Ctrl + P', desc: 'Open profile' },
  { keys: 'Ctrl + ,', desc: 'Open settings' },
  { keys: 'Ctrl + /', desc: 'Show keyboard shortcuts' },
];

export const SettingsShortcuts: React.FC = () => (
  <div className="space-y-1">
    {SHORTCUTS.map((s) => (
      <div key={s.keys} className="flex items-center justify-between py-2.5 px-1 border-b border-white/[0.05] last:border-0">
        <span className="text-[13px] text-zinc-300">{s.desc}</span>
        <kbd className="px-2.5 py-1 rounded-lg bg-white/[0.06] border border-white/[0.08] text-[11px] font-mono text-zinc-400 tracking-tight">
          {s.keys}
        </kbd>
      </div>
    ))}
  </div>
);
