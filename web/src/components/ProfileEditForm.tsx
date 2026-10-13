'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from './Field';
import { CITIES, cityLabel } from '@/lib/boards';
import { initial } from '@/lib/format';
import type { User } from '@/lib/types';

const ROLES = [
  { value: 'student', label: '유학생' },
  { value: 'working_holiday', label: '워홀' },
  { value: 'general', label: '일반' },
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
      if (!res.ok || !json.success) throw new Error(json.message || '업로드에 실패했어요.');
      setAvatarUrl(json.data.avatarUrl);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했어요.');
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
      if (!res.ok || !json.success) throw new Error(json.message || '저장하지 못했어요.');
      setSaved(true);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
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
            {uploading ? '올리는 중…' : '사진 바꾸기'}
          </button>
          <p className="mt-1.5 text-xs text-muted">JPG, PNG, WEBP · 10MB까지</p>
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

      <Field id="nickname" label="닉네임">
        <input
          id="nickname"
          required
          maxLength={20}
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className={inputClass}
        />
      </Field>

      <Field id="bio" label="소개" hint="프로필에 공개돼요.">
        <textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={3}
          maxLength={300}
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      <Field id="city" label="지내는 도시">
        <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
          <option value="">선택 안 함</option>
          {CITIES.map((c) => (
            <option key={c} value={c}>
              {cityLabel(c)}
            </option>
          ))}
        </select>
      </Field>

      {roleEditable ? (
        <Field id="role" label="신분">
          <select id="role" value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {user.university ? (
        <p className="rounded-[10px] bg-[#DBEAFE] px-3.5 py-3 text-[13.5px] text-[#1D4ED8]">
          {user.university} 재학생으로 인증됐어요. 학교는 인증 절차로만 바뀌어요.
        </p>
      ) : null}

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
        disabled={busy || !nickname.trim()}
        className="flex h-12 items-center justify-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55 sm:self-start"
      >
        {busy ? '저장 중…' : '저장'}
      </button>
    </form>
  );
}
