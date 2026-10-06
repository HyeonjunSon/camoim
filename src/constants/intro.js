// Intro board — shared option lists, matching server/models/IntroPost.js's enums.
// Values stored server-side are the keys below; labels are translated at render time.
export const INTRO_ACCENT = '#EC4899';

export const INTRO_GENDERS = [
  { key: 'female', labelKey: 'intro.genderFemale' },
  { key: 'male', labelKey: 'intro.genderMale' },
];

export const INTRO_JOBS = [
  { key: 'student', labelKey: 'intro.jobStudent' },
  { key: 'office', labelKey: 'intro.jobOffice' },
  { key: 'professional', labelKey: 'intro.jobProfessional' },
  { key: 'business', labelKey: 'intro.jobBusiness' },
  { key: 'workinghol', labelKey: 'intro.jobWorkinghol' },
];

export const INTRO_REGIONS = [
  { key: 'toronto', labelKey: 'intro.regionToronto' },
  { key: 'northyork', labelKey: 'intro.regionNorthYork' },
  { key: 'mississauga', labelKey: 'intro.regionMississauga' },
  { key: 'vancouver', labelKey: 'intro.regionVancouver' },
  { key: 'calgary', labelKey: 'intro.regionCalgary' },
  { key: 'other', labelKey: 'intro.regionOther' },
];

export const regionLabel = (key, t) => {
  const found = INTRO_REGIONS.find((r) => r.key === key);
  return found ? t(found.labelKey) : key;
};

export const jobLabel = (key, t) => {
  const found = INTRO_JOBS.find((j) => j.key === key);
  return found ? t(found.labelKey) : '';
};

// "98" → 1998, "02" → 2002 — the create form and filters both take a 2-digit shorthand
export function normalizeBirthYear(input) {
  const s = String(input || '').trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (s.length <= 2) {
    const currentYY = new Date().getFullYear() % 100;
    return n <= currentYY ? 2000 + n : 1900 + n;
  }
  return n;
}
