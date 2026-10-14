'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

type Candidate = { id: string; nickname: string };

/**
 * The sitting president's own controls: hand over to another verified member of
 * the same school, or step down. Both go straight to the API without an admin
 * in the middle, which is why the confirmations here are blunt.
 */
export default function LeaderHandover({ candidates }: { candidates: Candidate[] }) {
  const router = useRouter();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(path: string, method: 'PUT' | 'DELETE', body?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bff/universities${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      router.refresh();
      router.push('/school');
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
      setBusy(false);
    }
  }

  function handover() {
    const name = candidates.find((c) => c.id === target)?.nickname ?? '이 회원';
    if (!window.confirm(`${name}님에게 학생회장을 넘길까요? 넘기면 바로 권한이 사라져요.`)) return;
    call('/leader/transfer', 'PUT', { newUserId: target });
  }

  function resign() {
    if (!window.confirm('학생회장에서 사임할까요? 학교의 학생회장 자리가 비게 돼요.')) return;
    call('/leader', 'DELETE');
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label htmlFor="next-leader" className="block text-[13.5px] font-semibold text-ink-3">
          다음 학생회장
        </label>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <select
            id="next-leader"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            className="h-12 min-w-[200px] flex-1 rounded-control border border-line-strong bg-surface px-3.5 text-[15px] outline-none focus:border-brand-strong"
          >
            <option value="">같은 학교 인증 회원 중에서 고르기</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nickname}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handover}
            disabled={busy || !target}
            className="flex h-12 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
          >
            인수인계
          </button>
        </div>
        {candidates.length === 0 ? (
          <p className="mt-1.5 text-xs text-muted">
            넘길 수 있는 인증 회원이 아직 없어요.
          </p>
        ) : null}
      </div>

      <div className="border-t border-line-faint pt-4">
        <button
          type="button"
          onClick={resign}
          disabled={busy}
          className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-muted hover:bg-field hover:text-danger disabled:opacity-55"
        >
          학생회장 사임
        </button>
      </div>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
