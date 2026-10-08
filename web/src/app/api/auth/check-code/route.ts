import { NextResponse } from 'next/server';
import { apiFetch } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin, readJson } from '@/lib/bff';

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const body = await readJson(req);
  if (typeof body.email !== 'string' || !body.email) {
    return NextResponse.json(
      { success: false, message: '이메일을 입력해주세요.' },
      { status: 400 }
    );
  }

  try {
    const data = await apiFetch('/auth/check-code', { method: 'POST', body, auth: false });
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return errorResponse(err);
  }
}
