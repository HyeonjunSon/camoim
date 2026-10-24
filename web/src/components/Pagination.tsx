import Link from 'next/link';
import { getI18n } from '@/lib/i18n/server';

/**
 * Plain links, so a page is shareable and crawlable and needs no JavaScript.
 * A window of five keeps the row from wrapping on a phone.
 */
export default async function Pagination({
  page,
  total,
  perPage,
  hrefFor,
}: {
  page: number;
  total: number;
  perPage: number;
  hrefFor: (page: number) => string;
}) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  if (lastPage <= 1) return null;
  const { m } = await getI18n();

  const start = Math.max(1, Math.min(page - 2, lastPage - 4));
  const pages = Array.from({ length: Math.min(5, lastPage) }, (_, i) => start + i);

  return (
    <nav aria-label={m.boards.pages} className="flex items-center justify-center gap-1.5 py-4">
      {page > 1 ? (
        <Link
          href={hrefFor(page - 1)}
          rel="prev"
          aria-label={m.boards.prevPage}
          className="flex size-10 items-center justify-center rounded-[10px] border border-line-strong bg-surface font-semibold text-ink-3 hover:bg-field"
        >
          ‹
        </Link>
      ) : null}

      {pages.map((n) => {
        const on = n === page;
        return (
          <Link
            key={n}
            href={hrefFor(n)}
            aria-current={on ? 'page' : undefined}
            className={`flex size-10 items-center justify-center rounded-[10px] border font-semibold ${
              on
                ? 'border-ink bg-ink text-white'
                : 'border-line-strong bg-surface text-ink-3 hover:bg-field'
            }`}
          >
            {n}
          </Link>
        );
      })}

      {page < lastPage ? (
        <Link
          href={hrefFor(page + 1)}
          rel="next"
          aria-label={m.boards.nextPage}
          className="flex size-10 items-center justify-center rounded-[10px] border border-line-strong bg-surface font-semibold text-ink-3 hover:bg-field"
        >
          ›
        </Link>
      ) : null}
    </nav>
  );
}
