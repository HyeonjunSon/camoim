import Link from 'next/link';
import type { PostSummary } from '@/lib/types';
import { timeAgo } from '@/lib/format';
import { cityLabel } from '@/lib/boards';
import { BriefcaseIcon } from './icons';
import { getI18n } from '@/lib/i18n/server';

function CardShell({
  title,
  href,
  more,
  children,
}: {
  title: string;
  href: string;
  more: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex-[1_1_300px] rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold">{title}</h2>
        <Link href={href} className="text-sm text-brand-ink hover:text-brand-ink-hover">
          {more}
        </Link>
      </div>
      {children}
    </section>
  );
}

export default async function FreeAndJobs({
  freePosts,
  jobsPosts,
  city,
}: {
  freePosts: PostSummary[];
  jobsPosts: PostSummary[];
  city: string;
}) {
  const { lang, m } = await getI18n();
  return (
    <div className="flex flex-wrap gap-5">
      <CardShell title={m.home.freeLatest} href="/boards/free" more={m.common.more}>
        {freePosts.length === 0 ? (
          <p className="py-4 text-sm text-muted">{m.common.noPostsYet}</p>
        ) : (
          <ul>
            {freePosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}`}
                  prefetch={false}
                  className="block border-t border-line-faint py-2.5 text-ink"
                >
                  <span className="block truncate text-[15px]">{post.title}</span>
                  <span className="mt-1 block text-[12.5px] text-muted">
                    {[post.nickname, timeAgo(post.createdAt, undefined, lang), m.common.comments(post.commentCount ?? 0)]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardShell>

      <CardShell title={m.home.jobs(cityLabel(city, lang))} href="/boards/jobs" more={m.common.more}>
        {jobsPosts.length === 0 ? (
          <p className="py-4 text-sm text-muted">{m.common.noPostsYet}</p>
        ) : (
          <ul>
            {jobsPosts.map((post) => (
              <li key={post.id}>
                <Link
                  href={`/posts/${post.id}`}
                  prefetch={false}
                  className="flex items-center gap-3 border-t border-line-faint py-2.5 text-ink"
                >
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[#E7F7EF] text-[#0F7A4F]"
                  >
                    <BriefcaseIcon />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px]">{post.title}</span>
                    <span className="mt-0.5 block text-[12.5px] text-muted">
                      {[cityLabel(post.city, lang), timeAgo(post.createdAt, undefined, lang)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardShell>
    </div>
  );
}
