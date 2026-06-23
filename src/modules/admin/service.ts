import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';
import { auditLog, createAdminSession, destroyAdminSession, destroyAllSessions, getActiveSessions } from './middleware';
import os from 'os';

const ADMIN_TOKEN_EXPIRY = '24h';

// Hash the admin password on startup for comparison
const ADMIN_PASSWORD_HASH = bcrypt.hashSync(env.ADMIN_PASSWORD, 12);

// In-memory feature flags (persisted in Redis)
const DEFAULT_FEATURES: Record<string, boolean> = {
  communities: true,
  stories: true,
  calls: true,
  ai_image: true,
  ai_chatbot: true,
  translation: true,
  friend_requests: true,
  global_search: true,
  scheduled_messages: true,
  disappearing_messages: true,
};

export class AdminService {
  static async login(password: string, ip: string, userAgent?: string) {
    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
    if (!isValid) {
      await auditLog('LOGIN_FAILED', `Failed login attempt`, ip);
      throw new Error('Invalid admin password');
    }

    // Create session
    const sessionId = await createAdminSession(ip, userAgent);

    const token = jwt.sign(
      { role: 'admin', sessionId },
      env.ADMIN_JWT_SECRET,
      { expiresIn: ADMIN_TOKEN_EXPIRY }
    );

    await auditLog('LOGIN_SUCCESS', `Admin logged in`, ip);
    return { token, sessionId };
  }

  static async logout(sessionId: string, ip: string) {
    await destroyAdminSession(sessionId);
    await auditLog('LOGOUT', `Admin logged out`, ip);
    return { message: 'Logged out' };
  }

  static async logoutAll(ip: string) {
    await destroyAllSessions();
    await auditLog('LOGOUT_ALL', 'All admin sessions destroyed', ip);
    return { message: 'All sessions destroyed' };
  }

  static async getActiveSessions() {
    return getActiveSessions();
  }

  static async getAuditLog(limit = 50) {
    const { getAuditLog } = await import('./middleware');
    return getAuditLog(limit);
  }

