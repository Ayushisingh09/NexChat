import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  ImageIcon,
  Type,
  Loader2,
  Send,
  Smile,
  ArrowLeft,
  AlertCircle,
  CaseSensitive,
  Sparkles,
} from 'lucide-react';
import { storiesApi } from '../../api/stories.api';
import { useMediaUpload } from '../../hooks/useMediaUpload';
import { useAIImage } from '../../hooks/useAIImage';
import { ImageGeneration } from '../ui/ai-chat-image-generation-1';

interface CreateStoryModalProps {
  onClose: () => void;
}

/**
 * Background presets for text stories. The gradient strings here MUST stay in
 * sync with GRADIENT_BG_COLORS in src/modules/stories/controller.ts — the
 * server validates bgColor against that exact allowlist (solids pass via the
 * hex regex), so adding one here without mirroring it there yields a 400.
 */
const BACKGROUNDS = [
  'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
  'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
  'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
  'linear-gradient(135deg, #f12711 0%, #f5af19 100%)',
  'linear-gradient(135deg, #FF512F 0%, #DD2476 100%)',
  'linear-gradient(135deg, #8A2387 0%, #E94057 50%, #F27121 100%)',
  'linear-gradient(135deg, #00c6ff 0%, #0072ff 100%)',
  'linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)',
  'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
  '#0b0b0e',
  '#1f2c33',
  '#075e54',
];

const FONTS = [
  { key: 'font-story-sans', name: 'Aa', label: 'Sans' },
  { key: 'font-story-serif', name: 'Aa', label: 'Serif' },
  { key: 'font-story-mono', name: 'Aa', label: 'Mono' },
  { key: 'font-story-cursive', name: 'Aa', label: 'Script' },
];

const EMOJI_LIST = ['😊', '🔥', '💪', '🎉', '❤️', '✨', '😂', '😍', '👍', '🙏', '🥳', '😎', '🌟', '💜', '🤩', '😮'];

const MAX_CAPTION = 700;

