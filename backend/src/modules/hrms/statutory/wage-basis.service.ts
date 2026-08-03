import type { Prisma } from '@prisma/client'

export interface WageBasisRuleLike {
  wageBasisLines?: Array<{ componentCode: string; include: boolean; sequence?: number }> | null
}

export interface ResolveWageBasisOptions {
  /** Component codes summed when the rule has no configured wage-basis lines (e.g. PF default = BASIC). */
  defaultComponentCodes?: string[]
  /** Used when the rule has no lines AND no default component code resolved a positive amount (e.g. gross). */
  fallbackWage?: number
}

export interface WageBasisResult {
  wage: number
  included: Array<{ code: string; amount: number }>
}

export function decStatutory(value: Prisma.Decimal | number | string | null | undefined): number | null {
  if (value == null) return null
  return Number(value)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function roundStatutoryAmount(
  amount: number,
  mode: 'NONE' | 'NEAREST' | 'UP' | 'DOWN' = 'NEAREST',
): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0
  if (mode === 'UP') return Math.ceil(amount)
  if (mode === 'DOWN') return Math.floor(amount)
  if (mode === 'NEAREST') return Math.round(amount)
  return round2(amount)
}

function getEarning(earningsByCode: Record<string, number> | Map<string, number>, code: string): number {
  const key = code.trim().toUpperCase()
  if (earningsByCode instanceof Map) {
    return earningsByCode.get(key) ?? earningsByCode.get(code) ?? 0
  }
  return earningsByCode[key] ?? earningsByCode[code] ?? 0
}

/**
 * Sum the wage components configured on a statutory rule's wage-basis lines.
 * Falls back to `defaultComponentCodes` (e.g. BASIC for PF) and then to `fallbackWage`
 * (e.g. gross earnings for ESIC/PT) when the rule has no lines configured.
 */
export function resolveWageBasis(
  rule: WageBasisRuleLike | null | undefined,
  earningsByCode: Record<string, number> | Map<string, number>,
  options: ResolveWageBasisOptions = {},
): WageBasisResult {
  const configuredLines = (rule?.wageBasisLines ?? []).filter((l) => l.include)

  if (configuredLines.length > 0) {
    const sorted = [...configuredLines].sort((a, b) => (a.sequence ?? 10) - (b.sequence ?? 10))
    const included = sorted.map((l) => ({
      code: l.componentCode.trim().toUpperCase(),
      amount: round2(getEarning(earningsByCode, l.componentCode)),
    }))
    return { wage: round2(included.reduce((sum, l) => sum + l.amount, 0)), included }
  }

  const defaults = options.defaultComponentCodes ?? []
  if (defaults.length > 0) {
    const included = defaults.map((code) => ({ code: code.trim().toUpperCase(), amount: round2(getEarning(earningsByCode, code)) }))
    const wage = round2(included.reduce((sum, l) => sum + l.amount, 0))
    if (wage > 0) return { wage, included }
  }

  return { wage: round2(options.fallbackWage ?? 0), included: [] }
}
