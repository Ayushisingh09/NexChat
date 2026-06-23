import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth';
import { successResponse } from '../../utils/response';
import { fetchLinkPreview } from '../../utils/linkPreview';
import { generateImage, type ImageGenType } from '../../services/imageGenService';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { pipeline } from 'stream/promises';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  logger.info(`Created uploads directory at ${UPLOADS_DIR}`);
} else {
  const entries = fs.readdirSync(UPLOADS_DIR);
  if (entries.length === 0) {
    logger.warn(`Uploads directory at ${UPLOADS_DIR} is empty. If files were previously uploaded, the Docker volume may have been lost.`);
  }
}

const MB = 1024 * 1024;
const SIZE_LIMITS: Record<string, number> = {
  image: 50 * MB,
  video: 50 * MB,
  audio: 50 * MB,
  other: 50 * MB,
};

const ALLOWED_MIME = /^(image\/(jpeg|jpg|pjpeg|png|gif|webp|avif|heic|heif|bmp|tiff|x-tiff|svg\+xml|vnd\.microsoft\.icon)|video\/(mp4|webm|quicktime|x-matroska|3gpp|x-msvideo|x-ms-wmv|mpeg|x-m4v|ogg)|audio\/(mpeg|mp4|aac|ogg|webm|wav|x-m4a|x-wav|flac)|application\/(pdf|zip|x-zip-compressed|x-tar|gzip|x-gzip|msword|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-excel|vnd\.ms-powerpoint)|text\/(plain|csv))$/i;

const sizeLimitFor = (mime: string): number => {
  const category = mime.split('/')[0];
  return SIZE_LIMITS[category] ?? SIZE_LIMITS.other;
};

const UPLOAD_GRANT_TTL_SECONDS = 10 * 60;
const DAILY_UPLOAD_QUOTA_BYTES = 500 * MB;
const MINUTE_UPLOAD_BYTE_LIMIT = 200 * MB;

const FILE_SIGNATURES: Record<string, [number, number[]][]> = {
  'image/jpeg': [[0, [0xFF, 0xD8, 0xFF]]],
  'image/png': [[0, [0x89, 0x50, 0x4E, 0x47]]],
  'image/gif': [[0, [0x47, 0x49, 0x46, 0x38]]],
  'image/webp': [[8, [0x57, 0x45, 0x42, 0x50]]],
  'image/avif': [[4, [0x66, 0x74, 0x79, 0x70, 0x61, 0x76, 0x69, 0x66]]],
  'image/bmp': [[0, [0x42, 0x4D]]],
  'image/tiff': [
    [0, [0x49, 0x49, 0x2A, 0x00]],
    [0, [0x4D, 0x4D, 0x00, 0x2A]],
  ],
  'video/mp4': [[4, [0x66, 0x74, 0x79, 0x70]]],
  'video/webm': [[0, [0x1A, 0x45, 0xDF, 0xA3]]],
  'application/pdf': [[0, [0x25, 0x50, 0x44, 0x46]]],
  'application/zip': [
    [0, [0x50, 0x4B, 0x03, 0x04]],
    [0, [0x50, 0x4B, 0x05, 0x06]],
    [0, [0x50, 0x4B, 0x07, 0x08]],
  ],
};

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  const sigs = FILE_SIGNATURES[mimeType];
  if (!sigs) return true;
  return sigs.some(([offset, bytes]) => {
    for (let i = 0; i < bytes.length; i++) {
      if ((offset + i) >= buffer.length || buffer[offset + i] !== bytes[i]) return false;
    }
    return true;
  });
}

