import { designTheme, fontFamily, typography as typeScale, layoutSpacing, shadows, radius } from '../design-system/theme'

/**
 * Legacy chart/JS token object — CSS runtime uses dynamics-tokens.css.
 * @deprecated Prefer designTheme from '@/design-system'
 */
export const erpTokens = {
  color: {
    primary: '#0078d4',
    primaryDark: '#001b3a',
    primarySoft: '#eff6fc',
    accentCyan: '#00a6a6',
    background: '#f5f6f8',
    surface: '#ffffff',
    surfaceGlass: 'rgb(255 255 255 / 0.92)',
    surfaceAlt: '#f3f4f6',
    border: '#e1e4e8',
    textPrimary: '#1f2933',
    textSecondary: '#5f6b7a',
    success: '#107c10',
    warning: '#f59e0b',
    danger: '#d13438',
    info: '#0078d4',
    live: '#00a6a6',
    released: '#4f46a8',
    qcHold: '#ca5010',
    blocked: '#d13438',
    navy: '#001b3a',
  },
  typography: {
    family: fontFamily.sans,
    familyMono: fontFamily.mono,
    pageTitle: typeScale.pageTitle,
    sectionTitle: typeScale.sectionTitle,
    cardTitle: typeScale.cardTitle,
    kpiValue: typeScale.kpiNumber,
    label: typeScale.helper,
    docNo: typeScale.caption,
    navItem: typeScale.body,
    body: typeScale.body,
    caption: typeScale.caption,
  },
  spacing: {
    pagePadding: layoutSpacing.pagePadding,
    sectionGap: layoutSpacing.sectionGap,
    cardPadding: layoutSpacing.cardPadding,
    gridGap: layoutSpacing.gridGap,
    formGap: layoutSpacing.formGap,
  },
  shadow: shadows,
  radius,
} as const

export { designTheme }
export type ErpTokenColor = keyof typeof erpTokens.color
