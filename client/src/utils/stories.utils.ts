import type { StoryFeedGroup } from '../api/stories.api';

/**
 * Single source of truth for story-feed ordering.
 *
 * The stories bar and the story viewer must agree on order, otherwise the
 * left/right traversal in the viewer won't match the visual tap order in the
 * bar. Both call this so the index passed from the bar indexes the same array
 * the viewer navigates.
 *
 * Order: the current user's own group first (if any), then everyone else with
 * unseen stories ahead of fully-seen ones, most recent first within each.
 */
export const orderStoryFeed = (
  feed: StoryFeedGroup[],
  currentUserId: string | undefined
): StoryFeedGroup[] => {
  const myGroup = feed.find((g) => g.userId === currentUserId);
  const others = feed.filter((g) => g.userId !== currentUserId);

  const lastCreatedAt = (g: StoryFeedGroup) =>
    new Date(g.stories[g.stories.length - 1]?.createdAt ?? 0).getTime();

  const sortedOthers = [...others].sort((a, b) => {
    const aHasUnseen = a.stories.some((s) => !s.viewed);
    const bHasUnseen = b.stories.some((s) => !s.viewed);
    if (aHasUnseen !== bHasUnseen) return aHasUnseen ? -1 : 1;
    return lastCreatedAt(b) - lastCreatedAt(a);
  });

  return myGroup ? [myGroup, ...sortedOthers] : sortedOthers;
};
