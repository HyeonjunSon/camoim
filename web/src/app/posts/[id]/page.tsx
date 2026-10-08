import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound, redirect } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import PostActions from '@/components/PostActions';
import Comments from '@/components/Comments';
import PostOwnerMenu from '@/components/PostOwnerMenu';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { sanitizePostHtml } from '@/lib/sanitize';
import { boardTone, cityLabel, isTradeBoard, tradeLabel } from '@/lib/boards';
import { initial, timeAgo } from '@/lib/format';
import type { CommentNode, PostDetail } from '@/lib/types';

type Params = { params: Promise<{ id: string }> };

/** Boards whose posts must not be indexed, mirroring the board feed's rule. */
function isPrivateBoardSlug(slug?: string): boolean {
  return slug === 'anonymous' || !!slug?.match(/-(free|anonymous)$/);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const post = await apiFetchOrNull<PostDetail>(`/posts/${id}`);
  if (!post) return { title: '게시글' };

  // A group post is members-only and an anonymous board is private; neither
  // belongs in a search index or a link preview.
  const hidden = isPrivateBoardSlug(post.boardSlug) || !!post.groupId;
  return {
    title: post.title,
    description: post.content
      ? post.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)
      : undefined,
    robots: hidden ? { index: false, follow: false } : undefined,
    openGraph: hidden
      ? undefined
      : {
          title: post.title,
          images: post.images?.[0] ? [post.images[0]] : undefined,
        },
  };
}

