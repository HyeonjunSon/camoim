import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import GroupForm from '@/components/GroupForm';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '모임 만들기',
  robots: { index: false, follow: false },
};

export default async function NewGroupPage() {
  // proxy.ts gates /groups/new.
  const user = await getCurrentUser();
  if (!user) notFound();
  const { m } = await getI18n();

  return (
    <>
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.group.create}</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">{m.group.newIntro}</p>
        <div className="mt-6">
          <GroupForm user={user} />
        </div>
      </main>
    </>
  );
}
