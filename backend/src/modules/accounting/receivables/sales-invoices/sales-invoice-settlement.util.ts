import { compare, toDecimal } from '../../shared/finance-decimal.js'
import type { SalesInvoiceSettlementStatus } from './sales-invoice.types.js'

export type { SalesInvoiceSettlementStatus }

/** Derive collection label from open-item amounts + due date (document status unchanged). */
export function deriveSettlementStatus(input: {
  documentStatus: string
  openAmount: string | number
  allocatedAmount: string | number
  dueDate?: Date | string | null
  asOf?: Date
}): SalesInvoiceSettlementStatus {
  if (input.documentStatus !== 'POSTED') return 'NOT_APPLICABLE'

  const open = toDecimal(input.openAmount)
  const allocated = toDecimal(input.allocatedAmount)

  if (compare(open, 0) <= 0) return 'PAID'
  if (compare(allocated, 0) > 0) {
    if (isPastDue(input.dueDate, input.asOf)) return 'OVERDUE'
    return 'PARTIALLY_PAID'
  }
  if (isPastDue(input.dueDate, input.asOf)) return 'OVERDUE'
  return 'UNPAID'
}

function isPastDue(dueDate?: Date | string | null, asOf: Date = new Date()): boolean {
  if (!dueDate) return false
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  if (Number.isNaN(due.getTime())) return false
  const today = new Date(asOf)
  today.setHours(0, 0, 0, 0)
  const dueDay = new Date(due)
  dueDay.setHours(0, 0, 0, 0)
  return dueDay.getTime() < today.getTime()
}
