import 'server-only';
import { apiFetch } from './api';
import { readSessionToken } from './session';
import type { User } from './types';

/**
 * The signed-in user, or null.
 *
 * A failed /auth/me never throws: the page just renders as a visitor. This
 * mirrors the app's session rule (src/lib/session.js) — only a real auth
 * failure ends a session, a network blip or a 5xx does not.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!(await readSessionToken())) return null;
  try {
    return await apiFetch<User>('/auth/me');
  } catch {
    return null;
  }
}
