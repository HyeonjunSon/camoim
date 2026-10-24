'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Field, { inputClass } from '../Field';
import type { AdminUniversity } from '@/lib/types';

type Draft = { name: string; fullName: string; sortOrder: string };

/**
 * School CRUD over /api/admin/universities.
 *
 * `name` is the key every verified member, school board and verification
 * request carries, so a rename is a migration: the server rewrites all three.
 * That is why renaming confirms separately, and why deleting is refused while
 * anything still points at the school — deactivate instead.
 */
export default function UniversityManager({ universities }: { universities: AdminUniversity[] }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<Draft>({ name: '', fullName: '', sortOrder: '0' });

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return universities;
    return universities.filter(
      (u) => u.name.toLowerCase().includes(q) || (u.fullName ?? '').toLowerCase().includes(q)
    );
  }, [query, universities]);

  async function call(key: string, path: string, method: string, body?: unknown) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/universities${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveEdit(u: AdminUniversity) {
    if (!draft || !draft.name.trim()) return setError('학교 이름을 입력해주세요.');
    const renamed = draft.name.trim() !== u.name;
    if (
      renamed &&
      !window.confirm(
        `'${u.name}' → '${draft.name.trim()}'로 바꿀까요?\n이 학교로 인증한 회원, 학교 게시판, 인증 신청의 학교 이름이 모두 함께 바뀌어요.`
      )
    ) {
      return;
    }
    const ok = await call(u.id, `/${u.id}`, 'PUT', {
      name: draft.name.trim(),
      fullName: draft.fullName.trim(),
      sortOrder: Number(draft.sortOrder) || 0,
    });
    if (ok) setEditing(null);
  }

  async function toggleActive(u: AdminUniversity) {
    const text = u.active
      ? `'${u.name}'을(를) 비활성화할까요? 학교 인증 신청 목록에서 빠져요. 기존 회원과 게시판은 그대로예요.`
      : `'${u.name}'을(를) 다시 활성화할까요?`;
    if (!window.confirm(text)) return;
    await call(u.id, `/${u.id}`, 'PUT', { active: !u.active });
  }

  async function remove(u: AdminUniversity) {
    if (!window.confirm(`'${u.name}'을(를) 지울까요? 되돌릴 수 없어요.`)) return;
    await call(u.id, `/${u.id}`, 'DELETE');
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const name = fresh.name.trim();
    if (!name) return setError('학교 이름을 입력해주세요.');
    if (!window.confirm(`'${name}'을(를) 추가할까요? 자유·익명 게시판이 함께 만들어져요.`)) return;
    const ok = await call('new', '', 'POST', {
      name,
      fullName: fresh.fullName.trim() || name,
      sortOrder: Number(fresh.sortOrder) || 0,
    });
    if (ok) setFresh({ name: '', fullName: '', sortOrder: '0' });
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C] whitespace-pre-line">
          {error}
        </p>
      ) : null}

      <form onSubmit={create} className="rounded-card border border-line-soft bg-surface px-5 py-4 sm:px-6">
        <h2 className="text-[16px] font-bold">학교 추가</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_6rem_auto] sm:items-end">
          <Field id="uni-name" label="짧은 이름" hint="회원·게시판에 저장되는 이름">
            <input
              id="uni-name"
              value={fresh.name}
              maxLength={60}
              onChange={(e) => setFresh({ ...fresh, name: e.target.value })}
              placeholder="UofT"
              className={inputClass}
            />
          </Field>
          <Field id="uni-full" label="정식 이름 (선택)">
            <input
              id="uni-full"
              value={fresh.fullName}
              maxLength={120}
              onChange={(e) => setFresh({ ...fresh, fullName: e.target.value })}
              placeholder="University of Toronto"
              className={inputClass}
            />
          </Field>
          <Field id="uni-order" label="순서">
            <input
              id="uni-order"
              type="number"
              value={fresh.sortOrder}
              onChange={(e) => setFresh({ ...fresh, sortOrder: e.target.value })}
              className={inputClass}
            />
          </Field>
          <button
            type="submit"
            disabled={busy === 'new'}
            className="h-11 rounded-control bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-55"
          >
            {busy === 'new' ? '추가 중…' : '추가'}
          </button>
        </div>
      </form>

      <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-faint px-5 py-3.5 sm:px-6">
          <h2 className="text-[16px] font-bold">
            학교 {universities.length}
            <span className="ml-2 text-[13px] font-normal text-muted">
              활성 {universities.filter((u) => u.active).length}
            </span>
          </h2>
          <label htmlFor="uni-search" className="sr-only-label">
            학교 검색
          </label>
          <input
            id="uni-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="학교 검색"
            className={`${inputClass} h-9 w-full sm:w-56`}
          />
        </div>
        <ul>
          {list.map((u) => {
            const on = editing === u.id && draft;
            const working = busy === u.id;
            return (
              <li key={u.id} className="border-b border-line-faint px-5 py-3.5 last:border-b-0 sm:px-6">
                {on ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_6rem_auto] sm:items-end">
                    <Field id={`n-${u.id}`} label="짧은 이름">
                      <input
                        id={`n-${u.id}`}
                        value={draft.name}
                        maxLength={60}
                        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field id={`f-${u.id}`} label="정식 이름">
                      <input
                        id={`f-${u.id}`}
                        value={draft.fullName}
                        maxLength={120}
                        onChange={(e) => setDraft({ ...draft, fullName: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <Field id={`o-${u.id}`} label="순서">
                      <input
                        id={`o-${u.id}`}
                        type="number"
                        value={draft.sortOrder}
                        onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                        className={inputClass}
                      />
                    </Field>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(u)}
                        disabled={working}
                        className="h-11 rounded-control bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-55"
                      >
                        {working ? '저장 중…' : '저장'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="h-11 rounded-control border border-line-strong px-3 text-sm font-semibold text-ink-3"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                        {u.name}
                        {!u.active ? (
                          <span className="rounded bg-[#EDEDF0] px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                            비활성
                          </span>
                        ) : null}
                        {u.leaderUserId ? <span title="학생회장 있음">⭐</span> : null}
                      </p>
                      <p className="mt-0.5 text-[13px] text-muted">
                        {[u.fullName && u.fullName !== u.name ? u.fullName : null, `순서 ${u.sortOrder ?? 0}`]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(u.id);
                        setDraft({ name: u.name, fullName: u.fullName ?? '', sortOrder: String(u.sortOrder ?? 0) });
                      }}
                      className="h-9 rounded-control border border-line-strong px-3 text-[13px] font-semibold text-ink-3 hover:bg-field"
                    >
                      수정
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleActive(u)}
                      disabled={working}
                      className="h-9 rounded-control border border-line-strong px-3 text-[13px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                    >
                      {u.active ? '비활성화' : '활성화'}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(u)}
                      disabled={working}
                      className="h-9 rounded-control px-3 text-[13px] font-semibold text-danger hover:bg-[#FEF2F2] disabled:opacity-55"
                    >
                      삭제
                    </button>
                  </div>
                )}
              </li>
            );
          })}
          {list.length === 0 ? (
            <li className="px-5 py-10 text-center text-sm text-muted">검색 결과가 없어요.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
