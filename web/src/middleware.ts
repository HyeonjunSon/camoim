import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE } from '@/lib/session';

/**
 * Auth gating happens here rather than in the pages themselves.
 *
 * A `redirect()` inside a page runs during the render, and once Next has
 * started streaming the shell the status code is already sent — the visitor
 * ends up on a 200 that redirects late, or not at all. Middleware runs before
 * any of that, so a visitor to a members-only page gets a real 307.
 *
 * Only the presence of the session cookie is checked; its validity is the API's
 * business. A forged or expired cookie therefore gets through to the page,
 * which renders as a visitor and keeps its own check as a second line.
 */

/** Signed-in only, whatever the board. */
const PRIVATE_PREFIXES = ['/write', '/intro', '/notifications', '/mypage', '/chat'];

/**
 * Boards closed to visitors: the anonymous board, and every school board
 * (slugged `<school>-free` / `<school>-anonymous`). Derived from the slug alone,
 * so no API call is needed here.
 */
function isPrivateBoardPath(pathname: string): boolean {
  const match = pathname.match(/^\/boards\/([^/]+)/);
  if (!match) return false;
  const slug = decodeURIComponent(match[1]);
  return slug === 'anonymous' || /-(free|anonymous)$/.test(slug);
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  const needsAuth =
    PRIVATE_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    isPrivateBoardPath(pathname) ||
    /^\/posts\/[^/]+\/edit$/.test(pathname);

  if (!needsAuth) return NextResponse.next();
  if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next();

  const login = new URL('/login', req.url);
  login.searchParams.set('next', `${pathname}${search}`);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything but Next's own assets and the BFF routes, which answer 401 on
  // their own rather than redirecting an XHR to an HTML page.
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
