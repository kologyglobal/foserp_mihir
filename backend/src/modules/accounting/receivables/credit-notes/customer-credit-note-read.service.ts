import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import type { ListCustomerCreditNotesQuery } from './customer-credit-note.schemas.js'
import type { CustomerCreditNoteWithLines } from './customer-credit-note.types.js'
import * as repo from './customer-credit-note.repository.js'
import { resolveCustomerCreditNoteAllowedActions } from './customer-credit-note-allowed-actions.js'

export async function serializeCustomerCreditNote(req: Request, note: CustomerCreditNoteWithLines) {
  const money = [
    'taxableAmount', 'cgstAmount', 'sgstAmount', 'igstAmount', 'cessAmount', 'totalTaxAmount',
    'discountAmount', 'freightAmount', 'otherChargesAmount', 'roundOffAmount', 'grandTotal',
    'baseTaxableAmount', 'baseCgstAmount', 'baseSgstAmount', 'baseIgstAmount', 'baseCessAmount',
    'baseTotalTaxAmount', 'baseDiscountAmount', 'baseFreightAmount', 'baseOtherChargesAmount',
    'baseRoundOffAmount', 'baseGrandTotal',
    'allocatableAmount', 'allocatedAmount', 'unallocatedAmount',
    'baseAllocatableAmount', 'baseAllocatedAmount', 'baseUnallocatedAmount',
  ] as const
  const amounts = Object.fromEntries(money.map((key) => [key, formatForPersistence(note[key])]))
  const creditOpenItem = note.creditOpenItemId ? await prisma.receivableOpenItem.findFirst({
    where: { id: note.creditOpenItemId, tenantId: note.tenantId },
    select: { id: true, side: true, originalAmount: true, openAmount: true, status: true },
  }) : null
  return {
    ...note,
    ...amounts,
    exchangeRate: note.exchangeRate.toString(),
    creditNoteDate: note.creditNoteDate.toISOString().slice(0, 10),
    postingDate: note.postingDate?.toISOString().slice(0, 10) ?? null,
    lines: note.lines.map((line) => ({
      ...line,
      quantity: line.quantity.toString(),
      unitRate: formatForPersistence(line.unitRate),
      revisedUnitRate: line.revisedUnitRate ? formatForPersistence(line.revisedUnitRate) : null,
      grossAmount: formatForPersistence(line.grossAmount),
      discountAmount: formatForPersistence(line.discountAmount),
      taxableAmount: formatForPersistence(line.taxableAmount),
      cgstRate: line.cgstRate.toString(), cgstAmount: formatForPersistence(line.cgstAmount),
      sgstRate: line.sgstRate.toString(), sgstAmount: formatForPersistence(line.sgstAmount),
      igstRate: line.igstRate.toString(), igstAmount: formatForPersistence(line.igstAmount),
      cessRate: line.cessRate.toString(), cessAmount: formatForPersistence(line.cessAmount),
      lineTotal: formatForPersistence(line.lineTotal),
    })),
    creditOpenItem: creditOpenItem ? {
      ...creditOpenItem,
      originalAmount: formatForPersistence(creditOpenItem.originalAmount),
      openAmount: formatForPersistence(creditOpenItem.openAmount),
    } : null,
    allowedActions: resolveCustomerCreditNoteAllowedActions(req, note.status, note.approvalRequired, {
      unallocatedAmount: note.unallocatedAmount.toString(),
    }),
  }
}

export async function getCustomerCreditNote(req: Request, tenantId: string, id: string) {
  return serializeCustomerCreditNote(req, await repo.findWithLinesOrThrow(tenantId, id))
}

export async function listCustomerCreditNotes(req: Request, tenantId: string, query: ListCustomerCreditNotesQuery) {
  const result = await repo.list(tenantId, query)
  return { ...result, items: await Promise.all(result.items.map((note) => serializeCustomerCreditNote(req, note))) }
}
