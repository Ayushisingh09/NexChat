import React, { useState, useEffect, useRef } from 'react';
import { Upload, RotateCcw, Loader2 } from 'lucide-react';
import { useMediaUpload } from '../../hooks/useMediaUpload';

const LS_BLUR = 'nexchat_bg_blur';
const LS_BG = 'nexchat_bg_url';

export const SettingsWallpaper: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, uploading } = useMediaUpload();
  const [blur, setBlur] = useState(() => Number(localStorage.getItem(LS_BLUR)) || 8);
  const [bgUrl, setBgUrl] = useState(() => localStorage.getItem(LS_BG) || '');

  useEffect(() => {
    localStorage.setItem(LS_BLUR, String(blur));
    document.documentElement.style.setProperty('--chat-blur', `${blur}px`);
  }, [blur]);

  useEffect(() => {
    if (bgUrl) localStorage.setItem(LS_BG, bgUrl);
  }, [bgUrl]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { publicUrl } = await uploadFile(file);
      setBgUrl(publicUrl);
    } catch {}
    if (fileRef.current) fileRef.current.value = '';
  };

  const resetWallpaper = () => {
    setBgUrl('');
    localStorage.removeItem(LS_BG);
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Wallpaper</h3>
        <div className="relative h-32 rounded-2xl overflow-hidden border border-white/[0.06] mb-3"
          style={{ background: bgUrl ? `url(${bgUrl}) center/cover` : 'rgba(255,255,255,0.03)' }}>
          {bgUrl && <div className="absolute inset-0" style={{ backdropFilter: 'blur(8px)' }} />}
          {!bgUrl && (
            <div className="absolute inset-0 flex items-center justify-center text-zinc-600 text-[12px]">No custom wallpaper</div>
          )}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-wa-accent hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold transition-colors">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Upload
          </button>
          {bgUrl && (
            <button type="button" onClick={resetWallpaper}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-zinc-300 text-[12px] font-semibold transition-colors">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Blur Intensity</h3>
        <div className="flex items-center gap-3 px-1">
          <span className="text-[11px] text-zinc-600 w-8">0px</span>
          <input type="range" min="0" max="28" value={blur} onChange={(e) => setBlur(Number(e.target.value))}
            className="flex-1 accent-emerald-500 h-1.5 rounded-full appearance-none bg-white/[0.08] cursor-pointer" />
          <span className="text-[11px] text-zinc-600 w-8 text-right">28px</span>
        </div>
        <p className="text-[11px] text-zinc-600 mt-2 text-center">{blur}px blur</p>
      </div>
    </div>
  );
};
