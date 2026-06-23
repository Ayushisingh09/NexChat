/**
 * Shared message-visibility filter.
 *
 * These rules protect messaging invariants and are applied identically
 * across message list, in-conversation search, media gallery, and global search.
 * Centralising them here keeps the four call sites in lockstep and makes the
 * rules unit-testable without a database.
 *
 * A message is visible to a viewer when:
 *  - it has NOT been deleted-for-me by the viewer (`deletedFromUsers`), and
 *  - it has not expired (no `expiresAt`, or `expiresAt` is still in the future).
 *
 * Callers layer their own additional constraints on top (e.g. `isDeleted: false`,
 * `content` match, `clearedAt` cutoff). `excludeScheduled` drops parked scheduled
 * sends, which list/global-search want but media/in-convo search historically do not.
 */
export interface MessageVisibilityOpts {
  /** A single conversation id, or `{ in: [...] }` for global search. */
  conversationId?: string | { in: string[] };
  /** The viewer whose per-user deletions are honoured. */
  currentUserId: string;
  /** When true, adds `scheduledAt: null` to hide parked scheduled messages. */
  excludeScheduled?: boolean;
  /** Override "now" for deterministic tests; defaults to the current time. */
  now?: Date;
}

export function messageVisibilityWhere(opts: MessageVisibilityOpts): Record<string, unknown> {
  const now = opts.now ?? new Date();

  const where: Record<string, unknown> = {
    deletedFromUsers: {
      none: { userId: opts.currentUserId },
    },
    OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
  };

  if (opts.conversationId !== undefined) where.conversationId = opts.conversationId;
  if (opts.excludeScheduled) where.scheduledAt = null;

  return where;
}
