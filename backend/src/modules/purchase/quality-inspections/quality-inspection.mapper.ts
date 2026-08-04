import type {
  PurchaseQualityInspection,
  PurchaseQualityInspectionLine,
  PurchaseQualityInspectionParameter,
} from '@prisma/client'
import { qiAllowedActions, qiQty } from './quality-inspection.workflow.js'

const date = (value?: Date | null) => value?.toISOString().slice(0, 10) ?? null
const iso = (value?: Date | null) => value?.toISOString() ?? null
const numOrNull = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

export type QiEnrichment = {
  goodsReceiptNumber?: string | null
  purchaseOrderNumber?: string | null
  batchLotNo?: string | null
  /** Fill blank line item snapshots from GRN when create payload omitted them. */
  lineItemFallbacks?: Map<
    string,
    { itemId: string | null; itemCode: string; itemName: string; receivedQuantity: number }
  >
}

export function mapQualityInspection(
  qi: PurchaseQualityInspection & {
    lines: PurchaseQualityInspectionLine[]
    parameters?: PurchaseQualityInspectionParameter[]
  },
  enrichment?: QiEnrichment,
) {
  const lines = qi.lines.map((line) => {
    const fb = line.goodsReceiptLineId
      ? enrichment?.lineItemFallbacks?.get(line.goodsReceiptLineId)
      : undefined
    return {
      ...line,
      itemId: line.itemId || fb?.itemId || null,
      itemCodeSnapshot: line.itemCodeSnapshot || fb?.itemCode || '',
      itemNameSnapshot: line.itemNameSnapshot || fb?.itemName || '',
      inspectedQuantity: qiQty(line.inspectedQuantity),
      acceptedQuantity: qiQty(line.acceptedQuantity),
      rejectedQuantity: qiQty(line.rejectedQuantity),
      deviationQuantity: qiQty(line.deviationQuantity),
    }
  })

  const parameters = (qi.parameters ?? []).map((p) => ({
    id: p.id,
    parameter: p.parameterName,
    parameterCode: (p as { parameterCode?: string | null }).parameterCode ?? null,
    sourceParameterId: (p as { sourceParameterId?: string | null }).sourceParameterId ?? null,
    specification: p.specification,
    minValue: numOrNull(p.minValue),
    maxValue: numOrNull(p.maxValue),
    observedValue: numOrNull(p.observedValue),
    unit: p.unit || '',
    result: (['pass', 'fail', 'na'].includes(p.result) ? p.result : 'na') as 'pass' | 'fail' | 'na',
    remarks: p.remarks || '',
    lineNumber: p.lineNumber,
  }))

  return {
    ...qi,
    documentNumber: qi.inspectionNumber,
    documentDate: date(qi.inspectionDate),
    inspectionDate: date(qi.inspectionDate),
    inspectionPlan: qi.inspectionPlan || '',
    inspectionPlanId: (qi as { inspectionPlanId?: string | null }).inspectionPlanId ?? null,
    inspectionPlanRevisionId: (qi as { inspectionPlanRevisionId?: string | null }).inspectionPlanRevisionId ?? null,
    planCodeSnapshot: (qi as { planCodeSnapshot?: string | null }).planCodeSnapshot ?? null,
    planRevisionSnapshot: (qi as { planRevisionSnapshot?: string | null }).planRevisionSnapshot ?? null,
    result: (qi as { result?: string | null }).result ?? null,
    decisionCode: (qi as { decisionCode?: string | null }).decisionCode ?? null,
    decisionReason: (qi as { decisionReason?: string | null }).decisionReason ?? null,
    priority: (qi as { priority?: string }).priority ?? 'NORMAL',
    assignedAt: iso((qi as { assignedAt?: Date | null }).assignedAt),
    startedAt: iso((qi as { startedAt?: Date | null }).startedAt),
    completedAt: iso(qi.completedAt),
    createdAt: iso(qi.createdAt),
    updatedAt: iso(qi.updatedAt),
    goodsReceiptNumber: enrichment?.goodsReceiptNumber ?? '',
    purchaseOrderNumber: enrichment?.purchaseOrderNumber ?? '',
    batchLotNo: enrichment?.batchLotNo ?? '',
    allowedActions: qiAllowedActions(qi.status, qi.deletedAt),
    totals: lines.reduce(
      (sum, line) => ({
        inspected: sum.inspected + line.inspectedQuantity,
        accepted: sum.accepted + line.acceptedQuantity,
        rejected: sum.rejected + line.rejectedQuantity,
        deviation: sum.deviation + line.deviationQuantity,
      }),
      { inspected: 0, accepted: 0, rejected: 0, deviation: 0 },
    ),
    lines,
    parameters,
  }
}
