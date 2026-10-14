'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from '../Field';
import { INTRO_CONTACT_TYPES, INTRO_EXPIRY_DAYS, INTRO_GENDERS, INTRO_JOBS } from '@/lib/intro';
import type { IntroMeta } from '@/lib/types';

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
        throw new Error(json.message || '업로드에 실패했어요.');
      }
      setPhoto(json.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : '업로드에 실패했어요.');
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
      if (!res.ok || !json.success) throw new Error(json.message || '등록하지 못했어요.');
      router.refresh();
      router.replace(`/intro/${json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '등록하지 못했어요.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset>
        <legend className="text-[13.5px] font-semibold text-ink-3">누구를 소개하나요?</legend>
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
              내 소개
              <span className="block text-[13px] text-muted">직접 올리는 소개예요.</span>
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
              지인 소개
              <span className="block text-[13px] text-muted">
                소개할 분의 동의를 먼저 받아야 해요.
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
            소개할 분의 동의를 받았어요
            <span className="block text-[13px] text-muted">
              동의 없이 올리면 신고 대상이 될 수 있어요.
            </span>
          </span>
        </label>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[120px] flex-1">
          <Field id="intro-gender" label="성별">
            <select
              id="intro-gender"
              required
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className={inputClass}
            >
              <option value="">선택</option>
              {INTRO_GENDERS.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="min-w-[120px] flex-1">
          <Field id="intro-birthYear" label="출생연도">
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
          <Field id="intro-height" label="키 (선택)">
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
          <Field id="intro-region" label="지역">
            <input
              id="intro-region"
              required
              maxLength={40}
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              placeholder="노스욕"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[160px] flex-1">
          <Field id="intro-job" label="직업 (선택)">
            <select id="intro-job" value={job} onChange={(e) => setJob(e.target.value)} className={inputClass}>
              <option value="">선택 안 함</option>
              {INTRO_JOBS.map((j) => (
                <option key={j.key} value={j.key}>
                  {j.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field
        id="intro-headline"
        label="한 줄 소개"
        hint="실명, 회사명, 연락처는 적지 않아요. 60자까지 쓸 수 있어요."
      >
        <input
          id="intro-headline"
          required
          maxLength={60}
          value={headline}
          onChange={(e) => setHeadline(e.target.value)}
          placeholder="주말엔 하이킹, 평일엔 집밥 해먹는 사람"
          className={inputClass}
        />
      </Field>

      <Field id="intro-bio" label="자기소개 (선택)">
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
        <legend className="px-1 text-[13.5px] font-semibold text-ink-3">찾는 사람 (선택)</legend>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[110px] flex-1">
            <label htmlFor="intro-pref-min" className="block text-[12.5px] text-muted">
              출생연도 (이후)
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
              출생연도 (이전)
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
              지역
            </label>
            <input
              id="intro-pref-region"
              maxLength={40}
              value={preferredRegion}
              onChange={(e) => setPreferredRegion(e.target.value)}
              placeholder="토론토 전체"
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="rounded-control border border-line-strong px-3.5 py-3">
        <legend className="px-1 text-[13.5px] font-semibold text-ink-3">연락처 (선택)</legend>
        <p className="text-[12.5px] leading-relaxed text-muted">
          다른 사람에게는 보이지 않아요. 채팅이 열린 뒤 직접 알려줄 때 참고용으로만 저장돼요.
        </p>
        <div className="mt-2 flex flex-wrap gap-3">
          <div className="min-w-[140px] flex-1">
            <select
              aria-label="연락처 종류"
              value={contactType}
              onChange={(e) => setContactType(e.target.value)}
              className={inputClass}
            >
              <option value="">선택 안 함</option>
              {INTRO_CONTACT_TYPES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          {contactType ? (
            <div className="min-w-[160px] flex-1">
              <input
                aria-label="연락처"
                maxLength={100}
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                placeholder={contactType === 'kakao' ? '카카오톡 ID' : '@instagram'}
                className={inputClass}
              />
            </div>
          ) : null}
        </div>
      </fieldset>

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">사진 (선택)</span>
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
            {uploading ? '올리는 중…' : photo ? '사진 바꾸기' : '사진 올리기'}
          </button>
          {photo ? (
            <button
              type="button"
              onClick={() => setPhoto('')}
              className="text-[13px] text-muted hover:text-danger"
            >
              제거
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
        소개는 {INTRO_EXPIRY_DAYS}일 뒤 자동으로 내려가요. 닉네임과 프로필은 공개되지 않아요.
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
          {busy ? '올리는 중…' : '소개 올리기'}
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
