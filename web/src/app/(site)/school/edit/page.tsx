import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SchoolCommunityForm from '@/components/SchoolCommunityForm';
import LeaderHandover from '@/components/LeaderHandover';
import { ApiError, apiFetch, apiFetchEnvelope } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { SchoolCommunity, SchoolMembersEnvelope } from '@/lib/types';

export const metadata: Metadata = {
  title: '학교 커뮤니티 꾸미기',
  robots: { index: false, follow: false },
};

export default async function SchoolEditPage() {
  const user = await getCurrentUser();

  let community: SchoolCommunity;
  try {
    community = await apiFetch<SchoolCommunity>('/universities/community');
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) notFound();
    throw err;
  }

  // Editing is the president's or an admin's; the API refuses anyone else, and
  // checking here avoids rendering a form that cannot be submitted.
  if (!community.canEdit) notFound();

  // Handover candidates exclude the caller, which is what includeSelf=false does.
  const candidates = community.isLeader
    ? ((await apiFetchEnvelope<SchoolMembersEnvelope>(
        '/universities/members?limit=200&includeSelf=false'
      ).catch(() => null))?.data ?? [])
    : [];

  return (
    <>
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/school" className="hover:text-ink-3">
            학교 커뮤니티
          </Link>
        </nav>

        <h1 className="text-2xl font-bold -tracking-[0.4px]">학교 커뮤니티 꾸미기</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">{community.university}</p>

        <section className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
          <h2 className="text-lg font-bold">학교 링크</h2>
          <div className="mt-4">
            <SchoolCommunityForm community={community.community} />
          </div>
        </section>

        {community.isLeader ? (
          <section className="mt-5 rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
            <h2 className="text-lg font-bold">⭐ 학생회장 인수인계</h2>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
              다음 학생회장에게 바로 넘길 수 있어요. 운영팀 승인은 필요하지 않아요.
            </p>
            <div className="mt-4">
              <LeaderHandover candidates={candidates} />
            </div>
          </section>
        ) : null}
      </main>
    </>
  );
}
