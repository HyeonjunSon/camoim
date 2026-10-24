import Link from 'next/link';
import Image from 'next/image';
import type { PostSummary } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { boardEmoji, boardTone, cityLabel, prefixLabel, tradeLabel } from '@/lib/boards';

export default function MarketGrid({ posts, city }: { posts: PostSummary[]; city: string }) {
  if (posts.length === 0) return null;

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
      <div className="mb-3.5 flex items-center justify-between">
        <h2 className="text-lg font-bold">{cityLabel(city)} 중고거래</h2>
        <Link href="/boards/market" className="text-sm text-brand-ink hover:text-brand-ink-hover">
          더보기 ›
        </Link>
      </div>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]">
        {posts.map((post) => {
          const sold = post.tradeStatus === 'sold';
          return (
            <li key={post.id}>
              <Link
                href={`/posts/${post.id}`}
                prefetch={false}
                className="flex flex-col gap-2 text-ink"
              >
                <div
                  className="relative flex aspect-square items-center justify-center overflow-hidden rounded-xl"
                  style={{ background: post.thumbnail ? 'var(--color-shade)' : boardTone('market').bg }}
                >
                  {post.thumbnail ? (
                    <Image
                      src={post.thumbnail}
                      alt=""
                      fill
                      sizes="(max-width: 640px) 50vw, 180px"
                      // Often the largest thing in view on the home page (Next flags it as
                      // the LCP image). Only four render, so loading them eagerly is cheap.
                      loading="eager"
                      className="object-cover"
                    />
                  ) : (
                    <span aria-hidden className="text-4xl">
                      {boardEmoji('market')}
                    </span>
                  )}
                  {sold ? (
                    <span className="absolute left-2 top-2 rounded-md bg-ink-3 px-1.5 py-0.5 text-[11px] font-bold text-white">
                      {tradeLabel('market', 'sold')}
                    </span>
                  ) : null}
                </div>
                <span className="line-clamp-2 text-[14.5px] font-medium leading-[1.35]">
                  {prefixLabel('market', post.prefix) ? (
                    <span className="font-bold text-brand-ink">[{prefixLabel('market', post.prefix)}] </span>
                  ) : null}
                  {post.title}
                </span>
                <span className="text-[12.5px] text-muted">
                  {[cityLabel(post.city), timeAgo(post.createdAt)].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
