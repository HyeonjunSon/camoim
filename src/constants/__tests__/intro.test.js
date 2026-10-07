import { INTRO_JOBS, ageRangeToBirthYears, birthYearsToAgeRange, preferredAgeRangeLabel } from '../intro';

// server/constants/intro.js's job enum must list every key used here, plus ''
const serverIntro = require('../../../server/constants/intro');

const nowYear = new Date().getFullYear();
const t = (key) => ({ 'intro.ageSuffixShort': '세' }[key] ?? key);

describe('age range <-> birth year range conversion', () => {
  it('converts an age range to the inverted birth-year bounds', () => {
    // "26 to 34 years old" means the youngest (26) sets the latest birth year,
    // and the oldest (34) sets the earliest birth year
    expect(ageRangeToBirthYears(26, 34)).toEqual({
      preferredBirthYearMin: nowYear - 34,
      preferredBirthYearMax: nowYear - 26,
    });
  });

  it('leaves a bound null when that end has no preference', () => {
    expect(ageRangeToBirthYears('', 34)).toEqual({ preferredBirthYearMin: nowYear - 34, preferredBirthYearMax: null });
    expect(ageRangeToBirthYears(26, '')).toEqual({ preferredBirthYearMin: null, preferredBirthYearMax: nowYear - 26 });
  });

  it('round-trips back to the original age range', () => {
    const { preferredBirthYearMin, preferredBirthYearMax } = ageRangeToBirthYears(26, 34);
    expect(birthYearsToAgeRange(preferredBirthYearMin, preferredBirthYearMax)).toEqual({ ageMin: 26, ageMax: 34 });
  });
});

describe('preferredAgeRangeLabel', () => {
  it('formats a full range in ascending age order, never the raw birth years', () => {
    const { preferredBirthYearMin, preferredBirthYearMax } = ageRangeToBirthYears(26, 34);
    expect(preferredAgeRangeLabel(preferredBirthYearMin, preferredBirthYearMax, t)).toBe('26~34세');
  });

  it('formats an open-ended lower bound', () => {
    const { preferredBirthYearMax } = ageRangeToBirthYears(26, '');
    expect(preferredAgeRangeLabel(null, preferredBirthYearMax, t)).toBe('26세~');
  });

  it('formats an open-ended upper bound', () => {
    const { preferredBirthYearMin } = ageRangeToBirthYears('', 34);
    expect(preferredAgeRangeLabel(preferredBirthYearMin, null, t)).toBe('~34세');
  });

  it('returns empty when neither bound is set', () => {
    expect(preferredAgeRangeLabel(null, null, t)).toBe('');
  });

  it('sorts a legacy inverted pair instead of showing it backwards', () => {
    // Posts saved before the age-picker existed could have min/max picked independently,
    // in birth-year terms, producing e.g. preferredBirthYearMin: 2003, Max: 1995
    expect(preferredAgeRangeLabel(nowYear - 23, nowYear - 31, t)).toBe('23~31세');
  });
});

describe('client/server intro job keys stay in sync', () => {
  it('every client job key is accepted by the server enum', () => {
    INTRO_JOBS.forEach(({ key }) => expect(serverIntro.INTRO_JOBS).toContain(key));
  });
});
