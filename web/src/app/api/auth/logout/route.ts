import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { forbiddenCrossOrigin, isSameOrigin } from '@/lib/bff';
import { clearSessionToken } from '@/lib/session';

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  // The server bumps tokenVersion, which revokes this token everywhere —
  // including the phone, same as the app's logout. Failures are ignored: the
  // cookie must be dropped either way so the browser is not left half logged in.
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch {
    // intentionally ignored
  }

  const res = NextResponse.json({ success: true });
  clearSessionToken(res.cookies);
  return res;
}
