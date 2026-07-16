import { getNextCode } from '../services/codeSeriesService'
import type { JobCard, WorkOrder, WorkOrderProductionOperation } from '../types/workorder'
import { toJobCardQcChecks } from '../types/qc'

export function nextJobCardNo(_existing: string[]): string {
  return getNextCode('job_card')
}

export function buildJobCardsFromOperations(
  wo: WorkOrder,
  operations: WorkOrderProductionOperation[],
  existingJobCardNos: string[],
  genId: (prefix: string) => string,
): JobCard[] {
  const ts = new Date().toISOString()
  const nos = [...existingJobCardNos]
  return operations.map((op) => {
    const jobCardNo = nextJobCardNo(nos)
    nos.push(jobCardNo)
    return {
      id: genId('jc'),
      jobCardNo,
      workOrderId: wo.id,
      woNo: wo.woNo,
      productionOperationId: op.id,
      sequenceNo: op.sequenceNo,
      operationName: op.operationName,
      workCenterCode: op.workCenterCode,
      assignedTeam: null,
      plannedHours: op.standardHours,
      startTime: null,
      endTime: null,
      actualHours: null,
      remarks: '',
      status: 'pending' as const,
      requiresQc: op.qcRequired,
      qcChecks: op.qcRequired && op.qcChecklist.length > 0 ? toJobCardQcChecks(op.qcChecklist) : [],
      createdAt: ts,
      updatedAt: ts,
      completedAt: null,
    }
  })
}

export const SHOP_FLOOR_TEAMS = [
  'Welding Team A',
  'Welding Team B',
  'Cutting Team',
  'Rolling Team',
  'Tank Assembly Crew',
  'Chassis Assembly Crew',
  'Running Gear Team',
  'Pneumatic Team',
  'Electrical Team',
  'Paint Shop Crew',
  'QC & Testing Team',
]
