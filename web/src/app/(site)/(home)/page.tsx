import BoardRail from '@/components/BoardRail';
import NoticeBanner from '@/components/NoticeBanner';
import HotPosts from '@/components/HotPosts';
import MarketGrid from '@/components/MarketGrid';
import FreeAndJobs from '@/components/FreeAndJobs';
import CurrencyCard from '@/components/CurrencyCard';
import SchoolCard from '@/components/SchoolCard';
import StaysCard from '@/components/StaysCard';
import AppPromoCard from '@/components/AppPromoCard';
import TrendingPlacesCard from '@/components/TrendingPlacesCard';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { DEFAULT_CITY } from '@/lib/boards';
import { mapCitySlugFor } from '@/lib/businesses';
import type {
  Board,
  Business,
  HomeSections,
  HotBoardSection,
  Notice,
  SchoolCommunity,
  Stay,
} from '@/lib/types';

export default async function HomePage() {
  const user = await getCurrentUser();
  const city = user?.city || DEFAULT_CITY;

  // One round trip each, all at once. The API sits in a different region from
  // its database, so what costs time is the number of *serial* calls (perf/README.md).
  // The trending endpoint filters on the business city slug, not the stored
  // English name, and a city with no map preset simply gets no filter.
  const citySlug = mapCitySlugFor(city);

  const [boards, hotSections, sections, stays, notices, school, trending] = await Promise.all([
    apiFetchOrNull<Board[]>('/boards', { revalidate: 300 }),
    // Deliberately no city here. The server turns `city` into `city: { $in: [...] }`,
    // and only local boards ever set one — so filtering by city silently drops
    // every post from 자유게시판, 익명게시판, 이민, 교육, 워홀 and 환전, which is
    // most of the board list. The app calls this with no city for the same reason.
    apiFetchOrNull<HotBoardSection[]>('/posts/hot-by-board?limit=4&top=5'),
    apiFetchOrNull<HomeSections>(`/posts/home-sections?city=${encodeURIComponent(city)}`),
    apiFetchOrNull<Stay[]>(`/stays?city=${encodeURIComponent(city)}`),
    apiFetchOrNull<Notice[]>('/notices', { revalidate: 300 }),
    user?.verified && user.university
      ? apiFetchOrNull<SchoolCommunity>('/universities/community')
      : Promise.resolve(null),
    apiFetchOrNull<Business[]>(
      `/businesses/trending${citySlug ? `?city=${citySlug}` : ''}`,
      { revalidate: 300 }
    ),
  ]);

  const notice = notices?.find((n) => n.pinned) ?? notices?.[0] ?? null;

  return (
    <>

      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-6 px-4 pb-16 pt-7 sm:px-6">
        <BoardRail boards={boards ?? []} />

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          {notice ? <NoticeBanner notice={notice} /> : null}

          <HotPosts initialSections={hotSections ?? []} />

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
          <TrendingPlacesCard places={trending ?? []} />
          {school?.university ? <SchoolCard school={school} /> : null}
          <StaysCard stays={(stays ?? []).slice(0, 3)} city={city} />
          <AppPromoCard />
        </aside>
      </div>
    </>
  );
}
