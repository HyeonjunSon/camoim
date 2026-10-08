import Link from 'next/link';
import type { User } from '@/lib/types';
import { BellIcon, PlusIcon, SearchIcon } from './icons';
import UserMenu from './UserMenu';

const NAV = [
  { href: '/', label: '홈', key: 'home' },
  { href: '/boards', label: '게시판', key: 'boards' },
  { href: '/map', label: '지도', key: 'map' },
  { href: '/chat', label: '채팅', key: 'chat' },
] as const;

export type NavKey = (typeof NAV)[number]['key'];

export default function SiteHeader({
  user,
  active,
  query = '',
}: {
  user: User | null;
  active?: NavKey;
  query?: string;
}) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-2 sm:px-6">
        <Link href="/" className="flex items-center gap-2 text-ink">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-[9px] bg-brand text-[17px] font-bold text-white"
          >
            C
          </span>
          <span className="text-xl font-bold -tracking-[0.4px]">캐모임</span>
        </Link>

        <nav aria-label="주요 메뉴" className="flex flex-wrap gap-1">
          {NAV.map((item) => {
            const on = item.key === active;
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={
                  on
                    ? 'rounded-[10px] bg-brand-tint px-3.5 py-2.5 text-[15px] font-semibold text-brand-ink'
                    : 'rounded-[10px] px-3.5 py-2.5 text-[15px] font-semibold text-ink-3 hover:bg-field'
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <form action="/search" className="flex h-11 min-w-0 flex-[1_1_240px] items-center gap-2 rounded-control bg-field px-3.5">
          <SearchIcon className="shrink-0 text-muted" />
          <label htmlFor="site-search" className="sr-only-label">
            검색
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            defaultValue={query}
            placeholder="게시글, 모임, 회원 검색"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </form>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                aria-label="알림"
                className="flex size-11 items-center justify-center rounded-control text-ink hover:bg-field"
              >
                <BellIcon />
              </Link>
              <Link
                href="/write"
                className="flex h-11 items-center gap-1.5 rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
              >
                <PlusIcon />
                글쓰기
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex h-11 items-center rounded-control px-4 text-[15px] font-semibold text-ink-3 hover:bg-field"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
              >
                회원가입
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
