import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import GroupMemberList from '@/components/GroupMemberList';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { GroupDetail, GroupMember } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '모임 멤버',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function GroupMembersPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  let group: GroupDetail;
  try {
    group = await apiFetch<GroupDetail>(`/groups/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  // The members endpoint is members-only, and the pending list is managers-only.
  const isMember = group.myMembership?.status === 'active';
  if (!isMember) notFound();
  const canManage = group.myMembership?.role === 'owner' || group.myMembership?.role === 'manager';

  const { m: all } = await getI18n();
  const [members, pending] = await Promise.all([
    apiFetchOrNull<GroupMember[]>(`/groups/${id}/members?status=active`),
    canManage
      ? apiFetchOrNull<GroupMember[]>(`/groups/${id}/members?status=pending`)
      : Promise.resolve(null),
  ]);

  return (
    <>
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label={all.post.breadcrumb} className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/groups" className="hover:text-ink-3">
            {all.group.title}
          </Link>
          <span aria-hidden>›</span>
          <Link href={`/groups/${group.id}`} className="hover:text-ink-3">
            {group.name}
          </Link>
        </nav>

        <h1 className="text-2xl font-bold -tracking-[0.4px]">{all.group.membersTitle}</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          {all.group.capacityShort(group.memberCount, group.maxMembers)}
        </p>

        <div className="mt-6">
          <GroupMemberList
            groupId={group.id}
            members={members ?? []}
            pending={pending ?? []}
            canManage={canManage}
            isOwner={group.myMembership?.role === 'owner'}
            myUserId={user.id}
          />
        </div>
      </main>
    </>
  );
}
