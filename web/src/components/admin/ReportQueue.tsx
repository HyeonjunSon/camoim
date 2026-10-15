'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { AdminReport } from '@/lib/types';
import { timeAgo } from '@/lib/format';

const TARGET_LABELS: Record<string, string> = {
  post: '글',
  comment: '댓글',
  user: '회원',
  business: '업체',
  intro: '소개팅',
};

/** Where an admin can go to see the reported thing in context. */
function targetHref(report: AdminReport): string | null {
  if (report.targetType === 'post') return `/posts/${report.targetId}`;
  if (report.targetType === 'comment' && report.postId) return `/posts/${report.postId}#comments`;
  if (report.targetType === 'business') return `/businesses/${report.targetId}`;
  if (report.targetType === 'intro') return `/intro/${report.targetId}`;
  if (report.targetType === 'user' && report.targetAuthor.userId) {
    return `/users/${report.targetAuthor.userId}`;
  }
  return null;
}

export default function ReportQueue({
  reports,
  status,
}: {
  reports: AdminReport[];
  status: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState(reports);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: 'resolve' | 'dismiss') {
    const confirmText =
      action === 'resolve'
        ? '신고를 인정하고 대상 콘텐츠를 삭제할까요? 되돌릴 수 없어요.'
        : '이 신고를 기각할까요?';
    if (!window.confirm(confirmText)) return;

    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/bff/admin/reports/${id}/${action}`, {
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
        {status === 'pending' ? '처리할 신고가 없어요.' : '해당 상태의 신고가 없어요.'}
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

      <ul className="flex flex-col gap-3">
        {items.map((report) => {
          const href = targetHref(report);
          const working = busy === report.id;

          return (
            <li key={report.id} className="rounded-card border border-line-soft bg-surface px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-field px-1.5 py-0.5 text-[11.5px] font-bold text-ink-3">
                  {TARGET_LABELS[report.targetType] ?? report.targetType}
                </span>
                <span className="rounded-md bg-[#FEE2E2] px-1.5 py-0.5 text-[11.5px] font-bold text-[#B91C1C]">
                  {report.reason}
                </span>
                <span className="ml-auto text-[12px] text-muted">{timeAgo(report.createdAt)}</span>
              </div>

              <p className="mt-2.5 text-[15px] font-semibold break-words">{report.targetText}</p>

              <dl className="mt-2 flex flex-col gap-1 text-[13px] text-muted">
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0">작성자</dt>
                  <dd className="min-w-0">
                    {report.targetAuthor.nickname || '알 수 없음'}
                    {report.targetAuthor.isAnonymous ? ' (익명)' : ''}
                    {report.targetAuthor.isDeleted ? ' (탈퇴)' : ''}
                    {report.targetAuthor.email ? ` · ${report.targetAuthor.email}` : ''}
                  </dd>
                </div>
                <div className="flex gap-2">
                  <dt className="w-14 shrink-0">신고자</dt>
                  <dd className="min-w-0">
                    {report.reporterNickname ?? '알 수 없음'}
                    {report.reporterEmail ? ` · ${report.reporterEmail}` : ''}
                  </dd>
                </div>
              </dl>

              {report.detail ? (
                <p className="mt-2.5 rounded-[10px] bg-field px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap">
                  {report.detail}
                </p>
              ) : null}

              {status === 'pending' ? (
                <>
                  <label htmlFor={`note-${report.id}`} className="sr-only-label">
                    운영 메모
                  </label>
                  <input
                    id={`note-${report.id}`}
                    value={notes[report.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [report.id]: e.target.value }))}
                    placeholder="운영 메모 (선택) — 같은 대상의 신고 전체에 함께 기록돼요"
                    className="mt-3 h-11 w-full rounded-control border border-line-strong px-3.5 text-[14px] outline-none focus:border-brand-strong"
                  />

                  <div className="mt-2.5 flex flex-wrap gap-2">
                    {href ? (
                      <Link
                        href={href}
                        target="_blank"
                        prefetch={false}
                        className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-2 hover:bg-field"
                      >
                        원문 보기 ↗
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => act(report.id, 'resolve')}
                      disabled={working}
                      className="flex h-11 items-center rounded-control bg-danger px-4 text-[14.5px] font-semibold text-white disabled:opacity-55"
                    >
                      {/* resolve deletes a post or comment outright; an intro post
                          is soft-hidden instead, which the API decides. */}
                      인정 · 콘텐츠 삭제
                    </button>
                    <button
                      type="button"
                      onClick={() => act(report.id, 'dismiss')}
                      disabled={working}
                      className="flex h-11 items-center rounded-control border border-line-strong px-4 text-[14.5px] font-semibold text-ink-3 hover:bg-field disabled:opacity-55"
                    >
                      기각
                    </button>
                  </div>
                  <p className="mt-2 text-[12px] text-muted">
                    인정하면 같은 대상에 들어온 신고가 모두 함께 처리돼요.
                  </p>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
    </>
  );
}
