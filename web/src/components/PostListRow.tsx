import Link from 'next/link';
import Image from 'next/image';
import type { PostSummary } from '@/lib/types';
import { boardEmoji, boardTone, cityLabel, prefixLabel, tradeBadge, tradeLabel } from '@/lib/boards';
import { timeAgo } from '@/lib/format';
import LinkPending from './LinkPending';

/** The card view of a board feed row. The dense table view is PostTableRow. */
export default function PostListRow({
  post,
  boardSlug,
}: {
  post: PostSummary;
  boardSlug: string;
}) {
  const badge = tradeBadge(boardSlug, post.tradeStatus, post.prefix);
  const prefix = prefixLabel(boardSlug, post.prefix);

  return (
    <li>
      <Link
        href={`/posts/${post.id}`}
        prefetch={false}
        className="flex items-start gap-4 border-b border-line-faint px-5 py-4 text-ink hover:bg-brand-tint-soft sm:items-center sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {badge ? (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${
                  badge === 'sold' ? 'bg-[#EDEDF0] text-ink-3' : 'bg-positive-tint text-positive'
                }`}
              >
                {tradeLabel(boardSlug, badge)}
              </span>
            ) : null}
            {post.authorIsLeader ? (
              <span title="학생회장" aria-label="학생회장" className="shrink-0 text-sm">
                ⭐
              </span>
            ) : null}
            <span className="truncate text-base font-semibold">
              {prefix ? <span className="text-brand-ink">[{prefix}] </span> : null}
              {post.title}
            </span>
          </div>

          {post.content ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-3">{post.content}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] text-muted">
            <LinkPending className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand-ink" />
            <span>{post.nickname}</span>
            {post.city ? <span>{cityLabel(post.city)}</span> : null}
            <span>{timeAgo(post.createdAt)}</span>
            <span>♡ {post.likeCount ?? 0}</span>
            <span>댓글 {post.commentCount ?? 0}</span>
          </div>
        </div>

        {/* A post without a photo gets its board's emoji on the board's tint
            rather than an empty grey box, which read as a broken image. */}
        <div
          className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: post.thumbnail ? 'var(--color-shade)' : boardTone(boardSlug).bg }}
        >
          {post.thumbnail ? (
            <Image src={post.thumbnail} alt="" fill sizes="84px" className="object-cover" />
          ) : (
            <span aria-hidden className="text-3xl">
              {boardEmoji(boardSlug)}
            </span>
          )}
        </div>
      </Link>
    </li>
  );
}
