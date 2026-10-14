import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import BusinessReviews from '@/components/BusinessReviews';
import BookmarkToggle from '@/components/BookmarkToggle';
import SimpleReportButton from '@/components/SimpleReportButton';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { BUSINESS_REPORT_REASONS, categoryOf, mapCityOf } from '@/lib/businesses';
import type { Business, BusinessReview } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const business = await apiFetchOrNull<Business>(`/businesses/${id}`);
  if (!business) return { title: '업체' };
  return {
    title: business.name,
    description: [categoryOf(business.category).label, business.address].filter(Boolean).join(' · '),
    openGraph: { title: business.name, images: business.images?.[0] ? [business.images[0]] : undefined },
  };
}

export default async function BusinessDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  let business: Business;
  try {
    business = await apiFetch<Business>(`/businesses/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const reviews = (await apiFetchOrNull<BusinessReview[]>(`/businesses/${id}/reviews`)) ?? [];
  const category = categoryOf(business.category);
  const city = mapCityOf(business.city);

  return (
    <>

      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex flex-wrap gap-2 text-[13.5px] text-muted">
          <Link href="/map" className="hover:text-ink-3">
            지도
          </Link>
          <span aria-hidden>›</span>
          <Link href={`/map?city=${business.city}&category=${business.category}`} className="hover:text-ink-3">
            {city.label} {category.label}
          </Link>
        </nav>

        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          {business.images.length > 0 ? (
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {business.images.slice(0, 2).map((src) => (
                <div key={src} className="relative aspect-[4/3] bg-shade">
                  <Image src={src} alt="" fill sizes="(max-width: 640px) 100vw, 420px" className="object-cover" />
                </div>
              ))}
            </div>
          ) : null}

          <div className="px-5 py-6 sm:px-7">
            <span
              className="rounded-md px-2 py-1 text-[12.5px] font-semibold"
              style={{ color: category.color, background: category.soft }}
            >
              {category.label}
            </span>
            <h1 className="mt-3 text-[26px] font-bold -tracking-[0.5px]">{business.name}</h1>

            {business.ratingCount > 0 ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-ink-3">
                <span className="text-[#F59E0B]">{'★'.repeat(Math.round(business.ratingAvg))}</span>
                {business.ratingAvg.toFixed(1)} · 리뷰 {business.ratingCount}
              </p>
            ) : null}

            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line-faint pt-5 text-[15px]">
              <div className="flex gap-3">
                <dt className="w-16 shrink-0 text-muted">주소</dt>
                <dd className="min-w-0">
                  {business.address}
                  {business.lat != null && business.lng != null ? (
                    <a
                      // Opens in whatever map app the visitor uses; no API key involved.
                      href={`https://www.google.com/maps/search/?api=1&query=${business.lat},${business.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-[13.5px] text-brand-ink hover:text-brand-ink-hover"
                    >
                      길찾기 ›
                    </a>
                  ) : null}
                </dd>
              </div>
              {business.phone ? (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">전화</dt>
                  <dd>
                    <a href={`tel:${business.phone}`} className="text-brand-ink hover:text-brand-ink-hover">
                      {business.phone}
                    </a>
                  </dd>
                </div>
              ) : null}
              {business.hours ? (
                <div className="flex gap-3">
                  <dt className="w-16 shrink-0 text-muted">영업시간</dt>
                  <dd className="whitespace-pre-wrap">{business.hours}</dd>
                </div>
              ) : null}
            </dl>

            {business.description ? (
              <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-wrap">{business.description}</p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <BookmarkToggle
                kind="businesses"
                id={business.id}
                initialBookmarked={business.bookmarked}
                initialCount={business.bookmarkCount}
                signedIn={!!user}
              />
              <div className="ml-auto">
                <SimpleReportButton
                  kind="businesses"
                  id={business.id}
                  reasons={BUSINESS_REPORT_REASONS}
                  signedIn={!!user}
                />
              </div>
            </div>

            {business.source === 'user' && business.submitterNickname ? (
              <p className="mt-4 text-[12.5px] text-muted">
                {business.submitterNickname}님이 알려준 곳이에요.
              </p>
            ) : null}
          </div>
        </section>

        <div className="mt-5">
          <BusinessReviews
            businessId={business.id}
            initialReviews={reviews}
            initialAvg={business.ratingAvg}
            initialCount={business.ratingCount}
            signedIn={!!user}
          />
        </div>
      </main>
    </>
  );
}
