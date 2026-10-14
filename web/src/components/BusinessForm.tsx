'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from './Field';
import { BUSINESS_CATEGORIES, MAP_CITIES } from '@/lib/businesses';

const MAX_IMAGES = 5;

export default function BusinessForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState('');
  const [category, setCategory] = useState<string>(BUSINESS_CATEGORIES[0].key);
  const [city, setCity] = useState<string>(MAP_CITIES[0].key);
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [hours, setHours] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload/business', { method: 'POST', body });
      const json = await res.json();
      // This endpoint answers with a bare `url`, not `data.url`.
      if (!res.ok || !json.success || !json.url) {
        throw new Error(json.message || '업로드에 실패했어요.');
      }
      setImages((prev) => [...prev, json.url as string].slice(0, MAX_IMAGES));
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
      const res = await fetch('/api/bff/businesses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          category,
          city,
          address: address.trim(),
          phone: phone.trim(),
          hours: hours.trim(),
          description: description.trim(),
          images,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '제보하지 못했어요.');

      // An ordinary member's submission is created as `pending` and is not on
      // the map yet, so sending them to its page would show an empty result.
      // An admin's is approved immediately, so that one can go straight there.
      if (json.data?.status === 'approved') {
        router.replace(`/businesses/${json.data.id}`);
        return;
      }
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : '제보하지 못했어요.');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-card border border-line-soft bg-surface px-5 py-8 text-center sm:px-7">
        <p className="text-lg font-bold">알려주셔서 고마워요</p>
        <p className="mt-2 text-[14.5px] leading-relaxed text-muted">
          운영팀이 확인한 뒤 지도에 올라가요. 승인되면 다른 회원들도 볼 수 있어요.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => router.replace('/map')}
            className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
          >
            지도로 돌아가기
          </button>
          <button
            type="button"
            onClick={() => {
              setDone(false);
              setName('');
              setAddress('');
              setPhone('');
              setHours('');
              setDescription('');
              setImages([]);
            }}
            className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
          >
            하나 더 알려주기
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field id="name" label="업체명">
        <input
          id="name"
          required
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Field id="category" label="업종">
            <select id="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
              {BUSINESS_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="min-w-[180px] flex-1">
          <Field id="city" label="도시">
            <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
              {MAP_CITIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      <Field id="address" label="주소" hint="지도 핀을 찍는 데 쓰여요.">
        <input
          id="address"
          required
          maxLength={200}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="5000 Yonge St, North York, ON"
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Field id="phone" label="전화번호 (선택)">
            <input
              id="phone"
              maxLength={40}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="416-000-0000"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[180px] flex-1">
          <Field id="hours" label="영업시간 (선택)">
            <input
              id="hours"
              maxLength={200}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="월–토 11:00–21:00"
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field id="description" label="설명 (선택)">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          maxLength={1000}
          placeholder="대표 메뉴나 특징을 알려주세요"
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">사진 (최대 {MAX_IMAGES}장, 선택)</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((src) => (
            <div key={src} className="relative size-24 overflow-hidden rounded-xl bg-shade">
              <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== src))}
                aria-label="사진 삭제"
                className="absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/60 text-xs text-white"
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES ? (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex size-24 items-center justify-center rounded-xl border border-dashed border-line-strong text-xs text-muted hover:bg-field disabled:opacity-55"
            >
              {uploading ? '올리는 중…' : '+ 사진'}
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

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || !name.trim() || !address.trim()}
          className="flex h-12 items-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
        >
          {busy ? '보내는 중…' : '등록 요청'}
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
