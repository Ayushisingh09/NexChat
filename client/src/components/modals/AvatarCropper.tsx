import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { X, ZoomIn, ZoomOut, RotateCcw, Check } from 'lucide-react';

interface AvatarCropperProps {
  src: string;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

const toRad = (deg: number) => (deg * Math.PI) / 180;

async function getCroppedBlob(imageSrc: string, crop: Area, rotation = 0): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = imageSrc;
  });

  // react-easy-crop reports the crop area relative to the *rotated* image, so we
  // first render the rotated image onto a bounding-box canvas, then read the crop
  // rectangle out of it. Skipping this step is what produced a blank image.
  const rot = toRad(rotation);
  const bW = Math.abs(Math.cos(rot) * img.width) + Math.abs(Math.sin(rot) * img.height);
  const bH = Math.abs(Math.sin(rot) * img.width) + Math.abs(Math.cos(rot) * img.height);

  const rotated = document.createElement('canvas');
  rotated.width = bW;
  rotated.height = bH;
  const rctx = rotated.getContext('2d')!;
  rctx.translate(bW / 2, bH / 2);
  rctx.rotate(rot);
  rctx.drawImage(img, -img.width / 2, -img.height / 2);

  const size = 400;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  // White backing so transparent corners don't turn black in the JPEG.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(
    rotated,
    crop.x, crop.y, crop.width, crop.height,
    0, 0, size, size,
  );

  return new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => b ? res(b) : rej(new Error('canvas empty')), 'image/jpeg', 0.92)
  );
}

export const AvatarCropper: React.FC<AvatarCropperProps> = ({ src, onConfirm, onCancel }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_: Area, areaPixels: Area) => {
    setCroppedArea(areaPixels);
  }, []);

  const handleConfirm = async () => {
    if (!croppedArea) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(src, croppedArea, rotation);
      onConfirm(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80">
      <div className="w-full max-w-sm bg-[#111114] rounded-2xl shadow-pop border border-white/[0.06] overflow-hidden flex flex-col">
        {/* header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <button type="button" onClick={onCancel} className="p-1.5 rounded-xl hover:bg-white/[0.06] text-zinc-400 transition-colors">
            <X className="w-5 h-5" />
          </button>
          <span className="text-[14px] font-semibold text-zinc-100">Adjust Photo</span>
          <button type="button"
            onClick={handleConfirm}
            disabled={busy}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-wa-accent hover:bg-emerald-600 disabled:opacity-50 text-white text-[12px] font-semibold rounded-xl transition-colors"
          >
            <Check className="w-3.5 h-3.5" />
            Done
          </button>
        </div>

        {/* crop area */}
        <div className="relative w-full" style={{ height: 320 }}>
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            rotation={rotation}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
            style={{
              containerStyle: { background: '#0a0a0c' },
              cropAreaStyle: { border: '2px solid #10b981', boxShadow: '0 0 0 9999px rgba(0,0,0,0.6)' },
            }}
          />
        </div>

        {/* controls */}
        <div className="px-5 py-4 space-y-4 border-t border-white/[0.06]">
          {/* zoom */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.1))} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <ZoomOut className="w-4 h-4" />
            </button>
            <input
              type="range" min={1} max={3} step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="flex-1 accent-emerald-500 h-1 rounded-full cursor-pointer"
            />
            <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>

          {/* rotation */}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setRotation(0)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
              <RotateCcw className="w-4 h-4" />
            </button>
            <input
              type="range" min={-180} max={180} step={1}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              className="flex-1 accent-emerald-500 h-1 rounded-full cursor-pointer"
            />
            <span className="text-[11px] text-zinc-600 w-9 text-right">{rotation}°</span>
          </div>
        </div>
      </div>
    </div>
  );
};
