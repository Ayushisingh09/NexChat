import { z } from 'zod';

export const sendOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone number must be provided",
  path: ["email", "phone"]
});

export const verifyOtpSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  code: z.string().length(6),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone number must be provided",
  path: ["email", "phone"]
});

export const registerSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  password: z.string().min(6).optional(),
  displayName: z.string().min(2),
  username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/, 'Only letters, numbers and underscores').optional(),
  avatar: z.string().url().optional(),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone number must be provided",
  path: ["email", "phone"]
});

export const loginSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).optional(),
  password: z.string().optional(),
  code: z.string().optional(),
}).refine(data => data.email || data.phone, {
  message: "Either email or phone number must be provided",
  path: ["email", "phone"]
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6),
});
