import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import IntroRequestForm from '@/components/intro/IntroRequestForm';
import SimpleReportButton from '@/components/SimpleReportButton';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { GENDER_COLORS, ageFromBirthYear, genderLabel, jobLabel } from '@/lib/intro';
import type { IntroMeta, IntroPost } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '소개팅',
  robots: { index: false, follow: false },
};

const INTRO_REPORT_REASONS = [
  { value: 'fake', label: '사칭·허위 정보예요', labelEn: 'Impersonation or false info' },
  { value: 'contact', label: '연락처·실명이 적혀 있어요', labelEn: 'Contains contact info or a real name' },
  { value: 'spam', label: '스팸·광고예요', labelEn: 'Spam or ads' },
] as const;

type Props = { params: Promise<{ id: string }> };

export default async function IntroDetailPage({ params }: Props) {
  const { id } = await params;
  const [user, { lang, m: all }] = await Promise.all([getCurrentUser(), getI18n()]);
  const m = all.intro;

  const meta = await apiFetchOrNull<IntroMeta>('/intro/meta');
  // Reading a post needs the same agreement the API requires for acting on one.
  if (!meta?.agreed) notFound();

  let post: IntroPost;
  try {
    post = await apiFetch<IntroPost>(`/intro/${id}`);
  } catch (err) {
    if (err instanceof ApiError && [403, 404].includes(err.status)) notFound();
    throw err;
  }

  const tint = GENDER_COLORS[post.gender] ?? '#374151';
  const preferredRange =
    post.preferredBirthYearMin || post.preferredBirthYearMax
      ? m.birthRange(String(post.preferredBirthYearMin ?? '~'), String(post.preferredBirthYearMax ?? '~'))
      : '';

  return (
    <>

      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label={all.post.breadcrumb} className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/intro" className="hover:text-ink-3">
            {m.title}
          </Link>
        </nav>

        <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
          {post.photo ? (
            <div className="relative aspect-[4/3] bg-shade sm:aspect-[16/9]">
              <Image src={post.photo} alt="" fill sizes="720px" className="object-cover" />
            </div>
          ) : null}

          <div className="px-5 py-6 sm:px-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[14px] font-bold" style={{ color: tint }}>
                {genderLabel(post.gender, lang)} · {ageFromBirthYear(post.birthYear, undefined, lang)}
              </span>
              {post.mode === 'proxy' ? (
                <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[11.5px] font-bold text-[#B45309]">
                  {m.proxyConsented}
                </span>
              ) : null}
              {post.expired ? (
                <span className="rounded-md bg-[#EDEDF0] px-2 py-0.5 text-[11.5px] font-bold text-ink-3">
                  {m.expired}
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 text-[24px] leading-[1.35] font-bold -tracking-[0.4px]">
              {post.headline}
            </h1>

            <dl className="mt-5 flex flex-col gap-2.5 border-t border-line-faint pt-5 text-[15px]">
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-muted">{m.region}</dt>
                <dd>{post.region}</dd>
              </div>
              {post.job ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">{m.job}</dt>
                  <dd>{jobLabel(post.job, lang)}</dd>
                </div>
              ) : null}
              {post.height ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">{m.height}</dt>
                  <dd>{post.height}</dd>
                </div>
              ) : null}
              {preferredRange || post.preferredRegion ? (
                <div className="flex gap-3">
                  <dt className="w-20 shrink-0 text-muted">{m.lookingFor}</dt>
                  <dd>{[preferredRange, post.preferredRegion].filter(Boolean).join(' · ')}</dd>
                </div>
              ) : null}
              <div className="flex gap-3">
                <dt className="w-20 shrink-0 text-muted">{m.timeLeft}</dt>
                <dd>{post.daysLeft > 0 ? m.days(post.daysLeft) : m.expiredShort}</dd>
              </div>
            </dl>

            {post.bio ? (
              <p className="mt-5 text-[15px] leading-relaxed whitespace-pre-wrap">{post.bio}</p>
            ) : null}

            {post.isMine && post.contactValue ? (
              <p className="mt-5 rounded-[10px] bg-field px-3.5 py-3 text-[13.5px] text-ink-3">
                {m.myContact(post.contactType === 'kakao' ? m.kakao : m.instagram)}
                {post.contactValue}
                <span className="mt-1 block text-[12.5px] text-muted">
                  {m.contactPrivate}
                </span>
              </p>
            ) : null}

            {!post.isMine ? (
              <div className="mt-5 flex justify-end">
                <SimpleReportButton
                  kind="intro"
                  id={post.id}
                  reasons={INTRO_REPORT_REASONS}
                  signedIn={!!user}
                />
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-5">
          {post.isMine ? (
            <p className="rounded-card border border-line-soft bg-surface px-5 py-6 text-sm text-muted">
              {m.isMine}
              <Link href="/intro/mine" className="font-semibold text-brand-ink hover:text-brand-ink-hover">
                {m.seeRequests}
              </Link>
            </p>
          ) : post.expired || post.status !== 'active' ? (
            <p className="rounded-card border border-line-soft bg-surface px-5 py-6 text-sm text-muted">
              {m.closed}
            </p>
          ) : (
            <IntroRequestForm postId={post.id} meta={meta} />
          )}
        </div>
      </main>
    </>
  );
}
