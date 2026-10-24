import Link from 'next/link';
import type { Board } from '@/lib/types';
import { boardTone, groupBoards } from '@/lib/boards';
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
  // Sections in the order 캐스모 readers scan a cafe menu; school boards last.
  const sections = [
    ...groupBoards(general),
    ...(school.length ? [{ title: '내 학교', boards: school }] : []),
  ];
  const ordered = sections.flatMap((sec, si) =>
    sec.boards.map((board, bi) => ({ board, heading: bi === 0 ? sec.title : null, first: si === 0 && bi === 0 }))
  );

  return (
    // Sticky from `lg` up, where the rail is a column beside a long feed: the
    // board switcher is the main thing you reach for while scrolling, and
    // scrolling back to the top to change board is the kind of friction nobody
    // reports but everybody feels. `max-h` plus its own overflow keeps it honest
    // on a short window — a sticky element taller than the viewport would pin
    // its bottom items out of reach. Below `lg` it is a chip row at the top of
    // the page and sticky would only steal height.
    <aside className="w-full lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:max-w-[240px] lg:flex-[1_1_210px] lg:overflow-y-auto lg:rounded-card lg:border lg:border-line-soft lg:bg-surface lg:px-2.5 lg:py-4">
      <h2 className="sr-only-label">게시판</h2>

      <ul className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:flex-col lg:gap-0 lg:overflow-visible lg:px-0 lg:pb-0">
        {ordered.map(({ board, heading, first }) => {
          const tone = boardTone(board.slug);
          const on = board.slug === activeSlug;

          return (
            // No `display: contents` here: it drops the list-item role from the
            // accessibility tree in some engines.
            <li key={board.id} className="shrink-0 lg:shrink">
              {/* Section headings on the rail only; the chip row keeps the same
                  order, which is enough to read the grouping. */}
              {heading ? (
                <span
                  className={`hidden lg:block lg:px-2.5 lg:pb-1.5 lg:text-[12.5px] lg:font-semibold lg:text-muted ${
                    first ? 'lg:pt-0.5' : 'lg:mt-2 lg:border-t lg:border-line-faint lg:pt-3'
                  }`}
                >
                  {heading}
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
