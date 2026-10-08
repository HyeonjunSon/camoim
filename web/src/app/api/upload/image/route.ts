import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';
import { errorResponse, forbiddenCrossOrigin, isSameOrigin } from '@/lib/bff';
import { readSessionToken } from '@/lib/session';

/**
 * Multipart upload to the API's Cloudinary route. The generic BFF proxy only
 * speaks JSON, so this is its own handler.
 *
 * The body is streamed straight through with its original Content-Type, so the
 * multipart boundary survives and no file is ever buffered in this process.
 * Validation stays where it already is: multer caps the size at 10MB and
 * Cloudinary rejects anything that is not one of the allowed image formats
 * (server/routes/posts.js). Files always land in camoim/posts; nothing the
 * browser sends can choose a folder.
 *
 * The browser gets back a Cloudinary URL to embed in the post body — the same
 * flow the app's rich editor uses.
 */
const MAX_BYTES = 10 * 1024 * 1024; // matches multer's limit

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

  // Rejected before the upstream call when the browser declares a size; multer
  // is still the real limit for a chunked request that declares none.
  const declaredLength = Number(req.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_BYTES) {
    return NextResponse.json(
      { success: false, message: '이미지는 10MB까지 올릴 수 있어요.' },
      { status: 413 }
    );
  }

  try {
    const res = await fetch(`${apiBaseUrl()}/posts/upload-image`, {
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
    return NextResponse.json({ success: true, data: { url: payload?.data?.url } });
  } catch (err) {
    return errorResponse(err);
  }
}
