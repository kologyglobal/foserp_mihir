/**
 * Incoming quality operational reports (ageing, rejection rates, turnaround, NCR by supplier, returns).
 */
import { prisma } from '../../../config/prisma.js'

function qty(v: unknown) {
  return Number(v) || 0
}

export async function getIncomingQualityReports(tenantId: string) {
  const [openQi, completedQi, ncrs, returns, grnQcPending] = await Promise.all([
    prisma.purchaseQualityInspection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'] },
      },
      include: { lines: true },
      take: 500,
    }),
    prisma.purchaseQualityInspection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CLOSED'] },
        completedAt: { not: null },
      },
      include: { lines: true },
      orderBy: { completedAt: 'desc' },
      take: 500,
    }),
    prisma.qualityNcr.findMany({
      where: { tenantId, sourceType: 'PURCHASE_QI' },
      take: 500,
    }),
    prisma.purchaseReturn.findMany({
      where: { tenantId, deletedAt: null, qualityInspectionId: { not: null } },
      include: { lines: true },
      take: 300,
    }),
    prisma.goodsReceipt.findMany({
      where: { tenantId, deletedAt: null, status: 'QC_PENDING' },
      include: { lines: true },
      take: 200,
    }),
  ])

  const now = Date.now()
  const ageingBuckets = { '0-1': 0, '2-3': 0, '4-7': 0, '8+': 0 }
  let qcHoldStock = 0
  for (const qi of openQi) {
    const base = qi.startedAt ?? qi.assignedAt ?? qi.createdAt
    const days = Math.max(0, Math.floor((now - base.getTime()) / 86400000))
    if (days <= 1) ageingBuckets['0-1']++
    else if (days <= 3) ageingBuckets['2-3']++
    else if (days <= 7) ageingBuckets['4-7']++
    else ageingBuckets['8+']++
    for (const l of qi.lines) qcHoldStock += qty(l.inspectedQuantity) - qty(l.acceptedQuantity) - qty(l.rejectedQuantity)
  }
  for (const grn of grnQcPending) {
    for (const l of grn.lines) qcHoldStock += qty(l.receivedQuantity)
  }

  type Rate = { key: string; inspected: number; rejected: number; ratePct: number }
  const byVendor = new Map<string, Rate>()
  const byItem = new Map<string, Rate>()
  const turnarounds: number[] = []

  for (const qi of completedQi) {
    const inspected = qi.lines.reduce((s, l) => s + qty(l.inspectedQuantity), 0)
    const rejected = qi.lines.reduce((s, l) => s + qty(l.rejectedQuantity), 0)
    const vKey = qi.vendorId || 'unknown'
    const v = byVendor.get(vKey) || { key: vKey, inspected: 0, rejected: 0, ratePct: 0 }
    v.inspected += inspected
    v.rejected += rejected
    byVendor.set(vKey, v)

    for (const l of qi.lines) {
      const iKey = l.itemId || l.itemCodeSnapshot || 'unknown'
      const row = byItem.get(iKey) || { key: iKey, inspected: 0, rejected: 0, ratePct: 0 }
      row.inspected += qty(l.inspectedQuantity)
      row.rejected += qty(l.rejectedQuantity)
      byItem.set(iKey, row)
    }

    if (qi.completedAt && qi.createdAt) {
      turnarounds.push((qi.completedAt.getTime() - qi.createdAt.getTime()) / 3600000)
    }
  }

  const finalize = (m: Map<string, Rate>) =>
    [...m.values()]
      .map((r) => ({
        ...r,
        ratePct: r.inspected > 0 ? Math.round((r.rejected / r.inspected) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.ratePct - a.ratePct)
      .slice(0, 20)

  const avgTurnaroundHours =
    turnarounds.length > 0
      ? Math.round((turnarounds.reduce((a, b) => a + b, 0) / turnarounds.length) * 10) / 10
      : null

  const ncrBySupplier = new Map<string, number>()
  for (const n of ncrs) {
    const k = n.supplierId || 'unknown'
    ncrBySupplier.set(k, (ncrBySupplier.get(k) || 0) + 1)
  }

  return {
    generatedAt: new Date().toISOString(),
    ageing: ageingBuckets,
    qcHoldStock,
    vendorRejectionRate: finalize(byVendor),
    itemRejectionRate: finalize(byItem),
    avgTurnaroundHours,
    turnaroundSampleSize: turnarounds.length,
    ncrBySupplier: [...ncrBySupplier.entries()]
      .map(([supplierId, count]) => ({ supplierId, count }))
      .sort((a, b) => b.count - a.count),
    purchaseReturnsFromRejection: {
      count: returns.length,
      quantity: returns.reduce(
        (s, r) => s + r.lines.reduce((ls, l) => ls + qty(l.returnQuantity), 0),
        0,
      ),
    },
    openInspectionCount: openQi.length,
    completedSampleCount: completedQi.length,
    grnQcPendingCount: grnQcPending.length,
  }
}
