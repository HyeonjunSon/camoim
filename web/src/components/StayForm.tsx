'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from './Field';
import { CITIES, cityLabel } from '@/lib/boards';
import { STAY_CONDITIONS, STAY_TYPE_OPTIONS } from '@/lib/stays';
import type { StayDetail } from '@/lib/types';

const MAX_IMAGES = 8;

export default function StayForm({ stay }: { stay?: StayDetail }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const editing = !!stay;

  const [title, setTitle] = useState(stay?.title ?? '');
  const [stayType, setStayType] = useState<string>(stay?.stayType ?? 'roomrent');
  const [price, setPrice] = useState(stay ? String(stay.price) : '');
  const [priceUnit, setPriceUnit] = useState<string>(stay?.priceUnit ?? 'month');
  const [deposit, setDeposit] = useState(stay?.deposit ? String(stay.deposit) : '');
  const [city, setCity] = useState(stay?.city ?? '');
  const [address, setAddress] = useState(stay?.address ?? '');
  const [neighborhood, setNeighborhood] = useState(stay?.neighborhood ?? '');
  const [moveInDate, setMoveInDate] = useState(stay?.moveInDate ?? '');
  const [minLeaseMonths, setMinLeaseMonths] = useState(
    stay?.minLeaseMonths ? String(stay.minLeaseMonths) : ''
  );
  const [includes, setIncludes] = useState(stay?.includes ?? '');
  const [description, setDescription] = useState(stay?.description ?? '');
  const [conditions, setConditions] = useState<string[]>(stay?.conditions ?? []);
  const [images, setImages] = useState<string[]>(stay?.images ?? []);

  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function toggleCondition(key: string) {
    setConditions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key].slice(0, 12)
    );
  }

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/upload/stay', { method: 'POST', body });
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
    setNotice(null);
    try {
      const payload = {
        title: title.trim(),
        stayType,
        price: Number(price),
        priceUnit,
        deposit: deposit ? Number(deposit) : 0,
        // The API only takes `city` when the listing is created; it is a display
        // label, not a filter the host can change afterwards.
        ...(editing ? {} : { city }),
        address: address.trim(),
        neighborhood: neighborhood.trim(),
        moveInDate: moveInDate.trim(),
        minLeaseMonths: minLeaseMonths ? Number(minLeaseMonths) : 0,
        includes: includes.trim(),
        description: description.trim(),
        conditions,
        images,
      };

      const res = await fetch(editing ? `/api/bff/stays/${stay.id}` : '/api/bff/stays', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '저장하지 못했어요.');

      // `located` is false when geocoding failed: the listing saves, but it has
      // no pin, so the host should know before they go looking for it.
      if (!editing && json.located === false) {
        setNotice('주소를 지도에서 찾지 못했어요. 등록은 됐지만 지도에 핀이 안 보일 수 있어요.');
        setTimeout(() => router.replace(`/stays/${json.data.id}`), 2500);
        return;
      }

      router.refresh();
      router.replace(`/stays/${editing ? stay.id : json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요.');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field id="title" label="숙소 이름">
        <input
          id="title"
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="영앤핀치 콘도 세컨룸"
          className={inputClass}
        />
      </Field>

      <Field id="stayType" label="숙소 유형">
        <select id="stayType" value={stayType} onChange={(e) => setStayType(e.target.value)} className={inputClass}>
          {STAY_TYPE_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[160px] flex-1">
          <Field id="price" label="가격 (CAD)">
            <input
              id="price"
              required
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ''))}
              placeholder="1100"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[140px] flex-1">
          <Field id="priceUnit" label="단위">
            <select id="priceUnit" value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={inputClass}>
              <option value="month">월세</option>
              <option value="night">1박</option>
            </select>
          </Field>
        </div>
        <div className="min-w-[140px] flex-1">
          <Field id="deposit" label="보증금 (선택)">
            <input
              id="deposit"
              inputMode="numeric"
              value={deposit}
              onChange={(e) => setDeposit(e.target.value.replace(/[^0-9]/g, ''))}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field
        id="address"
        label="주소"
        hint="지도 핀을 찍는 데만 쓰여요. 정확한 주소는 공개되지 않고, 핀도 대략적인 위치로 흐려져요."
      >
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

      {!editing ? (
        <Field id="city" label="도시 (선택)" hint="목록에서 걸러질 때 쓰는 표시용 이름이에요.">
          <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
            <option value="">선택 안 함</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {cityLabel(c)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field id="neighborhood" label="동네 설명 (선택)">
        <input
          id="neighborhood"
          maxLength={80}
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder="노스욕 · 핀치역 도보 8분"
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Field id="moveInDate" label="입주 가능일 (선택)">
            <input
              id="moveInDate"
              maxLength={40}
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              placeholder="11월 1일 또는 즉시"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[160px] flex-1">
          <Field id="minLeaseMonths" label="최소 계약 (개월, 선택)">
            <input
              id="minLeaseMonths"
              inputMode="numeric"
              value={minLeaseMonths}
              onChange={(e) => setMinLeaseMonths(e.target.value.replace(/[^0-9]/g, ''))}
              className={inputClass}
            />
          </Field>
        </div>
      </div>

      <Field id="includes" label="포함 사항 (선택)">
        <input
          id="includes"
          maxLength={200}
          value={includes}
          onChange={(e) => setIncludes(e.target.value)}
          placeholder="하루 2식, 세탁, Wi-Fi"
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="text-[13.5px] font-semibold text-ink-3">조건 (최대 12개)</legend>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {STAY_CONDITIONS.map((c) => {
            const on = conditions.includes(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggleCondition(c.key)}
                aria-pressed={on}
                className={`h-9 rounded-pill border px-3 text-[13px] font-semibold ${
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field id="description" label="소개 (선택)">
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          maxLength={2000}
          className="w-full resize-none rounded-control border border-line-strong px-3.5 py-2.5 text-[15px] outline-none focus:border-brand-strong"
        />
      </Field>

      <div>
        <span className="block text-[13.5px] font-semibold text-ink-3">사진 (최대 {MAX_IMAGES}장)</span>
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
              className="flex size-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line-strong text-xs text-muted hover:bg-field disabled:opacity-55"
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

      {notice ? (
        <p role="status" className="rounded-[10px] bg-[#FEF3C7] px-3.5 py-3 text-sm text-[#B45309]">
          {notice}
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
          disabled={busy || !title.trim() || !price || !address.trim()}
          className="flex h-12 items-center rounded-control bg-brand-strong px-5 text-base font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
        >
          {busy ? '저장 중…' : editing ? '수정 완료' : '등록하기'}
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
