import type { QcChecklistItem } from './qc'

export type RoutingStatus = 'draft' | 'submitted' | 'approved' | 'released' | 'obsolete'

export interface RoutingHeader {
  id: string
  routingNo: string
  productId: string
  revision: string
  description: string
  status: RoutingStatus
  previousRevisionId: string | null
  effectiveFrom: string
  totalStdHours: number
  approvedBy: string | null
  approvedAt: string | null
  submittedAt: string | null
  submittedBy: string | null
  createdAt: string
  updatedAt: string
}

export interface RoutingOperation {
  id: string
  routingHeaderId: string
  operationCode: string
  sequenceNo: number
  operationName: string
  workCenterId: string
  standardHours: number
  setupTimeHours: number
  runTimeHours: number
  laborRequirement: number
  qcRequired: boolean
  outsourced: boolean
  sortOrder: number
  qcChecklist: QcChecklistItem[]
}

export interface RoutingOperationEnriched extends RoutingOperation {
  workCenterCode: string
  workCenterName: string
}

/** Production consumes Released routing only */
export const ROUTING_ELIGIBLE_STATUSES: RoutingStatus[] = ['released']
