/**
 * FOS Mobile — premium SaaS design tokens
 * Inspiration: Linear, Notion, HubSpot — soft canvas, blue primary, soft elevation.
 * No gradients / glass. Motion stays 150–250ms.
 */

export const colors = {
  /** App canvas */
  background: '#F4F6F9',
  /** Cards / elevated surfaces */
  surface: '#FFFFFF',
  surfaceMuted: '#EEF1F6',
  surfaceElevated: '#FFFFFF',

  border: '#E6EAF0',
  borderStrong: '#D0D7E2',
  divider: '#EEF1F6',

  primary: '#2563EB',
  primaryPressed: '#1D4ED8',
  primaryMuted: '#EFF6FF',
  primarySoft: '#DBEAFE',

  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  textInverse: '#FFFFFF',

  danger: '#DC2626',
  dangerMuted: '#FEF2F2',
  success: '#059669',
  successMuted: '#ECFDF5',
  warning: '#D97706',
  warningMuted: '#FFFBEB',
  info: '#2563EB',
  infoMuted: '#EFF6FF',
  draft: '#64748B',
  draftMuted: '#F1F5F9',

  /** Soft accent tints for quick-action circles (no gradients) */
  purple: '#7C3AED',
  purpleMuted: '#F3E8FF',
  rose: '#E11D48',
  roseMuted: '#FFE4E6',
  orange: '#EA580C',
  orangeMuted: '#FFEDD5',

  chipDefaultBg: '#F1F5F9',
  chipDefaultText: '#334155',

  overlay: 'rgba(15, 23, 42, 0.42)',
  skeleton: '#E8ECF2',
  skeletonHighlight: '#F8FAFC',
  tabInactive: '#94A3B8',
  tabBar: '#FFFFFF',
  fab: '#2563EB',
  shadow: 'rgba(15, 23, 42, 0.07)',
  shadowStrong: 'rgba(15, 23, 42, 0.14)',
} as const

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 28,
  huge: 40,
  hero: 48,
} as const

export const radius = {
  sm: 10,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 999,
} as const

export const typography = {
  hero: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    color: colors.text,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 30,
    color: colors.text,
    letterSpacing: -0.35,
  },
  subtitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    lineHeight: 24,
    color: colors.text,
    letterSpacing: -0.2,
  },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22, color: colors.text },
  bodyStrong: {
    fontSize: 16,
    fontWeight: '600' as const,
    lineHeight: 22,
    color: colors.text,
    letterSpacing: -0.15,
  },
  caption: { fontSize: 13, fontWeight: '400' as const, lineHeight: 18, color: colors.textSecondary },
  captionStrong: {
    fontSize: 13,
    fontWeight: '600' as const,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
    lineHeight: 16,
    color: colors.textMuted,
    letterSpacing: 0.4,
  },
  button: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22, letterSpacing: -0.1 },
  metric: {
    fontSize: 26,
    fontWeight: '700' as const,
    lineHeight: 32,
    color: colors.text,
    letterSpacing: -0.5,
  },
  micro: {
    fontSize: 11,
    fontWeight: '600' as const,
    lineHeight: 14,
    color: colors.textMuted,
    letterSpacing: 0.35,
  },
} as const

/** Soft elevation — richer than hairline alone, never heavy Material. */
export const shadows = {
  card: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 14,
    elevation: 3,
  },
  soft: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  float: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 10,
  },
  tabBar: {
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 14,
  },
} as const

export const motion = {
  fast: 150,
  normal: 200,
  slow: 250,
  pressScale: 0.98,
  pressScaleSoft: 0.985,
} as const

export const layout = {
  maxContentWidth: 720,
  screenPadding: spacing.xl,
  hitSlop: { top: 12, bottom: 12, left: 12, right: 12 },
  minTouch: 44,
  minTouchComfort: 52,
  tabBarHeight: 64,
  listGap: spacing.md,
} as const

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
  layout,
  motion,
} as const

export type Theme = typeof theme
