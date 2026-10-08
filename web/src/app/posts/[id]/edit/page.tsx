import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import PostForm from '@/components/PostForm';
import { ApiError, apiFetch } from '@/lib/api';
import { loadBoards } from '@/lib/posts';
import { getCurrentUser } from '@/lib/user';
import type { PostDetail } from '@/lib/types';

export const metadata: Metadata = {
  title: '글 수정',
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

export default async function EditPostPage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/posts/${id}/edit`)}`);

  let post: PostDetail;
  try {
    post = await apiFetch<PostDetail>(`/posts/${id}`);
  } catch (err) {
    if (err instanceof ApiError && [401, 403, 404].includes(err.status)) notFound();
    throw err;
  }

  // The API enforces this too; checking here avoids rendering a form that
  // cannot be submitted.
  if (post.authorId !== user.id) notFound();

  const boards = await loadBoards();

  return (
    <>
      <SiteHeader user={user} active="boards" />
      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <h1 className="text-2xl font-bold -tracking-[0.4px]">글 수정</h1>
        <div className="mt-6">
          <PostForm
            boards={boards}
            postId={post.id}
            initialBoardSlug={post.boardSlug}
            initialTitle={post.title}
            initialHtml={post.content}
            initialCity={post.city}
          />
        </div>
      </main>
    </>
  );
}
