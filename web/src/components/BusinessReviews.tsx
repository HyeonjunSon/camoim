'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BusinessReview } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { useLang, useMessages } from '@/lib/i18n/client';

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  const m = useMessages().business;
  return (
    <span aria-label={m.stars(value)} style={{ fontSize: size }} className="tracking-tight">
      <span className="text-[#F59E0B]">{'★'.repeat(Math.round(value))}</span>
      <span className="text-line-strong">{'★'.repeat(5 - Math.round(value))}</span>
    </span>
  );
}

export default function BusinessReviews({
  businessId,
  initialReviews,
  initialAvg,
  initialCount,
  signedIn,
}: {
  businessId: string;
  initialReviews: BusinessReview[];
  initialAvg: number;
  initialCount: number;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [reviews, setReviews] = useState(initialReviews);
  const [avg, setAvg] = useState(initialAvg);
  const [count, setCount] = useState(initialCount);
  const mine = reviews.find((r) => r.mine);

  const [rating, setRating] = useState(mine?.rating ?? 5);
  const [text, setText] = useState(mine?.text ?? '');
  const [busy, setBusy] = useState(false);
  const all = useMessages();
  const m = all.business;
  const lang = useLang();
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    const res = await fetch(`/api/bff/businesses/${businessId}/reviews`);
    const json = await res.json();
    if (json?.success) setReviews(json.data as BusinessReview[]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!signedIn) {
      router.push(`/login?next=${encodeURIComponent(`/businesses/${businessId}`)}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/businesses/${businessId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, text: text.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.reviewSaveFailed);
      // The rollup comes back beside `data`, so the header updates without a reload.
      setAvg(json.ratingAvg ?? avg);
      setCount(json.ratingCount ?? count);
      await reload();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.reviewSaveFailed);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(m.reviewDeleteConfirm)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/bff/businesses/${businessId}/reviews`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.common.deleteFailed);
      setAvg(json.ratingAvg ?? 0);
      setCount(json.ratingCount ?? 0);
      setText('');
      setRating(5);
      await reload();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.deleteFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">{m.reviews(count)}</h2>
        {count > 0 ? (
          <span className="flex items-center gap-2 text-sm text-ink-3">
            <Stars value={avg} />
            {avg.toFixed(1)}
          </span>
        ) : null}
      </div>

      {signedIn ? (
        <form onSubmit={submit} className="mt-4 rounded-control border border-line-strong px-3.5 py-3">
          <fieldset>
            <legend className="text-[13.5px] font-semibold text-ink-3">
              {mine ? m.editMyReview : m.rating}
            </legend>
            <div className="mt-1.5 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  aria-label={m.star(n)}
                  aria-pressed={rating === n}
                  className={`text-2xl leading-none ${n <= rating ? 'text-[#F59E0B]' : 'text-line-strong'}`}
                >
                  ★
                </button>
              ))}
            </div>
          </fieldset>
          <label htmlFor="review-text" className="sr-only-label">
            {m.reviewText}
          </label>
          <textarea
            id="review-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder={m.reviewPlaceholder}
            className="mt-2 w-full resize-none border-none text-[15px] outline-none"
          />
          <div className="flex items-center justify-between gap-2">
            {mine ? (
              <button
                type="button"
                onClick={remove}
                disabled={busy}
                className="text-[13px] text-muted hover:text-danger disabled:opacity-55"
              >
                {m.deleteMyReview}
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={busy}
              className="h-10 rounded-[10px] bg-brand-strong px-4 font-semibold text-white disabled:opacity-55"
            >
              {busy ? all.common.saving : mine ? all.common.edit : all.common.submit}
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-4 rounded-control border border-line-strong px-3.5 py-4 text-sm text-muted">
          {m.reviewLoginPre}
          <a
            href={`/login?next=${encodeURIComponent(`/businesses/${businessId}`)}`}
            className="font-semibold text-brand-ink hover:text-brand-ink-hover"
          >
            {all.comments.login}
          </a>
          {m.reviewLoginPost}
        </p>
      )}

      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      {reviews.length === 0 ? (
        <p className="py-6 text-sm text-muted">{m.noReviewsYet}</p>
      ) : (
        <ul className="mt-2">
          {reviews.map((review) => (
            <li key={review.id} className="border-t border-line-faint py-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <Stars value={review.rating} size={13} />
                <span className="text-[14.5px] font-semibold">{review.nickname}</span>
                {review.mine ? (
                  <span className="rounded-[5px] bg-brand-tint px-1.5 py-0.5 text-[11.5px] font-bold text-brand-ink-hover">
                    {m.myReview}
                  </span>
                ) : null}
                <span className="text-[12.5px] text-muted">{timeAgo(review.createdAt, undefined, lang)}</span>
              </div>
              {review.text ? (
                <p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap">{review.text}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
