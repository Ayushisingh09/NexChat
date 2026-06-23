// Remembers each conversation's scroll position so re-opening a chat lands
// exactly where you left it instead of jumping. Module-level so it survives the
// per-conversation remount of <ChatWindow> (which is keyed by conversation id).

export interface ScrollState {
  top: number;
  atBottom: boolean;
}

const positions = new Map<string, ScrollState>();

export const saveScrollState = (conversationId: string, state: ScrollState): void => {
  positions.set(conversationId, state);
};

export const getScrollState = (conversationId: string): ScrollState | undefined =>
  positions.get(conversationId);

export const clearScrollState = (conversationId: string): void => {
  positions.delete(conversationId);
};
