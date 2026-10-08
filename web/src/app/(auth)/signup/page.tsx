import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import SignupForm from './SignupForm';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '회원가입',
  robots: { index: false, follow: false },
};

export default async function SignupPage() {
  if (await getCurrentUser()) redirect('/');

  return (
    <>
      <h1 className="text-xl font-bold">회원가입</h1>
      <p className="mt-1.5 text-sm text-muted">이메일 인증 후 프로필만 정하면 끝이에요.</p>
      <SignupForm />
      <p className="mt-6 border-t border-line-faint pt-5 text-center text-sm text-muted">
        이미 계정이 있나요?{' '}
        <Link href="/login" className="font-semibold text-brand-ink hover:text-brand-ink-hover">
          로그인
        </Link>
      </p>
    </>
  );
}
