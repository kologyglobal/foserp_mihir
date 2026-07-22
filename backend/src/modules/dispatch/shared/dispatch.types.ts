import type { DispatchReadinessStatus, DispatchRequirementStatus } from '@prisma/client'

export type DispatchBlockerSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'BLOCKER'

export interface DispatchBlocker {
  code: string
  message: string
  severity: DispatchBlockerSeverity
  primary?: boolean
}

export interface SalesOrderLineFulfilmentPosition {
  salesOrderId: string
  salesOrderNo: string
  salesOrderStatus: string
  salesOrderLineId: string
  lineNo: number
  customerId: string
  customerName: string | null
  shipToKey: string | null
  shipToAddress: string | null
  productId: string | null
  itemId: string | null
  itemCode: string | null
  itemName: string | null
  productOrItem: string
  uom: string
  orderedQty: number
  cancelledQty: number
  netOrderedQty: number
  grossPostedDispatchQty: number
  reversedDispatchQty: number
  netDispatchedQty: number
  activeDraftDispatchQty: number
  reservedQty: number
  pickedQty: number
  packedQty: number
  remainingToDispatchQty: number
  unrestrictedFgOnHand: number
  qualityHoldQty: number
  availableToDispatchQty: number
  readyQty: number
  shortageQty: number
  requestedDeliveryDate: string | null
  committedDeliveryDate: string | null
  overdueDays: number | null
  fulfilmentStatus: string
  readinessStatus: DispatchReadinessStatus
  primaryBlockerCode: string | null
  blockers: DispatchBlocker[]
  warnings: string[]
  allowedActions: string[]
  sourceFingerprint: string
  linkedProductionDemandIds: string[]
  linkedWorkOrderIds: string[]
  linkedFgReceiptIds: string[]
  linkedInspectionIds: string[]
  linkedDispatchIds: string[]
}

export interface DispatchRequirementListItem {
  id: string
  requirementNumber: string
  salesOrderId: string
  salesOrderNo: string
  salesOrderLineId: string
  lineNo: number
  customerId: string
  customerName: string | null
  shipToKey: string | null
  shipToAddress: string | null
  itemId: string | null
  itemCode: string | null
  itemName: string | null
  productOrItem: string
  orderedQty: number
  cancelledQty: number
  netDispatchedQty: number
  remainingQty: number
  unrestrictedFgOnHand: number
  qualityHoldQty: number
  readyQty: number
  shortageQty: number
  requestedDeliveryDate: string | null
  overdueDays: number | null
  readinessStatus: DispatchReadinessStatus
  status: DispatchRequirementStatus
  primaryBlockerCode: string | null
  currentDraftDispatchQuantity: number
  priority: string
  allowedActions: string[]
  sourceFingerprint: string
  lastCalculatedAt: string | null
}

export interface DispatchWorkbenchSummary {
  readyToDispatch: number
  waitingForProduction: number
  waitingForQuality: number
  waitingForStock: number
  overdue: number
  blocked: number
  draftDispatches: number
  allActiveRequirements: number
  activeReservations?: number
  openPickLists?: number
  inProgressPickLists?: number
  openShortages?: number
  readyToPack?: number
  packingInProgress?: number
  packedSessions?: number
  packingShortages?: number
  readyForChallan?: number
  challanDrafts?: number
  challanInReview?: number
  challansIssued?: number
  readyForDispatch?: number
  challanBlocked?: number
}
