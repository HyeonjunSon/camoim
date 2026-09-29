// University name helpers

/**
 * Extracts the parenthesized abbreviation from a university name.
 * e.g. "University of British Columbia (UBC)" → "UBC"
 *      "McGill University" → "McGill University" (returned unchanged when there are no parentheses)
 */
export function toShortUniversityName(name) {
  if (!name) return '';
  const m = String(name).match(/\(([^)]+)\)\s*$/);
  return m ? m[1] : name;
}
