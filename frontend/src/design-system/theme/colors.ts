/**
 * Central color tokens — all values reference CSS custom properties.
 * No hardcoded hex in components; change palette in dynamics-tokens.css.
 */
export const colors = {
  primaryNavy: 'var(--dyn-navy)',
  primaryNavyText: 'var(--dyn-navy-text)',
  primary: 'var(--dyn-primary)',
  primaryHover: 'var(--dyn-primary-hover)',
  primarySoft: 'var(--dyn-primary-soft)',
  secondary: 'var(--dyn-info)',

  success: 'var(--dyn-success)',
  warning: 'var(--dyn-warning)',
  danger: 'var(--dyn-critical)',
  info: 'var(--dyn-info)',
  live: 'var(--dyn-live)',
  pending: 'var(--dyn-pending)',
  closed: 'var(--dyn-closed)',

  background: 'var(--dyn-bg-app)',
  surface: 'var(--dyn-bg-card)',
  surfaceAlt: 'var(--dyn-bg-sidebar)',
  sidebar: 'var(--dyn-bg-sidebar)',
  header: 'var(--dyn-navy)',

  border: 'var(--dyn-border)',
  borderStrong: 'var(--dyn-border-strong)',

  text: 'var(--dyn-text)',
  textSecondary: 'var(--dyn-text-secondary)',
  textMuted: 'var(--dyn-text-muted)',

  hover: 'var(--dyn-primary-soft)',
  selected: 'var(--dyn-primary-soft)',
  disabled: 'var(--dyn-border)',
} as const

export type DesignSystemColor = keyof typeof colors
