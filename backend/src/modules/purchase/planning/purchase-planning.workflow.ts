import type { PurchasePlanningRow, PurchasePlanningStatus } from '@prisma/client'
import {
  PlanningInvalidTransitionError,
  PlanningNotEligibleError,
  PlanningPoNotReadyError,
  PlanningRfqRequiredError,
  PlanningRowReadOnlyError,
  PlanningStatusReasonRequiredError,
  PurchaseOrderCreationError,
} from './purchase-planning.errors.js'
import { PURCHASE_ERROR_CODE, purchaseMessage } from '../shared/purchase-error-catalog.js'

export const TERMINAL_PLANNING_STATUSES: PurchasePlanningStatus[] = ['CANCELLED', 'COMPLETED']

export const OPEN_PO_STATUSES = [
  'APPROVED',
  'SENT_TO_VENDOR',
  'PARTIALLY_RECEIVED',
] as const

/** Statuses eligible for Create PO from Planning. */
export const PO_ELIGIBLE_PLANNING_STATUSES: PurchasePlanningStatus[] = [
  'VENDOR_SELECTED',
  'APPROVED',
  'PO_PENDING',
]

/** Allowed status transitions for Planning Sheet rows. */
const ALLOWED_TRANSITIONS: Record<PurchasePlanningStatus, PurchasePlanningStatus[]> = {
  PENDING_PLANNING: ['UNDER_REVIEW', 'VENDOR_SELECTED', 'ON_HOLD', 'CANCELLED'],
  UNDER_REVIEW: ['PENDING_PLANNING', 'VENDOR_SELECTED', 'ON_HOLD', 'CANCELLED'],
  VENDOR_SELECTED: ['UNDER_REVIEW', 'APPROVED', 'PO_PENDING', 'ON_HOLD', 'CANCELLED'],
  APPROVED: ['VENDOR_SELECTED', 'PO_PENDING', 'ON_HOLD', 'CANCELLED'],
  PO_PENDING: ['VENDOR_SELECTED', 'APPROVED', 'PO_CREATED', 'PARTIALLY_ORDERED', 'ON_HOLD', 'CANCELLED'],
  PO_CREATED: ['PARTIALLY_ORDERED', 'COMPLETED', 'ON_HOLD'],
  PARTIALLY_ORDERED: ['PO_CREATED', 'COMPLETED', 'ON_HOLD', 'CANCELLED'],
  ON_HOLD: ['PENDING_PLANNING', 'UNDER_REVIEW', 'VENDOR_SELECTED', 'APPROVED', 'PO_PENDING', 'CANCELLED'],
  CANCELLED: [],
  COMPLETED: [],
}

export function computeNetPurchaseQuantity(
  requiredQuantity: number,
  currentStockQuantity: number,
  openPurchaseOrderQuantity: number,
): number {
  return Math.max(0, requiredQuantity - currentStockQuantity - openPurchaseOrderQuantity)
}

export function computeEstimatedAmount(netPurchaseQuantity: number, expectedRate: number): number {
  return Number((netPurchaseQuantity * expectedRate).toFixed(2))
}

