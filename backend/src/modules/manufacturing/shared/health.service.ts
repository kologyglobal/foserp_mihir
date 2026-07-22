import type { ProductionOrderHealth, ProductionOrderStatus, ProductionStageStatus } from '@prisma/client'
import { toDecimal } from './quantity.service.js'

export interface HealthInput {
  status: ProductionOrderStatus
  requiredCompletionDate: Date
  plannedStartDate: Date | null
  completionPercent: unknown
  stageStatuses: ProductionStageStatus[]
}

/**
 * ON_HOLD or any BLOCKED stage -> BLOCKED
 * requiredCompletionDate < today && not COMPLETED/CLOSED -> DELAYED
 * completionPercent tracking materially behind elapsed time window -> ATTENTION
 * else ON_TRACK
 */
export function computeOrderHealth(input: HealthInput, now: Date = new Date()): ProductionOrderHealth {
  if (input.status === 'ON_HOLD') return 'BLOCKED'
  if (input.stageStatuses.includes('BLOCKED')) return 'BLOCKED'

  const isClosedOut = input.status === 'COMPLETED' || input.status === 'CLOSED' || input.status === 'CANCELLED'
  if (!isClosedOut && input.requiredCompletionDate.getTime() < now.getTime()) {
    return 'DELAYED'
  }
  if (isClosedOut) return 'ON_TRACK'

  const startDate = input.plannedStartDate ?? input.requiredCompletionDate
  const totalWindowMs = input.requiredCompletionDate.getTime() - startDate.getTime()
  if (totalWindowMs > 0) {
    const elapsedMs = now.getTime() - startDate.getTime()
    const elapsedPercent = Math.max(0, Math.min(100, (elapsedMs / totalWindowMs) * 100))
    const completionPercent = toDecimal(input.completionPercent as never).toNumber()
    // More than 20 points behind the expected elapsed-time pace is a warning sign.
    if (elapsedPercent - completionPercent > 20) {
      return 'ATTENTION'
    }
  }

  return 'ON_TRACK'
}
