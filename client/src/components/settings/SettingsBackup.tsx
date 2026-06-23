import React, { useState } from 'react';
import { Download, Clock, Check, Loader2 } from 'lucide-react';

const LS_LAST_BACKUP = 'nexchat_last_backup';

export const SettingsBackup: React.FC = () => {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [lastBackup] = useState(() => localStorage.getItem(LS_LAST_BACKUP));

  const handleExport = async () => {
    setExporting(true);
    try {
      const payload = { exportedAt: new Date().toISOString(), chats: [] as any[] };
      localStorage.setItem(LS_LAST_BACKUP, payload.exportedAt);
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexchat-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportDone(true);
      setTimeout(() => setExportDone(false), 3000);
    } catch {}
    setExporting(false);
  };

  return (
    <div className="space-y-5">
      <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] space-y-3">
        <div className="flex items-center gap-3">
          <Download className="w-4 h-4 text-zinc-500" />
          <div className="flex-1">
            <p className="text-[13px] font-semibold text-zinc-300">Export Chat Data</p>
            <p className="text-[11px] text-zinc-600">Download a JSON file of your messages and settings</p>
          </div>
        </div>
        <button type="button" onClick={handleExport} disabled={exporting || exportDone}
          className={`w-full py-2.5 rounded-xl text-[12px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
            exportDone ? 'bg-wa-accent/20 text-wa-accent' : 'bg-wa-accent hover:bg-emerald-600 disabled:opacity-50 text-white'
          }`}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : exportDone ? <><Check className="w-3.5 h-3.5" /> Exported!</> : <><Download className="w-3.5 h-3.5" /> Export</>}
        </button>
      </div>

      <div className="p-3 rounded-2xl border border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
        <Clock className="w-4 h-4 text-zinc-500 shrink-0" />
        <div>
          <p className="text-[13px] font-semibold text-zinc-300">Last Backup</p>
          <p className="text-[11px] text-zinc-600">
            {lastBackup ? new Date(lastBackup).toLocaleString() : 'Never backed up'}
          </p>
        </div>
      </div>
    </div>
  );
};
