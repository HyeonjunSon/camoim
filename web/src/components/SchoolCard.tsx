import Link from 'next/link';
import type { SchoolCommunity } from '@/lib/types';
import { initial } from '@/lib/format';
import { getI18n } from '@/lib/i18n/server';

/**
 * Only rendered for a verified member of a school. The school community itself
 * is members-only on the server, and these pages are kept out of search
 * results, so nothing here is shown to a visitor.
 */
export default async function SchoolCard({ school }: { school: SchoolCommunity }) {
  const { m } = await getI18n();
  const name = school.university;

  return (
    <section className="rounded-card border border-line-soft bg-surface px-5 py-4.5">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">{m.home.schoolTitle}</h2>
        <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
          {m.home.schoolVerified}
        </span>
      </div>
      <Link href="/school" className="mt-3.5 flex items-center gap-3 text-ink">
        <span
          aria-hidden
          className="flex size-11 shrink-0 items-center justify-center rounded-control bg-[#DBEAFE] font-bold text-[#1D4ED8]"
        >
          {initial(name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold">{name}</span>
          <span className="block text-[12.5px] text-muted">{m.home.schoolMembersOnly}</span>
        </span>
      </Link>
    </section>
  );
}
