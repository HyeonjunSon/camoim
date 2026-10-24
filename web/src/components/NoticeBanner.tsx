import Link from 'next/link';
import type { Notice } from '@/lib/types';
import { getI18n } from '@/lib/i18n/server';

export default async function NoticeBanner({ notice }: { notice: Notice }) {
  const { m } = await getI18n();
  return (
    <Link
      href={`/notices/${notice.id}`}
      className="flex items-center gap-3 rounded-[14px] bg-brand-tint px-4 py-3.5 text-ink-2 hover:bg-[#E9E7FA] sm:px-4.5"
    >
      <span className="shrink-0 rounded-md bg-brand-strong px-2 py-1 text-xs font-bold text-white">
        {m.home.notice}
      </span>
      <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{notice.title}</span>
      <span className="hidden shrink-0 text-sm text-brand-ink sm:inline">{m.common.details}</span>
    </Link>
  );
}