export default async function PostDetailPage({ params }: Params) {
  const { id } = await params;
  const user = await getCurrentUser();

  let post: PostDetail;
  try {
    post = await apiFetch<PostDetail>(`/posts/${id}`);
  } catch (err) {
    if (err instanceof ApiError) {
      // 401/403 is a members-only group post or one auto-hidden by reports.
      if (err.status === 401 && !user) redirect(`/login?next=${encodeURIComponent(`/posts/${id}`)}`);
      if (err.status === 404 || err.status === 403 || err.status === 401) notFound();
    }
    throw err;
  }

  const comments = (await apiFetchOrNull<CommentNode[]>(`/posts/${id}/comments`)) ?? [];

  const tone = boardTone(post.boardSlug);
  const showTrade = isTradeBoard(post.boardSlug) && post.tradeStatus;
  const sold = post.tradeStatus === 'sold';
  const isMine = !!user && !!post.authorId && post.authorId === user.id;
  const anonymousBoard = post.isAnonymous;

  // The body is written by another user through the app's editor; nothing
  // reaches the DOM without going through the allowlist first.
  const safeHtml = sanitizePostHtml(post.content);

  return (
    <>
      <SiteHeader user={user} active="boards" />

      <div className="mx-auto max-w-[1240px] px-4 pb-16 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex flex-wrap gap-2 text-[13.5px] text-muted">
          <Link href="/" className="hover:text-ink-3">
            홈
          </Link>
          <span aria-hidden>›</span>
          {post.boardSlug ? (
            <Link href={`/boards/${post.boardSlug}`} className="hover:text-ink-3">
              {post.boardName}
            </Link>
          ) : (
            <span>{post.groupName ?? '모임'}</span>
          )}
          {post.city ? (
            <>
              <span aria-hidden>›</span>
              <span className="text-ink">{cityLabel(post.city)}</span>
            </>
          ) : null}
        </nav>

        <div className="flex flex-wrap items-start gap-6">
          <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
            <article className="rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
              <div className="flex flex-wrap items-center gap-2">
                {post.boardName ? (
                  <span
                    className="rounded-md px-2 py-1 text-[12.5px] font-semibold"
                    style={{ color: tone.fg, background: tone.bg }}
                  >
                    {post.boardName}
                  </span>
                ) : null}
                {showTrade ? (
                  <span
                    className={`rounded-md px-2 py-1 text-[12.5px] font-bold ${
                      sold ? 'bg-[#EDEDF0] text-ink-3' : 'bg-positive-tint text-positive'
                    }`}
                  >
                    {tradeLabel(post.boardSlug, sold ? 'sold' : 'selling')}
                  </span>
                ) : null}
                {post.pinned ? (
                  <span className="rounded-md bg-brand-tint px-2 py-1 text-[12.5px] font-bold text-brand-ink-hover">
                    고정
                  </span>
                ) : null}
              </div>

              <h1 className="mt-3.5 text-[26px] leading-[1.35] font-bold -tracking-[0.5px]">
                {post.title}
              </h1>

              <div className="mt-5 flex items-center gap-3 border-b border-line-faint pb-5">
                {post.avatarUrl ? (
                  <Image
                    src={post.avatarUrl}
                    alt=""
                    width={44}
                    height={44}
                    className="size-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full font-bold"
                    style={{ background: tone.bg, color: tone.fg }}
                  >
                    {initial(post.nickname)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    {post.userId ? (
                      <Link
                        href={`/users/${post.userId}`}
                        className="text-[15px] font-semibold text-ink hover:underline"
                      >
                        {post.nickname}
                      </Link>
                    ) : (
                      <span className="text-[15px] font-semibold">{post.nickname}</span>
                    )}
                    {post.authorIsLeader ? (
                      <span title="학생회장" aria-label="학생회장">
                        ⭐
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-0.5 text-[13px] text-muted">
                    {[cityLabel(post.city), timeAgo(post.createdAt), `조회 ${post.viewCount ?? 0}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                {isMine ? <PostOwnerMenu post={post} /> : null}
              </div>

              {/* Images attached outside the body (the app's non-rich path) */}
              {post.images.length > 0 && !/<img/i.test(post.content ?? '') ? (
                <div className="mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {post.images.map((src) => (
                    <div key={src} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-shade">
                      <Image src={src} alt="" fill sizes="(max-width: 640px) 100vw, 380px" className="object-cover" />
                    </div>
                  ))}
                </div>
              ) : null}

              <div
                className="post-body mt-5"
                // eslint-disable-next-line react/no-danger -- sanitised above by src/lib/sanitize.ts
                dangerouslySetInnerHTML={{ __html: safeHtml }}
              />

              <PostActions
                postId={post.id}
                initialLiked={post.liked}
                initialLikeCount={post.likeCount ?? 0}
                initialBookmarked={post.bookmarked}
                signedIn={!!user}
              />
            </article>

            <Comments
              postId={post.id}
              initialComments={comments}
              signedIn={!!user}
              myUserId={user?.id ?? null}
              anonymousBoard={anonymousBoard}
            />
          </main>

          <aside className="flex w-full flex-[1_1_300px] flex-col gap-4 lg:max-w-[320px]">
            {showTrade ? (
              <section className="rounded-card border border-line-soft bg-surface p-5">
                <h2 className="text-[15px] font-bold">판매자와 이야기하기</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  1:1 채팅은 앱에서 바로 열 수 있어요. 웹 채팅도 준비 중이에요.
                </p>
                <a
                  href="https://apps.apple.com/ca/app/camoim/id6763469709"
                  className="mt-3.5 flex h-12 items-center justify-center rounded-control bg-brand-strong text-base font-bold text-white hover:bg-brand-ink-hover"
                >
                  앱에서 채팅하기
                </a>
                <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                  선입금 요구나 외부 링크 결제는 사기일 수 있어요. 직거래를 권해요.
                </p>
              </section>
            ) : null}

            {post.boardSlug ? (
              <section className="rounded-card border border-line-soft bg-surface p-5">
                <h2 className="text-[15px] font-bold">{post.boardName}</h2>
                <Link
                  href={`/boards/${post.boardSlug}`}
                  className="mt-2 inline-flex text-[13.5px] text-brand-ink hover:text-brand-ink-hover"
                >
                  이 게시판 글 더 보기 ›
                </Link>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </>
  );
}
