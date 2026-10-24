import type { Metadata } from 'next';
import Link from 'next/link';
import ProfileEditForm from '@/components/ProfileEditForm';
import BlockList from '@/components/BlockList';
import PostListRow from '@/components/PostListRow';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';
import type { BlockEntry, PostSummary } from '@/lib/types';

export const metadata: Metadata = {
  title: '마이페이지',
  robots: { index: false, follow: false },
};

const TABS = [
  { id: 'profile' },
  { id: 'posts' },
  { id: 'liked' },
  { id: 'bookmarks' },
  { id: 'blocks' },
] as const;

type Tab = (typeof TABS)[number]['id'];

/** One endpoint per post tab; they all answer with { posts, total }. */
const POST_ENDPOINTS: Record<string, string> = {
  posts: '/users/me/posts',
  liked: '/users/me/liked-posts',
  bookmarks: '/users/me/bookmarks',
};


type Props = { searchParams: Promise<{ tab?: string }> };

export default async function MyPage({ searchParams }: Props) {
  const { tab: tabParam } = await searchParams;
  const tab = (TABS.some((t) => t.id === tabParam) ? tabParam : 'profile') as Tab;

  // proxy.ts gates /mypage, so a user is expected here.
  const [user, { m: all }] = await Promise.all([getCurrentUser(), getI18n()]);
  const m = all.mypage;

  const endpoint = POST_ENDPOINTS[tab];
  const [postList, blocks] = await Promise.all([
    endpoint ? apiFetchOrNull<{ posts: PostSummary[]; total: number }>(endpoint) : Promise.resolve(null),
    tab === 'blocks' ? apiFetchOrNull<BlockEntry[]>('/users/me/blocks') : Promise.resolve(null),
  ]);

  return (
    <>

      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.title}</h1>
          {user ? (
            <Link
              href={`/users/${user.id}`}
              className="text-sm text-brand-ink hover:text-brand-ink-hover"
            >
              {m.publicProfile}
            </Link>
          ) : null}
        </div>

        <nav aria-label={m.menu} className="mt-4 flex flex-wrap gap-2">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <Link
                key={t.id}
                href={t.id === 'profile' ? '/mypage' : `/mypage?tab=${t.id}`}
                aria-current={on ? 'true' : undefined}
                className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                }`}
              >
                {m.tabs[t.id]}
              </Link>
            );
          })}
        </nav>

        <div className="mt-5">
          {tab === 'profile' && user ? (
            <section className="rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
              <ProfileEditForm user={user} />
            </section>
          ) : null}

          {tab === 'blocks' ? <BlockList initialBlocks={blocks ?? []} /> : null}

          {endpoint ? (
            (postList?.posts.length ?? 0) === 0 ? (
              <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
                {m.empty[tab]}
              </p>
            ) : (
              <>
                <p className="mb-2 text-[13.5px] text-muted">{m.total(postList?.total ?? 0)}</p>
                <ul className="overflow-hidden rounded-card border border-line-soft bg-surface">
                  {postList?.posts.map((post) => (
                    <PostListRow key={post.id} post={post} boardSlug={post.boardSlug ?? ''} />
                  ))}
                </ul>
              </>
            )
          ) : null}
        </div>

        {tab === 'profile' ? (
          <section className="mt-5 rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-7">
            <h2 className="text-[15px] font-bold">{m.account}</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              {m.accountNote}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                href="/terms"
                className="flex h-10 items-center rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field"
              >
                {m.terms}
              </Link>
              <Link
                href="/privacy"
                className="flex h-10 items-center rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field"
              >
                {m.privacy}
              </Link>
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
