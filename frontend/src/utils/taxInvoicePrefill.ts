import { isApiMode } from '../config/apiConfig'
import type { CrmCommercialLine, CrmCommercialSource, CrmTaxInvoice } from '../types/crmCommercial'
import type { GstBreakdown } from '../types/invoice'
import { DEFAULT_GST_RATE } from '../types/invoice'
import { useCrmCommercialStore } from '../store/crmCommercialStore'
import { useMasterStore } from '../store/masterStore'
import { useMrpStore } from '../store/mrpStore'
import { useProformaInvoiceStore } from '../store/proformaInvoiceStore'
import { formatCustomerBillingAddress, resolveCustomerShippingAddress } from './customerUtils'
import { computeGst } from './gstEngine'
import {
  placeOfSupplyFromProforma,
  placeOfSupplyFromSalesOrder,
  resolveSellerStateForBreakdown,
  taxHeaderPayloadFromSalesOrder,
} from './commercialSupplySnapshot'
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
  placeOfSupply?: string | null
  placeOfSupplyStateCode?: string | null
  supplierStateCode?: string | null
  supplyType?: string | null
  gstScheme?: string | null
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

function buildGst(
  lines: CrmCommercialLine[],
  placeOfSupply: string,
  sellerStateCode?: string | null,
): GstBreakdown {
  const taxable = sumProformaTaxable(lines as unknown as ProformaInvoiceLine[])
  const avgRate = lines.length
    ? lines.reduce((s, l) => s + l.taxPct, 0) / lines.length
    : DEFAULT_GST_RATE
  return computeGst(
    taxable,
    placeOfSupply,
    avgRate,
    resolveSellerStateForBreakdown(sellerStateCode) ?? undefined,
  )
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
          taxScheme: bl.taxScheme ?? null,
          cgstRate: bl.cgstRate ?? null,
          sgstRate: bl.sgstRate ?? null,
          utgstRate: bl.utgstRate ?? null,
          igstRate: bl.igstRate ?? null,
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
  const placeOfSupply = placeOfSupplyFromSalesOrder(so, customerState)
  const taxHeader = taxHeaderPayloadFromSalesOrder(so)
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
      paymentTerms: so.paymentTerms ?? '',
      deliveryTerms: so.deliveryTerms ?? '',
      customerPoNumber: so.customerPoNumber ?? null,
      remarks: (so.internalRemarks ?? so.remarks ?? '').trim(),
      salesOrderId: so.id,
      salesOrderNo: so.salesOrderNo,
      quotationId: so.quotationId ?? null,
      quotationNo: so.quotationNo ?? null,
      proformaInvoiceId: null,
      proformaNo: null,
      ...taxHeader,
      placeOfSupply,
      lines,
      gst: buildGst(lines, placeOfSupply, so.supplierStateCode),
    },
  }
}

/**
 * Prefill the create/edit form from an existing draft tax invoice.
 * For SO-sourced drafts, maxQty is recomputed so this invoice's own qty remains editable.
 */
export function prefillFromExistingTaxInvoice(invoice: CrmTaxInvoice): TaxInvoicePrefillResult {
  if (invoice.status !== 'draft') {
    return { ok: false, error: 'Only draft invoices can be edited.' }
  }

  let lines = invoice.lines.map((line, idx) => withTotals({ ...line }, idx + 1))

  if (invoice.source === 'sales_order' && invoice.salesOrderId) {
    const so = useMrpStore.getState().getSalesOrder(invoice.salesOrderId)
    if (so) {
      const master = useMasterStore.getState()
      const baseLines = buildProformaLinesFromSalesOrder(so, master.items)
      const others = useCrmCommercialStore
        .getState()
        .getInvoicesBySalesOrder(invoice.salesOrderId)
        .filter((inv) => inv.id !== invoice.id && inv.status !== 'cancelled')
      const invoicedQtyBySource = new Map<string, number>()
      for (const inv of others) {
        for (const line of inv.lines) {
          const key = line.sourceLineId ?? line.itemCode
          invoicedQtyBySource.set(key, (invoicedQtyBySource.get(key) ?? 0) + line.qty)
        }
      }
      lines = lines.map((line, idx) => {
        const sourceKey = line.sourceLineId ?? line.itemCode
        const base = baseLines.find((b) => b.id === line.sourceLineId || b.itemCode === line.itemCode)
        const already = invoicedQtyBySource.get(sourceKey) ?? invoicedQtyBySource.get(line.itemCode) ?? 0
        const maxQty = base ? Math.max(line.qty, base.qty - already) : (line.maxQty ?? line.qty)
        return withTotals({ ...line, maxQty }, idx + 1)
      })
    }
  }

  return {
    ok: true,
    data: {
      source: invoice.source,
      customerId: invoice.customerId,
      customerName: invoice.customerName,
      customerGstin: invoice.customerGstin,
      customerState: invoice.customerState,
      customerAddress: invoice.customerAddress,
      billingAddress: invoice.billingAddress,
      shippingAddress: invoice.shippingAddress,
      paymentTerms: invoice.paymentTerms,
      deliveryTerms: invoice.deliveryTerms,
      customerPoNumber: invoice.customerPoNumber,
      remarks: invoice.remarks,
      salesOrderId: invoice.salesOrderId,
      salesOrderNo: invoice.salesOrderNo,
      quotationId: invoice.quotationId,
      quotationNo: invoice.quotationNo,
      proformaInvoiceId: invoice.proformaInvoiceId,
      proformaNo: invoice.proformaNo,
      placeOfSupply: invoice.placeOfSupply,
      lines,
      gst:
        invoice.gst.taxableAmount != null
          ? buildGst(lines, invoice.placeOfSupply || invoice.customerState)
          : invoice.gst,
    },
  }
}

