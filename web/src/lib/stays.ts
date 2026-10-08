// Mirrors STAY_TYPES in src/constants/stays.js.
export const STAY_TYPE_LABELS: Record<string, string> = {
  minbak: '민박',
  roomrent: '룸렌트',
  homestay: '홈스테이',
  hasuk: '하숙',
};

export const STAY_TYPE_COLORS: Record<string, string> = {
  minbak: '#1D4ED8',
  roomrent: '#047857',
  homestay: '#C2410C',
  hasuk: '#6D28D9',
};

export function stayPrice(price?: number, unit?: string): string {
  if (price === undefined || price === null) return '';
  return `$${price.toLocaleString('en-CA')}/${unit === 'night' ? '박' : '월'}`;
}
