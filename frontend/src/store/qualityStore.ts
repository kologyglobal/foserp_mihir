import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { JobCard, WorkOrderProductionOperation } from '../types/workorder'
import type {
  NcrSeverity,
  NcrStatus,
  NcrSource,
  NonConformanceReport,
  PendingInspectionRow,
  QcDecisionResult,
  QcInspection,
  QualityMetrics,
  ReworkOrder,
  VendorQualityRatingRow,
} from '../types/quality'
import { FINAL_QC_CHECKLIST } from '../types/quality'
import { resolveInspectionPlan, seedInspectionPlans } from '../data/quality/inspectionPlans'
import { seedQcParameters } from '../data/quality/qcParameterMaster'
import { seedDynamicInspectionPlans } from '../data/quality/dynamicInspectionPlans'
import { loadDynamicQcParameters, stampParameterResults } from '../utils/qcInspectionFactory'
import { applyParameterEvaluation, ncrSeverityFromFailed, validateQcSubmission } from '../utils/qcDecisionEngine'
import type { QcParameterResult, DynamicInspectionPlan, InspectionPlanLine, QcParameterMaster } from '../types/qcParameters'
import { getQuarantineWarehouseId } from '../data/quality/itemQcConfig'
import { stampApproved, stampCreated, stampModified, mergeAudit } from '../utils/audit'
import { assertPermission, getSessionUser } from '../utils/permissions'
import {
  assertMatrixApproval,
  advanceApprovalStep,
  buildApprovalContext,
  isApprovalComplete,
  syncApprovalRequest,
} from '../utils/approvalEngine'
import { useApprovalStore } from './approvalStore'
import { nextDocumentNo } from '../utils/documentNumbers'
import { useInventoryStore } from './inventoryStore'
import { useMasterStore } from './masterStore'
import { usePurchaseStore } from './purchaseStore'
import { resolveInspectionType } from '../data/quality/inspectionTypes'
import {
  collectQualityBlockers,
  computeQualityMetrics,
  getNextRoutingOperation,
  nextInspectionNo,
  nextNcrNo,
  nextReworkNo,
} from '../utils/qualityEngine'
import { erpStorage, ERP_PERSIST_VERSION, ERP_STORAGE_KEYS } from './persistConfig'
import { normalizeQualityPersisted, normalizeInspection, type QualityPersistSlice } from '../utils/documentNormalize'
import { useWorkOrderStore } from './workOrderStore'
import { registerQualityStore } from './storeBridge'
import { moveFromWipOnOperationComplete } from '../utils/woWipActions'
import { syncQrFromInspection, onGrnQcAccepted } from '../utils/qrIntegration'

