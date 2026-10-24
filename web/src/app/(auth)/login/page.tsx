import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LoginForm from './LoginForm';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '로그인',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/');
  const { m } = await getI18n();

  return (
    <>
      <h1 className="text-xl font-bold">{m.auth.loginTitle}</h1>
      <p className="mt-1.5 text-sm text-muted">{m.auth.loginIntro}</p>
      <LoginForm />
      <p className="mt-6 border-t border-line-faint pt-5 text-center text-sm text-muted">
        {m.auth.noAccount}{' '}
        <Link href="/signup" className="font-semibold text-brand-ink hover:text-brand-ink-hover">
          {m.header.signup}
        </Link>
      </p>
    </>
  );
}
