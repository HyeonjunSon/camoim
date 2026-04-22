// Pretendard 폰트 매핑
// fontWeight에 따라 적절한 폰트 파일을 반환

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

// fontWeight → fontFamily 변환
export function getFontFamily(weight = '400') {
  return FONT_MAP[String(weight)] || 'Pretendard-Regular';
}

// 기본 폰트 패밀리
export const FONT_FAMILY = 'Pretendard-Regular';
