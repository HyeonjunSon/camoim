'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { User } from '@/lib/types';
import { BellIcon, PlusIcon, SearchIcon } from './icons';
import UserMenu from './UserMenu';
import { ChatBadge, NotificationBadge } from './HeaderBadges';

/**
 * Rendered once by the (site) layout, not by each page.
 *
 * A layout is not re-rendered when you navigate between pages inside it, so the
 * header stays painted while the next page's data loads. When every page drew
 * its own header, a click replaced the entire screen and a 300ms wait read as a
 * full reload. Active state and the search box therefore come from the URL here
 * rather than from props.
 */
const NAV = [
  { href: '/', label: '홈', match: (p: string) => p === '/' },
  { href: '/boards', label: '게시판', match: (p: string) => p.startsWith('/boards') || p.startsWith('/posts') },
  { href: '/map', label: '지도', match: (p: string) => p.startsWith('/map') || p.startsWith('/businesses') || p.startsWith('/stays') },
  { href: '/chat', label: '채팅', match: (p: string) => p.startsWith('/chat') },
] as const;

export default function SiteHeader({ user }: { user: User | null }) {
  const pathname = usePathname() ?? '/';
  const params = useSearchParams();
  // The board feed calls it `search`; everywhere else it is `q`.
  const query = params.get('q') ?? params.get('search') ?? '';

  return (
    <header className="border-b border-line bg-surface">
      {/*
        DOM order is the mobile order — logo + actions on one line, then the
        search field, then the nav as a scrolling chip row. `md:order-*` puts
        them back in the desktop order on one line. At narrow widths the old
        single row wrapped into four, and the header ate the screen.
      */}
      <div className="mx-auto flex min-h-16 max-w-[1240px] flex-wrap items-center gap-x-4 gap-y-2.5 px-4 py-2 sm:px-6 md:gap-x-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 text-ink md:order-1">
          <span
            aria-hidden
            className="flex size-8 items-center justify-center rounded-[9px] bg-brand text-[17px] font-bold text-white"
          >
            C
          </span>
          <span className="text-xl font-bold -tracking-[0.4px]">캐모임</span>
        </Link>

        <nav
          aria-label="주요 메뉴"
          className="-mx-1 order-3 flex w-full gap-1 overflow-x-auto px-1 md:order-2 md:mx-0 md:w-auto md:flex-wrap md:overflow-visible md:px-0"
        >
          {NAV.map((item) => {
            const on = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={on ? 'page' : undefined}
                className={`flex shrink-0 items-center rounded-[10px] px-3 py-2 text-[14.5px] font-semibold whitespace-nowrap md:px-3.5 md:py-2.5 md:text-[15px] ${
                  on ? 'bg-brand-tint text-brand-ink' : 'text-ink-3 hover:bg-field'
                }`}
              >
                {item.label}
                {item.href === '/chat' && user ? <ChatBadge /> : null}
              </Link>
            );
          })}
        </nav>

        <form
          action="/search"
          className="order-2 flex h-11 w-full min-w-0 items-center gap-2 rounded-control bg-field px-3.5 md:order-3 md:w-auto md:flex-[1_1_240px]"
        >
          <SearchIcon className="shrink-0 text-muted" />
          <label htmlFor="site-search" className="sr-only-label">
            검색
          </label>
          <input
            id="site-search"
            name="q"
            type="search"
            // Keyed so a navigation that changes the query resets the field,
            // which an uncontrolled defaultValue alone would not do.
            key={query}
            defaultValue={query}
            placeholder="게시글, 모임, 회원 검색"
            className="min-w-0 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-muted"
          />
        </form>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:order-4 md:ml-0 md:gap-2">
          {user ? (
            <>
              <Link
                href="/notifications"
                aria-label="알림"
                className="flex h-11 items-center justify-center rounded-control px-2.5 text-ink hover:bg-field"
              >
                <BellIcon />
                <NotificationBadge />
              </Link>
              <Link
                href="/write"
                aria-label="글쓰기"
                className="flex h-11 items-center gap-1.5 rounded-control bg-brand-strong px-3 text-[15px] font-semibold text-white hover:bg-brand-ink-hover sm:px-4"
              >
                <PlusIcon />
                <span className="hidden sm:inline">글쓰기</span>
              </Link>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="flex h-11 items-center rounded-control px-3 text-[15px] font-semibold text-ink-3 hover:bg-field sm:px-4 sm:text-ink-3"
              >
                로그인
              </Link>
              <Link
                href="/signup"
                className="hidden h-11 items-center rounded-control bg-brand-strong px-4 text-[15px] font-semibold text-white hover:bg-brand-ink-hover sm:flex"
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
