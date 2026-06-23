import axios from 'axios';
import { api } from './axios';

export interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
}

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
}

export const mediaApi = {
  getPresignedUrl: async (fileName: string, fileType: string, fileSize: number): Promise<PresignedUrlResponse> => {
    const res = await api.post('/media/presigned-url', { fileName, fileType, fileSize });
    return res.data.data;
  },

  generateImage: async (prompt: string, type: 'avatar' | 'story'): Promise<string> => {
    const res = await api.post('/media/generate-image', { prompt, type });
    return res.data.data.publicUrl as string;
  },

  linkPreview: async (url: string): Promise<LinkPreviewData | null> => {
    const res = await api.post('/media/link-preview', { url });
    if (res.status === 204) return null;
    return res.data.data;
  },

  translate: async (
    text: string,
    target: string
  ): Promise<{ translatedText: string; detectedSourceLang: string | null; target: string }> => {
    const res = await api.post('/media/translate', { text, target });
    return res.data.data;
  },

  uploadFile: async (
    uploadUrl: string,
    file: File,
    onProgress?: (progress: number) => void
  ): Promise<void> => {
    await axios.put(uploadUrl, file, {
      headers: {
        'Content-Type': file.type,
      },
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          if (onProgress) {
            onProgress(percentCompleted);
          }
        }
      },
    });
  },
};
