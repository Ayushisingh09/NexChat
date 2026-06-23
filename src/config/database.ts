import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

export const connectDatabase = async () => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL database connected successfully.');
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1);
  }
};
