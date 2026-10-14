import Link from 'next/link';
import type { Board } from '@/lib/types';
import { boardTone } from '@/lib/boards';
import LinkPending from './LinkPending';

/**
 * The board switcher: a vertical rail from `lg` up, a horizontal chip row below.
 *
 * It used to be a vertical list at every width. Inside a wrapping flex row its
 * 210px basis took a whole line once the viewport got narrow, so thirteen boards
 * stacked full-width at the top and pushed the actual page off screen. One list
 * serves both shapes here, so there is no duplicated markup to drift.
 */
export default function BoardRail({
  boards,
  activeSlug,
}: {
  boards: Board[];
  activeSlug?: string;
}) {
  const general = boards.filter((b) => !b.isUniversityBoard);
  const school = boards.filter((b) => b.isUniversityBoard);
  const ordered = [...general, ...school];

  return (
    <aside className="w-full lg:max-w-[240px] lg:flex-[1_1_210px] lg:rounded-card lg:border lg:border-line-soft lg:bg-surface lg:px-2.5 lg:py-4">
      <h2 className="hidden px-2.5 pt-1 pb-2.5 text-[13px] font-semibold text-muted lg:block">
        게시판
      </h2>

      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
        {ordered.map((board, i) => {
          const tone = boardTone(board.slug);
          const on = board.slug === activeSlug;
          const firstSchool = board.isUniversityBoard && i === general.length;

          return (
            // No `display: contents` here: it drops the list-item role from the
            // accessibility tree in some engines.
            <li key={board.id} className="shrink-0 lg:shrink">
              {/* The school group gets a heading on the rail; in the chip row the
                  blue dot already tells them apart. */}
              {firstSchool ? (
                <span className="hidden lg:block lg:border-t lg:border-line-faint lg:px-2.5 lg:pt-3 lg:pb-2 lg:text-[13px] lg:font-semibold lg:text-muted">
                  내 학교
                </span>
              ) : null}
              <Link
                href={`/boards/${board.slug}`}
                aria-current={on ? 'page' : undefined}
                className={`flex h-9 shrink-0 items-center gap-2 rounded-pill border px-3 text-[13.5px] whitespace-nowrap lg:h-auto lg:w-full lg:rounded-[10px] lg:border-0 lg:px-2.5 lg:py-2.5 lg:text-[14.5px] lg:whitespace-normal ${
                  on
                    ? 'border-ink bg-ink font-semibold text-white lg:bg-brand-tint lg:font-bold lg:text-brand-ink-hover'
                    : 'border-line-strong bg-surface text-ink-2 hover:bg-field'
                }`}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: on ? '#FFFFFF' : tone.dot }}
                />
                <span className="lg:flex-1 lg:truncate">{board.name}</span>
                <LinkPending className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-line-strong border-t-brand-ink" />
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
