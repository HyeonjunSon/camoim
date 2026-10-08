import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-[480px] flex-col items-center px-6 py-24 text-center">
      <p className="text-5xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-xl font-bold">페이지를 찾을 수 없어요</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        주소가 바뀌었거나, 글이 삭제되었을 수 있어요.
      </p>
      <Link
        href="/"
        className="mt-6 flex h-11 items-center rounded-control bg-brand-strong px-5 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
      >
        홈으로 가기
      </Link>
    </main>
  );
}
