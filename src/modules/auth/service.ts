import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/database';
import { redis } from '../../config/redis';
import { env } from '../../config/env';
import { sendEmail } from '../../utils/email';
import { sendSMS } from '../../utils/sms';
import { logger } from '../../utils/logger';

export class AuthService {
  // Helper to generate and save access & refresh tokens.
  // `device` carries per-session metadata so the session can be listed/revoked.
  // `createdAt` lets token rotation preserve the original sign-in time.
  static async generateTokens(
    userId: string,
    email?: string | null,
    phone?: string | null,
    device?: { userAgent?: string | null; ip?: string | null; createdAt?: Date }
  ) {
    const refreshToken = jwt.sign(
      { id: userId },
      env.JWT_REFRESH_SECRET,
      { expiresIn: '30d' }
    );

    // Save refresh token in DB (expiry 30 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    // Create the refresh row first so we can stamp its id (sid) into the access
    // token, letting the API tell which listed session is the current device.
    const saved = await prisma.refreshToken.create({
      data: {
        userId,
        token: refreshToken,
        expiresAt,
        userAgent: device?.userAgent ?? null,
        ip: device?.ip ?? null,
        ...(device?.createdAt ? { createdAt: device.createdAt } : {}),
      },
    });

    const accessToken = jwt.sign(
      { id: userId, email, phone, sid: saved.id },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '15m' }
    );

