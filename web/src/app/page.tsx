import SiteHeader from '@/components/SiteHeader';
import BoardRail from '@/components/BoardRail';
import NoticeBanner from '@/components/NoticeBanner';
import HotPosts from '@/components/HotPosts';
import MarketGrid from '@/components/MarketGrid';
import FreeAndJobs from '@/components/FreeAndJobs';
import CurrencyCard from '@/components/CurrencyCard';
import SchoolCard from '@/components/SchoolCard';
import StaysCard from '@/components/StaysCard';
import AppPromoCard from '@/components/AppPromoCard';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { DEFAULT_CITY } from '@/lib/boards';
import type { Board, HomeSections, HotBoardSection, Notice, SchoolCommunity, Stay } from '@/lib/types';

export default async function HomePage() {
  const user = await getCurrentUser();
  const city = user?.city || DEFAULT_CITY;

  // One round trip each, all at once. The API sits in a different region from
  // its database, so what costs time is the number of *serial* calls (perf/README.md).
  const [boards, hotSections, sections, stays, notices, school] = await Promise.all([
    apiFetchOrNull<Board[]>('/boards', { revalidate: 300 }),
    apiFetchOrNull<HotBoardSection[]>(
      `/posts/hot-by-board?limit=4&top=5&hours=24&city=${encodeURIComponent(city)}`
    ),
    apiFetchOrNull<HomeSections>(`/posts/home-sections?city=${encodeURIComponent(city)}`),
    apiFetchOrNull<Stay[]>(`/stays?city=${encodeURIComponent(city)}`),
    apiFetchOrNull<Notice[]>('/notices', { revalidate: 300 }),
    user?.verified && user.university
      ? apiFetchOrNull<SchoolCommunity>('/universities/community')
      : Promise.resolve(null),
  ]);

  const notice = notices?.find((n) => n.pinned) ?? notices?.[0] ?? null;

  return (
    <>
      <SiteHeader user={user} active="home" />

      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-6 px-4 pb-16 pt-7 sm:px-6">
        <BoardRail boards={boards ?? []} />

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {notice ? <NoticeBanner notice={notice} /> : null}

          <HotPosts initialSections={hotSections ?? []} city={city} />

          {sections?.marketPosts?.length ? (
            <MarketGrid posts={sections.marketPosts.slice(0, 4)} city={city} />
          ) : null}

          <FreeAndJobs
            freePosts={sections?.freePosts ?? []}
            jobsPosts={sections?.jobsPosts ?? []}
            city={city}
          />
        </main>

        <aside className="flex w-full flex-[1_1_280px] flex-col gap-4 lg:max-w-[320px]">
          <CurrencyCard />
          {school?.university ? <SchoolCard school={school} /> : null}
          <StaysCard stays={(stays ?? []).slice(0, 3)} city={city} />
          <AppPromoCard />
        </aside>
      </div>
    </>
  );
}
