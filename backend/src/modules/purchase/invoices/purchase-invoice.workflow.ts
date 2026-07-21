import type { PurchaseInvoiceStatus } from '@prisma/client'
import { PurchaseInvoiceValidationError, PurchaseInvoiceWorkflowError } from './purchase-invoice.errors.js'

export const invoiceQty = (value: unknown) => Number(value ?? 0)
export const invoiceMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
export const parseInvoiceDate = (value?: string | null) =>
  value ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value) : null

export function assertInvoiceStatus(
  status: PurchaseInvoiceStatus,
  allowed: PurchaseInvoiceStatus[],
  action: string,
) {
  if (!allowed.includes(status)) {
    throw new PurchaseInvoiceWorkflowError(`Purchase invoice cannot be ${action} from ${status}.`)
  }
}

export function assertInvoiceLines(lines: Array<{ quantity: unknown }>) {
  if (!lines.length || lines.some((line) => invoiceQty(line.quantity) <= 0)) {
    throw new PurchaseInvoiceValidationError('Invoice requires at least one line with quantity greater than zero.')
  }
}

export function invoiceAllowedActions(status: PurchaseInvoiceStatus, deletedAt?: Date | null) {
  const active = !deletedAt
  return {
    canEdit: active && status === 'DRAFT',
    canSubmit: active && ['DRAFT', 'REJECTED'].includes(status),
    canApprove: active && status === 'PENDING_APPROVAL',
    canReject: active && status === 'PENDING_APPROVAL',
    canPost: active && ['APPROVED', 'MATCHED', 'PARTIALLY_MATCHED'].includes(status),
    canCancel: active && !['POSTED', 'CANCELLED', 'CLOSED'].includes(status),
  }
}
