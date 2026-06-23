import { App, initializeApp, cert } from 'firebase-admin';
import { env } from './env';
import { logger } from '../utils/logger';

let firebaseAdminInstance: App | null = null;

const rawServiceAccount = env.FCM_SERVICE_ACCOUNT_BASE64
  ? Buffer.from(env.FCM_SERVICE_ACCOUNT_BASE64, 'base64').toString('utf8')
  : env.FCM_SERVICE_ACCOUNT_JSON;

if (rawServiceAccount) {
  try {
    const serviceAccount = JSON.parse(rawServiceAccount);
    if (typeof serviceAccount.private_key === 'string') {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
    }
    firebaseAdminInstance = initializeApp({
      credential: cert(serviceAccount),
    });
    logger.info('Firebase Admin initialized successfully.');
  } catch (error) {
    logger.error('Failed to initialize Firebase Admin (push notifications disabled):', error);
  }
} else {
  logger.info('No FCM service account provided. Push notifications will run in mock mode.');
}

export const firebaseAdmin = firebaseAdminInstance;
