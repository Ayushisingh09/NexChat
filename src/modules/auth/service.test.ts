import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock external singletons before importing the service under test.
// `vi.hoisted` lets these be referenced inside the hoisted vi.mock factories.
const { prismaMock, redisMock, sendEmailMock, sendSmsMock } = vi.hoisted(() => ({
  prismaMock: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    refreshToken: { deleteMany: vi.fn() },
  },
  redisMock: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
  sendEmailMock: vi.fn(),
  sendSmsMock: vi.fn(),
}));

vi.mock('../../config/database', () => ({ prisma: prismaMock }));
vi.mock('../../config/redis', () => ({ redis: redisMock }));
vi.mock('../../utils/email', () => ({ sendEmail: sendEmailMock }));
vi.mock('../../utils/sms', () => ({ sendSMS: sendSmsMock }));
vi.mock('../../config/env', () => ({
  env: {
    JWT_ACCESS_SECRET: 'test-access',
    JWT_REFRESH_SECRET: 'test-refresh',
    CLIENT_URL: 'http://localhost:5173',
    REQUIRE_OTP_VERIFICATION: true,
  },
}));

import { AuthService } from './service';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('forgotPassword', () => {
  it('emails a reset link and stores a token when the user exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });

    const result = await AuthService.forgotPassword('a@example.com');

    // A token is stored in Redis with a 30-minute TTL...
    expect(redisMock.set).toHaveBeenCalledTimes(1);
    const [key, value, ex, ttl] = redisMock.set.mock.calls[0];
    expect(key).toMatch(/^reset:token:/);
    expect(value).toBe('user-1');
    expect(ex).toBe('EX');
    expect(ttl).toBe(1800);
    // ...and an email is sent containing that exact token link.
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const html = sendEmailMock.mock.calls[0][2] as string;
    const token = key.replace('reset:token:', '');
    expect(html).toContain(`/reset-password?token=${token}`);
    expect(result.success).toBe(true);
  });

  it('does not reveal whether an account exists (no enumeration)', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', email: 'a@example.com' });
    const hit = await AuthService.forgotPassword('a@example.com');

    prismaMock.user.findUnique.mockResolvedValue(null);
    const miss = await AuthService.forgotPassword('nobody@example.com');

    // Identical response regardless of existence...
    expect(miss.message).toBe(hit.message);
    expect(miss.success).toBe(true);
    // ...and no token/email side effects for the non-existent account.
    expect(redisMock.set).toHaveBeenCalledTimes(1); // only the existing-user call
    expect(sendEmailMock).toHaveBeenCalledTimes(1);
  });
});

describe('resetPassword', () => {
  it('rejects a missing or expired token', async () => {
    redisMock.get.mockResolvedValue(null);

    await expect(AuthService.resetPassword('bad-token', 'newpass123')).rejects.toThrow(
      /invalid or expired/i
    );
    expect(prismaMock.user.update).not.toHaveBeenCalled();
  });

  it('hashes the password, consumes the token, and revokes sessions', async () => {
    redisMock.get.mockResolvedValue('user-1');
    prismaMock.user.update.mockResolvedValue({ id: 'user-1' });
    prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 2 });

    const result = await AuthService.resetPassword('good-token', 'newpass123');

    // Password is updated with a bcrypt hash (not the plaintext)...
    expect(prismaMock.user.update).toHaveBeenCalledTimes(1);
    const updateArg = prismaMock.user.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: 'user-1' });
    expect(updateArg.data.passwordHash).toBeTypeOf('string');
    expect(updateArg.data.passwordHash).not.toBe('newpass123');
    // ...the token is single-use (deleted)...
    expect(redisMock.del).toHaveBeenCalledWith('reset:token:good-token');
    // ...and existing sessions are revoked.
    expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(result.success).toBe(true);
  });
});

describe('verifyOtp', () => {
  it('rejects an incorrect code', async () => {
    redisMock.get.mockResolvedValue('123456');
    await expect(AuthService.verifyOtp({ email: 'a@example.com', code: '000000' })).rejects.toThrow(
      /invalid or expired/i
    );
  });

  it('rejects when no code is cached (expired)', async () => {
    redisMock.get.mockResolvedValue(null);
    await expect(AuthService.verifyOtp({ email: 'a@example.com', code: '123456' })).rejects.toThrow(
      /invalid or expired/i
    );
  });

  it('accepts a matching code and marks the destination verified', async () => {
    redisMock.get.mockResolvedValue('123456');
    const result = await AuthService.verifyOtp({ email: 'a@example.com', code: '123456' });

    expect(redisMock.del).toHaveBeenCalledWith('otp:code:a@example.com');
    expect(redisMock.set).toHaveBeenCalledWith('otp:verified:a@example.com', 'true', 'EX', 600);
    expect(result.success).toBe(true);
  });
});
