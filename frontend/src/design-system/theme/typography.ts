/** Typography scale — Segoe UI first, no per-component font overrides */
export const fontFamily = {
  sans: "'Segoe UI', Inter, Roboto, 'Helvetica Neue', Arial, sans-serif",
  mono: "'Cascadia Mono', Consolas, 'Courier New', monospace",
} as const

export const typography = {
  fontFamily: fontFamily.sans,
  fontFamilyMono: fontFamily.mono,

  pageTitle: 'var(--dyn-font-page)',
  workspaceTitle: 'var(--dyn-font-title)',
  sectionTitle: 'var(--dyn-font-section)',
  cardTitle: 'var(--dyn-font-sm)',
  tableHeader: 'var(--dyn-font-xs)',
  body: 'var(--dyn-font-body)',
  caption: 'var(--dyn-font-xs)',
  helper: 'var(--dyn-font-micro)',
  button: 'var(--dyn-font-sm)',
  kpiNumber: 'var(--dyn-font-kpi)',
} as const

export const fontWeight = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
} as const

export type TypographyRole =
  | 'pageTitle'
  | 'workspaceTitle'
  | 'sectionTitle'
  | 'cardTitle'
  | 'tableHeader'
  | 'body'
  | 'caption'
  | 'helper'
  | 'button'
  | 'kpiNumber'
