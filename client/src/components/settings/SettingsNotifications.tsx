import React, { useState, useEffect } from 'react';
import { Bell, Volume2, MessageSquare, Vibrate } from 'lucide-react';

const LS_SOUND = 'nexchat_notif_sound';
const LS_VIBRATE = 'nexchat_notif_vibrate';
const LS_PREVIEW = 'nexchat_notif_preview';
const LS_GROUP_NOTIF = 'nexchat_notif_group';

interface ToggleRowProps {
  icon: React.ReactNode;
  label: string;
  desc: string;
  enabled: boolean;
  onToggle: () => void;
}

const ToggleRow: React.FC<ToggleRowProps> = ({ icon, label, desc, enabled, onToggle }) => (
  <button type="button" onClick={onToggle}
    className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
      enabled ? 'border-emerald-500/40 bg-wa-accent/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
    }`}>
    <span className={enabled ? 'text-wa-accent' : 'text-zinc-600'}>{icon}</span>
    <div className="flex-1">
      <p className={`text-[13px] font-semibold ${enabled ? 'text-zinc-100' : 'text-zinc-400'}`}>{label}</p>
      <p className="text-[11px] text-zinc-600 mt-0.5">{desc}</p>
    </div>
    <div className={`w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-wa-accent' : 'bg-white/[0.1]'} relative shrink-0`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </div>
  </button>
);

export const SettingsNotifications: React.FC = () => {
  const [sound, setSound] = useState(() => localStorage.getItem(LS_SOUND) !== 'false');
  const [vibrate, setVibrate] = useState(() => localStorage.getItem(LS_VIBRATE) !== 'false');
  const [preview, setPreview] = useState(() => localStorage.getItem(LS_PREVIEW) !== 'false');
  const [groupNotif, setGroupNotif] = useState(() => localStorage.getItem(LS_GROUP_NOTIF) !== 'false');

  useEffect(() => { localStorage.setItem(LS_SOUND, String(sound)); }, [sound]);
  useEffect(() => { localStorage.setItem(LS_VIBRATE, String(vibrate)); }, [vibrate]);
  useEffect(() => { localStorage.setItem(LS_PREVIEW, String(preview)); }, [preview]);
  useEffect(() => { localStorage.setItem(LS_GROUP_NOTIF, String(groupNotif)); }, [groupNotif]);

  return (
    <div className="space-y-2">
      <ToggleRow icon={<Bell className="w-4 h-4" />} label="Notification Sound" desc="Play sound for incoming messages"
        enabled={sound} onToggle={() => setSound(!sound)} />
      <ToggleRow icon={<Vibrate className="w-4 h-4" />} label="Vibrate" desc="Phone vibrates on new messages"
        enabled={vibrate} onToggle={() => setVibrate(!vibrate)} />
      <ToggleRow icon={<MessageSquare className="w-4 h-4" />} label="Message Preview" desc="Show message text in notifications"
        enabled={preview} onToggle={() => setPreview(!preview)} />
      <ToggleRow icon={<Volume2 className="w-4 h-4" />} label="Group Notifications" desc="Notifications for group messages"
        enabled={groupNotif} onToggle={() => setGroupNotif(!groupNotif)} />
    </div>
  );
};
