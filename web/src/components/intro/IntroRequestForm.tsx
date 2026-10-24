'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { inputClass } from '../Field';
import { INTRO_GENDERS, INTRO_JOBS } from '@/lib/intro';
import type { IntroMeta } from '@/lib/types';
import { useLang, useMessages } from '@/lib/i18n/client';
import { labelFor } from '@/lib/i18n/lang';

/**
 * Asking to talk. The snapshot sent here is what the recipient sees about the
 * sender — nothing else about the account is revealed — and it is remembered as
 * the sender's defaults for next time. A decline is never reported back.
 */
export default function IntroRequestForm({
  postId,
  meta,
}: {
  postId: string;
  meta: IntroMeta;
}) {
  const router = useRouter();
  const [gender, setGender] = useState<string>(meta.defaults.gender ?? '');
  const [birthYear, setBirthYear] = useState(
    meta.defaults.birthYear ? String(meta.defaults.birthYear) : ''
  );
  const [region, setRegion] = useState(meta.defaults.region ?? '');
  const [job, setJob] = useState<string>(meta.defaults.job ?? '');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [remaining, setRemaining] = useState(meta.dailyRemaining);
  const all = useMessages();
  const m = all.intro;
  const lang = useLang();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/intro/${postId}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          gender,
          birthYear: birthYear ? Number(birthYear) : null,
          region: region.trim(),
          job,
        }),
      });
      const json = await res.json();
      // 429 is the daily limit, 400 an already-sent request; both carry the
      // API's own wording.
      if (!res.ok || !json.success) throw new Error(json.message || m.requestFailed);
      setRemaining(json.data?.dailyRemaining ?? remaining - 1);
      setSent(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-card border border-line-soft bg-surface px-5 py-6">
        <p className="text-[15px] font-semibold">{m.sent}</p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          {m.sentBody}
        </p>
        <p className="mt-3 text-[13px] text-muted">{m.moreToday(remaining)}</p>
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="rounded-card border border-line-soft bg-surface px-5 py-6">
        <p className="text-[15px] font-semibold">{m.limitTitle}</p>
        <p className="mt-2 text-[14px] text-muted">{m.limitBody}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-6">
      <h2 className="text-[15px] font-bold">{m.requestTitle}</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        {m.requestIntro}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[120px] flex-1">
            <Field id="req-gender" label={m.gender}>
              <select
                id="req-gender"
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={inputClass}
              >
                <option value="">{m.pick}</option>
                {INTRO_GENDERS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {labelFor(g, lang)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="min-w-[120px] flex-1">
            <Field id="req-birthYear" label={m.birthYear}>
              <input
                id="req-birthYear"
                required
                inputMode="numeric"
                maxLength={4}
                value={birthYear}
                onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="1998"
                className={inputClass}
              />
            </Field>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="min-w-[140px] flex-1">
            <Field id="req-region" label={m.region}>
              <input
                id="req-region"
                required
                maxLength={40}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder={m.regionPlaceholder}
                className={inputClass}
              />
            </Field>
          </div>
          <div className="min-w-[140px] flex-1">
            <Field id="req-job" label={m.jobOptional}>
              <select id="req-job" value={job} onChange={(e) => setJob(e.target.value)} className={inputClass}>
                <option value="">{all.common.none}</option>
                {INTRO_JOBS.map((j) => (
                  <option key={j.key} value={j.key}>
                    {labelFor(j, lang)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <Field id="req-message" label={m.message} hint={m.messageHint}>
          <textarea
            id="req-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={150}
            placeholder={m.messagePlaceholder}
            className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
          />
        </Field>
      </div>

      {error ? (
        <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy || !gender || !birthYear || !region.trim() || !message.trim()}
        className="mt-4 flex h-12 w-full items-center justify-center rounded-control bg-brand-strong text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
      >
        {busy ? all.report.sending : m.sendRequest(remaining)}
      </button>
    </form>
  );
}
