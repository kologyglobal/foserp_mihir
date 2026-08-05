import type { CrmSalesOrder } from '@prisma/client'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import type { SalesOrderLineDto } from './sales-order.types.js'
import type { CreateSalesOrderInput, UpdateSalesOrderInput } from './sales-order.validation.js'

export function parseDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value)
}

export function buildLinesFromInput(
  input: Pick<CreateSalesOrderInput, 'lines' | 'itemId' | 'qty' | 'unitPrice' | 'discountPct'>,
): { lines: SalesOrderLineDto[]; summary: { qty: number; unitPrice: number; discountPct: number; basicAmount: number; gstAmount: number; grandTotal: number } } {
  type LineDraft = {
    id?: string
    lineNo?: number
    productOrItem: string
    description?: string
    itemId?: string | null
    itemCodeSnapshot?: string | null
    itemNameSnapshot?: string | null
    qty: number
    uom?: string
    unitPrice: number
    discountPct?: number
    taxPct?: number
    technicalScopeRef?: string | null
    hsnCode?: string | null
    hsnId?: string | null
    taxScheme?: string | null
    cgstRate?: number | null
    sgstRate?: number | null
    utgstRate?: number | null
    igstRate?: number | null
    cgstAmount?: number | null
    sgstAmount?: number | null
    utgstAmount?: number | null
    igstAmount?: number | null
  }

  const raw: LineDraft[] =
    input.lines?.length
      ? input.lines
      : [
          {
            productOrItem: 'Sales order line',
            description: '',
            itemId: input.itemId ?? null,
            qty: input.qty ?? 1,
            uom: 'NOS',
            unitPrice: input.unitPrice ?? 0,
            discountPct: input.discountPct ?? 0,
            taxPct: 0,
          },
        ]

  const r2 = (n: number) => Math.round(n * 100) / 100

  const lines: SalesOrderLineDto[] = raw.map((line, idx) => {
    if (!line.itemId?.trim()) {
      throw new ValidationError('Sales order line requires an Item')
    }
    const discountPct = line.discountPct ?? 0
    if (line.taxPct == null || Number.isNaN(Number(line.taxPct))) {
      throw new ValidationError(
        `Sales order line ${idx + 1}: taxPct is required — resolve from tax masters (no silent 18% default)`,
      )
    }
    const taxPct = Number(line.taxPct)
    const taxableValue = r2(line.qty * line.unitPrice * (1 - discountPct / 100))
    const scheme = (line.taxScheme ?? '').toLowerCase()

    let cgstRate = line.cgstRate ?? null
    let sgstRate = line.sgstRate ?? null
    let utgstRate = line.utgstRate ?? null
    let igstRate = line.igstRate ?? null
    let cgstAmount = line.cgstAmount ?? null
    let sgstAmount = line.sgstAmount ?? null
    let utgstAmount = line.utgstAmount ?? null
    let igstAmount = line.igstAmount ?? null
    let gstAmount: number

    if (scheme === 'igst') {
      const rate = igstRate != null && igstRate > 0 ? igstRate : taxPct
      igstRate = rate
      cgstRate = 0
      sgstRate = 0
      utgstRate = 0
      igstAmount = r2(taxableValue * (rate / 100))
      cgstAmount = 0
      sgstAmount = 0
      utgstAmount = 0
      gstAmount = igstAmount
    } else if (scheme === 'utgst_pair' || scheme === 'cgst_utgst') {
      const cr = cgstRate != null && cgstRate > 0 ? cgstRate : taxPct / 2
      const ur = utgstRate != null && utgstRate > 0 ? utgstRate : sgstRate != null && sgstRate > 0 ? sgstRate : taxPct / 2
      cgstRate = cr
      utgstRate = ur
      sgstRate = 0
      igstRate = 0
      cgstAmount = r2(taxableValue * (cr / 100))
      utgstAmount = r2(taxableValue * (ur / 100))
      sgstAmount = 0
      igstAmount = 0
      gstAmount = r2(cgstAmount + utgstAmount)
    } else if (
      (cgstRate != null && cgstRate > 0) ||
      (sgstRate != null && sgstRate > 0)
    ) {
      const cr = cgstRate ?? 0
      const sr = sgstRate ?? 0
      cgstRate = cr
      sgstRate = sr
      igstRate = 0
      utgstRate = 0
      cgstAmount = r2(taxableValue * (cr / 100))
      sgstAmount = r2(taxableValue * (sr / 100))
      igstAmount = 0
      utgstAmount = 0
      gstAmount = r2(cgstAmount + sgstAmount)
    } else {
      // Single blended taxPct without scheme rates (legacy)
      gstAmount = r2(taxableValue * (taxPct / 100))
      if (scheme === 'cgst_sgst' || !scheme) {
        cgstRate = taxPct / 2
        sgstRate = taxPct / 2
        cgstAmount = r2(taxableValue * ((taxPct / 2) / 100))
        sgstAmount = r2(taxableValue * ((taxPct / 2) / 100))
        igstRate = 0
        igstAmount = 0
      }
    }

    const lineTotal = r2(taxableValue + gstAmount)
    return {
      id: line.id ?? crypto.randomUUID(),
      lineNo: line.lineNo ?? idx + 1,
      productOrItem: line.productOrItem,
      description: line.description ?? '',
      itemId: line.itemId,
      itemCodeSnapshot: line.itemCodeSnapshot ?? null,
      itemNameSnapshot: line.itemNameSnapshot ?? null,
      qty: line.qty,
      uom: line.uom ?? 'NOS',
      unitPrice: line.unitPrice,
      discountPct,
      taxPct,
      taxableValue,
      gstAmount,
      lineTotal,
      technicalScopeRef: line.technicalScopeRef ?? null,
      hsnCode: line.hsnCode?.trim() || null,
      hsnId: line.hsnId ?? null,
      taxScheme: line.taxScheme ?? (scheme === 'igst' ? 'igst' : scheme || 'cgst_sgst'),
      cgstRate,
      sgstRate,
      utgstRate,
      igstRate,
      cgstAmount,
      sgstAmount,
      utgstAmount,
      igstAmount,
    }
  })

  if (!lines.length) throw new ValidationError('At least one sales order line is required')

  const basicAmount = Math.round(lines.reduce((s, l) => s + l.taxableValue, 0) * 100) / 100
  const gstAmount = Math.round(lines.reduce((s, l) => s + l.gstAmount, 0) * 100) / 100
  const grandTotal = Math.round(lines.reduce((s, l) => s + l.lineTotal, 0) * 100) / 100
  const qty = lines.reduce((s, l) => s + l.qty, 0)
  const primary = lines[0]!

  return {
    lines,
    summary: {
      qty,
      unitPrice: primary.unitPrice,
      discountPct: primary.discountPct,
      basicAmount,
      gstAmount,
      grandTotal,
    },
  }
}

