import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('../../config/database', () => ({
  prisma: {
    call: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('../../config/env', () => ({
  env: {
    LIVEKIT_API_KEY: 'test-key',
    LIVEKIT_API_SECRET: 'test-secret',
    LIVEKIT_HOST: 'wss://test.livekit.cloud',
    CALL_TIMEOUT_MS: 30000,
  },
}));

vi.mock('./service', () => ({
  CallService: {
    generateToken: vi.fn().mockResolvedValue('mock-token'),
    generateRoomName: vi.fn().mockReturnValue('user-a__user-b'),
    formatCallDuration: vi.fn().mockReturnValue('1m 30s'),
    emptyTimeout: 120000,
  },
  webhookReceiver: {
    receive: vi.fn(),
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../utils/response', () => ({
  successResponse: vi.fn((res, msg, data) => res.json({ success: true, message: msg, data })),
  errorResponse: vi.fn((res, msg, data, status) => res.status(status).json({ success: false, message: msg, data })),
}));

import { CallController } from './controller';
import { prisma } from '../../config/database';
import { CallService, webhookReceiver } from './service';

const mockIo = {
  to: vi.fn().mockReturnThis(),
  emit: vi.fn(),
};

const mockReq = (overrides: any = {}) => ({
  user: { id: 'user-a', displayName: 'Alice', avatar: 'alice.jpg' },
  body: {},
  params: {},
  app: { get: vi.fn().mockReturnValue(mockIo) },
  headers: {},
  ...overrides,
}) as any;

const mockRes = () => {
  const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  return res;
};

const mockNext = vi.fn();

describe('CallController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initiate (lazy token)', () => {
    it('should NOT generate tokens on initiate — tokens are lazy', async () => {
      (prisma.user.findUnique as any).mockResolvedValueOnce({ id: 'user-b', displayName: 'Bob', avatar: 'bob.jpg' });
      (prisma.call.findFirst as any).mockResolvedValueOnce(null); // no ongoing for caller
      (prisma.call.findFirst as any).mockResolvedValueOnce(null); // no ongoing for callee
      (prisma.call.create as any).mockResolvedValueOnce({ id: 'call-1', roomName: 'user-a__user-b' });
      (prisma.user.findUnique as any).mockResolvedValueOnce({ id: 'user-a', displayName: 'Alice', avatar: 'alice.jpg' });

      const req = mockReq({ body: { userId: 'user-b' } });
      const res = mockRes();

      await CallController.initiate(req, res, mockNext);

      // Token should NOT have been generated during initiate
      expect(CallService.generateToken).not.toHaveBeenCalled();

      // Socket events should have been emitted without tokens
      expect(mockIo.emit).toHaveBeenCalledWith('call:invite', expect.not.objectContaining({ token: expect.any(String) }));
      expect(mockIo.emit).toHaveBeenCalledWith('call:ringing', expect.not.objectContaining({ token: expect.any(String) }));
    });
  });

  describe('accept (lazy token)', () => {
    it('should generate tokens ONLY on accept', async () => {
      (prisma.call.findUnique as any).mockResolvedValueOnce({
        id: 'call-1',
        calleeId: 'user-b',
        callerId: 'user-a',
        roomName: 'user-a__user-b',
        status: 'RINGING',
      });
      (prisma.call.update as any).mockResolvedValueOnce({});

      const req = mockReq({ user: { id: 'user-b' }, params: { callId: 'call-1' } });
      const res = mockRes();

      await CallController.accept(req, res, mockNext);

      // Tokens should have been generated for BOTH users
      expect(CallService.generateToken).toHaveBeenCalledTimes(2);
      expect(CallService.generateToken).toHaveBeenCalledWith('user-a', 'user-a__user-b');
      expect(CallService.generateToken).toHaveBeenCalledWith('user-b', 'user-a__user-b');

      // Both parties should receive tokens via socket
      expect(mockIo.emit).toHaveBeenCalledWith('call:accepted', expect.objectContaining({
        callId: 'call-1',
        token: 'mock-token',
      }));
    });
  });

  describe('webhook', () => {
    it('should handle room_finished event', async () => {
      const mockEvent = { event: 'room_finished', room: { name: 'user-a__user-b' } };
      (webhookReceiver.receive as any).mockResolvedValue(mockEvent);
      (prisma.call.findFirst as any).mockResolvedValueOnce({
        id: 'call-1',
        status: 'ONGOING',
        startedAt: new Date(Date.now() - 90000), // 90 seconds ago
      });
      (prisma.call.update as any).mockResolvedValueOnce({});

      const req = { body: {}, headers: { authorization: 'Bearer test' } } as any;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

      await CallController.webhook(req, res);

      expect(res.json).toHaveBeenCalledWith({ ok: true });
      expect(prisma.call.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ status: 'ENDED' }),
      }));
    });

    it('should always return 200 even on error', async () => {
      (webhookReceiver.receive as any).mockRejectedValue(new Error('Invalid signature'));

      const req = { body: {}, headers: {} } as any;
      const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as any;

      await CallController.webhook(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('reject', () => {
    it('should update status to REJECTED and emit to caller', async () => {
      (prisma.call.findUnique as any).mockResolvedValueOnce({
        id: 'call-1',
        calleeId: 'user-b',
        callerId: 'user-a',
        roomName: 'user-a__user-b',
        status: 'RINGING',
      });
      (prisma.call.update as any).mockResolvedValueOnce({});

      const req = mockReq({ user: { id: 'user-b' }, params: { callId: 'call-1' } });
      const res = mockRes();

      await CallController.reject(req, res, mockNext);

      expect(prisma.call.update).toHaveBeenCalledWith({
        where: { id: 'call-1' },
        data: { status: 'REJECTED' },
      });
      expect(mockIo.emit).toHaveBeenCalledWith('call:rejected', {
        callId: 'call-1',
        roomName: 'user-a__user-b',
      });
    });
  });

  describe('end', () => {
    it('should compute duration and update to ENDED', async () => {
      const startedAt = new Date(Date.now() - 125000); // 125 seconds ago
      (prisma.call.findUnique as any).mockResolvedValueOnce({
        id: 'call-1',
        callerId: 'user-a',
        calleeId: 'user-b',
        roomName: 'user-a__user-b',
        status: 'ONGOING',
        startedAt,
      });
      (prisma.call.update as any).mockResolvedValueOnce({});

      const req = mockReq({ params: { callId: 'call-1' } });
      const res = mockRes();

      await CallController.end(req, res, mockNext);

      expect(prisma.call.update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          status: 'ENDED',
          duration: expect.any(Number),
        }),
      }));
    });
  });

  describe('token (reconnection)', () => {
    it('should generate a fresh token for reconnection', async () => {
      (prisma.call.findUnique as any).mockResolvedValueOnce({
        id: 'call-1',
        callerId: 'user-a',
        calleeId: 'user-b',
        roomName: 'user-a__user-b',
        status: 'ONGOING',
      });

      const req = mockReq({ params: { callId: 'call-1' } });
      const res = mockRes();

      await CallController.token(req, res, mockNext);

      expect(CallService.generateToken).toHaveBeenCalledWith('user-a', 'user-a__user-b');
    });
  });
});
