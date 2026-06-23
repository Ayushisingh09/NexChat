import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock livekit-server-sdk
const mockToJwt = vi.fn().mockResolvedValue('mock-jwt-token');
const mockAddGrant = vi.fn();

vi.mock('livekit-server-sdk', () => ({
  AccessToken: class {
    addGrant = mockAddGrant;
    toJwt = mockToJwt;
  },
  WebhookReceiver: class {
    receive = vi.fn().mockResolvedValue({ event: 'room_started' });
  },
}));

vi.mock('../../config/env', () => ({
  env: {
    LIVEKIT_API_KEY: 'test-api-key',
    LIVEKIT_API_SECRET: 'test-api-secret',
    LIVEKIT_HOST: 'wss://test.livekit.cloud',
  },
}));

vi.mock('../../utils/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { CallService } from './service';

describe('CallService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateToken', () => {
    it('should generate a JWT token for a given identity and room', async () => {
      const token = await CallService.generateToken('user-123', 'room-abc');
      expect(token).toBe('mock-jwt-token');
      expect(mockAddGrant).toHaveBeenCalledWith({
        roomJoin: true,
        room: 'room-abc',
        canPublish: true,
        canSubscribe: true,
      });
    });
  });

  describe('generateRoomName', () => {
    it('should generate a deterministic room name from two user IDs', () => {
      const room1 = CallService.generateRoomName('aaa', 'bbb');
      const room2 = CallService.generateRoomName('bbb', 'aaa');
      expect(room1).toBe(room2);
      expect(room1).toBe('aaa__bbb');
    });

    it('should handle same user IDs', () => {
      const room = CallService.generateRoomName('user-a', 'user-a');
      expect(room).toBe('user-a__user-a');
    });
  });

  describe('formatCallDuration', () => {
    it('should format seconds only', () => {
      expect(CallService.formatCallDuration(45)).toBe('45s');
    });

    it('should format minutes only', () => {
      expect(CallService.formatCallDuration(120)).toBe('2m');
    });

    it('should format minutes and seconds', () => {
      expect(CallService.formatCallDuration(125)).toBe('2m 5s');
    });

    it('should format zero duration', () => {
      expect(CallService.formatCallDuration(0)).toBe('0s');
    });
  });

  describe('emptyTimeout', () => {
    it('should be 120 seconds (120000ms)', () => {
      expect(CallService.emptyTimeout).toBe(120_000);
    });
  });
});
