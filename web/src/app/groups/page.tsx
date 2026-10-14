import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import SiteHeader from '@/components/SiteHeader';
import { apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { GROUP_BOXES, GROUP_CATEGORIES, GROUP_SORTS, groupCategoryLabel } from '@/lib/groups';
import { cityLabel } from '@/lib/boards';
import type { GroupSummary } from '@/lib/types';

export const metadata: Metadata = {
  title: '모임',
  description: '캐나다 한인 취미·스터디·지역 모임과 학교 동아리를 찾아보세요.',
};

type Props = {
  searchParams: Promise<{ box?: string; category?: string; sort?: string; q?: string }>;
};

export default async function GroupsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const box = GROUP_BOXES.some((b) => b.key === sp.box) ? sp.box! : 'all';
  const category = GROUP_CATEGORIES.some((c) => c.key === sp.category) ? sp.category! : '';
  const sort = GROUP_SORTS.some((s) => s.key === sp.sort) ? sp.sort! : 'popular';
  const q = (sp.q ?? '').trim();

  const user = await getCurrentUser();

  const query = new URLSearchParams({ box, sort });
  if (category) query.set('category', category);
  if (q) query.set('q', q);

  const groups = (await apiFetchOrNull<GroupSummary[]>(`/groups?${query}`)) ?? [];

  function hrefWith(overrides: Record<string, string>) {
    const next = new URLSearchParams({ box, category, sort, q, ...overrides });
    for (const [k, v] of [...next.entries()]) {
      if (!v || (k === 'box' && v === 'all') || (k === 'sort' && v === 'popular')) next.delete(k);
    }
    const qs = next.toString();
    return qs ? `/groups?${qs}` : '/groups';
  }

  return (
    <>
      <SiteHeader user={user} />

      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold -tracking-[0.4px]">모임</h1>
            <p className="mt-1.5 text-[14.5px] text-muted">
              관심사로 모이거나, 학교 동아리에 들어갈 수 있어요.
            </p>
          </div>
          <Link
            href="/groups/new"
            className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
          >
            모임 만들기
          </Link>
        </div>

        <nav aria-label="모임 보관함" className="mt-4 flex flex-wrap gap-2">
          {GROUP_BOXES.map((b) => {
            const on = b.key === box;
            return (
              <Link
                key={b.key}
                href={hrefWith({ box: b.key })}
                aria-current={on ? 'true' : undefined}
                className={`flex h-9 items-center rounded-pill border px-3.5 text-[13.5px] font-semibold ${
                  on
                    ? 'border-ink bg-ink text-white'
                    : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
                }`}
              >
                {b.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {[{ key: '', label: '전체' }, ...GROUP_CATEGORIES].map((c) => {
            const on = c.key === category;
            return (
              <Link
                key={c.key || 'all'}
                href={hrefWith({ category: c.key })}
                aria-current={on ? 'true' : undefined}
                className={`flex h-8 items-center rounded-pill px-3 text-[13px] ${
                  on ? 'bg-brand-tint font-bold text-brand-ink-hover' : 'text-muted hover:bg-field'
                }`}
              >
                {c.label}
              </Link>
            );
          })}
          <div className="ml-auto flex gap-3 text-sm font-semibold">
            {GROUP_SORTS.map((s) => (
              <Link
                key={s.key}
                href={hrefWith({ sort: s.key })}
                aria-current={s.key === sort ? 'true' : undefined}
                className={s.key === sort ? 'text-ink' : 'text-muted hover:text-ink-3'}
              >
                {s.label}
              </Link>
            ))}
          </div>
        </div>

        <form action="/groups" className="mt-4 flex h-11 items-center gap-2 rounded-control bg-field px-3.5">
          <label htmlFor="group-q" className="sr-only-label">
            모임 검색
          </label>
          <input
            id="group-q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="모임 이름으로 찾기"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted"
          />
          {box !== 'all' ? <input type="hidden" name="box" value={box} /> : null}
          {category ? <input type="hidden" name="category" value={category} /> : null}
        </form>

        {groups.length === 0 ? (
          <p className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
            {box === 'mine'
              ? '아직 가입한 모임이 없어요.'
              : q
                ? '검색 결과가 없어요.'
                : '아직 모임이 없어요. 첫 모임을 만들어보세요.'}
          </p>
        ) : (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2">
            {groups.map((group) => (
              <li key={group.id}>
                <Link
                  href={`/groups/${group.id}`}
                  className="flex h-full gap-3.5 rounded-card border border-line-soft bg-surface p-4 text-ink hover:border-line-strong"
                >
                  <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-shade">
                    {group.coverImage ? (
                      <Image src={group.coverImage} alt="" fill sizes="80px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                        {groupCategoryLabel(group.category)}
                      </span>
                      {group.university ? (
                        <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
                          {group.university}
                        </span>
                      ) : null}
                      {group.joinPolicy === 'approval' ? (
                        <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[11.5px] font-bold text-[#B45309]">
                          승인 필요
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1.5 block truncate text-[16.5px] font-bold">{group.name}</span>
                    {group.description ? (
                      <span className="mt-1 block line-clamp-2 text-[13.5px] text-muted">
                        {group.description}
                      </span>
                    ) : null}
                    <span className="mt-2 block text-xs text-muted">
                      {[
                        `멤버 ${group.memberCount}명`,
                        group.postCount > 0 ? `글 ${group.postCount}개` : null,
                        cityLabel(group.city) || null,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
