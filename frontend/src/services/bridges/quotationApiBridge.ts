import type { Quotation } from '../../types/sales'
import type { QuotationDocument } from '../../types/crm'
import { formatApiError } from '../api/apiErrors'
import { getStoredSession } from '../api/client'
import * as crmApi from '../api/crmApi'
import * as quotationApi from '../api/quotationApi'
import { useCrmStore } from '../../store/crmStore'
import { useSalesStore } from '../../store/salesStore'
import type { StoreActionResult } from '../../store/storeAction'

const submitLocks = new Set<string>()

function lockKey(scope: string, id?: string): string {
  return id ? `${scope}:${id}` : scope
}

async function withSubmitLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (submitLocks.has(key)) throw new Error('Operation already in progress')
  submitLocks.add(key)
  try {
    return await fn()
  } finally {
    submitLocks.delete(key)
  }
}

function fail(err: unknown): StoreActionResult {
  return { ok: false, error: formatApiError(err) }
}

function isUuid(value: string | null | undefined): boolean {
  if (!value) return false
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

/** Optional FK: omit empty/demo ids so Zod uuid().nullable() does not reject "". */
function optionalUuid(value: unknown): string | null {
  if (value == null || value === '') return null
  return isUuid(String(value)) ? String(value) : null
}

function sessionUserId(): string | undefined {
  return getStoredSession()?.user.id
}

function resolveOwnerId(ownerId?: string | null): string | undefined {
  if (ownerId && isUuid(ownerId)) return ownerId
  return sessionUserId()
}

function toApiDateTime(value: string | null | undefined): string | null | undefined {
  if (value == null || value === '') return value === '' ? null : value
  if (value.includes('T')) return value
  return `${value}T00:00:00.000Z`
}

function sanitizeQuotationPayload(input: Record<string, unknown>): Record<string, unknown> {
  const payload = { ...input }
  for (const key of ['locationId', 'opportunityId', 'productId', 'contactId', 'templateId'] as const) {
    if (key in payload) payload[key] = optionalUuid(payload[key])
  }
  if ('salesOwnerId' in payload) {
    payload.salesOwnerId = resolveOwnerId(payload.salesOwnerId as string | null | undefined) ?? null
  }
  if ('validityDate' in payload) {
    payload.validityDate = toApiDateTime(payload.validityDate as string | null | undefined)
  }
  if (Array.isArray(payload.priceLines)) {
    payload.priceLines = (payload.priceLines as Array<Record<string, unknown>>).map((line) => ({
      ...line,
      productId: optionalUuid(line.productId),
    }))
  }
  return payload
}

export function quotationHeaderFromApi(dto: quotationApi.QuotationApiDto): Quotation {
  const { documents: _documents, ...header } = dto
  return header as Quotation
}

export function applyQuotationApiResponse(dto: quotationApi.QuotationApiDto): void {
  const header = quotationHeaderFromApi(dto)
  const documents = dto.documents ?? []
  useSalesStore.setState((s) => ({
    quotations: [header, ...s.quotations.filter((q) => q.id !== header.id)],
  }))
  useCrmStore.setState((s) => ({
    quotationDocuments: [
      ...documents,
      ...s.quotationDocuments.filter((d) => d.quotationId !== header.id),
    ],
  }))
}

export function removeQuotation(id: string): void {
  useSalesStore.setState((s) => ({ quotations: s.quotations.filter((q) => q.id !== id) }))
  useCrmStore.setState((s) => ({ quotationDocuments: s.quotationDocuments.filter((d) => d.quotationId !== id) }))
}

export async function syncQuotationsFromApi(): Promise<{
  quotationHeaders: Quotation[]
  quotationDocuments: QuotationDocument[]
}> {
  const quotations = await crmApi.fetchAllCrmPages<quotationApi.QuotationApiDto>('/crm/quotations')
  const quotationHeaders = quotations.map(quotationHeaderFromApi)
  const quotationDocuments = quotations.flatMap((q) => q.documents ?? [])
  useSalesStore.setState({ quotations: quotationHeaders })
  useCrmStore.setState({ quotationDocuments })
  return { quotationHeaders, quotationDocuments }
}

export async function apiCreateQuotation(input: Record<string, unknown>): Promise<StoreActionResult & { quotationId?: string; documentId?: string }> {
  return withSubmitLock(lockKey('quotation:create'), async () => {
    try {
      const payload = sanitizeQuotationPayload(input)
      const res = await quotationApi.createQuotationApi(payload)
      applyQuotationApiResponse(res.data)
      const latestDoc = res.data.documents?.[0]
      return { ok: true, quotationId: res.data.id, documentId: latestDoc?.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateQuotation(id: string, patch: Record<string, unknown>): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:update', id), async () => {
    try {
      const payload = sanitizeQuotationPayload(patch)
      const res = await quotationApi.updateQuotationApi(id, payload)
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiUpdateQuotationDocument(
  quotationId: string,
  documentId: string,
  patch: Partial<Pick<QuotationDocument, 'sections' | 'priceLines' | 'freightAmount' | 'installationAmount' | 'customCharges' | 'commercialNotes' | 'technicalNotes' | 'contactId' | 'salesOwnerId' | 'salesOwnerName' | 'locationId'>>,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:doc-update', documentId), async () => {
    try {
      const payload = sanitizeQuotationPayload({ ...patch })
      const res = await quotationApi.updateQuotationDocumentApi(quotationId, documentId, payload)
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCreateQuotationRevision(quotationId: string, reason: string): Promise<StoreActionResult & { documentId?: string }> {
  return withSubmitLock(lockKey('quotation:revision', quotationId), async () => {
    try {
      const res = await quotationApi.createQuotationRevisionApi(quotationId, { reason })
      applyQuotationApiResponse(res.data)
      const latestDoc = res.data.documents?.[0]
      return { ok: true, documentId: latestDoc?.id }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiSubmitQuotationDocumentForApproval(
  quotationId: string,
  documentId: string,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:submit', documentId), async () => {
    try {
      const res = await quotationApi.submitQuotationDocumentApprovalApi(quotationId, documentId, {})
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiApproveQuotationDocument(
  quotationId: string,
  documentId: string,
  remarks?: string,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:approve', documentId), async () => {
    try {
      const res = await quotationApi.approveQuotationDocumentApi(quotationId, documentId, { remarks })
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiRejectQuotationDocument(
  quotationId: string,
  documentId: string,
  remarks?: string,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:reject', documentId), async () => {
    try {
      const res = await quotationApi.rejectQuotationDocumentApi(quotationId, documentId, { remarks })
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiMarkQuotationDocumentSent(quotationId: string, documentId: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:sent', documentId), async () => {
    try {
      const res = await quotationApi.markQuotationDocumentSentApi(quotationId, documentId)
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCustomerApproveQuotationDocument(
  quotationId: string,
  documentId: string,
  remarks?: string,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:customer-approve', documentId), async () => {
    try {
      const res = await quotationApi.customerApproveQuotationDocumentApi(quotationId, documentId, { remarks })
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCustomerRejectQuotationDocument(
  quotationId: string,
  documentId: string,
  remarks?: string,
): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:customer-reject', documentId), async () => {
    try {
      const res = await quotationApi.customerRejectQuotationDocumentApi(quotationId, documentId, { remarks })
      applyQuotationApiResponse(res.data)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiDeleteQuotation(id: string): Promise<StoreActionResult> {
  return withSubmitLock(lockKey('quotation:delete', id), async () => {
    try {
      await quotationApi.deleteQuotationApi(id)
      removeQuotation(id)
      return { ok: true }
    } catch (err) {
      return fail(err)
    }
  })
}

export async function apiCreateQuotationFromOpportunity(input: {
  opportunityId: string
  opportunityNo: string
  customerId: string
  productId: string
  qty: number
  unitPrice: number
  discountPct?: number
  gstPct?: number
  terms?: string
  paymentTerms?: string
  deliveryTerms?: string
  validityDate?: string
  locationId?: string | null
  contactId?: string | null
  salesOwnerId?: string | null
  salesOwnerName?: string | null
  templateId?: string | null
  sections?: QuotationDocument['sections']
  priceLines?: QuotationDocument['priceLines']
  commercialNotes?: string | null
  technicalNotes?: string | null
  freightAmount?: number
  installationAmount?: number
  customCharges?: number
}): Promise<StoreActionResult & { quotationId?: string; documentId?: string }> {
  return apiCreateQuotation({
    customerId: input.customerId,
    opportunityId: input.opportunityId,
    productId: input.productId,
    qty: input.qty,
    unitPrice: input.unitPrice,
    discountPct: input.discountPct ?? 0,
    gstPct: input.gstPct ?? 18,
    terms: input.terms,
    paymentTerms: input.paymentTerms,
    deliveryTerms: input.deliveryTerms,
    validityDate: input.validityDate,
    locationId: input.locationId,
    contactId: input.contactId,
    salesOwnerId: input.salesOwnerId,
    salesOwnerName: input.salesOwnerName ?? undefined,
    templateId: input.templateId,
    sections: input.sections,
    priceLines: input.priceLines,
    commercialNotes: input.commercialNotes,
    technicalNotes: input.technicalNotes,
    freightAmount: input.freightAmount,
    installationAmount: input.installationAmount,
    customCharges: input.customCharges,
    summary: `Initial quotation created from opportunity ${input.opportunityNo}`,
  })
}
