import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError } from './api';

/**
 * CSRF guard for the BFF.
 *
 * The session cookie is SameSite=Lax, which already stops cross-site form posts,
 * but a browser will still attach it to a top-level navigation. Comparing Origin
 * to Host costs nothing and makes every state-changing call explicitly same-origin.
 * Host is used rather than a configured site URL so localhost and Vercel preview
 * deployments work without extra configuration.
 */
export function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get('origin');
  const host = req.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function forbiddenCrossOrigin() {
  return NextResponse.json(
    { success: false, message: '잘못된 요청입니다.' },
    { status: 403 }
  );
}

/** Turns an ApiError back into the envelope shape the browser expects. */
export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return NextResponse.json(
      { success: false, message: err.message, code: err.code },
      { status: err.status }
    );
  }
  console.error('[bff]', err);
  return NextResponse.json(
    { success: false, message: '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.' },
    { status: 502 }
  );
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
