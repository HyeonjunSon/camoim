import Link from 'next/link';
import type { CommunityLinks } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';

const FIELDS: { key: 'instagram' | 'kakaoOpen' | 'discord' | 'homepage'; icon: string }[] = [
  { key: 'instagram', icon: '📷' },
  { key: 'kakaoOpen', icon: '💬' },
  { key: 'discord', icon: '🎧' },
  { key: 'homepage', icon: '🔗' },
];

/**
 * The links a group or school keeps outside CaMoim. The server normalises them
 * on save (an `@handle` becomes a full instagram URL), so they are rendered as
 * given rather than rebuilt here.
 */
export default async function CommunityCard({
  community,
  editHref,
  canEdit,
  title,
}: {
  community: CommunityLinks;
  editHref?: string;
  canEdit?: boolean;
  title?: string;
}) {
  const links = FIELDS.filter((f) => community[f.key]);
  const hasAnything = links.length > 0 || !!community.notice;

  if (!hasAnything && !canEdit) return null;
  const c = (await getI18n()).m.community;

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold">{title ?? c.title}</h2>
        {canEdit && editHref ? (
          <Link href={editHref} className="text-[13px] text-brand-ink hover:text-brand-ink-hover">
            {c.decorate}
          </Link>
        ) : null}
      </div>

      {community.notice ? (
        <p className="mt-3 rounded-[10px] bg-brand-tint px-3.5 py-3 text-[14px] leading-relaxed whitespace-pre-wrap text-brand-ink-hover">
          {community.notice}
        </p>
      ) : null}

      {links.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {links.map((f) => (
            <li key={f.key}>
              <a
                href={community[f.key]}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="flex items-center gap-2.5 rounded-control px-2.5 py-2 text-[14.5px] text-ink-2 hover:bg-field"
              >
                <span aria-hidden>{f.icon}</span>
                <span className="flex-1 truncate">{c[f.key]}</span>
                <span aria-hidden className="text-muted">
                  ›
                </span>
              </a>
            </li>
          ))}
        </ul>
      ) : canEdit ? (
        <p className="mt-3 text-[13.5px] text-muted">
          {c.emptyHint}
        </p>
      ) : null}
    </section>
  );
}
