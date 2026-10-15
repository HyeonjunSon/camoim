'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { buttonClass, inputClass } from '@/components/Field';

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        // The API's own Korean message is shown as-is: it carries the real
        // reason (wrong password, lockout after 5 tries, suspension).
        setError(json.message || '로그인에 실패했어요.');
        return;
      }
      // Server components cached for the anonymous visitor must be dropped.
      router.refresh();
      router.replace('/');
    } catch {
      setError('서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
      {/*
        Not type="email". The account identifier is whatever is in User.email,
        which the server stores as a plain lower-cased string with no format
        check — the oldest accounts, the admin among them, log in with a bare id
        like `admin`. A type="email" input made the browser refuse to submit
        those, a constraint the API never had. The app uses
        keyboardType="email-address", which is only a keyboard hint.
      */}
      <Field id="email" label="이메일 또는 아이디">
        <input
          id="email"
          type="text"
          inputMode="email"
          required
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={inputClass}
        />
      </Field>

      <Field id="password" label="비밀번호">
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className={inputClass}
        />
      </Field>

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={busy || !email || !password} className={buttonClass}>
        {busy ? '로그인 중…' : '로그인'}
      </button>
    </form>
  );
}
