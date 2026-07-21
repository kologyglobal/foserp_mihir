import type { PurchaseReturn, PurchaseReturnLine } from '@prisma/client'
import { returnAllowedActions, returnQty } from './purchase-return.workflow.js'
const date = (value?: Date | null) => value?.toISOString().slice(0, 10) ?? null
const iso = (value?: Date | null) => value?.toISOString() ?? null
export function mapPurchaseReturn(row: PurchaseReturn & { lines: PurchaseReturnLine[] }) {
  return {
    ...row, documentNumber: row.returnNumber, documentDate: date(row.returnDate), returnDate: date(row.returnDate),
    submittedAt: iso(row.submittedAt), completedAt: iso(row.completedAt), cancelledAt: iso(row.cancelledAt),
    createdAt: iso(row.createdAt), updatedAt: iso(row.updatedAt), allowedActions: returnAllowedActions(row.status, row.deletedAt),
    totalAmount: row.lines.reduce((sum, line) => sum + returnQty(line.amount), 0),
    totalQuantity: row.lines.reduce((sum, line) => sum + returnQty(line.returnQuantity), 0),
    lines: row.lines.map((line) => ({ ...line, returnQuantity: returnQty(line.returnQuantity), rate: returnQty(line.rate), amount: returnQty(line.amount) })),
  }
}
