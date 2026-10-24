import type { Metadata } from 'next';
import PushComposer from '@/components/admin/PushComposer';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminUniversity } from '@/lib/types';

export const metadata: Metadata = {
  title: '푸시 발송',
  robots: { index: false, follow: false },
};

export default async function AdminPushPage() {
  const universities = (await apiFetchOrNull<AdminUniversity[]>('/admin/universities')) ?? [];

  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">푸시 발송</h1>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
        앱을 설치하고 알림을 켜 둔 회원의 휴대폰으로 바로 가요. <strong className="text-ink-3">보낸 뒤에는 취소할 수
        없어요.</strong> 받는 사람 수를 먼저 확인해야 보낼 수 있어요.
      </p>
      <div className="mt-6">
        <PushComposer universities={universities.filter((u) => u.active).map((u) => u.name)} />
      </div>
    </main>
  );
}
