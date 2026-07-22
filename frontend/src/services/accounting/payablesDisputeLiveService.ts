/**
 * Live adapters for AP vendor disputes (Accounting VendorInvoice + PO/GRN source links).
 */
import {
  createApDispute,
  listApDisputes,
  transitionApDispute,
  updateApDispute,
  type ApDisputeDto,
  type ApDisputePriority,
  type ApDisputeStatus,
  type ApDisputeType,
} from '../bridges/payablesApiBridge'
import { resolveLegalEntityId } from '../bridges/financeApiBridge'
import type { PayableFilter, VendorDispute, VendorDisputeStatus, VendorDisputeType } from '../../types/payables'
import { DEFAULT_PAYABLE_FILTER } from '../../types/payables'

const PAGE_SIZE = 100

function num(raw: string | number | null | undefined): number {
  const n = typeof raw === 'number' ? raw : Number(raw ?? 0)
  return Number.isFinite(n) ? n : 0
}

async function drainList<T>(fetchPage: (page: number) => Promise<T[]>): Promise<T[]> {
  const all: T[] = []
  for (let page = 1; page <= 50; page += 1) {
    const items = await fetchPage(page)
    all.push(...items)
    if (items.length < PAGE_SIZE) break
  }
  return all
}

const STATUS_TO_LEGACY: Record<ApDisputeStatus, VendorDisputeStatus> = {
  OPEN: 'Open',
  UNDER_REVIEW: 'Under Review',
  AWAITING_VENDOR: 'Awaiting Vendor',
  AWAITING_INTERNAL_TEAM: 'Awaiting Internal Team',
  RESOLVED: 'Resolved',
  REJECTED: 'Rejected',
  CLOSED: 'Closed',
}

const STATUS_FROM_LEGACY: Record<VendorDisputeStatus, ApDisputeStatus> = {
  Open: 'OPEN',
  'Under Review': 'UNDER_REVIEW',
  'Awaiting Vendor': 'AWAITING_VENDOR',
  'Awaiting Internal Team': 'AWAITING_INTERNAL_TEAM',
  Resolved: 'RESOLVED',
  Rejected: 'REJECTED',
  Closed: 'CLOSED',
}

const TYPE_TO_LEGACY: Record<ApDisputeType, VendorDisputeType> = {
  PRICE_DIFFERENCE: 'Price Difference',
  QUANTITY_DIFFERENCE: 'Quantity Difference',
  QUALITY_ISSUE: 'Quality Issue',
  DELIVERY_DELAY: 'Delivery Delay',
  SHORT_SUPPLY: 'Short Supply',
  TAX_ISSUE: 'Tax Issue',
  MISSING_DOCUMENT: 'Missing Document',
  DUPLICATE_INVOICE: 'Duplicate Invoice',
  COMMERCIAL_TERMS: 'Commercial Terms',
  OTHER: 'Other',
}

const TYPE_FROM_LEGACY: Record<VendorDisputeType, ApDisputeType> = {
  'Price Difference': 'PRICE_DIFFERENCE',
  'Quantity Difference': 'QUANTITY_DIFFERENCE',
  'Quality Issue': 'QUALITY_ISSUE',
  'Delivery Delay': 'DELIVERY_DELAY',
  'Short Supply': 'SHORT_SUPPLY',
  'Tax Issue': 'TAX_ISSUE',
  'Missing Document': 'MISSING_DOCUMENT',
  'Duplicate Invoice': 'DUPLICATE_INVOICE',
  'Commercial Terms': 'COMMERCIAL_TERMS',
  Other: 'OTHER',
}

const PRIORITY_TO_LEGACY: Record<ApDisputePriority, VendorDispute['priority']> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
}

const PRIORITY_FROM_LEGACY: Record<VendorDispute['priority'], ApDisputePriority> = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  Critical: 'CRITICAL',
}

function mapSourceContext(d: ApDisputeDto): Pick<VendorDispute, 'purchaseOrders' | 'grns'> {
  const purchaseOrders = d.sourceLinks
    .filter((link) => link.sourceType === 'PURCHASE_ORDER')
    .map((link) => ({
      id: link.sourceDocumentId,
      number: link.sourceDocumentNumberSnapshot ?? link.sourceDocumentId,
    }))
  const grns = d.sourceLinks
    .filter((link) => link.sourceType === 'GOODS_RECEIPT' || link.sourceType === 'PURCHASE_RECEIPT')
    .map((link) => ({
      id: link.sourceDocumentId,
      number: link.sourceDocumentNumberSnapshot ?? link.sourceDocumentId,
    }))
  return { purchaseOrders, grns }
}

