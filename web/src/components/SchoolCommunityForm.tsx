'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { inputClass } from './Field';
import type { CommunityLinks } from '@/lib/types';

const FIELDS: { key: keyof CommunityLinks; label: string; hint?: string; placeholder: string }[] = [
  {
    key: 'instagram',
    label: '인스타그램',
    hint: '@아이디만 적어도 돼요. 저장할 때 전체 주소로 정리돼요.',
    placeholder: '@uoft.ksa',
  },
  { key: 'kakaoOpen', label: '카카오 오픈채팅', placeholder: 'https://open.kakao.com/o/...' },
  { key: 'discord', label: '디스코드', placeholder: 'https://discord.gg/...' },
  { key: 'homepage', label: '홈페이지', placeholder: 'https://...' },
];

export default function SchoolCommunityForm({ community }: { community: CommunityLinks }) {
  const router = useRouter();
  const [links, setLinks] = useState(community);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/bff/universities/community', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(links),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '저장하지 못했어요.');
      setSaved(true);
      // This endpoint answers with success only, so the normalised values come
      // back on the next render rather than from the response.
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      {FIELDS.map((f) => (
        <Field key={f.key} id={`school-${f.key}`} label={f.label} hint={f.hint}>
          <input
            id={`school-${f.key}`}
            value={links[f.key]}
            onChange={(e) => setLinks((prev) => ({ ...prev, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            className={inputClass}
          />
        </Field>
      ))}

      <Field id="school-notice" label="공지 (선택)" hint="학교 커뮤니티 맨 위에 보여요.">
        <textarea
          id="school-notice"
          value={links.notice}
          onChange={(e) => setLinks((prev) => ({ ...prev, notice: e.target.value }))}
          rows={3}
          maxLength={500}
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
          저장됐어요.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="flex h-12 items-center justify-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55 sm:self-start"
      >
        {busy ? '저장 중…' : '저장'}
      </button>
    </form>
  );
}
