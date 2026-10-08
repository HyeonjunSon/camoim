import type { Metadata } from 'next';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { boardTone } from '@/lib/boards';
import { initial, timeAgo } from '@/lib/format';
import type { PostSummary, SearchResults, User } from '@/lib/types';

export const metadata: Metadata = {
  title: '검색',
  // A results page is never worth indexing, and the query could be anything.
  robots: { index: false, follow: false },
};

const MIN_QUERY = 2;

/**
 * The API's search does not scope posts to what the viewer may read: it matches
 * every post, school boards and group posts included. Those are filtered here,
 * on the server, before anything is rendered.
 *
 * - group posts are members-only (`groupId` set)
 * - school boards are slugged `<school>-free` / `<school>-anonymous` and belong
 *   to a verified-members-only context, the same reason the API already leaves
 *   school clubs out of group results
 * - the anonymous board is closed to visitors
 */
function visiblePosts(posts: PostSummary[], user: User | null): PostSummary[] {
  return posts.filter((post) => {
    if (post.groupId) return false;
    const slug = post.boardSlug ?? '';
    if (/-(free|anonymous)$/.test(slug)) return false;
    if (slug === 'anonymous' && !user) return false;
    return true;
  });
}

type Props = { searchParams: Promise<{ q?: string }> };

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = (q ?? '').trim();
  const user = await getCurrentUser();

  const results =
    query.length >= MIN_QUERY
      ? await apiFetchOrNull<SearchResults>(
          `/search?q=${encodeURIComponent(query)}&type=all&limit=20`
        )
      : null;

  const posts = visiblePosts(results?.posts ?? [], user);
  const groups = results?.groups ?? [];
  const users = results?.users ?? [];
  const nothing = results && posts.length === 0 && groups.length === 0 && users.length === 0;

  return (
    <>
      <SiteHeader user={user} query={query} />

      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">
          {query ? `‘${query}’ 검색 결과` : '검색'}
        </h1>

        {query.length > 0 && query.length < MIN_QUERY ? (
          <p className="mt-2 text-[14.5px] text-muted">두 글자 이상 입력해주세요.</p>
        ) : null}

        {!query ? (
          <p className="mt-2 text-[14.5px] text-muted">
            게시글, 모임, 회원을 한 번에 찾을 수 있어요.
          </p>
        ) : null}

        {nothing ? (
          <p className="mt-10 text-center text-sm text-muted">
            검색 결과가 없어요. 다른 단어로 찾아보세요.
          </p>
        ) : null}

        {posts.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-bold">게시글 {posts.length}</h2>
            <ul className="mt-3 overflow-hidden rounded-card border border-line-soft bg-surface">
              {posts.map((post) => {
                const tone = boardTone(post.boardSlug);
                return (
                  <li key={post.id}>
                    <Link
                      href={`/posts/${post.id}`}
                      prefetch={false}
                      className="block border-b border-line-faint px-5 py-4 text-ink last:border-b-0 hover:bg-brand-tint-soft"
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        {post.boardName ? (
                          <span
                            className="rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
                            style={{ color: tone.fg, background: tone.bg }}
                          >
                            {post.boardName}
                          </span>
                        ) : null}
                        <span className="min-w-0 flex-1 truncate font-semibold">{post.title}</span>
                      </span>
                      {post.content ? (
                        <span className="mt-1.5 block line-clamp-2 text-sm text-ink-3">
                          {post.content}
                        </span>
                      ) : null}
                      <span className="mt-1.5 block text-[12.5px] text-muted">
                        {[post.nickname, timeAgo(post.createdAt), `댓글 ${post.commentCount ?? 0}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        {groups.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-bold">모임 {groups.length}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {groups.map((group) => (
                <li key={group.id}>
                  <Link
                    href={`/groups/${group.id}`}
                    className="flex h-full flex-col rounded-card border border-line-soft bg-surface px-4 py-3.5 text-ink hover:border-line-strong"
                  >
                    <span className="font-semibold">{group.name}</span>
                    {group.description ? (
                      <span className="mt-1 line-clamp-2 text-[13.5px] text-muted">
                        {group.description}
                      </span>
                    ) : null}
                    <span className="mt-2 text-xs text-muted">
                      멤버 {group.memberCount ?? 0}명
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {users.length > 0 ? (
          <section className="mt-6">
            <h2 className="text-lg font-bold">회원 {users.length}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {users.map((u) => (
                <li key={u.id}>
                  <Link
                    href={`/users/${u.id}`}
                    className="flex h-11 items-center gap-2 rounded-pill border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-3 hover:bg-field"
                  >
                    <span
                      aria-hidden
                      className="flex size-7 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-ink"
                    >
                      {initial(u.nickname)}
                    </span>
                    {u.nickname}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </>
  );
}
