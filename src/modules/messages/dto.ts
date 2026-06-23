import { z } from 'zod';

const MAX_CONTENT_BYTES = 64 * 1024;
const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

export const createMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .refine((v) => Buffer.byteLength(v, 'utf8') <= MAX_CONTENT_BYTES, {
      message: 'Message is too long',
    }),
  type: z.enum(['TEXT', 'IMAGE', 'AUDIO', 'VIDEO', 'FILE', 'POLL']).optional(),
  mediaUrl: z.string().url().max(2048).optional().nullable(),
  replyToId: z.string().uuid().optional().nullable(),
  mentionedUserIds: z.array(z.string().uuid()).max(256).optional(),
  mentionEveryone: z.boolean().optional(),
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .nullable()
    .refine(
      (v) => {
        if (!v) return true;
        const t = new Date(v).getTime();
        return t <= Date.now() + MAX_SCHEDULE_AHEAD_MS;
      },
      { message: 'Cannot schedule more than 30 days ahead' }
    ),
  pollOptionCount: z.number().int().min(2).max(12).optional().nullable(),
});

export const editMessageSchema = z.object({
  content: z
    .string()
    .min(1, 'Message cannot be empty')
    .refine((v) => Buffer.byteLength(v, 'utf8') <= MAX_CONTENT_BYTES, {
      message: 'Message is too long',
    }),
});
