import { describe, it, expect } from 'vitest';
import { messageVisibilityWhere } from './visibility';

const NOW = new Date('2026-06-14T12:00:00.000Z');

describe('messageVisibilityWhere', () => {
  it('always excludes messages the viewer deleted-for-me', () => {
    const where = messageVisibilityWhere({ conversationId: 'c1', currentUserId: 'u1', now: NOW });
    expect(where.deletedFromUsers).toEqual({ none: { userId: 'u1' } });
  });

  it('hides expired messages: keeps null-expiry or future-expiry only', () => {
    const where = messageVisibilityWhere({ conversationId: 'c1', currentUserId: 'u1', now: NOW });
    expect(where.OR).toEqual([{ expiresAt: null }, { expiresAt: { gt: NOW } }]);
  });

  it('scopes to the given conversation id', () => {
    const where = messageVisibilityWhere({ conversationId: 'c1', currentUserId: 'u1', now: NOW });
    expect(where.conversationId).toBe('c1');
  });

  it('supports a multi-conversation filter for global search', () => {
    const where = messageVisibilityWhere({
      conversationId: { in: ['c1', 'c2'] },
      currentUserId: 'u1',
      now: NOW,
    });
    expect(where.conversationId).toEqual({ in: ['c1', 'c2'] });
  });

  it('omits conversationId when not provided', () => {
    const where = messageVisibilityWhere({ currentUserId: 'u1', now: NOW });
    expect('conversationId' in where).toBe(false);
  });

  it('excludes parked scheduled messages only when asked', () => {
    expect(messageVisibilityWhere({ currentUserId: 'u1', now: NOW }).scheduledAt).toBeUndefined();
    expect(
      messageVisibilityWhere({ currentUserId: 'u1', excludeScheduled: true, now: NOW }).scheduledAt
    ).toBeNull();
  });

  it('defaults "now" to the current time when omitted', () => {
    const before = Date.now();
    const where = messageVisibilityWhere({ currentUserId: 'u1' });
    const after = Date.now();
    const gt = (where.OR as Array<{ expiresAt?: { gt: Date } }>)[1].expiresAt!.gt;
    expect(gt.getTime()).toBeGreaterThanOrEqual(before);
    expect(gt.getTime()).toBeLessThanOrEqual(after);
  });
});
