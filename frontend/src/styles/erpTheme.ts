import { erpTokens } from './tokens'

/** Semantic theme map for components — prefer CSS vars in UI; use this for charts/JS */
export const erpTheme = {
  tokens: erpTokens,
  chart: {
    primary: erpTokens.color.primary,
    accent: erpTokens.color.accentCyan,
    success: erpTokens.color.success,
    warning: erpTokens.color.warning,
    danger: erpTokens.color.danger,
  },
  statusMap: {
    healthy: erpTokens.color.success,
    warning: erpTokens.color.warning,
    critical: erpTokens.color.danger,
    live: erpTokens.color.live,
    released: erpTokens.color.released,
    qcHold: erpTokens.color.qcHold,
    blocked: erpTokens.color.blocked,
  },
} as const

export function cssVar(name: string): string {
  return `var(--erp-${name})`
}
