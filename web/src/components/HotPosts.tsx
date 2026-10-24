'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import type { HotBoardSection } from '@/lib/types';
import { boardTone } from '@/lib/boards';
import { FlameIcon } from './icons';
import LinkPending from './LinkPending';
import { useLang, useMessages } from '@/lib/i18n/client';
import { boardName as boardDisplayName } from '@/lib/boards';

/**
 * 48 hours is the server's own default and what the app shows, so the first tab
 * matches the app exactly rather than narrowing to 24 and quietly hiding a post
 * from yesterday evening.
 */
const TABS = [
  { id: 'now', key: 'hotNow', hours: 48 },
  { id: 'week', key: 'hotWeek', hours: 168 },
] as const;

type TabId = (typeof TABS)[number]['id'];

type Ranked = {
  id: string;
  title: string;
  boardName: string;
  boardSlug: string;
  likeCount: number;
  commentCount: number;
};

/** Same ranking the app applies: flatten in board order, sort by likes*3 + comments. */
function rank(sections: HotBoardSection[], limit = 5): Ranked[] {
  return sections
    .flatMap((s) =>
      s.posts.map((p) => ({
        id: p.id,
        title: p.title,
        boardName: s.boardName,
        boardSlug: s.boardSlug,
        likeCount: p.likeCount ?? 0,
        commentCount: p.commentCount ?? 0,
      }))
    )
    .sort((a, b) => b.likeCount * 3 + b.commentCount - (a.likeCount * 3 + a.commentCount))
    .slice(0, limit);
}

export default function HotPosts({ initialSections }: { initialSections: HotBoardSection[] }) {
  const [tab, setTab] = useState<TabId>('now');
  const [cache, setCache] = useState<Partial<Record<TabId, Ranked[]>>>({
    now: rank(initialSections),
  });
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const m = useMessages();
  const lang = useLang();

  async function pick(next: TabId) {
    setTab(next);
    if (cache[next]) return;
    const hours = TABS.find((t) => t.id === next)!.hours;
    // No city, for the same reason the server render omits it.
    const params = new URLSearchParams({ limit: '4', top: '5', hours: String(hours) });
    try {
      const res = await fetch(`/api/bff/posts/hot-by-board?${params}`);
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      const ranked = rank(json.data as HotBoardSection[]);
      startTransition(() => {
        setFailed(false);
        setCache((prev) => ({ ...prev, [next]: ranked }));
      });
    } catch {
      setFailed(true);
    }
  }

  const rows = cache[tab];

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <FlameIcon className="text-[#E8590C]" />
          {m.home.hotTitle}
        </h2>
        <div role="tablist" aria-label={m.home.hotPeriod} className="flex gap-1.5">
          {TABS.map((t) => {
            const on = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => pick(t.id)}
                className={`h-9 rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                }`}
              >
                {m.home[t.key]}
              </button>
            );
          })}
        </div>
      </div>

      {!rows ? (
        <p className="py-6 text-center text-sm text-muted">
          {failed ? m.home.hotFailed : m.common.loading}
        </p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">{m.home.hotEmpty}</p>
      ) : (
        <ol aria-busy={pending}>
          {rows.map((post, i) => {
            const tone = boardTone(post.boardSlug);
            return (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}`}
                  prefetch={false}
                  className="flex items-center gap-3.5 border-t border-line-faint py-3 text-ink hover:bg-brand-tint-soft"
                >
                  <span className="w-5.5 text-[15px] font-bold text-brand-ink">{i + 1}</span>
                  <span
                    className="shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold"
                    style={{ color: tone.fg, background: tone.bg }}
                  >
                    {boardDisplayName(post.boardSlug, post.boardName, lang)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px]">{post.title}</span>
                  <LinkPending className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand-ink" />
                  <span className="hidden shrink-0 gap-2.5 text-[13px] text-muted sm:flex">
                    <span>♡ {post.likeCount}</span>
                    <span>{m.common.comments(post.commentCount)}</span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
