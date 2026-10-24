'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Field, { buttonClass, inputClass } from '@/components/Field';
import { CITIES, cityLabel } from '@/lib/boards';
import { useLang, useMessages } from '@/lib/i18n/client';

const ROLES = [
  { value: 'student' },
  { value: 'working_holiday' },
  { value: 'general' },
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
  const all = useMessages();
  const m = all.auth;
  const lang = useLang();

  const allAgreed = agreeTerms && agreePrivacy && agreeAge;

  async function post(url: string, body: unknown) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) throw new Error(json.message || m.requestFailed);
    return json.data;
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : m.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      await post('/api/auth/send-code', { email: email.trim() });
      setNotice(m.codeSent(email.trim()));
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
      if (password !== confirm) throw new Error(m.passwordMismatch);
      // The nickname is checked up front so a taken one does not burn the
      // one-shot email verification code the server holds in memory.
      const res = await fetch(
        `/api/bff/auth/check-nickname?nickname=${encodeURIComponent(nickname.trim())}`
      );
      const json = await res.json();
      if (json?.success && json.data?.available === false) {
        throw new Error(m.nicknameTaken);
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
          <Field id="email" label={m.email} hint={m.emailHint}>
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
            {busy ? m.sending : m.getCode}
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
          <Field id="code" label={m.code} hint={m.codeHint}>
            <input
              id="code"
              inputMode="numeric"
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder={m.codePlaceholder}
              className={inputClass}
            />
          </Field>
          <button type="submit" disabled={busy || !code} className={buttonClass}>
            {busy ? m.checking : m.verify}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep('email');
              setNotice(null);
            }}
            className="text-sm text-muted hover:text-ink-3"
          >
            {m.reenterEmail}
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
            {m.verified(email.trim())}
          </p>

          <Field id="nickname" label={m.nickname}>
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

          <Field id="password" label={m.password} hint={m.passwordHint}>
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

          <Field id="confirm" label={m.passwordConfirm}>
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

          <Field id="role" label={m.role}>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className={inputClass}
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {m.roles[r.value]}
                </option>
              ))}
            </select>
          </Field>

          <Field id="city" label={m.city} hint={m.cityHint}>
            <select
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className={inputClass}
            >
              <option value="">{all.common.none}</option>
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {cityLabel(c, lang)}
                </option>
              ))}
            </select>
          </Field>

          <fieldset className="rounded-control border border-line-strong px-3.5 py-3">
            <legend className="px-1 text-[13.5px] font-semibold text-ink-3">{m.terms}</legend>
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
              {m.agreeAll}
            </label>
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
              />
              <span className="flex-1">{m.agreeTerms}</span>
              <Link href="/terms" target="_blank" className="text-[13px] text-brand-ink underline">
                {m.view}
              </Link>
            </label>
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={agreePrivacy}
                onChange={(e) => setAgreePrivacy(e.target.checked)}
              />
              <span className="flex-1">{m.agreePrivacy}</span>
              <Link href="/privacy" target="_blank" className="text-[13px] text-brand-ink underline">
                {m.view}
              </Link>
            </label>
            <label className="flex items-center gap-2.5 py-2 text-sm">
              <input
                type="checkbox"
                className="size-4.5 accent-brand-strong"
                checked={agreeAge}
                onChange={(e) => setAgreeAge(e.target.checked)}
              />
              {m.agreeAge}
            </label>
          </fieldset>

          <button
            type="submit"
            disabled={busy || !nickname || password.length < 6 || !allAgreed}
            className={buttonClass}
          >
            {busy ? m.signingUp : m.finish}
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