  static async getDashboardStats() {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      totalUsers,
      newUsersToday,
      newUsersWeek,
      activeUsersToday,
      activeUsersHour,
      totalMessages,
      messagesToday,
      messagesHour,
      totalCommunities,
      newCommunitiesWeek,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { createdAt: { gte: today } } }),
      prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.user.count({ where: { lastSeen: { gte: today } } }),
      prisma.user.count({ where: { lastSeen: { gte: hourAgo } } }),
      prisma.message.count(),
      prisma.message.count({ where: { createdAt: { gte: today } } }),
      prisma.message.count({ where: { createdAt: { gte: hourAgo } } }),
    ]);

    // Active socket connections from Redis
    let activeConnections = 0;
    try {
      const keys = await redis.keys('presence:*');
      activeConnections = keys.length;
    } catch { /* ignore */ }

    return {
      totalUsers,
      newUsersToday,
      newUsersWeek,
      activeUsersToday,
      activeUsersHour,
      activeConnections,
      totalMessages,
      messagesToday,
      messagesHour,
    };
  }

  static async getUsers(page = 1, limit = 20, search?: string) {
    const skip = (page - 1) * limit;

    const where: any = search
      ? {
          OR: [
            { username: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
          phone: true,
          avatar: true,
          bio: true,
          lastSeen: true,
          createdAt: true,
          isPublic: true,
          _count: {
            select: {
              messages: true,
              participants: true,
              friendships: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async getUserDetail(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        displayName: true,
        email: true,
        phone: true,
        avatar: true,
        bio: true,
        lastSeen: true,
        createdAt: true,
        isPublic: true,
        readReceiptsEnabled: true,
        notificationsEnabled: true,
        showEmail: true,
        _count: {
          select: {
            messages: true,
            participants: true,
            friendships: true,
            stories: true,
            reportsCreated: true,
            reportsReceived: true,
          },
        },
      },
    });

    if (!user) throw new Error('User not found');

    // Get sessions
    const sessions = await prisma.refreshToken.findMany({
      where: { userId },
      select: {
        id: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get recent reports about this user
    const reportsAgainst = await prisma.report.findMany({
      where: { reportedId: userId },
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        reporter: { select: { id: true, username: true, displayName: true } },
      },
    });

    // Check if user is online
    let isOnline = false;
    try {
      isOnline = (await redis.exists(`presence:${userId}`)) === 1;
    } catch { /* ignore */ }

    return { ...user, sessions, reportsAgainst, isOnline };
  }

  static async suspendUser(userId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Revoke all sessions
    await prisma.refreshToken.deleteMany({ where: { userId } });

    logger.info(`User ${userId} suspended: ${reason}`);
    return { message: 'User suspended, all sessions revoked' };
  }

  static async banUser(userId: string, reason: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Delete all sessions
    await prisma.refreshToken.deleteMany({ where: { userId } });

    // Clear presence
    try {
      await redis.del(`presence:${userId}`);
    } catch { /* ignore */ }

    logger.info(`User ${userId} banned: ${reason}`);
    return { message: 'User banned, all sessions revoked' };
  }

  static async deleteUser(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');

    // Delete all sessions first
    await prisma.refreshToken.deleteMany({ where: { userId } });

    // Delete user
    await prisma.user.delete({ where: { id: userId } });

    logger.info(`User ${userId} deleted`);
    return { message: 'User deleted' };
  }

  static async getSystemHealth() {
    const health: any = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };

    // System resources
    const cpus = os.cpus();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    health.system = {
      uptime: Math.floor(os.uptime()),
      cpuCount: cpus.length,
      cpuModel: cpus[0]?.model || 'unknown',
      memoryTotal: Math.round(totalMem / 1024 / 1024),
      memoryUsed: Math.round(usedMem / 1024 / 1024),
      memoryPercent: Math.round((usedMem / totalMem) * 100),
      loadAvg: os.loadavg().map((l) => Math.round(l * 100) / 100),
    };

    // Database check
    try {
      const start = Date.now();
      await prisma.$queryRaw`SELECT 1`;
      health.database = { status: 'connected', latencyMs: Date.now() - start };
    } catch (err: any) {
      health.database = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    // Redis check
    try {
      const start = Date.now();
      const pong = await redis.ping();
      const info = await redis.info('memory');
      const usedMemory = info.match(/used_memory:(\d+)/)?.[1];
      health.redis = {
        status: pong === 'PONG' ? 'connected' : 'error',
        latencyMs: Date.now() - start,
        usedMemoryMB: usedMemory ? Math.round(parseInt(usedMemory) / 1024 / 1024) : 0,
      };
    } catch (err: any) {
      health.redis = { status: 'error', error: err.message };
      health.status = 'degraded';
    }

    // App stats
    const [totalUsers, totalMessages, activeToday] = await Promise.all([
      prisma.user.count(),
      prisma.message.count(),
      prisma.user.count({ where: { lastSeen: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
    ]);

    health.app = {
      totalUsers,
      totalMessages,
      activeUsers24h: activeToday,
      nodeVersion: process.version,
      pid: process.pid,
    };

    if (health.database.status === 'error' || health.redis.status === 'error') {
      health.status = 'unhealthy';
    }

    return health;
  }

  static async getFeatureFlags() {
    try {
      const stored = await redis.get('admin:feature_flags');
      return stored ? JSON.parse(stored) : DEFAULT_FEATURES;
    } catch {
      return DEFAULT_FEATURES;
    }
  }

  static async setFeatureFlag(flag: string, enabled: boolean) {
    const flags = await this.getFeatureFlags();
    flags[flag] = enabled;
    try {
      await redis.set('admin:feature_flags', JSON.stringify(flags));
    } catch { /* ignore */ }
    return flags;
  }

  static async getMessageStats() {
    const now = new Date();
    const days = 30;
    const stats = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const count = await prisma.message.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      });

      stats.push({ date: date.toISOString().split('T')[0], count });
    }

    return stats;
  }

  static async getUserGrowthStats() {
    const now = new Date();
    const days = 30;
    const stats = [];

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const count = await prisma.user.count({
        where: { createdAt: { gte: date, lt: nextDate } },
      });

      stats.push({ date: date.toISOString().split('T')[0], count });
    }

    return stats;
  }

  static async getStories(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [stories, total] = await Promise.all([
      prisma.story.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { id: true, username: true, displayName: true, avatar: true } },
          _count: { select: { views: true, reactions: true } },
        },
      }),
      prisma.story.count(),
    ]);

    return { stories, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async deleteStory(storyId: string) {
    const story = await prisma.story.findUnique({ where: { id: storyId } });
    if (!story) throw new Error('Story not found');
    await prisma.story.delete({ where: { id: storyId } });
    return { message: 'Story deleted' };
  }

  static async getReports(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [reports, total] = await Promise.all([
      prisma.report.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reporter: { select: { id: true, username: true, displayName: true, avatar: true } },
          reported: { select: { id: true, username: true, displayName: true, avatar: true } },
        },
      }),
      prisma.report.count(),
    ]);

    return { reports, total, page, totalPages: Math.ceil(total / limit) };
  }

  static async resolveReport(reportId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');
    await prisma.report.update({ where: { id: reportId }, data: { resolved: true } });
    return { message: 'Report resolved' };
  }

  static async deleteReport(reportId: string) {
    const report = await prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new Error('Report not found');

    if (report.mediaUrl) {
      const filename = path.basename(report.mediaUrl);
      const filePath = path.join(process.cwd(), 'uploads', filename);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch { /* ignore */ }
    }

    await prisma.report.delete({ where: { id: reportId } });
    return { message: 'Report deleted' };
  }

  static async getDbStats() {
    // Table row counts and sizes
    const tables = [
      'User', 'RefreshToken', 'Conversation', 'GroupInvite', 'Participant',
      'Message', 'PollVote', 'Star', 'Reaction', 'MessageRead', 'MessageDelete',
      'Block', 'Story', 'StoryView', 'StoryReaction', 'Friendship', 'FriendRequest',
      'Report', 'JoinRequest', 'GroupAuditLog', 'Call', 'NotificationQueue',
      'CipherConversation', 'CipherMessage', 'CipherUsage',
    ];

    const tableStats: { name: string; rowCount: number }[] = [];
    for (const table of tables) {
      try {
        const result = await prisma.$queryRawUnsafe(
          `SELECT COUNT(*)::int as count FROM "${table}"`
        ) as any[];
        tableStats.push({ name: table, rowCount: result[0]?.count ?? 0 });
      } catch {
        tableStats.push({ name: table, rowCount: 0 });
      }
    }

    // Database size
    let dbSize = '0 MB';
    let dbSizeBytes = 0;
    try {
      const result = await prisma.$queryRaw`SELECT pg_database_size(current_database()) as size`;
      dbSizeBytes = Number((result as any[])[0]?.size ?? 0);
      dbSize = dbSizeBytes > 1024 * 1024 * 1024
        ? `${(dbSizeBytes / 1024 / 1024 / 1024).toFixed(2)} GB`
        : `${(dbSizeBytes / 1024 / 1024).toFixed(2)} MB`;
    } catch { /* ignore */ }

    // Largest tables by size
    let largestTables: { name: string; size: string }[] = [];
    try {
      const result = await prisma.$queryRaw`
        SELECT
          schemaname || '.' || tablename as name,
          pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) as size
        FROM pg_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC
        LIMIT 10
      `;
      largestTables = result as any[];
    } catch { /* ignore */ }

    // Connection info
    let connectionInfo: any = {};
    try {
      const result = await prisma.$queryRaw`SELECT current_database() as db, current_user as "user", inet_server_addr() as host`;
      connectionInfo = (result as any[])[0] || {};
    } catch { /* ignore */ }

    return {
      totalTables: tableStats.length,
      totalRows: tableStats.reduce((sum, t) => sum + t.rowCount, 0),
      dbSize,
      dbSizeBytes,
      tableStats: tableStats.filter(t => t.rowCount > 0).sort((a, b) => b.rowCount - a.rowCount),
      largestTables,
      connection: connectionInfo,
    };
  }

  static async backupDatabase(targetUrl: string) {
    if (!targetUrl || !targetUrl.startsWith('postgresql://')) {
      throw new Error('Invalid PostgreSQL URL');
    }

    // Validate target connection
    const { Client } = await import('pg');
    const targetClient = new Client({ connectionString: targetUrl });

    try {
      await targetClient.connect();
      logger.info('Backup: Connected to target database');
    } catch (err: any) {
      throw new Error(`Cannot connect to target database: ${err.message}`);
    }

    // Get all tables in order (respect foreign keys)
    const tableOrder = [
      'User', 'Conversation', 'RefreshToken', 'GroupInvite', 'Participant',
      'Message', 'PollVote', 'Star', 'Reaction', 'MessageRead', 'MessageDelete',
      'Block', 'Story', 'StoryView', 'StoryReaction', 'Friendship', 'FriendRequest',
      'Report', 'JoinRequest', 'GroupAuditLog', 'Community', 'CustomRole',
      'CustomRoleMember', 'CommunityEvent', 'CommunityEventAttendee',
      'CommunityRating', 'CommunityAchievement', 'CommunityHighlight',
      'CommunityLeaderboardEntry', 'CommunityAuditLog', 'ModSettings',
      'CommunityBan', 'CommunityReport', 'ModAction', 'Call', 'NotificationQueue',
      'CipherConversation', 'CipherMessage', 'CipherUsage',
    ];

    let totalRowsCopied = 0;
    const tableResults: { table: string; rows: number; status: string }[] = [];

    for (const table of tableOrder) {
      try {
        // Get data from source
        const data = await prisma.$queryRawUnsafe(`SELECT * FROM "${table}"`) as any[];

        if (data.length === 0) {
          tableResults.push({ table, rows: 0, status: 'empty' });
          continue;
        }

        // Get column names from first row
        const columns = Object.keys(data[0]);

        // Drop and recreate table on target
        await targetClient.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);

        // Create table with all columns as TEXT (universal backup)
        const colDefs = columns.map(c => `"${c}" TEXT`).join(', ');
        await targetClient.query(`CREATE TABLE "${table}" (${colDefs})`);

        // Insert data in batches
        const batchSize = 500;
        for (let i = 0; i < data.length; i += batchSize) {
          const batch = data.slice(i, i + batchSize);
          for (const row of batch) {
            const values = columns.map(c => row[c] !== undefined && row[c] !== null ? String(row[c]) : null);
            const placeholders = columns.map((_, idx) => `$${idx + 1}`);
            await targetClient.query(
              `INSERT INTO "${table}" (${columns.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`,
              values
            );
          }
        }

        totalRowsCopied += data.length;
        tableResults.push({ table, rows: data.length, status: 'copied' });
        logger.info(`Backup: Copied ${data.length} rows from ${table}`);
      } catch (err: any) {
        tableResults.push({ table, rows: 0, status: `error: ${err.message}` });
        logger.error(`Backup: Error copying ${table}: ${err.message}`);
      }
    }

    await targetClient.end();

    return {
      message: 'Backup completed',
      totalTables: tableResults.length,
      totalRowsCopied,
      tables: tableResults,
    };
  }
}
