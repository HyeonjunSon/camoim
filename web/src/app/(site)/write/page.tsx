import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import PostForm from '@/components/PostForm';
import { apiFetchOrNull } from '@/lib/api';
import { loadBoards } from '@/lib/posts';
import type { GroupDetail } from '@/lib/types';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '글쓰기',
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ board?: string; group?: string }> };

export default async function WritePage({ searchParams }: Props) {
  const { board, group: groupId } = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(board ? `/write?board=${board}` : '/write')}`);
  }

  // Writing into a group needs its name for the header, and the fetch doubles as
  // the membership check: a non-member gets 403 and lands on the 404 page.
  const [boards, group, { m }] = await Promise.all([
    loadBoards(),
    groupId ? apiFetchOrNull<GroupDetail>(`/groups/${groupId}`) : Promise.resolve(null),
    getI18n(),
  ]);

  if (groupId && (!group || group.myMembership?.status !== 'active')) notFound();

  return (
    <>
      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.write.title}</h1>
        <p className="mt-1.5 text-[14.5px] text-muted">{m.write.intro}</p>
        <div className="mt-6">
          <PostForm
            boards={boards}
            group={group ? { id: group.id, name: group.name } : undefined}
            initialBoardSlug={board}
            defaultCity={user.city ?? ''}
          />
        </div>
      </main>
    </>
  );
}
