import { normalizeBirthYear, INTRO_JOBS } from '../intro';

// server/models/IntroPost.js's job enum must list every key used here, plus ''
const serverIntroPost = require('../../../server/models/IntroPost');

describe('normalizeBirthYear', () => {
  it('expands a 2-digit year below the current-century cutoff to 2000s', () => {
    expect(normalizeBirthYear('02')).toBe(2002);
  });

  it('expands a 2-digit year above the cutoff to 1900s', () => {
    expect(normalizeBirthYear('98')).toBe(1998);
  });

  it('passes a 4-digit year through unchanged', () => {
    expect(normalizeBirthYear('1995')).toBe(1995);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(normalizeBirthYear('')).toBeNull();
    expect(normalizeBirthYear(undefined)).toBeNull();
    expect(normalizeBirthYear('abcd')).toBeNull();
  });
});

describe('client/server intro job keys stay in sync', () => {
  it('every client job key is accepted by the server enum', () => {
    INTRO_JOBS.forEach(({ key }) => expect(serverIntroPost.INTRO_JOBS).toContain(key));
  });
});