export function parseDateInput(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00.000Z`)
  return new Date(value)
}

export function startOfTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

export function isTerminalStatus(status: PurchasePlanningStatus): boolean {
  return TERMINAL_PLANNING_STATUSES.includes(status)
}

export function assertPlanningEditable(row: Pick<PurchasePlanningRow, 'status' | 'deletedAt'>): void {
  if (row.deletedAt) {
    throw new PlanningRowReadOnlyError(purchaseMessage(PURCHASE_ERROR_CODE.PPS_NOT_FOUND), PURCHASE_ERROR_CODE.PPS_NOT_FOUND)
  }
  if (row.status === 'PO_CREATED' || row.status === 'PARTIALLY_ORDERED') {
    throw new PlanningRowReadOnlyError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_ALREADY_CONVERTED),
      PURCHASE_ERROR_CODE.PPS_ALREADY_CONVERTED,
    )
  }
  if (isTerminalStatus(row.status)) {
    throw new PlanningRowReadOnlyError(
      row.status === 'CANCELLED'
        ? purchaseMessage(PURCHASE_ERROR_CODE.PPS_CANCELLED)
        : purchaseMessage(PURCHASE_ERROR_CODE.PPS_READ_ONLY),
      row.status === 'CANCELLED' ? PURCHASE_ERROR_CODE.PPS_CANCELLED : PURCHASE_ERROR_CODE.PPS_READ_ONLY,
    )
  }
}

export function assertCanEditCommercialFields(row: Pick<PurchasePlanningRow, 'status' | 'deletedAt'>): void {
  assertPlanningEditable(row)
}

export function assertStatusTransition(
  from: PurchasePlanningStatus,
  to: PurchasePlanningStatus,
): void {
  if (from === to) return
  const allowed = ALLOWED_TRANSITIONS[from] ?? []
  if (!allowed.includes(to)) {
    throw new PlanningInvalidTransitionError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_INVALID_TRANSITION),
    )
  }
}

export function assertBulkStatusReason(
  status: PurchasePlanningStatus,
  reason: string | null | undefined,
): string | null {
  if (status === 'CANCELLED' || status === 'ON_HOLD') {
    const trimmed = reason?.trim() ?? ''
    if (!trimmed) throw new PlanningStatusReasonRequiredError()
    return trimmed
  }
  return reason?.trim() || null
}

/** When vendor is set on an early status, promote to VENDOR_SELECTED. */
export function maybeVendorSelectedStatus(
  current: PurchasePlanningStatus,
  selectedVendorId: string | null | undefined,
): PurchasePlanningStatus | undefined {
  if (!selectedVendorId) return undefined
  if (current === 'PENDING_PLANNING' || current === 'UNDER_REVIEW') {
    return 'VENDOR_SELECTED'
  }
  return undefined
}

export type PlanningRowForPo = Pick<
  PurchasePlanningRow,
  | 'id'
  | 'tenantId'
  | 'status'
  | 'deletedAt'
  | 'selectedVendorId'
  | 'netPurchaseQuantity'
  | 'expectedRate'
  | 'negotiatedRate'
  | 'requiredDate'
  | 'itemId'
  | 'uomId'
>

/**
 * Validates a planning row is ready to convert to a purchase order.
 * Throws stable purchase error codes for FE mapping.
 */
export function assertPlanningRowReadyForPo(
  row: PlanningRowForPo,
  options?: {
    tenantId?: string
    rfqRequired?: boolean
    vendorActive?: boolean
    itemActive?: boolean
    uomActive?: boolean
    hasCommercialTerms?: boolean
  },
): void {
  if (row.deletedAt) {
    throw new PlanningNotEligibleError(purchaseMessage(PURCHASE_ERROR_CODE.PPS_NOT_FOUND), PURCHASE_ERROR_CODE.PPS_NOT_FOUND)
  }

  if (options?.rfqRequired === true) {
    throw new PlanningRfqRequiredError()
  }

  if (options?.tenantId && row.tenantId !== options.tenantId) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_TENANT_MISMATCH),
      PURCHASE_ERROR_CODE.PO_TENANT_MISMATCH,
    )
  }

  if (row.status === 'CANCELLED') {
    throw new PlanningNotEligibleError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_CANCELLED),
      PURCHASE_ERROR_CODE.PPS_CANCELLED,
    )
  }

  if (row.status === 'PO_CREATED' || row.status === 'PARTIALLY_ORDERED' || row.status === 'COMPLETED') {
    throw new PlanningNotEligibleError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED),
      PURCHASE_ERROR_CODE.PO_ALREADY_CONVERTED,
    )
  }

  if (!PO_ELIGIBLE_PLANNING_STATUSES.includes(row.status)) {
    throw new PlanningNotEligibleError()
  }

  if (!(row.selectedVendorId ?? '').trim()) {
    throw new PlanningPoNotReadyError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_VENDOR_REQUIRED),
      PURCHASE_ERROR_CODE.PPS_VENDOR_REQUIRED,
      'selectedVendorId',
    )
  }

  const netQty = Number(row.netPurchaseQuantity)
  if (!(netQty > 0)) {
    throw new PlanningPoNotReadyError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID),
      PURCHASE_ERROR_CODE.PPS_NET_QTY_INVALID,
      'netPurchaseQuantity',
    )
  }

  const rate = Number(row.negotiatedRate ?? row.expectedRate ?? 0)
  if (!(rate > 0)) {
    throw new PlanningPoNotReadyError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_RATE_REQUIRED),
      PURCHASE_ERROR_CODE.PPS_RATE_REQUIRED,
      'expectedRate',
    )
  }

  if (!row.requiredDate) {
    throw new PlanningPoNotReadyError(
      purchaseMessage(PURCHASE_ERROR_CODE.PPS_REQUIRED_DATE_REQUIRED),
      PURCHASE_ERROR_CODE.PPS_REQUIRED_DATE_REQUIRED,
      'requiredDate',
    )
  }

  if (options?.vendorActive === false) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE),
      PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE,
      [{ field: 'selectedVendorId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_VENDOR_INACTIVE) }],
    )
  }
  if (options?.itemActive === false) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE),
      PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE,
      [{ field: 'itemId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_ITEM_INACTIVE) }],
    )
  }
  if (options?.uomActive === false) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_UOM_INACTIVE),
      PURCHASE_ERROR_CODE.PO_UOM_INACTIVE,
      [{ field: 'uomId', message: purchaseMessage(PURCHASE_ERROR_CODE.PO_UOM_INACTIVE) }],
    )
  }
  if (options?.hasCommercialTerms === false) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_COMMERCIAL_TERMS_REQUIRED),
      PURCHASE_ERROR_CODE.PO_COMMERCIAL_TERMS_REQUIRED,
    )
  }
}

export function assertPlanningRowsReadyForPoCreation(
  rows: PlanningRowForPo[],
  options?: {
    tenantId?: string
    rfqRequiredByPrId?: Record<string, boolean>
  },
): void {
  if (!rows.length) {
    throw new PurchaseOrderCreationError(
      purchaseMessage(PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS),
      PURCHASE_ERROR_CODE.PO_NO_ELIGIBLE_ROWS,
    )
  }
  for (const row of rows) {
    assertPlanningRowReadyForPo(row, {
      tenantId: options?.tenantId,
      // callers may pass rfqRequired per row via extension; default undefined = skip
    })
  }
}

/** Group planning rows by selected vendor for one-PO-per-vendor creation. */
export function groupPlanningRowsByVendor<T extends { selectedVendorId: string | null | undefined }>(
  rows: T[],
): Map<string, T[]> {
  const byVendor = new Map<string, T[]>()
  for (const row of rows) {
    const vendorId = (row.selectedVendorId ?? '').trim()
    if (!vendorId) continue
    const list = byVendor.get(vendorId) ?? []
    list.push(row)
    byVendor.set(vendorId, list)
  }
  return byVendor
}

/**
 * Derive PR conversion status from planning rows after PO creation.
 * - all rows PO_CREATED / COMPLETED → CONVERTED_TO_PO
 * - some converted → PARTIALLY_CONVERTED
 * - none → leave unchanged (caller keeps APPROVED)
 */
export function derivePrConversionStatus(
  planningStatuses: Array<'PO_CREATED' | 'COMPLETED' | 'PARTIALLY_ORDERED' | string>,
): 'CONVERTED_TO_PO' | 'PARTIALLY_CONVERTED' | null {
  if (!planningStatuses.length) return null
  const converted = planningStatuses.filter((s) =>
    s === 'PO_CREATED' || s === 'COMPLETED' || s === 'PARTIALLY_ORDERED',
  )
  if (converted.length === 0) return null
  if (converted.length === planningStatuses.length) return 'CONVERTED_TO_PO'
  return 'PARTIALLY_CONVERTED'
}
