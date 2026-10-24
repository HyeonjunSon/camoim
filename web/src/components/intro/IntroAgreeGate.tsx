'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { INTRO_RULES } from '@/lib/intro';
import { useLang, useMessages } from '@/lib/i18n/client';

/**
 * The age and rules gate. The server records only that agreement happened
 * (`introAgreedAt`) and refuses to create a post or a request without it, so the
 * 19+ confirmation lives here — the same place and the same wording as the app.
 */
export default function IntroAgreeGate() {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.intro;
  const lang = useLang();

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/bff/intro/agree', { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.common.failed);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.failed);
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card border border-line-soft bg-surface px-5 py-7 sm:px-7">
      <span className="rounded-md bg-[#FCE7F3] px-2 py-1 text-xs font-bold text-[#BE185D]">
        {m.adultsOnly}
      </span>
      <h1 className="mt-3.5 text-xl font-bold">{m.rulesTitle}</h1>
      <p className="mt-1.5 text-[14.5px] text-muted">
        {m.rulesIntro}
      </p>

      <ol className="mt-5 flex flex-col gap-4">
        {INTRO_RULES.map((rule, i) => (
          <li key={rule.title} className="flex gap-3">
            <span
              aria-hidden
              className="flex size-7 shrink-0 items-center justify-center rounded-full bg-brand-tint text-[13px] font-bold text-brand-ink"
            >
              {i + 1}
            </span>
            <span>
              <span className="block text-[15px] font-semibold">{lang === 'en' ? rule.titleEn : rule.title}</span>
              <span className="mt-0.5 block text-[13.5px] leading-relaxed text-muted">
                {lang === 'en' ? rule.descriptionEn : rule.description}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <label className="mt-6 flex items-center gap-2.5 rounded-control border border-line-strong px-3.5 py-3.5 text-[15px] font-semibold">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="size-4.5 accent-brand-strong"
        />
        {m.agree}
      </label>

      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={start}
        disabled={busy || !agreed}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-control bg-brand-strong text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
      >
        {busy ? all.group.processing : m.start}
      </button>
    </div>
  );
}
