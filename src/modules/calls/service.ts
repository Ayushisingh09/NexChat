import { AccessToken, WebhookReceiver } from 'livekit-server-sdk';
import { env } from '../../config/env';

const EMPTY_TIMEOUT = 120_000; // 120 seconds before room self-destructs

export class CallService {
  static async generateToken(identity: string, roomName: string): Promise<string> {
    const at = new AccessToken(env.LIVEKIT_API_KEY!, env.LIVEKIT_API_SECRET!, {
      identity,
      ttl: '5m',
    });
    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });
    return at.toJwt();
  }

  static generateRoomName(callerId: string, calleeId: string): string {
    const sorted = [callerId, calleeId].sort().join('__');
    return `${sorted}__${Date.now()}`;
  }

  static formatCallDuration(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  static get emptyTimeout() {
    return EMPTY_TIMEOUT;
  }
}

export const webhookReceiver = new WebhookReceiver(
  env.LIVEKIT_API_KEY!,
  env.LIVEKIT_API_SECRET!
);
