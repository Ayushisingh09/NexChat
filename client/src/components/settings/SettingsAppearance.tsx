import React, { useState, useEffect } from 'react';
import { Check, Type } from 'lucide-react';

const FONT_SIZES = [
  { key: 'small', label: 'Small', size: '13px' },
  { key: 'medium', label: 'Medium', size: '14.5px' },
  { key: 'large', label: 'Large', size: '16.5px' },
] as const;

const BUBBLE_STYLES = [
  { key: 'solid', label: 'Solid', desc: 'Clean solid background' },
  { key: 'outline', label: 'Outline', desc: 'Minimal bordered style' },
] as const;

const LS_FONT = 'nexchat_font_size';
const LS_BUBBLE = 'nexchat_bubble_style';

export const SettingsAppearance: React.FC = () => {
  const [fontSize, setFontSize] = useState(() => localStorage.getItem(LS_FONT) || 'medium');
  const [bubbleStyle, setBubbleStyle] = useState(() => localStorage.getItem(LS_BUBBLE) || 'solid');

  useEffect(() => {
    localStorage.setItem(LS_FONT, fontSize);
    const root = document.documentElement;
    const val = FONT_SIZES.find((f) => f.key === fontSize)?.size || '14.5px';
    root.style.setProperty('--chat-font-size', val);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(LS_BUBBLE, bubbleStyle);
    document.documentElement.dataset.bubbleStyle = bubbleStyle;
  }, [bubbleStyle]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3 flex items-center gap-1.5">
          <Type className="w-3.5 h-3.5" /> Font Size
        </h3>
        <div className="space-y-2">
          {FONT_SIZES.map((f) => (
            <button type="button" key={f.key} onClick={() => setFontSize(f.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                fontSize === f.key ? 'border-emerald-500/40 bg-wa-accent/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
              }`}>
              <div className="flex-1">
                <p className={`text-[13px] font-semibold ${fontSize === f.key ? 'text-zinc-100' : 'text-zinc-400'}`}
                  style={{ fontSize: f.size }}>{f.label}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{f.size} — preview text</p>
              </div>
              {fontSize === f.key && <Check className="w-4 h-4 text-wa-accent shrink-0" />}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-500 mb-3">Bubble Style</h3>
        <div className="space-y-2">
          {BUBBLE_STYLES.map((b) => (
            <button type="button" key={b.key} onClick={() => setBubbleStyle(b.key)}
              className={`w-full flex items-center gap-3 p-3 rounded-2xl border text-left transition-all ${
                bubbleStyle === b.key ? 'border-emerald-500/40 bg-wa-accent/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.06]'
              }`}>
              <div className="flex-1">
                <p className={`text-[13px] font-semibold ${bubbleStyle === b.key ? 'text-zinc-100' : 'text-zinc-400'}`}>{b.label}</p>
                <p className="text-[11px] text-zinc-600 mt-0.5">{b.desc}</p>
              </div>
              {bubbleStyle === b.key && <Check className="w-4 h-4 text-wa-accent shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
