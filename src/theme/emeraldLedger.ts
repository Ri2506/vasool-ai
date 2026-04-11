// Emerald Ledger Design System — from stitch/emerald_ledger/DESIGN.md
// "The Pristine Guardian" — premium financial journal aesthetic.
//
// Rules:
//   1. NO 1px borders for sections — use background color shifts only
//   2. NO divider lines between list items — use 16px whitespace
//   3. NO pure black (#000000) — use on-surface (#131e19)
//   4. NO flat shadows — use ultra-diffused tonal shadows
//   5. Gradient buttons (135° emerald)
//   6. Glassmorphism for floating elements (sheets, modals, tab bar)
//   7. Plus Jakarta Sans for headlines, Inter for body

import { Platform, StyleSheet } from 'react-native';

// ─── Colors ─────────────────────────────────────────────
export const EL = {
  // Surfaces (layered depth — no borders needed)
  surface: '#f0fdf4',           // L0: main app background
  surfaceLow: '#eaf7ee',        // L1: section backgrounds (surface-container-low)
  surfaceMid: '#e4f1e8',        // surface-container
  surfaceHigh: '#deebe3',       // surface-container-high
  surfaceHighest: '#d9e6dd',    // L2: surface-container-highest
  surfaceCard: '#ffffff',        // surface-container-lowest — Cards on mint bg

  // Primary (emerald)
  primary: '#006948',            // Deep Emerald
  primaryContainer: '#00855d',
  primaryFixed: '#85f8c4',       // Light mint for pills/badges
  primaryFixedDim: '#68dba9',
  onPrimaryFixed: '#004d35',

  // Secondary
  secondary: '#3e6753',
  secondaryContainer: '#c0edd3',
  secondaryFixed: '#c0edd3',

  // Tertiary (alert/error)
  tertiary: '#9b3e3b',           // Rust/Red
  tertiaryContainer: '#ba5551',
  tertiaryFixed: '#ffdad6',

  // Text
  onSurface: '#131e19',          // Primary text (NOT pure black)
  onSurfaceSec: '#3d4a42',       // on-surface-variant
  onSurfaceMuted: '#6d7a72',     // outline color (muted text)
  outline: '#6d7a72',            // Outline
  outlineVariant: '#bccac0',     // Ghost borders (15% opacity use)

  // Status
  nadapu: '#006948',             // On Schedule — deep green
  nippu: '#9b3e3b',              // Overdue — tertiary red
  nippuContainer: '#ffdad6',     // Red background (tertiary-fixed)
  warn: '#d97706',               // Warning — amber
  warnContainer: '#fffbeb',
  info: '#2563eb',               // Info — blue
  infoContainer: '#eff6ff',
  completed: '#0d9488',          // Completed — teal
  completedContainer: '#f0fdfa',
  starAmber: '#f59e0b',          // Star ratings with soft glow

  // Danger
  danger: '#9b3e3b',             // Overdue actions (tertiary)
  dangerGlow: 'rgba(155, 62, 59, 0.15)',

  // Special
  white: '#ffffff',
  transparent: 'transparent',
} as const;

// ─── Typography ─────────────────────────────────────────
// Plus Jakarta Sans for headlines, Inter for body.
// On native without custom fonts loaded, falls back to system sans-serif.
export const Fonts = {
  headline: Platform.select({
    web: '"Plus Jakarta Sans", "Inter", system-ui, sans-serif',
    default: 'System',
  }),
  body: Platform.select({
    web: '"Inter", "Plus Jakarta Sans", system-ui, sans-serif',
    default: 'System',
  }),
};

