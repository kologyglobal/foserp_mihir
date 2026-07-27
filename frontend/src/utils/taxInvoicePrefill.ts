import type { CrmCommercialLine, CrmCommercialSource } from '../types/crmCommercial'
import type { GstBreakdown } from '../types/invoice'
import { DEFAULT_GST_RATE } from '../types/invoice'
import { useCrmCommercialStore } from '../store/crmCommercialStore'
import { useMasterStore } from '../store/masterStore'
import { useMrpStore } from '../store/mrpStore'
import { useProformaInvoiceStore } from '../store/proformaInvoiceStore'
import { formatCustomerBillingAddress, resolveCustomerShippingAddress } from './customerUtils'
import { computeGst } from './gstEngine'
import { buildProformaLinesFromSalesOrder, computeProformaLineTotals, sumProformaTaxable } from './proformaInvoiceLines'
import type { ProformaInvoiceLine } from '../types/proformaInvoice'

export interface TaxInvoicePrefill {
  source: CrmCommercialSource
  customerId: string
  customerName: string
  customerGstin: string
  customerState: string
  customerAddress: string
  billingAddress: string | null
  shippingAddress: string | null
  paymentTerms: string
  deliveryTerms: string
  customerPoNumber: string | null
  remarks: string
  salesOrderId: string | null
  salesOrderNo: string | null
  quotationId: string | null
  quotationNo: string | null
  proformaInvoiceId: string | null
  proformaNo: string | null
  lines: CrmCommercialLine[]
  gst: GstBreakdown
}

export type TaxInvoicePrefillResult =
  | { ok: true; data: TaxInvoicePrefill }
  | { ok: false; error: string }

function lineKey(line: Pick<CrmCommercialLine, 'sourceLineId' | 'itemCode' | 'id'>): string {
  return line.sourceLineId || line.itemCode || line.id
}

function withTotals(line: Omit<CrmCommercialLine, 'taxableValue' | 'gstAmount' | 'lineTotal' | 'lineNo'>, lineNo: number): CrmCommercialLine {
  const totals = computeProformaLineTotals(line)
  return { ...line, lineNo, ...totals }
}

function buildGst(lines: CrmCommercialLine[], customerState: string): GstBreakdown {
  const taxable = sumProformaTaxable(lines as unknown as ProformaInvoiceLine[])
  const avgRate = lines.length
    ? lines.reduce((s, l) => s + l.taxPct, 0) / lines.length
    : DEFAULT_GST_RATE
  return computeGst(taxable, customerState, avgRate)
}

function applyLineQtys(lines: CrmCommercialLine[], lineQtys?: Record<string, number>): CrmCommercialLine[] {
  const next: CrmCommercialLine[] = []
  for (const line of lines) {
    const key = lineKey(line)
    const raw = lineQtys?.[key] ?? lineQtys?.[line.itemCode] ?? line.qty
    const capped = Math.min(Math.max(0, raw), line.maxQty ?? line.qty)
    if (capped <= 0) continue
    next.push(withTotals({ ...line, qty: capped }, next.length + 1))
  }
  return next
}

