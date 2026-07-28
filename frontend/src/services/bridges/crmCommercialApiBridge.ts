import { isApiMode } from '../../config/apiConfig'
import { ApiError, formatApiError } from '../api/apiErrors'
import * as api from '../api/crmCommercialApi'
import { useCrmCommercialStore } from '../../store/crmCommercialStore'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import type {
  AllocatePaymentInput,
  CreateCrmInvoiceInput,
  ReceiveProformaPaymentInput,
} from '../../store/crmCommercialStore'
import type { CrmPaymentAllocation, CrmPaymentReceipt, CrmTaxInvoice } from '../../types/crmCommercial'
import type { ProformaInvoice, ProformaInvoiceLine } from '../../types/proformaInvoice'
import type { ProformaInvoiceInput } from '../../store/proformaInvoiceStore'

function upsertReceipt(receipt: CrmPaymentReceipt) {
  useCrmCommercialStore.setState((s) => ({
    receipts: [receipt, ...s.receipts.filter((r) => r.id !== receipt.id)],
  }))
}

function upsertInvoice(invoice: CrmTaxInvoice) {
  useCrmCommercialStore.setState((s) => ({
    invoices: [invoice, ...s.invoices.filter((i) => i.id !== invoice.id)],
  }))
}

function upsertAllocations(rows: CrmPaymentAllocation[]) {
  useCrmCommercialStore.setState((s) => {
    const ids = new Set(rows.map((r) => r.id))
    return {
      allocations: [...rows, ...s.allocations.filter((a) => !ids.has(a.id))],
    }
  })
}

function upsertProforma(proforma: ProformaInvoice) {
  useProformaInvoiceStore.setState((s) => ({
    proformaInvoices: [proforma, ...s.proformaInvoices.filter((p) => p.id !== proforma.id)],
  }))
}

function mapProformaPayload(input: ProformaInvoiceInput & { salesOrderId?: string | null; salesOrderNo?: string | null; source?: string }) {
  return {
    companyId: input.customerId,
    // Backend defaults proformaDate/validUntil server-side when omitted; an empty
    // string fails the dateOnly regex validator, so normalize blank values away.
    proformaDate: input.proformaDate || undefined,
    validUntil: input.validUntil || undefined,
    source: input.source ?? (input.salesOrderId ? 'sales_order' : 'direct'),
    salesOrderId: input.salesOrderId ?? null,
    salesOrderNo: input.salesOrderNo ?? null,
    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    customerPoNumber: input.customerPoNumber,
    billingAddress: input.billingAddress,
    shippingAddress: input.shippingAddress,
    remarks: input.remarks,
    locationId: input.locationId ?? null,
    lines: input.lines.map((l: ProformaInvoiceLine) => ({
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
      maxQty: null,
    })),
  }
}

/**
 * Hydrate commercial receivables. Requires `crm.commercial.view`.
 * Swallow 403 so CRM AppShell hydration still succeeds for sales users
 * without commercial rights (quotation templates, pipeline, etc.).
 */
export async function syncCommercialFromApi(): Promise<void> {
  if (!isApiMode()) return
  try {
    const res = await api.fetchCommercialSync()
    const data = res.data
    useCrmCommercialStore.setState({
      receipts: data.receipts ?? [],
      invoices: data.invoices ?? [],
      allocations: data.allocations ?? [],
    })
    useProformaInvoiceStore.setState({
      proformaInvoices: data.proformas ?? [],
    })
  } catch (err) {
    const status = err instanceof ApiError ? err.statusCode : 0
    if (status === 403) {
      useCrmCommercialStore.setState({
        receipts: [],
        invoices: [],
        allocations: [],
      })
      useProformaInvoiceStore.setState({ proformaInvoices: [] })
      return
    }
    throw err
  }
}

