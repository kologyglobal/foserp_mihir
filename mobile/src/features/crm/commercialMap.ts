import type { CrmQuotation, CrmSalesOrder } from '@/types/crm'

/** Coerce API number / decimal-string / null into a finite number or null. */
export function toMoneyNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Sales order total — API field is `grandTotal` (not totalAmount/amount). */
export function salesOrderAmount(so: Partial<CrmSalesOrder> | Record<string, unknown> | null | undefined): number | null {
  if (!so) return null
  const o = so as Record<string, unknown>
  const direct = toMoneyNumber(o.grandTotal ?? o.totalAmount ?? o.amount ?? o.basicAmount)
  if (direct != null) return direct
  const lines = o.lines
  if (Array.isArray(lines) && lines.length) {
    const sum = lines.reduce((acc, line) => {
      const row = line as Record<string, unknown>
      return acc + (toMoneyNumber(row.lineTotal ?? row.amount) ?? 0)
    }, 0)
    return sum > 0 ? Math.round(sum * 100) / 100 : null
  }
  return null
}

/** Quotation total — prefer document totalAmount, then pricing.grandTotal. */
export function quotationAmount(q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined): number | null {
  if (!q) return null
  const o = q as Record<string, unknown>
  const top = toMoneyNumber(o.totalAmount ?? o.amount)
  if (top != null) return top
  const docs = Array.isArray(o.documents) ? o.documents : []
  if (docs.length) {
    const latest = docs[docs.length - 1] as Record<string, unknown>
    const docTotal = toMoneyNumber(latest.totalAmount ?? latest.grandTotal)
    if (docTotal != null) return docTotal
  }
  const pricing = o.pricing as Record<string, unknown> | undefined
  return toMoneyNumber(pricing?.grandTotal ?? pricing?.subtotal)
}

export function salesOrderCustomerId(so: Partial<CrmSalesOrder> | Record<string, unknown> | null | undefined): string | null {
  if (!so) return null
  const o = so as Record<string, unknown>
  const id = o.customerId ?? o.companyId
  return typeof id === 'string' && id ? id : null
}

export function quotationCustomerId(q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined): string | null {
  if (!q) return null
  const o = q as Record<string, unknown>
  const id = o.customerId ?? o.companyId
  return typeof id === 'string' && id ? id : null
}

/**
 * Normalize commercial DTOs for UI — money aliases only.
 * Customer name is expected from the API (`customerName` via company join).
 */
export function normalizeSalesOrder(so: CrmSalesOrder): CrmSalesOrder {
  const customerId = salesOrderCustomerId(so)
  const amount = salesOrderAmount(so)
  const customerName = (so.customerName || so.companyName || '').trim() || null
  return {
    ...so,
    customerId,
    companyId: customerId,
    customerName,
    companyName: customerName,
    grandTotal: amount,
    totalAmount: amount,
    amount,
  }
}

export function normalizeQuotation(q: CrmQuotation): CrmQuotation {
  const customerId = quotationCustomerId(q)
  const amount = quotationAmount(q)
  const validUntil = q.validUntil || q.expiryDate || q.validityDate || null
  const customerName = (q.customerName || q.companyName || '').trim() || null
  return {
    ...q,
    customerId,
    companyId: customerId,
    customerName,
    companyName: customerName,
    totalAmount: amount,
    amount,
    pricing: q.pricing ?? (amount != null ? { grandTotal: amount } : undefined),
    validUntil,
    expiryDate: validUntil,
    validityDate: validUntil ?? q.validityDate,
    quotationCode: q.quotationCode || q.quotationNo,
    quotationNo: q.quotationNo || q.quotationCode,
    documents: q.documents ?? [],
  }
}

export async function enrichSalesOrders(rows: CrmSalesOrder[]): Promise<CrmSalesOrder[]> {
  return rows.map(normalizeSalesOrder)
}

export async function enrichQuotations(rows: CrmQuotation[]): Promise<CrmQuotation[]> {
  return rows.map(normalizeQuotation)
}

export async function enrichSalesOrder(row: CrmSalesOrder): Promise<CrmSalesOrder> {
  return normalizeSalesOrder(row)
}

export async function enrichQuotation(row: CrmQuotation): Promise<CrmQuotation> {
  return normalizeQuotation(row)
}
