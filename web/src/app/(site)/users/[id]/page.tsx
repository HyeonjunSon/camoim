import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import StartChatButton from '@/components/StartChatButton';
import BlockButton from '@/components/BlockButton';
import ReportButton from '@/components/ReportButton';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { cityLabel } from '@/lib/boards';
import { initial, timeAgo } from '@/lib/format';
import type { BlockStatus, PublicProfile } from '@/lib/types';

const ROLE_LABELS: Record<string, string> = {
  student: '유학생',
  working_holiday: '워홀',
  general: '일반',
  admin: '운영자',
};

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const profile = await apiFetchOrNull<PublicProfile>(`/users/${id}`);
  return {
    title: profile?.nickname ?? '회원',
    // A member page is personal data; it does not belong in a search index.
    robots: { index: false, follow: false },
  };
}

export default async function UserProfilePage({ params }: Props) {
  const { id } = await params;
  const user = await getCurrentUser();

  let profile: PublicProfile;
  try {
    profile = await apiFetch<PublicProfile>(`/users/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const isMe = user?.id === profile.id;
  // Only meaningful for someone else, and the endpoint needs a session.
  const blockStatus =
    user && !isMe
      ? ((await apiFetchOrNull<BlockStatus>(`/users/${id}/block-status`)) ?? {
          blocked: false,
          blockChat: false,
          hideContent: false,
        })
      : null;

  return (
    <>

      <main className="mx-auto max-w-[840px] px-4 pb-20 pt-7 sm:px-6">
        <section className="rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
          <div className="flex flex-wrap items-start gap-4">
            {profile.avatarUrl ? (
              <Image
                src={profile.avatarUrl}
                alt=""
                width={72}
                height={72}
                className="size-18 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="flex size-18 shrink-0 items-center justify-center rounded-full bg-brand-tint text-2xl font-bold text-brand-ink"
              >
                {initial(profile.nickname)}
              </span>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold">{profile.nickname}</h1>
                {profile.verified && profile.university ? (
                  <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
                    {profile.university} 인증
                  </span>
                ) : null}
                {profile.tradeSoldCount > 0 ? (
                  <span className="rounded-md bg-positive-tint px-1.5 py-0.5 text-[11.5px] font-bold text-positive">
                    거래 {profile.tradeSoldCount}회
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 text-[13.5px] text-muted">
                {[
                  ROLE_LABELS[profile.role] ?? null,
                  cityLabel(profile.city) || null,
                  `${timeAgo(profile.createdAt)} 가입`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {profile.bio ? (
                <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap">{profile.bio}</p>
              ) : null}
            </div>
          </div>

          {isMe ? (
            <Link
              href="/mypage"
              className="mt-5 flex h-11 w-full items-center justify-center rounded-control border border-line-strong text-[15px] font-semibold text-ink-3 hover:bg-field sm:w-auto sm:px-5"
            >
              내 프로필 수정
            </Link>
          ) : (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="min-w-[200px] flex-1">
                <StartChatButton targetUserId={profile.id} signedIn={!!user} />
              </div>
              {blockStatus ? (
                <BlockButton
                  userId={profile.id}
                  nickname={profile.nickname}
                  initialStatus={blockStatus}
                />
              ) : null}
              <ReportButton
                targetType="user"
                targetId={profile.id}
                signedIn={!!user}
                className="flex h-11 items-center rounded-control px-3 text-sm text-muted hover:bg-field hover:text-danger"
              />
            </div>
          )}
        </section>

        <section className="mt-5">
          <h2 className="text-lg font-bold">작성한 글 {profile.posts.length}</h2>
          {profile.posts.length === 0 ? (
            <p className="mt-3 rounded-card border border-line-soft bg-surface px-5 py-10 text-center text-sm text-muted">
              공개된 글이 없어요. 익명 글은 여기 표시되지 않아요.
            </p>
          ) : (
            <ul className="mt-3 overflow-hidden rounded-card border border-line-soft bg-surface">
              {profile.posts.map((post) => (
                <li key={post.id} className="border-b border-line-faint last:border-b-0">
                  <Link
                    href={`/posts/${post.id}`}
                    prefetch={false}
                    className="block px-5 py-4 text-ink hover:bg-brand-tint-soft"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {post.boardName ? (
                        <span className="text-[12.5px] text-muted">{post.boardName}</span>
                      ) : null}
                      <span className="min-w-0 flex-1 truncate font-semibold">{post.title}</span>
                    </span>
                    <span className="mt-1 block text-[12.5px] text-muted">
                      {[timeAgo(post.createdAt), `♡ ${post.likeCount ?? 0}`, `댓글 ${post.commentCount ?? 0}`].join(
                        ' · '
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </>
  );
}
