import type { AuditTrail } from '../types/audit'
import type {
  GrnHeader,
  GrnLine,
  PurchaseOrder,
  PurchaseRequisition,
  RequestForQuotation,
} from '../types/purchase'
import type { QcInspection, NonConformanceReport, ReworkOrder } from '../types/quality'
import type { DispatchPlan } from '../types/dispatch'

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function defaultAuditFields(existing?: Partial<AuditTrail>): AuditTrail {
  const ts = new Date().toISOString()
  return {
    createdById: existing?.createdById ?? 'legacy',
    createdByName: existing?.createdByName ?? 'System',
    createdAt: existing?.createdAt ?? ts,
    modifiedById: existing?.modifiedById ?? null,
    modifiedByName: existing?.modifiedByName ?? null,
    modifiedAt: existing?.modifiedAt ?? null,
    approvedById: existing?.approvedById ?? null,
    approvedByName: existing?.approvedByName ?? null,
    approvedAt: existing?.approvedAt ?? null,
  }
}

export function normalizePr(pr: PurchaseRequisition): PurchaseRequisition {
  return {
    ...pr,
    ...defaultAuditFields(pr),
    source: pr.source ?? 'mrp',
    mrpRunId: pr.mrpRunId ?? null,
    salesOrderId: pr.salesOrderId ?? null,
    salesOrderNo: pr.salesOrderNo ?? null,
    workOrderId: pr.workOrderId ?? null,
    workOrderNo: pr.workOrderNo ?? null,
    purpose: pr.purpose ?? null,
    lines: pr.lines ?? [],
  }
}

export function normalizePo(po: PurchaseOrder): PurchaseOrder {
  return {
    ...po,
    ...defaultAuditFields(po),
    revisionNo: po.revisionNo ?? 1,
    rfqId: po.rfqId ?? null,
    mrpRunId: po.mrpRunId ?? null,
    salesOrderId: po.salesOrderId ?? null,
    sentAt: po.sentAt ?? null,
    revisions: po.revisions ?? [],
    lines: (po.lines ?? []).map((l) => ({
      ...l,
      receivedQty: l.receivedQty ?? 0,
      mrpMaterialLineId: l.mrpMaterialLineId ?? null,
      prLineId: l.prLineId ?? null,
    })),
  }
}

export function normalizeGrnLine(line: GrnLine): GrnLine {
  return {
    ...line,
    acceptedQty: line.acceptedQty ?? 0,
    rejectedQty: line.rejectedQty ?? 0,
    quarantineQty: line.quarantineQty ?? 0,
  }
}

export function normalizeGrn(grn: GrnHeader): GrnHeader {
  return {
    ...grn,
    ...defaultAuditFields(grn),
    qcRequired: grn.qcRequired ?? false,
    incomingInspectionId: grn.incomingInspectionId ?? null,
    excessTolerancePct: grn.excessTolerancePct ?? 5,
    lines: (grn.lines ?? []).map(normalizeGrnLine),
  }
}

export function normalizeRfq(rfq: RequestForQuotation): RequestForQuotation {
  return {
    ...rfq,
    ...defaultAuditFields(rfq),
    prId: rfq.prId ?? '',
    recommendedVendorId: rfq.recommendedVendorId ?? null,
    recommendationNote: rfq.recommendationNote ?? '',
    vendorIds: rfq.vendorIds ?? [],
    quotes: rfq.quotes ?? [],
    lines: rfq.lines ?? [],
  }
}

