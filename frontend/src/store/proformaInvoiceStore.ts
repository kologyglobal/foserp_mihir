import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ProformaInvoice, ProformaInvoiceLine, ProformaInvoiceSource, ProformaInvoiceStatus } from '../types/proformaInvoice'
import { DEFAULT_GST_RATE } from '../types/invoice'
import { computeGst } from '../utils/gstEngine'
import { nextDocumentNo } from '../utils/documentNumbers'
import { buildProformaLinesFromSalesOrder, computeProformaLineTotals, sumProformaTaxable } from '../utils/proformaInvoiceLines'
import { useMasterStore } from './masterStore'
import { useMrpStore } from './mrpStore'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { assertPermission } from '../utils/permissions'
import { resolveCustomerShippingAddress } from '../utils/customerUtils'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function nowIso() {
  return new Date().toISOString()
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatCustomerAddress(customer: {
  addressLine1: string
  city: string
  state: string
  pincode: string
}): string {
  return [customer.addressLine1, `${customer.city}, ${customer.state} — ${customer.pincode}`].filter(Boolean).join(', ')
}

function normalizeLines(lines: ProformaInvoiceLine[]): ProformaInvoiceLine[] {
  return lines.map((line, idx) => {
    const totals = computeProformaLineTotals(line)
    return {
      ...line,
      lineNo: idx + 1,
      ...totals,
    }
  })
}

function buildGst(lines: ProformaInvoiceLine[], customerState: string) {
  const taxable = sumProformaTaxable(lines)
  const avgRate = lines.length
    ? lines.reduce((s, l) => s + l.taxPct, 0) / lines.length
    : DEFAULT_GST_RATE
  return computeGst(taxable, customerState, avgRate)
}

export interface ProformaInvoiceInput {
  customerId: string
  proformaDate?: string
  validUntil?: string
  paymentTerms: string
  deliveryTerms: string
  customerPoNumber?: string | null
  billingAddress?: string | null
  shippingAddress?: string | null
  remarks?: string
  locationId?: string | null
  lines: ProformaInvoiceLine[]
  salesOrderId?: string | null
  source?: ProformaInvoiceSource
}

interface ProformaInvoiceState {
  proformaInvoices: ProformaInvoice[]
  getProforma: (id: string) => ProformaInvoice | undefined
  getBySalesOrder: (salesOrderId: string) => ProformaInvoice[]
  createDirect: (input: ProformaInvoiceInput) => { ok: boolean; error?: string; id?: string }
  createFromSalesOrder: (salesOrderId: string, patch?: Partial<ProformaInvoiceInput>) => { ok: boolean; error?: string; id?: string }
  updateDraft: (id: string, patch: Partial<ProformaInvoiceInput>) => { ok: boolean; error?: string }
  issue: (id: string) => { ok: boolean; error?: string }
  cancel: (id: string) => { ok: boolean; error?: string }
}

export const useProformaInvoiceStore = create<ProformaInvoiceState>()(
  persist(
    (set, get) => ({
      proformaInvoices: [],

      getProforma: (id) => get().proformaInvoices.find((p) => p.id === id),

      getBySalesOrder: (salesOrderId) =>
        get().proformaInvoices.filter((p) => p.salesOrderId === salesOrderId),

      createDirect: (input) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm
        if (!input.lines.length) return { ok: false, error: 'At least one line is required.' }

        const master = useMasterStore.getState()
        const customer = master.getCustomer(input.customerId)
        if (!customer) return { ok: false, error: 'Customer not found.' }

        const lines = normalizeLines(input.lines)
        const ts = nowIso()
        const proformaDate = input.proformaDate ?? ts.slice(0, 10)
        const record: ProformaInvoice = {
          id: genId('pi'),
          proformaNo: nextDocumentNo('PI-', get().proformaInvoices.map((p) => p.proformaNo)),
          proformaDate,
          validUntil: input.validUntil ?? addDays(proformaDate, 30),
          status: 'draft',
          source: input.source ?? 'direct',
          salesOrderId: input.salesOrderId ?? null,
          salesOrderNo: input.salesOrderId ? useMrpStore.getState().getSalesOrder(input.salesOrderId)?.salesOrderNo ?? null : null,
          quotationId: null,
          quotationNo: null,
          customerId: customer.id,
          customerName: customer.customerName,
          customerGstin: customer.gstin,
          customerState: customer.state,
          customerAddress: formatCustomerAddress(customer),
          placeOfSupply: customer.state,
          customerPoNumber: input.customerPoNumber ?? null,
          paymentTerms: input.paymentTerms,
          deliveryTerms: input.deliveryTerms,
          billingAddress: input.billingAddress ?? formatCustomerAddress(customer),
          shippingAddress: input.shippingAddress ?? resolveCustomerShippingAddress(customer),
          remarks: input.remarks ?? '',
          locationId: input.locationId ?? null,
          lines,
          gst: buildGst(lines, customer.state),
          issuedAt: null,
          createdAt: ts,
          updatedAt: ts,
        }

        set((s) => ({ proformaInvoices: [record, ...s.proformaInvoices] }))
        return { ok: true, id: record.id }
      },

      createFromSalesOrder: (salesOrderId, patch) => {
        const perm = assertPermission('sales', 'create')
        if (!perm.ok) return perm

        const so = useMrpStore.getState().getSalesOrder(salesOrderId)
        if (!so) return { ok: false, error: 'Sales order not found.' }
        if (['closed', 'cancelled'].includes(so.status)) {
          return { ok: false, error: 'Cannot create proforma for a closed sales order.' }
        }

        const existing = get().proformaInvoices.find(
          (p) => p.salesOrderId === salesOrderId && p.status !== 'cancelled',
        )
        if (existing) {
          return { ok: false, error: `Active proforma ${existing.proformaNo} already exists for this sales order.` }
        }

        const master = useMasterStore.getState()
        const customer = master.getCustomer(so.customerId)
        if (!customer) return { ok: false, error: 'Customer not found.' }

        const lines = normalizeLines(patch?.lines ?? buildProformaLinesFromSalesOrder(so, master.products))
        const ts = nowIso()
        const proformaDate = patch?.proformaDate ?? ts.slice(0, 10)

        const record: ProformaInvoice = {
          id: genId('pi'),
          proformaNo: nextDocumentNo('PI-', get().proformaInvoices.map((p) => p.proformaNo)),
          proformaDate,
          validUntil: patch?.validUntil ?? addDays(proformaDate, 30),
          status: 'draft',
          source: 'sales_order',
          salesOrderId: so.id,
          salesOrderNo: so.salesOrderNo,
          quotationId: so.quotationId ?? null,
          quotationNo: so.quotationNo ?? null,
          customerId: customer.id,
          customerName: customer.customerName,
          customerGstin: customer.gstin,
          customerState: customer.state,
          customerAddress: formatCustomerAddress(customer),
          placeOfSupply: customer.state,
          customerPoNumber: patch?.customerPoNumber ?? so.customerPoNumber ?? null,
          paymentTerms: patch?.paymentTerms ?? so.paymentTerms ?? '30% advance, balance before dispatch',
          deliveryTerms: patch?.deliveryTerms ?? so.deliveryTerms ?? 'Ex-works Pune',
          billingAddress: patch?.billingAddress ?? so.billingAddress ?? formatCustomerAddress(customer),
          shippingAddress: patch?.shippingAddress ?? so.shippingAddress ?? resolveCustomerShippingAddress(customer),
          remarks: patch?.remarks ?? so.internalRemarks ?? '',
          locationId: patch?.locationId ?? so.locationId ?? null,
          lines,
          gst: buildGst(lines, customer.state),
          issuedAt: null,
          createdAt: ts,
          updatedAt: ts,
        }

        set((s) => ({ proformaInvoices: [record, ...s.proformaInvoices] }))
        return { ok: true, id: record.id }
      },

      updateDraft: (id, patch) => {
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm
        const existing = get().getProforma(id)
        if (!existing) return { ok: false, error: 'Proforma invoice not found.' }
        if (existing.status !== 'draft') return { ok: false, error: 'Only draft proforma invoices can be edited.' }

        const master = useMasterStore.getState()
        const customerId = patch.customerId ?? existing.customerId
        const customer = master.getCustomer(customerId)
        if (!customer) return { ok: false, error: 'Customer not found.' }

        const lines = normalizeLines(patch.lines ?? existing.lines)
        const proformaDate = patch.proformaDate ?? existing.proformaDate

        set((s) => ({
          proformaInvoices: s.proformaInvoices.map((p) =>
            p.id === id
              ? {
                  ...p,
                  customerId: customer.id,
                  customerName: customer.customerName,
                  customerGstin: customer.gstin,
                  customerState: customer.state,
                  customerAddress: formatCustomerAddress(customer),
                  placeOfSupply: customer.state,
                  proformaDate,
                  validUntil: patch.validUntil ?? p.validUntil,
                  paymentTerms: patch.paymentTerms ?? p.paymentTerms,
                  deliveryTerms: patch.deliveryTerms ?? p.deliveryTerms,
                  customerPoNumber: patch.customerPoNumber ?? p.customerPoNumber,
                  billingAddress: patch.billingAddress ?? p.billingAddress,
                  shippingAddress: patch.shippingAddress ?? p.shippingAddress,
                  remarks: patch.remarks ?? p.remarks,
                  locationId: patch.locationId !== undefined ? patch.locationId : p.locationId,
                  lines,
                  gst: buildGst(lines, customer.state),
                  updatedAt: nowIso(),
                }
              : p,
          ),
        }))
        return { ok: true }
      },

      issue: (id) => {
        const perm = assertPermission('sales', 'post')
        if (!perm.ok) return perm
        const existing = get().getProforma(id)
        if (!existing) return { ok: false, error: 'Proforma invoice not found.' }
        if (existing.status !== 'draft') return { ok: false, error: 'Only draft proforma invoices can be issued.' }

        const ts = nowIso()
        set((s) => ({
          proformaInvoices: s.proformaInvoices.map((p) =>
            p.id === id ? { ...p, status: 'issued' as ProformaInvoiceStatus, issuedAt: ts, updatedAt: ts } : p,
          ),
        }))
        return { ok: true }
      },

      cancel: (id) => {
        const perm = assertPermission('sales', 'edit')
        if (!perm.ok) return perm
        const existing = get().getProforma(id)
        if (!existing) return { ok: false, error: 'Proforma invoice not found.' }
        if (existing.status === 'cancelled') return { ok: false, error: 'Proforma invoice is already cancelled.' }

        set((s) => ({
          proformaInvoices: s.proformaInvoices.map((p) =>
            p.id === id ? { ...p, status: 'cancelled' as ProformaInvoiceStatus, updatedAt: nowIso() } : p,
          ),
        }))
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.proformaInvoice,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({ proformaInvoices: s.proformaInvoices }),
    },
  ),
)
