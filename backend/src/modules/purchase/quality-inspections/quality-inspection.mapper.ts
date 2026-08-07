import type {
  PurchaseQualityInspection,
  PurchaseQualityInspectionLine,
  PurchaseQualityInspectionParameter,
} from '@prisma/client'
import { qiAllowedActions, qiQty } from './quality-inspection.workflow.js'
import { toUomQuantity } from '../shared/uom-conversion.js'

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
    {
      itemId: string | null
      itemCode: string
      itemName: string
      receivedQuantity: number
      /** Purchase/vendor UOM code + conversion factor snapshotted on the GRN line. */
      uomCode?: string | null
      uomConversionFactor?: number
    }
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
    const inspectedQuantity = qiQty(line.inspectedQuantity)
    const acceptedQuantity = qiQty(line.acceptedQuantity)
    const rejectedQuantity = qiQty(line.rejectedQuantity)
    const deviationQuantity = qiQty(line.deviationQuantity)
    // Base (stock) qty is authoritative; purchase/vendor UOM qty is derived here
    // for display only, using the same conversion factor snapshot the GRN used —
    // never re-derived from a live item/UOM lookup.
    const uomCode = fb?.uomCode ?? null
    const uomConversionFactor = fb?.uomConversionFactor || 1
    return {
      ...line,
      itemId: line.itemId || fb?.itemId || null,
      itemCodeSnapshot: line.itemCodeSnapshot || fb?.itemCode || '',
      itemNameSnapshot: line.itemNameSnapshot || fb?.itemName || '',
      inspectedQuantity,
      acceptedQuantity,
      rejectedQuantity,
      deviationQuantity,
      uomCode,
      uomConversionFactor,
      inspectedUomQuantity: toUomQuantity(inspectedQuantity, uomConversionFactor),
      acceptedUomQuantity: toUomQuantity(acceptedQuantity, uomConversionFactor),
      rejectedUomQuantity: toUomQuantity(rejectedQuantity, uomConversionFactor),
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
    // Purchase/vendor UOM code + factor from the first line — used by the UI to
    // label the header-level "totals" (dominant case: one QI line per document).
    uomCode: lines[0]?.uomCode ?? null,
    uomConversionFactor: lines[0]?.uomConversionFactor ?? 1,
    totals: lines.reduce(
      (sum, line) => ({
        inspected: sum.inspected + line.inspectedQuantity,
        accepted: sum.accepted + line.acceptedQuantity,
        rejected: sum.rejected + line.rejectedQuantity,
        deviation: sum.deviation + line.deviationQuantity,
        inspectedUom: sum.inspectedUom + line.inspectedUomQuantity,
        acceptedUom: sum.acceptedUom + line.acceptedUomQuantity,
        rejectedUom: sum.rejectedUom + line.rejectedUomQuantity,
      }),
      { inspected: 0, accepted: 0, rejected: 0, deviation: 0, inspectedUom: 0, acceptedUom: 0, rejectedUom: 0 },
    ),
    lines,
    parameters,
  }
}
