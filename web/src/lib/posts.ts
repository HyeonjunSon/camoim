import 'server-only';
import { apiFetch, apiFetchOrNull } from './api';
import type { Board } from './types';

/**
 * The API addresses boards by ObjectId (`/boards/:boardId/posts`), while the web
 * uses the slug in its URLs so a link reads and survives. The board list is
 * needed for the sidebar anyway, so the slug is resolved from it rather than
 * costing a lookup of its own.
 */
export async function loadBoards(): Promise<Board[]> {
  return (await apiFetchOrNull<Board[]>('/boards', { revalidate: 300 })) ?? [];
}

export function findBoard(boards: Board[], slug: string): Board | undefined {
  return boards.find((b) => b.slug === slug);
}

export type BoardPostsResponse = {
  posts: import('./types').PostSummary[];
  total: number;
};

export function boardPostsPath(
  boardId: string,
  params: { page?: number; sort?: string; city?: string; search?: string; tradeStatus?: string }
): string {
  const query = new URLSearchParams({ page: String(params.page ?? 1) });
  if (params.sort && params.sort !== 'latest') query.set('sort', params.sort);
  if (params.city) query.set('city', params.city);
  if (params.search) query.set('search', params.search);
  if (params.tradeStatus) query.set('tradeStatus', params.tradeStatus);
  return `/boards/${boardId}/posts?${query}`;
}

export { apiFetch };
