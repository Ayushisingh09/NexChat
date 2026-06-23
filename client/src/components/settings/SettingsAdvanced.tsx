import React, { useState } from 'react';
import { RefreshCw, Bug, Server, Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../../store/auth.store';

const LS_CRASH_REPORTS = 'nexchat_crash_reports';

export const SettingsAdvanced: React.FC = () => {
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [crashReports, setCrashReports] = useState(() => localStorage.getItem(LS_CRASH_REPORTS) !== 'false');
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleReset = () => {
    setResetting(true);
    setTimeout(() => {
      localStorage.clear();
      clearAuth();
      window.location.reload();
    }, 1000);
  };

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
        <Server className="w-4 h-4 text-zinc-500 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-zinc-300">Server</p>
          <p className="text-[11px] text-zinc-600">{import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'}</p>
        </div>
      </div>

      <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
        <Bug className="w-4 h-4 text-zinc-500 shrink-0" />
        <div className="flex-1">
          <p className="text-[13px] font-semibold text-zinc-300">Debug</p>
          <p className="text-[11px] text-zinc-600">React {React.version} · User-Agent: {navigator.userAgent.slice(0, 60)}...</p>
        </div>
      </div>

      <button type="button" onClick={() => { const next = !crashReports; setCrashReports(next); localStorage.setItem(LS_CRASH_REPORTS, String(next)); }}
        className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
          crashReports ? 'border-emerald-500/40 bg-wa-accent/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
        }`}>
        <span className={crashReports ? 'text-wa-accent' : 'text-zinc-600'}><AlertTriangle className="w-4 h-4" /></span>
        <div className="flex-1">
          <p className={`text-[13px] font-semibold ${crashReports ? 'text-zinc-100' : 'text-zinc-400'}`}>Send Crash Reports</p>
          <p className="text-[11px] text-zinc-600 mt-0.5">Help improve by sending anonymous error data</p>
        </div>
        <div className={`w-9 h-5 rounded-full transition-colors ${crashReports ? 'bg-wa-accent' : 'bg-white/[0.1]'} relative shrink-0`}>
          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${crashReports ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
        </div>
      </button>

      <div className="pt-4 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-red-400/80 mb-3">Danger Zone</h3>
        {resetOpen ? (
          <div className="bg-red-950/30 border border-red-500/20 rounded-2xl p-4 space-y-3">
            <p className="text-[13px] text-zinc-200 font-medium text-center">Reset all app data?</p>
            <p className="text-[11px] text-zinc-500 text-center">This will clear all local data and sign you out.</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setResetOpen(false)} className="flex-1 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-[12px] font-semibold transition-colors">Cancel</button>
              <button type="button" onClick={handleReset} disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5">
                {resetting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Reset
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setResetOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-red-500/[0.08] hover:bg-red-500/[0.15] border border-red-500/20 text-red-400 text-[13px] font-semibold transition-all">
            <RefreshCw className="w-4 h-4" /> Reset App Data
          </button>
        )}
      </div>
    </div>
  );
};
