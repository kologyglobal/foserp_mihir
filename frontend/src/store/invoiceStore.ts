import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  InvoiceCandidate,
  InvoiceLine,
  PaymentMode,
  PaymentRecord,
  SalesInvoice,
} from '../types/invoice'
import { DEFAULT_GST_RATE, derivePaymentStatus } from '../types/invoice'
import { computeGst } from '../utils/gstEngine'
import { useDispatchStore } from './dispatchStore'
import { useMasterStore } from './masterStore'
import { useMrpStore } from './mrpStore'
import { useApprovalStore } from './approvalStore'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { assertPermission, getSessionUser } from '../utils/permissions'
import {
  assertMatrixApproval,
  advanceApprovalStep,
  buildApprovalContext,
  isApprovalComplete,
  syncApprovalRequest,
} from '../utils/approvalEngine'

import { getNextCode } from '../services/codeSeriesService'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function nextInvoiceNo(_existing: string[]): string {
  return getNextCode('invoice')
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function refreshPaymentFields(invoice: SalesInvoice): SalesInvoice {
  const balanceDue = Math.max(0, invoice.gst.grandTotal - invoice.amountPaid)
  const paymentStatus = derivePaymentStatus(balanceDue, invoice.amountPaid, invoice.dueDate)
  return { ...invoice, balanceDue, paymentStatus }
}

function formatCustomerAddress(customer: {
  addressLine1: string
  city: string
  state: string
  pincode: string
}): string {
  return [customer.addressLine1, `${customer.city}, ${customer.state} — ${customer.pincode}`]
    .filter(Boolean)
    .join(', ')
}

function normalizeInvoiceLine(line: InvoiceLine): InvoiceLine {
  return {
    ...line,
    trailerNo: line.trailerNo ?? '',
    chassisNo: line.chassisNo ?? '',
  }
}

function normalizeInvoice(invoice: SalesInvoice): SalesInvoice {
  return refreshPaymentFields({
    ...invoice,
    customerAddress: invoice.customerAddress ?? '',
    placeOfSupply: invoice.placeOfSupply ?? invoice.customerState ?? '',
    lrNo: invoice.lrNo ?? '',
    vehicleNo: invoice.vehicleNo ?? '',
    transporter: invoice.transporter ?? '',
    lines: invoice.lines.map(normalizeInvoiceLine),
  })
}

interface InvoiceState {
  invoices: SalesInvoice[]

  getInvoice: (id: string) => SalesInvoice | undefined
  getInvoiceByDispatch: (dispatchId: string) => SalesInvoice | undefined
  getInvoiceCandidates: () => InvoiceCandidate[]
  getReceivables: () => import('../types/invoice').ReceivableRow[]
  getMetrics: () => {
    totalInvoiced: number
    totalReceivable: number
    totalCollected: number
    overdueCount: number
    unpaidCount: number
  }

  createFromDispatch: (dispatchId: string) => { ok: boolean; error?: string; id?: string }
  postInvoice: (invoiceId: string) => { ok: boolean; error?: string }
  recordPayment: (
    invoiceId: string,
    input: { amount: number; paymentDate: string; referenceNo: string; mode: PaymentMode; remarks?: string },
  ) => { ok: boolean; error?: string; paymentId?: string }
  cancelInvoice: (invoiceId: string) => { ok: boolean; error?: string }
  approveInvoiceCancellation: (invoiceId: string) => { ok: boolean; error?: string; pendingNextApprover?: string }
}

export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set, get) => ({
      invoices: [],

      getInvoice: (id) => {
        const invoice = get().invoices.find((i) => i.id === id)
        return invoice ? normalizeInvoice(invoice) : undefined
      },
      getInvoiceByDispatch: (dispatchId) =>
        get().invoices.find((i) => i.dispatchId === dispatchId && i.status !== 'cancelled'),

      getInvoiceCandidates: () => {
        const dispatchStore = useDispatchStore.getState()
        const master = useMasterStore.getState()
        const candidates: InvoiceCandidate[] = []

        for (const d of dispatchStore.dispatches) {
          if (!['dispatched', 'in_transit', 'delivered'].includes(d.status)) continue
          if (get().getInvoiceByDispatch(d.id)) continue

          const product = master.getProduct(d.productId)
          const totalQty = d.lines.reduce((s, l) => s + l.qty, 0)
          candidates.push({
            dispatchId: d.id,
            dispatchNo: d.dispatchNo,
            salesOrderId: d.salesOrderId,
            salesOrderNo: d.salesOrderNo,
            customerId: d.customerId,
            customerName: d.customerName,
            productCode: d.productCode,
            productName: d.productName,
            qty: totalQty,
            unitPrice: product?.standardPrice ?? 0,
            dispatchStatus: d.status,
            dispatchedAt: d.dispatchedAt,
          })
        }
        return candidates
      },

      getReceivables: () => {
        return get()
          .invoices.filter((i) => i.status === 'posted')
          .map((inv) => {
            const refreshed = refreshPaymentFields(inv)
            const daysOverdue =
              refreshed.paymentStatus === 'overdue'
                ? Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(refreshed.dueDate).getTime()) / (1000 * 60 * 60 * 24),
                    ),
                  )
                : 0
            return {
              invoiceId: inv.id,
              invoiceNo: inv.invoiceNo,
              customerName: inv.customerName,
              salesOrderNo: inv.salesOrderNo,
              invoiceDate: inv.invoiceDate,
              dueDate: inv.dueDate,
              grandTotal: inv.gst.grandTotal,
              amountPaid: refreshed.amountPaid,
              balanceDue: refreshed.balanceDue,
              paymentStatus: refreshed.paymentStatus,
              daysOverdue,
            }
          })
          .sort((a, b) => b.balanceDue - a.balanceDue)
      },

      getMetrics: () => {
        const posted = get().invoices.filter((i) => i.status === 'posted')
        const receivables = get().getReceivables()
        return {
          totalInvoiced: posted.reduce((s, i) => s + i.gst.grandTotal, 0),
          totalReceivable: receivables.reduce((s, r) => s + r.balanceDue, 0),
          totalCollected: posted.reduce((s, i) => s + i.amountPaid, 0),
          overdueCount: receivables.filter((r) => r.paymentStatus === 'overdue').length,
          unpaidCount: receivables.filter((r) => r.paymentStatus === 'unpaid').length,
        }
      },

      createFromDispatch: (dispatchId) => {
        const dispatch = useDispatchStore.getState().getDispatch(dispatchId)
        if (!dispatch) return { ok: false, error: 'Dispatch not found' }
        if (!['dispatched', 'in_transit', 'delivered', 'pod_received', 'closed'].includes(dispatch.status)) {
          return { ok: false, error: 'Invoice only from confirmed dispatch' }
        }
        if (get().getInvoiceByDispatch(dispatchId)) {
          return { ok: false, error: 'Invoice already exists for this dispatch' }
        }

        const master = useMasterStore.getState()
        const customer = master.customers.find((c) => c.id === dispatch.customerId)
        if (!customer) return { ok: false, error: 'Customer not found' }

        const product = master.getProduct(dispatch.productId)
        const unitPrice = product?.standardPrice ?? 0
        const gstRate = DEFAULT_GST_RATE

        const lines: InvoiceLine[] = dispatch.lines.map((line) => {
          const item = master.getItem(line.itemId)
          const taxableAmount = line.qty * unitPrice
          return {
            id: genId('invl'),
            dispatchLineId: line.id,
            itemId: line.itemId,
            itemCode: line.itemCode,
            description: item?.itemName ?? line.itemCode,
            hsnCode: item?.hsnCode ?? product?.hsnCode ?? '8716',
            qty: line.qty,
            unitPrice,
            taxableAmount,
            gstRate,
            trailerNo: line.trailerNo ?? '',
            chassisNo: line.chassisNo ?? '',
          }
        })

        const taxableTotal = lines.reduce((s, l) => s + l.taxableAmount, 0)
        const gst = computeGst(taxableTotal, customer.state, gstRate)

        const ts = new Date().toISOString()
        const invoiceDate = ts.slice(0, 10)

        const invoice: SalesInvoice = refreshPaymentFields({
          id: genId('inv'),
          invoiceNo: nextInvoiceNo(get().invoices.map((i) => i.invoiceNo)),
          invoiceDate,
          dueDate: addDays(invoiceDate, customer.creditDays),
          dispatchId: dispatch.id,
          dispatchNo: dispatch.dispatchNo,
          salesOrderId: dispatch.salesOrderId,
          salesOrderNo: dispatch.salesOrderNo,
          customerId: customer.id,
          customerName: customer.customerName,
          customerGstin: customer.gstin,
          customerState: customer.state,
          customerAddress: formatCustomerAddress(customer),
          placeOfSupply: customer.state,
          lrNo: dispatch.lrNo,
          vehicleNo: dispatch.vehicleNo,
          transporter: dispatch.transporter,
          productId: dispatch.productId,
          productCode: dispatch.productCode,
          productName: dispatch.productName,
          lines,
          gst,
          status: 'draft',
          paymentStatus: 'unpaid',
          amountPaid: 0,
          balanceDue: gst.grandTotal,
          payments: [],
          creditDays: customer.creditDays,
          postedAt: null,
          remarks: '',
          createdAt: ts,
          updatedAt: ts,
        })

        set((s) => ({ invoices: [invoice, ...s.invoices] }))
        return { ok: true, id: invoice.id }
      },

      postInvoice: (invoiceId) => {
        const invoice = get().getInvoice(invoiceId)
        if (!invoice) return { ok: false, error: 'Invoice not found' }
        if (invoice.status !== 'draft') return { ok: false, error: 'Only draft invoices can be posted' }

        const ts = new Date().toISOString()
        const posted = refreshPaymentFields({
          ...invoice,
          status: 'posted',
          postedAt: ts,
          updatedAt: ts,
        })

        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === invoiceId ? posted : i)),
        }))

        useMasterStore.getState().markCompanyAsCustomer(invoice.customerId, ts)

        useMrpStore.setState((state) => ({
          salesOrders: state.salesOrders.map((o) =>
            o.id === invoice.salesOrderId ? { ...o, status: 'invoiced' as const } : o,
          ),
        }))

        return { ok: true }
      },

      recordPayment: (invoiceId, input) => {
        const invoice = get().getInvoice(invoiceId)
        if (!invoice) return { ok: false, error: 'Invoice not found' }
        if (invoice.status !== 'posted') return { ok: false, error: 'Payments only on posted invoices' }
        if (input.amount <= 0) return { ok: false, error: 'Payment amount must be positive' }
        if (input.amount > invoice.balanceDue) {
          return { ok: false, error: `Payment exceeds balance due (${invoice.balanceDue})` }
        }

        const ts = new Date().toISOString()
        const payment: PaymentRecord = {
          id: genId('pay'),
          paymentDate: input.paymentDate,
          amount: input.amount,
          referenceNo: input.referenceNo,
          mode: input.mode,
          remarks: input.remarks ?? '',
          recordedAt: ts,
        }

        const amountPaid = invoice.amountPaid + input.amount
        const updated = refreshPaymentFields({
          ...invoice,
          amountPaid,
          payments: [payment, ...invoice.payments],
          updatedAt: ts,
        })

        set((s) => ({
          invoices: s.invoices.map((i) => (i.id === invoiceId ? updated : i)),
        }))

        if (updated.paymentStatus === 'paid') {
          useMrpStore.setState((state) => ({
            salesOrders: state.salesOrders.map((o) =>
              o.id === invoice.salesOrderId ? { ...o, status: 'closed' as const } : o,
            ),
          }))
        }

        return { ok: true, paymentId: payment.id }
      },

      cancelInvoice: (invoiceId) => {
        const perm = assertPermission('accounts', 'cancel')
        if (!perm.ok) return perm
        const invoice = get().getInvoice(invoiceId)
        if (!invoice) return { ok: false, error: 'Invoice not found' }
        if (invoice.status === 'posted' && invoice.amountPaid > 0) {
          return { ok: false, error: 'Cannot cancel invoice with payments recorded' }
        }
        const user = getSessionUser()
        let request = useApprovalStore.getState().getActiveRequest('invoice_cancellation', invoiceId)
        if (!request) {
          syncApprovalRequest({
            documentType: 'invoice_cancellation',
            entityId: invoiceId,
            entityLabel: invoice.invoiceNo,
            context: buildApprovalContext('invoice_cancellation', { totalAmount: invoice.gst.grandTotal }),
            submittedByName: user.name,
          })
          request = useApprovalStore.getState().getActiveRequest('invoice_cancellation', invoiceId)
        }
        if (!isApprovalComplete(request)) {
          return { ok: false, error: 'Invoice cancellation requires Accounts Head approval first' }
        }
        const ts = new Date().toISOString()
        set((s) => ({
          invoices: s.invoices.map((i) =>
            i.id === invoiceId ? { ...i, status: 'cancelled' as const, updatedAt: ts } : i,
          ),
        }))
        return { ok: true }
      },

      approveInvoiceCancellation: (invoiceId) => {
        const perm = assertPermission('accounts', 'approve')
        if (!perm.ok) return perm
        const user = getSessionUser()
        const matrixCheck = assertMatrixApproval('invoice_cancellation', invoiceId, user)
        if (!matrixCheck.ok) return matrixCheck
        const advance = advanceApprovalStep('invoice_cancellation', invoiceId, user)
        if (!advance.ok) return advance
        if (!advance.completed) {
          return { ok: true, pendingNextApprover: advance.nextApprover }
        }
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.invoice,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
    },
  ),
)
