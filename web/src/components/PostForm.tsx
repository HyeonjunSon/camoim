'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import PostEditor from './PostEditor';
import Field, { inputClass } from './Field';
import { CITIES, cityLabel, isLocalBoard } from '@/lib/boards';
import type { Board } from '@/lib/types';

type Props = {
  boards: Board[];
  /** Present when editing; absent when writing a new post. */
  postId?: string;
  initialBoardSlug?: string;
  initialTitle?: string;
  initialHtml?: string;
  initialCity?: string;
  /** The user's own city, used as the default on a local board. */
  defaultCity?: string;
};

/** Strips tags to decide whether the body is actually empty. */
function isBlank(html: string): boolean {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim().length === 0;
}

export default function PostForm({
  boards,
  postId,
  initialBoardSlug,
  initialTitle = '',
  initialHtml = '',
  initialCity = '',
  defaultCity = '',
}: Props) {
  const router = useRouter();
  const editing = !!postId;

  const writable = useMemo(
    // The intro board has its own model and its own age gate, so it is never
    // written through this form.
    () => boards.filter((b) => b.slug !== 'intro'),
    [boards]
  );

  const [slug, setSlug] = useState(initialBoardSlug ?? writable[0]?.slug ?? '');
  const [title, setTitle] = useState(initialTitle);
  const [html, setHtml] = useState(initialHtml);
  const [city, setCity] = useState(initialCity || defaultCity);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const board = writable.find((b) => b.slug === slug);
  const needsCity = isLocalBoard(slug);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!board) return setError('게시판을 선택해주세요.');
    if (!title.trim()) return setError('제목을 입력해주세요.');
    if (isBlank(html)) return setError('내용을 입력해주세요.');

    setBusy(true);
    setError(null);
    try {
      const path = editing ? `/api/bff/posts/${postId}` : '/api/bff/posts';
      const res = await fetch(path, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? {} : { boardId: board.id }),
          title: title.trim(),
          content: html,
          city: needsCity ? city : '',
        }),
      });
      const json = await res.json();
      // Banned-word rejections come back with the server's own message.
      if (!res.ok || !json.success) throw new Error(json.message || '저장하지 못했어요.');

      router.refresh();
      router.replace(editing ? `/posts/${postId}` : `/posts/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {!editing ? (
        <Field id="board" label="게시판">
          <select
            id="board"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
          >
            {writable.map((b) => (
              <option key={b.id} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-[13.5px] text-muted">
          <span className="font-semibold text-ink-3">{board?.name ?? '게시판'}</span> 글을 수정하고
          있어요. 게시판은 바꿀 수 없어요.
        </p>
      )}

      {board?.isAnonymousAllowed ? (
        <p className="rounded-[10px] bg-brand-tint px-3.5 py-3 text-[13.5px] text-brand-ink-hover">
          이 게시판은 익명으로 올라가요. 닉네임은 표시되지 않아요.
        </p>
      ) : null}

      <Field id="title" label="제목">
        <input
          id="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력해주세요"
          className={inputClass}
        />
      </Field>

      {needsCity ? (
        <Field id="city" label="도시" hint="지역 게시판이라 도시를 함께 보여줘요.">
          <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
            <option value="">선택 안 함</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {cityLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">내용</span>
        <div className="mt-1.5">
          <PostEditor initialHtml={initialHtml} onChange={setHtml} />
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={busy}
          className="flex h-12 items-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
        >
          {busy ? '저장 중…' : editing ? '수정 완료' : '올리기'}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-12 items-center rounded-control border border-line-strong px-5 text-base font-semibold text-ink-3 hover:bg-field"
        >
          취소
        </button>
      </div>
    </form>
  );
}
