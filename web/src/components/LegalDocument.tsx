import Link from 'next/link';
import { getI18n } from '@/lib/i18n/server';

/**
 * Renders one of the plain-text legal documents from src/constants/legal.js.
 *
 * The documents exist in Korean only — the same text a user agreed to in the
 * app — so English mode translates the page around them and says plainly that
 * the Korean is what applies, rather than shipping an unreviewed translation.
 */
export default async function LegalDocument({
  kind,
  version,
  effectiveDate,
  body,
}: {
  kind: 'terms' | 'privacy';
  version: string;
  effectiveDate: string;
  body: string;
}) {
  const { lang, m: all } = await getI18n();
  const m = all.legal;
  return (
    <main className="mx-auto max-w-[760px] px-4 pb-20 pt-10 sm:px-6">
      <Link href="/" className="text-sm text-brand-ink hover:text-brand-ink-hover">
        {m.home}
      </Link>
      <h1 className="mt-4 text-2xl font-bold -tracking-[0.4px]">{m[kind]}</h1>
      <p className="mt-1.5 text-[13px] text-muted">
        {m.effective(version, effectiveDate)}
      </p>
      {lang === 'en' ? (
        <p className="mt-5 rounded-[10px] bg-brand-tint px-3.5 py-3 text-[13.5px] text-brand-ink-hover">
          {m.koreanOnly}
        </p>
      ) : null}
      <div className="mt-6 rounded-card border border-line-soft bg-surface px-5 py-6 sm:px-7">
        <pre lang="ko" className="font-sans text-[14.5px] leading-[1.8] whitespace-pre-wrap break-words text-ink-2">
          {body}
        </pre>
      </div>
    </main>
  );
}
