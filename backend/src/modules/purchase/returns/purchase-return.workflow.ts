import type { PurchaseReturnStatus } from '@prisma/client'
import { PurchaseReturnValidationError, PurchaseReturnWorkflowError } from './purchase-return.errors.js'
export const returnQty = (value: unknown) => Number(value ?? 0)
export const returnMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export const returnDate = (value?: string | null) => value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value) : null
export function assertReturnStatus(status: PurchaseReturnStatus, allowed: PurchaseReturnStatus[], action: string) {
  if (!allowed.includes(status)) throw new PurchaseReturnWorkflowError(`Purchase return cannot be ${action} from ${status}.`)
}
export function validateReturnLines(lines: Array<{ returnQuantity: unknown }>) {
  if (!lines.length || lines.some((line) => returnQty(line.returnQuantity) <= 0)) throw new PurchaseReturnValidationError('Return requires at least one positive-quantity line.')
}
export function returnAllowedActions(status: PurchaseReturnStatus, deletedAt?: Date | null) {
  const active = !deletedAt
  return {
    canEdit: active && status === 'DRAFT', canSubmit: active && status === 'DRAFT',
    canComplete: active && ['SUBMITTED', 'APPROVED', 'SHIPPED'].includes(status),
    canCancel: active && ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(status),
  }
}
