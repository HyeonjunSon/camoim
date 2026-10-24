'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import PostEditor from './PostEditor';
import Field, { inputClass } from './Field';
import { CITIES, boardName, boardPrefixes, cityLabel, isLocalBoard, prefixText } from '@/lib/boards';
import { useLang, useMessages } from '@/lib/i18n/client';
import type { Board } from '@/lib/types';

type Props = {
  boards: Board[];
  /** Present when editing; absent when writing a new post. */
  postId?: string;
  /**
   * Writing into a group instead of a board. A post carries one or the other,
   * never both (Post has a pre-validate hook for it), and a group post is never
   * anonymous.
   */
  group?: { id: string; name: string };
  initialBoardSlug?: string;
  initialTitle?: string;
  initialHtml?: string;
  initialCity?: string;
  initialPrefix?: string;
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
  group,
  initialBoardSlug,
  initialTitle = '',
  initialHtml = '',
  initialCity = '',
  initialPrefix = '',
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
  const [prefix, setPrefix] = useState(initialPrefix);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const all = useMessages();
  const m = all.write;
  const lang = useLang();

  const board = writable.find((b) => b.slug === slug);
  const needsCity = !group && isLocalBoard(slug);
  const prefixOptions = group ? [] : boardPrefixes(slug);
  // A prefix from the previously picked board is not sent; the server would drop it anyway.
  const sentPrefix = prefixOptions.some((p) => p.key === prefix) ? prefix : '';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!group && !board) return setError(m.pickBoard);
    if (!title.trim()) return setError(m.needTitle);
    if (isBlank(html)) return setError(m.needBody);

    setBusy(true);
    setError(null);
    try {
      const path = editing ? `/api/bff/posts/${postId}` : '/api/bff/posts';
      const res = await fetch(path, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? {} : group ? { groupId: group.id } : { boardId: board!.id }),
          title: title.trim(),
          content: html,
          city: needsCity ? city : '',
          ...(prefixOptions.length ? { prefix: sentPrefix } : {}),
        }),
      });
      const json = await res.json();
      // Banned-word rejections come back with the server's own message.
      if (!res.ok || !json.success) throw new Error(json.message || all.common.saveFailed);

      router.refresh();
      router.replace(editing ? `/posts/${postId}` : `/posts/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.saveFailed);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      {group ? (
        <p className="text-[13.5px] text-muted">
          {m.groupNotePre}
          <span className="font-semibold text-ink-3">{group.name}</span>
          {m.groupNotePost}
        </p>
      ) : !editing ? (
        <Field id="board" label={m.board}>
          <select
            id="board"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className={inputClass}
          >
            {writable.map((b) => (
              <option key={b.id} value={b.slug}>
                {boardName(b.slug, b.name, lang)}
              </option>
            ))}
          </select>
        </Field>
      ) : (
        <p className="text-[13.5px] text-muted">
          {m.editingPre}
          <span className="font-semibold text-ink-3">
            {board ? boardName(board.slug, board.name, lang) : m.board}
          </span>
          {m.editingPost}
        </p>
      )}

      {!group && board?.isAnonymousAllowed ? (
        <p className="rounded-[10px] bg-brand-tint px-3.5 py-3 text-[13.5px] text-brand-ink-hover">
          {m.anonymousNote}
        </p>
      ) : null}

      {prefixOptions.length ? (
        <fieldset>
          <legend className="text-[13.5px] font-semibold text-ink-3">
            {m.prefix} <span className="font-normal text-muted">{m.optional}</span>
          </legend>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {prefixOptions.map((p) => {
              const on = sentPrefix === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  aria-pressed={on}
                  // Tap the chosen one again to clear it — the prefix is optional.
                  onClick={() => setPrefix(on ? '' : p.key)}
                  className={`h-9 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors ${
                    on ? 'bg-brand-strong text-white' : 'bg-field text-ink-3 hover:bg-shade'
                  }`}
                >
                  {prefixText(p, lang)}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <Field id="title" label={m.titleLabel}>
        <input
          id="title"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m.titlePlaceholder}
          className={inputClass}
        />
      </Field>

      {needsCity ? (
        <Field id="city" label={m.city} hint={m.cityHint}>
          <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
            <option value="">{all.common.none}</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {cityLabel(c, lang)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">{m.body}</span>
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
          {busy ? all.common.saving : editing ? m.update : m.publish}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          className="flex h-12 items-center rounded-control border border-line-strong px-5 text-base font-semibold text-ink-3 hover:bg-field"
        >
          {all.common.cancel}
        </button>
      </div>
    </form>
  );
}
