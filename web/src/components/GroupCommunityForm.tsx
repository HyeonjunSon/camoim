'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { inputClass } from './Field';
import type { CommunityLinks } from '@/lib/types';
import { useMessages } from '@/lib/i18n/client';

const FIELDS: { key: 'instagram' | 'kakaoOpen' | 'discord' | 'homepage'; placeholder: string }[] = [
  { key: 'instagram', placeholder: '@camoim' },
  { key: 'kakaoOpen', placeholder: 'https://open.kakao.com/o/...' },
  { key: 'discord', placeholder: 'https://discord.gg/...' },
  { key: 'homepage', placeholder: 'https://...' },
];

/**
 * Shared shape with the school community card: both take the same five fields
 * and both normalise them server-side, so nothing is rewritten here.
 */
export default function GroupCommunityForm({
  groupId,
  community,
}: {
  groupId: string;
  community: CommunityLinks;
}) {
  const router = useRouter();
  const [links, setLinks] = useState<CommunityLinks>(community);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const all = useMessages();
  const c = all.community;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/bff/groups/${groupId}/community`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(links),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.common.saveFailed);
      if (json.data) setLinks(json.data as CommunityLinks);
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.saveFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {FIELDS.map((f) => (
        <Field key={f.key} id={`community-${f.key}`} label={c[f.key]} hint={f.key === 'instagram' ? c.instagramHint : undefined}>
          <input
            id={`community-${f.key}`}
            value={links[f.key]}
            onChange={(e) => setLinks((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className={inputClass}
          />
        </Field>
      ))}

      <Field id="community-notice" label={c.noticeOptional}>
        <textarea
          id="community-notice"
          value={links.notice}
          onChange={(e) => setLinks((prev) => ({ ...prev, notice: e.target.value }))}
          rows={3}
          maxLength={300}
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="rounded-[10px] bg-[#E8FFF1] px-3.5 py-3 text-sm text-[#0F7A4F]">
          {all.common.saved}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex h-12 items-center justify-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55 sm:self-start"
      >
        {busy ? all.common.saving : c.saveLinks}
      </button>
    </form>
  );
}
