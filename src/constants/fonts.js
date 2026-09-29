// Pretendard font mapping
// Returns the right font file for a given fontWeight

const FONT_MAP = {
  '400': 'Pretendard-Regular',
  'normal': 'Pretendard-Regular',
  '500': 'Pretendard-Medium',
  '600': 'Pretendard-SemiBold',
  '700': 'Pretendard-Bold',
  '800': 'Pretendard-ExtraBold',
  '900': 'Pretendard-ExtraBold',
  'bold': 'Pretendard-Bold',
};

// fontWeight to fontFamily
export function getFontFamily(weight = '400') {
  return FONT_MAP[String(weight)] || 'Pretendard-Regular';
}

// Default font family
export const FONT_FAMILY = 'Pretendard-Regular';
