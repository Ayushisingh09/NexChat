import { env } from '../config/env';
import { logger } from '../utils/logger';

/**
 * AI image generation backed by NVIDIA NIM (hosted cloud GenAI endpoint).
 *
 * Model: black-forest-labs/flux.1-schnell — a fast, free, guidance-distilled
 * text-to-image model that produces high quality results in ~4 steps. Uses the
 * same NVIDIA API key as Cipher (NVIDIA_NIM_API_KEY).
 */

const FLUX_ENDPOINT = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';

export type ImageGenType = 'avatar' | 'story';

interface Dimensions {
  width: number;
  height: number;
}

// flux.1-schnell only accepts width/height from this fixed set:
// 768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344.
const DIMENSIONS: Record<ImageGenType, Dimensions> = {
  avatar: { width: 1024, height: 1024 }, // square — crops cleanly to a circle
  story: { width: 768, height: 1344 },   // ~9:16 portrait — full-screen status
};

/**
 * Quality tags appended to the user's prompt. Short comma-separated tags work
 * far better for diffusion models than verbose paragraph-style instructions.
 */
function enhancePrompt(prompt: string, type: ImageGenType): string {
  if (type === 'avatar') {
    return `${prompt}, professional avatar portrait, centered composition, solid or gradient background, sharp focus, high detail, vibrant colors, clean modern design`;
  }
  return `${prompt}, cinematic vertical composition, vibrant colors, dramatic lighting, high resolution, visually striking, professional photography`;
}

export interface GeneratedImage {
  buffer: Buffer;
  mimeType: string;
}

/**
 * Generates an image from a text prompt. Returns the decoded image bytes.
 * Throws on misconfiguration or upstream failure (callers map to HTTP codes).
 */
export async function generateImage(prompt: string, type: ImageGenType): Promise<GeneratedImage> {
  const apiKey = env.NVIDIA_NIM_API_KEY;
  if (!apiKey) {
    throw new Error('IMAGE_GEN_UNCONFIGURED');
  }

  const { width, height } = DIMENSIONS[type];
  const body = {
    prompt: enhancePrompt(prompt, type),
    width,
    height,
    // flux.1-schnell is guidance-distilled — the API requires cfg_scale <= 0.
    cfg_scale: 0,
    steps: 4,
    seed: Math.floor(Math.random() * 4_294_967_295),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  let response: globalThis.Response;
  try {
    response = await fetch(FLUX_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (err: any) {
    if (err?.name === 'AbortError') throw new Error('IMAGE_GEN_TIMEOUT');
    throw new Error('IMAGE_GEN_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    logger.warn(`NVIDIA image API returned ${response.status}: ${text.slice(0, 300)}`);
    if (response.status === 429) throw new Error('IMAGE_GEN_RATE_LIMITED');
    throw new Error('IMAGE_GEN_UNAVAILABLE');
  }

  const data: any = await response.json().catch(() => null);
  // FLUX hosted endpoint returns { artifacts: [{ base64 }] }.
  const base64: string | undefined =
    data?.artifacts?.[0]?.base64 ?? data?.data?.[0]?.b64_json ?? data?.image;

  if (!base64 || typeof base64 !== 'string') {
    logger.warn('NVIDIA image API returned no image payload');
    throw new Error('IMAGE_GEN_UNAVAILABLE');
  }

  // Strip an optional data-URL prefix before decoding.
  const cleaned = base64.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(cleaned, 'base64');
  if (buffer.length === 0) {
    throw new Error('IMAGE_GEN_UNAVAILABLE');
  }

  // flux.1-schnell returns JPEG; detect from magic bytes to stay correct if
  // the upstream format ever changes.
  const isPng = buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  return { buffer, mimeType: isPng ? 'image/png' : 'image/jpeg' };
}
