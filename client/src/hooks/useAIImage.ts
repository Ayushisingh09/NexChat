import { useState, useCallback } from 'react';
import { mediaApi } from '../api/media.api';
import { showToast } from '../components/layout/ToastHost';

export type AIImageType = 'avatar' | 'story';

/**
 * Generates an image from a text prompt via the backend (NVIDIA FLUX.1-schnell).
 * The server uploads the result and returns a ready-to-use public URL — no
 * client-side upload step is needed.
 */
export const useAIImage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState<string | null>(null);

  const generate = useCallback(async ({ prompt, type }: { prompt: string; type: AIImageType }) => {
    setLoading(true);
    setError(null);
    setUrl(null);

    try {
      const publicUrl = await mediaApi.generateImage(prompt, type);
      setUrl(publicUrl);
      return publicUrl;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Generation failed. Try again.';
      setError(msg);
      showToast(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generate, loading, error, url, setError, setUrl };
};
