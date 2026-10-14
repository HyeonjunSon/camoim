import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import GroupForm from '@/components/GroupForm';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '모임 만들기',
  robots: { index: false, follow: false },
};

export default async function NewGroupPage() {
  // middleware.ts gates /groups/new.
  const user = await getCurrentUser();
  if (!user) notFound();

  return (
    <>
      <SiteHeader user={user} />
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">모임 만들기</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          같은 관심사를 가진 사람들을 모아보세요. 모임마다 게시판과 단체 채팅이 생겨요.
        </p>
        <div className="mt-6">
          <GroupForm user={user} />
        </div>
      </main>
    </>
  );
}
