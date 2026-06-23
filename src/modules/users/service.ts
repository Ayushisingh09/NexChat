import bcrypt from 'bcryptjs';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { parseUserAgent } from '../../utils/userAgent';

export class UsersService {
  static async listSessions(userId: string, currentSid?: string) {
    const tokens = await prisma.refreshToken.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      orderBy: { lastUsedAt: 'desc' },
      select: { id: true, userAgent: true, ip: true, lastUsedAt: true, createdAt: true },
    });

    return tokens.map((t) => {
      const { browser, os } = parseUserAgent(t.userAgent);
      return {
        id: t.id,
        browser,
        os,
        ip: t.ip,
        lastUsedAt: t.lastUsedAt,
        createdAt: t.createdAt,
        current: t.id === currentSid,
      };
    });
  }

  static async revokeSession(userId: string, sessionId: string) {
    const result = await prisma.refreshToken.deleteMany({
      where: { id: sessionId, userId },
    });
    if (result.count === 0) {
      throw Object.assign(new Error('Session not found'), { statusCode: 404 });
    }
    return { success: true };
  }

  static async revokeOtherSessions(userId: string, currentSid?: string) {
    const result = await prisma.refreshToken.deleteMany({
      where: { userId, id: currentSid ? { not: currentSid } : undefined },
    });
    return { revoked: result.count };
  }

  static async getByUsername(username: string, _viewerId?: string) {
    const user = await prisma.user.findUnique({
      where: { username },
      select: { id: true, username: true, displayName: true, avatar: true, bio: true, isPublic: true },
    });
    if (!user) {
      throw Object.assign(new Error('User not found'), { statusCode: 404 });
    }
    return user;
  }

  static async saveFcmToken(userId: string, fcmToken: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { fcmToken },
      select: { id: true, fcmToken: true },
    });
  }

  static async getPresence(userId: string) {
    const isOnline = await redis.get(`presence:${userId}`);
    if (isOnline === 'online') return { isOnline: true, lastSeen: null };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { lastSeen: true },
    });
    if (!user) throw new Error('User not found');
    return { isOnline: false, lastSeen: user.lastSeen };
  }

  static async getMe(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        displayName: true,
        avatar: true,
        bio: true,
        lastSeen: true,
        lastSeenVisibility: true,
        showEmail: true,
        readReceiptsEnabled: true,
        notificationsEnabled: true,
        notificationSound: true,
        isPublic: true,
        createdAt: true,
      },
    });
    if (!user) throw new Error('User not found');
    return user;
  }

  static async deleteAccount(userId: string, password: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw Object.assign(new Error('User not found'), { statusCode: 404 });
    if (user.passwordHash) {
      const isMatch = await bcrypt.compare(password, user.passwordHash);
      if (!isMatch) throw Object.assign(new Error('Password is incorrect'), { statusCode: 400 });
    }
    await prisma.$transaction([
      prisma.refreshToken.deleteMany({ where: { userId } }),
      prisma.block.deleteMany({ where: { OR: [{ blockerId: userId }, { blockedId: userId }] } }),
      prisma.participant.deleteMany({ where: { userId } }),
      prisma.message.deleteMany({ where: { senderId: userId } }),
      prisma.reaction.deleteMany({ where: { userId } }),
      prisma.user.delete({ where: { id: userId } }),
    ]);
    return { success: true };
  }

  static async updateProfile(
    userId: string,
    data: {
      displayName?: string;
      avatar?: string | null;
      bio?: string | null;
      username?: string | null;
      lastSeenVisibility?: string;
      readReceiptsEnabled?: boolean;
      notificationsEnabled?: boolean;
      notificationSound?: boolean;
      showEmail?: boolean;
      isPublic?: boolean;
    }
  ) {
    // Check username uniqueness if provided
    if (data.username) {
      const existing = await prisma.user.findUnique({
        where: { username: data.username },
        select: { id: true },
      });
      if (existing && existing.id !== userId) {
        throw Object.assign(new Error('Username already taken'), { statusCode: 409 });
      }
    }

    return prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        phone: true,
        username: true,
        displayName: true,
        avatar: true,
        bio: true,
        lastSeen: true,
        lastSeenVisibility: true,
        readReceiptsEnabled: true,
        notificationsEnabled: true,
        notificationSound: true,
        isPublic: true,
        createdAt: true,
      },
    });
  }
}
