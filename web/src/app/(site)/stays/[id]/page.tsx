import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import BookmarkToggle from '@/components/BookmarkToggle';
import SimpleReportButton from '@/components/SimpleReportButton';
import StartChatButton from '@/components/StartChatButton';
import StayStatusToggle from '@/components/StayStatusToggle';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { cityLabel } from '@/lib/boards';
import { STAY_REPORT_REASONS, STAY_TYPE_COLORS, STAY_TYPE_LABELS, conditionLabel, stayPrice } from '@/lib/stays';
import { timeAgo } from '@/lib/format';
import type { StayDetail } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const stay = await apiFetchOrNull<StayDetail>(`/stays/${id}`);
  if (!stay) return { title: '숙소' };
  return {
    title: stay.title,
    description: [STAY_TYPE_LABELS[stay.stayType], stayPrice(stay.price, stay.priceUnit), stay.neighborhood]
      .filter(Boolean)
      .join(' · '),
  };
}

export default async function StayDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  let stay: StayDetail;
  try {
    stay = await apiFetch<StayDetail>(`/stays/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const typeLabel = STAY_TYPE_LABELS[stay.stayType] ?? '숙소';
  const filled = stay.status === 'closed';

  return (
    <>

      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex flex-wrap gap-2 text-[13.5px] text-muted">
          <Link href="/map?mode=stay" className="hover:text-ink-3">
            숙소 지도
          </Link>
          {stay.city ? (
            <>
              <span aria-hidden>›</span>
              <span className="text-ink">{cityLabel(stay.city)}</span>
            </>
          ) : null}
        </nav>

        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          {stay.images.length > 0 ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {stay.images.slice(0, 4).map((src) => (
                <div key={src} className="relative aspect-[4/3] bg-shade">
                  <Image src={src} alt="" fill sizes="(max-width: 640px) 100vw, 420px" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="px-5 py-6 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-md px-2 py-1 text-[12.5px] font-bold"
                style={{ color: STAY_TYPE_COLORS[stay.stayType], background: '#F4F5F9' }}
              >
                {typeLabel}
              </span>
              {filled ? (
                <span className="rounded-md bg-[#EDEDF0] px-2 py-1 text-[12.5px] font-bold text-ink-3">
                  입주완료
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[26px] leading-[1.35] font-bold -tracking-[0.5px]">{stay.title}</h1>
            <p className="mt-2 text-2xl font-bold">{stayPrice(stay.price, stay.priceUnit)}</p>

            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line-faint pt-5 text-[15px]">
              {stay.neighborhood ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">위치</dt>
                  <dd className="min-w-0">{stay.neighborhood}</dd>
                </div>
              ) : null}
              {stay.moveInDate ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">입주 가능</dt>
                  <dd>{stay.moveInDate}</dd>
                </div>
              ) : null}
              {stay.minLeaseMonths > 0 ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">최소 계약</dt>
                  <dd>{stay.minLeaseMonths}개월</dd>
                </div>
              ) : null}
              {stay.deposit > 0 ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">보증금</dt>
                  <dd>${stay.deposit.toLocaleString('en-CA')}</dd>
                </div>
              ) : null}
              {stay.includes ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">포함</dt>
                  <dd className="min-w-0">{stay.includes}</dd>
                </div>
              ) : null}
            </dl>

            {stay.conditions.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {stay.conditions.map((key) => (
                  <li
                    key={key}
                    className="rounded-pill border border-line-strong px-2.5 py-1 text-[13px] text-ink-3"
                  >
                    {conditionLabel(key)}
                  </li>
                ))}
              </ul>
            ) : null}

            {stay.description ? (
              <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-wrap">{stay.description}</p>
            ) : null}

            {/* The exact address never leaves the server; only an approximate pin does. */}
            <p className="mt-5 rounded-[10px] bg-field px-3.5 py-3 text-[12.5px] leading-relaxed text-muted">
              정확한 주소는 공개되지 않아요. 지도 위치도 대략적인 위치예요. 방문 전에 호스트와 채팅으로
              확인하세요.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              {stay.isMine ? (
                <>
                  <Link
                    href={`/stays/${stay.id}/edit`}
                    className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-2 hover:bg-field"
                  >
                    수정
                  </Link>
                  <StayStatusToggle stayId={stay.id} status={stay.status} />
                </>
              ) : (
                <div className="min-w-[220px] flex-1">
                  <StartChatButton
                    targetUserId={stay.host.id}
                    signedIn={!!user}
                    label="호스트와 채팅하기"
                  />
                </div>
              )}
              <BookmarkToggle
                kind="stays"
                id={stay.id}
                initialBookmarked={stay.bookmarked}
                initialCount={stay.bookmarkCount}
                signedIn={!!user}
              />
              {!stay.isMine ? (
                <div className="ml-auto">
                  <SimpleReportButton
                    kind="stays"
                    id={stay.id}
                    reasons={STAY_REPORT_REASONS}
                    signedIn={!!user}
                  />
                </div>
              ) : null}
            </div>

            <p className="mt-4 text-[12.5px] text-muted">
              <Link href={`/users/${stay.host.id}`} className="font-semibold text-ink-3 hover:underline">
                {stay.host.nickname}
              </Link>
              {stay.host.verified ? ' · 학교 인증' : ''} · {timeAgo(stay.createdAt)} 등록
            </p>
          </div>
        </section>
      </main>
    </>
  );
}
