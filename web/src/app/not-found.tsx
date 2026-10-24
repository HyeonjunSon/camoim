import Link from 'next/link';
import { getI18n } from '@/lib/i18n/server';

export default async function NotFound() {
  const m = (await getI18n()).m.errors;
  return (
    <main className="mx-auto flex max-w-[480px] flex-col items-center px-6 py-24 text-center">
      <p className="text-5xl font-bold text-brand">404</p>
      <h1 className="mt-4 text-xl font-bold">{m.notFoundTitle}</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {m.notFoundBody}
      </p>
      <Link
        href="/"
        className="mt-6 flex h-11 items-center rounded-control bg-brand-strong px-5 text-[15px] font-semibold text-white hover:bg-brand-ink-hover"
      >
        {m.goHome}
      </Link>
    </main>
  );
}
