import type { Metadata } from 'next';
import BusinessForm from '@/components/BusinessForm';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '업체 등록 요청',
  robots: { index: false, follow: false },
};

export default async function NewBusinessPage() {
  // proxy.ts gates /businesses/new.
  const [user, { m }] = await Promise.all([getCurrentUser(), getI18n()]);

  return (
    <>
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.business.newTitle}</h1>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{m.business.newIntro}</p>
        <div className="mt-6">
          <BusinessForm />
        </div>
      </main>
    </>
  );
}
