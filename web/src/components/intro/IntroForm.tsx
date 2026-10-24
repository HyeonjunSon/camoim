'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from '../Field';
import { INTRO_CONTACT_TYPES, INTRO_EXPIRY_DAYS, INTRO_GENDERS, INTRO_JOBS } from '@/lib/intro';
import type { IntroMeta } from '@/lib/types';
import { useLang, useMessages } from '@/lib/i18n/client';
import { labelFor } from '@/lib/i18n/lang';

export default function IntroForm({ meta }: { meta: IntroMeta }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<'self' | 'proxy'>('self');
  const [proxyConsent, setProxyConsent] = useState(false);
  const [gender, setGender] = useState<string>(meta.defaults.gender ?? '');
  const [birthYear, setBirthYear] = useState(
    meta.defaults.birthYear ? String(meta.defaults.birthYear) : ''
  );
  const [region, setRegion] = useState(meta.defaults.region ?? '');
  const [job, setJob] = useState<string>(meta.defaults.job ?? '');
  const [height, setHeight] = useState('');
  const [headline, setHeadline] = useState('');
  const [bio, setBio] = useState('');
  const [photo, setPhoto] = useState('');
  const [preferredMin, setPreferredMin] = useState('');
  const [preferredMax, setPreferredMax] = useState('');
  const [preferredRegion, setPreferredRegion] = useState('');
  const [contactType, setContactType] = useState('');
  const [contactValue, setContactValue] = useState('');

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const all = useMessages();
  const m = all.intro;
  const lang = useLang();

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload/intro', { method: 'POST', body });
      const json = await res.json();
      // This endpoint answers with a bare `url`, not `data.url`.
      if (!res.ok || !json.success || !json.url) {
        throw new Error(json.message || all.common.uploadFailed);
      }
      setPhoto(json.url as string);
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
      const res = await fetch('/api/bff/intro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          proxyConsent: mode === 'proxy' ? proxyConsent : undefined,
          gender,
          birthYear: Number(birthYear),
          region: region.trim(),
          job,
          height: height.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          photo,
          // Null rather than '' matters here: the API checks for null before it
          // coerces, and Number('') is 0, which is a finite year.
          preferredBirthYearMin: preferredMin ? Number(preferredMin) : null,
          preferredBirthYearMax: preferredMax ? Number(preferredMax) : null,
          preferredRegion: preferredRegion.trim(),
          contactType,
          contactValue: contactValue.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || m.postFailed);
      router.refresh();
      router.replace(`/intro/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : m.postFailed);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-[13.5px] font-semibold text-ink-3">{m.who}</legend>
        <div className="mt-2 flex flex-col gap-1.5">
          <label className="flex items-start gap-2.5 text-[15px]">
            <input
              type="radio"
              name="mode"
              checked={mode === 'self'}
              onChange={() => setMode('self')}
              className="mt-1 size-4.5 accent-brand-strong"
            />
            <span>
              {m.self}
              <span className="block text-[13px] text-muted">{m.selfHint}</span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-[15px]">
            <input
              type="radio"
              name="mode"
              checked={mode === 'proxy'}
              onChange={() => setMode('proxy')}
              className="mt-1 size-4.5 accent-brand-strong"
            />
            <span>
              {m.proxy}
              <span className="block text-[13px] text-muted">
                {m.proxyHint}
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {mode === 'proxy' ? (
        <label className="flex items-start gap-2.5 rounded-control border border-line-strong px-3.5 py-3 text-[15px]">
          <input
            type="checkbox"
            checked={proxyConsent}
            onChange={(e) => setProxyConsent(e.target.checked)}
            className="mt-1 size-4.5 accent-brand-strong"
          />
          <span>
            {m.proxyConsent}
            <span className="block text-[13px] text-muted">
              {m.proxyConsentHint}
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[120px] flex-1">
          <Field id="intro-gender" label={m.gender}>
            <select
              id="intro-gender"
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              <option value="">{m.pick}</option>
              {INTRO_GENDERS.map((g) => (
                <option key={g.key} value={g.key}>
                  {labelFor(g, lang)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="min-w-[120px] flex-1">
          <Field id="intro-birthYear" label={m.birthYear}>
            <input
              id="intro-birthYear"
              required
              inputMode="numeric"
              maxLength={4}
              value={birthYear}
              onChange={(e) => setBirthYear(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="1998"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[110px] flex-1">
          <Field id="intro-height" label={m.heightOptional}>
            <input
              id="intro-height"
              maxLength={20}
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="170cm"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[160px] flex-1">
          <Field id="intro-region" label={m.region}>
            <input
              id="intro-region"
              required
              maxLength={40}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder={m.regionPlaceholder}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[160px] flex-1">
          <Field id="intro-job" label={m.jobOptional}>
            <select id="intro-job" value={job} onChange={(e) => setJob(e.target.value)} className={inputClass}>
              <option value="">{all.common.none}</option>
              {INTRO_JOBS.map((j) => (
                <option key={j.key} value={j.key}>
                  {labelFor(j, lang)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field
        id="intro-headline"
        label={m.headline}
        hint={m.headlineHint}
      >
        <input
          id="intro-headline"
          required
          maxLength={60}
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder={m.headlinePlaceholder}
          className={inputClass}
        />
      </Field>

      <Field id="intro-bio" label={m.bioOptional}>
        <textarea
          id="intro-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={5}
          maxLength={1000}
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      <fieldset className="rounded-control border border-line-strong px-3.5 py-3">
        <legend className="px-1 text-[13.5px] font-semibold text-ink-3">{m.preferOptional}</legend>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[110px] flex-1">
            <label htmlFor="intro-pref-min" className="block text-[12.5px] text-muted">
              {m.birthFrom}
            </label>
            <input
              id="intro-pref-min"
              inputMode="numeric"
              maxLength={4}
              value={preferredMin}
              onChange={(e) => setPreferredMin(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="1990"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div className="min-w-[110px] flex-1">
            <label htmlFor="intro-pref-max" className="block text-[12.5px] text-muted">
              {m.birthTo}
            </label>
            <input
              id="intro-pref-max"
              inputMode="numeric"
              maxLength={4}
              value={preferredMax}
              onChange={(e) => setPreferredMax(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="2002"
              className={`${inputClass} mt-1`}
            />
          </div>
          <div className="min-w-[140px] flex-1">
            <label htmlFor="intro-pref-region" className="block text-[12.5px] text-muted">
              {m.region}
            </label>
            <input
              id="intro-pref-region"
              maxLength={40}
              value={preferredRegion}
              onChange={(e) => setPreferredRegion(e.target.value)}
              placeholder={m.preferRegionPlaceholder}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-control border border-line-strong px-3.5 py-3">
        <legend className="px-1 text-[13.5px] font-semibold text-ink-3">{m.contactOptional}</legend>
        <p className="text-[12.5px] leading-relaxed text-muted">
          {m.contactNote}
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="min-w-[140px] flex-1">
            <select
              aria-label={m.contactType}
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
              className={inputClass}
            >
              <option value="">{all.common.none}</option>
              {INTRO_CONTACT_TYPES.map((c) => (
                <option key={c.key} value={c.key}>
                  {labelFor(c, lang)}
                </option>
              ))}
            </select>
          </div>
          {contactType ? (
            <div className="min-w-[160px] flex-1">
              <input
                aria-label={m.contact}
                maxLength={100}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactType === 'kakao' ? m.kakaoId : '@instagram'}
                className={inputClass}
              />
            </div>
          ) : null}
        </div>
      </fieldset>

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">{m.photoOptional}</span>
        <div className="mt-2 flex items-center gap-3">
          {photo ? (
            <div className="relative size-24 overflow-hidden rounded-xl bg-shade">
              <Image src={photo} alt="" fill sizes="96px" className="object-cover" />
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="h-10 rounded-control border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
          >
            {uploading ? all.business.uploading : photo ? all.group.changePhoto : all.group.uploadPhoto}
          </button>
          {photo ? (
            <button
              type="button"
              onClick={() => setPhoto('')}
              className="text-[13px] text-muted hover:text-danger"
            >
              {all.group.remove}
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

      <p className="rounded-[10px] bg-field px-3.5 py-3 text-[13px] leading-relaxed text-muted">
        {m.expiry(INTRO_EXPIRY_DAYS)}
      </p>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={
            busy ||
            !gender ||
            !birthYear ||
            !region.trim() ||
            !headline.trim() ||
            (mode === 'proxy' && !proxyConsent)
          }
          className="flex h-12 items-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
        >
          {busy ? m.posting : m.post}
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
