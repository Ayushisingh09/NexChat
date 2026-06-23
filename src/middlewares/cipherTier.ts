import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest } from './auth';
import { getTier, type CipherTierConfig } from '../config/cipherTiers';

export interface TieredRequest extends AuthenticatedRequest {
  userTier?: CipherTierConfig;
  userTierIndex?: number;
}

export const attachCipherTier = async (
  req: TieredRequest,
  _res: Response,
  next: NextFunction
) => {
  const userId = req.user?.id;
  if (!userId) return next();

  try {
    const user = await (prisma.user as any).findUnique({
      where: { id: userId },
      select: { cipherTier: true },
    });
    req.userTierIndex = (user?.cipherTier as number) ?? 0;
    req.userTier = getTier(req.userTierIndex!);
  } catch {
    req.userTierIndex = 0;
    req.userTier = getTier(0);
  }

  return next();
};
