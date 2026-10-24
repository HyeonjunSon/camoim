import type { Metadata } from 'next';
import StayForm from '@/components/StayForm';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '내 방 올리기',
  robots: { index: false, follow: false },
};

export default async function NewStayPage() {
  // proxy.ts gates /stays/new.
  const [user, { m }] = await Promise.all([getCurrentUser(), getI18n()]);

  return (
    <>
      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.stay.newTitle}</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">{m.stay.newIntro}</p>
        <div className="mt-6">
          <StayForm />
        </div>
      </main>
    </>
  );
}
