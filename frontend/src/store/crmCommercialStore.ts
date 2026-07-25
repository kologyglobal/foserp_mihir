import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  CrmCommercialAuditEntry,
  CrmCommercialLine,
  CrmCommercialSource,
  CrmCustomerTimelineEvent,
  CrmPaymentAllocation,
  CrmPaymentMode,
  CrmPaymentReceipt,
  CrmTaxInvoice,
  CrmTaxInvoiceStatus,
} from '../types/crmCommercial'
import {
  computeInvoicePaymentStatus,
  computeProformaPaymentStatus,
  invoiceStatusFromPayment,
} from '../types/crmCommercial'
import { DEFAULT_GST_RATE } from '../types/invoice'
import { computeGst } from '../utils/gstEngine'
import { nextDocumentNo } from '../utils/documentNumbers'
import { useMasterStore } from './masterStore'
import { useMrpStore } from './mrpStore'
import { useProformaInvoiceStore } from './proformaInvoiceStore'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { canCrmPermission } from '../utils/permissions/crm'
import { resolveCustomerShippingAddress } from '../utils/customerUtils'
import { buildProformaLinesFromSalesOrder, computeProformaLineTotals, sumProformaTaxable } from '../utils/proformaInvoiceLines'
import type { ProformaInvoiceLine } from '../types/proformaInvoice'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function actorName() {
  return 'CRM User'
}

function assertCommercial(permission: string): { ok: boolean; error?: string } {
  if (!canCrmPermission(permission)) {
    return { ok: false, error: 'You do not have permission for this commercial action.' }
  }
  return { ok: true }
}

function formatCustomerAddress(customer: {
  addressLine1: string
  city: string
  state: string
  pincode: string
}): string {
  return [customer.addressLine1, `${customer.city}, ${customer.state} — ${customer.pincode}`].filter(Boolean).join(', ')
}

function normalizeLines(lines: CrmCommercialLine[]): CrmCommercialLine[] {
  return lines.map((line, idx) => {
    const totals = computeProformaLineTotals(line as unknown as ProformaInvoiceLine)
    return {
      ...line,
      lineNo: idx + 1,
      taxableValue: totals.taxableValue,
      gstAmount: totals.gstAmount,
      lineTotal: totals.lineTotal,
    }
  })
}

function buildGst(lines: CrmCommercialLine[], customerState: string) {
  const taxable = sumProformaTaxable(lines as unknown as ProformaInvoiceLine[])
  const avgRate = lines.length
    ? lines.reduce((s, l) => s + l.taxPct, 0) / lines.length
    : DEFAULT_GST_RATE
  return computeGst(taxable, customerState, avgRate)
}

