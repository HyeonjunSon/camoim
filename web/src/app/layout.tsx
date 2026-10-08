import type { Metadata, Viewport } from 'next';
import './globals.css';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://camoimapp.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: '캐모임 — 캐나다 한인 커뮤니티',
    template: '%s · 캐모임',
  },
  description:
    '캐나다에 사는 한국인을 위한 커뮤니티. 중고거래, 룸랜트, 구인구직, 이민·유학 정보, 한인업체 지도를 한곳에서.',
  openGraph: {
    type: 'website',
    siteName: '캐모임',
    locale: 'ko_KR',
    url: SITE_URL,
  },
  // Default to indexable. Pages that must stay out of search results
  // (school boards, the anonymous board, the intro board) set robots themselves.
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#7F77DD',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Pretendard is the app's typeface. The dynamic-subset build only ships
            the Hangul blocks a page actually uses. */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
