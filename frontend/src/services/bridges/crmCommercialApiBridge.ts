import { isApiMode } from '../../config/apiConfig'
import { formatApiError } from '../api/apiErrors'
import * as api from '../api/crmCommercialApi'
import { useCrmCommercialStore } from '../../store/crmCommercialStore'
import type {
  AllocatePaymentInput,
  CreateCrmInvoiceInput,
  ReceiveProformaPaymentInput,
} from '../../store/crmCommercialStore'
import type { CrmPaymentAllocation, CrmPaymentReceipt, CrmTaxInvoice } from '../../types/crmCommercial'

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

export async function syncCommercialFromApi(): Promise<void> {
  if (!isApiMode()) return
  const res = await api.fetchCommercialSync()
  const data = res.data
  useCrmCommercialStore.setState({
    receipts: data.receipts ?? [],
    invoices: data.invoices ?? [],
    allocations: data.allocations ?? [],
  })
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
        productId: l.productId || null,
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