export function mapApDisputeToLegacy(d: ApDisputeDto): VendorDispute {
  return {
    id: d.id,
    disputeNumber: d.disputeNumber,
    vendorId: d.vendorId,
    vendorName: d.vendorNameSnapshot,
    invoiceId: d.vendorInvoiceId,
    invoiceNumber: d.vendorInvoiceNumber || d.supplierInvoiceNumber,
    ...mapSourceContext(d),
    disputeDate: d.disputeDate,
    disputeType: TYPE_TO_LEGACY[d.disputeType] ?? 'Other',
    disputedAmount: num(d.disputedAmount),
    description: d.description,
    owner: d.ownerName,
    responsibleDepartment: d.responsibleDepartment,
    priority: PRIORITY_TO_LEGACY[d.priority] ?? 'Medium',
    targetResolutionDate: d.targetResolutionDate ?? '',
    status: STATUS_TO_LEGACY[d.status] ?? 'Open',
    resolution: d.resolution,
    debitNoteRequired: d.debitNoteRequired,
    paymentHold: d.paymentHold,
    supportingDocuments: d.supportingDocuments ?? [],
    createdAt: d.createdAt,
  }
}

export async function getLiveVendorDisputes(filter: Partial<PayableFilter> = {}): Promise<VendorDispute[]> {
  const f = { ...DEFAULT_PAYABLE_FILTER, ...filter }
  const statusMap: Record<string, ApDisputeStatus> = {
    open: 'OPEN',
    under_review: 'UNDER_REVIEW',
    awaiting_vendor: 'AWAITING_VENDOR',
    awaiting_internal_team: 'AWAITING_INTERNAL_TEAM',
    resolved: 'RESOLVED',
    rejected: 'REJECTED',
    closed: 'CLOSED',
  }
  const rows = await drainList((page) =>
    listApDisputes({
      legalEntityId: resolveLegalEntityId(),
      page,
      limit: PAGE_SIZE,
      search: f.search || undefined,
      vendorId: f.vendorId || undefined,
      status: f.disputeTab && f.disputeTab !== 'all' ? statusMap[f.disputeTab] : undefined,
    }),
  )
  return rows.map(mapApDisputeToLegacy)
}

export async function createLiveVendorDispute(
  input: Omit<VendorDispute, 'id' | 'disputeNumber' | 'createdAt' | 'supportingDocuments' | 'purchaseOrders' | 'grns'> & {
    supportingDocuments?: string[]
  },
): Promise<VendorDispute> {
  const created = await createApDispute({
    legalEntityId: resolveLegalEntityId(),
    vendorInvoiceId: input.invoiceId,
    disputeDate: input.disputeDate,
    disputeType: TYPE_FROM_LEGACY[input.disputeType] ?? 'OTHER',
    disputedAmount: String(input.disputedAmount),
    description: input.description,
    ownerName: input.owner,
    responsibleDepartment: input.responsibleDepartment,
    priority: PRIORITY_FROM_LEGACY[input.priority] ?? 'MEDIUM',
    targetResolutionDate: input.targetResolutionDate || null,
    debitNoteRequired: input.debitNoteRequired,
    paymentHold: input.paymentHold,
    supportingDocuments: input.supportingDocuments ?? [],
  })
  if (input.status && input.status !== 'Open') {
    return mapApDisputeToLegacy(
      await transitionApDispute(created.id, {
        status: STATUS_FROM_LEGACY[input.status],
        resolution: input.resolution,
      }),
    )
  }
  return mapApDisputeToLegacy(created)
}

export async function updateLiveVendorDispute(id: string, patch: Partial<VendorDispute>): Promise<VendorDispute> {
  const updated = await updateApDispute(id, {
    disputeDate: patch.disputeDate,
    disputeType: patch.disputeType ? TYPE_FROM_LEGACY[patch.disputeType] : undefined,
    disputedAmount: patch.disputedAmount != null ? String(patch.disputedAmount) : undefined,
    description: patch.description,
    ownerName: patch.owner,
    responsibleDepartment: patch.responsibleDepartment,
    priority: patch.priority ? PRIORITY_FROM_LEGACY[patch.priority] : undefined,
    targetResolutionDate: patch.targetResolutionDate === undefined ? undefined : patch.targetResolutionDate || null,
    debitNoteRequired: patch.debitNoteRequired,
    paymentHold: patch.paymentHold,
  })
  if (patch.status && STATUS_FROM_LEGACY[patch.status] !== updated.status) {
    return mapApDisputeToLegacy(
      await transitionApDispute(id, {
        status: STATUS_FROM_LEGACY[patch.status],
        resolution: patch.resolution,
      }),
    )
  }
  return mapApDisputeToLegacy(updated)
}
