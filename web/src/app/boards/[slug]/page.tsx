import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import BoardRail from '@/components/BoardRail';
import PostListRow from '@/components/PostListRow';
import Pagination from '@/components/Pagination';
import TradeFilterToggle from '@/components/TradeFilterToggle';
import { apiFetch } from '@/lib/api';
import { ApiError } from '@/lib/api';
import { boardPostsPath, findBoard, loadBoards } from '@/lib/posts';
import { getCurrentUser } from '@/lib/user';
import { CITIES, boardTone, cityLabel, isLocalBoard, isTradeBoard } from '@/lib/boards';
import type { BoardPostsResponse } from '@/lib/posts';

const PER_PAGE = 20;

const SORTS = [
  { id: 'latest', label: '최신순' },
  { id: 'popular', label: '인기순' },
  { id: 'comments', label: '댓글순' },
] as const;

/** Members-only boards, which must also stay out of search results. */
function isPrivateBoard(slug: string, isUniversity?: boolean): boolean {
  return isUniversity === true || slug === 'anonymous';
}

type Params = { params: Promise<{ slug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const board = findBoard(await loadBoards(), slug);
  if (!board) return { title: '게시판' };
  const privateBoard = isPrivateBoard(board.slug, board.isUniversityBoard);
  return {
    title: board.name,
    description: board.description,
    robots: privateBoard ? { index: false, follow: false } : undefined,
  };
}

export default async function BoardFeedPage({ params, searchParams }: Params) {
  const { slug } = await params;
  const sp = await searchParams;

  if (slug === 'intro') redirect('/intro');

  const [user, boards] = await Promise.all([getCurrentUser(), loadBoards()]);
  const board = findBoard(boards, slug);

  // A school board the viewer may not see is simply absent from /boards, so an
  // unknown slug and "not your school" are the same 404. Visitors to a private
  // board never reach this: middleware.ts sent them to the login page.
  if (!board) notFound();

  // Second line behind the middleware, for a forged or expired cookie.
  if (isPrivateBoard(board.slug, board.isUniversityBoard) && !user) {
    redirect(`/login?next=${encodeURIComponent(`/boards/${slug}`)}`);
  }

  const page = Math.max(1, Number(one(sp.page)) || 1);
  const sort = SORTS.some((s) => s.id === one(sp.sort)) ? one(sp.sort) : 'latest';
  const city = (CITIES as readonly string[]).includes(one(sp.city)) ? one(sp.city) : '';
  const search = one(sp.search);
  const tradeStatus = one(sp.tradeStatus) === 'selling' ? 'selling' : '';

  let data: BoardPostsResponse;
  try {
    data = await apiFetch<BoardPostsResponse>(
      boardPostsPath(board.id, { page, sort, city, search, tradeStatus })
    );
  } catch (err) {
    // 403 is the school-board gate; anything else is a real failure.
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }

  const tone = boardTone(board.slug);
  const basePath = `/boards/${board.slug}`;
  const hrefWith = (overrides: Record<string, string>) => {
    const query = new URLSearchParams();
    const merged = { sort, city, search, tradeStatus, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (!v || (k === 'sort' && v === 'latest') || (k === 'page' && v === '1')) continue;
      query.set(k, v);
    }
    const qs = query.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <>
      <SiteHeader user={user} active="boards" query={search} />

      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-6 px-4 pb-16 pt-7 sm:px-6">
        <BoardRail boards={boards} activeSlug={board.slug} />

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-4">
          <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="size-3 rounded-full"
                    style={{ background: tone.dot }}
                  />
                  <h1 className="text-2xl font-bold -tracking-[0.4px]">{board.name}</h1>
                </div>
                {board.description ? (
                  <p className="mt-1.5 text-[14.5px] text-muted">{board.description}</p>
                ) : null}
                {board.isAnonymousAllowed ? (
                  <p className="mt-1.5 text-[13px] text-muted">
                    이 게시판은 글과 댓글이 모두 익명으로 올라가요.
                  </p>
                ) : null}
              </div>
              <Link
                href={`/write?board=${board.slug}`}
                className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
              >
                이 게시판에 글쓰기
              </Link>
            </div>

            {isLocalBoard(board.slug) ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {['', ...CITIES].map((c) => {
                  const on = c === city;
                  return (
                    <Link
                      key={c || 'all'}
                      href={hrefWith({ city: c, page: '1' })}
                      aria-current={on ? 'true' : undefined}
                      className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                        on
                          ? 'border-ink bg-ink text-white'
                          : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                      }`}
                    >
                      {c ? cityLabel(c) : '전체'}
                    </Link>
                  );
                })}
              </div>
            ) : null}

            {search ? (
              <p className="mt-4 text-sm text-muted">
                &lsquo;{search}&rsquo; 검색 결과 {data.total}건 ·{' '}
                <Link href={hrefWith({ search: '', page: '1' })} className="text-brand-ink">
                  검색 해제
                </Link>
              </p>
            ) : null}
          </section>

          <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line-faint px-5 py-3.5 sm:px-6">
              <div className="flex gap-4 text-sm font-semibold">
                {SORTS.map((s) => (
                  <Link
                    key={s.id}
                    href={hrefWith({ sort: s.id, page: '1' })}
                    aria-current={s.id === sort ? 'true' : undefined}
                    className={s.id === sort ? 'text-ink' : 'text-muted hover:text-ink-3'}
                  >
                    {s.label}
                  </Link>
                ))}
              </div>
              {isTradeBoard(board.slug) ? <TradeFilterToggle basePath={basePath} /> : null}
            </div>

            {data.posts.length === 0 ? (
              <p className="px-6 py-14 text-center text-sm text-muted">
                {search ? '검색 결과가 없어요.' : '아직 글이 없어요. 첫 글을 올려보세요.'}
              </p>
            ) : (
              <ul>
                {data.posts.map((post) => (
                  <PostListRow key={post.id} post={post} boardSlug={board.slug} />
                ))}
              </ul>
            )}

            <Pagination
              page={page}
              total={data.total}
              perPage={PER_PAGE}
              hrefFor={(n) => hrefWith({ page: String(n) })}
            />
          </section>
        </main>
      </div>
    </>
  );
}
