import type { Metadata } from 'next';
import BoardManager from '@/components/admin/BoardManager';
import { apiFetchOrNull } from '@/lib/api';
import type { AdminBoard } from '@/lib/types';

export const metadata: Metadata = {
  title: '게시판 관리',
  robots: { index: false, follow: false },
};

export default async function AdminBoardsPage() {
  const boards = await apiFetchOrNull<AdminBoard[]>('/admin/boards');

  return (
    <main className="mx-auto max-w-[900px] px-4 pb-20 pt-7 sm:px-6">
      <h1 className="text-2xl font-bold -tracking-[0.4px]">게시판 관리</h1>
      <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">
        이름·설명·순서·익명 여부를 바꾸면 앱과 웹에 같이 적용돼요. 비로그인 방문자에게는 캐시 때문에
        최대 5분 뒤에 보여요. 글이 있는 게시판은 지울 수 없어요. 학교 게시판은 학교를 추가할 때 자동으로
        생겨요.
      </p>
      <div className="mt-6">
        {boards ? (
          <BoardManager boards={boards} />
        ) : (
          <p className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
            게시판을 불러오지 못했어요.
          </p>
        )}
      </div>
    </main>
  );
}