type Mode = 'pick' | 'text' | 'media' | 'ai';

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ onClose }) => {
  const queryClient = useQueryClient();
  const { uploadFile, uploading, progress } = useMediaUpload();
  const { generate: generateAiImage } = useAIImage();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [mode, setMode] = useState<Mode>('pick');
  const [caption, setCaption] = useState('');
  const [bgColor, setBgColor] = useState(BACKGROUNDS[0]);
  const [fontIndex, setFontIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'IMAGE' | 'VIDEO'>('IMAGE');
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);

  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiGenUrl, setAiGenUrl] = useState<string | null>(null);
  const [aiGenError, setAiGenError] = useState<string | null>(null);

  // Lock body scroll while the full-screen composer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Esc closes; focus the text canvas when entering text mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (mode === 'text') setTimeout(() => textareaRef.current?.focus(), 60);
  }, [mode]);

  // Auto-grow the text-story textarea.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 360)}px`;
  }, [caption, fontIndex, mode]);

  const handleFile = async (file: File) => {
    setError(null);
    try {
      const { publicUrl, type } = await uploadFile(file);
      if (type !== 'IMAGE' && type !== 'VIDEO') {
        setError('Please choose an image or video.');
        return;
      }
      setMediaUrl(publicUrl);
      setMediaType(type);
      setMode('media');
    } catch (err: any) {
      setError(err?.message || 'Upload failed. Please try again.');
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handleFile(file);
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await handleFile(file);
  };

  const resetToPick = () => {
    setMode('pick');
    setMediaUrl(null);
    setCaption('');
    setError(null);
    setShowEmoji(false);
  };

  const handlePost = async () => {
    if (posting) return;
    setPosting(true);
    setError(null);
    try {
      if (mode === 'text') {
        if (!caption.trim()) {
          setError('Write something first.');
          setPosting(false);
          return;
        }
        await storiesApi.create({
          type: 'TEXT',
          caption: caption.trim(),
          bgColor,
          fontStyle: FONTS[fontIndex].key,
        });
      } else if (mode === 'media' && mediaUrl) {
        await storiesApi.create({
          type: mediaType,
          mediaUrl,
          caption: caption.trim() || undefined,
        });
      } else {
        setPosting(false);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ['stories'] });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to share. Please try again.');
      setPosting(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 3) {
      setAiGenError('Prompt must be at least 3 characters');
      return;
    }
    setAiLoading(true);
    setAiGenError(null);
    setAiGenUrl(null);
    try {
      const imageUrl = await generateAiImage({ prompt: aiPrompt.trim(), type: 'story' });
      setAiGenUrl(imageUrl);
    } catch (err: any) {
      setAiGenError(err?.response?.data?.message || err?.message || 'Generation failed. Try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiPost = async () => {
    if (!aiGenUrl) return;
    await handleFileFromUrl(aiGenUrl);
  };

  const handleFileFromUrl = async (url: string) => {
    setMode('media');
    setMediaUrl(url);
    setMediaType('IMAGE');
  };

  const handleAiBack = () => {
    setMode('pick');
    setAiPrompt('');
    setAiGenUrl(null);
    setAiGenError(null);
    setAiLoading(false);
  };

  const canPost = mode === 'text' ? !!caption.trim() : mode === 'media' && !!mediaUrl;
  const activeFont = FONTS[fontIndex].key;

  const pickEmoji = (emoji: string) => {
    setCaption((prev) => (prev + emoji).slice(0, MAX_CAPTION));
    setShowEmoji(false);
    textareaRef.current?.focus();
  };

  return (
    <div className="fixed inset-0 z-[75] bg-black/95 flex flex-col animate-fade-in select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInput}
        className="hidden"
        accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/heic,image/heif,video/mp4,video/webm,video/quicktime,video/x-matroska,video/3gpp"
      />

      {/* ─── Top bar ─── */}
      <header
        className="relative z-30 flex items-center justify-between px-3 bar-glass border-b border-white/5"
        style={{ paddingTop: 'max(env(safe-area-inset-top), 0.5rem)', paddingBottom: '0.5rem' }}
      >
        <button
          onClick={mode === 'pick' ? onClose : mode === 'ai' ? handleAiBack : resetToPick}
          aria-label={mode === 'pick' ? 'Close' : 'Back'}
          className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition active:scale-90"
        >
          {mode === 'pick' ? <X className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
        <h2 className="text-[15px] font-semibold text-white">
          {mode === 'pick' ? 'New status' : mode === 'text' ? 'Text status' : mode === 'ai' ? 'AI Image' : 'Preview'}
        </h2>
        <div className="w-9" />
      </header>

      {/* ─── Error toast ─── */}
      {error && (
        <div className="absolute top-[max(env(safe-area-inset-top),0.5rem)] left-1/2 -translate-x-1/2 mt-12 z-40 px-3.5 py-2 bg-red-500/15 border border-red-500/30 rounded-full flex items-center gap-2 text-red-300 text-xs font-medium animate-slide-down">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Step: pick ─── */}
      {mode === 'pick' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className="flex-1 flex flex-col items-center justify-center gap-4 px-6"
        >
          <div className="w-full max-w-sm grid grid-cols-3 gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="group aspect-[3/4] rounded-3xl bar-glass border border-white/10 flex flex-col items-center justify-center gap-3 transition active:scale-[0.97] hover:border-white/20 disabled:opacity-60"
            >
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-pop group-hover:scale-105 transition">
                {uploading ? <Loader2 className="w-7 h-7 text-white animate-spin" /> : <ImageIcon className="w-7 h-7 text-white" />}
              </span>
              <span className="text-sm font-semibold text-white">Photo / Video</span>
              <span className="text-[11px] text-white/45">{uploading ? `Uploading ${progress}%` : 'From your device'}</span>
            </button>

            <button
              onClick={() => setMode('text')}
              className="group aspect-[3/4] rounded-3xl bar-glass border border-white/10 flex flex-col items-center justify-center gap-3 transition active:scale-[0.97] hover:border-white/20"
            >
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] group-hover:scale-105 transition">
                <Type className="w-7 h-7 text-white" />
              </span>
              <span className="text-sm font-semibold text-white">Text</span>
              <span className="text-[11px] text-white/45">Write something</span>
            </button>

            <button
              onClick={() => setMode('ai')}
              className="group aspect-[3/4] rounded-3xl bar-glass border border-white/10 flex flex-col items-center justify-center gap-3 transition active:scale-[0.97] hover:border-white/20"
            >
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_8px_24px_-8px_rgba(16,185,129,0.6)] group-hover:scale-105 transition">
                <Sparkles className="w-7 h-7 text-white" />
              </span>
              <span className="text-sm font-semibold text-white">AI Image</span>
              <span className="text-[11px] text-white/45">Describe and generate</span>
            </button>
          </div>

          <div
            className={`w-full max-w-sm rounded-2xl border-2 border-dashed py-4 text-center text-xs transition ${
              dragOver ? 'border-wa-accent bg-wa-accent/10 text-white' : 'border-white/10 text-white/40'
            }`}
          >
            Drag &amp; drop a photo or video here
          </div>
        </div>
      )}

      {/* ─── Step: text ─── */}
      {mode === 'text' && (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 flex items-center justify-center px-5 py-4 min-h-0" style={{ background: bgColor }}>
            <textarea
              ref={textareaRef}
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
              placeholder="Type a status…"
              rows={1}
              className={`w-full max-w-md bg-transparent text-white text-3xl sm:text-4xl font-semibold text-center placeholder-white/40 focus:outline-none resize-none leading-snug break-words ${activeFont}`}
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.25)' }}
            />
          </div>

          {/* Tools */}
          <div
            className="bar-glass border-t border-white/5 px-3 pt-3"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
          >
            {showEmoji && (
              <div className="flex flex-wrap gap-1.5 justify-center pb-3 mb-2 border-b border-white/5 animate-slide-up">
                {EMOJI_LIST.map((e) => (
                  <button key={e} onClick={() => pickEmoji(e)} className="text-2xl p-1 hover:scale-125 transition">
                    {e}
                  </button>
                ))}
              </div>
            )}

            {/* Background swatches */}
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2.5">
              {BACKGROUNDS.map((c) => (
                <button
                  key={c}
                  onClick={() => setBgColor(c)}
                  aria-label="Background"
                  className={`w-8 h-8 rounded-full shrink-0 transition ${
                    bgColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-black scale-105' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ background: c }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFontIndex((p) => (p + 1) % FONTS.length)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-full bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition active:scale-95"
                >
                  <CaseSensitive className="w-4 h-4" />
                  {FONTS[fontIndex].label}
                </button>
                <button
                  onClick={() => setShowEmoji((v) => !v)}
                  aria-label="Emoji"
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition active:scale-95 ${
                    showEmoji ? 'bg-white/15 text-white' : 'bg-white/10 text-white/70 hover:text-white'
                  }`}
                >
                  <Smile className="w-[18px] h-[18px]" />
                </button>
                <span className="text-[11px] text-white/35 tabular-nums pl-1">{caption.length}/{MAX_CAPTION}</span>
              </div>

              <ShareButton onClick={handlePost} disabled={!canPost} posting={posting} />
            </div>
          </div>
        </div>
      )}

      {/* ─── Step: ai ─── */}
      {mode === 'ai' && (
        <div className="flex-1 flex flex-col min-h-0 px-5 py-6">
          <textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value.slice(0, 500))}
            placeholder="Describe the image for your story..."
            rows={4}
            className="w-full bg-white/[0.05] text-[14px] text-zinc-100 rounded-xl border border-white/[0.08] p-3 outline-none focus:border-wa-accent/60 resize-none transition placeholder-zinc-500"
          />
          <div className="flex justify-between items-center mt-1.5 mb-4">
            <span className="text-[11px] text-zinc-600">{aiPrompt.length}/500</span>
            {aiGenError && <span className="text-[11px] text-red-400 flex items-center gap-1"><AlertCircle className="w-3 h-3" />{aiGenError}</span>}
          </div>

          <button
            onClick={handleAiGenerate}
            disabled={aiLoading || aiPrompt.length < 3}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-[14px] font-semibold transition active:scale-[0.98] hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed mb-4"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiLoading ? 'Generating...' : 'Generate'}
          </button>

          {aiLoading && (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-48 h-80 rounded-2xl shimmer-bg flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-zinc-600 animate-spin" />
              </div>
            </div>
          )}

          {aiGenUrl && !aiLoading && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4">
              <div className="w-full max-w-xs">
                <ImageGeneration duration={2200} startDelay={0}>
                  <img src={aiGenUrl} alt="Generated story" className="aspect-[9/16] w-full object-cover" />
                </ImageGeneration>
              </div>
              <ShareButton onClick={handleAiPost} disabled={false} posting={false} />
            </div>
          )}
        </div>
      )}

      {/* ─── Step: media ─── */}
      {mode === 'media' && mediaUrl && (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Blurred fill */}
          {mediaType === 'IMAGE' && (
            <div
              className="absolute inset-0 bg-center bg-cover scale-125"
              style={{ backgroundImage: `url(${mediaUrl})`, filter: 'blur(36px) brightness(0.4)' }}
            />
          )}
          <div className="relative flex-1 flex items-center justify-center min-h-0 p-2">
            {mediaType === 'VIDEO' ? (
              <video src={mediaUrl} className="max-h-full max-w-full object-contain rounded-xl" controls autoPlay muted loop playsInline />
            ) : (
              <img src={mediaUrl} alt="Story preview" className="max-h-full max-w-full object-contain rounded-xl" />
            )}
          </div>

          <div
            className="relative bar-glass border-t border-white/5 px-3 pt-3 flex items-center gap-2"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.75rem)' }}
          >
            <input
              type="text"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, MAX_CAPTION))}
              placeholder="Add a caption…"
              className="flex-1 h-11 bg-white/10 text-white text-sm rounded-full px-4 border border-white/10 focus:outline-none focus:border-wa-accent/60 placeholder-white/40 transition"
            />
            <ShareButton onClick={handlePost} disabled={!canPost} posting={posting} />
          </div>
        </div>
      )}
    </div>
  );
};

/** Circular purple "share" FAB — the single bold accent of the composer. */
const ShareButton: React.FC<{ onClick: () => void; disabled: boolean; posting: boolean }> = ({
  onClick,
  disabled,
  posting,
}) => (
  <button
    onClick={onClick}
    disabled={disabled || posting}
    aria-label="Share status"
    className="shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-pop transition active:scale-90 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none"
  >
    {posting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5 translate-x-[1px]" />}
  </button>
);
