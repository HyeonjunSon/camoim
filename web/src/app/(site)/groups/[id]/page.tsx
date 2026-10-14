import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import GroupJoinButton from '@/components/GroupJoinButton';
import CommunityCard from '@/components/CommunityCard';
import { ApiError, apiFetch, apiFetchOrNull } from '@/lib/api';
import { getCurrentUser } from '@/lib/user';
import { groupCategoryLabel } from '@/lib/groups';
import { cityLabel } from '@/lib/boards';
import { initial, timeAgo } from '@/lib/format';
import type { GroupDetail, PostSummary } from '@/lib/types';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const group = await apiFetchOrNull<GroupDetail>(`/groups/${id}`);
  if (!group) return { title: '모임' };
  return {
    title: group.name,
    description: group.description?.slice(0, 150),
    // A school club belongs to that school's verified members only.
    robots: group.university ? { index: false, follow: false } : undefined,
  };
}

export default async function GroupDetailPage({ params }: Props) {
  const { id } = await params;

  // user and group are independent, so they go together; the posts list depends
  // on the membership the group response carries, so it cannot.
  const [user, groupResult] = await Promise.all([
    getCurrentUser(),
    apiFetch<GroupDetail>(`/groups/${id}`).then(
      (value) => ({ ok: true as const, value }),
      (error: unknown) => ({ ok: false as const, error })
    ),
  ]);

  if (!groupResult.ok) {
    const err = groupResult.error;
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const group = groupResult.value;

  const isMember = group.myMembership?.status === 'active';
  const canManage =
    isMember && (group.myMembership?.role === 'owner' || group.myMembership?.role === 'manager');

  // The posts endpoint is members-only, so it is only asked for when it will answer.
  const postList = isMember
    ? await apiFetchOrNull<{ posts: PostSummary[]; total: number }>(`/groups/${id}/posts?limit=10`)
    : null;

  return (
    <>

      <main className="mx-auto max-w-[1000px] px-4 pb-20 pt-6 sm:px-6">
        <nav aria-label="경로" className="mb-4 flex gap-2 text-[13.5px] text-muted">
          <Link href="/groups" className="hover:text-ink-3">
            모임
          </Link>
          <span aria-hidden>›</span>
          <span className="text-ink">{groupCategoryLabel(group.category)}</span>
        </nav>

        {group.status === 'pending_review' ? (
          <p className="mb-4 rounded-[10px] bg-[#FEF3C7] px-3.5 py-3 text-sm text-[#B45309]">
            운영팀 승인을 기다리는 모임이에요. 승인되면 목록에 올라가요.
          </p>
        ) : null}
        {group.status === 'rejected' ? (
          <p className="mb-4 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
            승인되지 않은 모임이에요.
            {group.rejectReason ? ` 사유: ${group.rejectReason}` : ''}
          </p>
        ) : null}

        <div className="flex flex-wrap items-start gap-6">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4">
            <section className="overflow-hidden rounded-card border border-line-soft bg-surface">
              {group.coverImage ? (
                <div className="relative aspect-[16/6] bg-shade">
                  <Image src={group.coverImage} alt="" fill sizes="700px" className="object-cover" />
                </div>
              ) : null}
              <div className="px-5 py-5 sm:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                    {groupCategoryLabel(group.category)}
                  </span>
                  {group.university ? (
                    <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
                      {group.university} 동아리
                    </span>
                  ) : null}
                  {group.joinPolicy === 'approval' ? (
                    <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[11.5px] font-bold text-[#B45309]">
                      승인 필요
                    </span>
                  ) : null}
                </div>

                <h1 className="mt-3 text-2xl font-bold -tracking-[0.4px]">{group.name}</h1>
                <p className="mt-1.5 text-[13.5px] text-muted">
                  {[
                    `멤버 ${group.memberCount}/${group.maxMembers}명`,
                    cityLabel(group.city) || null,
                    `${timeAgo(group.createdAt)} 개설`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>

                {group.description ? (
                  <p className="mt-4 text-[15px] leading-relaxed whitespace-pre-wrap">
                    {group.description}
                  </p>
                ) : null}

                <div className="mt-5">
                  <GroupJoinButton group={group} signedIn={!!user} />
                </div>

                {isMember ? (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-line-faint pt-4">
                    <Link
                      href={`/write?group=${group.id}`}
                      className="flex h-10 items-center rounded-control bg-field px-3.5 text-sm font-semibold text-ink-2 hover:bg-line-faint"
                    >
                      글쓰기
                    </Link>
                    <Link
                      href={`/groups/${group.id}/members`}
                      className="flex h-10 items-center rounded-control bg-field px-3.5 text-sm font-semibold text-ink-2 hover:bg-line-faint"
                    >
                      멤버 {canManage ? '관리' : '보기'}
                    </Link>
                    {canManage ? (
                      <Link
                        href={`/groups/${group.id}/edit`}
                        className="flex h-10 items-center rounded-control bg-field px-3.5 text-sm font-semibold text-ink-2 hover:bg-line-faint"
                      >
                        모임 설정
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </section>

            {isMember ? (
              <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-lg font-bold">모임 게시판</h2>
                  <span className="text-[13px] text-muted">글 {postList?.total ?? 0}개</span>
                </div>
                {(postList?.posts.length ?? 0) === 0 ? (
                  <p className="py-8 text-center text-sm text-muted">
                    아직 글이 없어요. 첫 글을 올려보세요.
                  </p>
                ) : (
                  <ul className="mt-2">
                    {postList?.posts.map((post) => (
                      <li key={post.id}>
                        <Link
                          href={`/posts/${post.id}`}
                          prefetch={false}
                          className="flex items-center gap-3 border-t border-line-faint py-3.5 text-ink"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              {post.pinned ? (
                                <span className="rounded-[5px] bg-brand-tint px-1.5 py-0.5 text-[11px] font-bold text-brand-ink-hover">
                                  고정
                                </span>
                              ) : null}
                              <span className="truncate text-[15px] font-semibold">{post.title}</span>
                            </span>
                            <span className="mt-1 block text-[12.5px] text-muted">
                              {[post.nickname, timeAgo(post.createdAt), `댓글 ${post.commentCount ?? 0}`]
                                .filter(Boolean)
                                .join(' · ')}
                            </span>
                          </span>
                          {post.thumbnail ? (
                            <span className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-shade">
                              <Image src={post.thumbnail} alt="" fill sizes="56px" className="object-cover" />
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            ) : (
              <section className="rounded-card border border-line-soft bg-surface px-5 py-10 text-center">
                <p className="text-sm text-muted">
                  모임 게시판과 단체 채팅은 멤버만 볼 수 있어요.
                </p>
              </section>
            )}
          </div>

          <aside className="flex w-full flex-[1_1_280px] flex-col gap-4 lg:max-w-[300px]">
            <CommunityCard
              community={group.community}
              canEdit={group.canEditCommunity}
              editHref={`/groups/${group.id}/edit`}
              title="모임 링크"
            />

            <section className="rounded-card border border-line-soft bg-surface px-5 py-5">
              <h2 className="text-[15px] font-bold">모임장</h2>
              <Link
                href={`/users/${group.owner.id}`}
                className="mt-3 flex items-center gap-3 text-ink hover:underline"
              >
                {group.owner.avatarUrl ? (
                  <Image
                    src={group.owner.avatarUrl}
                    alt=""
                    width={40}
                    height={40}
                    className="size-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-tint font-bold text-brand-ink"
                  >
                    {initial(group.owner.nickname)}
                  </span>
                )}
                <span className="truncate text-[15px] font-semibold">{group.owner.nickname}</span>
              </Link>
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