function toCommercialLinesFromProforma(lines: ProformaInvoiceLine[]): CrmCommercialLine[] {
  return lines.map((l) => ({
    id: genId('cil'),
    lineNo: l.lineNo,
    productId: l.productId,
    itemCode: l.itemCode,
    description: l.description,
    hsnCode: l.hsnCode,
    qty: l.qty,
    uom: l.uom,
    unitPrice: l.unitPrice,
    discountPct: l.discountPct,
    taxPct: l.taxPct,
    taxableValue: l.taxableValue,
    gstAmount: l.gstAmount,
    lineTotal: l.lineTotal,
    sourceLineId: l.id,
    maxQty: l.qty,
  }))
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface ReceiveProformaPaymentInput {
  proformaInvoiceId: string
  receiptDate: string
  paymentMode: CrmPaymentMode
  transactionRef: string
  amount: number
  remarks?: string
  attachmentName?: string | null
}

export interface CreateCrmInvoiceInput {
  customerId: string
  invoiceDate?: string
  dueDate?: string
  source: CrmCommercialSource
  salesOrderId?: string | null
  proformaInvoiceId?: string | null
  quotationId?: string | null
  quotationNo?: string | null
  paymentTerms?: string
  deliveryTerms?: string
  customerPoNumber?: string | null
  billingAddress?: string | null
  shippingAddress?: string | null
  remarks?: string
  lines: CrmCommercialLine[]
}

export interface AllocatePaymentInput {
  receiptId: string
  allocations: Array<{ invoiceId: string; amount: number }>
  allocationDate?: string
  remarks?: string
}

interface CrmCommercialState {
  receipts: CrmPaymentReceipt[]
  invoices: CrmTaxInvoice[]
  allocations: CrmPaymentAllocation[]
  auditLog: CrmCommercialAuditEntry[]
  timeline: CrmCustomerTimelineEvent[]

  getReceipt: (id: string) => CrmPaymentReceipt | undefined
  getInvoice: (id: string) => CrmTaxInvoice | undefined
  getReceiptsByProforma: (proformaId: string) => CrmPaymentReceipt[]
  getReceiptsByCustomer: (customerId: string) => CrmPaymentReceipt[]
  getInvoicesByCustomer: (customerId: string) => CrmTaxInvoice[]
  getInvoicesBySalesOrder: (salesOrderId: string) => CrmTaxInvoice[]
  getOpenInvoicesByCustomer: (customerId: string) => CrmTaxInvoice[]
  getAvailableReceiptsByCustomer: (customerId: string) => CrmPaymentReceipt[]
  getAllocationsByInvoice: (invoiceId: string) => CrmPaymentAllocation[]
  getAllocationsByReceipt: (receiptId: string) => CrmPaymentAllocation[]
  getAllocationsByCustomer: (customerId: string) => CrmPaymentAllocation[]
  getProformaPaymentSummary: (proformaId: string) => {
    totalAmount: number
    amountReceived: number
    balanceAmount: number
    paymentStatus: ReturnType<typeof computeProformaPaymentStatus>
  } | null
  getCustomerOutstanding: (customerId: string) => {
    invoiceTotal: number
    amountPaid: number
    outstanding: number
    openInvoiceCount: number
  }
  getCustomerLedger: (customerId: string) => Array<{
    id: string
    date: string
    type: string
    reference: string
    debit: number
    credit: number
    balance: number
  }>
  getCustomerTimeline: (customerId: string) => CrmCustomerTimelineEvent[]

  receiveProformaPayment: (input: ReceiveProformaPaymentInput) => { ok: boolean; error?: string; id?: string }
  createInvoice: (input: CreateCrmInvoiceInput) => { ok: boolean; error?: string; id?: string }
  createInvoiceFromSalesOrder: (
    salesOrderId: string,
    lineQtys?: Record<string, number>,
  ) => { ok: boolean; error?: string; id?: string }
  createInvoiceFromProforma: (
    proformaId: string,
    lineQtys?: Record<string, number>,
  ) => { ok: boolean; error?: string; id?: string }
  postInvoice: (id: string) => { ok: boolean; error?: string }
  cancelDraftInvoice: (id: string) => { ok: boolean; error?: string }
  allocatePayments: (input: AllocatePaymentInput) => { ok: boolean; error?: string; ids?: string[] }
  reverseAllocation: (allocationId: string) => { ok: boolean; error?: string }
}

function pushAudit(
  list: CrmCommercialAuditEntry[],
  entry: Omit<CrmCommercialAuditEntry, 'id' | 'at' | 'by'>,
): CrmCommercialAuditEntry[] {
  return [
    {
      ...entry,
      id: genId('aud'),
      at: nowIso(),
      by: actorName(),
    },
    ...list,
  ]
}

function pushTimeline(
  list: CrmCustomerTimelineEvent[],
  entry: Omit<CrmCustomerTimelineEvent, 'id'>,
): CrmCustomerTimelineEvent[] {
  return [{ ...entry, id: genId('ctl') }, ...list]
}

export const useCrmCommercialStore = create<CrmCommercialState>()(
  persist(
    (set, get) => ({
      receipts: [],
      invoices: [],
      allocations: [],
      auditLog: [],
      timeline: [],

      getReceipt: (id) => get().receipts.find((r) => r.id === id),
      getInvoice: (id) => get().invoices.find((i) => i.id === id),
      getReceiptsByProforma: (proformaId) =>
        get().receipts.filter((r) => r.proformaInvoiceId === proformaId),
      getReceiptsByCustomer: (customerId) =>
        get().receipts.filter((r) => r.customerId === customerId),
      getInvoicesByCustomer: (customerId) =>
        get().invoices.filter((i) => i.customerId === customerId),
      getInvoicesBySalesOrder: (salesOrderId) =>
        get().invoices.filter((i) => i.salesOrderId === salesOrderId && i.status !== 'cancelled'),
      getOpenInvoicesByCustomer: (customerId) =>
        get().invoices.filter(
          (i) =>
            i.customerId === customerId
            && i.status !== 'draft'
            && i.status !== 'cancelled'
            && i.balanceDue > 0.009,
        ),
      getAvailableReceiptsByCustomer: (customerId) =>
        get().receipts.filter((r) => r.customerId === customerId && r.unallocatedAmount > 0.009),
      getAllocationsByInvoice: (invoiceId) =>
        get().allocations.filter((a) => a.invoiceId === invoiceId && !a.reversedAt),
      getAllocationsByReceipt: (receiptId) =>
        get().allocations.filter((a) => a.receiptId === receiptId && !a.reversedAt),
      getAllocationsByCustomer: (customerId) =>
        get().allocations.filter((a) => a.customerId === customerId),

      getProformaPaymentSummary: (proformaId) => {
        const pi = useProformaInvoiceStore.getState().getProforma(proformaId)
        if (!pi) return null
        const amountReceived = get()
          .getReceiptsByProforma(proformaId)
          .reduce((s, r) => s + r.amount, 0)
        const totalAmount = pi.gst.grandTotal
        return {
          totalAmount,
          amountReceived,
          balanceAmount: Math.max(0, totalAmount - amountReceived),
          paymentStatus: computeProformaPaymentStatus(totalAmount, amountReceived),
        }
      },

      getCustomerOutstanding: (customerId) => {
        const invs = get().invoices.filter(
          (i) => i.customerId === customerId && i.status !== 'draft' && i.status !== 'cancelled',
        )
        const invoiceTotal = invs.reduce((s, i) => s + i.gst.grandTotal, 0)
        const amountPaid = invs.reduce((s, i) => s + i.amountPaid, 0)
        const outstanding = invs.reduce((s, i) => s + i.balanceDue, 0)
        return {
          invoiceTotal,
          amountPaid,
          outstanding,
          openInvoiceCount: invs.filter((i) => i.balanceDue > 0.009).length,
        }
      },

      getCustomerLedger: (customerId) => {
        type Row = { id: string; date: string; type: string; reference: string; debit: number; credit: number }
        const rows: Row[] = []
        for (const inv of get().invoices.filter((i) => i.customerId === customerId && i.status !== 'draft' && i.status !== 'cancelled')) {
          rows.push({
            id: inv.id,
            date: inv.invoiceDate,
            type: 'Tax Invoice',
            reference: inv.invoiceNo,
            debit: inv.gst.grandTotal,
            credit: 0,
          })
        }
        for (const r of get().receipts.filter((x) => x.customerId === customerId)) {
          rows.push({
            id: r.id,
            date: r.receiptDate,
            type: r.proformaNo ? 'PI Receipt' : 'Payment Receipt',
            reference: r.receiptNo,
            debit: 0,
            credit: r.amount,
          })
        }
        rows.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference))
        let balance = 0
        return rows.map((row) => {
          balance += row.debit - row.credit
          return { ...row, balance }
        })
      },

      getCustomerTimeline: (customerId) =>
        get().timeline
          .filter((t) => t.customerId === customerId)
          .sort((a, b) => b.at.localeCompare(a.at)),

      receiveProformaPayment: (input) => {
        const perm = assertCommercial('crm.commercial.receipt.create')
        if (!perm.ok) return perm
        if (input.amount <= 0) return { ok: false, error: 'Amount received must be greater than zero.' }

        const pi = useProformaInvoiceStore.getState().getProforma(input.proformaInvoiceId)
        if (!pi) return { ok: false, error: 'Proforma invoice not found.' }
        if (pi.status !== 'issued') return { ok: false, error: 'Payments can only be received against issued proformas.' }

        const summary = get().getProformaPaymentSummary(pi.id)
        const balance = summary?.balanceAmount ?? pi.gst.grandTotal
        if (input.amount > balance + 0.009) {
          return { ok: false, error: `Amount exceeds balance of ${balance.toFixed(2)}.` }
        }

        const ts = nowIso()
        const receipt: CrmPaymentReceipt = {
          id: genId('rcpt'),
          receiptNo: nextDocumentNo('RCPT-', get().receipts.map((r) => r.receiptNo)),
          receiptDate: input.receiptDate.slice(0, 10),
          customerId: pi.customerId,
          customerName: pi.customerName,
          proformaInvoiceId: pi.id,
          proformaNo: pi.proformaNo,
          paymentMode: input.paymentMode,
          transactionRef: input.transactionRef.trim(),
          amount: input.amount,
          unallocatedAmount: input.amount,
          remarks: input.remarks?.trim() ?? '',
          attachmentName: input.attachmentName ?? null,
          createdAt: ts,
          updatedAt: ts,
          createdBy: actorName(),
        }

        set((s) => ({
          receipts: [receipt, ...s.receipts],
          auditLog: pushAudit(s.auditLog, {
            action: 'receipt_created',
            entityType: 'receipt',
            entityId: receipt.id,
            customerId: receipt.customerId,
            summary: `Received ${receipt.amount} on ${receipt.proformaNo}`,
            details: {
              receiptNo: receipt.receiptNo,
              proformaId: pi.id,
              amount: receipt.amount,
              mode: receipt.paymentMode,
            },
          }),
          timeline: pushTimeline(s.timeline, {
            customerId: receipt.customerId,
            kind: 'payment_receipt',
            title: `Payment receipt ${receipt.receiptNo}`,
            subtitle: `Against ${pi.proformaNo} · ${receipt.paymentMode.toUpperCase()}`,
            amount: receipt.amount,
            refId: receipt.id,
            refPath: `/crm/commercial/receipts/${receipt.id}`,
            at: ts,
          }),
        }))
        return { ok: true, id: receipt.id }
      },

      createInvoice: (input) => {
        const perm = assertCommercial('crm.commercial.invoice.create')
        if (!perm.ok) return perm
        if (!input.lines.length) return { ok: false, error: 'At least one line is required.' }
        for (const line of input.lines) {
          if (line.qty <= 0) return { ok: false, error: 'Line quantity must be greater than zero.' }
          if (line.maxQty != null && line.qty > line.maxQty + 0.0001) {
            return { ok: false, error: `Qty for ${line.itemCode} exceeds remaining ${line.maxQty}.` }
          }
        }

        const customer = useMasterStore.getState().getCustomer(input.customerId)
        if (!customer) return { ok: false, error: 'Customer not found.' }

        const lines = normalizeLines(input.lines)
        const ts = nowIso()
        const invoiceDate = (input.invoiceDate ?? ts).slice(0, 10)
        const so = input.salesOrderId ? useMrpStore.getState().getSalesOrder(input.salesOrderId) : undefined
        const pi = input.proformaInvoiceId
          ? useProformaInvoiceStore.getState().getProforma(input.proformaInvoiceId)
          : undefined

        const gst = buildGst(lines, customer.state)
        const record: CrmTaxInvoice = {
          id: genId('inv'),
          invoiceNo: nextDocumentNo('INV-', get().invoices.map((i) => i.invoiceNo)),
          invoiceDate,
          dueDate: (input.dueDate ?? addDays(invoiceDate, customer.creditDays || 30)).slice(0, 10),
          status: 'draft',
          paymentStatus: 'unpaid',
          source: input.source,
          customerId: customer.id,
          customerName: customer.customerName,
          customerGstin: customer.gstin,
          customerState: customer.state,
          customerAddress: formatCustomerAddress(customer),
          placeOfSupply: customer.state,
          billingAddress: input.billingAddress ?? formatCustomerAddress(customer),
          shippingAddress: input.shippingAddress ?? resolveCustomerShippingAddress(customer),
          deliveryTerms: input.deliveryTerms ?? so?.deliveryTerms ?? pi?.deliveryTerms ?? '',
          paymentTerms: input.paymentTerms ?? so?.paymentTerms ?? pi?.paymentTerms ?? '',
          customerPoNumber: input.customerPoNumber ?? so?.customerPoNumber ?? pi?.customerPoNumber ?? null,
          salesOrderId: input.salesOrderId ?? so?.id ?? pi?.salesOrderId ?? null,
          salesOrderNo: so?.salesOrderNo ?? pi?.salesOrderNo ?? null,
          quotationId: input.quotationId ?? so?.quotationId ?? pi?.quotationId ?? null,
          quotationNo: input.quotationNo ?? so?.quotationNo ?? pi?.quotationNo ?? null,
          proformaInvoiceId: pi?.id ?? null,
          proformaNo: pi?.proformaNo ?? null,
          remarks: input.remarks ?? '',
          lines,
          gst,
          amountPaid: 0,
          balanceDue: gst.grandTotal,
          postedAt: null,
          cancelledAt: null,
          createdAt: ts,
          updatedAt: ts,
          createdBy: actorName(),
        }

        set((s) => ({
          invoices: [record, ...s.invoices],
          auditLog: pushAudit(s.auditLog, {
            action: 'invoice_created',
            entityType: 'invoice',
            entityId: record.id,
            customerId: record.customerId,
            summary: `Draft invoice ${record.invoiceNo} created`,
            details: { invoiceNo: record.invoiceNo, source: record.source, total: record.gst.grandTotal },
          }),
          timeline: pushTimeline(s.timeline, {
            customerId: record.customerId,
            kind: 'invoice',
            title: `Invoice ${record.invoiceNo} (Draft)`,
            subtitle: record.salesOrderNo ? `From ${record.salesOrderNo}` : 'Direct / CRM',
            amount: record.gst.grandTotal,
            refId: record.id,
            refPath: `/crm/commercial/invoices/${record.id}`,
            at: ts,
          }),
        }))
        return { ok: true, id: record.id }
      },

      createInvoiceFromSalesOrder: (salesOrderId, lineQtys) => {
        const so = useMrpStore.getState().getSalesOrder(salesOrderId)
        if (!so) return { ok: false, error: 'Sales order not found.' }
        if (so.status === 'open') return { ok: false, error: 'Confirm the sales order before creating an invoice.' }

        const master = useMasterStore.getState()
        const baseLines = buildProformaLinesFromSalesOrder(so, master.products)
        const existing = get().getInvoicesBySalesOrder(salesOrderId)
        const invoicedQtyBySource = new Map<string, number>()
        for (const inv of existing) {
          for (const line of inv.lines) {
            const key = line.sourceLineId ?? line.itemCode
            invoicedQtyBySource.set(key, (invoicedQtyBySource.get(key) ?? 0) + line.qty)
          }
        }

        const lines: CrmCommercialLine[] = []
        for (const bl of baseLines) {
          const already = invoicedQtyBySource.get(bl.id) ?? invoicedQtyBySource.get(bl.itemCode) ?? 0
          const remaining = Math.max(0, bl.qty - already)
          if (remaining <= 0) continue
          const qty = lineQtys?.[bl.id] ?? lineQtys?.[bl.itemCode] ?? remaining
          if (qty <= 0) continue
          const capped = Math.min(qty, remaining)
          const scaled = { ...bl, qty: capped, id: genId('cil'), sourceLineId: bl.id, maxQty: remaining }
          const totals = computeProformaLineTotals(scaled)
          lines.push({
            id: scaled.id,
            lineNo: lines.length + 1,
            productId: bl.productId,
            itemCode: bl.itemCode,
            description: bl.description,
            hsnCode: bl.hsnCode,
            qty: capped,
            uom: bl.uom,
            unitPrice: bl.unitPrice,
            discountPct: bl.discountPct,
            taxPct: bl.taxPct,
            taxableValue: totals.taxableValue,
            gstAmount: totals.gstAmount,
            lineTotal: totals.lineTotal,
            sourceLineId: bl.id,
            maxQty: remaining,
          })
        }
        if (!lines.length) return { ok: false, error: 'No remaining quantity to invoice on this sales order.' }

        return get().createInvoice({
          customerId: so.customerId,
          source: 'sales_order',
          salesOrderId: so.id,
          quotationId: so.quotationId ?? null,
          quotationNo: so.quotationNo ?? null,
          paymentTerms: so.paymentTerms ?? undefined,
          deliveryTerms: so.deliveryTerms ?? undefined,
          customerPoNumber: so.customerPoNumber ?? null,
          billingAddress: so.billingAddress ?? null,
          shippingAddress: so.shippingAddress ?? null,
          remarks: so.internalRemarks ?? '',
          lines,
        })
      },

      createInvoiceFromProforma: (proformaId, lineQtys) => {
        const pi = useProformaInvoiceStore.getState().getProforma(proformaId)
        if (!pi) return { ok: false, error: 'Proforma invoice not found.' }
        if (pi.status === 'cancelled') return { ok: false, error: 'Cannot invoice a cancelled proforma.' }
        if (pi.status === 'draft') return { ok: false, error: 'Issue the proforma before creating a tax invoice.' }

        const base = toCommercialLinesFromProforma(pi.lines)
        const lines: CrmCommercialLine[] = []
        for (const bl of base) {
          const qty = lineQtys?.[bl.sourceLineId ?? ''] ?? lineQtys?.[bl.itemCode] ?? bl.qty
          if (qty <= 0) continue
          const capped = Math.min(qty, bl.maxQty ?? bl.qty)
          const totals = computeProformaLineTotals({ ...bl, qty: capped } as unknown as ProformaInvoiceLine)
          lines.push({
            ...bl,
            id: genId('cil'),
            lineNo: lines.length + 1,
            qty: capped,
            taxableValue: totals.taxableValue,
            gstAmount: totals.gstAmount,
            lineTotal: totals.lineTotal,
          })
        }
        if (!lines.length) return { ok: false, error: 'Select at least one line quantity.' }

        return get().createInvoice({
          customerId: pi.customerId,
          source: 'proforma',
          salesOrderId: pi.salesOrderId,
          proformaInvoiceId: pi.id,
          quotationId: pi.quotationId,
          quotationNo: pi.quotationNo,
          paymentTerms: pi.paymentTerms,
          deliveryTerms: pi.deliveryTerms,
          customerPoNumber: pi.customerPoNumber,
          billingAddress: pi.billingAddress,
          shippingAddress: pi.shippingAddress,
          remarks: pi.remarks,
          lines,
        })
      },

      postInvoice: (id) => {
        const perm = assertCommercial('crm.commercial.invoice.post')
        if (!perm.ok) return perm
        const inv = get().getInvoice(id)
        if (!inv) return { ok: false, error: 'Invoice not found.' }
        if (inv.status !== 'draft') return { ok: false, error: 'Only draft invoices can be posted.' }

        const ts = nowIso()
        set((s) => ({
          invoices: s.invoices.map((i) =>
            i.id === id
              ? { ...i, status: 'posted' as CrmTaxInvoiceStatus, postedAt: ts, updatedAt: ts }
              : i,
          ),
          auditLog: pushAudit(s.auditLog, {
            action: 'invoice_posted',
            entityType: 'invoice',
            entityId: id,
            customerId: inv.customerId,
            summary: `Posted invoice ${inv.invoiceNo}`,
            details: { invoiceNo: inv.invoiceNo },
          }),
          timeline: pushTimeline(s.timeline, {
            customerId: inv.customerId,
            kind: 'invoice',
            title: `Invoice ${inv.invoiceNo} posted`,
            subtitle: 'Awaiting payment allocation',
            amount: inv.gst.grandTotal,
            refId: inv.id,
            refPath: `/crm/commercial/invoices/${inv.id}`,
            at: ts,
          }),
        }))
        return { ok: true }
      },

      cancelDraftInvoice: (id) => {
        const perm = assertCommercial('crm.commercial.invoice.cancel')
        if (!perm.ok) return perm
        const inv = get().getInvoice(id)
        if (!inv) return { ok: false, error: 'Invoice not found.' }
        if (inv.status !== 'draft') return { ok: false, error: 'Only draft invoices can be cancelled.' }

        const ts = nowIso()
        set((s) => ({
          invoices: s.invoices.map((i) =>
            i.id === id
              ? {
                  ...i,
                  status: 'cancelled' as CrmTaxInvoiceStatus,
                  cancelledAt: ts,
                  updatedAt: ts,
                  balanceDue: 0,
                }
              : i,
          ),
          auditLog: pushAudit(s.auditLog, {
            action: 'invoice_cancelled',
            entityType: 'invoice',
            entityId: id,
            customerId: inv.customerId,
            summary: `Cancelled draft invoice ${inv.invoiceNo}`,
            details: { invoiceNo: inv.invoiceNo },
          }),
        }))
        return { ok: true }
      },

      allocatePayments: (input) => {
        const perm = assertCommercial('crm.commercial.allocation.create')
        if (!perm.ok) return perm
        const receipt = get().getReceipt(input.receiptId)
        if (!receipt) return { ok: false, error: 'Receipt not found.' }
        if (!input.allocations.length) return { ok: false, error: 'Add at least one allocation line.' }

        let remaining = receipt.unallocatedAmount
        const created: CrmPaymentAllocation[] = []
        const invoicePatches = new Map<string, number>()
        const allocationDate = (input.allocationDate ?? nowIso()).slice(0, 10)
        const ts = nowIso()

        for (const row of input.allocations) {
          if (row.amount <= 0) return { ok: false, error: 'Allocation amounts must be positive.' }
          const inv = get().getInvoice(row.invoiceId)
          if (!inv) return { ok: false, error: 'Invoice not found.' }
          if (inv.customerId !== receipt.customerId) {
            return { ok: false, error: 'Receipt and invoice must belong to the same customer.' }
          }
          if (inv.status === 'draft' || inv.status === 'cancelled') {
            return { ok: false, error: `Invoice ${inv.invoiceNo} is not open for allocation.` }
          }
          const alreadyQueued = invoicePatches.get(inv.id) ?? 0
          if (row.amount > inv.balanceDue - alreadyQueued + 0.009) {
            return { ok: false, error: `Amount exceeds outstanding on ${inv.invoiceNo}.` }
          }
          if (row.amount > remaining + 0.009) {
            return { ok: false, error: 'Allocation exceeds unallocated receipt balance.' }
          }
          remaining -= row.amount
          invoicePatches.set(inv.id, alreadyQueued + row.amount)
          created.push({
            id: genId('alloc'),
            receiptId: receipt.id,
            receiptNo: receipt.receiptNo,
            invoiceId: inv.id,
            invoiceNo: inv.invoiceNo,
            customerId: receipt.customerId,
            customerName: receipt.customerName,
            amount: row.amount,
            allocationDate,
            remarks: input.remarks?.trim() ?? '',
            reversedAt: null,
            reversedBy: null,
            createdAt: ts,
            createdBy: actorName(),
          })
        }

        set((s) => {
          let invoices = s.invoices.map((inv) => {
            const add = invoicePatches.get(inv.id)
            if (!add) return inv
            const amountPaid = inv.amountPaid + add
            const balanceDue = Math.max(0, inv.gst.grandTotal - amountPaid)
            const paymentStatus = computeInvoicePaymentStatus(inv.gst.grandTotal, amountPaid)
            return {
              ...inv,
              amountPaid,
              balanceDue,
              paymentStatus,
              status: invoiceStatusFromPayment(paymentStatus, inv.status),
              updatedAt: ts,
            }
          })
          const receipts = s.receipts.map((r) =>
            r.id === receipt.id
              ? { ...r, unallocatedAmount: remaining, updatedAt: ts }
              : r,
          )
          let auditLog = s.auditLog
          let timeline = s.timeline
          for (const alloc of created) {
            auditLog = pushAudit(auditLog, {
              action: 'allocation_created',
              entityType: 'allocation',
              entityId: alloc.id,
              customerId: alloc.customerId,
              summary: `Allocated ${alloc.amount} from ${alloc.receiptNo} to ${alloc.invoiceNo}`,
              details: {
                receiptId: alloc.receiptId,
                invoiceId: alloc.invoiceId,
                amount: alloc.amount,
              },
            })
            timeline = pushTimeline(timeline, {
              customerId: alloc.customerId,
              kind: 'payment_allocation',
              title: `Allocated ${alloc.amount} to ${alloc.invoiceNo}`,
              subtitle: `From receipt ${alloc.receiptNo}`,
              amount: alloc.amount,
              refId: alloc.id,
              refPath: '/crm/commercial/payment-allocation',
              at: ts,
            })
          }
          return {
            invoices,
            receipts,
            allocations: [...created, ...s.allocations],
            auditLog,
            timeline,
          }
        })

        return { ok: true, ids: created.map((c) => c.id) }
      },

      reverseAllocation: (allocationId) => {
        const perm = assertCommercial('crm.commercial.allocation.reverse')
        if (!perm.ok) return perm
        const alloc = get().allocations.find((a) => a.id === allocationId)
        if (!alloc) return { ok: false, error: 'Allocation not found.' }
        if (alloc.reversedAt) return { ok: false, error: 'Allocation already reversed.' }

        const ts = nowIso()
        set((s) => {
          const allocations = s.allocations.map((a) =>
            a.id === allocationId
              ? { ...a, reversedAt: ts, reversedBy: actorName() }
              : a,
          )
          const receipts = s.receipts.map((r) =>
            r.id === alloc.receiptId
              ? { ...r, unallocatedAmount: r.unallocatedAmount + alloc.amount, updatedAt: ts }
              : r,
          )
          const invoices = s.invoices.map((inv) => {
            if (inv.id !== alloc.invoiceId) return inv
            const amountPaid = Math.max(0, inv.amountPaid - alloc.amount)
            const balanceDue = Math.max(0, inv.gst.grandTotal - amountPaid)
            const paymentStatus = computeInvoicePaymentStatus(inv.gst.grandTotal, amountPaid)
            return {
              ...inv,
              amountPaid,
              balanceDue,
              paymentStatus,
              status: invoiceStatusFromPayment(paymentStatus, inv.status),
              updatedAt: ts,
            }
          })
          return {
            allocations,
            receipts,
            invoices,
            auditLog: pushAudit(s.auditLog, {
              action: 'allocation_reversed',
              entityType: 'allocation',
              entityId: allocationId,
              customerId: alloc.customerId,
              summary: `Reversed allocation of ${alloc.amount} from ${alloc.invoiceNo}`,
              details: { receiptId: alloc.receiptId, invoiceId: alloc.invoiceId, amount: alloc.amount },
            }),
          }
        })
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.crmCommercial,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        receipts: s.receipts,
        invoices: s.invoices,
        allocations: s.allocations,
        auditLog: s.auditLog,
        timeline: s.timeline,
      }),
    },
  ),
)
