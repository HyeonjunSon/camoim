'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from './Field';
import { CITIES, cityLabel } from '@/lib/boards';
import { initial } from '@/lib/format';
import type { User } from '@/lib/types';
import { useLang, useMessages } from '@/lib/i18n/client';

const ROLES = [
  { value: 'student' },
  { value: 'working_holiday' },
  { value: 'general' },
] as const;

export default function ProfileEditForm({ user }: { user: User }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nickname, setNickname] = useState(user.nickname);
  const [bio, setBio] = useState(user.bio ?? '');
  const [city, setCity] = useState(user.city ?? '');
  const [role, setRole] = useState<string>(user.role);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl ?? '');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const all = useMessages();
  const m = all.mypage;
  const lang = useLang();

  // An admin's role is not editable here; the API refuses a self-promotion and
  // offering the control would only produce a 403.
  const roleEditable = user.role !== 'admin';

  async function uploadAvatar(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload/avatar', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.common.uploadFailed);
      setAvatarUrl(json.data.avatarUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.uploadFailed);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/bff/users/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          bio,
          city,
          ...(roleEditable ? { role } : {}),
        }),
      });
      const json = await res.json();
      // 409 is a taken nickname; the API's message says so.
      if (!res.ok || !json.success) throw new Error(json.message || all.common.saveFailed);
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
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={72}
            height={72}
            className="size-18 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-18 shrink-0 items-center justify-center rounded-full bg-brand-tint text-2xl font-bold text-brand-ink"
          >
            {initial(nickname)}
          </span>
        )}
        <div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-10 rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
          >
            {uploading ? m.uploadingPhoto : m.changePhoto}
          </button>
          <p className="mt-1.5 text-xs text-muted">{m.photoHint}</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadAvatar(file);
          }}
        />
      </div>

      <Field id="nickname" label={m.nickname}>
        <input
          id="nickname"
          required
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field id="bio" label={m.bio} hint={m.bioHint}>
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={300}
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      <Field id="city" label={m.city}>
        <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
          <option value="">{all.common.none}</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {cityLabel(c, lang)}
            </option>
          ))}
        </select>
      </Field>

      {roleEditable ? (
        <Field id="role" label={m.role}>
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {m.roles[r.value]}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {user.university ? (
        <p className="rounded-[10px] bg-[#DBEAFE] px-3.5 py-3 text-[13.5px] text-[#1D4ED8]">
          {m.verifiedAt(user.university)}
        </p>
      ) : null}

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
        disabled={busy || !nickname.trim()}
        className="flex h-12 items-center justify-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55 sm:self-start"
      >
        {busy ? all.common.saving : all.common.save}
      </button>
    </form>
  );
}
