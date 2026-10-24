import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignupForm from './SignupForm';
import { getCurrentUser } from '@/lib/user';
import { getI18n } from '@/lib/i18n/server';

export const metadata: Metadata = {
  title: '회원가입',
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/');
  const { m } = await getI18n();

  return (
    <>
      <h1 className="text-xl font-bold">{m.auth.signupTitle}</h1>
      <p className="mt-1.5 text-sm text-muted">{m.auth.signupIntro}</p>
      <SignupForm />
      <p className="mt-6 border-t border-line-faint pt-5 text-center text-sm text-muted">
        {m.auth.haveAccount}{' '}
        <Link href="/login" className="font-semibold text-brand-ink hover:text-brand-ink-hover">
          {m.header.login}
        </Link>
      </p>
    </>
  );
}
