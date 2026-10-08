import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin, readJson } from '@/lib/bff';
import { writeSessionToken } from '@/lib/session';
import type { User } from '@/lib/types';

/**
 * The one place a Railway JWT is handled. It goes into the httpOnly cookie and
 * is stripped from the response, so the browser gets the user record only.
 */
export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const { email, password } = await readJson(req);
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    return NextResponse.json(
      { success: false, message: '이메일과 비밀번호를 입력해주세요.' },
      { status: 400 }
    );
  }

  try {
    const data = await apiFetch<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
      auth: false,
    });

    const res = NextResponse.json({ success: true, data: { user: data.user } });
    writeSessionToken(res.cookies, data.token);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
