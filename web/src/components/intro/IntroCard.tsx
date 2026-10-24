import Link from 'next/link';
import Image from 'next/image';
import type { IntroPost } from '@/lib/types';
import { GENDER_COLORS, ageFromBirthYear, genderLabel, jobLabel } from '@/lib/intro';
import { getI18n } from '@/lib/i18n/server';

/** No nickname, no avatar — only what the writer chose to publish. */
export default async function IntroCard({ post }: { post: IntroPost }) {
  const { lang, m: all } = await getI18n();
  const m = all.intro;
  const tint = GENDER_COLORS[post.gender] ?? '#374151';

  return (
    <li>
      <Link
        href={`/intro/${post.id}`}
        prefetch={false}
        className="flex h-full gap-3.5 rounded-card border border-line-soft bg-surface p-4 text-ink hover:border-line-strong"
      >
        <span className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-shade">
          {post.photo ? (
            <Image src={post.photo} alt="" fill sizes="80px" className="object-cover" />
          ) : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-[13px] font-bold" style={{ color: tint }}>
              {genderLabel(post.gender, lang)}
            </span>
            <span className="text-[13px] text-ink-3">{ageFromBirthYear(post.birthYear, undefined, lang)}</span>
            {post.mode === 'proxy' ? (
              <span className="rounded-md bg-[#FEF3C7] px-1.5 py-0.5 text-[11px] font-bold text-[#B45309]">
                {m.proxyBadge}
              </span>
            ) : null}
          </span>
          <span className="mt-1 block line-clamp-2 text-[15.5px] leading-snug font-semibold">
            {post.headline}
          </span>
          <span className="mt-1.5 block text-[12.5px] text-muted">
            {[post.region, jobLabel(post.job, lang), post.height].filter(Boolean).join(' · ')}
          </span>
          <span className="mt-1 block text-[12px] text-muted">
            {post.daysLeft > 0 ? m.daysLeft(post.daysLeft) : m.expired}
          </span>
        </span>
      </Link>
    </li>
  );
}
