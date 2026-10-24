import type { Metadata } from 'next';
import Link from 'next/link';
import IntroAgreeGate from '@/components/intro/IntroAgreeGate';
import IntroCard from '@/components/intro/IntroCard';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { INTRO_GENDERS } from '@/lib/intro';
import type { IntroMeta, IntroPost } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';
import { labelFor } from '@/lib/i18n/lang';

export const metadata: Metadata = {
  title: '소개팅',
  // Age-gated and anonymous; never indexed.
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ gender?: string; region?: string; proxyOnly?: string }> };

export default async function IntroPage({ searchParams }: Props) {
  const sp = await searchParams;
  // proxy.ts gates /intro, so a signed-in user is expected.
  const [user, { lang, m: all }] = await Promise.all([getCurrentUser(), getI18n()]);
  const m = all.intro;

  const meta = await apiFetchOrNull<IntroMeta>('/intro/meta');

  if (!meta?.agreed) {
    return (
      <>
        <main className="mx-auto max-w-[560px] px-4 pb-20 pt-10 sm:px-6">
          <IntroAgreeGate />
        </main>
      </>
    );
  }

  const gender = INTRO_GENDERS.some((g) => g.key === sp.gender) ? sp.gender! : '';
  const region = (sp.region ?? '').trim();
  const proxyOnly = sp.proxyOnly === 'true';

  const query = new URLSearchParams();
  if (gender) query.set('gender', gender);
  if (region) query.set('region', region);
  if (proxyOnly) query.set('proxyOnly', 'true');

  const [posts, mine] = await Promise.all([
    apiFetchOrNull<IntroPost[]>(`/intro?${query}`),
    apiFetchOrNull<IntroPost[]>('/intro/mine'),
  ]);

  const list = posts ?? [];
  const myPosts = mine ?? [];
  const pendingTotal = myPosts.reduce((sum, p) => sum + (p.pendingCount ?? 0), 0);

  function hrefWith(overrides: Record<string, string>) {
    const next = new URLSearchParams({ gender, region, proxyOnly: proxyOnly ? 'true' : '', ...overrides });
    for (const [k, v] of [...next.entries()]) if (!v) next.delete(k);
    const qs = next.toString();
    return qs ? `/intro?${qs}` : '/intro';
  }

  return (
    <>

      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.title}</h1>
            <p className="mt-1.5 text-[14.5px] text-muted">
              {m.intro}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/intro/mine"
              className="flex h-11 items-center gap-1.5 rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
            >
              {m.mine}
              {pendingTotal > 0 ? (
                <span className="rounded-full bg-danger px-1.5 text-[11px] font-bold text-white">
                  {pendingTotal}
                </span>
              ) : null}
            </Link>
            <Link
              href="/intro/new"
              className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
            >
              {m.post}
            </Link>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {[{ key: '', label: all.common.all }, ...INTRO_GENDERS].map((g) => {
            const on = g.key === gender;
            return (
              <Link
                key={g.key || 'all'}
                href={hrefWith({ gender: g.key })}
                aria-current={on ? 'true' : undefined}
                className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                }`}
              >
                {labelFor(g, lang)}
              </Link>
            );
          })}
          <Link
            href={hrefWith({ proxyOnly: proxyOnly ? '' : 'true' })}
            aria-current={proxyOnly ? 'true' : undefined}
            className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
              proxyOnly
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
            }`}
          >
            {m.proxyOnly}
          </Link>
          <span className="ml-auto text-[13px] text-muted">
            {m.remainingToday(meta.dailyRemaining)}
          </span>
        </div>

        <form action="/intro" className="mt-3 flex h-11 items-center gap-2 rounded-control bg-field px-3.5">
          <label htmlFor="intro-region" className="sr-only-label">
            {m.searchRegion}
          </label>
          <input
            id="intro-region"
            name="region"
            type="search"
            defaultValue={region}
            placeholder={m.searchRegionPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          {gender ? <input type="hidden" name="gender" value={gender} /> : null}
        </form>

        {list.length === 0 ? (
          <p className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
            {region || gender || proxyOnly
              ? m.noMatch
              : m.noneYet}
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {list.map((post) => (
              <IntroCard key={post.id} post={post} />
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
