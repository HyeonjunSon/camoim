'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { buttonClass, inputClass } from '@/components/Field';
import { CITIES, cityLabel } from '@/lib/boards';

const ROLES = [
  { value: 'student', label: '유학생' },
  { value: 'working_holiday', label: '워킹홀리데이' },
  { value: 'general', label: '일반' },
] as const;

type Step = 'email' | 'code' | 'profile';

export default function SignupForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');

  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [role, setRole] = useState<string>('general');
  const [city, setCity] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeAge, setAgreeAge] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const allAgreed = agreeTerms && agreePrivacy && agreeAge;

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || '요청에 실패했어요.');
    return json.data;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : '요청에 실패했어요.');
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await post('/api/auth/send-code', { email: email.trim() });
      setNotice(`${email.trim()} 으로 인증 코드를 보냈어요.`);
      setStep('code');
    });

  const checkCode = () =>
    run(async () => {
      await post('/api/auth/check-code', { email: email.trim(), code: code.trim() });
      setNotice(null);
      setStep('profile');
    });

  const register = () =>
    run(async () => {
      if (password !== confirm) throw new Error('비밀번호가 서로 달라요.');
      // The nickname is checked up front so a taken one does not burn the
      // one-shot email verification code the server holds in memory.
      const res = await fetch(
        `/api/bff/auth/check-nickname?nickname=${encodeURIComponent(nickname.trim())}`
      );
      const json = await res.json();
      if (json?.success && json.data?.available === false) {
        throw new Error('이미 사용 중인 닉네임이에요.');
      }

      await post('/api/auth/register', {
        email: email.trim(),
        password,
        nickname: nickname.trim(),
        role,
        city,
      });
      router.refresh();
      router.replace('/');
    });

  return (
    <div className="mt-6 flex flex-col gap-4">
      {step === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendCode();
          }}
          className="flex flex-col gap-4"
        >
          <Field id="email" label="이메일" hint="인증 코드를 받을 주소예요.">
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className={inputClass}
            />
          </Field>
          <button type="submit" disabled={busy || !email} className={buttonClass}>
            {busy ? '보내는 중…' : '인증 코드 받기'}
          </button>
        </form>
      ) : null}

      {step === 'code' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            checkCode();
          }}
          className="flex flex-col gap-4"
        >
          <Field id="code" label="인증 코드" hint="메일이 안 보이면 스팸함도 확인해보세요.">
            <input
              id="code"
              inputMode="numeric"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="6자리 숫자"
              className={inputClass}
            />
          </Field>
          <button type="submit" disabled={busy || !code} className={buttonClass}>
            {busy ? '확인 중…' : '인증 확인'}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setNotice(null);
            }}
            className="text-sm text-muted hover:text-ink-3"
          >
            이메일 주소 다시 입력하기
          </button>
        </form>
      ) : null}

      {step === 'profile' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            register();
          }}
          className="flex flex-col gap-4"
        >
          <p className="rounded-[10px] bg-[#E8FFF1] px-3.5 py-3 text-sm text-[#0F7A4F]">
            {email.trim()} 인증이 끝났어요.
          </p>

          <Field id="nickname" label="닉네임">
            <input
              id="nickname"
              required
              autoFocus
              maxLength={20}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id="password" label="비밀번호" hint="6자 이상이어야 해요.">
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id="confirm" label="비밀번호 확인">
            <input
              id="confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
          </Field>

          <Field id="role" label="어떤 신분인가요?">
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <Field id="city" label="지내는 도시" hint="나중에 마이페이지에서 바꿀 수 있어요.">
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            >
              <option value="">선택 안 함</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {cityLabel(c)}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="rounded-control border border-line-strong px-3.5 py-3">
            <legend className="px-1 text-[13.5px] font-semibold text-ink-3">약관 동의</legend>
            <label className="flex items-center gap-2.5 border-b border-line-faint py-2 text-sm font-semibold">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={allAgreed}
                onChange={(e) => {
                  const on = e.target.checked;
                  setAgreeTerms(on);
                  setAgreePrivacy(on);
                  setAgreeAge(on);
                }}
              />
              약관 전체 동의
            </label>
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span className="flex-1">(필수) 이용약관 동의</span>
              <Link href="/terms" target="_blank" className="text-[13px] text-brand-ink underline">
                보기
              </Link>
            </label>
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
              />
              <span className="flex-1">(필수) 개인정보처리방침 동의</span>
              <Link href="/privacy" target="_blank" className="text-[13px] text-brand-ink underline">
                보기
              </Link>
            </label>
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={agreeAge}
                onChange={(e) => setAgreeAge(e.target.checked)}
              />
              (필수) 만 14세 이상입니다
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={busy || !nickname || password.length < 6 || !allAgreed}
            className={buttonClass}
          >
            {busy ? '가입 중…' : '가입 완료'}
          </button>
        </form>
      ) : null}

      {notice ? (
        <p className="rounded-[10px] bg-brand-tint px-3.5 py-3 text-sm text-brand-ink-hover">
          {notice}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
