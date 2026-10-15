'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { VerifyRequest } from '@/lib/types';
import { timeAgo } from '@/lib/format';

const STUDENT_TYPES: Record<string, string> = {
  student: '재학생',
  alumni: '졸업생',
};

/**
 * Student-card review. The card image lives in Cloudinary's camoim/verify
 * folder, which is never served statically — the only way to it is this signed
 * URL from the API (CLAUDE.md: the old /uploads static mount was a public
 * exposure of exactly these files and must never come back).
 */
export default function VerifyQueue({
  requests,
  status,
}: {
  requests: VerifyRequest[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(requests);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: 'approve' | 'reject') {
    if (action === 'reject' && !(notes[id] ?? '').trim()) {
      setError('반려할 때는 사유를 적어주세요. 신청자에게 그대로 전달돼요.');
      return;
    }
    if (
      !window.confirm(
        action === 'approve'
          ? '학교 인증을 승인할까요? 학교 게시판과 커뮤니티가 열려요.'
          : '이 신청을 반려할까요?'
      )
    ) {
      return;
    }

    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/verify-requests/${id}/${action}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminNote: (notes[id] ?? '').trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || '처리하지 못했어요.');
      setItems((prev) => prev.filter((r) => r.id !== id));
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : '처리하지 못했어요.');
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return (
      <p className="rounded-card border border-line-soft bg-surface px-5 py-14 text-center text-sm text-muted">
        {status === 'pending' ? '검수할 신청이 없어요.' : '해당 상태의 신청이 없어요.'}
      </p>
    );
  }

  return (
    <>
      {error ? (
        <p role="alert" className="mb-3 rounded-[10px] bg-[#FEF2F2] px-3.5 py-3 text-sm text-[#B91C1C]">
          {error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-4">
        {items.map((request) => {
          const working = busy === request.id;
          return (
            <li
              key={request.id}
              className="flex flex-wrap gap-5 rounded-card border border-line-soft bg-surface px-5 py-5"
            >
              {/* Big, because reading a student card is the whole job and the
                  reason this screen belongs on a desktop. */}
              <a
                href={request.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="relative aspect-[3/2] w-full shrink-0 overflow-hidden rounded-xl bg-shade sm:w-[320px]"
              >
                {request.fileUrl ? (
                  <Image
                    src={request.fileUrl}
                    alt={`${request.nickname}님의 학생증`}
                    fill
                    sizes="320px"
                    className="object-contain"
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-sm text-muted">
                    이미지 없음
                  </span>
                )}
              </a>

              <div className="min-w-[260px] flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#DBEAFE] px-1.5 py-0.5 text-[11.5px] font-bold text-[#1D4ED8]">
                    {request.university}
                  </span>
                  {request.studentType ? (
                    <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                      {STUDENT_TYPES[request.studentType] ?? request.studentType}
                    </span>
                  ) : null}
                  <span className="ml-auto text-[12px] text-muted">
                    {timeAgo(request.createdAt)}
                  </span>
                </div>

                <dl className="mt-3 flex flex-col gap-1.5 text-[14px]">
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">닉네임</dt>
                    <dd>
                      <Link
                        href={`/users/${request.userId}`}
                        target="_blank"
                        prefetch={false}
                        className="font-semibold text-brand-ink hover:underline"
                      >
                        {request.nickname}
                      </Link>
                    </dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="w-16 shrink-0 text-muted">이메일</dt>
                    <dd className="min-w-0 break-all">{request.email}</dd>
                  </div>
                  {request.graduationYear ? (
                    <div className="flex gap-2">
                      <dt className="w-16 shrink-0 text-muted">졸업연도</dt>
                      <dd>{request.graduationYear}</dd>
                    </div>
                  ) : null}
                </dl>

                {status === 'pending' ? (
                  <>
                    <label htmlFor={`vnote-${request.id}`} className="sr-only-label">
                      메모 또는 반려 사유
                    </label>
                    <input
                      id={`vnote-${request.id}`}
                      value={notes[request.id] ?? ''}
                      onChange={(e) =>
                        setNotes((prev) => ({ ...prev, [request.id]: e.target.value }))
                      }
                      placeholder="반려 사유 (반려 시 필수) — 신청자에게 전달돼요"
                      className="mt-3.5 h-11 w-full rounded-control border border-line-strong px-3.5 text-[14px] outline-none focus:border-brand-strong"
                    />
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => act(request.id, 'approve')}
                        disabled={working}
                        className="flex h-11 items-center rounded-control bg-brand-strong px-4 text-[14.5px] font-semibold text-white hover:bg-brand-ink-hover disabled:opacity-55"
                      >
                        승인
                      </button>
                      <button
                        type="button"
                        onClick={() => act(request.id, 'reject')}
                        disabled={working}
                        className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                      >
                        반려
                      </button>
                    </div>
                  </>
                ) : request.adminNote ? (
                  <p className="mt-3.5 rounded-[10px] bg-field px-3.5 py-2.5 text-[13.5px] text-ink-3">
                    메모: {request.adminNote}
                  </p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
