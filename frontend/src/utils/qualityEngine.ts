import type { WorkOrderProductionOperation } from '../types/workorder'
import type {
  NonConformanceReport,
  QcInspection,
  QualityMetrics,
  ReworkOrder,
} from '../types/quality'
import { OPEN_NCR_STATUSES, OPEN_REWORK_STATUSES } from '../types/quality'
import { getNextCode } from '../services/codeSeriesService'

export interface QualityBlocker {
  code: 'QC_HOLD' | 'OPEN_REWORK' | 'OPEN_NCR' | 'FAILED_QC'
  message: string
  entityId: string
}

export function isOperationRoutingComplete(op: WorkOrderProductionOperation): boolean {
  return op.status === 'completed' || op.status === 'skipped'
}

export function canStartOperation(
  operations: WorkOrderProductionOperation[],
  operationId: string,
): { ok: boolean; error?: string; nextBlockedBy?: WorkOrderProductionOperation } {
  const sorted = [...operations].sort((a, b) => a.sequenceNo - b.sequenceNo)
  const idx = sorted.findIndex((o) => o.id === operationId)
  if (idx < 0) return { ok: false, error: 'Operation not found' }
  if (idx === 0) return { ok: true }

  for (let i = idx - 1; i >= 0; i -= 1) {
    const prev = sorted[i]
    if (prev.outsourced) continue
    if (!isOperationRoutingComplete(prev)) {
      return {
        ok: false,
        error: `Operation ${prev.operationName} (seq ${prev.sequenceNo}) must be QC-released before starting this step`,
        nextBlockedBy: prev,
      }
    }
    break
  }
  return { ok: true }
}

export function getNextRoutingOperation(
  operations: WorkOrderProductionOperation[],
  completedOperationId: string,
): WorkOrderProductionOperation | undefined {
  const sorted = [...operations].sort((a, b) => a.sequenceNo - b.sequenceNo)
  const idx = sorted.findIndex((o) => o.id === completedOperationId)
  if (idx < 0) return undefined
  for (let i = idx + 1; i < sorted.length; i += 1) {
    if (!sorted[i].outsourced) return sorted[i]
  }
  return undefined
}

export function collectQualityBlockers(input: {
  workOrderId: string
  operations: WorkOrderProductionOperation[]
  inspections: QcInspection[]
  reworks: ReworkOrder[]
  ncrs: NonConformanceReport[]
  forFgReceipt?: boolean
}): QualityBlocker[] {
  const blockers: QualityBlocker[] = []
  const woId = input.workOrderId

  for (const op of input.operations) {
    if (op.status === 'qc_hold') {
      blockers.push({
        code: 'QC_HOLD',
        message: `${op.operationName} (seq ${op.sequenceNo}) awaiting QC decision`,
        entityId: op.id,
      })
    }
  }

  for (const rw of input.reworks.filter((r) => r.workOrderId === woId && OPEN_REWORK_STATUSES.includes(r.status))) {
    blockers.push({
      code: 'OPEN_REWORK',
      message: `Rework ${rw.reworkNo} — ${rw.operationName} (${rw.status})`,
      entityId: rw.id,
    })
  }

  for (const ncr of input.ncrs.filter((n) => n.workOrderId === woId && OPEN_NCR_STATUSES.includes(n.status))) {
    blockers.push({
      code: 'OPEN_NCR',
      message: `NCR ${ncr.ncrNo} — ${ncr.defectDescription} (${ncr.status})`,
      entityId: ncr.id,
    })
  }

  if (input.forFgReceipt) {
    for (const insp of input.inspections.filter((i) => i.workOrderId === woId && i.status === 'reject')) {
      const ncrClosed = input.ncrs.some((n) => n.inspectionId === insp.id && n.status === 'closed')
      if (!ncrClosed) {
        blockers.push({
          code: 'FAILED_QC',
          message: `Rejected inspection ${insp.inspectionNo} — NCR must be closed before FG receipt`,
          entityId: insp.id,
        })
      }
    }
  }

  return blockers
}

export function computeQualityMetrics(
  inspections: QcInspection[],
  reworks: ReworkOrder[],
  ncrs: NonConformanceReport[],
): QualityMetrics {
  const pendingInspections = inspections.filter((i) => i.status === 'pending').length
  const openRework = reworks.filter((r) => OPEN_REWORK_STATUSES.includes(r.status)).length
  const openNcr = ncrs.filter((n) => OPEN_NCR_STATUSES.includes(n.status)).length

  const firstPassCandidates = inspections.filter((i) => !i.isReinspection && i.status !== 'pending')
  const firstPass = firstPassCandidates.filter((i) => i.status === 'pass').length
  const firstPassYieldPct =
    firstPassCandidates.length > 0 ? Math.round((firstPass / firstPassCandidates.length) * 100) : 100

  const totalReworkHours = reworks.reduce((sum, r) => sum + (r.actualHours ?? 0), 0)

  const rejects = inspections.filter((i) => i.status === 'reject')
  const byMonth = new Map<string, number>()
  for (const r of rejects) {
    const d = r.inspectionDate ?? r.createdAt ?? ''
    const label = d.slice(0, 7)
    byMonth.set(label, (byMonth.get(label) ?? 0) + 1)
  }
  const defectTrend = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([label, count]) => ({ label, count }))

  const weekAgo = new Date()
  weekAgo.setDate(weekAgo.getDate() - 7)
  const ncrAgeingOver7Days = ncrs.filter((n) => {
    if (!OPEN_NCR_STATUSES.includes(n.status)) return false
    const reported = new Date(n.reportedDate)
    return !Number.isNaN(reported.getTime()) && reported < weekAgo
  }).length

  return {
    pendingInspections,
    pendingIncoming: inspections.filter((i) => i.category === 'incoming' && i.status === 'pending').length,
    openRework,
    openNcr,
    firstPassYieldPct,
    totalReworkHours,
    defectTrend,
    ncrAgeingOver7Days,
  }
}

export function nextInspectionNo(_existing: string[]): string {
  return getNextCode('qc_inspection')
}

export function nextReworkNo(_existing: string[]): string {
  return getNextCode('rework')
}

export function nextNcrNo(_existing: string[]): string {
  return getNextCode('ncr')
}