    return { accessToken, refreshToken };
  }

  // Send OTP via SMS or Email
  static async sendOtp(target: { email?: string; phone?: string }): Promise<{ success: boolean; message: string }> {
    const destination = target.email || target.phone;
    if (!destination) {
      throw new Error('Destination email or phone is required');
    }

    // Generate 6 digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis with 5 minutes TTL
    await redis.set(`otp:code:${destination}`, code, 'EX', 300);

    if (target.email) {
      const emailHtml = `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <h2>NexChat Verification Code</h2>
          <p>Your verification code is: <strong style="font-size: 24px; color: #4CAF50; letter-spacing: 2px;">${code}</strong></p>
          <p>This code is valid for 5 minutes.</p>
        </div>
      `;
      await sendEmail(target.email, 'Your NexChat Verification Code', emailHtml);
    } else if (target.phone) {
      await sendSMS(target.phone, `Your NexChat verification code is: ${code}. Valid for 5 minutes.`);
    }

    return { success: true, message: `OTP sent successfully to ${destination}` };
  }

  // Verify OTP code
  static async verifyOtp(target: { email?: string; phone?: string; code: string }): Promise<{ success: boolean; message: string }> {
    const destination = target.email || target.phone;
    if (!destination) {
      throw new Error('Destination email or phone is required');
    }

    const cachedCode = await redis.get(`otp:code:${destination}`);
    if (!cachedCode || cachedCode !== target.code) {
      throw new Error('Invalid or expired OTP code');
    }

    // Delete code from Redis
    await redis.del(`otp:code:${destination}`);

    // Mark as verified for 10 minutes (to allow registration/login step)
    await redis.set(`otp:verified:${destination}`, 'true', 'EX', 600);

    return { success: true, message: 'OTP verified successfully' };
  }

  // Register User
  static async register(data: {
    email?: string;
    phone?: string;
    password?: string;
    displayName: string;
    username?: string;
    avatar?: string;
  }, device?: { userAgent?: string | null; ip?: string | null }) {
    const identity = data.email || data.phone;
    if (!identity) {
      throw new Error('Email or phone number is required for registration');
    }

    // Check if user already exists
    if (data.email) {
      const existing = await prisma.user.findUnique({ where: { email: data.email } });
      if (existing) throw new Error('User with this email already exists');
    }
    if (data.phone) {
      const existing = await prisma.user.findUnique({ where: { phone: data.phone } });
      if (existing) throw new Error('User with this phone number already exists');
    }

    // Auto-generate username if not provided
    let username = data.username;
    if (!username) {
      const base = (data.displayName || 'user').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      username = base;
      let tries = 0;
      while (await prisma.user.findUnique({ where: { username } })) {
        tries++;
        username = base + tries;
      }
    } else {
      const existing = await prisma.user.findUnique({ where: { username } });
      if (existing) throw new Error('Username already taken');
    }

    // Check OTP verification if required
    if (env.REQUIRE_OTP_VERIFICATION) {
      const verified = await redis.get(`otp:verified:${identity}`);
      if (verified !== 'true') {
        throw new Error('Please verify OTP before registering');
      }
      // Consume verification token
      await redis.del(`otp:verified:${identity}`);
    }

    const passwordHash = data.password ? await bcrypt.hash(data.password, 10) : undefined;

    // Create user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        phone: data.phone,
        username,
        passwordHash,
        displayName: data.displayName,
        avatar: data.avatar,
      },
    });

    const tokens = await this.generateTokens(user.id, user.email, user.phone, device);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      ...tokens,
    };
  }

  // Login User
  static async login(data: {
    email?: string;
    phone?: string;
    password?: string;
    code?: string;
  }, device?: { userAgent?: string | null; ip?: string | null }) {
    const identity = data.email || data.phone;
    if (!identity) {
      throw new Error('Email or phone number is required to login');
    }

    // Find user
    const user = await prisma.user.findFirst({
      where: data.email ? { email: data.email } : { phone: data.phone },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Handle password login
    if (data.password) {
      if (!user.passwordHash) {
        throw new Error('Password is not set for this account. Please login using OTP.');
      }
      const isMatch = await bcrypt.compare(data.password, user.passwordHash);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }
    } 
    // Handle OTP login
    else if (data.code) {
      if (env.REQUIRE_OTP_VERIFICATION) {
        const verified = await redis.get(`otp:verified:${identity}`);
        if (verified !== 'true') {
          throw new Error('Please verify OTP first');
        }
        await redis.del(`otp:verified:${identity}`);
      }
    } else {
      throw new Error('Password or verification code is required');
    }

    // Remove old sessions from the same device so re-login doesn't
    // accumulate duplicate "fake" entries in the active sessions list.
    if (device?.userAgent) {
      await prisma.refreshToken.deleteMany({
        where: {
          userId: user.id,
          userAgent: device.userAgent,
          expiresAt: { gt: new Date() },
        },
      });
    }

    const tokens = await this.generateTokens(user.id, user.email, user.phone, device);
    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        displayName: user.displayName,
        avatar: user.avatar,
      },
      ...tokens,
    };
  }

  // Refresh tokens
  static async refresh(token: string) {
    // Check if refresh token is in DB
    const savedToken = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!savedToken || savedToken.expiresAt < new Date()) {
      if (savedToken) {
        await prisma.refreshToken.delete({ where: { token } });
      }
      throw new Error('Invalid or expired refresh token');
    }

    // Verify token payload
    try {
      jwt.verify(token, env.JWT_REFRESH_SECRET);
    } catch (err) {
      await prisma.refreshToken.delete({ where: { token } }).catch(() => {});
      throw new Error('Invalid refresh token');
    }

    // Delete old refresh token (token rotation)
    await prisma.refreshToken.delete({ where: { token } });

    // Generate new tokens, preserving this device's identity across rotation.
    const tokens = await this.generateTokens(
      savedToken.userId,
      savedToken.user.email,
      savedToken.user.phone,
      {
        userAgent: savedToken.userAgent,
        ip: savedToken.ip,
        createdAt: savedToken.createdAt,
      }
    );
    return tokens;
  }

  // Logout / revoke refresh token
  static async logout(token: string) {
    try {
      await prisma.refreshToken.delete({ where: { token } });
      return { success: true, message: 'Logged out successfully' };
    } catch (error) {
      throw new Error('Refresh token not found');
    }
  }

  // Forgot password - send reset link
  static async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('No account found with this email address');
    }

    const token = crypto.randomUUID();
    await redis.set(`reset:token:${token}`, email, 'EX', 900);

    const resetLink = `${env.FRONTEND_URL}/reset-password?token=${token}&email=${encodeURIComponent(email)}`;

    logger.info(`[PASSWORD RESET] Reset link sent to ${email}`);

    const emailHtml = `
      <div style="font-family: sans-serif; padding: 20px; color: #333; max-width: 480px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #4CAF50; margin: 0;">NexChat</h1>
        </div>
        <h2 style="color: #333;">Password Reset Request</h2>
        <p style="color: #555; line-height: 1.6;">
          We received a request to reset your password. Click the button below to set a new password.
        </p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${resetLink}"
             style="display: inline-block; padding: 14px 36px; background: #4CAF50; color: white; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
            Reset Password
          </a>
        </div>
        <p style="color: #888; font-size: 13px;">
          This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="color: #aaa; font-size: 12px; text-align: center;">
          If the button doesn't work, copy this link into your browser:<br/>
          <span style="color: #4CAF50;">${resetLink}</span>
        </p>
      </div>
    `;
    await sendEmail(email, 'Reset your NexChat password', emailHtml);

    return { success: true, message: 'Password reset link sent to your email' };
  }

  // Reset password with token
  static async resetPassword(token: string, newPassword: string): Promise<{ success: boolean; message: string }> {
    const email = await redis.get(`reset:token:${token}`);
    if (!email) {
      throw new Error('Invalid or expired reset link');
    }

    await redis.del(`reset:token:${token}`);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new Error('No account found with this email address');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { success: true, message: 'Password reset successfully' };
  }

  // Change password (authenticated user)
  static async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (!user.passwordHash) throw new Error('No password set for this account');

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) throw new Error('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { success: true, message: 'Password changed successfully' };
  }
}
