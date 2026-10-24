'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { inputClass } from '../Field';
import type { AdminBoard } from '@/lib/types';
import { boardTone } from '@/lib/boards';

type Draft = { name: string; description: string; isAnonymousAllowed: boolean; sortOrder: string };

const draftOf = (b: AdminBoard): Draft => ({
  name: b.name,
  description: b.description ?? '',
  isAnonymousAllowed: !!b.isAnonymousAllowed,
  sortOrder: String(b.sortOrder ?? 0),
});

/**
 * Board CRUD over /api/admin/boards. The slug is the board's identity — the app,
 * the web and every post's trade/prefix rules key off it — so it is set once at
 * creation and never edited here.
 */
export default function BoardManager({ boards }: { boards: AdminBoard[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState({ slug: '', name: '', description: '', isAnonymousAllowed: false, sortOrder: '0' });

  const general = boards.filter((b) => !b.isUniversityBoard);
  const school = boards.filter((b) => b.isUniversityBoard);

  async function call(key: string, path: string, method: string, body?: unknown) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/boards${path}`, {
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

  async function saveEdit(b: AdminBoard) {
    if (!draft || !draft.name.trim()) return setError('이름을 입력해주세요.');
    const ok = await call(b.id, `/${b.id}`, 'PUT', {
      name: draft.name.trim(),
      description: draft.description.trim(),
      isAnonymousAllowed: draft.isAnonymousAllowed,
      sortOrder: Number(draft.sortOrder) || 0,
    });
    if (ok) setEditing(null);
  }

  async function remove(b: AdminBoard) {
    if (!window.confirm(`'${b.name}' 게시판을 지울까요? 되돌릴 수 없어요.`)) return;
    await call(b.id, `/${b.id}`, 'DELETE');
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const slug = fresh.slug.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,30}$/.test(slug)) {
      return setError('slug는 영문 소문자로 시작하고 영문·숫자·하이픈만 쓸 수 있어요 (2–31자).');
    }
    if (!fresh.name.trim()) return setError('이름을 입력해주세요.');
    if (
      !window.confirm(
        `'${slug}' 게시판을 만들까요? slug는 나중에 바꿀 수 없어요. 앱에 아이콘·색이 없는 새 slug면 기본 모양으로 보여요.`
      )
    ) {
      return;
    }
    const ok = await call('new', '', 'POST', {
      slug,
      name: fresh.name.trim(),
      description: fresh.description.trim(),
      isAnonymousAllowed: fresh.isAnonymousAllowed,
      sortOrder: Number(fresh.sortOrder) || 0,
    });
    if (ok) {
      setCreating(false);
      setFresh({ slug: '', name: '', description: '', isAnonymousAllowed: false, sortOrder: '0' });
    }
  }

  function row(b: AdminBoard) {
    const on = editing === b.id && draft;
    const working = busy === b.id;
    return (
      <li key={b.id} className="border-b border-line-faint px-5 py-4 last:border-b-0 sm:px-6">
        {on ? (
          <div className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
              <Field id={`name-${b.id}`} label="이름">
                <input
                  id={`name-${b.id}`}
                  value={draft.name}
                  maxLength={40}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field id={`order-${b.id}`} label="순서">
                <input
                  id={`order-${b.id}`}
                  type="number"
                  value={draft.sortOrder}
                  onChange={(e) => setDraft({ ...draft, sortOrder: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field id={`desc-${b.id}`} label="설명">
              <input
                id={`desc-${b.id}`}
                value={draft.description}
                maxLength={100}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-[14px]">
              <input
                type="checkbox"
                checked={draft.isAnonymousAllowed}
                onChange={(e) => setDraft({ ...draft, isAnonymousAllowed: e.target.checked })}
                className="size-4.5 accent-brand-strong"
              />
              익명 게시판 (글과 댓글이 모두 익명)
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => saveEdit(b)}
                disabled={working}
                className="h-10 rounded-control bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-55"
              >
                {working ? '저장 중…' : '저장'}
              </button>
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="h-10 rounded-control border border-line-strong px-4 text-sm font-semibold text-ink-3"
              >
                취소
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: boardTone(b.slug).dot }} />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                {b.name}
                <code className="rounded bg-field px-1.5 py-0.5 text-[12px] font-normal text-muted">{b.slug}</code>
                {b.isAnonymousAllowed ? (
                  <span className="rounded bg-brand-tint px-1.5 py-0.5 text-[11.5px] font-bold text-brand-ink-hover">익명</span>
                ) : null}
                {b.university ? <span className="text-[12.5px] font-normal text-muted">{b.university}</span> : null}
              </p>
              <p className="mt-0.5 text-[13px] text-muted">
                {[b.description, `순서 ${b.sortOrder ?? 0}`, `글 ${b.postCount}개`].filter(Boolean).join(' · ')}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditing(b.id);
                setDraft(draftOf(b));
              }}
              className="h-9 rounded-control border border-line-strong px-3 text-[13px] font-semibold text-ink-3 hover:bg-field"
            >
              수정
            </button>
            <button
              type="button"
              onClick={() => remove(b)}
              disabled={working || b.postCount > 0}
              title={b.postCount > 0 ? '글이 있는 게시판은 지울 수 없어요' : undefined}
              className="h-9 rounded-control px-3 text-[13px] font-semibold text-danger hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:text-muted disabled:hover:bg-transparent"
            >
              삭제
            </button>
          </div>
        )}
      </li>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
        <div className="flex items-center justify-between border-b border-line-faint px-5 py-3.5 sm:px-6">
          <h2 className="text-[16px] font-bold">일반 게시판 {general.length}</h2>
          <button
            type="button"
            onClick={() => setCreating((v) => !v)}
            className="h-9 rounded-control bg-brand-strong px-3.5 text-[13.5px] font-semibold text-white hover:bg-brand-ink-hover"
          >
            {creating ? '닫기' : '+ 새 게시판'}
          </button>
        </div>
        {creating ? (
          <form onSubmit={create} className="flex flex-col gap-3 border-b border-line-faint bg-field/50 px-5 py-4 sm:px-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="new-slug" label="slug (영문, 바꿀 수 없음)" hint="예: books">
                <input
                  id="new-slug"
                  value={fresh.slug}
                  onChange={(e) => setFresh({ ...fresh, slug: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field id="new-name" label="이름">
                <input
                  id="new-name"
                  value={fresh.name}
                  maxLength={40}
                  onChange={(e) => setFresh({ ...fresh, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <Field id="new-desc" label="설명 (선택)">
              <input
                id="new-desc"
                value={fresh.description}
                maxLength={100}
                onChange={(e) => setFresh({ ...fresh, description: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={fresh.isAnonymousAllowed}
                  onChange={(e) => setFresh({ ...fresh, isAnonymousAllowed: e.target.checked })}
                  className="size-4.5 accent-brand-strong"
                />
                익명 게시판
              </label>
              <label className="flex items-center gap-2 text-[14px]">
                순서
                <input
                  type="number"
                  value={fresh.sortOrder}
                  onChange={(e) => setFresh({ ...fresh, sortOrder: e.target.value })}
                  className={`${inputClass} w-24`}
                />
              </label>
              <button
                type="submit"
                disabled={busy === 'new'}
                className="ml-auto h-10 rounded-control bg-brand-strong px-4 text-sm font-semibold text-white disabled:opacity-55"
              >
                {busy === 'new' ? '만드는 중…' : '만들기'}
              </button>
            </div>
          </form>
        ) : null}
        <ul>{general.map(row)}</ul>
      </section>

      {school.length > 0 ? (
        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          <h2 className="border-b border-line-faint px-5 py-3.5 text-[16px] font-bold sm:px-6">
            학교 게시판 {school.length}
          </h2>
          <ul>{school.map(row)}</ul>
        </section>
      ) : null}
    </div>
  );
}
