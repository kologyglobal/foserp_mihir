import { toDateOnly } from '../shared/shift-time.util.js'

export interface NoticeComputation {
  /** Calendar days actually served between resignation and last working date (never negative). */
  served: number
  /** Days short of the contractual requirement (0 when served ≥ required). */
  shortfall: number
  /** Days served beyond the contractual requirement (0 when served ≤ required). */
  excess: number
}

/**
 * Notice period reconciliation for exit approval. Without a resignation date (e.g. an
 * employer-initiated TERMINATION) there is no "served" window to measure, so the full
 * contractual requirement is treated as shortfall — the employer decides recover/pay/none.
 */
export function computeNotice(
  requiredDays: number,
  resignationDate: Date | string | null | undefined,
  lastWorkingDate: Date | string,
): NoticeComputation {
  const required = Math.max(Math.round(requiredDays) || 0, 0)

  if (!resignationDate) {
    return { served: 0, shortfall: required, excess: 0 }
  }

  const lwd = toDateOnly(lastWorkingDate)
  const resDate = toDateOnly(resignationDate)
  const servedRaw = Math.round((lwd.getTime() - resDate.getTime()) / 86_400_000)
  const served = Math.max(servedRaw, 0)
  const shortfall = Math.max(required - served, 0)
  const excess = Math.max(served - required, 0)

  return { served, shortfall, excess }
}
