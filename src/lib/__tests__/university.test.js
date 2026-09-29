import { toShortUniversityName } from '../university';

describe('toShortUniversityName', () => {
  it('extracts the abbreviation inside the parentheses', () => {
    expect(toShortUniversityName('University of British Columbia (UBC)')).toBe('UBC');
    expect(toShortUniversityName('University of Toronto (UofT)')).toBe('UofT');
  });

  it('returns the original unchanged when there are no parentheses', () => {
    expect(toShortUniversityName('McGill University')).toBe('McGill University');
  });

  it('handles a space before the parentheses', () => {
    expect(toShortUniversityName('Simon Fraser University (SFU)  ')).toBe('SFU');
  });

  it('ignores parentheses that are not at the end of the string', () => {
    expect(toShortUniversityName('University (X) of Somewhere')).toBe('University (X) of Somewhere');
  });

  it('empty input gives an empty string', () => {
    expect(toShortUniversityName('')).toBe('');
    expect(toShortUniversityName(null)).toBe('');
    expect(toShortUniversityName(undefined)).toBe('');
  });
});
