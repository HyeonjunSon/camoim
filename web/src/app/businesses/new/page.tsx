import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import BusinessForm from '@/components/BusinessForm';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '업체 등록 요청',
  robots: { index: false, follow: false },
};

export default async function NewBusinessPage() {
  // proxy.ts gates /businesses/new.
  const user = await getCurrentUser();

  return (
    <>
      <SiteHeader user={user} active="map" />
      <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">업체 등록 요청</h1>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
          빠진 한인 업체를 알려주세요. 운영팀 확인 후 지도에 올라가요. 이미 있는 업체의 정보가 틀렸다면
          그 업체 페이지에서 &lsquo;정보 신고&rsquo;를 눌러주세요.
        </p>
        <div className="mt-6">
          <BusinessForm />
        </div>
      </main>
    </>
  );
}
