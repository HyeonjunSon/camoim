import type { Metadata } from 'next';
import Link from 'next/link';
import BoardRail from '@/components/BoardRail';
import { apiFetchOrNull } from '@/lib/api';
import { loadBoards } from '@/lib/posts';
import { getCurrentUser } from '@/lib/user';
import { boardDescription, boardName, boardTone } from '@/lib/boards';
import { getI18n } from '@/lib/i18n/server';
import { timeAgo } from '@/lib/format';
import type { LatestByBoard } from '@/lib/types';

export const metadata: Metadata = {
  title: '게시판',
  description: '중고거래, 룸랜트, 구인구직, 이민·유학, 워킹홀리데이 — 캐나다 한인 커뮤니티 게시판.',
};

export default async function BoardsPage() {
  const user = await getCurrentUser();
  const [boards, latest, { lang, m }] = await Promise.all([
    loadBoards(),
    apiFetchOrNull<LatestByBoard[]>('/posts/latest-by-board'),
    getI18n(),
  ]);

  const latestByBoardId = new Map((latest ?? []).map((row) => [row.boardId, row.latest]));
  const general = boards.filter((b) => !b.isUniversityBoard);
  const school = boards.filter((b) => b.isUniversityBoard);

  return (
    <>

      <div className="mx-auto flex max-w-[1240px] flex-wrap items-start gap-6 px-4 pb-16 pt-7 sm:px-6">
        <BoardRail boards={boards} />

        <main className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
          <div>
            <h1 className="text-2xl font-bold -tracking-[0.4px]">{m.boards.title}</h1>
            <p className="mt-1.5 text-[14.5px] text-muted">{m.boards.intro}</p>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {general.map((board) => {
              const tone = boardTone(board.slug);
              const row = latestByBoardId.get(board.id);
              return (
                <li key={board.id}>
                  <Link
                    href={`/boards/${board.slug}`}
                    className="flex h-full flex-col rounded-card border border-line-soft bg-surface px-5 py-4.5 text-ink hover:border-line-strong"
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ background: tone.dot }}
                      />
                      <span className="text-[16.5px] font-bold">{boardName(board.slug, board.name, lang)}</span>
                    </span>
                    {board.description ? (
                      <span className="mt-1.5 text-[13.5px] text-muted">
                        {boardDescription(board.slug, board.description, lang)}
                      </span>
                    ) : null}
                    <span className="mt-3 border-t border-line-faint pt-3 text-[13.5px]">
                      {row ? (
                        <>
                          <span className="block truncate text-ink-2">{row.title}</span>
                          <span className="mt-0.5 block text-xs text-muted">
                            {row.nickname} · {timeAgo(row.createdAt, undefined, lang)}
                          </span>
                        </>
                      ) : (
                        <span className="text-muted">{m.boards.empty}</span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>

          {school.length > 0 ? (
            <section className="rounded-card border border-line-soft bg-surface px-5 py-5 sm:px-6">
              <h2 className="text-lg font-bold">{m.boards.schoolTitle}</h2>
              <p className="mt-1 text-[13.5px] text-muted">{m.boards.schoolHint}</p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {school.map((board) => (
                  <li key={board.id}>
                    <Link
                      href={`/boards/${board.slug}`}
                      className="flex h-9 items-center gap-2 rounded-pill border border-line-strong px-3.5 text-[13.5px] font-semibold text-ink-3 hover:bg-field"
                    >
                      <span
                        aria-hidden
                        className="size-2 rounded-full"
                        style={{ background: boardTone('university').dot }}
                      />
                      {board.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </main>
      </div>
    </>
  );
}
