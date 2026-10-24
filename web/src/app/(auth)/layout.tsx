import Link from 'next/link';
import LangToggle from '@/components/LangToggle';
import { getI18n } from '@/lib/i18n/server';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const { m } = await getI18n();
  return (
    <div className="relative flex min-h-dvh flex-col items-center px-4 py-10 sm:py-16">
      {/* No site header here, so the language switch sits in the corner on its own. */}
      <div className="absolute top-4 right-4">
        <LangToggle />
      </div>
      <Link href="/" className="flex items-center gap-2 text-ink">
        <span
          aria-hidden
          className="flex size-9 items-center justify-center rounded-[10px] bg-brand text-lg font-bold text-white"
        >
          C
        </span>
        <span className="text-[22px] font-bold -tracking-[0.4px]">{m.header.brand}</span>
      </Link>
      <main className="mt-7 w-full max-w-[420px] rounded-card border border-line-soft bg-surface px-6 py-7 sm:px-8">
        {children}
      </main>
    </div>
  );
}
