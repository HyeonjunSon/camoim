// 대학 이름 관련 유틸

/**
 * 대학 이름에서 괄호 안의 약칭만 추출.
 * 예: "University of British Columbia (UBC)" → "UBC"
 *     "McGill University" → "McGill University" (괄호 없으면 원본 반환)
 */
export function toShortUniversityName(name) {
  if (!name) return '';
  const m = String(name).match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : name;
}
