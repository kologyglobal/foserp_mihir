import type { JobCardQcCheck } from './qc'
import type { AuditTrail } from './audit'
import type { QcParameterResult, QcParameterSnapshot } from './qcParameters'

export type QcDecisionResult = 'pass' | 'rework' | 'reject'
export type QcInspectionStatus = 'pending' | 'pass' | 'rework' | 'reject'
export type QcInspectionCategory = 'incoming' | 'in_process' | 'final' | 'subcontract_return'
export type QcPlanScope = 'item' | 'operation' | 'product'

export interface QcChecklistTemplateItem {
  id: string
  label: string
  sortOrder: number
  mandatory: boolean
}

export interface InspectionPlan {
  id: string
  planCode: string
  planName: string
  category: QcInspectionCategory
  scope: QcPlanScope
  itemId: string | null
  operationName: string | null
  productId: string | null
  checklist: QcChecklistTemplateItem[]
  isActive: boolean
}

export interface QcInspection extends AuditTrail {
  id: string
  inspectionNo: string
  category: QcInspectionCategory
  workOrderId: string | null
  woNo: string | null
  grnId: string | null
  grnNo: string | null
  poId: string | null
  productionOperationId: string | null
  operationName: string
  sequenceNo: number
  jobCardId: string | null
  vendorId: string | null
  subcontractShipmentId: string | null
  itemId: string | null
  itemCode: string | null
  inspectionType: string
  inspector: string | null
  inspectionDate: string | null
  status: QcInspectionStatus
  result: QcDecisionResult | null
  remarks: string
  checklistSnapshot: JobCardQcCheck[]
  acceptedQty: number | null
  rejectedQty: number | null
  quarantineQty: number | null
  reworkOrderId: string | null
  ncrId: string | null
  isReinspection: boolean
  sourceReworkId: string | null
  planId: string | null
  parameterSnapshot: QcParameterSnapshot[]
  parameterResults: QcParameterResult[]
}

export type ReworkOrderStatus = 'open' | 'in_progress' | 'completed' | 'reinspected' | 'closed'

export interface ReworkOrder extends AuditTrail {
  id: string
  reworkNo: string
  workOrderId: string
  woNo: string
  sourceOperationId: string
  sourceInspectionId: string
  operationName: string
  workCenterId: string
  workCenterCode: string
  assignedTeam: string | null
  estimatedHours: number
  actualHours: number | null
  status: ReworkOrderStatus
  reinspectionId: string | null
  remarks: string
  completedAt: string | null
}

export type NcrSeverity = 'minor' | 'major' | 'critical'
export type NcrSource = 'incoming' | 'in_process' | 'final' | 'customer' | 'subcontract_return'
export type NcrStatus = 'open' | 'investigating' | 'corrective_action' | 'approved' | 'closed'

export interface NonConformanceReport extends AuditTrail {
  id: string
  ncrNo: string
  source: NcrSource
  workOrderId: string | null
  woNo: string | null
  grnId: string | null
  vendorId: string | null
  subcontractShipmentId: string | null
  itemId: string
  itemCode: string
  productionOperationId: string | null
  operationName: string
  inspectionId: string
  severity: NcrSeverity
  defectDescription: string
  rootCause: string
  correctiveAction: string
  disposition: string
  materialSegregated: boolean
  engineeringReview: string
  responsiblePerson: string
  targetClosureDate: string | null
  reportedBy: string
  reportedDate: string
  status: NcrStatus
  closedAt: string | null
  closureApprovedBy: string | null
}

export interface QualityMetrics {
  pendingInspections: number
  openRework: number
  openNcr: number
  firstPassYieldPct: number
  totalReworkHours: number
  defectTrend: { label: string; count: number }[]
  pendingIncoming: number
  ncrAgeingOver7Days: number
}

export const OPEN_REWORK_STATUSES: ReworkOrderStatus[] = ['open', 'in_progress', 'completed']
export const OPEN_NCR_STATUSES: NcrStatus[] = ['open', 'investigating', 'corrective_action', 'approved']

export const FINAL_QC_CHECKLIST: QcChecklistTemplateItem[] = [
  { id: 'fqc-dim', label: 'Dimensional inspection', sortOrder: 1, mandatory: true },
  { id: 'fqc-weld', label: 'Welding inspection', sortOrder: 2, mandatory: true },
  { id: 'fqc-pneu', label: 'Pneumatic pressure test', sortOrder: 3, mandatory: true },
  { id: 'fqc-leak', label: 'Leakage test', sortOrder: 4, mandatory: true },
  { id: 'fqc-brake', label: 'Brake test', sortOrder: 5, mandatory: true },
  { id: 'fqc-paint', label: 'Paint finish', sortOrder: 6, mandatory: true },
  { id: 'fqc-road', label: 'Roadworthiness', sortOrder: 7, mandatory: true },
  { id: 'fqc-cust', label: 'Customer inspection', sortOrder: 8, mandatory: false },
]

export interface PendingInspectionRow {
  inspectionId: string
  inspectionNo: string
  category: QcInspectionCategory
  woNo: string | null
  grnNo: string | null
  itemCode: string | null
  operationName: string
  status: QcInspectionStatus
  createdAt: string
}

export interface VendorQualityRatingRow {
  vendorId: string
  vendorName: string
  grnCount: number
  rejectedQty: number
  rejectionRatePct: number
  rating: 'A' | 'B' | 'C' | 'D'
}
