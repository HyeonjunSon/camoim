// The board feed's layout choice, kept in a cookie so the server can render it.
export const FEED_VIEW_COOKIE = 'camoim_feed_view';

export type FeedView = 'card' | 'list';

export function parseFeedView(value: string | undefined): FeedView {
  return value === 'list' ? 'list' : 'card';
}
