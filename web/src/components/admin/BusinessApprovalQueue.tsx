'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminBusiness } from '@/lib/types';
import { categoryOf, mapCityOf } from '@/lib/businesses';
import { timeAgo } from '@/lib/format';

const SOURCE_LABELS: Record<string, string> = {
  user: '회원 제보',
  admin: '운영 등록',
  google: 'Google 가져오기',
};

export default function BusinessApprovalQueue({
  businesses,
  status,
}: {
  businesses: AdminBusiness[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(businesses);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(id: string, next: 'approved' | 'rejected') {
    if (next === 'rejected' && !(reasons[id] ?? '').trim()) {
      setError('반려할 때는 사유를 적어주세요.');
      return;
    }
    if (
      !window.confirm(
        next === 'approved' ? '이 업체를 지도에 올릴까요?' : '이 업체 제보를 반려할까요?'
      )
    ) {
      return;
    }

    setBusy(id);
    setError(null);
    try {
      // One endpoint covers approve, reject and edit; only `status` is sent here.
      const res = await fetch(`/api/bff/admin/businesses/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next, rejectedReason: (reasons[id] ?? '').trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      setItems((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`${name}을(를) 완전히 삭제할까요? 북마크와 신고도 함께 지워져요.`)) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/businesses/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '삭제하지 못했어요.');
      setItems((prev) => prev.filter((b) => b.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '삭제하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
        {status === 'pending' ? '승인 대기 중인 업체가 없어요.' : '해당 상태의 업체가 없어요.'}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {items.map((business) => {
          const category = categoryOf(business.category);
          const city = mapCityOf(business.city);
          const working = busy === business.id;

          return (
            <li
              key={business.id}
              className="flex flex-wrap gap-4 rounded-card border border-line-soft bg-surface px-5 py-4"
            >
              <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-shade">
                {business.images?.[0] ? (
                  <Image src={business.images[0]} alt="" fill sizes="80px" className="object-cover" />
                ) : null}
              </span>

              <div className="min-w-[240px] flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[11.5px] font-bold"
                    style={{ color: category.color, background: category.soft }}
                  >
                    {category.label}
                  </span>
                  <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                    {city.label}
                  </span>
                  {/* Without coordinates it would be approved but carry no pin. */}
                  {!business.hasLocation ? (
                    <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[11.5px] font-bold text-[#B45309]">
                      좌표 없음 · 지도에 핀 안 보임
                    </span>
                  ) : null}
                  <span className="ml-auto text-[12px] text-muted">
                    {timeAgo(business.createdAt)}
                  </span>
                </div>

                {business.status === 'approved' ? (
                  <Link
                    href={`/businesses/${business.id}`}
                    target="_blank"
                    prefetch={false}
                    className="mt-1.5 block text-[16px] font-bold text-ink hover:underline"
                  >
                    {business.name} ↗
                  </Link>
                ) : (
                  <p className="mt-1.5 text-[16px] font-bold">{business.name}</p>
                )}

                <dl className="mt-1.5 flex flex-col gap-1 text-[13.5px] text-ink-3">
                  <div className="flex gap-2">
                    <dt className="w-14 shrink-0 text-muted">주소</dt>
                    <dd className="min-w-0 break-words">
                      {business.address}
                      {business.lat != null && business.lng != null ? (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-2 text-[12.5px] text-brand-ink hover:underline"
                        >
                          위치 확인 ↗
                        </a>
                      ) : null}
                    </dd>
                  </div>
                  {business.phone ? (
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-muted">전화</dt>
                      <dd>{business.phone}</dd>
                    </div>
                  ) : null}
                  {business.hours ? (
                    <div className="flex gap-2">
                      <dt className="w-14 shrink-0 text-muted">영업</dt>
                      <dd className="min-w-0 whitespace-pre-wrap">{business.hours}</dd>
                    </div>
                  ) : null}
                </dl>

                {business.description ? (
                  <p className="mt-2 text-[14px] leading-relaxed whitespace-pre-wrap text-ink-3">
                    {business.description}
                  </p>
                ) : null}

                <p className="mt-2 text-[12.5px] text-muted">
                  {[
                    SOURCE_LABELS[business.source] ?? business.source,
                    business.submitterNickname || null,
                    business.reportCount > 0 ? `신고 ${business.reportCount}` : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {status !== 'approved' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(business.id, 'approved')}
                      disabled={working}
                      className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[14.5px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
                    >
                      승인
                    </button>
                  ) : null}
                  {status !== 'rejected' ? (
                    <button
                      type="button"
                      onClick={() => setStatus(business.id, 'rejected')}
                      disabled={working}
                      className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                    >
                      반려
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => remove(business.id, business.name)}
                    disabled={working}
                    className="ml-auto h-11 rounded-control px-3 text-sm font-semibold text-muted hover:bg-field hover:text-danger disabled:opacity-55"
                  >
                    삭제
                  </button>
                </div>

                {status === 'pending' ? (
                  <>
                    <label htmlFor={`breason-${business.id}`} className="sr-only-label">
                      반려 사유
                    </label>
                    <input
                      id={`breason-${business.id}`}
                      value={reasons[business.id] ?? ''}
                      onChange={(e) =>
                        setReasons((prev) => ({ ...prev, [business.id]: e.target.value }))
                      }
                      placeholder="반려 사유 (반려 시 필수)"
                      className="mt-2.5 h-11 w-full rounded-control border border-line-strong px-3.5 text-[14px] outline-none focus:border-brand-strong"
                    />
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
