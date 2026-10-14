import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import GroupForm from '@/components/GroupForm';
import GroupCommunityForm from '@/components/GroupCommunityForm';
import { ApiError, apiFetch } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { GroupDetail } from '@/lib/types';

export const metadata: Metadata = {
  title: '모임 설정',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function EditGroupPage({ params }: Props) {
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

  const isOwner = group.myMembership?.role === 'owner' && group.myMembership.status === 'active';
  // The links card is open to co-owners; everything else is the owner's alone.
  if (!isOwner && !group.canEditCommunity) notFound();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">모임 설정</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">{group.name}</p>

        {isOwner ? (
          <section className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
            <GroupForm group={group} user={user} />
          </section>
        ) : null}

        <section className="mt-5 rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
          <h2 className="text-lg font-bold">모임 링크</h2>
          <p className="mt-1 text-[13.5px] text-muted">
            인스타그램, 오픈채팅, 디스코드 링크를 걸어두면 멤버들이 찾기 쉬워요.
          </p>
          <div className="mt-4">
            <GroupCommunityForm groupId={group.id} community={group.community} />
          </div>
        </section>
      </main>
    </>
  );
}
