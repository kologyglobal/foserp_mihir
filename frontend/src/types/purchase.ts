import type { AuditTrail } from './audit'

/**
 * Operational Purchase documents used by Zustand `purchaseStore` and existing UI.
 * API-ready domain models (service layer) live in `./purchaseDomain` — do not merge casually.
 */

export type PrSource = 'mrp' | 'manual' | 'reorder' | 'work_order' | 'maintenance' | 'store_reorder' | 'project'
export type ManualPrPurpose =
  | 'office_supplies'
  | 'emergency_material'
  | 'maintenance_parts'
  | 'tooling'
  | 'general'

export const MANUAL_PR_PURPOSE_LABELS: Record<ManualPrPurpose, string> = {
  office_supplies: 'Office Supplies',
  emergency_material: 'Emergency Material',
  maintenance_parts: 'Maintenance Parts',
  tooling: 'Tooling',
  general: 'General',
}

export const PR_SOURCE_LABELS: Record<PrSource, string> = {
  mrp: 'MRP',
  manual: 'Manual',
  reorder: 'Reorder',
  work_order: 'Work Order',
  maintenance: 'Maintenance',
  store_reorder: 'Store Reorder',
  project: 'Project',
}
export type PrStatus = 'draft' | 'submitted' | 'approved' | 'converted' | 'cancelled'
export type RfqStatus = 'draft' | 'sent' | 'quoted' | 'closed' | 'cancelled'
export type PoStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'released'
  | 'sent'
  | 'partial'
  | 'received'
  | 'closed'
  | 'cancelled'
  | 'amended'
export type GrnStatus = 'draft' | 'pending_qc' | 'posted' | 'cancelled'

/** Allowed forward transitions — no backward without cancel/reversal */
export const PR_STATUS_FLOW: Record<PrStatus, PrStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['converted', 'cancelled'],
  converted: [],
  cancelled: [],
}

export const PO_STATUS_FLOW: Record<PoStatus, PoStatus[]> = {
  draft: ['submitted', 'cancelled'],
  submitted: ['approved', 'cancelled'],
  approved: ['released', 'sent', 'cancelled'],
  released: ['sent', 'partial', 'received', 'closed', 'cancelled'],
  sent: ['partial', 'received', 'closed', 'cancelled'],
  partial: ['received', 'closed', 'cancelled'],
  received: ['closed'],
  closed: [],
  cancelled: [],
  amended: ['submitted', 'cancelled'],
}

export const DEFAULT_GRN_EXCESS_TOLERANCE_PCT = 5

/** PO can be amended when not closed/cancelled and at least one line has open qty. */
export function poIsAmendable(po: PurchaseOrder): boolean {
  if (['cancelled', 'closed'].includes(po.status)) return false
  if (po.lines.length === 0) return false
  const fullyReceived = po.lines.every((l) => l.receivedQty >= l.qty)
  if (fullyReceived) return false
  return ['draft', 'submitted', 'approved', 'released', 'sent', 'partial'].includes(po.status)
}

export interface PurchaseRequisitionLine {
  id: string
  itemId: string
  warehouseId: string
  qty: number
  requiredDate: string
  mrpMaterialLineId: string | null
  mrpRunId: string | null
  salesOrderId: string | null
  workOrderId: string | null
  remarks: string
}

export interface PurchaseRequisition extends AuditTrail {
  id: string
  prNo: string
  source: PrSource
  mrpRunId: string | null
  salesOrderId: string | null
  salesOrderNo: string | null
  workOrderId: string | null
  workOrderNo: string | null
  status: PrStatus
  requestedBy: string
  /** Set for manual / reorder PRs — office, emergency, maintenance, tooling, etc. */
  purpose: ManualPrPurpose | null
  lines: PurchaseRequisitionLine[]
}

export interface RfqLine {
  id: string
  itemId: string
  warehouseId: string
  qty: number
  prLineId: string | null
}

export interface RfqVendorQuote {
  vendorId: string
  itemId: string
  quotedRate: number
  leadTimeDays: number
  deliveryDate: string
  paymentTerms: string
  freightAmount: number
  gstPct: number
  remarks: string
}

export interface RequestForQuotation extends AuditTrail {
  id: string
  rfqNo: string
  prId: string
  status: RfqStatus
  vendorIds: string[]
  lines: RfqLine[]
  quotes: RfqVendorQuote[]
  recommendedVendorId: string | null
  recommendationNote: string
}

export interface PurchaseOrderLine {
  id: string
  itemId: string
  warehouseId: string
  qty: number
  rate: number
  receivedQty: number
  mrpMaterialLineId: string | null
  prLineId: string | null
  requiredDate: string
}

export interface PoRevision {
  revisionNo: number
  amendedAt: string
  amendedByName: string
  reason: string
  previousLines: PurchaseOrderLine[]
}

export interface PurchaseOrder extends AuditTrail {
  id: string
  poNo: string
  revisionNo: number
  vendorId: string
  prId: string | null
  rfqId: string | null
  mrpRunId: string | null
  salesOrderId: string | null
  status: PoStatus
  orderDate: string
  expectedDate: string
  paymentTerms: string
  lines: PurchaseOrderLine[]
  revisions: PoRevision[]
  sentAt: string | null
}

