import type { Metadata } from 'next';
import StayForm from '@/components/StayForm';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '내 방 올리기',
  robots: { index: false, follow: false },
};

export default async function NewStayPage() {
  // proxy.ts gates /stays/new.
  const user = await getCurrentUser();

  return (
    <>
      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">내 방 올리기</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          지도에 바로 올라가요. 정확한 주소는 공개되지 않고, 핀도 대략적인 위치로만 보여요.
        </p>
        <div className="mt-6">
          <StayForm />
        </div>
      </main>
    </>
  );
}
