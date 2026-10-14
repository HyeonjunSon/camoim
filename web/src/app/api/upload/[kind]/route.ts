import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin } from '@/lib/bff';
import { readSessionToken } from '@/lib/session';

/**
 * Image upload, for every kind of image the product stores.
 *
 * The body is streamed straight through with its original Content-Type, so the
 * multipart boundary survives and no file is buffered in this process. That also
 * sidesteps a types clash: `Request.formData()` resolves to an empty type under
 * @types/node with lib.dom in play.
 *
 * The upstream path is chosen from this map and never from the request, which is
 * what keeps each kind in its own Cloudinary folder — posts, avatars, verify and
 * groups are deliberately kept apart (CLAUDE.md). Validation stays upstream:
 * multer caps the size and Cloudinary rejects anything that is not an image.
 */
const UPSTREAM: Record<string, string> = {
  post: '/posts/upload-image',
  avatar: '/users/me/avatar',
  stay: '/stays/upload-image',
  business: '/businesses/upload-image',
  intro: '/intro/upload-image',
};

const MAX_BYTES = 10 * 1024 * 1024; // matches multer's limit

type Ctx = { params: Promise<{ kind: string }> };

export async function POST(req: Request, ctx: Ctx) {
  if (!isSameOrigin(req)) return forbiddenCrossOrigin();

  const { kind } = await ctx.params;
  const upstream = UPSTREAM[kind];
  if (!upstream) {
    return NextResponse.json({ success: false, message: '알 수 없는 업로드 경로입니다.' }, { status: 404 });
  }

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
    const res = await fetch(`${apiBaseUrl()}${upstream}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: req.body,
      // Required by undici whenever the body is a stream.
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
    // Shapes differ per endpoint (`data.url`, `data.avatarUrl`, bare `url`), so
    // the whole payload is forwarded and the caller reads what it needs.
    return NextResponse.json(payload);
  } catch (err) {
    return errorResponse(err);
  }
}
