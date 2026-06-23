import React, { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Download, Forward, Star, Trash2, Copy, Loader2, MoreHorizontal } from 'lucide-react';

interface ImageViewerProps {
  src: string;
  onClose: () => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, onClose }) => {
  const [loaded, setLoaded] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [pullY, setPullY] = useState(0);
  const [pullScale, setPullScale] = useState(1);
  const [pullOpacity, setPullOpacity] = useState(1);
  const [showMenu, setShowMenu] = useState(false);
  const [starred, setStarred] = useState(false);

  const pullStartRef = useRef<{ y: number; active: boolean } | null>(null);
  const longPressRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapRef = useRef<number>(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1 && !zoomed) {
      pullStartRef.current = { y: e.touches[0].clientY, active: false };
    }
    if (e.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < 300) {
        setZoomed((prev) => !prev);
        lastTapRef.current = 0;
      } else {
        lastTapRef.current = now;
      }
    }
  }, [zoomed]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const s = pullStartRef.current;
    if (!s || zoomed) return;
    const dy = e.touches[0].clientY - s.y;
    if (dy > 0) {
      s.active = true;
      setPullY(dy);
      setPullScale(Math.max(0.7, 1 - dy / 600));
      setPullOpacity(Math.max(0, 1 - dy / 400));
    }
  }, [zoomed]);

  const handleTouchEnd = useCallback(() => {
    const s = pullStartRef.current;
    if (s?.active && pullY > 120) {
      onClose();
    } else {
      setPullY(0);
      setPullScale(1);
      setPullOpacity(1);
    }
    pullStartRef.current = null;
  }, [pullY, onClose]);

  const handlePointerDown = useCallback(() => {
    longPressRef.current = setTimeout(() => {
      setShowMenu(true);
    }, 500);
  }, []);

  const handlePointerUp = useCallback(() => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (longPressRef.current) clearTimeout(longPressRef.current);
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col"
      style={{ backgroundColor: '#0a0a0a', opacity: pullOpacity }}
    >
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(180deg, rgba(0,0,0,0.4) 0%, transparent 30%, transparent 70%, rgba(0,0,0,0.4) 100%)`,
        }}
      />

      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 ease-out"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div
        className="flex-1 flex items-center justify-center p-4"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        style={{
          transform: `translateY(${pullY}px) scale(${pullScale})`,
          transition: pullY ? 'none' : 'transform 0.25s ease-out, opacity 0.25s ease-out',
        }}
      >
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <Loader2 className="w-8 h-8 text-white/40 animate-spin" />
          </div>
        )}

        <img
          src={src}
          alt=""
          className={`select-none transition-opacity duration-200 ease-out ${
            loaded ? 'opacity-100' : 'opacity-0'
          } ${zoomed ? 'scale-[2]' : 'scale-100'}`}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.04)',
            transition: zoomed
              ? 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)'
              : 'transform 0.25s ease-out, opacity 0.2s ease-out',
            cursor: zoomed ? 'zoom-out' : 'zoom-in',
          }}
          onLoad={() => setLoaded(true)}
          onDoubleClick={(e) => {
            e.preventDefault();
            setZoomed((prev) => !prev);
          }}
          onClick={(e) => {
            e.stopPropagation();
            const now = Date.now();
            if (now - lastTapRef.current < 300) {
              setZoomed((prev) => !prev);
              lastTapRef.current = 0;
            } else {
              lastTapRef.current = now;
            }
          }}
        />
      </div>

      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <a
            href={src}
            download
            target="_blank"
            rel="noreferrer"
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 ease-out"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-5 h-5" />
          </a>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setStarred((prev) => !prev);
            }}
            className={`p-2 rounded-full transition-all duration-200 ease-out ${
              starred ? 'text-amber-400 bg-amber-400/10' : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Star className={`w-5 h-5 ${starred ? 'fill-current' : ''}`} />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((prev) => !prev);
            }}
            className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-200 ease-out"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
        </div>
      </div>

      {showMenu && (
        <div
          className="fixed inset-0 z-[110]"
          onClick={() => setShowMenu(false)}
        >
          <div className="absolute bottom-20 left-4 right-4 bg-[#1a1a1e] border border-white/[0.08] rounded-2xl shadow-elevated py-1.5 animate-scale-in origin-bottom">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const a = document.createElement('a');
                a.href = src;
                a.download = '';
                a.click();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-all duration-200 ease-out text-[13px] font-medium text-white flex items-center space-x-3 bg-transparent border-none outline-none"
            >
              <Download className="w-4 h-4 text-white/60 shrink-0" />
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-all duration-200 ease-out text-[13px] font-medium text-white flex items-center space-x-3 bg-transparent border-none outline-none"
            >
              <Forward className="w-4 h-4 text-white/60 shrink-0" />
              <span>Forward</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (navigator.share) {
                  navigator.share({ url: src });
                }
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-all duration-200 ease-out text-[13px] font-medium text-white flex items-center space-x-3 bg-transparent border-none outline-none"
            >
              <Copy className="w-4 h-4 text-white/60 shrink-0" />
              <span>Share</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStarred((prev) => !prev);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-all duration-200 ease-out text-[13px] font-medium text-white flex items-center space-x-3 bg-transparent border-none outline-none"
            >
              <Star className={`w-4 h-4 shrink-0 ${starred ? 'text-amber-400 fill-amber-400' : 'text-white/60'}`} />
              <span>{starred ? 'Unstar' : 'Star'}</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(src);
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-all duration-200 ease-out text-[13px] font-medium text-white flex items-center space-x-3 bg-transparent border-none outline-none"
            >
              <Copy className="w-4 h-4 text-white/60 shrink-0" />
              <span>Copy</span>
            </button>
            <div className="border-t border-white/[0.06] my-1" />
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(false);
              }}
              className="w-full text-left px-4 py-2.5 hover:bg-white/[0.06] transition-all duration-200 ease-out text-[13px] font-medium text-red-400 flex items-center space-x-3 bg-transparent border-none outline-none"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              <span>Delete</span>
            </button>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};
