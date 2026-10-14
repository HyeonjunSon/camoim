'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { inputClass } from '../Field';
import { INTRO_GENDERS, INTRO_JOBS } from '@/lib/intro';
import type { IntroMeta } from '@/lib/types';

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
      if (!res.ok || !json.success) throw new Error(json.message || '신청하지 못했어요.');
      setRemaining(json.data?.dailyRemaining ?? remaining - 1);
      setSent(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '신청하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="rounded-card border border-line-soft bg-surface px-5 py-6">
        <p className="text-[15px] font-semibold">신청을 보냈어요</p>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          상대가 수락하면 익명 채팅이 열리고 알림이 가요. 거절하면 따로 알려드리지 않아요.
        </p>
        <p className="mt-3 text-[13px] text-muted">오늘 {remaining}회 더 신청할 수 있어요.</p>
      </div>
    );
  }

  if (remaining <= 0) {
    return (
      <div className="rounded-card border border-line-soft bg-surface px-5 py-6">
        <p className="text-[15px] font-semibold">오늘 신청 횟수를 다 썼어요</p>
        <p className="mt-2 text-[14px] text-muted">내일 다시 신청할 수 있어요.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-6">
      <h2 className="text-[15px] font-bold">대화 신청하기</h2>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
        아래 정보와 한마디만 상대에게 보여요. 닉네임이나 프로필은 전달되지 않아요.
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[120px] flex-1">
            <Field id="req-gender" label="성별">
              <select
                id="req-gender"
                required
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className={inputClass}
              >
                <option value="">선택</option>
                {INTRO_GENDERS.map((g) => (
                  <option key={g.key} value={g.key}>
                    {g.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="min-w-[120px] flex-1">
            <Field id="req-birthYear" label="출생연도">
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
            <Field id="req-region" label="지역">
              <input
                id="req-region"
                required
                maxLength={40}
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                placeholder="노스욕"
                className={inputClass}
              />
            </Field>
          </div>
          <div className="min-w-[140px] flex-1">
            <Field id="req-job" label="직업 (선택)">
              <select id="req-job" value={job} onChange={(e) => setJob(e.target.value)} className={inputClass}>
                <option value="">선택 안 함</option>
                {INTRO_JOBS.map((j) => (
                  <option key={j.key} value={j.key}>
                    {j.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <Field id="req-message" label="한마디" hint="150자까지 보낼 수 있어요.">
          <textarea
            id="req-message"
            required
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            maxLength={150}
            placeholder="어떤 점이 좋았는지, 어떤 사람인지 짧게 적어주세요"
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
        {busy ? '보내는 중…' : `신청 보내기 (오늘 ${remaining}회 남음)`}
      </button>
    </form>
  );
}
