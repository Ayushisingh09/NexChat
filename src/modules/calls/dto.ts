import { z } from 'zod/v4';

export const createCallSchema = z.object({
  userId: z.string(), // callee ID
  isVideo: z.boolean().optional().default(false),
});

export const generateTokenSchema = z.object({
  roomName: z.string(),
});