export function assertDraftEditable(order: CrmSalesOrder): void {
  if (order.status !== 'open') {
    throw new InvalidStateError('Only draft sales orders (status open) can be edited or deleted')
  }
}

export function assertConfirmable(order: CrmSalesOrder): void {
  if (order.status !== 'open') {
    throw new InvalidStateError(`Cannot confirm sales order in status ${order.status}`)
  }
  const quotationBacked = Boolean(order.quotationId)
  const directOrder = order.source === 'direct' || Boolean(order.directSoReason?.trim())
  if (!quotationBacked && !directOrder) {
    throw new InvalidStateError('Sales order must be linked to a quotation or created as a direct SO')
  }
  if (!order.customerPoNumber?.trim()) {
    throw new ValidationError('Customer PO number is required before confirmation')
  }
  if (!order.paymentTerms?.trim() || !order.deliveryTerms?.trim()) {
    throw new ValidationError('Payment and delivery terms are required before confirmation')
  }
  if (!order.deliveryTime?.trim()) {
    throw new ValidationError('Delivery time / lead time is required before confirmation')
  }
  const grand = order.grandTotal != null ? Number(order.grandTotal) : 0
  if (!(grand > 0)) {
    throw new ValidationError('Grand total must be greater than zero before confirmation')
  }
}

export function assertCloseable(order: CrmSalesOrder): void {
  if (order.status === 'closed') {
    throw new InvalidStateError('Sales order is already closed')
  }
  if (order.status === 'open') {
    throw new InvalidStateError('Confirm the sales order before closing, or delete the draft')
  }
}

export function mergeUpdateLines(
  patch: UpdateSalesOrderInput,
): ReturnType<typeof buildLinesFromInput> | null {
  if (!patch.lines) return null
  return buildLinesFromInput({ lines: patch.lines })
}
