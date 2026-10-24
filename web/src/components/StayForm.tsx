'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import Field, { inputClass } from './Field';
import { CITIES, cityLabel } from '@/lib/boards';
import { useLang, useMessages } from '@/lib/i18n/client';
import { labelFor } from '@/lib/i18n/lang';
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
  const all = useMessages();
  const m = all.stay;
  const lang = useLang();

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
        throw new Error(json.message || all.common.uploadFailed);
      }
      setImages((prev) => [...prev, json.url as string].slice(0, MAX_IMAGES));
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
      if (!res.ok || !json.success) throw new Error(json.message || all.common.saveFailed);

      // `located` is false when geocoding failed: the listing saves, but it has
      // no pin, so the host should know before they go looking for it.
      if (!editing && json.located === false) {
        setNotice(m.geocodeMiss);
        setTimeout(() => router.replace(`/stays/${json.data.id}`), 2500);
        return;
      }

      router.refresh();
      router.replace(`/stays/${editing ? stay.id : json.data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : all.common.saveFailed);
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field id="title" label={m.name}>
        <input
          id="title"
          required
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={m.namePlaceholder}
          className={inputClass}
        />
      </Field>

      <Field id="stayType" label={m.type}>
        <select id="stayType" value={stayType} onChange={(e) => setStayType(e.target.value)} className={inputClass}>
          {STAY_TYPE_OPTIONS.map((t) => (
            <option key={t.key} value={t.key}>
              {labelFor(t, lang)}
            </option>
          ))}
        </select>
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[160px] flex-1">
          <Field id="price" label={m.price}>
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
          <Field id="priceUnit" label={m.unit}>
            <select id="priceUnit" value={priceUnit} onChange={(e) => setPriceUnit(e.target.value)} className={inputClass}>
              <option value="month">{m.perMonth}</option>
              <option value="night">{m.perNight}</option>
            </select>
          </Field>
        </div>
        <div className="min-w-[140px] flex-1">
          <Field id="deposit" label={m.depositOptional}>
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
        label={m.address}
        hint={m.addressHint}
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
        <Field id="city" label={m.cityOptional} hint={m.cityHint}>
          <select id="city" value={city} onChange={(e) => setCity(e.target.value)} className={inputClass}>
            <option value="">{all.common.none}</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>
                {cityLabel(c, lang)}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <Field id="neighborhood" label={m.neighborhood}>
        <input
          id="neighborhood"
          maxLength={80}
          value={neighborhood}
          onChange={(e) => setNeighborhood(e.target.value)}
          placeholder={m.neighborhoodPlaceholder}
          className={inputClass}
        />
      </Field>

      <div className="flex flex-wrap gap-4">
        <div className="min-w-[180px] flex-1">
          <Field id="moveInDate" label={m.moveInOptional}>
            <input
              id="moveInDate"
              maxLength={40}
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              placeholder={m.moveInPlaceholder}
              className={inputClass}
            />
          </Field>
        </div>
        <div className="min-w-[160px] flex-1">
          <Field id="minLeaseMonths" label={m.minLeaseOptional}>
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

      <Field id="includes" label={m.includesOptional}>
        <input
          id="includes"
          maxLength={200}
          value={includes}
          onChange={(e) => setIncludes(e.target.value)}
          placeholder={m.includesPlaceholder}
          className={inputClass}
        />
      </Field>

      <fieldset>
        <legend className="text-[13.5px] font-semibold text-ink-3">{m.conditions}</legend>
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
                {labelFor(c, lang)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field id="description" label={m.descOptional}>
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
        <span className="block text-[13.5px] font-semibold text-ink-3">{m.photos(MAX_IMAGES)}</span>
        <div className="mt-2 flex flex-wrap gap-2">
          {images.map((src) => (
            <div key={src} className="relative size-24 overflow-hidden rounded-xl bg-shade">
              <Image src={src} alt="" fill sizes="96px" className="object-cover" />
              <button
                type="button"
                onClick={() => setImages((prev) => prev.filter((u) => u !== src))}
                aria-label={all.business.removePhoto}
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
              {uploading ? all.business.uploading : all.business.addPhoto}
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
          {busy ? all.common.saving : editing ? all.write.update : m.publish}
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
