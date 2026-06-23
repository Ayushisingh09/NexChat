import { useState } from 'react';
import { mediaApi } from '../api/media.api';
import { showToast } from '../components/layout/ToastHost';

const MB = 1024 * 1024;
const SIZE_LIMITS_MB: Record<string, number> = {
  image: 50,
  video: 50,
  audio: 50,
  other: 50,
};

const MAX_DIM = 1920;
const JPEG_QUALITY = 0.82;

const sizeLimitMb = (mime: string) => SIZE_LIMITS_MB[mime.split('/')[0]] ?? SIZE_LIMITS_MB.other;

const compressImage = (file: File): Promise<File> =>
  new Promise((resolve) => {
    if (!file.type.startsWith('image/')) return resolve(file);

    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width <= MAX_DIM && height <= MAX_DIM && file.type === 'image/jpeg') {
        return resolve(file);
      }

      if (width > height) {
        if (width > MAX_DIM) {
          height = Math.round((height * MAX_DIM) / width);
          width = MAX_DIM;
        }
      } else {
        if (height > MAX_DIM) {
          width = Math.round((width * MAX_DIM) / height);
          height = MAX_DIM;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(file);

      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const jpegName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
            resolve(new File([blob], jpegName, { type: 'image/jpeg', lastModified: Date.now() }));
          } else {
            resolve(file);
          }
        },
        'image/jpeg',
        JPEG_QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });

export const useMediaUpload = () => {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = async (file: File) => {
    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      const limitMb = sizeLimitMb(file.type);
      if (file.size > limitMb * MB) {
        const msg = `File is too large. Maximum size for this type is ${limitMb}MB.`;
        showToast(msg);
        throw new Error(msg);
      }

      const compressed = file.type.startsWith('image/') ? await compressImage(file) : file;

      // 1. Get presigned upload URL and expected public URL
      const { uploadUrl, publicUrl } = await mediaApi.getPresignedUrl(compressed.name, compressed.type, compressed.size);

      // 2. Upload file to target location with progress tracking
      await mediaApi.uploadFile(uploadUrl, compressed, (pct) => {
        setProgress(pct);
      });

      // 3. Detect message content type
      let type: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' = 'FILE';
      if (file.type.startsWith('image/')) {
        type = 'IMAGE';
      } else if (file.type.startsWith('video/')) {
        type = 'VIDEO';
      } else if (file.type.startsWith('audio/')) {
        type = 'AUDIO';
      }

      setUploading(false);
      return { publicUrl, type };
    } catch (err: any) {
      setUploading(false);
      setError(err.message || 'File upload failed');
      throw err;
    }
  };

  return {
    uploadFile,
    uploading,
    progress,
    error,
  };
};
