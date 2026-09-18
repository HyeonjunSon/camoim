import { toShortUniversityName } from '../university';

describe('toShortUniversityName', () => {
  it('괄호 안 약칭을 뽑아낸다', () => {
    expect(toShortUniversityName('University of British Columbia (UBC)')).toBe('UBC');
    expect(toShortUniversityName('University of Toronto (UofT)')).toBe('UofT');
  });

  it('괄호가 없으면 원본을 그대로 돌려준다', () => {
    expect(toShortUniversityName('McGill University')).toBe('McGill University');
  });

  it('괄호 뒤 공백이 있어도 처리한다', () => {
    expect(toShortUniversityName('Simon Fraser University (SFU)  ')).toBe('SFU');
  });

  it('문자열 끝이 아닌 괄호는 무시한다', () => {
    expect(toShortUniversityName('University (X) of Somewhere')).toBe('University (X) of Somewhere');
  });

  it('빈 값이면 빈 문자열', () => {
    expect(toShortUniversityName('')).toBe('');
    expect(toShortUniversityName(null)).toBe('');
    expect(toShortUniversityName(undefined)).toBe('');
  });
});
