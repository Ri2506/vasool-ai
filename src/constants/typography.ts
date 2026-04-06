// Four sizes only. See dev prompt design system.
export const Typography = {
  // Big numbers: profit, today's target
  display: { fontSize: 24, fontWeight: '700' as const, lineHeight: 30 },
  // Titles, borrower names
  title: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  // Body, EMI amounts
  body: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  // Captions, timestamps, badges
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
};

// Minimum touch target — 48px for all tappable elements.
export const TouchTarget = { min: 48 };

export const Radius = {
  card: 12,
  button: 8,
  pill: 999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
