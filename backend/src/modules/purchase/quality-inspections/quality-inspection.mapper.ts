import type { PurchaseQualityInspection, PurchaseQualityInspectionLine } from '@prisma/client'
import { qiAllowedActions, qiQty } from './quality-inspection.workflow.js'
const date = (value?: Date | null) => value?.toISOString().slice(0, 10) ?? null
const iso = (value?: Date | null) => value?.toISOString() ?? null
export function mapQualityInspection(qi: PurchaseQualityInspection & { lines: PurchaseQualityInspectionLine[] }) {
  return {
    ...qi, documentNumber: qi.inspectionNumber, documentDate: date(qi.inspectionDate),
    inspectionDate: date(qi.inspectionDate), completedAt: iso(qi.completedAt),
    createdAt: iso(qi.createdAt), updatedAt: iso(qi.updatedAt),
    allowedActions: qiAllowedActions(qi.status, qi.deletedAt),
    totals: qi.lines.reduce((sum, line) => ({
      inspected: sum.inspected + qiQty(line.inspectedQuantity),
      accepted: sum.accepted + qiQty(line.acceptedQuantity),
      rejected: sum.rejected + qiQty(line.rejectedQuantity),
      deviation: sum.deviation + qiQty(line.deviationQuantity),
    }), { inspected: 0, accepted: 0, rejected: 0, deviation: 0 }),
    lines: qi.lines.map((line) => ({
      ...line, inspectedQuantity: qiQty(line.inspectedQuantity), acceptedQuantity: qiQty(line.acceptedQuantity),
      rejectedQuantity: qiQty(line.rejectedQuantity), deviationQuantity: qiQty(line.deviationQuantity),
    })),
  }
}
