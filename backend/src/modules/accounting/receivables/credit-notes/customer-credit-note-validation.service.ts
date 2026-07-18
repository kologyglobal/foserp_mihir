import { prisma } from '../../../../config/database.js'
import type { SalesInvoice, SalesInvoiceLine } from '@prisma/client'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import type { CreateCustomerCreditNoteInput, UpdateCustomerCreditNoteInput } from './customer-credit-note.schemas.js'
import { CustomerCreditNoteValidationError } from './customer-credit-note.errors.js'
import { calculateCustomerCreditNote, type CreditNoteCalculationSourceLine } from './calculation/customer-credit-note-calculation.service.js'
import { assertCreditAmountsAvailable } from './calculation/customer-credit-note-creditable.service.js'

type DraftInput = CreateCustomerCreditNoteInput | UpdateCustomerCreditNoteInput

function directSource(input: DraftInput, line: DraftInput['lines'][number]): CreditNoteCalculationSourceLine {
  const quantity = line.quantity ?? '0'
  const unitRate = line.unitRate ?? '0'
  const taxable = line.value ?? formatForPersistence(toDecimal(quantity).mul(unitRate))
  const gstRate = toDecimal(line.gstRate ?? '0')
  const cessRate = toDecimal(line.cessRate ?? '0')
  const totalGst = toDecimal(taxable).mul(gstRate).div(100)
  const intra = input.supplyType !== 'INTER_STATE'
  const cgst = intra ? totalGst.div(2) : toDecimal(0)
  const sgst = intra ? totalGst.div(2) : toDecimal(0)
  const igst = intra ? toDecimal(0) : totalGst
  const cess = toDecimal(taxable).mul(cessRate).div(100)
  return {
    itemId: line.itemId, itemCodeSnapshot: line.itemCode, itemNameSnapshot: line.itemName,
    hsnCodeSnapshot: line.hsnCode, uomSnapshot: line.uom, description: line.description,
    quantity, unitRate, grossAmount: taxable, discountAmount: '0', taxableAmount: taxable,
    cgstRate: intra ? gstRate.div(2).toString() : '0', cgstAmount: cgst.toString(),
    sgstRate: intra ? gstRate.div(2).toString() : '0', sgstAmount: sgst.toString(),
    igstRate: intra ? '0' : gstRate.toString(), igstAmount: igst.toString(),
    cessRate: cessRate.toString(), cessAmount: cess.toString(),
    lineTotal: toDecimal(taxable).add(totalGst).add(cess).toString(),
    revenueAccountId: line.revenueReversalAccountId, costCentreId: line.costCentreId,
  }
}

export async function calculateAndValidateCreditNote(
  tenantId: string,
  legalEntityId: string,
  input: DraftInput,
  excludeCreditNoteId?: string,
) {
  let source: (SalesInvoice & { lines: SalesInvoiceLine[] }) | null = null
  if (input.sourceType === 'SALES_INVOICE') {
    source = await prisma.salesInvoice.findFirst({
      where: { id: input.originalInvoiceId!, tenantId, legalEntityId },
      include: { lines: true },
    })
    if (!source || source.status !== 'POSTED') throw new CustomerCreditNoteValidationError('Original sales invoice must be posted')
    if (source.customerId !== input.customerId) throw new CustomerCreditNoteValidationError('Customer must match original invoice')
    if (source.currencyCode !== input.currencyCode) throw new CustomerCreditNoteValidationError('Currency must match original invoice')
  }

  const sourceLines = new Map((source?.lines ?? []).map((line) => [line.id, line]))
  const calc = calculateCustomerCreditNote({
    exchangeRate: input.exchangeRate,
    freightAmount: input.freightAmount,
    otherChargesAmount: input.otherChargesAmount,
    roundOffAmount: input.roundOffAmount,
    lines: input.lines.map((line) => {
      const invoiceLine = line.originalInvoiceLineId ? sourceLines.get(line.originalInvoiceLineId) : null
      if (input.sourceType === 'SALES_INVOICE' && !invoiceLine) {
        throw new CustomerCreditNoteValidationError(`Original invoice line ${line.originalInvoiceLineId ?? ''} not found`)
      }
      const sourceLine: CreditNoteCalculationSourceLine = invoiceLine ? {
        id: invoiceLine.id, itemId: invoiceLine.itemId, itemCodeSnapshot: invoiceLine.itemCodeSnapshot,
        itemNameSnapshot: invoiceLine.itemNameSnapshot, hsnCodeSnapshot: invoiceLine.hsnCodeSnapshot,
        uomSnapshot: invoiceLine.uomSnapshot, description: invoiceLine.description,
        quantity: invoiceLine.quantity.toString(), unitRate: invoiceLine.unitRate.toString(),
        grossAmount: invoiceLine.grossAmount.toString(), discountAmount: invoiceLine.discountAmount.toString(),
        taxableAmount: invoiceLine.taxableAmount.toString(), cgstRate: invoiceLine.cgstRate.toString(),
        cgstAmount: invoiceLine.cgstAmount.toString(), sgstRate: invoiceLine.sgstRate.toString(),
        sgstAmount: invoiceLine.sgstAmount.toString(), igstRate: invoiceLine.igstRate.toString(),
        igstAmount: invoiceLine.igstAmount.toString(), cessRate: invoiceLine.cessRate.toString(),
        cessAmount: invoiceLine.cessAmount.toString(), lineTotal: invoiceLine.lineTotal.toString(),
        revenueAccountId: invoiceLine.revenueAccountId, costCentreId: invoiceLine.costCentreId,
      } : directSource(input, line)
      return { ...line, source: sourceLine }
    }),
  })
  if (!calc.valid) throw new CustomerCreditNoteValidationError(calc.errors[0]?.message ?? 'Calculation failed', calc.errors)
  if (source) await assertCreditAmountsAvailable(tenantId, source.id, calc, excludeCreditNoteId)
  return { calculation: calc, source }
}
