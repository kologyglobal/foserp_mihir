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
  input: Pick<CreateSalesOrderInput, 'lines' | 'productId' | 'qty' | 'unitPrice' | 'discountPct'>,
): { lines: SalesOrderLineDto[]; summary: { qty: number; unitPrice: number; discountPct: number; basicAmount: number; gstAmount: number; grandTotal: number } } {
  const raw =
    input.lines?.length
      ? input.lines
      : [
          {
            productOrItem: 'Sales order line',
            description: '',
            productId: input.productId ?? null,
            qty: input.qty ?? 1,
            uom: 'NOS',
            unitPrice: input.unitPrice ?? 0,
            discountPct: input.discountPct ?? 0,
            taxPct: 18,
          },
        ]

  const lines: SalesOrderLineDto[] = raw.map((line, idx) => {
    const discountPct = line.discountPct ?? 0
    const taxPct = line.taxPct ?? 18
    const taxableValue = line.qty * line.unitPrice * (1 - discountPct / 100)
    const gstAmount = taxableValue * (taxPct / 100)
    const lineTotal = taxableValue + gstAmount
    return {
      id: line.id ?? crypto.randomUUID(),
      lineNo: line.lineNo ?? idx + 1,
      productOrItem: line.productOrItem,
      description: line.description ?? '',
      productId: line.productId ?? null,
      qty: line.qty,
      uom: line.uom ?? 'NOS',
      unitPrice: line.unitPrice,
      discountPct,
      taxPct,
      taxableValue: Math.round(taxableValue * 100) / 100,
      gstAmount: Math.round(gstAmount * 100) / 100,
      lineTotal: Math.round(lineTotal * 100) / 100,
      technicalScopeRef: line.technicalScopeRef ?? null,
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
  if (directOrder && !quotationBacked && !order.directSoReason?.trim()) {
    throw new ValidationError('Direct sales orders require a justification before confirmation')
  }
  if (!order.customerPoNumber?.trim()) {
    throw new ValidationError('Customer PO number is required before confirmation')
  }
  if (!order.paymentTerms?.trim() || !order.deliveryTerms?.trim()) {
    throw new ValidationError('Payment and delivery terms are required before confirmation')
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
