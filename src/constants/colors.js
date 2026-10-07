// Light and dark theme colour definitions

// Accent colour per board slug — tones are split so both light and dark stay readable
const lightBoardColors = {
  intro:          '#EC4899',
  free:           '#6366F1',
  anonymous:      '#8B5CF6',
  meetup:         '#FB923C',
  immigration:    '#0891B2',
  study:          '#3B82F6',
  workingholiday: '#D97706',
  market:         '#F97316',
  car:            '#94A3B8',
  giveaway:       '#10B981',
  jobs:           '#10B981',
  realestate:     '#F43F5E',
  roomrent:       '#EF4444',
  exchange:       '#CA8A04',
  university:     '#3B82F6',
  default:        '#9CA3AF',
};

const darkBoardColors = {
  intro:          '#F472B6',
  free:           '#818CF8',
  anonymous:      '#A78BFA',
  meetup:         '#FDBA74',
  immigration:    '#22D3EE',
  study:          '#60A5FA',
  workingholiday: '#FBBF24',
  market:         '#FB923C',
  car:            '#CBD5E1',
  giveaway:       '#34D399',
  jobs:           '#34D399',
  realestate:     '#FB7185',
  roomrent:       '#F87171',
  exchange:       '#FACC15',
  university:     '#60A5FA',
  default:        '#D1D5DB',
};

export const lightColors = {
  primary: '#7F77DD',
  primaryLight: '#A09BE8',
  background: '#F8F8F8',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  text: '#1A1A1A',
  textSecondary: '#888888',
  border: '#E5E5E5',
  danger: '#FF4444',
  dangerSoft: '#FEF2F2',
  success: '#2D9E5A',
  successSoft: '#E8FFF1',
  warning: '#F59E0B',
  warningSoft: '#FEF3C7',
  info: '#6366F1',
  infoSoft: '#EEF2FF',
  accent: '#8B5CF6',
  accentSoft: '#F5F3FF',
  card: '#FFFFFF',
  inputBg: '#F4F5F9',
  boardColors: lightBoardColors,
  // Intro board only — tints the gender word on a card so it reads at a glance
  genderMale: '#3B82F6',
  genderFemale: '#EC4899',
};

export const darkColors = {
  primary: '#9A92E8',
  primaryLight: '#BAB4F0',
  background: '#0F1014',
  surface: '#1A1B22',
  white: '#FFFFFF',
  text: '#F2F2F5',
  textSecondary: '#9AA0AC',
  border: '#353845',
  danger: '#FF6B6B',
  dangerSoft: '#3A1F22',
  success: '#4ADE80',
  successSoft: '#1A2E22',
  warning: '#FBBF24',
  warningSoft: '#3A2D14',
  info: '#818CF8',
  infoSoft: '#1F2233',
  accent: '#A78BFA',
  accentSoft: '#2A1F3D',
  card: '#1A1B22',
  inputBg: '#262830',
  boardColors: darkBoardColors,
  // Lighter tones so they stay readable on the dark surface
  genderMale: '#60A5FA',
  genderFemale: '#F472B6',
};

// A reactive colors object that tracks the active theme
// ThemeContext updates it through setActiveColors(), so even a
// module-scope StyleSheet picks up the new values
let _active = { ...lightColors };

export function setActiveColors(c) {
  Object.assign(_active, c);
}

// Proxy: always returns the current value from _active
export const colors = new Proxy({}, {
  get(_, key) { return _active[key]; },
  ownKeys() { return Object.keys(_active); },
  getOwnPropertyDescriptor(_, key) {
    if (key in _active) return { configurable: true, enumerable: true, value: _active[key] };
  },
});
