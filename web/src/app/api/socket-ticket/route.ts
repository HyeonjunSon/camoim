import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin } from '@/lib/bff';

/**
 * Hands the browser a short-lived ticket for its Socket.io handshake.
 *
 * Chat is the one thing the BFF cannot carry: a WebSocket to Railway is a
 * different origin, so the httpOnly cookie never reaches it, and Vercel will not
 * proxy a socket. So the browser connects to Railway directly, and this is the
 * only credential it is given — scoped to 'socket' and good for two minutes, so
 * it cannot be replayed against the REST API (server/middleware/auth.js refuses
 * a 'socket' scope outright).
 *
 * Deliberately not reachable through the generic BFF proxy, which blocks every
 * token-minting path; the exchange happens here, server-side, using the cookie.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  try {
    const data = await apiFetch<{ ticket: string; expiresInSeconds: number }>(
      '/auth/socket-ticket',
      { method: 'POST' }
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