/** Remaining invoiceable lines from a confirmed sales order (partial invoices supported). */
export function resolveTaxInvoiceFromSalesOrder(
  salesOrderId: string,
  lineQtys?: Record<string, number>,
): TaxInvoicePrefillResult {
  const so = useMrpStore.getState().getSalesOrder(salesOrderId)
  if (!so) return { ok: false, error: 'Sales order not found.' }
  if (so.status === 'open') return { ok: false, error: 'Confirm the sales order before creating an invoice.' }
  if (so.status === 'closed') {
    return { ok: false, error: 'This sales order cannot be invoiced.' }
  }

  const master = useMasterStore.getState()
  const customer = master.getCustomer(so.customerId)
  if (!customer) return { ok: false, error: 'Customer not found for this sales order.' }

  const baseLines = buildProformaLinesFromSalesOrder(so, master.items)
  const existing = useCrmCommercialStore.getState().getInvoicesBySalesOrder(salesOrderId)
  const invoicedQtyBySource = new Map<string, number>()
  for (const inv of existing) {
    if (inv.status === 'cancelled') continue
    for (const line of inv.lines) {
      const key = line.sourceLineId ?? line.itemCode
      invoicedQtyBySource.set(key, (invoicedQtyBySource.get(key) ?? 0) + line.qty)
    }
  }

  const remaining: CrmCommercialLine[] = []
  for (const bl of baseLines) {
    const already = invoicedQtyBySource.get(bl.id) ?? invoicedQtyBySource.get(bl.itemCode) ?? 0
    const maxQty = Math.max(0, bl.qty - already)
    if (maxQty <= 0) continue
    remaining.push(
      withTotals(
        {
          id: bl.id,
          itemId: bl.itemId,
          itemCode: bl.itemCode,
          description: bl.description,
          hsnCode: bl.hsnCode,
          qty: maxQty,
          uom: bl.uom,
          unitPrice: bl.unitPrice,
          discountPct: bl.discountPct,
          taxPct: bl.taxPct,
          sourceLineId: bl.id,
          maxQty,
        },
        remaining.length + 1,
      ),
    )
  }

  const lines = applyLineQtys(remaining, lineQtys)
  if (!lines.length) {
    return { ok: false, error: 'No remaining quantity to invoice on this sales order.' }
  }

  const customerState = customer.state || 'Maharashtra'
  return {
    ok: true,
    data: {
      source: 'sales_order',
      customerId: so.customerId,
      customerName: customer.customerName,
      customerGstin: customer.gstin ?? '',
      customerState,
      customerAddress: formatCustomerBillingAddress(customer),
      billingAddress: so.billingAddress ?? formatCustomerBillingAddress(customer),
      shippingAddress: so.shippingAddress ?? resolveCustomerShippingAddress(customer),
      paymentTerms: so.paymentTerms ?? '30% advance, balance before dispatch',
      deliveryTerms: so.deliveryTerms ?? 'Ex-works Pune',
      customerPoNumber: so.customerPoNumber ?? null,
      remarks: so.internalRemarks ?? '',
      salesOrderId: so.id,
      salesOrderNo: so.salesOrderNo,
      quotationId: so.quotationId ?? null,
      quotationNo: so.quotationNo ?? null,
      proformaInvoiceId: null,
      proformaNo: null,
      lines,
      gst: buildGst(lines, customerState),
    },
  }
}

/** Issued proforma → tax invoice line prefill (qty editable for partial). */
export function resolveTaxInvoiceFromProforma(
  proformaId: string,
  lineQtys?: Record<string, number>,
): TaxInvoicePrefillResult {
  const pi = useProformaInvoiceStore.getState().getProforma(proformaId)
  if (!pi) return { ok: false, error: 'Proforma invoice not found.' }
  if (pi.status === 'cancelled') return { ok: false, error: 'Cannot invoice a cancelled proforma.' }
  if (pi.status === 'draft') return { ok: false, error: 'Issue the proforma before creating a tax invoice.' }

  const base: CrmCommercialLine[] = pi.lines.map((l) =>
    withTotals(
      {
        id: l.id,
        itemId: l.itemId,
        itemCode: l.itemCode,
        description: l.description,
        hsnCode: l.hsnCode,
        qty: l.qty,
        uom: l.uom,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        sourceLineId: l.id,
        maxQty: l.qty,
      },
      l.lineNo,
    ),
  )

  const lines = applyLineQtys(base, lineQtys)
  if (!lines.length) return { ok: false, error: 'Select at least one line quantity.' }

  return {
    ok: true,
    data: {
      source: 'proforma',
      customerId: pi.customerId,
      customerName: pi.customerName,
      customerGstin: pi.customerGstin,
      customerState: pi.customerState,
      customerAddress: pi.customerAddress,
      billingAddress: pi.billingAddress,
      shippingAddress: pi.shippingAddress,
      paymentTerms: pi.paymentTerms,
      deliveryTerms: pi.deliveryTerms,
      customerPoNumber: pi.customerPoNumber,
      remarks: pi.remarks,
      salesOrderId: pi.salesOrderId,
      salesOrderNo: pi.salesOrderNo,
      quotationId: pi.quotationId,
      quotationNo: pi.quotationNo,
      proformaInvoiceId: pi.id,
      proformaNo: pi.proformaNo,
      lines,
      gst: buildGst(lines, pi.customerState),
    },
  }
}

/** Map editable preview qtys into the createInvoiceFrom* lineQtys payload. */
export function taxInvoiceLineQtyMap(lines: CrmCommercialLine[]): Record<string, number> {
  const map: Record<string, number> = {}
  for (const line of lines) {
    map[lineKey(line)] = line.qty
    if (line.itemCode) map[line.itemCode] = line.qty
  }
  return map
}
