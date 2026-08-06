import type { QualityInspectionStatus } from '@prisma/client'
import { QualityInspectionValidationError, QualityInspectionWorkflowError } from './quality-inspection.errors.js'

/** Statuses that block creating another QI for the same GRN. */
export const OPEN_QUALITY_INSPECTION_STATUSES = [
  'DRAFT',
  'PENDING',
  'IN_PROGRESS',
  'DEVIATION_PENDING',
] as const satisfies readonly QualityInspectionStatus[]

export const qiQty = (value: unknown) => Number(value ?? 0)
export const qiDate = (value?: string | null) => value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value) : null
export function assertQiEditable(status: QualityInspectionStatus) {
  // DEVIATION_PENDING covers hold / deviation review — checklist & qty edits stay allowed until complete.
  if (!['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(status)) {
    throw new QualityInspectionWorkflowError(`Quality inspection cannot be edited from ${status}.`)
  }
}
export function validateQiLines(lines: Array<{ inspectedQuantity: unknown; acceptedQuantity: unknown; rejectedQuantity: unknown; deviationQuantity: unknown }>) {
  if (!lines.length) throw new QualityInspectionValidationError('At least one inspection line is required.')
  lines.forEach((line, index) => {
    const inspected = qiQty(line.inspectedQuantity)
    const disposition = qiQty(line.acceptedQuantity) + qiQty(line.rejectedQuantity) + qiQty(line.deviationQuantity)
    if (inspected <= 0 || disposition > inspected + 1e-9) throw new QualityInspectionValidationError(`Invalid quantities on inspection line ${index + 1}.`)
  })
}
export function qiAllowedActions(status: QualityInspectionStatus, deletedAt?: Date | null) {
  const active = !deletedAt
  return {
    canEdit: active && ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(status),
    canComplete: active && ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(status),
    canCancel: active && ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(status),
  }
}
