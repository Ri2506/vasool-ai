// Brand color system — green is the only accent. See dev prompt rule #8.
export const Colors = {
  primary: '#059669',
  primaryLight: '#d1fae5',
  primaryDark: '#047857',

  bg: '#f8faf9',
  card: '#ffffff',
  border: '#e8eeeb',

  text: '#1a2e23',
  textSec: '#5f7a6a',
  textMuted: '#94a8a0',

  danger: '#dc2626',
  dangerLight: '#fef2f2',
  warn: '#d97706',
  warnLight: '#fffbeb',
  info: '#2563eb',
  infoLight: '#eff6ff',

  white: '#ffffff',
  black: '#000000',
} as const;

export type ColorKey = keyof typeof Colors;
