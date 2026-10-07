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

export const genderLabel = (key, t) =>
  t(key === 'female' ? 'intro.genderFemale' : 'intro.genderMale');

// Only the gender word itself is tinted — the card keeps the board's own accent
export const genderColor = (key, colors) =>
  key === 'female' ? colors.genderFemale : colors.genderMale;

// Birth-year wheel: 19 (the minimum age) up to 80 years old, most recent first
export const BIRTH_YEARS = (() => {
  const nowYear = new Date().getFullYear();
  const years = [];
  for (let y = nowYear - 19; y >= nowYear - 80; y--) years.push(y);
  return years;
})();

// Preferred-partner-age wheel — the UI picks an age (19-80); the server still stores it as a
// birth-year range (see ageRangeToBirthYears/birthYearsToAgeRange below), since a birth year
// stays correct for the life of the post while a stored "age" would quietly go stale.
export const AGES = (() => {
  const arr = [];
  for (let a = 19; a <= 80; a++) arr.push(a);
  return arr;
})();

// Height wheel, in cm
export const HEIGHT_CM = (() => {
  const arr = [];
  for (let h = 140; h <= 200; h++) arr.push(h);
  return arr;
})();

export function birthYearToAge(birthYear) {
  if (!birthYear) return null;
  return new Date().getFullYear() - birthYear;
}

export function ageLabel(birthYear, t) {
  const age = birthYearToAge(birthYear);
  return age == null ? '' : t('intro.ageWithSuffix').replace('{n}', age);
}

// ageMin = youngest acceptable, ageMax = oldest acceptable → birth-year bounds (inverted: an
// older age means an earlier birth year)
export function ageRangeToBirthYears(ageMin, ageMax) {
  const nowYear = new Date().getFullYear();
  return {
    preferredBirthYearMin: ageMax ? nowYear - ageMax : null,
    preferredBirthYearMax: ageMin ? nowYear - ageMin : null,
  };
}

export function birthYearsToAgeRange(birthYearMin, birthYearMax) {
  const nowYear = new Date().getFullYear();
  return {
    ageMin: birthYearMax ? nowYear - birthYearMax : null,
    ageMax: birthYearMin ? nowYear - birthYearMin : null,
  };
}

// "26~34세" / "26세~" / "~34세" — never shows the raw (and confusingly ordered) birth years.
// Sorted defensively: posts saved before the age-picker UI existed may have an inverted
// birth-year pair (the old UI let min/max be picked independently, in either order).
export function preferredAgeRangeLabel(birthYearMin, birthYearMax, t) {
  let { ageMin, ageMax } = birthYearsToAgeRange(birthYearMin, birthYearMax);
  if (ageMin == null && ageMax == null) return '';
  if (ageMin != null && ageMax != null && ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  const suffix = t('intro.ageSuffixShort');
  if (ageMin != null && ageMax != null) return `${ageMin}~${ageMax}${suffix}`;
  if (ageMin != null) return `${ageMin}${suffix}~`;
  return `~${ageMax}${suffix}`;
}
