import Link from 'next/link';
import Image from 'next/image';
import type { PostSummary } from '@/lib/types';
import { cityLabel, isTradeBoard, tradeLabel } from '@/lib/boards';
import { timeAgo } from '@/lib/format';
import { ImageIcon } from './icons';

export default function PostListRow({
  post,
  boardSlug,
}: {
  post: PostSummary;
  boardSlug: string;
}) {
  const showTrade = isTradeBoard(boardSlug) && post.tradeStatus;
  const sold = post.tradeStatus === 'sold';

  return (
    <li>
      <Link
        href={`/posts/${post.id}`}
        prefetch={false}
        className="flex items-start gap-4 border-b border-line-faint px-5 py-4 text-ink hover:bg-brand-tint-soft sm:items-center sm:px-6"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {showTrade ? (
              <span
                className={`shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${
                  sold ? 'bg-[#EDEDF0] text-ink-3' : 'bg-positive-tint text-positive'
                }`}
              >
                {tradeLabel(boardSlug, sold ? 'sold' : 'selling')}
              </span>
            ) : null}
            {post.authorIsLeader ? (
              <span title="학생회장" aria-label="학생회장" className="shrink-0 text-sm">
                ⭐
              </span>
            ) : null}
            <span className="truncate text-base font-semibold">{post.title}</span>
          </div>

          {post.content ? (
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-3">{post.content}</p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-x-2.5 gap-y-1 text-[12.5px] text-muted">
            <span>{post.nickname}</span>
            {post.city ? <span>{cityLabel(post.city)}</span> : null}
            <span>{timeAgo(post.createdAt)}</span>
            <span>♡ {post.likeCount ?? 0}</span>
            <span>댓글 {post.commentCount ?? 0}</span>
          </div>
        </div>

        <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-shade text-[#B4B3BE]">
          {post.thumbnail ? (
            <Image src={post.thumbnail} alt="" fill sizes="84px" className="object-cover" />
          ) : (
            <ImageIcon size={24} />
          )}
        </div>
      </Link>
    </li>
  );
}
