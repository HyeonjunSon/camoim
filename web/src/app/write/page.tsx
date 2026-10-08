import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import PostForm from '@/components/PostForm';
import { loadBoards } from '@/lib/posts';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '글쓰기',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ board?: string }> };

export default async function WritePage({ searchParams }: Props) {
  const { board } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(board ? `/write?board=${board}` : '/write')}`);
  }

  const boards = await loadBoards();

  return (
    <>
      <SiteHeader user={user} active="boards" />
      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">글쓰기</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">
          사진은 본문 안에 바로 넣을 수 있어요. 앱에서도 같은 모양으로 보여요.
        </p>
        <div className="mt-6">
          <PostForm
            boards={boards}
            initialBoardSlug={board}
            defaultCity={user.city ?? ''}
          />
        </div>
      </main>
    </>
  );
}
