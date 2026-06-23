import { z } from 'zod';

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});

export const adminActionSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().optional(),
});

export const suspendUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});

export const banUserSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().min(1),
});

export const resolveReportSchema = z.object({
  reportId: z.string().uuid(),
  status: z.enum(['ACTIONED', 'DISMISSED']),
  action: z.enum(['WARN', 'MUTE', 'BAN', 'NONE']).optional(),
  note: z.string().optional(),
});

export const broadcastNotificationSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  target: z.enum(['all', 'user']),
  targetId: z.string().optional(),
});