export function normalizeInspection(insp: QcInspection): QcInspection {
  return {
    ...insp,
    ...defaultAuditFields(insp),
    category: insp.category ?? 'in_process',
    workOrderId: insp.workOrderId ?? null,
    woNo: insp.woNo ?? null,
    grnId: insp.grnId ?? null,
    grnNo: insp.grnNo ?? null,
    poId: insp.poId ?? null,
    productionOperationId: insp.productionOperationId ?? null,
    jobCardId: insp.jobCardId ?? null,
    itemId: insp.itemId ?? null,
    itemCode: insp.itemCode ?? null,
    inspector: insp.inspector ?? null,
    inspectionDate: insp.inspectionDate ?? null,
    result: insp.result ?? null,
    remarks: insp.remarks ?? '',
    acceptedQty: insp.acceptedQty ?? null,
    rejectedQty: insp.rejectedQty ?? null,
    quarantineQty: insp.quarantineQty ?? null,
    reworkOrderId: insp.reworkOrderId ?? null,
    ncrId: insp.ncrId ?? null,
    isReinspection: insp.isReinspection ?? false,
    sourceReworkId: insp.sourceReworkId ?? null,
    planId: insp.planId ?? null,
    checklistSnapshot: (insp.checklistSnapshot ?? []).map((c) => ({
      ...c,
      sortOrder: c.sortOrder ?? 0,
      passed: c.passed ?? false,
    })),
    parameterSnapshot: insp.parameterSnapshot ?? [],
    parameterResults: (insp.parameterResults ?? []).map((r) => ({
      ...r,
      remarks: r.remarks ?? '',
      attachmentRef: r.attachmentRef ?? null,
      inspector: r.inspector ?? null,
      recordedAt: r.recordedAt ?? null,
    })),
  }
}

export function normalizeNcr(ncr: NonConformanceReport): NonConformanceReport {
  return {
    ...ncr,
    ...defaultAuditFields(ncr),
    source: ncr.source ?? 'in_process',
    workOrderId: ncr.workOrderId ?? null,
    woNo: ncr.woNo ?? null,
    grnId: ncr.grnId ?? null,
    productionOperationId: ncr.productionOperationId ?? null,
    targetClosureDate: ncr.targetClosureDate ?? null,
    closedAt: ncr.closedAt ?? null,
    closureApprovedBy: ncr.closureApprovedBy ?? null,
    rootCause: ncr.rootCause ?? '',
    correctiveAction: ncr.correctiveAction ?? '',
  }
}

export function normalizeRework(rework: ReworkOrder): ReworkOrder {
  return {
    ...rework,
    ...defaultAuditFields(rework),
    assignedTeam: rework.assignedTeam ?? null,
    actualHours: rework.actualHours ?? null,
    reinspectionId: rework.reinspectionId ?? null,
    completedAt: rework.completedAt ?? null,
  }
}

export interface PurchasePersistSlice {
  requisitions: PurchaseRequisition[]
  rfqs: RequestForQuotation[]
  purchaseOrders: PurchaseOrder[]
  grns: GrnHeader[]
  vendorQuotations?: import('../types/purchase').VendorQuotation[]
  purchaseReturns?: import('../types/purchase').PurchaseReturn[]
}

export function normalizePurchasePersisted(
  persisted: Partial<PurchasePersistSlice> | null | undefined,
): PurchasePersistSlice {
  return {
    requisitions: (persisted?.requisitions ?? []).map(normalizePr),
    rfqs: (persisted?.rfqs ?? []).map(normalizeRfq),
    purchaseOrders: (persisted?.purchaseOrders ?? []).map(normalizePo),
    grns: (persisted?.grns ?? []).map(normalizeGrn),
    vendorQuotations: persisted?.vendorQuotations ?? [],
    purchaseReturns: persisted?.purchaseReturns ?? [],
  }
}

export interface QualityPersistSlice {
  inspections: QcInspection[]
  reworks: ReworkOrder[]
  ncrs: NonConformanceReport[]
}

export function normalizeQualityPersisted(
  persisted: Partial<QualityPersistSlice> | null | undefined,
): QualityPersistSlice {
  return {
    inspections: (persisted?.inspections ?? []).map(normalizeInspection),
    reworks: (persisted?.reworks ?? []).map(normalizeRework),
    ncrs: (persisted?.ncrs ?? []).map(normalizeNcr),
  }
}

export function normalizeDispatchPersisted(dispatches: DispatchPlan[]): DispatchPlan[] {
  return dispatches.map((d) => clone(d))
}
