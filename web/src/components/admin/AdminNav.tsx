'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS: { href: string; label: string; exact?: boolean }[] = [
  // The dashboard matches exactly; the others own their subtree.
  { href: '/admin', label: '대시보드', exact: true },
  { href: '/admin/reports', label: '신고' },
  { href: '/admin/verify', label: '학교 인증' },
  { href: '/admin/groups', label: '모임' },
  { href: '/admin/businesses', label: '업체' },
  { href: '/admin/users', label: '회원' },
  { href: '/admin/boards', label: '게시판' },
  { href: '/admin/universities', label: '학교' },
  { href: '/admin/push', label: '푸시' },
  { href: '/admin/logs', label: '로그' },
  { href: '/admin/settings', label: '설정' },
];

export default function AdminNav() {
  const pathname = usePathname() ?? '';

  return (
    <nav
      aria-label="운영 메뉴"
      className="-mx-1 flex w-full gap-1 overflow-x-auto px-1 sm:mx-0 sm:w-auto sm:px-0"
    >
      {ITEMS.map((item) => {
        const on = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={on ? 'page' : undefined}
            className={`flex h-10 shrink-0 items-center rounded-[10px] px-3 text-[14.5px] font-semibold whitespace-nowrap ${
              on ? 'bg-ink text-white' : 'text-ink-3 hover:bg-field'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
