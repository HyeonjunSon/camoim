import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin, readJson } from '@/lib/bff';
import { writeSessionToken } from '@/lib/session';
import type { User } from '@/lib/types';

// ALLOWED_SIGNUP_ROLES in server/routes/auth.js.
const ALLOWED_ROLES = ['student', 'working_holiday', 'general'];

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const { email, password, nickname, role, city } = await readJson(req);
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof nickname !== 'string' ||
    typeof role !== 'string' ||
    !ALLOWED_ROLES.includes(role)
  ) {
    return NextResponse.json(
      { success: false, message: '입력값을 확인해주세요.' },
      { status: 400 }
    );
  }

  try {
    const data = await apiFetch<{ token: string; user: User }>('/auth/register', {
      method: 'POST',
      body: { email, password, nickname, role, city },
      auth: false,
    });

    const res = NextResponse.json({ success: true, data: { user: data.user } });
    writeSessionToken(res.cookies, data.token);
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