export async function apiCreateProforma(
  input: ProformaInvoiceInput & { salesOrderId?: string | null; salesOrderNo?: string | null; source?: string },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await api.createCommercialProforma(mapProformaPayload(input))
    upsertProforma(res.data)
    return { ok: true, id: res.data.id }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiUpdateProforma(
  id: string,
  patch: Partial<ProformaInvoiceInput>,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const body: Record<string, unknown> = {}
    if (patch.customerId) body.companyId = patch.customerId
    if (patch.proformaDate) body.proformaDate = patch.proformaDate
    if (patch.validUntil) body.validUntil = patch.validUntil
    if (patch.paymentTerms) body.paymentTerms = patch.paymentTerms
    if (patch.deliveryTerms) body.deliveryTerms = patch.deliveryTerms
    if (patch.customerPoNumber !== undefined) body.customerPoNumber = patch.customerPoNumber
    if (patch.billingAddress !== undefined) body.billingAddress = patch.billingAddress
    if (patch.shippingAddress !== undefined) body.shippingAddress = patch.shippingAddress
    if (patch.remarks !== undefined) body.remarks = patch.remarks
    if (patch.locationId !== undefined) body.locationId = patch.locationId
    if (patch.lines) {
      body.lines = patch.lines.map((l) => ({
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
      }))
    }
    const res = await api.updateCommercialProforma(id, body)
    upsertProforma(res.data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiIssueProforma(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.issueCommercialProforma(id)
    upsertProforma(res.data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiCancelProforma(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.cancelCommercialProforma(id)
    upsertProforma(res.data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiReceiveProformaPayment(
  input: ReceiveProformaPaymentInput & { customerId: string; proformaNo: string; proformaGrandTotal: number },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await api.createCommercialReceipt({
      companyId: input.customerId,
      receiptDate: input.receiptDate,
      paymentMode: input.paymentMode,
      transactionRef: input.transactionRef,
      amount: input.amount,
      remarks: input.remarks,
      attachmentName: input.attachmentName,
      proformaInvoiceId: input.proformaInvoiceId,
      proformaNo: input.proformaNo,
      proformaGrandTotal: input.proformaGrandTotal,
    })
    upsertReceipt(res.data)
    return { ok: true, id: res.data.id }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiCreateInvoice(
  input: CreateCrmInvoiceInput & { customerState?: string; salesOrderNo?: string | null; proformaNo?: string | null },
): Promise<{ ok: boolean; error?: string; id?: string }> {
  try {
    const res = await api.createCommercialInvoice({
      companyId: input.customerId,
      invoiceDate: input.invoiceDate,
      dueDate: input.dueDate,
      source: input.source,
      salesOrderId: input.salesOrderId,
      salesOrderNo: input.salesOrderNo,
      quotationId: input.quotationId,
      quotationNo: input.quotationNo,
      proformaInvoiceId: input.proformaInvoiceId,
      proformaNo: input.proformaNo,
      paymentTerms: input.paymentTerms,
      deliveryTerms: input.deliveryTerms,
      customerPoNumber: input.customerPoNumber,
      billingAddress: input.billingAddress,
      shippingAddress: input.shippingAddress,
      remarks: input.remarks,
      customerState: input.customerState,
      lines: input.lines.map((l) => ({
        itemId: l.itemId,
        itemCode: l.itemCode,
        description: l.description,
        hsnCode: l.hsnCode,
        qty: l.qty,
        uom: l.uom,
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        sourceLineId: l.sourceLineId,
        maxQty: l.maxQty,
      })),
    })
    upsertInvoice(res.data)
    return { ok: true, id: res.data.id }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiPostInvoice(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.postCommercialInvoice(id)
    upsertInvoice(res.data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiCancelDraftInvoice(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await api.cancelCommercialInvoice(id)
    upsertInvoice(res.data)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiAllocatePayments(
  input: AllocatePaymentInput,
): Promise<{ ok: boolean; error?: string; ids?: string[] }> {
  try {
    const res = await api.allocateCommercialPayments(input)
    upsertAllocations(res.data)
    await syncCommercialFromApi()
    return { ok: true, ids: res.data.map((a) => a.id) }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}

export async function apiReverseAllocation(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await api.reverseCommercialAllocation(id)
    await syncCommercialFromApi()
    return { ok: true }
  } catch (err) {
    return { ok: false, error: formatApiError(err) }
  }
}
