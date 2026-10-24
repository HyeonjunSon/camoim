import type { Metadata } from 'next';
import UniversityManager from '@/components/admin/UniversityManager';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminUniversity } from '@/lib/types';

export const metadata: Metadata = {
  title: '학교 관리',
  robots: { index: false, follow: false },
};

export default async function AdminUniversitiesPage() {
  const universities = await apiFetchOrNull<AdminUniversity[]>('/admin/universities');

  return (
    <main className="mx-auto max-w-[900px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">학교 관리</h1>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
        학교를 추가하면 자유·익명 게시판 두 개가 자동으로 생겨요. 비활성화하면 학교 인증 목록에서
        빠지지만 기존 회원과 게시판은 그대로 남아요. 회원이나 게시판이 있는 학교는 지울 수 없어요.
      </p>
      <div className="mt-6">
        {universities ? (
          <UniversityManager universities={universities} />
        ) : (
          <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
            학교 목록을 불러오지 못했어요.
          </p>
        )}
      </div>
    </main>
  );
}
