import 'server-only';
import { cookies } from 'next/headers';

// The Railway JWT lives here and nowhere else. It is httpOnly, so page scripts
// cannot read it; only route handlers and server components forward it as a
// Bearer token. An XSS hole in the post renderer therefore cannot exfiltrate a
// 30-day token, which is the whole reason the BFF exists.
export const SESSION_COOKIE = 'camoim_session';

// Matches the server's jwt expiresIn: '30d' (routes/auth.js).
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export async function readSessionToken(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(SESSION_COOKIE)?.value ?? null;
}

type CookieSink = {
  set(name: string, value: string, options: Record<string, unknown>): unknown;
  delete(name: string): unknown;
};

const baseOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
};

export function writeSessionToken(sink: CookieSink, token: string): void {
  sink.set(SESSION_COOKIE, token, { ...baseOptions, maxAge: MAX_AGE_SECONDS });
}

export function clearSessionToken(sink: CookieSink): void {
  sink.delete(SESSION_COOKIE);
}
