import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin, readJson } from '@/lib/bff';

/**
 * Authenticated passthrough to the Railway API for client components.
 *
 * The browser sends no token at all; this handler attaches the one in the
 * httpOnly cookie. Authorisation stays where it already is — on the API — so
 * nothing is re-implemented here. Two things are enforced:
 *
 *  1. Writes must be same-origin (CSRF).
 *  2. Endpoints that mint a JWT are blocked, so a token can never be returned
 *     into page JavaScript. Those have their own handlers under /api/auth.
 */
const TOKEN_MINTING = [
  'auth/login',
  'auth/register',
  'auth/apple',
  'auth/google',
  'auth/social-complete',
  // Must go through /api/auth/logout, which also drops the cookie.
  'auth/logout',
];

type Ctx = { params: Promise<{ path: string[] }> };

async function handle(req: Request, ctx: Ctx, method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE') {
  if (method !== 'GET' && !isSameOrigin(req)) return forbiddenCrossOrigin();

  const { path } = await ctx.params;
  const joined = path.join('/');

  if (joined.includes('..')) {
    return NextResponse.json({ success: false, message: '잘못된 경로입니다.' }, { status: 400 });
  }
  if (TOKEN_MINTING.some((blocked) => joined === blocked)) {
    return NextResponse.json({ success: false, message: '허용되지 않은 경로입니다.' }, { status: 403 });
  }

  const search = new URL(req.url).search;
  const body = method === 'GET' ? undefined : await readJson(req);

  try {
    const data = await apiFetch(`/${joined}${search}`, { method, body });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}

export const GET = (req: Request, ctx: Ctx) => handle(req, ctx, 'GET');
export const POST = (req: Request, ctx: Ctx) => handle(req, ctx, 'POST');
export const PUT = (req: Request, ctx: Ctx) => handle(req, ctx, 'PUT');
export const PATCH = (req: Request, ctx: Ctx) => handle(req, ctx, 'PATCH');
export const DELETE = (req: Request, ctx: Ctx) => handle(req, ctx, 'DELETE');
