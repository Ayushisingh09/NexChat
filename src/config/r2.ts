import { S3Client } from '@aws-sdk/client-s3';
import { env } from './env';
import { logger } from '../utils/logger';

let s3ClientInstance: S3Client | null = null;

if (env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY && env.R2_SECRET_KEY) {
  s3ClientInstance = new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY,
      secretAccessKey: env.R2_SECRET_KEY,
    },
  });
  logger.info('Cloudflare R2 Client initialized successfully.');
} else {
  logger.info('Cloudflare R2 configuration missing. Media upload will run in mock mode.');
}

export const r2Client = s3ClientInstance;
