import React, { useState, useEffect, useCallback } from 'react';
import { Wifi, Smartphone, X, Loader2, HardDrive, Trash2 } from 'lucide-react';

const LS_AUTO_DL = 'nexchat_auto_download';

const AUTO_DL_OPTS = [
  { key: 'never', label: 'Never', icon: X, desc: 'Only download on tap' },
  { key: 'wifi', label: 'Wi-Fi Only', icon: Wifi, desc: 'Auto-download on Wi-Fi' },
  { key: 'always', label: 'Always', icon: Smartphone, desc: 'Download on any network' },
] as const;

async function estimateCacheSize(): Promise<string> {
  try {
    const storage = await navigator.storage?.estimate();
    if (storage?.usage) {
      const mb = storage.usage / (1024 * 1024);
      return `${mb.toFixed(1)} MB`;
    }
  } catch {}
  return 'Unknown';
}

async function clearAllCaches(): Promise<void> {
  const keys = await caches.keys();
  await Promise.all(keys.map((k) => caches.delete(k)));
}

export const SettingsStorage: React.FC = () => {
  const [autoDl, setAutoDl] = useState(() => localStorage.getItem(LS_AUTO_DL) || 'wifi');
  const [cacheSize, setCacheSize] = useState('...');
  const [clearing, setClearing] = useState(false);
  const [cleared, setCleared] = useState(false);

  useEffect(() => {
    localStorage.setItem(LS_AUTO_DL, autoDl);
  }, [autoDl]);

  const refreshSize = useCallback(async () => {
    setCacheSize(await estimateCacheSize());
  }, []);

  useEffect(() => { refreshSize(); }, [refreshSize]);

  const handleClear = async () => {
    setClearing(true);
    try {
      await clearAllCaches();
      setCleared(true);
      setCacheSize('0 MB');
      setTimeout(() => setCleared(false), 2000);
    } catch {}
    setClearing(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Auto-Download Media</h3>
        <div className="space-y-2">
          {AUTO_DL_OPTS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button type="button" key={opt.key} onClick={() => setAutoDl(opt.key)}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                  autoDl === opt.key ? 'border-emerald-500/40 bg-wa-accent/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
                }`}>
                <span className={autoDl === opt.key ? 'text-wa-accent' : 'text-zinc-600'}>
                  <Icon className="w-4 h-4" />
                </span>
                <div className="flex-1">
                  <p className={`text-[13px] font-semibold ${autoDl === opt.key ? 'text-zinc-100' : 'text-zinc-400'}`}>{opt.label}</p>
                  <p className="text-[11px] text-zinc-600 mt-0.5">{opt.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5" /> Storage
        </h3>
        <div className="flex items-center justify-between p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
          <div>
            <p className="text-[13px] font-semibold text-zinc-300">Cached Data</p>
            <p className="text-[11px] text-zinc-600 mt-0.5">{cacheSize}</p>
          </div>
          <button type="button" onClick={handleClear} disabled={clearing || cleared}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-semibold transition-colors ${
              cleared ? 'bg-wa-accent/20 text-wa-accent' : 'bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300'
            }`}>
            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : cleared ? 'Cleared!' : <><Trash2 className="w-3.5 h-3.5" /> Clear</>}
          </button>
        </div>
      </div>
    </div>
  );
};
