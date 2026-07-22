import type {
  ManufacturingQualityInspection,
  QualityInspectionParameterResult,
  QualityInspectionPlan,
  QualityNcr,
} from '@prisma/client'

function dec(value: unknown): string | null {
  if (value == null) return null
  return String(value)
}

type InspectionWithExtras = ManufacturingQualityInspection & {
  parameterResults?: QualityInspectionParameterResult[]
  inspectionPlan?: Pick<QualityInspectionPlan, 'id' | 'planCode' | 'planName' | 'category' | 'status'> | null
}

export function mapInspection(row: InspectionWithExtras) {
  return {
    id: row.id,
    inspectionNumber: row.inspectionNumber,
    category: row.category,
    status: row.status,
    decision: row.decision,
    productionOrderId: row.productionOrderId,
    jobWorkOrderId: row.jobWorkOrderId,
    stageId: row.stageId,
    operationId: row.operationId,
    itemId: row.itemId,
    inspectionPlanId: row.inspectionPlanId,
    inspectionPlan: row.inspectionPlan
      ? {
          id: row.inspectionPlan.id,
          planCode: row.inspectionPlan.planCode,
          planName: row.inspectionPlan.planName,
          category: row.inspectionPlan.category,
          status: row.inspectionPlan.status,
        }
      : null,
    parameterSnapshot: row.parameterSnapshotJson ?? null,
    parameterResults: (row.parameterResults ?? []).map((r) => ({
      id: r.id,
      parameterId: r.parameterId,
      parameterCode: r.parameterCode,
      parameterName: r.parameterName,
      parameterType: r.parameterType,
      mandatory: r.mandatory,
      severity: r.severity,
      passFailRule: r.passFailRule,
      uomCode: r.uomCode,
      minValue: r.minValue != null ? Number(r.minValue) : null,
      maxValue: r.maxValue != null ? Number(r.maxValue) : null,
      targetValue: r.targetValue != null ? Number(r.targetValue) : null,
      sortOrder: r.sortOrder,
      measuredValue: r.measuredValue,
      measuredNumeric: r.measuredNumeric != null ? Number(r.measuredNumeric) : null,
      passed: r.passed,
      remarks: r.remarks,
    })),
    inspectedQty: dec(row.inspectedQty),
    acceptedQty: dec(row.acceptedQty),
    rejectedQty: dec(row.rejectedQty),
    reworkQty: dec(row.reworkQty),
    sampleQty: dec(row.sampleQty),
    conditionallyAcceptedQty: dec(row.conditionallyAcceptedQty),
    heldQty: dec(row.heldQty),
    scrapQty: dec(row.scrapQty),
    pendingQty: dec(row.pendingQty),
    stockDisposition: row.stockDisposition,
    certificateRequired: row.certificateRequired,
    certificateStatus: row.certificateStatus,
    inspectionPlanRevisionId: row.inspectionPlanRevisionId,
    planCodeSnapshot: row.planCodeSnapshot,
    planRevisionSnapshot: row.planRevisionSnapshot,
    title: row.title,
    remarks: row.remarks,
    decisionRemarks: row.decisionRemarks,
    requestedByUserId: row.requestedByUserId,
    decidedByUserId: row.decidedByUserId,
    requestedAt: row.requestedAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapNcr(row: QualityNcr) {
  return {
    id: row.id,
    ncrNumber: row.ncrNumber,
    status: row.status,
    severity: row.severity,
    title: row.title,
    description: row.description,
    productionOrderId: row.productionOrderId,
    inspectionId: row.inspectionId,
    itemId: row.itemId,
    reportedByUserId: row.reportedByUserId,
    closedByUserId: row.closedByUserId,
    closedAt: row.closedAt?.toISOString() ?? null,
    closureNotes: row.closureNotes,
    disposition: row.disposition,
    dispositionQuantity: dec(row.dispositionQuantity),
    jobWorkOrderId: row.jobWorkOrderId,
    supplierId: row.supplierId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
