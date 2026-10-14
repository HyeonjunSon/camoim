import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import SiteHeader from '@/components/SiteHeader';
import CommunityCard from '@/components/CommunityCard';
import SchoolChatLink from '@/components/SchoolChatLink';
import { ApiError, apiFetch, apiFetchEnvelope, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { loadBoards } from '@/lib/posts';
import { initial } from '@/lib/format';
import type { SchoolCommunity, SchoolMembersEnvelope } from '@/lib/types';

export const metadata: Metadata = {
  title: '학교 커뮤니티',
  // Verified members of one school only; never indexed.
  robots: { index: false, follow: false },
};

export default async function SchoolPage() {
  // middleware.ts gates /school, but verification is a second gate the cookie
  // cannot speak for: the API answers 403 for an unverified member.
  const user = await getCurrentUser();

  let community: SchoolCommunity;
  try {
    community = await apiFetch<SchoolCommunity>('/universities/community');
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <>
          <SiteHeader user={user} />
          <main className="mx-auto max-w-[560px] px-4 pb-20 pt-12 sm:px-6">
            <div className="rounded-card border border-line-soft bg-surface px-6 py-7">
              <h1 className="text-xl font-bold">학교 인증이 필요해요</h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">
                학교 커뮤니티는 재학생 인증을 받은 회원만 볼 수 있어요. 학생증 인증은 아직 앱에서만
                할 수 있어요.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <a
                  href="https://apps.apple.com/ca/app/camoim/id6763469709"
                  className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
                >
                  앱에서 인증하기
                </a>
                <Link
                  href="/"
                  className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
                >
                  홈으로
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
      <SiteHeader user={user} />

      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-7 sm:px-6">
        <section className="rounded-card bg-brand-deep px-6 py-7 text-white">
          <span className="rounded-md bg-white/15 px-2 py-1 text-[11.5px] font-bold">재학생 전용</span>
          <h1 className="mt-3 text-2xl font-bold -tracking-[0.4px]">{community.university}</h1>
          <p className="mt-1.5 text-[14px] text-[#D9D7F5]">
            인증 회원 {countData?.count ?? members.length}명
            {community.hasLeader ? ' · 학생회장 있음' : ' · 학생회장 공석'}
          </p>
        </section>

        <div className="mt-5 flex flex-wrap items-start gap-5">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
            <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold">학교 게시판</h2>
              {schoolBoards.length === 0 ? (
                <p className="py-6 text-sm text-muted">아직 학교 게시판이 없어요.</p>
              ) : (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {schoolBoards.map((board) => (
                    <li key={board.id}>
                      <Link
                        href={`/boards/${board.slug}`}
                        className="flex h-10 items-center rounded-pill border border-line-strong px-3.5 text-sm font-semibold text-ink-3 hover:bg-field"
                      >
                        {board.name}
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
              <h2 className="text-lg font-bold">인증 회원 {members.length}</h2>
              {members.length === 0 ? (
                <p className="py-6 text-sm text-muted">아직 인증 회원이 없어요.</p>
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
                        {member.id === leaderUserId ? <span title="학생회장">⭐</span> : null}
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
              title="학교 링크"
            />
            {community.isLeader ? (
              <section className="rounded-card border border-line-soft bg-surface px-5 py-5">
                <h2 className="text-[15px] font-bold">⭐ 학생회장</h2>
                <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
                  학교 링크와 공지를 편집할 수 있어요. 인수인계와 사임도 할 수 있어요.
                </p>
                <Link
                  href="/school/edit"
                  className="mt-3 flex h-10 items-center justify-center rounded-control border border-line-strong text-sm font-semibold text-ink-3 hover:bg-field"
                >
                  관리하기
                </Link>
              </section>
            ) : null}
          </aside>
        </div>
      </main>
    </>
  );
}