/** Blank editable line for direct (customer) tax invoices — no SO/proforma cap. */
export function blankTaxInvoiceLine(lineNo = 1): CrmCommercialLine {
  return withTotals(
    {
      id: typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `cil-${Date.now()}-${lineNo}`,
      itemId: '',
      itemCode: '',
      description: '',
      hsnCode: '',
      qty: 1,
      uom: 'Nos',
      unitPrice: 0,
      discountPct: 0,
      taxPct: 0,
      taxScheme: null,
      sourceLineId: null,
      maxQty: null,
    },
    lineNo,
  )
}

/** Direct tax invoice from customer master — no sales order or proforma required. */
export function resolveTaxInvoiceFromCustomer(customerId: string): TaxInvoicePrefillResult {
  const customer = useMasterStore.getState().getCustomer(customerId)
  if (!customer) return { ok: false, error: 'Customer not found.' }
  if (customer.isActive === false) return { ok: false, error: 'Customer is inactive.' }

  const customerState = customer.state || 'Maharashtra'
  const lines = [blankTaxInvoiceLine(1)]
  return {
    ok: true,
    data: {
      source: 'direct',
      customerId: customer.id,
      customerName: customer.customerName,
      customerGstin: customer.gstin ?? '',
      customerState,
      customerAddress: formatCustomerBillingAddress(customer),
      billingAddress: formatCustomerBillingAddress(customer),
      shippingAddress: resolveCustomerShippingAddress(customer),
      paymentTerms: '',
      deliveryTerms: '',
      customerPoNumber: null,
      remarks: '',
      salesOrderId: null,
      salesOrderNo: null,
      quotationId: null,
      quotationNo: null,
      proformaInvoiceId: null,
      proformaNo: null,
      placeOfSupply: customerState,
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
        taxScheme: l.taxScheme ?? null,
        cgstRate: l.cgstRate ?? null,
        sgstRate: l.sgstRate ?? null,
        utgstRate: l.utgstRate ?? null,
        igstRate: l.igstRate ?? null,
        sourceLineId: l.id,
        maxQty: l.qty,
      },
      l.lineNo,
    ),
  )

  const lines = applyLineQtys(base, lineQtys)
  if (!lines.length) return { ok: false, error: 'Select at least one line quantity.' }

  const so = pi.salesOrderId
    ? useMrpStore.getState().getSalesOrder(pi.salesOrderId)
    : undefined
  const placeOfSupply = placeOfSupplyFromProforma(pi, pi.customerState)
  const taxHeader = taxHeaderPayloadFromSalesOrder(so)

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
      ...taxHeader,
      placeOfSupply,
      lines,
      gst: buildGst(lines, placeOfSupply, so?.supplierStateCode),
    },
  }
}

/**
 * Load sales order (API get-by-id when needed) then map remaining invoiceable qty.
 */
export async function ensureTaxInvoiceFromSalesOrder(
  salesOrderId: string,
  lineQtys?: Record<string, number>,
): Promise<TaxInvoicePrefillResult> {
  if (!salesOrderId.trim()) return { ok: false, error: 'Select a sales order.' }
  if (isApiMode()) {
    const { apiFetchSalesOrder } = await import('../services/bridges/salesOrderApiBridge')
    const res = await apiFetchSalesOrder(salesOrderId)
    if (!res.ok) return { ok: false, error: res.error ?? 'Failed to load sales order.' }
  }
  return resolveTaxInvoiceFromSalesOrder(salesOrderId, lineQtys)
}

/**
 * Load proforma (API get-by-id when needed) then map TI prefill.
 */
export async function ensureTaxInvoiceFromProforma(
  proformaId: string,
  lineQtys?: Record<string, number>,
): Promise<TaxInvoicePrefillResult> {
  if (!proformaId.trim()) return { ok: false, error: 'Select a proforma invoice.' }
  if (isApiMode()) {
    const { apiFetchProforma } = await import('../services/bridges/crmCommercialApiBridge')
    const res = await apiFetchProforma(proformaId)
    if (!res.ok) return { ok: false, error: res.error ?? 'Failed to load proforma invoice.' }
  }
  return resolveTaxInvoiceFromProforma(proformaId, lineQtys)
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
