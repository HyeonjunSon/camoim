'use client';

import { useState } from 'react';
import Field, { inputClass } from '../Field';
import { CITIES, cityLabel } from '@/lib/boards';

const TITLE_MAX = 60; // server/routes/admin.js PUSH_TITLE_MAX
const BODY_MAX = 200; // PUSH_BODY_MAX

const ROLES = [
  { value: 'student', label: '유학생' },
  { value: 'working_holiday', label: '워킹홀리데이' },
  { value: 'general', label: '일반' },
] as const;

type Target = { city: string; university: string; role: string };

/**
 * A broadcast reaches real phones and cannot be recalled, so sending is gated:
 * the recipient count must be checked first (a dry run on the same endpoint and
 * filter), any edit after that throws the count away, and the send button names
 * the number it is about to reach before a final confirm.
 */
export default function PushComposer({ universities }: { universities: string[] }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState<Target>({ city: '', university: '', role: '' });
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState<'count' | 'send' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  // Any change invalidates a count taken for the previous message or audience.
  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setCount(null);
    setResult(null);
  };
  const setTitleE = edit(setTitle);
  const setBodyE = edit(setBody);
  const setTargetE = edit(setTarget);

  const payloadTarget = Object.fromEntries(Object.entries(target).filter(([, v]) => v));
  const audience =
    [
      target.city ? cityLabel(target.city) : null,
      target.university || null,
      target.role ? ROLES.find((r) => r.value === target.role)?.label : null,
    ]
      .filter(Boolean)
      .join(' · ') || '전체 회원';

  async function post(dryRun: boolean) {
    const res = await fetch('/api/bff/admin/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: title.trim(), body: body.trim(), target: payloadTarget, dryRun }),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
    return json.data as { count?: number; sent?: number };
  }

  async function check() {
    if (!title.trim() || !body.trim()) return setError('제목과 내용을 모두 입력해주세요.');
    setBusy('count');
    setError(null);
    try {
      const data = await post(true);
      setCount(data.count ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    if (count === null || count === 0) return;
    if (
      !window.confirm(
        `${audience} ${count.toLocaleString('en-CA')}명에게 지금 보낼까요?\n\n“${title.trim()}”\n\n보낸 뒤에는 취소할 수 없어요.`
      )
    ) {
      return;
    }
    setBusy('send');
    setError(null);
    try {
      const data = await post(false);
      setResult(`${(data.sent ?? 0).toLocaleString('en-CA')}명에게 보냈어요. 운영 로그에 남았어요.`);
      setCount(null);
      setTitle('');
      setBody('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '보내지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-4 rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
        <Field id="push-title" label={`제목 (${title.length}/${TITLE_MAX})`}>
          <input
            id="push-title"
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitleE(e.target.value)}
            placeholder="캐모임 공지"
            className={inputClass}
          />
        </Field>
        <Field id="push-body" label={`내용 (${body.length}/${BODY_MAX})`}>
          <textarea
            id="push-body"
            value={body}
            maxLength={BODY_MAX}
            rows={3}
            onChange={(e) => setBodyE(e.target.value)}
            placeholder="알림에 보일 내용"
            className={`${inputClass} h-auto py-2.5`}
          />
        </Field>

        <fieldset>
          <legend className="text-[13.5px] font-semibold text-ink-3">
            받는 사람 <span className="font-normal text-muted">(비워두면 전체)</span>
          </legend>
          <div className="mt-1.5 grid gap-3 sm:grid-cols-3">
            <select
              aria-label="도시"
              value={target.city}
              onChange={(e) => setTargetE({ ...target, city: e.target.value })}
              className={inputClass}
            >
              <option value="">모든 도시</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {cityLabel(c)}
                </option>
              ))}
            </select>
            <select
              aria-label="학교"
              value={target.university}
              onChange={(e) => setTargetE({ ...target, university: e.target.value })}
              className={inputClass}
            >
              <option value="">모든 학교</option>
              {universities.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <select
              aria-label="신분"
              value={target.role}
              onChange={(e) => setTargetE({ ...target, role: e.target.value })}
              className={inputClass}
            >
              <option value="">모든 신분</option>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </fieldset>
      </section>

      {/* Roughly how it lands on a lock screen. */}
      <section aria-label="미리보기" className="rounded-card bg-[#1C1C1E] px-4 py-4">
        <div className="rounded-[16px] bg-white/90 px-3.5 py-3">
          <p className="flex items-center gap-1.5 text-[12px] text-[#6E6E73]">
            <span className="flex size-4 items-center justify-center rounded-[4px] bg-brand text-[9px] font-bold text-white">C</span>
            CAMOIM · 지금
          </p>
          <p className="mt-1 text-[14.5px] font-semibold text-[#1C1C1E]">{title.trim() || '제목'}</p>
          <p className="mt-0.5 text-[14px] leading-snug whitespace-pre-wrap text-[#1C1C1E]">{body.trim() || '내용'}</p>
        </div>
      </section>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
      {result ? (
        <p role="status" className="rounded-[10px] bg-positive-tint px-3.5 py-3 text-sm text-positive">
          {result}
        </p>
      ) : null}

      <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
        {count === null ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[14px] text-ink-3">
              받는 사람: <strong>{audience}</strong>
            </p>
            <button
              type="button"
              onClick={check}
              disabled={busy !== null}
              className="h-11 rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-2 hover:bg-field disabled:opacity-55"
            >
              {busy === 'count' ? '세는 중…' : '받는 사람 수 확인'}
            </button>
          </div>
        ) : count === 0 ? (
          <p className="text-[14px] text-ink-3">
            이 조건으로 알림을 받을 수 있는 회원이 없어요. 대상을 바꿔보세요.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-[15px]">
              <strong>{audience}</strong> 중 알림을 켜 둔{' '}
              <strong className="text-danger tabular-nums">{count.toLocaleString('en-CA')}명</strong>에게 보내져요.
              <span className="mt-1 block text-[13px] text-muted">보낸 뒤에는 취소할 수 없어요.</span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={send}
                disabled={busy !== null}
                className="h-11 rounded-control bg-danger px-4 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-55"
              >
                {busy === 'send' ? '보내는 중…' : `${count.toLocaleString('en-CA')}명에게 보내기`}
              </button>
              <button
                type="button"
                onClick={() => setCount(null)}
                disabled={busy !== null}
                className="h-11 rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3"
              >
                다시 확인
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
