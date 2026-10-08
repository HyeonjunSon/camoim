import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LoginForm from './LoginForm';
import { getCurrentUser } from '@/lib/user';

export const metadata: Metadata = {
  title: '로그인',
  robots: { index: false, follow: false },
};

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/');

  return (
    <>
      <h1 className="text-xl font-bold">로그인</h1>
      <p className="mt-1.5 text-sm text-muted">앱에서 쓰던 계정으로 그대로 들어올 수 있어요.</p>
      <LoginForm />
      <p className="mt-6 border-t border-line-faint pt-5 text-center text-sm text-muted">
        아직 계정이 없나요?{' '}
        <Link href="/signup" className="font-semibold text-brand-ink hover:text-brand-ink-hover">
          회원가입
        </Link>
      </p>
    </>
  );
}
