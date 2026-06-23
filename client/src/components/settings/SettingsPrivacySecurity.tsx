import React, { useState, useEffect } from 'react';
import { Lock, Keyboard, Eye, Check, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { useLockStore } from '../../store/lock.store';

const LS_INCOGNITO = 'nexchat_incognito';
const LS_SCREENSHOT_BLOCK = 'nexchat_screenshot_block';

export const SettingsPrivacySecurity: React.FC = () => {
  const hasPin = useLockStore((s) => s.hasPin);
  const setPinStore = useLockStore((s) => s.setPin);
  const removePinStore = useLockStore((s) => s.removePin);

  const [pinOpen, setPinOpen] = useState(false);
  const [pinValue, setPinValue] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [removingPin, setRemovingPin] = useState(false);

  const [incognito, setIncognito] = useState(() => localStorage.getItem(LS_INCOGNITO) === 'true');
  const [ssBlock, setSsBlock] = useState(() => localStorage.getItem(LS_SCREENSHOT_BLOCK) === 'true');

  useEffect(() => { localStorage.setItem(LS_INCOGNITO, String(incognito)); }, [incognito]);
  useEffect(() => { localStorage.setItem(LS_SCREENSHOT_BLOCK, String(ssBlock)); }, [ssBlock]);

  const savePin = async () => {
    if (pinValue.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
    if (pinValue !== pinConfirm) { setPinError('PINs do not match'); return; }
    setPinSaving(true);
    setPinError('');
    await setPinStore(pinValue);
    setPinOpen(false);
    setPinValue('');
    setPinConfirm('');
    setPinSaving(false);
  };

  const removePin = async () => {
    if (pinValue.length < 4) { setPinError('Enter your current PIN to remove'); return; }
    setPinSaving(true);
    setPinError('');
    const ok = await removePinStore(pinValue);
    setPinSaving(false);
    if (ok) {
      setRemovingPin(false);
      setPinValue('');
      setPinConfirm('');
    } else {
      setPinError('Incorrect PIN');
    }
  };

  interface ToggleBtnProps {
    icon: React.ReactNode;
    label: string;
    desc: string;
    enabled: boolean;
    onToggle: () => void;
  }
  const ToggleBtn: React.FC<ToggleBtnProps> = ({ icon, label, desc, enabled, onToggle }) => (
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

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">App Lock</h3>
        <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          {hasPin && !pinOpen && !removingPin ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-wa-accent" />
                <div>
                  <p className="text-[13px] font-semibold text-zinc-200">PIN Lock Enabled</p>
                  <p className="text-[11px] text-zinc-600">App requires PIN to open</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => { setPinOpen(true); setPinError(''); }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-zinc-300 hover:bg-white/[0.06] transition-colors">Change</button>
                <button type="button" onClick={() => { setRemovingPin(true); setPinValue(''); setPinError(''); }}
                  className="px-3 py-1.5 rounded-xl text-[11px] font-semibold text-red-400 hover:bg-red-500/[0.08] transition-colors">Remove</button>
              </div>
            </div>
          ) : pinOpen ? (
            <div className="space-y-3">
              {pinError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{pinError}</p>}
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Enter new PIN" value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[13px] text-zinc-100 outline-none focus:border-emerald-500/60 transition-colors text-center tracking-[6px]" />
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm new PIN" value={pinConfirm}
                onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[13px] text-zinc-100 outline-none focus:border-emerald-500/60 transition-colors text-center tracking-[6px]" />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setPinOpen(false); setPinError(''); setPinValue(''); setPinConfirm(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-[12px] font-semibold transition-colors">Cancel</button>
                <button type="button" onClick={savePin} disabled={pinSaving || !pinValue || !pinConfirm}
                  className="flex-1 py-2.5 rounded-xl bg-wa-accent hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-1">
                  {pinSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save
                </button>
              </div>
            </div>
          ) : removingPin ? (
            <div className="space-y-3">
              {pinError && <p className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{pinError}</p>}
              <input type="password" inputMode="numeric" maxLength={6} placeholder="Enter current PIN to remove" value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] text-[13px] text-zinc-100 outline-none focus:border-emerald-500/60 transition-colors text-center tracking-[6px]" />
              <div className="flex gap-2">
                <button type="button" onClick={() => { setRemovingPin(false); setPinError(''); setPinValue(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-[12px] font-semibold transition-colors">Cancel</button>
                <button type="button" onClick={removePin} disabled={pinSaving || !pinValue}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-1">
                  {pinSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Remove
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setPinOpen(true)} className="w-full text-left flex items-center gap-3">
              <Lock className="w-4 h-4 text-zinc-600" />
              <div>
                <p className="text-[13px] font-semibold text-zinc-400">Set App Lock PIN</p>
                <p className="text-[11px] text-zinc-600">Lock app behind a PIN code</p>
              </div>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <ToggleBtn icon={<Keyboard className="w-4 h-4" />} label="Incognito Keyboard"
          desc="Hide keyboard suggestions and typing data" enabled={incognito} onToggle={() => setIncognito(!incognito)} />
        <ToggleBtn icon={<Eye className="w-4 h-4" />} label="Block Screenshots"
          desc="Prevent screenshots in chat (applies on supported devices)" enabled={ssBlock} onToggle={() => setSsBlock(!ssBlock)} />
      </div>
    </div>
  );
};
