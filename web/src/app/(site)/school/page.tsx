import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import CommunityCard from '@/components/CommunityCard';
import SchoolChatLink from '@/components/SchoolChatLink';
import { ApiError, apiFetch, apiFetchEnvelope, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { loadBoards } from '@/lib/posts';
import { initial } from '@/lib/format';
import type { SchoolCommunity, SchoolMembersEnvelope } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';
import { boardName } from '@/lib/boards';

export const metadata: Metadata = {
  title: '학교 커뮤니티',
  // Verified members of one school only; never indexed.
  robots: { index: false, follow: false },
};

export default async function SchoolPage() {
  // proxy.ts gates /school, but verification is a second gate the cookie
  // cannot speak for: the API answers 403 for an unverified member.
  const [user, { lang, m: all }] = await Promise.all([getCurrentUser(), getI18n()]);
  const m = all.school;

  let community: SchoolCommunity;
  try {
    community = await apiFetch<SchoolCommunity>('/universities/community');
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <>
          <main className="mx-auto max-w-[560px] px-4 pb-20 pt-12 sm:px-6">
            <div className="rounded-card border border-line-soft bg-surface px-6 py-7">
              <h1 className="text-xl font-bold">{m.needVerify}</h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">
                {m.needVerifyBody}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="https://apps.apple.com/ca/app/camoim/id6763469709"
                  className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
                >
                  {m.verifyInApp}
                </a>
                <Link
                  href="/"
                  className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
                >
                  {all.errors.home}
                </Link>
              </div>
            </div>
          </main>
        </>
      );
    }
    throw err;
  }

  const [membersEnvelope, boards, countData] = await Promise.all([
    apiFetchEnvelope<SchoolMembersEnvelope>('/universities/members?limit=60&includeSelf=true').catch(
      () => null
    ),
    loadBoards(),
    apiFetchOrNull<{ count: number; university: string }>('/universities/members/count'),
  ]);

  const members = membersEnvelope?.data ?? [];
  const leaderUserId = membersEnvelope?.leaderUserId ?? null;
  const schoolBoards = boards.filter((b) => b.isUniversityBoard);

  return (
    <>

      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
        <section className="rounded-card bg-brand-deep px-6 py-7 text-white">
          <span className="rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-bold">{m.studentsOnly}</span>
          <h1 className="mt-3 text-2xl font-bold -tracking-[0.4px]">{community.university}</h1>
          <p className="mt-1.5 text-[14px] text-[#D9D7F5]">
            {m.verifiedMembers(countData?.count ?? members.length)}
            {community.hasLeader ? m.hasLeader : m.noLeader}
          </p>
        </section>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
            <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold">{m.boards}</h2>
              {schoolBoards.length === 0 ? (
                <p className="py-6 text-sm text-muted">{m.noBoards}</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {schoolBoards.map((board) => (
                    <li key={board.id}>
                      <Link
                        href={`/boards/${board.slug}`}
                        className="flex h-10 items-center rounded-pill border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field"
                      >
                        {boardName(board.slug, board.name, lang)}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <div className="mt-4 border-t border-line-faint pt-4">
                <SchoolChatLink />
              </div>
            </section>

            <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold">{m.members(members.length)}</h2>
              {members.length === 0 ? (
                <p className="py-6 text-sm text-muted">{m.noMembers}</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {members.map((member) => (
                    <li key={member.id}>
                      <Link
                        href={`/users/${member.id}`}
                        className="flex h-11 items-center gap-2 rounded-pill border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-3 hover:bg-field"
                      >
                        {member.avatarUrl ? (
                          <Image
                            src={member.avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="size-7 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="flex size-7 items-center justify-center rounded-full bg-brand-tint text-xs font-bold text-brand-ink"
                          >
                            {initial(member.nickname)}
                          </span>
                        )}
                        {member.nickname}
                        {member.id === leaderUserId ? <span title={all.common.leader}>⭐</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="flex w-full flex-[1_1_280px] flex-col gap-4 lg:max-w-[300px]">
            <CommunityCard
              community={community.community}
              canEdit={community.canEdit}
              editHref="/school/edit"
              title={m.links}
            />
            {community.isLeader ? (
              <section className="rounded-card border border-line-soft bg-surface px-5 py-5">
                <h2 className="text-[15px] font-bold">{m.leaderTitle}</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  {m.leaderBody}
                </p>
                <Link
                  href="/school/edit"
                  className="mt-3 flex h-10 items-center justify-center rounded-control border border-line-strong text-sm font-semibold text-ink-3 hover:bg-field"
                >
                  {m.manage}
                </Link>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}
