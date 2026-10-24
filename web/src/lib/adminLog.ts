// Readable labels for AdminLog.action values. Keys mirror every logAdmin() call
// in server/routes/admin.js; an action missing here still shows its raw key.
export const ADMIN_ACTION_LABELS: Record<string, string> = {
  'board.create': '게시판 생성',
  'board.update': '게시판 수정',
  'board.delete': '게시판 삭제',
  'university.create': '학교 추가',
  'university.update': '학교 수정',
  'university.delete': '학교 삭제',
  'university.leader': '학생회장 지정',
  'user.warn': '회원 경고',
  'user.suspend': '회원 정지',
  'user.ban': '회원 영구정지',
  'user.unban': '정지 해제',
  'user.shadow': '섀도우밴',
  'user.role': '회원 역할 변경',
  'user.profile': '회원 정보 수정',
  'user.delete': '회원 삭제',
  'post.hide': '글 숨김',
  'post.unhide': '글 숨김 해제',
  'post.pin': '글 고정',
  'post.unpin': '글 고정 해제',
  'post.move': '글 이동',
  'post.delete': '글 삭제',
  'comment.delete': '댓글 삭제',
  'group.approve': '모임 승인',
  'group.reject': '모임 반려',
  'group.close': '모임 폐쇄',
  'business.update': '업체 수정',
  'business.delete': '업체 삭제',
  'push.broadcast': '푸시 발송',
};

export function adminActionLabel(action: string): string {
  if (ADMIN_ACTION_LABELS[action]) return ADMIN_ACTION_LABELS[action];
  if (action.startsWith('setting.')) return `설정 변경 (${action.slice(8)})`;
  return action;
}

/** Filter chips — the server matches `action` as a case-insensitive substring. */
export const ADMIN_ACTION_FILTERS = [
  { key: '', label: '전체' },
  { key: 'user.', label: '회원' },
  { key: 'post.', label: '글' },
  { key: 'board.', label: '게시판' },
  { key: 'university.', label: '학교' },
  { key: 'group.', label: '모임' },
  { key: 'business.', label: '업체' },
  { key: 'push.', label: '푸시' },
  { key: 'setting.', label: '설정' },
] as const;

/** One line of context from a log's meta, without dumping raw JSON on the page. */
export function summarizeMeta(meta: Record<string, unknown> | undefined): string {
  if (!meta) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'object') {
      const inner = Object.entries(v as Record<string, unknown>)
        .filter(([, x]) => x !== undefined && x !== null && x !== '')
        .map(([ik, x]) => `${ik}=${typeof x === 'object' ? JSON.stringify(x) : String(x)}`)
        .join(', ');
      if (inner) parts.push(`${k}: ${inner}`);
    } else {
      parts.push(`${k}: ${String(v)}`);
    }
  }
  const line = parts.join(' · ');
  return line.length > 160 ? `${line.slice(0, 157)}…` : line;
}
