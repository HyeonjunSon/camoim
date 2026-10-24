import Link from 'next/link';
import type { PostSummary } from '@/lib/types';
import { prefixLabel, tradeBadge, tradeLabel } from '@/lib/boards';
import { timeAgo } from '@/lib/format';
import LinkPending from './LinkPending';
import { getI18n } from '@/lib/i18n/server';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The dense "목록형" row — one line per post, the way 캐스모 readers are used to
 * scanning a board. Title, then author · time · likes · views as columns from
 * `sm` up, folded under the title below that.
 */
export default async function PostTableRow({
  post,
  boardSlug,
  now,
}: {
  post: PostSummary;
  boardSlug: string;
  /** Passed in so every row on the page agrees on what "new" means. */
  now: number;
}) {
  const { lang, m: all } = await getI18n();
  const m = all.boards;
  const badge = tradeBadge(boardSlug, post.tradeStatus, post.prefix);
  const prefix = prefixLabel(boardSlug, post.prefix, lang);
  const isNew = now - new Date(post.createdAt).getTime() < DAY_MS;
  const comments = post.commentCount ?? 0;

  return (
    <li>
      <Link
        href={`/posts/${post.id}`}
        prefetch={false}
        className={`grid grid-cols-1 gap-1 border-b border-line-faint px-5 py-3 text-ink hover:bg-brand-tint-soft sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem_3rem_3.5rem] sm:items-center sm:gap-3 sm:px-6 sm:py-2.5 ${
          badge === 'sold' ? 'text-muted' : ''
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5 text-[14.5px]">
          {badge ? (
            <span
              className={`shrink-0 rounded px-1 py-px text-[11px] font-bold ${
                badge === 'sold' ? 'bg-[#EDEDF0] text-ink-3' : 'bg-positive-tint text-positive'
              }`}
            >
              {tradeLabel(boardSlug, badge, lang)}
            </span>
          ) : null}
          {prefix ? <span className="shrink-0 font-semibold text-brand-ink">[{prefix}]</span> : null}
          <span className="truncate">{post.title}</span>
          {comments > 0 ? (
            <span className="shrink-0 text-[12.5px] font-semibold text-brand-ink" aria-label={m.commentCount(comments)}>
              [{comments}]
            </span>
          ) : null}
          {post.thumbnail ? (
            <span className="shrink-0 text-[13px]" role="img" aria-label={m.hasPhoto}>
              📷
            </span>
          ) : null}
          {isNew ? (
            <span
              className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#F43F5E] text-[9.5px] font-extrabold text-white"
              aria-label={m.newPost}
            >
              N
            </span>
          ) : null}
          <LinkPending className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand-ink" />
        </span>

        {/* Columns from sm up; one muted line under the title below that. */}
        <span className="flex gap-2 text-[12.5px] text-muted sm:contents">
          <span className="truncate sm:text-[13px] sm:text-ink-3">{post.nickname}</span>
          <span className="sm:text-center">{timeAgo(post.createdAt, undefined, lang)}</span>
          <span className="sm:text-center">
            <span className="sm:hidden">{m.likesShort}</span>
            {post.likeCount ?? 0}
          </span>
          <span className="sm:text-center">
            <span className="sm:hidden">{m.viewsShort}</span>
            {post.viewCount ?? 0}
          </span>
        </span>
      </Link>
    </li>
  );
}

/** Column headings for the table view, shown from `sm` up. */
export async function PostTableHead() {
  const m = (await getI18n()).m.boards;
  return (
    <div
      aria-hidden
      className="hidden border-b border-line-faint bg-field px-6 py-2 text-[12.5px] font-semibold text-muted sm:grid sm:grid-cols-[minmax(0,1fr)_7rem_4.5rem_3rem_3.5rem] sm:gap-3"
    >
      <span className="text-center">{m.colTitle}</span>
      <span>{m.colAuthor}</span>
      <span className="text-center">{m.colDate}</span>
      <span className="text-center">{m.colLikes}</span>
      <span className="text-center">{m.colViews}</span>
    </div>
  );
}
