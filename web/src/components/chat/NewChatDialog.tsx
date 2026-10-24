'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';
import { initial } from '@/lib/format';
import type { SearchResults } from '@/lib/types';
import { useMessages } from '@/lib/i18n/client';

type Member = SearchResults['users'][number];

/**
 * Starting a conversation from the chat tab itself.
 *
 * Every other entry point is somewhere else — a trade post, a profile, a group —
 * so with no conversations yet the chat tab had nothing to act on and read as
 * broken. A first DM goes out as a request: one message is allowed until the
 * other side accepts.
 */
export default function NewChatDialog() {
  const router = useRouter();
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Member[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.chat;

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    // The API ignores anything shorter, so say so rather than showing "no results".
    if (q.length < 2) {
      setError(m.twoChars);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/bff/search?q=${encodeURIComponent(q)}&type=users&limit=10`
      );
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.searchFailed);
      setResults((json.data as SearchResults).users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.searchFailed);
    } finally {
      setSearching(false);
    }
  }

  async function start(member: Member) {
    setBusy(member.id);
    setError(null);
    try {
      const res = await fetch('/api/bff/chats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: member.id }),
      });
      const json = await res.json();
      // A block in either direction answers 403 with its own message.
      if (!res.ok || !json.success) throw new Error(json.message || all.post.chatFailed);
      setOpen(false);
      router.refresh();
      router.push(`/chat/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : all.post.chatFailed);
      setBusy(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="flex h-9 shrink-0 items-center gap-1 rounded-pill bg-brand-strong px-3 text-[13.5px] font-semibold text-white hover:bg-brand-ink-hover"
      >
        <span aria-hidden>+</span> {m.newChat}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`${dialogId}-title`}
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 sm:items-center sm:pt-4"
        >
          <button
            type="button"
            aria-label={all.common.close}
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="relative flex max-h-[80vh] w-full max-w-[420px] flex-col overflow-hidden rounded-card bg-surface shadow-xl">
            <div className="px-5 pt-5 pb-3">
              <h2 id={`${dialogId}-title`} className="text-lg font-bold">
                {m.newChat}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
                {m.newChatIntro}
              </p>

              <form onSubmit={search} className="mt-3.5 flex gap-2">
                <label htmlFor={`${dialogId}-q`} className="sr-only-label">
                  {m.nicknameSearch}
                </label>
                <input
                  id={`${dialogId}-q`}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={m.nickname}
                  className="h-11 min-w-0 flex-1 rounded-control border border-line-strong px-3.5 text-[15px] outline-none focus:border-brand-strong"
                />
                <button
                  type="submit"
                  disabled={searching}
                  className="h-11 shrink-0 rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white disabled:opacity-55"
                >
                  {searching ? m.searching : m.find}
                </button>
              </form>

              {error ? (
                <p role="alert" className="mt-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-2.5 text-sm text-[#B91C1C]">
                  {error}
                </p>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto border-t border-line-faint">
              {results === null ? (
                <p className="px-5 py-8 text-center text-sm text-muted">
                  {m.typeNickname}
                </p>
              ) : results.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-muted">
                  {m.noUser}
                </p>
              ) : (
                <ul>
                  {results.map((member) => (
                    <li key={member.id}>
                      <button
                        type="button"
                        onClick={() => start(member)}
                        disabled={busy === member.id}
                        className="flex w-full items-center gap-3 border-b border-line-faint px-5 py-3.5 text-left hover:bg-brand-tint-soft disabled:opacity-55"
                      >
                        {member.avatarUrl ? (
                          <Image
                            src={member.avatarUrl}
                            alt=""
                            width={40}
                            height={40}
                            className="size-10 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
                          >
                            {initial(member.nickname)}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[15px] font-semibold">
                            {member.nickname}
                          </span>
                          {member.university ? (
                            <span className="block text-xs text-muted">{member.university}</span>
                          ) : null}
                        </span>
                        <span aria-hidden className="text-muted">
                          {busy === member.id ? '…' : '›'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
