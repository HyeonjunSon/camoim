'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from './Field';
import { GROUP_CATEGORIES } from '@/lib/groups';
import { CITIES, cityLabel } from '@/lib/boards';
import type { GroupDetail, User } from '@/lib/types';
import { useLang, useMessages } from '@/lib/i18n/client';
import { labelFor } from '@/lib/i18n/lang';

export default function GroupForm({ group, user }: { group?: GroupDetail; user: User }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = !!group;

  const [name, setName] = useState(group?.name ?? '');
  const [description, setDescription] = useState(group?.description ?? '');
  const [category, setCategory] = useState<string>(group?.category ?? 'hobby');
  const [city, setCity] = useState(group?.city ?? user.city ?? '');
  const [joinPolicy, setJoinPolicy] = useState<string>(group?.joinPolicy ?? 'open');
  const [coverImage, setCoverImage] = useState(group?.coverImage ?? '');
  const [schoolOnly, setSchoolOnly] = useState(!!group?.university);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.group;
  const lang = useLang();

  // A school club can only be created by a verified member, and the API takes
  // the school from their own account rather than from this form.
  const canMakeSchoolClub = !!user.verified && !!user.university;

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      // Group covers go through the group's own endpoint once it exists; before
      // that there is no group to attach one to, so the post folder is used and
      // only the resulting URL is stored.
      const res = await fetch('/api/upload/post', { method: 'POST', body });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || all.common.uploadFailed);
      setCoverImage(json.data.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.uploadFailed);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/bff/groups/${group.id}` : '/api/bff/groups', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description,
          coverImage,
          category,
          city,
          joinPolicy,
          // Only meaningful on create; the API ignores it on edit.
          ...(editing ? {} : { schoolOnly }),
        }),
      });
      const json = await res.json();
      // 409 is a duplicate name, with the API's own wording.
      if (!res.ok || !json.success) throw new Error(json.message || all.common.saveFailed);

      router.refresh();
      router.replace(`/groups/${editing ? group.id : json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.saveFailed);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field id="name" label={m.name}>
        <input
          id="name"
          required
          minLength={2}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={m.namePlaceholder}
          className={inputClass}
        />
      </Field>

      <Field id="description" label={m.description}>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={500}
          placeholder={m.descPlaceholder}
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Field id="category" label={m.category}>
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {GROUP_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {labelFor(c, lang)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="min-w-[180px] flex-1">
          <Field id="city" label={m.cityOptional}>
            <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
              <option value="">{all.common.none}</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {cityLabel(c, lang)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <fieldset>
        <legend className="text-[13.5px] font-semibold text-ink-3">{m.joinPolicy}</legend>
        <div className="mt-2 flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-[15px]">
            <input
              type="radio"
              name="joinPolicy"
              value="open"
              checked={joinPolicy === 'open'}
              onChange={() => setJoinPolicy('open')}
              className="mt-1 size-4.5 accent-brand-strong"
            />
            <span>
              {m.open}
              <span className="block text-[13px] text-muted">{m.openHint}</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[15px]">
            <input
              type="radio"
              name="joinPolicy"
              value="approval"
              checked={joinPolicy === 'approval'}
              onChange={() => setJoinPolicy('approval')}
              className="mt-1 size-4.5 accent-brand-strong"
            />
            <span>
              {m.approval}
              <span className="block text-[13px] text-muted">
                {m.approvalHint}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {!editing ? (
        <label
          className={`flex items-start gap-2.5 rounded-control border px-3.5 py-3 text-[15px] ${
            canMakeSchoolClub ? 'border-line-strong' : 'border-line-faint bg-field'
          }`}
        >
          <input
            type="checkbox"
            checked={schoolOnly}
            disabled={!canMakeSchoolClub}
            onChange={(e) => setSchoolOnly(e.target.checked)}
            className="mt-1 size-4.5 accent-brand-strong"
          />
          <span>
            {m.makeClub}
            <span className="block text-[13px] text-muted">
              {canMakeSchoolClub
                ? m.clubHint(user.university ?? '')
                : m.clubNeedsVerify}
            </span>
          </span>
        </label>
      ) : group.university ? (
        <p className="rounded-[10px] bg-[#DBEAFE] px-3.5 py-3 text-[13.5px] text-[#1D4ED8]">
          {m.clubFixed(group.university)}
        </p>
      ) : null}

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">{m.cover}</span>
        <div className="mt-2 flex items-center gap-3">
          {coverImage ? (
            <div className="relative h-24 w-40 overflow-hidden rounded-xl bg-shade">
              <Image src={coverImage} alt="" fill sizes="160px" className="object-cover" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-10 rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
          >
            {uploading ? all.business.uploading : coverImage ? m.changePhoto : m.uploadPhoto}
          </button>
          {coverImage ? (
            <button
              type="button"
              onClick={() => setCoverImage('')}
              className="text-[13px] text-muted hover:text-danger"
            >
              {m.remove}
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload(file);
          }}
        />
      </div>

      {!editing ? (
        <p className="rounded-[10px] bg-[#FEF3C7] px-3.5 py-3 text-[13.5px] text-[#B45309]">
          {m.reviewNote}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || name.trim().length < 2}
          className="flex h-12 items-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
        >
          {busy ? all.common.saving : editing ? all.common.save : m.create}
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
