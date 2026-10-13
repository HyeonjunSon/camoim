import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin } from '@/lib/bff';
import { readSessionToken } from '@/lib/session';

/**
 * Avatar upload. Same streaming passthrough as the post-image route, pointed at
 * the API's avatar endpoint so the file lands in camoim/avatars rather than
 * camoim/posts — the folders are kept apart on purpose (CLAUDE.md).
 */
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const token = await readSessionToken();
  if (!token) {
    return NextResponse.json({ success: false, message: '로그인이 필요합니다.' }, { status: 401 });
  }

  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.startsWith('multipart/form-data')) {
    return NextResponse.json({ success: false, message: '잘못된 요청입니다.' }, { status: 400 });
  }
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BYTES) {
    return NextResponse.json(
      { success: false, message: '이미지는 10MB까지 올릴 수 있어요.' },
      { status: 413 }
    );
  }

  try {
    const res = await fetch(`${apiBaseUrl()}/users/me/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: req.body,
      duplex: 'half',
      cache: 'no-store',
    } as RequestInit & { duplex: 'half' });

    const payload = await res.json().catch(() => null);
    if (!res.ok || payload?.success === false) {
      return NextResponse.json(
        { success: false, message: payload?.message || '업로드에 실패했어요.' },
        { status: res.status }
      );
    }
    return NextResponse.json(payload);
  } catch (err) {
    return errorResponse(err);
  }
}
