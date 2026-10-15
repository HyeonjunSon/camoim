'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HeartIcon } from './icons';
import ReportButton from './ReportButton';

type Props = {
  postId: string;
  initialLiked: boolean;
  initialLikeCount: number;
  initialBookmarked: boolean;
  signedIn: boolean;
  /** Hidden on your own post — reporting yourself makes no sense. */
  isMine: boolean;
};

export default function PostActions({
  postId,
  initialLiked,
  initialLikeCount,
  initialBookmarked,
  signedIn,
  isMine,
}: Props) {
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function requireLogin() {
    router.push(`/login?next=${encodeURIComponent(`/posts/${postId}`)}`);
  }

  async function toggleLike() {
    if (!signedIn) return requireLogin();
    // Optimistic, then corrected from the response: the server owns the count
    // (it resolves the toggle with a conditional atomic update).
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((n) => Math.max(0, n + (nextLiked ? 1 : -1)));
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/posts/${postId}/like`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setLiked(json.data.liked);
      setLikeCount(json.data.likeCount);
    } catch {
      setLiked(liked);
      setLikeCount(initialLikeCount);
      setError('잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleBookmark() {
    if (!signedIn) return requireLogin();
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/posts/${postId}/bookmark`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message);
      setBookmarked(json.data.bookmarked);
    } catch {
      setError('잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('링크를 복사할 수 없어요.');
    }
  }

  const action =
    'flex h-9 items-center gap-1.5 rounded-full px-3 text-[14px] font-medium transition-colors disabled:opacity-55';
  const idle = 'text-ink-3 hover:bg-field';

  return (
    <div className="mt-8 flex flex-wrap items-center gap-1 border-t border-line-faint pt-4">
      <button
        type="button"
        onClick={toggleLike}
        disabled={busy}
        aria-pressed={liked}
        aria-label={`좋아요 ${likeCount}`}
        className={`${action} ${liked ? 'text-[#BE185D] hover:bg-[#FDECF3]' : idle}`}
      >
        <HeartIcon size={19} filled={liked} />
        <span className="tabular-nums">{likeCount}</span>
      </button>

      <button
        type="button"
        onClick={toggleBookmark}
        disabled={busy}
        aria-pressed={bookmarked}
        className={`${action} ${bookmarked ? 'text-brand-ink hover:bg-brand-tint' : idle}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
          <path d="M6 3h12v18l-6-4-6 4z" />
        </svg>
        {bookmarked ? '저장됨' : '저장'}
      </button>

      <button
        type="button"
        onClick={copyLink}
        className={`${action} ${copied ? 'text-positive' : idle}`}
      >
        {copied ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m5 12 5 5 9-10" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
            <path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
            <path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
          </svg>
        )}
        <span aria-live="polite">{copied ? '복사됨' : '링크 복사'}</span>
      </button>

      {!isMine ? (
        <div className="ml-auto">
          <ReportButton
            targetType="post"
            targetId={postId}
            signedIn={signedIn}
            className="flex h-9 items-center rounded-full px-3 text-[13px] text-muted transition-colors hover:bg-field hover:text-danger"
          />
        </div>
      ) : null}

      {error ? (
        <span role="status" className="text-[13px] text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
