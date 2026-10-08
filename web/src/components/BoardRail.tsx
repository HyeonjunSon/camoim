import Link from 'next/link';
import type { Board } from '@/lib/types';
import { boardTone } from '@/lib/boards';

export default function BoardRail({
  boards,
  activeSlug,
}: {
  boards: Board[];
  activeSlug?: string;
}) {
  const general = boards.filter((b) => !b.isUniversityBoard);
  const school = boards.filter((b) => b.isUniversityBoard);

  return (
    <aside className="w-full flex-[1_1_210px] rounded-card border border-line-soft bg-surface px-2.5 py-4 lg:max-w-[240px]">
      <h2 className="px-2.5 pt-1 pb-2.5 text-[13px] font-semibold text-muted">게시판</h2>
      <ul>
        {general.map((board) => {
          const tone = boardTone(board.slug);
          const on = board.slug === activeSlug;
          return (
            <li key={board.id}>
              <Link
                href={`/boards/${board.slug}`}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-2.5 rounded-[10px] px-2.5 py-2.5 text-[14.5px] ${
                  on ? 'bg-brand-tint font-bold text-brand-ink-hover' : 'text-ink-2 hover:bg-field'
                }`}
              >
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: tone.dot }}
                />
                <span className="flex-1 truncate">{board.name}</span>
                {board.slug === 'intro' ? (
                  <span className="rounded-md bg-[#FFEDD5] px-1.5 py-0.5 text-[11px] font-bold text-[#C2410C]">
                    NEW
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>

      {school.length > 0 ? (
        <div className="mx-1.5 mt-2.5 border-t border-line-faint pt-3">
          <h2 className="px-1 pb-2 text-[13px] font-semibold text-muted">내 학교</h2>
          <ul>
            {school.map((board) => (
              <li key={board.id}>
                <Link
                  href={`/boards/${board.slug}`}
                  className="flex items-center gap-2.5 rounded-[10px] px-1.5 py-2.5 text-[14.5px] text-ink-2 hover:bg-field"
                >
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: boardTone('university').dot }}
                  />
                  <span className="flex-1 truncate">{board.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </aside>
  );
}
