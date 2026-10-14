import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import StayForm from '@/components/StayForm';
import { ApiError, apiFetch } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import type { StayDetail } from '@/lib/types';

export const metadata: Metadata = {
  title: '숙소 수정',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function EditStayPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  let stay: StayDetail;
  try {
    stay = await apiFetch<StayDetail>(`/stays/${id}`);
  } catch (err) {
    if (err instanceof ApiError && [403, 404].includes(err.status)) notFound();
    throw err;
  }

  // The API enforces this too; checking here avoids rendering a dead form.
  if (!stay.isMine) notFound();

  return (
    <>
      <SiteHeader user={user} active="map" />
      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">숙소 수정</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          주소를 바꾸면 지도 핀도 다시 찍혀요. 도시 이름은 등록할 때만 정할 수 있어요.
        </p>
        <div className="mt-6">
          <StayForm stay={stay} />
        </div>
      </main>
    </>
  );
}
