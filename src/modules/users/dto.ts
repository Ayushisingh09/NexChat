import { z } from 'zod';

export const saveFcmTokenSchema = z.object({
  fcmToken: z.string().min(1),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(50).optional(),
  avatar: z.string().url().nullable().optional(),
  bio: z.string().max(255).nullable().optional(),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores').nullable().optional(),
  lastSeenVisibility: z.enum(['EVERYONE', 'NOBODY']).optional(),
  showEmail: z.boolean().optional(),
  readReceiptsEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  notificationSound: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});
