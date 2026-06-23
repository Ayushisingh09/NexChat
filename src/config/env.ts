import dotenv from 'dotenv';
import { z } from 'zod';
import { logger } from '../utils/logger';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string(),
  JWT_ACCESS_SECRET: z.string(),
  JWT_REFRESH_SECRET: z.string(),
  CLIENT_URL: z.string().url().default('https://chat.92lrcorps.xyz'),
  REQUIRE_OTP_VERIFICATION: z.preprocess(
    (val) => val === 'true' || val === '1' || val === true,
    z.boolean()
  ).default(true),

  // Cloudflare R2
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY: z.string().optional(),
  R2_SECRET_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_URL: z.string().optional(),

  // Email Verification (Nodemailer SMTP primary, Resend fallback)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM_NAME: z.string().optional().default('NexChat'),
  RESEND_API_KEY: z.string().optional(),

  // Twilio SMS
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // FCM
  FCM_SERVICE_ACCOUNT_JSON: z.string().optional(),
  FCM_SERVICE_ACCOUNT_BASE64: z.string().optional(),

  // Server URL (used for constructing upload public URLs and CSP)
  SERVER_URL: z.string().default('https://api.92lrcorps.xyz'),

  // Frontend URL (for email links)
  FRONTEND_URL: z.string().default('https://chat.92lrcorps.xyz'),

  // Arcjet (bot protection + rate limiting)
  ARCJET_KEY: z.string().optional(),
  ARCJET_ENV: z.enum(['development', 'production']).default('development'),

  // LiveKit (VoIP)
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_HOST: z.string().optional(),
  CALL_TIMEOUT_MS: z.coerce.number().default(30000),

  // Google Gemini AI
  GEMINI_API_KEY: z.string().optional(),

  // Cipher AI Assistant
  NVIDIA_NIM_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  CIPHER_DAILY_TOKEN_LIMIT: z.coerce.number().default(50000),
  CIPHER_MAX_HISTORY: z.coerce.number().default(20),

  // Admin Panel
  ADMIN_PASSWORD: z.string().default('ansh@3232'),
  ADMIN_JWT_SECRET: z.string().default('admin_jwt_secret_nexchat_2024_secure'),
  ADMIN_FRONTEND_URL: z.string().default('http://localhost:5174'),
  ADMIN_ALLOWED_IPS: z.string().optional(),
  ADMIN_SESSION_TIMEOUT_MS: z.coerce.number().default(3600000),
  ADMIN_MAX_LOGIN_ATTEMPTS: z.coerce.number().default(5),
  ADMIN_LOCKOUT_MS: z.coerce.number().default(900000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  logger.error('Invalid Environment Variables:', parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
export type Env = z.infer<typeof envSchema>;
