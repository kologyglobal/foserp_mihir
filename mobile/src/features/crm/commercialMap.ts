import type { CrmQuotation, CrmSalesOrder } from '@/types/crm'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** True when a string looks like a database UUID (never show these as labels). */
export function looksLikeUuid(value: unknown): boolean {
  if (value == null) return false
  return UUID_RE.test(String(value).trim())
}

/**
 * First non-empty, non-UUID string from known keys (camelCase + snake_case).
 * Prefer human codes/names over technical ids.
 */
export function pickDisplayLabel(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = '—',
): string {
  if (!source) return fallback
  for (const key of keys) {
    const raw = source[key]
    if (raw == null) continue
    const text = String(raw).trim()
    if (!text || looksLikeUuid(text)) continue
    return text
  }
  return fallback
}

/** Coerce API number / decimal-string / null into a finite number or null. */
export function toMoneyNumber(value: unknown): number | null {
  if (value == null || value === '') return null
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

/** Paginated CRM lists may return `T[]` or `{ items: T[] }`. */
export function unwrapCrmList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[]
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    if (Array.isArray(o.items)) return o.items as T[]
    if (Array.isArray(o.data)) return o.data as T[]
    if (Array.isArray(o.results)) return o.results as T[]
  }
  return []
}

/** Quotation number users should see (never the DB id). */
export function quotationDisplayCode(
  q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined,
): string {
  return pickDisplayLabel(q as Record<string, unknown>, ['quotationCode', 'quotationNo', 'quotation_code', 'quotation_no'], 'Quotation')
}

/** Customer / company name for list & detail (never company UUID). */
export function quotationDisplayCustomer(
  q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined,
): string {
  return pickDisplayLabel(
    q as Record<string, unknown>,
    ['customerName', 'companyName', 'customer_name', 'company_name', 'customerCode', 'companyCode', 'customer_code', 'company_code'],
    'Customer',
  )
}

/** Primary product line label: code/name — never item UUID. */
export function quotationDisplayProduct(
  q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined,
): string | null {
  const o = (q ?? {}) as Record<string, unknown>
  const docs = Array.isArray(o.documents) ? o.documents : []
  const latest = pickLatestQuotationDocument(docs as Array<{ revisionNo?: number | null }>) as
    | Record<string, unknown>
    | null
  const lines = Array.isArray(latest?.priceLines)
    ? (latest.priceLines as Array<Record<string, unknown>>)
    : Array.isArray(o.priceLines)
      ? (o.priceLines as Array<Record<string, unknown>>)
      : []
  for (const line of lines) {
    const label = pickDisplayLabel(line, [
      'itemCodeSnapshot',
      'item_code_snapshot',
      'itemNameSnapshot',
      'item_name_snapshot',
      'productOrItem',
      'product_or_item',
      'description',
    ], '')
    if (label) return label
  }
  // Header-level product only if it's a human label
  const header = pickDisplayLabel(o, ['itemCode', 'itemName', 'productOrItem', 'productName'], '')
  return header || null
}

/** Sales owner display name — never user id UUID. */
export function quotationDisplayOwner(
  q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined,
): string | null {
  const label = pickDisplayLabel(q as Record<string, unknown>, ['salesOwnerName', 'sales_owner_name', 'ownerName'], '')
  return label || null
}

/** Line label for detail grids — never itemId / product UUID. */
export function quotationLineDisplayLabel(line: Record<string, unknown> | null | undefined): string {
  return pickDisplayLabel(
    line,
    [
      'itemCodeSnapshot',
      'item_code_snapshot',
      'itemNameSnapshot',
      'item_name_snapshot',
      'productOrItem',
      'product_or_item',
      'description',
    ],
    'Line item',
  )
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

/** Latest revision document — API returns docs by revisionNo desc, but do not rely on order. */
export function pickLatestQuotationDocument<T extends { revisionNo?: number | null }>(
  docs: T[] | null | undefined,
): T | null {
  if (!Array.isArray(docs) || docs.length === 0) return null
  return docs.reduce((best, d) =>
    (Number(d.revisionNo) || 0) >= (Number(best.revisionNo) || 0) ? d : best,
  )
}

/** Quotation total — prefer document totalAmount, then pricing.grandTotal. */
export function quotationAmount(q: Partial<CrmQuotation> | Record<string, unknown> | null | undefined): number | null {
  if (!q) return null
  const o = q as Record<string, unknown>
  const top = toMoneyNumber(o.totalAmount ?? o.amount)
  if (top != null) return top
  const docs = Array.isArray(o.documents) ? o.documents : []
  const latest = pickLatestQuotationDocument(docs as Array<{ revisionNo?: number | null }>) as
    | Record<string, unknown>
    | null
  if (latest) {
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
  const raw = q as CrmQuotation & Record<string, unknown>
  const customerId = quotationCustomerId(q)
  const amount = quotationAmount(q)
  const validUntil =
    (raw.validUntil as string | null | undefined) ||
    (raw.expiryDate as string | null | undefined) ||
    (raw.validityDate as string | null | undefined) ||
    (raw.validity_date as string | null | undefined) ||
    null
  const code = quotationDisplayCode(raw)
  const customerName = quotationDisplayCustomer(raw)
  const ownerName = quotationDisplayOwner(raw)
  // Prefer human codes; if API only sent an id masquerading as code, leave blank (UI falls back to "Quotation")
  const quotationCode = code !== 'Quotation' ? code : (raw.quotationCode || raw.quotationNo || null)
  const safeCustomer =
    customerName !== 'Customer' && !looksLikeUuid(customerName) ? customerName : null
  return {
    ...q,
    customerId,
    companyId: customerId,
    customerName: safeCustomer,
    companyName: safeCustomer,
    totalAmount: amount,
    amount,
    pricing: q.pricing ?? (amount != null ? { grandTotal: amount } : undefined),
    validUntil,
    expiryDate: validUntil,
    validityDate: validUntil ?? q.validityDate,
    quotationCode: quotationCode || undefined,
    quotationNo: quotationCode || undefined,
    salesOwnerName: ownerName || q.salesOwnerName || null,
    documents: q.documents ?? [],
  }
}

export async function enrichSalesOrders(rows: CrmSalesOrder[] | unknown): Promise<CrmSalesOrder[]> {
  return unwrapCrmList<CrmSalesOrder>(rows).map(normalizeSalesOrder)
}

export async function enrichQuotations(rows: CrmQuotation[] | unknown): Promise<CrmQuotation[]> {
  return unwrapCrmList<CrmQuotation>(rows).map(normalizeQuotation)
}

export async function enrichSalesOrder(row: CrmSalesOrder): Promise<CrmSalesOrder> {
  return normalizeSalesOrder(row)
}

export async function enrichQuotation(row: CrmQuotation): Promise<CrmQuotation> {
  return normalizeQuotation(row)
}