export const Type = {
  displayLg: { fontFamily: Fonts.headline, fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.64, color: EL.onSurface },
  displayMd: { fontFamily: Fonts.headline, fontSize: 28, fontWeight: '700' as const, letterSpacing: -0.56, color: EL.onSurface },
  displaySm: { fontFamily: Fonts.headline, fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.48, color: EL.onSurface },
  titleLg: { fontFamily: Fonts.body, fontSize: 18, fontWeight: '600' as const, color: EL.onSurface },
  titleMd: { fontFamily: Fonts.body, fontSize: 16, fontWeight: '600' as const, color: EL.onSurface },
  bodyLg: { fontFamily: Fonts.body, fontSize: 16, fontWeight: '400' as const, color: EL.onSurface, lineHeight: 24 },
  bodyMd: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '400' as const, color: EL.onSurface, lineHeight: 20 },
  bodySm: { fontFamily: Fonts.body, fontSize: 13, fontWeight: '400' as const, color: EL.onSurfaceSec },
  labelLg: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '600' as const, color: EL.onSurface },
  labelMd: { fontFamily: Fonts.body, fontSize: 12, fontWeight: '600' as const, color: EL.onSurfaceSec },
  labelSm: { fontFamily: Fonts.body, fontSize: 11, fontWeight: '500' as const, color: EL.onSurfaceMuted },
  // Tamil: increase line-height to 1.6x for legibility
  tamilBody: { fontFamily: Fonts.body, fontSize: 14, fontWeight: '400' as const, lineHeight: 22.4 },
};

// ─── Spacing ────────────────────────────────────────────
export const Space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

// ─── Radii ──────────────────────────────────────────────
export const Radii = {
  sm: 8,
  md: 12,     // Buttons
  lg: 16,     // Cards
  xl: 20,
  xxl: 24,    // Bottom sheets
  pill: 999,
};

// ─── Touch targets ──────────────────────────────────────
export const Touch = {
  min: 48,
  comfortable: 56,
};

// ─── Shadows (ultra-diffused, tonal) ────────────────────
export const Shadows = {
  // Ambient shadow for cards — derived from on-primary-fixed
  card: {
    shadowColor: 'rgba(0, 33, 20, 0.06)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 2,
  },
  // Floating elements (tab bar, FAB)
  float: {
    shadowColor: 'rgba(0, 33, 20, 0.08)',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 1,
    shadowRadius: 40,
    elevation: 4,
  },
  // No shadow
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
};

// ─── Glassmorphism ──────────────────────────────────────
// For bottom sheets, modals, tab bar. On web: backdrop-filter works.
// On native: we approximate with semi-transparent bg + no blur (RN limitation).
export const Glass = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(240, 253, 244, 0.8)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any)
      : {}),
  },
  dark: {
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } as any)
      : {}),
  },
});

// ─── Common Styles ──────────────────────────────────────
export const Common = StyleSheet.create({
  // Screen base
  screen: {
    flex: 1,
    backgroundColor: EL.surface,
  },
  // Card — NO borders, tonal lift
  card: {
    backgroundColor: EL.surfaceCard,
    borderRadius: Radii.lg,
    padding: Space.xl,
    ...Shadows.card,
  },
  // Section on mint background
  section: {
    backgroundColor: EL.surfaceLow,
    borderRadius: Radii.lg,
    padding: Space.xl,
  },
  // List item — NO dividers, use spacing
  listItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: Space.lg,
    paddingHorizontal: Space.xl,
    minHeight: Touch.comfortable,
  },
  // Primary button placeholder — actual gradient needs LinearGradient
  btnPrimary: {
    backgroundColor: EL.primary,
    borderRadius: Radii.md,
    minHeight: Touch.min,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: Space.xxl,
  },
  btnPrimaryText: {
    ...Type.labelLg,
    color: EL.white,
  },
  // Pill badge
  pill: {
    paddingHorizontal: Space.md,
    paddingVertical: Space.xs,
    borderRadius: Radii.pill,
  },
  pillNadapu: {
    backgroundColor: EL.primaryFixed,
  },
  pillNippu: {
    backgroundColor: EL.nippuContainer,
  },
  // FAB
  fab: {
    position: 'absolute' as const,
    right: Space.xl,
    bottom: Space.xxl + 60,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: EL.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    ...Shadows.float,
  },
  // Tab bar (glassmorphism)
  tabBar: {
    backgroundColor: 'rgba(240, 253, 244, 0.9)',
    borderTopWidth: 0,
    height: 64,
    paddingBottom: 8,
    ...Shadows.float,
    ...(Platform.OS === 'web'
      ? ({ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' } as any)
      : {}),
  },
});