export interface GrnLine {
  id: string
  poLineId: string
  itemId: string
  warehouseId: string
  receivedQty: number
  acceptedQty: number
  rejectedQty: number
  quarantineQty: number
  rate: number
}

export interface GrnHeader extends AuditTrail {
  id: string
  grnNo: string
  poId: string
  poNo: string
  vendorId: string
  warehouseId: string
  grnDate: string
  status: GrnStatus
  qcRequired: boolean
  incomingInspectionId: string | null
  lines: GrnLine[]
  postedAt: string | null
  excessTolerancePct: number
}

/** Landed cost per unit = rate + freight/qty + GST on (rate + freight/qty) */
export function computeLandedCostPerUnit(
  rate: number,
  qty: number,
  freightAmount: number,
  gstPct: number,
): number {
  if (qty <= 0) return rate
  const freightPerUnit = freightAmount / qty
  const base = rate + freightPerUnit
  return base * (1 + gstPct / 100)
}

export interface VendorComparisonRow {
  vendorId: string
  vendorName: string
  itemId: string
  itemCode: string
  quotedRate: number
  landedCostPerUnit: number
  deliveryDate: string
  leadTimeDays: number
  paymentTerms: string
  isPreferred: boolean
  rank: number
}

export interface PendingPrRow {
  prId: string
  prNo: string
  source: PrSource
  purpose: ManualPrPurpose | null
  salesOrderNo: string | null
  lineCount: number
  status: PrStatus
  requiredDate: string
  createdAt: string
}

export interface OpenPoRow {
  poId: string
  poNo: string
  vendorName: string
  status: PoStatus
  expectedDate: string
  openQty: number
  totalValue: number
  isDelayed: boolean
}

export interface VendorPerformanceRow {
  vendorId: string
  vendorName: string
  poCount: number
  grnCount: number
  onTimePct: number
  avgLeadDays: number
  rejectionPct?: number
  priceVariancePct?: number
  rfqResponseDays?: number
  totalPoValue?: number
  openPoValue?: number
  rating?: number
  lastPurchaseDate?: string
}

export type VendorQuoteStatus = 'draft' | 'submitted' | 'included' | 'regret' | 'selected'
export type PurchaseReturnStatus = 'draft' | 'submitted' | 'approved' | 'dispatched' | 'closed' | 'cancelled'
export type PurchaseReturnReason =
  | 'qc_rejection'
  | 'wrong_material'
  | 'damaged'
  | 'excess_supply'
  | 'short_supply_adjustment'
  | 'commercial_dispute'

export const PURCHASE_RETURN_REASON_LABELS: Record<PurchaseReturnReason, string> = {
  qc_rejection: 'QC Rejection',
  wrong_material: 'Wrong Material',
  damaged: 'Damaged',
  excess_supply: 'Excess Supply',
  short_supply_adjustment: 'Short Supply Adjustment',
  commercial_dispute: 'Commercial Dispute',
}

export interface VendorQuotationLine {
  id: string
  rfqLineId: string | null
  itemId: string
  qty: number
  uom: string
  quotedRate: number
  discountPct: number
  gstPct: number
  freightAmount: number
  deliveryDays: number
  makeBrand: string
  remarks: string
}

export interface VendorQuotation extends AuditTrail {
  id: string
  vendorQuoteNo: string
  rfqId: string
  vendorId: string
  quoteDate: string
  validTill: string
  contactPerson: string
  currency: string
  paymentTerms: string
  deliveryTerms: string
  freightTerms: string
  warranty: string
  status: VendorQuoteStatus
  totalValue: number
  remarks: string
  lines: VendorQuotationLine[]
}

export interface PurchaseReturnLine {
  id: string
  itemId: string
  grnLineId: string | null
  lotNo: string
  receivedQty: number
  rejectedQty: number
  returnQty: number
  reason: PurchaseReturnReason
  remarks: string
}

export interface PurchaseReturn extends AuditTrail {
  id: string
  returnNo: string
  returnDate: string
  vendorId: string
  grnId: string | null
  poId: string | null
  returnReason: PurchaseReturnReason
  transportDetails: string
  status: PurchaseReturnStatus
  lines: PurchaseReturnLine[]
}

export interface PurchaseDashboardMetrics {
  openPrs: number
  prPendingApproval: number
  rfqsOpen: number
  vendorQuotationsPending: number
  poPendingApproval: number
  openPoValue: number
  poDueThisWeek: number
  grnPending: number
  qcPending: number
  lateDeliveries: number
  purchaseSavings: number
  vendorOnTimePct: number
}


export function assertStatusTransition<T extends string>(
  flow: Record<T, T[]>,
  from: T,
  to: T,
): { ok: true } | { ok: false; error: string } {
  if (!flow[from]?.includes(to)) {
    return { ok: false, error: `Invalid status transition: ${from} → ${to}` }
  }
  return { ok: true }
}
