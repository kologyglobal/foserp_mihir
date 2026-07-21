import { prisma } from '../../../../../config/database.js'
import { toDecimal } from '../../../shared/finance-decimal.js'
import { CustomerCreditNoteValidationError } from '../customer-credit-note.errors.js'
import type { CustomerCreditNoteCalculation } from '../customer-credit-note.types.js'

export async function assertCreditAmountsAvailable(
  tenantId: string,
  originalInvoiceId: string,
  calculation: CustomerCreditNoteCalculation,
  excludeCreditNoteId?: string,
): Promise<void> {
  const prior = await prisma.customerCreditNoteLine.groupBy({
    by: ['originalInvoiceLineId'],
    where: {
      tenantId,
      originalInvoiceLineId: { in: calculation.lines.map((line) => line.originalInvoiceLineId).filter(Boolean) as string[] },
      customerCreditNote: {
        originalInvoiceId,
        status: 'POSTED',
        ...(excludeCreditNoteId ? { id: { not: excludeCreditNoteId } } : {}),
      },
    },
    _sum: { quantity: true, taxableAmount: true, cgstAmount: true, sgstAmount: true, igstAmount: true, cessAmount: true },
  })
  const invoiceLines = await prisma.salesInvoiceLine.findMany({
    where: { tenantId, salesInvoiceId: originalInvoiceId },
  })
  const sourceById = new Map(invoiceLines.map((line) => [line.id, line]))
  const priorById = new Map(prior.map((row) => [row.originalInvoiceLineId, row]))

  for (const line of calculation.lines) {
    if (!line.originalInvoiceLineId) continue
    const source = sourceById.get(line.originalInvoiceLineId)
    if (!source) throw new CustomerCreditNoteValidationError('Original invoice line not found')
    const used = priorById.get(line.originalInvoiceLineId)?._sum
    const requestedTax = toDecimal(line.cgstAmount).add(line.sgstAmount).add(line.igstAmount).add(line.cessAmount)
    const usedTax = toDecimal(used?.cgstAmount ?? 0).add(used?.sgstAmount ?? 0).add(used?.igstAmount ?? 0).add(used?.cessAmount ?? 0)
    const sourceTax = source.cgstAmount.add(source.sgstAmount).add(source.igstAmount).add(source.cessAmount)
    if (toDecimal(line.taxableAmount).add(used?.taxableAmount ?? 0).gt(source.taxableAmount) || requestedTax.add(usedTax).gt(sourceTax)) {
      throw new CustomerCreditNoteValidationError('Credit amount exceeds the remaining creditable invoice amount', [
        { field: `lines.${line.lineNumber}`, message: 'Previously posted credit notes plus this note exceed the invoice line' },
      ])
    }
    if (line.adjustmentMode === 'QUANTITY' && toDecimal(line.quantity).add(used?.quantity ?? 0).gt(source.quantity)) {
      throw new CustomerCreditNoteValidationError('Credit quantity exceeds the remaining invoice quantity')
    }
  }
}