function genId(prefix: string) {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`
}

function ts() {
  return new Date().toISOString()
}

interface QualityState {
  inspections: QcInspection[]
  reworks: ReworkOrder[]
  ncrs: NonConformanceReport[]
  qcParameters: QcParameterMaster[]
  dynamicInspectionPlans: DynamicInspectionPlan[]

  getInspection: (id: string) => QcInspection | undefined
  getInspectionsForWo: (woId: string) => QcInspection[]
  getPendingInspections: () => QcInspection[]
  getRework: (id: string) => ReworkOrder | undefined
  getOpenReworks: () => ReworkOrder[]
  getNcr: (id: string) => NonConformanceReport | undefined
  getOpenNcrs: () => NonConformanceReport[]
  getMetrics: () => QualityMetrics
  getWoQualityBlockers: (woId: string, forFgReceipt?: boolean) => ReturnType<typeof collectQualityBlockers>

  createPendingInspection: (input: {
    workOrderId: string
    woNo: string
    jobCard: JobCard
    operation: WorkOrderProductionOperation
    isReinspection?: boolean
    sourceReworkId?: string
  }) => string

  recordInspectionDecision: (
    inspectionId: string,
    input: {
      inspector: string
      result: QcDecisionResult
      remarks: string
      reworkWorkCenterId?: string
      reworkEstimatedHours?: number
      ncrSeverity?: NcrSeverity
      ncrDefectDescription?: string
      materialSegregated?: boolean
      parameterResults?: QcParameterResult[]
      useAutoDecision?: boolean
    },
  ) => { ok: boolean; error?: string; reworkId?: string; ncrId?: string }

  startRework: (reworkId: string, input: { assignedTeam: string }) => { ok: boolean; error?: string }
  completeRework: (reworkId: string, input: { actualHours: number; remarks: string }) => { ok: boolean; error?: string }

  updateNcr: (
    ncrId: string,
    input: Partial<
      Pick<
        NonConformanceReport,
        'rootCause' | 'correctiveAction' | 'disposition' | 'engineeringReview' | 'materialSegregated' | 'severity'
      >
    >,
  ) => void
  advanceNcrStatus: (ncrId: string, status: NcrStatus) => { ok: boolean; error?: string }
  closeNcr: (ncrId: string, closureApprovedBy?: string) => { ok: boolean; error?: string }
  approveNcrClosure: (ncrId: string) => { ok: boolean; error?: string; pendingNextApprover?: string }

  recordFinalQcDecision: (
    inspectionId: string,
    input: {
      inspector: string
      result: QcDecisionResult
      remarks: string
      parameterResults?: QcParameterResult[]
      useAutoDecision?: boolean
      adminOverrideReason?: string
    },
  ) => { ok: boolean; error?: string }

  createIncomingInspection: (input: {
    grnId: string
    grnNo: string
    poId: string
    vendorId: string
    lines: { itemId: string; receivedQty: number; warehouseId: string }[]
  }) => string

  createSubcontractReturnInspection: (input: {
    workOrderId: string
    woNo: string
    vendorId: string
    subcontractShipmentId: string
    itemId: string
    itemCode: string
    qty: number
  }) => string

  createSubcontractReturnNcr: (input: {
    workOrderId: string
    woNo: string
    vendorId: string
    subcontractShipmentId: string
    itemId: string
    itemCode: string
    rejectedQty: number
    remarks: string
    reportedBy: string
  }) => { ok: boolean; error?: string; ncrId?: string }

  recordIncomingQcDecision: (
    inspectionId: string,
    input: {
      inspector: string
      result: QcDecisionResult
      remarks: string
      acceptedQty: number
      rejectedQty: number
      quarantineQty?: number
      parameterResults?: QcParameterResult[]
      useAutoDecision?: boolean
    },
  ) => { ok: boolean; error?: string }

  getQcParameterMaster: () => QcParameterMaster[]
  getDynamicInspectionPlans: () => DynamicInspectionPlan[]
  getQcParameter: (id: string) => QcParameterMaster | undefined

  addQcParameter: (input: Omit<QcParameterMaster, 'id' | 'active'> & { id?: string }) => { ok: boolean; error?: string; id?: string }
  updateQcParameter: (id: string, patch: Partial<QcParameterMaster>) => { ok: boolean; error?: string }
  deactivateQcParameter: (id: string) => { ok: boolean; error?: string }

  addInspectionPlan: (input: Omit<DynamicInspectionPlan, 'id' | 'lines'> & { lines?: InspectionPlanLine[] }) => { ok: boolean; error?: string; id?: string }
  updateInspectionPlan: (id: string, patch: Partial<Omit<DynamicInspectionPlan, 'id' | 'lines'>>) => { ok: boolean; error?: string }
  addPlanLine: (planId: string, line: Omit<InspectionPlanLine, 'id' | 'planId'>) => { ok: boolean; error?: string }
  removePlanLine: (planId: string, lineId: string) => { ok: boolean; error?: string }
  updatePlanLine: (planId: string, lineId: string, patch: Partial<InspectionPlanLine>) => { ok: boolean; error?: string }
  activateInspectionPlan: (planId: string) => { ok: boolean; error?: string }
  deactivateInspectionPlan: (planId: string) => { ok: boolean; error?: string }

  createFinalInspection: (workOrderId: string) => { ok: boolean; error?: string; inspectionId?: string }
  hasFinalQcPassed: (workOrderId: string) => boolean
  getInspectionPlans: () => typeof seedInspectionPlans
  getPendingInspectionReport: () => PendingInspectionRow[]
  getRejectionReport: () => { inspectionNo: string; itemCode: string; rejectedQty: number; date: string }[]
  getNcrAgeingReport: () => NonConformanceReport[]
  getVendorQualityRating: () => VendorQualityRatingRow[]
}

function announceNextOperationReleased(woId: string, completedOperationId: string) {
  const ops = useWorkOrderStore.getState().getProductionOperations(woId)
  const next = getNextRoutingOperation(ops, completedOperationId)
  if (!next) return

  useWorkOrderStore.setState((s) => ({
    activities: [
      {
        id: genId('act'),
        workOrderId: woId,
        action: 'Next Operation Released',
        details: `Seq ${next.sequenceNo} ${next.operationName} (${next.workCenterCode}) — available after QC release`,
        createdAt: ts(),
        createdBy: 'Quality',
      },
      ...s.activities,
    ],
  }))
}

function releaseProductionOperation(productionOperationId: string, woId: string, details: string) {
  useWorkOrderStore.setState((s) => ({
    productionOperations: s.productionOperations.map((o) =>
      o.id === productionOperationId ? { ...o, status: 'completed' as const } : o,
    ),
    activities: [
      {
        id: genId('act'),
        workOrderId: woId,
        action: 'QC Released',
        details,
        createdAt: ts(),
        createdBy: 'Quality',
      },
      ...s.activities,
    ],
  }))
}

function reopenProductionOperation(productionOperationId: string, woId: string, details: string) {
  useWorkOrderStore.setState((s) => ({
    productionOperations: s.productionOperations.map((o) =>
      o.id === productionOperationId ? { ...o, status: 'in_progress' as const } : o,
    ),
    activities: [
      {
        id: genId('act'),
        workOrderId: woId,
        action: 'Rework Started',
        details,
        createdAt: ts(),
        createdBy: 'Quality',
      },
      ...s.activities,
    ],
  }))
}

function holdProductionOperation(productionOperationId: string, woId: string, details: string) {
  useWorkOrderStore.setState((s) => ({
    productionOperations: s.productionOperations.map((o) =>
      o.id === productionOperationId ? { ...o, status: 'qc_hold' as const } : o,
    ),
    activities: [
      {
        id: genId('act'),
        workOrderId: woId,
        action: 'QC Hold',
        details,
        createdAt: ts(),
        createdBy: 'Quality',
      },
      ...s.activities,
    ],
  }))
}

export const useQualityStore = create<QualityState>()(
  persist(
    (set, get) => ({
      inspections: [],
      reworks: [],
      ncrs: [],
      qcParameters: seedQcParameters.map((p) => ({ ...p, active: p.active ?? true })),
      dynamicInspectionPlans: seedDynamicInspectionPlans.map((p) => ({
        ...p,
        lines: p.lines.map((l) => ({ ...l })),
      })),

      getInspection: (id) => {
        const insp = get().inspections.find((i) => i.id === id)
        return insp ? normalizeInspection(insp) : undefined
      },
      getInspectionsForWo: (woId) => get().inspections.filter((i) => i.workOrderId === woId),
      getPendingInspections: () => get().inspections.filter((i) => i.status === 'pending'),
      getRework: (id) => get().reworks.find((r) => r.id === id),
      getOpenReworks: () => get().reworks.filter((r) => r.status !== 'closed' && r.status !== 'reinspected'),
      getNcr: (id) => get().ncrs.find((n) => n.id === id),
      getOpenNcrs: () => get().ncrs.filter((n) => n.status !== 'closed'),
      getMetrics: () => computeQualityMetrics(get().inspections, get().reworks, get().ncrs),
      getWoQualityBlockers: (woId, forFgReceipt) => {
        const wo = useWorkOrderStore.getState().getWorkOrder(woId)
        const ops = wo ? useWorkOrderStore.getState().getProductionOperations(woId) : []
        return collectQualityBlockers({
          workOrderId: woId,
          operations: ops,
          inspections: get().inspections,
          reworks: get().reworks,
          ncrs: get().ncrs,
          forFgReceipt,
        })
      },

      createPendingInspection: (input) => {
        const audit = stampCreated()
        const id = genId('qci')
        const inspectionNo = nextInspectionNo(get().inspections.map((i) => i.inspectionNo))
        const wo = useWorkOrderStore.getState().getWorkOrder(input.workOrderId)
        const dynamic = loadDynamicQcParameters({
          category: 'in_process',
          productId: wo?.productId,
          operationName: input.operation.operationName,
          workCenterId: input.operation.workCenterId,
        })
        const inspection: QcInspection = {
          id,
          inspectionNo,
          category: 'in_process',
          workOrderId: input.workOrderId,
          woNo: input.woNo,
          grnId: null,
          grnNo: null,
          poId: null,
          productionOperationId: input.operation.id,
          operationName: input.operation.operationName,
          sequenceNo: input.operation.sequenceNo,
          jobCardId: input.jobCard.id,
          vendorId: null,
          subcontractShipmentId: null,
          itemId: null,
          itemCode: null,
          inspectionType: dynamic.plan?.planName ?? resolveInspectionType(input.operation.operationName),
          inspector: null,
          inspectionDate: null,
          status: 'pending',
          result: null,
          remarks: '',
          checklistSnapshot: [...input.jobCard.qcChecks],
          acceptedQty: null,
          rejectedQty: null,
          quarantineQty: null,
          reworkOrderId: null,
          ncrId: null,
          isReinspection: input.isReinspection ?? false,
          sourceReworkId: input.sourceReworkId ?? null,
          planId: dynamic.plan?.id ?? resolveInspectionPlan({ category: 'in_process', operationName: input.operation.operationName })?.id ?? null,
          parameterSnapshot: dynamic.parameterSnapshot,
          parameterResults: dynamic.parameterResults,
          ...audit,
        }
        set((s) => ({ inspections: [inspection, ...s.inspections] }))
        return id
      },

      recordInspectionDecision: (inspectionId, input) => {
        const inspection = get().getInspection(inspectionId)
        if (!inspection) return { ok: false, error: 'Inspection not found' }
        if (inspection.status !== 'pending') return { ok: false, error: 'Inspection already decided' }
        if (!input.inspector.trim()) return { ok: false, error: 'Inspector is required' }
        if (inspection.category === 'incoming') {
          return { ok: false, error: 'Use recordIncomingQcDecision for incoming inspections' }
        }
        if (inspection.category === 'final') {
          return get().recordFinalQcDecision(inspectionId, input)
        }

        let effectiveResult = input.result
        let stampedResults: QcParameterResult[] | undefined
        if (inspection.parameterSnapshot.length > 0) {
          const results = input.parameterResults ?? inspection.parameterResults
          if (!results.length) return { ok: false, error: 'Parameter results required' }
          const validation = validateQcSubmission(results)
          if (!validation.ok) return { ok: false, error: validation.errors.join('; ') }
          effectiveResult = input.useAutoDecision !== false ? validation.autoDecision! : input.result
          stampedResults = stampParameterResults(applyParameterEvaluation(results), input.inspector)
          if (input.useAutoDecision !== false && validation.failedParameters.length > 0) {
            input = {
              ...input,
              ncrSeverity: ncrSeverityFromFailed(validation.failedParameters) as NcrSeverity,
              ncrDefectDescription:
                input.ncrDefectDescription ||
                validation.failedParameters.map((f) => f.parameterName).join(', '),
            }
          }
        }

        const now = ts()
        const workOrderId = inspection.workOrderId!
        const productionOperationId = inspection.productionOperationId!
        const wo = useWorkOrderStore.getState().getWorkOrder(workOrderId)
        if (!wo) return { ok: false, error: 'Work order not found' }

        if (effectiveResult === 'pass') {
          set((s) => ({
            inspections: s.inspections.map((i) =>
              i.id === inspectionId
                ? {
                    ...i,
                    status: 'pass' as const,
                    result: 'pass' as const,
                    inspector: input.inspector,
                    inspectionDate: now,
                    remarks: input.remarks,
                    parameterResults: stampedResults ?? i.parameterResults,
                    updatedAt: now,
                  }
                : i,
            ),
          }))

          releaseProductionOperation(
            productionOperationId,
            workOrderId,
            `${inspection.inspectionNo} — PASS · ${inspection.operationName} · ${input.remarks || 'No remarks'}`,
          )
          moveFromWipOnOperationComplete(workOrderId, productionOperationId)
          announceNextOperationReleased(workOrderId, productionOperationId)

          if (inspection.sourceReworkId) {
            set((s) => ({
              reworks: s.reworks.map((r) =>
                r.id === inspection.sourceReworkId
                  ? {
                      ...r,
                      status: 'closed' as const,
                      reinspectionId: inspectionId,
                      updatedAt: ts(),
                    }
                  : r,
              ),
            }))
          }

          syncQrFromInspection(inspection, 'pass')
          return { ok: true }
        }

        if (effectiveResult === 'rework') {
          const estHours = input.reworkEstimatedHours ?? 4
          const op = useWorkOrderStore
            .getState()
            .getProductionOperations(workOrderId)
            .find((o) => o.id === productionOperationId)
          const workCenterId = input.reworkWorkCenterId ?? op?.workCenterId ?? ''
          const workCenterCode = op?.workCenterCode ?? '—'

          const reworkId = genId('rwk')
          const reworkNo = nextReworkNo(get().reworks.map((r) => r.reworkNo))
          const rework: ReworkOrder = {
            id: reworkId,
            reworkNo,
            workOrderId,
            woNo: inspection.woNo ?? wo.woNo,
            sourceOperationId: productionOperationId,
            sourceInspectionId: inspectionId,
            operationName: inspection.operationName,
            workCenterId,
            workCenterCode,
            assignedTeam: null,
            estimatedHours: estHours,
            actualHours: null,
            status: 'open',
            reinspectionId: null,
            remarks: input.remarks,
            completedAt: null,
            ...stampCreated(),
          }

          set((s) => ({
            inspections: s.inspections.map((i) =>
              i.id === inspectionId
                ? {
                    ...i,
                    status: 'rework' as const,
                    result: 'rework' as const,
                    inspector: input.inspector,
                    inspectionDate: now,
                    remarks: input.remarks,
                    reworkOrderId: reworkId,
                    parameterResults: stampedResults ?? i.parameterResults,
                    updatedAt: now,
                  }
                : i,
            ),
            reworks: [rework, ...s.reworks],
          }))

          reopenProductionOperation(
            productionOperationId,
            workOrderId,
            `${inspection.inspectionNo} — REWORK · ${reworkNo} created`,
          )
          return { ok: true, reworkId }
        }

        // REJECT
        const severity = input.ncrSeverity ?? 'major'
        const defect = input.ncrDefectDescription?.trim() || input.remarks.trim() || 'Quality rejection — see inspection remarks'
        const ncrId = genId('ncr')
        const ncrNo = nextNcrNo(get().ncrs.map((n) => n.ncrNo))
        const ncr: NonConformanceReport = {
          id: ncrId,
          ncrNo,
          source: 'in_process' as NcrSource,
          workOrderId,
          woNo: inspection.woNo ?? wo.woNo,
          grnId: null,
          vendorId: null,
          subcontractShipmentId: null,
          itemId: wo.outputItemId,
          itemCode: wo.outputItemCode,
          productionOperationId,
          operationName: inspection.operationName,
          inspectionId,
          severity,
          defectDescription: defect,
          rootCause: '',
          correctiveAction: '',
          disposition: 'Material segregated — pending engineering review',
          materialSegregated: input.materialSegregated ?? true,
          engineeringReview: '',
          responsiblePerson: input.inspector,
          targetClosureDate: null,
          reportedBy: input.inspector,
          reportedDate: now.slice(0, 10),
          status: 'open',
          closedAt: null,
          closureApprovedBy: null,
          ...stampCreated(),
        }

        set((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === inspectionId
              ? {
                  ...i,
                  status: 'reject' as const,
                  result: 'reject' as const,
                  inspector: input.inspector,
                  inspectionDate: now,
                  remarks: input.remarks,
                  ncrId,
                  parameterResults: stampedResults ?? i.parameterResults,
                  updatedAt: now,
                }
              : i,
          ),
          ncrs: [ncr, ...s.ncrs],
        }))

        holdProductionOperation(
          productionOperationId,
          workOrderId,
          `${inspection.inspectionNo} — REJECT · ${ncrNo} raised · WO blocked`,
        )
        syncQrFromInspection(inspection, 'reject', ncrNo)
        return { ok: true, ncrId }
      },

      startRework: (reworkId, input) => {
        const rework = get().getRework(reworkId)
        if (!rework) return { ok: false, error: 'Rework order not found' }
        if (rework.status !== 'open') return { ok: false, error: 'Rework must be open to start' }
        if (!input.assignedTeam.trim()) return { ok: false, error: 'Assigned team is required' }

        const now = ts()
        set((s) => ({
          reworks: s.reworks.map((r) =>
            r.id === reworkId
              ? { ...r, status: 'in_progress' as const, assignedTeam: input.assignedTeam, updatedAt: now }
              : r,
          ),
        }))
        return { ok: true }
      },

      completeRework: (reworkId, input) => {
        const rework = get().getRework(reworkId)
        if (!rework) return { ok: false, error: 'Rework order not found' }
        if (rework.status !== 'in_progress') return { ok: false, error: 'Rework must be in progress to complete' }
        if (input.actualHours <= 0) return { ok: false, error: 'Actual hours must be greater than zero' }

        const now = ts()
        const op = useWorkOrderStore
          .getState()
          .getProductionOperations(rework.workOrderId)
          .find((o) => o.id === rework.sourceOperationId)
        const wo = useWorkOrderStore.getState().getWorkOrder(rework.workOrderId)
        if (!op || !wo) return { ok: false, error: 'Source operation not found' }

        const reinspectionId = get().createPendingInspection({
          workOrderId: rework.workOrderId,
          woNo: rework.woNo,
          jobCard: {
            id: rework.sourceInspectionId,
            jobCardNo: rework.reworkNo,
            workOrderId: rework.workOrderId,
            woNo: rework.woNo,
            productionOperationId: rework.sourceOperationId,
            sequenceNo: op.sequenceNo,
            operationName: rework.operationName,
            workCenterCode: rework.workCenterCode,
            assignedTeam: rework.assignedTeam,
            plannedHours: rework.estimatedHours,
            startTime: null,
            endTime: null,
            actualHours: input.actualHours,
            remarks: input.remarks,
            status: 'completed',
            requiresQc: true,
            qcChecks: [],
            createdAt: now,
            updatedAt: now,
            completedAt: now,
          },
          operation: op,
          isReinspection: true,
          sourceReworkId: reworkId,
        })

        holdProductionOperation(
          rework.sourceOperationId,
          rework.workOrderId,
          `${rework.reworkNo} completed — re-inspection ${reinspectionId} queued`,
        )

        set((s) => ({
          reworks: s.reworks.map((r) =>
            r.id === reworkId
              ? {
                  ...r,
                  status: 'completed' as const,
                  actualHours: input.actualHours,
                  remarks: input.remarks,
                  reinspectionId,
                  completedAt: now,
                  updatedAt: now,
                }
              : r,
          ),
        }))
        return { ok: true }
      },

      updateNcr: (ncrId, input) => {
        const now = ts()
        set((s) => ({
          ncrs: s.ncrs.map((n) => (n.id === ncrId ? { ...n, ...input, updatedAt: now } : n)),
        }))
      },

      advanceNcrStatus: (ncrId, status) => {
        const ncr = get().getNcr(ncrId)
        if (!ncr) return { ok: false, error: 'NCR not found' }
        const now = ts()
        set((s) => ({
          ncrs: s.ncrs.map((n) => (n.id === ncrId ? { ...n, status, updatedAt: now } : n)),
        }))
        return { ok: true }
      },

      closeNcr: (ncrId, closureApprovedBy) => {
        const perm = assertPermission('quality', 'close')
        if (!perm.ok) return perm
        const ncr = get().getNcr(ncrId)
        if (!ncr) return { ok: false, error: 'NCR not found' }
        if (ncr.status !== 'approved') return { ok: false, error: 'NCR must be approved before closure' }
        if (!ncr.rootCause.trim() || !ncr.correctiveAction.trim()) {
          return { ok: false, error: 'Root cause and corrective action required before closing NCR' }
        }
        if (ncr.severity === 'critical') {
          let request = useApprovalStore.getState().getActiveRequest('ncr_closure', ncrId)
          if (!request) {
            syncApprovalRequest({
              documentType: 'ncr_closure',
              entityId: ncrId,
              entityLabel: ncr.ncrNo,
              context: buildApprovalContext('ncr_closure', { severity: ncr.severity }),
              submittedByName: getSessionUser().name,
            })
            request = useApprovalStore.getState().getActiveRequest('ncr_closure', ncrId)
          }
          if (!isApprovalComplete(request)) {
            return { ok: false, error: 'Critical NCR closure requires Quality Head approval first' }
          }
        }
        const approver = closureApprovedBy ?? stampApproved().approvedByName!
        const now = ts()
        set((s) => ({
          ncrs: s.ncrs.map((n) =>
            n.id === ncrId
              ? mergeAudit(n, {
                  ...stampModified(n),
                  status: 'closed' as const,
                  closedAt: now,
                  closureApprovedBy: approver,
                })
              : n,
          ),
        }))
        return { ok: true }
      },

      approveNcrClosure: (ncrId) => {
        const perm = assertPermission('quality', 'approve')
        if (!perm.ok) return perm
        const user = getSessionUser()
        const matrixCheck = assertMatrixApproval('ncr_closure', ncrId, user)
        if (!matrixCheck.ok) return matrixCheck
        return advanceApprovalStep('ncr_closure', ncrId, user)
      },

      createIncomingInspection: (input) => {
        const audit = stampCreated()
        const master = useMasterStore.getState()
        const firstLine = input.lines[0]
        const item = master.getItem(firstLine.itemId)
        const dynamic = loadDynamicQcParameters({
          category: 'incoming',
          itemId: firstLine.itemId,
          itemCategoryId: item?.categoryId,
        })
        const legacyPlan = resolveInspectionPlan({ category: 'incoming', itemId: firstLine.itemId })
        const id = genId('qci')
        const inspectionNo = nextDocumentNo('QC-', get().inspections.map((i) => i.inspectionNo))
        const inspection: QcInspection = {
          id,
          inspectionNo,
          category: 'incoming',
          workOrderId: null,
          woNo: null,
          grnId: input.grnId,
          grnNo: input.grnNo,
          poId: input.poId,
          productionOperationId: null,
          operationName: 'Incoming Material QC',
          sequenceNo: 0,
          jobCardId: null,
          vendorId: input.vendorId,
          subcontractShipmentId: null,
          itemId: firstLine.itemId,
          itemCode: item?.itemCode ?? null,
          inspectionType: dynamic.plan?.planName ?? legacyPlan?.planName ?? 'Incoming QC',
          inspector: null,
          inspectionDate: null,
          status: 'pending',
          result: null,
          remarks: '',
          checklistSnapshot: (legacyPlan?.checklist ?? []).map((c) => ({
            id: c.id,
            label: c.label,
            sortOrder: c.sortOrder,
            passed: false,
          })),
          acceptedQty: null,
          rejectedQty: null,
          quarantineQty: null,
          reworkOrderId: null,
          ncrId: null,
          isReinspection: false,
          sourceReworkId: null,
          planId: dynamic.plan?.id ?? legacyPlan?.id ?? null,
          parameterSnapshot: dynamic.parameterSnapshot,
          parameterResults: dynamic.parameterResults,
          ...audit,
        }
        set((s) => ({ inspections: [inspection, ...s.inspections] }))
        return id
      },

      createSubcontractReturnInspection: (input) => {
        const audit = stampCreated()
        const id = genId('qci')
        const inspectionNo = nextInspectionNo(get().inspections.map((i) => i.inspectionNo))
        const dynamic = loadDynamicQcParameters({ category: 'subcontract_return', itemId: input.itemId })
        const inspection: QcInspection = {
          id,
          inspectionNo,
          category: 'subcontract_return',
          workOrderId: input.workOrderId,
          woNo: input.woNo,
          grnId: null,
          grnNo: null,
          poId: null,
          productionOperationId: null,
          operationName: 'Subcontract Return QC',
          sequenceNo: 0,
          jobCardId: null,
          vendorId: input.vendorId,
          subcontractShipmentId: input.subcontractShipmentId,
          itemId: input.itemId,
          itemCode: input.itemCode,
          inspectionType: dynamic.plan?.planName ?? 'Subcontract Return',
          inspector: null,
          inspectionDate: null,
          status: 'pending',
          result: null,
          remarks: `Pending QC on ${input.qty} qty subcontract return`,
          checklistSnapshot: [],
          parameterSnapshot: dynamic.parameterSnapshot,
          parameterResults: dynamic.parameterResults,
          acceptedQty: input.qty,
          rejectedQty: null,
          quarantineQty: null,
          reworkOrderId: null,
          ncrId: null,
          isReinspection: false,
          sourceReworkId: null,
          planId: dynamic.plan?.id ?? null,
          ...audit,
        }
        set((s) => ({ inspections: [inspection, ...s.inspections] }))
        return id
      },

      createSubcontractReturnNcr: (input) => {
        const now = ts()
        const inspectionId = genId('qci')
        const inspectionNo = nextInspectionNo(get().inspections.map((i) => i.inspectionNo))
        const inspection: QcInspection = {
          id: inspectionId,
          inspectionNo,
          category: 'subcontract_return',
          workOrderId: input.workOrderId,
          woNo: input.woNo,
          grnId: null,
          grnNo: null,
          poId: null,
          productionOperationId: null,
          operationName: 'Subcontract Return QC',
          sequenceNo: 0,
          jobCardId: null,
          vendorId: input.vendorId,
          subcontractShipmentId: input.subcontractShipmentId,
          itemId: input.itemId,
          itemCode: input.itemCode,
          inspectionType: 'Subcontract Return',
          inspector: input.reportedBy,
          inspectionDate: now,
          status: 'reject',
          result: 'reject',
          remarks: input.remarks,
          checklistSnapshot: [],
          parameterSnapshot: [],
          parameterResults: [],
          acceptedQty: 0,
          rejectedQty: input.rejectedQty,
          quarantineQty: input.rejectedQty,
          reworkOrderId: null,
          ncrId: null,
          isReinspection: false,
          sourceReworkId: null,
          planId: null,
          ...stampCreated(),
        }

        const ncrId = genId('ncr')
        const ncrNo = nextNcrNo(get().ncrs.map((n) => n.ncrNo))
        const ncr: NonConformanceReport = {
          id: ncrId,
          ncrNo,
          source: 'subcontract_return' as NcrSource,
          workOrderId: input.workOrderId,
          woNo: input.woNo,
          grnId: null,
          vendorId: input.vendorId,
          subcontractShipmentId: input.subcontractShipmentId,
          itemId: input.itemId,
          itemCode: input.itemCode,
          productionOperationId: null,
          operationName: 'Subcontract Return',
          inspectionId,
          severity: 'major',
          defectDescription: input.remarks,
          rootCause: '',
          correctiveAction: '',
          disposition: 'Material segregated — vendor return rejection',
          materialSegregated: true,
          engineeringReview: '',
          responsiblePerson: input.reportedBy,
          targetClosureDate: null,
          reportedBy: input.reportedBy,
          reportedDate: now.slice(0, 10),
          status: 'open',
          closedAt: null,
          closureApprovedBy: null,
          ...stampCreated(),
        }

        inspection.ncrId = ncrId
        set((s) => ({
          inspections: [inspection, ...s.inspections],
          ncrs: [ncr, ...s.ncrs],
        }))
        return { ok: true, ncrId }
      },

      recordIncomingQcDecision: (inspectionId, input) => {
        const perm = assertPermission('quality', 'post')
        if (!perm.ok) return perm
        const inspection = get().getInspection(inspectionId)
        if (!inspection || inspection.category !== 'incoming') return { ok: false, error: 'Incoming inspection not found' }
        if (inspection.status !== 'pending') return { ok: false, error: 'Already decided' }
        const grn = usePurchaseStore.getState().getGrn(inspection.grnId!)
        if (!grn) return { ok: false, error: 'GRN not found' }

        let effectiveResult = input.result
        let stampedResults: QcParameterResult[] | undefined
        if (inspection.parameterSnapshot.length > 0) {
          const results = input.parameterResults ?? inspection.parameterResults
          if (!results.length) return { ok: false, error: 'Parameter results required' }
          const validation = validateQcSubmission(results)
          if (!validation.ok) return { ok: false, error: validation.errors.join('; ') }
          if (input.useAutoDecision !== false) {
            effectiveResult = validation.autoDecision === 'reject' ? 'reject' : 'pass'
          }
          stampedResults = stampParameterResults(applyParameterEvaluation(results), input.inspector)
        }

        const quarantineWh = getQuarantineWarehouseId()
        const inv = useInventoryStore.getState()
        const now = ts()

        if (effectiveResult === 'pass' && input.acceptedQty > 0) {
          for (const line of grn.lines) {
            const transferQty = Math.min(input.acceptedQty, line.quarantineQty)
            if (transferQty <= 0) continue
            const r = inv.postStockTransfer({
              itemId: line.itemId,
              fromWarehouseId: quarantineWh,
              warehouseId: line.warehouseId,
              qty: transferQty,
              rate: line.rate,
              referenceNo: grn.grnNo,
              remarks: `Incoming QC release — ${inspection.inspectionNo}`,
            })
            if (!r.ok) return { ok: false, error: r.error }
          }
        }

        if (effectiveResult === 'reject' || input.rejectedQty > 0) {
          const ncrId = genId('ncr')
          const ncrNo = nextNcrNo(get().ncrs.map((n) => n.ncrNo))
          const ncr: NonConformanceReport = {
            id: ncrId,
            ncrNo,
            source: 'incoming',
            workOrderId: null,
            woNo: null,
            grnId: grn.id,
            vendorId: null,
            subcontractShipmentId: null,
            itemId: inspection.itemId!,
            itemCode: inspection.itemCode ?? '—',
            productionOperationId: null,
            operationName: 'Incoming QC',
            inspectionId,
            severity: 'major',
            defectDescription: input.remarks || 'Incoming material rejected',
            rootCause: '',
            correctiveAction: '',
            disposition: 'Quarantine — rejected material',
            materialSegregated: true,
            engineeringReview: '',
            responsiblePerson: input.inspector,
            targetClosureDate: null,
            reportedBy: input.inspector,
            reportedDate: now.slice(0, 10),
            status: 'open',
            closedAt: null,
            closureApprovedBy: null,
            ...stampCreated(),
          }
          set((s) => ({ ncrs: [ncr, ...s.ncrs] }))
        }

        usePurchaseStore.setState((s) => ({
          grns: s.grns.map((g) =>
            g.id === grn.id
              ? mergeAudit(g, {
                  ...stampModified(g),
                  status: 'posted' as const,
                  lines: g.lines.map((l) => ({
                    ...l,
                    acceptedQty: input.acceptedQty,
                    rejectedQty: input.rejectedQty,
                    quarantineQty: input.quarantineQty ?? l.quarantineQty,
                  })),
                })
              : g,
          ),
        }))

        set((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === inspectionId
              ? mergeAudit(i, {
                  ...stampModified(i),
                  status: effectiveResult === 'pass' ? ('pass' as const) : ('reject' as const),
                  result: effectiveResult,
                  inspector: input.inspector,
                  inspectionDate: now,
                  remarks: input.remarks,
                  acceptedQty: input.acceptedQty,
                  rejectedQty: input.rejectedQty,
                  quarantineQty: input.quarantineQty ?? 0,
                  parameterResults: stampedResults ?? i.parameterResults,
                })
              : i,
          ),
        }))
        syncQrFromInspection(inspection, effectiveResult === 'pass' ? 'pass' : 'reject', inspection.inspectionNo)
        if (effectiveResult === 'pass') onGrnQcAccepted(grn.id)
        return { ok: true }
      },

      createFinalInspection: (workOrderId) => {
        const wo = useWorkOrderStore.getState().getWorkOrder(workOrderId)
        if (!wo || wo.woType !== 'finished_goods') return { ok: false, error: 'FG work order required' }
        if (get().inspections.some((i) => i.category === 'final' && i.workOrderId === workOrderId)) {
          return { ok: false, error: 'Final QC already exists for this WO' }
        }
        const master = useMasterStore.getState()
        const product = master.products.find((p) => p.fgItemId === wo.outputItemId)
        const dynamic = loadDynamicQcParameters({
          category: 'final',
          productId: product?.id,
          itemId: wo.outputItemId,
        })
        const legacyPlan = resolveInspectionPlan({ category: 'final', productId: product?.id })
        const audit = stampCreated()
        const id = genId('qci')
        const inspection: QcInspection = {
          id,
          inspectionNo: nextDocumentNo('QC-', get().inspections.map((i) => i.inspectionNo)),
          category: 'final',
          workOrderId,
          woNo: wo.woNo,
          grnId: null,
          grnNo: null,
          poId: null,
          productionOperationId: null,
          operationName: 'Final FG QC',
          sequenceNo: 999,
          jobCardId: null,
          vendorId: null,
          subcontractShipmentId: null,
          itemId: wo.outputItemId,
          itemCode: wo.outputItemCode,
          inspectionType: dynamic.plan?.planName ?? 'Final QC — Pre-Dispatch',
          inspector: null,
          inspectionDate: null,
          status: 'pending',
          result: null,
          remarks: '',
          checklistSnapshot: dynamic.parameterSnapshot.length
            ? []
            : (legacyPlan?.checklist ?? FINAL_QC_CHECKLIST).map((c) => ({
                id: c.id,
                label: c.label,
                sortOrder: c.sortOrder,
                passed: false,
              })),
          parameterSnapshot: dynamic.parameterSnapshot,
          parameterResults: dynamic.parameterResults,
          acceptedQty: null,
          rejectedQty: null,
          quarantineQty: null,
          reworkOrderId: null,
          ncrId: null,
          isReinspection: false,
          sourceReworkId: null,
          planId: dynamic.plan?.id ?? legacyPlan?.id ?? null,
          ...audit,
        }
        set((s) => ({ inspections: [inspection, ...s.inspections] }))
        return { ok: true, inspectionId: id }
      },

      hasFinalQcPassed: (workOrderId) =>
        get().inspections.some(
          (i) => i.category === 'final' && i.workOrderId === workOrderId && i.status === 'pass',
        ),

      getInspectionPlans: () => seedInspectionPlans,
      getQcParameterMaster: () => get().qcParameters.filter((p) => p.active !== false),
      getDynamicInspectionPlans: () => get().dynamicInspectionPlans,
      getQcParameter: (id) => get().qcParameters.find((p) => p.id === id),

      addQcParameter: (input) => {
        const perm = assertPermission('quality', 'create')
        if (!perm.ok) return perm
        if (get().qcParameters.some((p) => p.parameterCode === input.parameterCode)) {
          return { ok: false, error: 'Parameter code already exists' }
        }
        const id = input.id ?? genId('qcp')
        const param: QcParameterMaster = { ...input, id, active: true }
        set((s) => ({ qcParameters: [...s.qcParameters, param] }))
        return { ok: true, id }
      },

      updateQcParameter: (id, patch) => {
        const perm = assertPermission('quality', 'edit')
        if (!perm.ok) return perm
        const exists = get().qcParameters.some((p) => p.id === id)
        if (!exists) return { ok: false, error: 'Parameter not found' }
        set((s) => ({
          qcParameters: s.qcParameters.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }))
        return { ok: true }
      },

      deactivateQcParameter: (id) => {
        const perm = assertPermission('quality', 'edit')
        if (!perm.ok) return perm
        set((s) => ({
          qcParameters: s.qcParameters.map((p) => (p.id === id ? { ...p, active: false } : p)),
        }))
        return { ok: true }
      },

      addInspectionPlan: (input) => {
        const perm = assertPermission('quality', 'create')
        if (!perm.ok) return perm
        const id = genId('plan')
        const plan: DynamicInspectionPlan = {
          ...input,
          id,
          lines: (input.lines ?? []).map((l, i) => ({
            ...l,
            id: l.id ?? genId('pln'),
            planId: id,
            sortOrder: l.sortOrder ?? (i + 1) * 10,
          })),
        }
        set((s) => ({ dynamicInspectionPlans: [...s.dynamicInspectionPlans, plan] }))
        return { ok: true, id }
      },

      updateInspectionPlan: (id, patch) => {
        const perm = assertPermission('quality', 'edit')
        if (!perm.ok) return perm
        set((s) => ({
          dynamicInspectionPlans: s.dynamicInspectionPlans.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }))
        return { ok: true }
      },

      addPlanLine: (planId, line) => {
        const perm = assertPermission('quality', 'edit')
        if (!perm.ok) return perm
        const plan = get().dynamicInspectionPlans.find((p) => p.id === planId)
        if (!plan) return { ok: false, error: 'Plan not found' }
        const newLine: InspectionPlanLine = {
          ...line,
          id: genId('pln'),
          planId,
          sortOrder: line.sortOrder ?? (plan.lines.length + 1) * 10,
        }
        set((s) => ({
          dynamicInspectionPlans: s.dynamicInspectionPlans.map((p) =>
            p.id === planId ? { ...p, lines: [...p.lines, newLine] } : p,
          ),
        }))
        return { ok: true }
      },

      removePlanLine: (planId, lineId) => {
        const perm = assertPermission('quality', 'edit')
        if (!perm.ok) return perm
        set((s) => ({
          dynamicInspectionPlans: s.dynamicInspectionPlans.map((p) =>
            p.id === planId ? { ...p, lines: p.lines.filter((l) => l.id !== lineId) } : p,
          ),
        }))
        return { ok: true }
      },

      updatePlanLine: (planId, lineId, patch) => {
        const perm = assertPermission('quality', 'edit')
        if (!perm.ok) return perm
        set((s) => ({
          dynamicInspectionPlans: s.dynamicInspectionPlans.map((p) =>
            p.id === planId
              ? { ...p, lines: p.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) }
              : p,
          ),
        }))
        return { ok: true }
      },

      activateInspectionPlan: (planId) => get().updateInspectionPlan(planId, { status: 'active' }),
      deactivateInspectionPlan: (planId) => get().updateInspectionPlan(planId, { status: 'inactive' }),

      getPendingInspectionReport: () =>
        get()
          .inspections.filter((i) => i.status === 'pending')
          .map((i) => ({
            inspectionId: i.id,
            inspectionNo: i.inspectionNo,
            category: i.category,
            woNo: i.woNo,
            grnNo: i.grnNo,
            itemCode: i.itemCode,
            operationName: i.operationName,
            status: i.status,
            createdAt: i.createdAt,
          })),

      getRejectionReport: () =>
        get()
          .inspections.filter((i) => i.status === 'reject')
          .map((i) => ({
            inspectionNo: i.inspectionNo,
            itemCode: i.itemCode ?? '—',
            rejectedQty: i.rejectedQty ?? 0,
            date: i.inspectionDate ?? i.createdAt,
          })),

      getNcrAgeingReport: () => {
        const cutoff = Date.now() - 7 * 86400000
        return get().ncrs.filter(
          (n) => n.status !== 'closed' && new Date(n.createdAt).getTime() < cutoff,
        )
      },

      getVendorQualityRating: () => {
        const master = useMasterStore.getState()
        const byVendor = new Map<string, { grn: number; rejected: number }>()
        for (const i of get().inspections.filter((x) => x.category === 'incoming')) {
          const grn = usePurchaseStore.getState().getGrn(i.grnId ?? '')
          if (!grn) continue
          const v = byVendor.get(grn.vendorId) ?? { grn: 0, rejected: 0 }
          v.grn++
          v.rejected += i.rejectedQty ?? 0
          byVendor.set(grn.vendorId, v)
        }
        return [...byVendor.entries()].map(([vendorId, stats]) => {
          const rate = stats.grn > 0 ? (stats.rejected / stats.grn) * 100 : 0
          return {
            vendorId,
            vendorName: master.vendors.find((v) => v.id === vendorId)?.vendorName ?? vendorId,
            grnCount: stats.grn,
            rejectedQty: stats.rejected,
            rejectionRatePct: Math.round(rate * 10) / 10,
            rating: rate < 2 ? 'A' : rate < 5 ? 'B' : rate < 10 ? 'C' : ('D' as const),
          }
        })
      },

      recordFinalQcDecision: (inspectionId, input) => {
        const perm = assertPermission('quality', 'approve')
        if (!perm.ok) return perm
        const inspection = get().getInspection(inspectionId)
        if (!inspection || inspection.category !== 'final') return { ok: false, error: 'Final inspection not found' }
        if (inspection.status !== 'pending') return { ok: false, error: 'Already decided' }
        if (!input.inspector.trim()) return { ok: false, error: 'Inspector is required' }

        const now = ts()
        let stampedResults: QcParameterResult[] | undefined

        if (input.result === 'pass') {
          if (inspection.parameterSnapshot.length === 0 && !input.adminOverrideReason?.trim()) {
            return {
              ok: false,
              error: 'Inspection plan required — no parameters loaded. Provide admin override reason to pass without plan.',
            }
          }
          if (inspection.parameterSnapshot.length > 0) {
            const results = input.parameterResults ?? inspection.parameterResults
            const validation = validateQcSubmission(results)
            if (!validation.ok) return { ok: false, error: validation.errors.join('; ') }
            if (input.useAutoDecision !== false && validation.autoDecision !== 'pass') {
              return { ok: false, error: 'Cannot pass final QC — one or more parameters failed' }
            }
            stampedResults = stampParameterResults(applyParameterEvaluation(results), input.inspector)
          }
        }

        set((s) => ({
          inspections: s.inspections.map((i) =>
            i.id === inspectionId
              ? mergeAudit(i, {
                  ...stampModified(i),
                  ...stampApproved(),
                  status: input.result === 'pass' ? ('pass' as const) : ('reject' as const),
                  result: input.result,
                  inspector: input.inspector,
                  inspectionDate: now,
                  remarks: input.adminOverrideReason
                    ? `${input.remarks} [Override: ${input.adminOverrideReason}]`
                    : input.remarks,
                  parameterResults: stampedResults ?? i.parameterResults,
                })
              : i,
          ),
        }))
        syncQrFromInspection(
          inspection,
          input.result === 'pass' ? 'pass' : 'reject',
          input.result === 'reject' ? inspection.inspectionNo : undefined,
        )
        return { ok: true }
      },
    }),
    {
      name: ERP_STORAGE_KEYS.quality,
      storage: erpStorage,
      version: ERP_PERSIST_VERSION,
      partialize: (s) => ({
        inspections: s.inspections,
        reworks: s.reworks,
        ncrs: s.ncrs,
        qcParameters: s.qcParameters,
        dynamicInspectionPlans: s.dynamicInspectionPlans,
      }),
      merge: (persisted, current) => {
        const normalized = normalizeQualityPersisted(persisted as Partial<QualityPersistSlice> | undefined)
        return { ...current, ...normalized }
      },
    },
  ),
)

registerQualityStore(() => useQualityStore.getState())

export function assertWoCanComplete(woId: string): { ok: boolean; error?: string } {
  const blockers = useQualityStore.getState().getWoQualityBlockers(woId)
  if (blockers.length === 0) return { ok: true }
  return { ok: false, error: blockers.map((b) => b.message).join('; ') }
}

export function assertWoCanReceiveFg(woId: string): { ok: boolean; error?: string } {
  const blockers = useQualityStore.getState().getWoQualityBlockers(woId, true)
  if (blockers.length === 0) return { ok: true }
  return { ok: false, error: blockers.map((b) => b.message).join('; ') }
}