function getDateFormat(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export class MediaController {
  static async getPresignedUrl(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { fileName, fileType, fileSize } = req.body as {
        fileName?: string;
        fileType?: string;
        fileSize?: number;
      };
      if (!fileName || typeof fileName !== 'string') {
        return res.status(400).json({ success: false, message: 'fileName is required' });
      }
      const baseType = typeof fileType === 'string' ? fileType.split(';')[0].trim() : '';
      if (!baseType || !ALLOWED_MIME.test(baseType)) {
        return res.status(400).json({ success: false, message: 'This file type is not supported.' });
      }
      const maxBytes = sizeLimitFor(baseType);
      if (typeof fileSize !== 'number' || fileSize <= 0 || fileSize > maxBytes) {
        return res.status(413).json({
          success: false,
          message: `File is too large. Maximum size for this type is ${Math.round(maxBytes / MB)}MB.`,
          errors: { code: 'FILE_TOO_LARGE', maxBytes, allowedTypes: Object.keys(SIZE_LIMITS) },
        });
      }

      if (req.user?.id) {
        const dateKey = getDateFormat();
        const usageKey = `upload:daily:${req.user.id}:${dateKey}`;
        const usedBytes = parseInt(await redis.get(usageKey) || '0', 10);
        if (usedBytes + fileSize > DAILY_UPLOAD_QUOTA_BYTES) {
          const remaining = Math.max(0, Math.floor((DAILY_UPLOAD_QUOTA_BYTES - usedBytes) / MB));
          return res.status(429).json({
            success: false,
            message: `Daily upload limit reached. ${remaining}MB remaining.`,
            errors: { code: 'DAILY_QUOTA_EXCEEDED', quotaBytes: DAILY_UPLOAD_QUOTA_BYTES, usedBytes, remainingBytes: DAILY_UPLOAD_QUOTA_BYTES - usedBytes },
          });
        }

        const minKey = `upload:minutes:${req.user.id}:${Math.floor(Date.now() / 60000)}`;
        const minUsed = parseInt(await redis.get(minKey) || '0', 10);
        if (minUsed + fileSize > MINUTE_UPLOAD_BYTE_LIMIT) {
          return res.status(429).json({
            success: false,
            message: 'Upload limit reached for this minute. Please wait.',
            errors: { code: 'MINUTE_QUOTA_EXCEEDED', limitBytes: MINUTE_UPLOAD_BYTE_LIMIT },
          });
        }
      }

      const uniqueName = `${Date.now()}-${encodeURIComponent(fileName)}`;
      await redis.set(`upload:grant:${uniqueName}`, String(maxBytes), 'EX', UPLOAD_GRANT_TTL_SECONDS);
      if (req.user?.id) {
        await redis.set(`upload:grant:user:${uniqueName}`, req.user.id, 'EX', UPLOAD_GRANT_TTL_SECONDS);
      }

      const baseUrl = env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
      const uploadUrl = `${baseUrl}/api/media/upload?filename=${encodeURIComponent(uniqueName)}`;
      const publicUrl = `${baseUrl}/uploads/${uniqueName}`;

      logger.info(`Presigned URL generated for file: ${fileName} (type: ${baseType}, size: ${fileSize})`);
      return successResponse(res, 'Presigned URL generated', { uploadUrl, publicUrl });
    } catch (error) {
      return next(error);
    }
  }

  static async upload(req: Request, res: Response, next: NextFunction) {
    try {
      const filename = req.query.filename as string;
      if (!filename) {
        return res.status(400).json({ success: false, message: 'filename query parameter is required', errors: { code: 'MISSING_FILENAME' } });
      }

      const filePath = path.resolve(UPLOADS_DIR, filename);
      if (!filePath.startsWith(UPLOADS_DIR + path.sep)) {
        return res.status(400).json({ success: false, message: 'Invalid filename', errors: { code: 'PATH_TRAVERSAL' } });
      }

      const grantKey = `upload:grant:${filename}`;
      const grantedMax = await redis.get(grantKey);
      if (!grantedMax) {
        return res.status(403).json({ success: false, message: 'Upload not authorized or grant expired', errors: { code: 'NO_GRANT' } });
      }

      const body = req.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        return res.status(400).json({ success: false, message: 'Empty upload body', errors: { code: 'EMPTY_BODY' } });
      }
      if (body.length > Number(grantedMax)) {
        return res.status(413).json({ success: false, message: 'File exceeds the allowed size', errors: { code: 'FILE_TOO_LARGE', maxBytes: Number(grantedMax) } });
      }

      const fileNameLower = filename.toLowerCase();
      const detectedMime = (
        fileNameLower.endsWith('.jpg') || fileNameLower.endsWith('.jpeg') ? 'image/jpeg' :
        fileNameLower.endsWith('.png') ? 'image/png' :
        fileNameLower.endsWith('.gif') ? 'image/gif' :
        fileNameLower.endsWith('.webp') ? 'image/webp' :
        fileNameLower.endsWith('.avif') ? 'image/avif' :
        fileNameLower.endsWith('.bmp') ? 'image/bmp' :
        fileNameLower.endsWith('.tiff') || fileNameLower.endsWith('.tif') ? 'image/tiff' :
        fileNameLower.endsWith('.mp4') ? 'video/mp4' :
        fileNameLower.endsWith('.webm') ? 'video/webm' :
        fileNameLower.endsWith('.pdf') ? 'application/pdf' :
        fileNameLower.endsWith('.zip') ? 'application/zip' :
        null
      );

      if (detectedMime && !validateMagicBytes(body, detectedMime)) {
        return res.status(400).json({
          success: false,
          message: 'File content does not match its extension',
          errors: { code: 'MIME_MISMATCH' },
        });
      }

      const tmpPath = filePath + '.tmp';
      const writeStream = fs.createWriteStream(tmpPath);
      await pipeline(Readable.from([body]), writeStream);
      fs.renameSync(tmpPath, filePath);

      await redis.del(grantKey);

      const getUserIdFromGrant = await redis.get(`upload:grant:user:${filename}`);
      const userId = getUserIdFromGrant || 'unknown';

      if (userId !== 'unknown') {
        const dateKey = getDateFormat();
        const usageKey = `upload:daily:${userId}:${dateKey}`;
        await redis.incrby(usageKey, body.length);
        await redis.expire(usageKey, 86400);

        const minKey = `upload:minutes:${userId}:${Math.floor(Date.now() / 60000)}`;
        await redis.incrby(minKey, body.length);
        await redis.expire(minKey, 120);
      }

      logger.info(`Uploaded file: ${filename} (${body.length} bytes)`);
      return res.status(200).json({ success: true });
    } catch (error) {
      return next(error);
    }
  }

  static async generateImage(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { prompt, type } = req.body as { prompt?: string; type?: string };

      if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 3) {
        return res.status(400).json({ success: false, message: 'Prompt must be at least 3 characters.' });
      }
      if (prompt.length > 500) {
        return res.status(413).json({ success: false, message: 'Prompt is too long (max 500 characters).' });
      }
      const genType: ImageGenType = type === 'avatar' ? 'avatar' : 'story';

      let image;
      try {
        image = await generateImage(prompt.trim(), genType);
      } catch (err: any) {
        const code = err?.message;
        if (code === 'IMAGE_GEN_UNCONFIGURED') {
          return res.status(503).json({ success: false, message: 'AI image generation is not available right now.' });
        }
        if (code === 'IMAGE_GEN_RATE_LIMITED') {
          return res.status(429).json({ success: false, message: 'AI image service is busy. Please try again in a moment.' });
        }
        if (code === 'IMAGE_GEN_TIMEOUT') {
          return res.status(504).json({ success: false, message: 'Image generation timed out. Please try again.' });
        }
        logger.warn(`AI image generation failed: ${code}`);
        return res.status(502).json({ success: false, message: 'Generation failed. Please try again.' });
      }

      const ext = image.mimeType === 'image/png' ? 'png' : 'jpg';
      const uniqueName = `${Date.now()}-ai-${genType}.${ext}`;
      const filePath = path.resolve(UPLOADS_DIR, uniqueName);
      if (!filePath.startsWith(UPLOADS_DIR + path.sep)) {
        return res.status(500).json({ success: false, message: 'Failed to save generated image.' });
      }

      const tmpPath = filePath + '.tmp';
      await pipeline(Readable.from([image.buffer]), fs.createWriteStream(tmpPath));
      fs.renameSync(tmpPath, filePath);

      const baseUrl = env.SERVER_URL || `${req.protocol}://${req.get('host')}`;
      const publicUrl = `${baseUrl}/uploads/${uniqueName}`;

      logger.info(`AI image generated (${genType}) for user ${req.user?.id || 'unknown'}: ${uniqueName} (${image.buffer.length} bytes)`);
      return successResponse(res, 'Image generated', { publicUrl });
    } catch (error) {
      return next(error);
    }
  }

  static async linkPreview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { url } = req.body as { url?: string };
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, message: 'url is required' });
      }

      const preview = await fetchLinkPreview(url);
      if (!preview) {
        return res.status(204).end();
      }

      return successResponse(res, 'Link preview fetched', preview);
    } catch (error) {
      return next(error);
    }
  }

  static async translate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { text, target } = req.body as { text?: string; target?: string };

      if (!text || typeof text !== 'string' || !text.trim()) {
        return res.status(400).json({ success: false, message: 'text is required' });
      }
      if (text.length > 5000) {
        return res.status(413).json({ success: false, message: 'text too long' });
      }
      const targetLang = (target || 'en').toLowerCase();
      if (!/^[a-z]{2}(-[a-z]{2,4})?$/.test(targetLang)) {
        return res.status(400).json({ success: false, message: 'invalid target language' });
      }

      const endpoint =
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=` +
        encodeURIComponent(text);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      let raw: any;
      try {
        const resp = await fetch(endpoint, { signal: controller.signal });
        if (!resp.ok) {
          return res.status(502).json({ success: false, message: 'Translation service error' });
        }
        raw = await resp.json();
      } finally {
        clearTimeout(timeout);
      }

      const segments: any[] = Array.isArray(raw?.[0]) ? raw[0] : [];
      const translatedText = segments.map((s) => (Array.isArray(s) ? s[0] : '')).join('');
      const detectedSourceLang = typeof raw?.[2] === 'string' ? raw[2] : null;

      if (!translatedText) {
        return res.status(502).json({ success: false, message: 'Empty translation' });
      }

      return successResponse(res, 'Translated', { translatedText, detectedSourceLang, target: targetLang });
    } catch (error) {
      return next(error);
    }
  }
}
