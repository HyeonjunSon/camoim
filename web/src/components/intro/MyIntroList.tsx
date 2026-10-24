'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { IntroPost } from '@/lib/types';
import { ageFromBirthYear, genderLabel } from '@/lib/intro';
import { useLang, useMessages } from '@/lib/i18n/client';

export default function MyIntroList({ posts }: { posts: IntroPost[] }) {
  const router = useRouter();
  const [items, setItems] = useState(posts);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.intro;
  const lang = useLang();

  async function remove(id: string) {
    if (!window.confirm(m.takeDownConfirm)) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/intro/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.takeDownFailed);
      setItems((prev) => prev.filter((p) => p.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.takeDownFailed);
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
        {m.noneMine}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((post) => (
          <li
            key={post.id}
            className="flex flex-wrap items-center gap-3.5 rounded-card border border-line-soft bg-surface px-4 py-4"
          >
            <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-shade">
              {post.photo ? (
                <Image src={post.photo} alt="" fill sizes="64px" className="object-cover" />
              ) : null}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[13px] font-bold text-ink-3">
                  {[genderLabel(post.gender, lang), ageFromBirthYear(post.birthYear, undefined, lang)]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                {post.mode === 'proxy' ? (
                  <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[11px] font-bold text-[#B45309]">
                    {m.proxyBadge}
                  </span>
                ) : null}
                {post.expired ? (
                  <span className="rounded-md bg-[#EDEDF0] px-1.5 py-0.5 text-[11px] font-bold text-ink-3">
                    {m.expiredShort}
                  </span>
                ) : null}
                {(post.pendingCount ?? 0) > 0 ? (
                  <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                    {m.requests(post.pendingCount ?? 0)}
                  </span>
                ) : null}
              </div>
              <Link
                href={`/intro/${post.id}`}
                prefetch={false}
                className="mt-1 block truncate text-[15px] font-semibold text-ink hover:underline"
              >
                {post.headline}
              </Link>
              <p className="mt-0.5 text-[12.5px] text-muted">
                {post.region} · {post.daysLeft > 0 ? m.daysLeft(post.daysLeft) : m.ended}
              </p>
            </div>

            <button
              type="button"
              onClick={() => remove(post.id)}
              disabled={busy === post.id}
              className="h-10 shrink-0 rounded-control border border-line-strong px-3 text-sm font-semibold text-muted hover:bg-field hover:text-danger disabled:opacity-55"
            >
              {m.takeDown}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
