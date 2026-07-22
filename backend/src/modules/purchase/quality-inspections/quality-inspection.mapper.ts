import type { QualityInspection, QualityInspectionLine } from '@prisma/client'
import { qiAllowedActions, qiQty } from './quality-inspection.workflow.js'

const date = (value?: Date | null) => value?.toISOString().slice(0, 10) ?? null
const iso = (value?: Date | null) => value?.toISOString() ?? null

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
  qi: QualityInspection & { lines: QualityInspectionLine[] },
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

  return {
    ...qi,
    documentNumber: qi.inspectionNumber,
    documentDate: date(qi.inspectionDate),
    inspectionDate: date(qi.inspectionDate),
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
  }
}
