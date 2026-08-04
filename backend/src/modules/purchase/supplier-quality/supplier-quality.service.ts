/**
 * Supplier quality / vendor performance KPIs — live aggregation (no duplicate master table).
 */
import { prisma } from '../../../config/prisma.js'

function n(v: unknown) {
  return Number(v) || 0
}

/** UTC calendar-day compare: on-time when GRN receipt day ≤ promised delivery day. */
export function isGrnOnTimeDelivery(receiptDate: Date, expectedDeliveryDate: Date): boolean {
  const r = Date.UTC(receiptDate.getUTCFullYear(), receiptDate.getUTCMonth(), receiptDate.getUTCDate())
  const e = Date.UTC(
    expectedDeliveryDate.getUTCFullYear(),
    expectedDeliveryDate.getUTCMonth(),
    expectedDeliveryDate.getUTCDate(),
  )
  return r <= e
}

/**
 * Prefer PO header expectedDeliveryDate; else earliest line requiredDate.
 * Returns null when neither is set (OTD sample skips that GRN).
 */
export function resolvePoExpectedDelivery(
  po:
    | {
        expectedDeliveryDate: Date | null
        lines?: Array<{ requiredDate: Date | null }>
      }
    | null
    | undefined,
): Date | null {
  if (!po) return null
  if (po.expectedDeliveryDate) return po.expectedDeliveryDate
  const dates = (po.lines ?? [])
    .map((l) => l.requiredDate)
    .filter((d): d is Date => d != null)
    .sort((a, b) => a.getTime() - b.getTime())
  return dates[0] ?? null
}

export type VendorQualityScorecard = {
  vendorId: string
  vendorCode: string | null
  vendorName: string | null
  totalDeliveries: number
  totalGrnQty: number
  acceptedQty: number
  rejectedQty: number
  returnQty: number
  replacementReturnCount: number
  inspectionPassPct: number
  averageQualityScore: number
  qualityRating: 'A' | 'B' | 'C' | 'D'
  openQiCount: number
  openReturnCount: number
  openAdjustmentCount: number
  avgInspectionTurnaroundHours: number | null
  onTimeDeliveryPct: number | null
}

export async function getVendorQualityScorecard(
  tenantId: string,
  vendorId: string,
): Promise<VendorQualityScorecard> {
  const vendor = await prisma.masterVendor.findFirst({
    where: { id: vendorId, tenantId, deletedAt: null },
    select: { id: true, code: true, name: true },
  })

  const [grns, qis, returns, adjustments] = await Promise.all([
    prisma.goodsReceipt.findMany({
      where: { tenantId, vendorId, deletedAt: null, status: { not: 'CANCELLED' } },
      include: { lines: true },
      take: 500,
    }),
    prisma.purchaseQualityInspection.findMany({
      where: { tenantId, vendorId, deletedAt: null },
      include: { lines: true },
      take: 500,
    }),
    prisma.purchaseReturn.findMany({
      where: { tenantId, vendorId, deletedAt: null, status: { not: 'CANCELLED' } },
      include: { lines: true },
      take: 500,
    }),
    prisma.vendorAdjustment.count({
      where: {
        tenantId,
        vendorId,
        status: { notIn: ['CANCELLED', 'REVERSED'] },
      },
    }).catch(() => 0),
  ])

  const poIds = [...new Set(grns.map((g) => g.purchaseOrderId).filter(Boolean))]
  const purchaseOrders =
    poIds.length > 0
      ? await prisma.purchaseOrder.findMany({
          where: { tenantId, id: { in: poIds }, deletedAt: null },
          select: {
            id: true,
            expectedDeliveryDate: true,
            lines: { select: { requiredDate: true } },
          },
        })
      : []
  const poById = new Map(purchaseOrders.map((p) => [p.id, p]))

  let totalGrnQty = 0
  let onTime = 0
  let onTimeSample = 0
  for (const g of grns) {
    for (const l of g.lines) totalGrnQty += n(l.receivedQuantity)
    const expected = resolvePoExpectedDelivery(poById.get(g.purchaseOrderId))
    if (!expected || !g.receiptDate) continue
    onTimeSample++
    if (isGrnOnTimeDelivery(g.receiptDate, expected)) onTime++
  }

  let acceptedQty = 0
  let rejectedQty = 0
  let passCount = 0
  let doneQi = 0
  const turns: number[] = []
  let openQiCount = 0

  for (const qi of qis) {
    if (['DRAFT', 'PENDING', 'IN_PROGRESS', 'DEVIATION_PENDING'].includes(qi.status)) openQiCount++
    if (!['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CLOSED'].includes(qi.status)) continue
    doneQi++
    for (const l of qi.lines) {
      acceptedQty += n(l.acceptedQuantity)
      rejectedQty += n(l.rejectedQuantity)
    }
    if (qi.status === 'ACCEPTED') passCount++
    if (qi.completedAt && qi.createdAt) {
      turns.push((qi.completedAt.getTime() - qi.createdAt.getTime()) / 3600000)
    }
  }

  let returnQty = 0
  let replacementReturnCount = 0
  let openReturnCount = 0
  for (const r of returns) {
    if (['DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED'].includes(r.status)) openReturnCount++
    if (r.returnType === 'REPLACEMENT') replacementReturnCount++
    for (const l of r.lines) returnQty += n(l.returnQuantity)
  }

  const inspected = acceptedQty + rejectedQty
  const passPct = inspected > 0 ? (acceptedQty / inspected) * 100 : doneQi > 0 ? (passCount / doneQi) * 100 : 100
  const score = Math.max(0, Math.min(100, Math.round(passPct * 10) / 10))
  const qualityRating: VendorQualityScorecard['qualityRating'] =
    score >= 95 ? 'A' : score >= 85 ? 'B' : score >= 70 ? 'C' : 'D'

  return {
    vendorId,
    vendorCode: vendor?.code ?? null,
    vendorName: vendor?.name ?? null,
    totalDeliveries: grns.length,
    totalGrnQty,
    acceptedQty,
    rejectedQty,
    returnQty,
    replacementReturnCount,
    inspectionPassPct: Math.round(passPct * 10) / 10,
    averageQualityScore: score,
    qualityRating,
    openQiCount,
    openReturnCount,
    openAdjustmentCount: adjustments,
    avgInspectionTurnaroundHours:
      turns.length > 0 ? Math.round((turns.reduce((a, b) => a + b, 0) / turns.length) * 10) / 10 : null,
    onTimeDeliveryPct: onTimeSample > 0 ? Math.round((onTime / onTimeSample) * 1000) / 10 : null,
  }
}

export async function getSupplierQualityReports(tenantId: string) {
  const [completedQi, openReturns, completedReturns, rejectedBalances] = await Promise.all([
    prisma.purchaseQualityInspection.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CLOSED'] },
      },
      include: { lines: true },
      take: 800,
    }),
    prisma.purchaseReturn.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED'] },
      },
      include: { lines: true },
      take: 300,
    }),
    prisma.purchaseReturn.findMany({
      where: { tenantId, deletedAt: null, status: 'COMPLETED' },
      include: { lines: true },
      take: 500,
    }),
    prisma.inventoryStockBalance.findMany({
      where: { tenantId, rejectedQty: { gt: 0 } },
      take: 200,
      select: { itemId: true, warehouseId: true, rejectedQty: true, onHandQty: true },
    }),
  ])

  type Row = { key: string; rejected: number; accepted: number; count: number }
  const byVendor = new Map<string, Row>()
  const byItem = new Map<string, Row>()
  for (const qi of completedQi) {
    const v = byVendor.get(qi.vendorId || 'unknown') || {
      key: qi.vendorId || 'unknown',
      rejected: 0,
      accepted: 0,
      count: 0,
    }
    v.count++
    for (const l of qi.lines) {
      v.rejected += n(l.rejectedQuantity)
      v.accepted += n(l.acceptedQuantity)
      const iKey = l.itemId || l.itemCodeSnapshot || 'unknown'
      const item = byItem.get(iKey) || { key: iKey, rejected: 0, accepted: 0, count: 0 }
      item.rejected += n(l.rejectedQuantity)
      item.accepted += n(l.acceptedQuantity)
      item.count++
      byItem.set(iKey, item)
    }
    byVendor.set(v.key, v)
  }

  const topRaw = [...byVendor.values()]
    .map((r) => ({
      vendorId: r.key,
      rejectedQty: r.rejected,
      acceptedQty: r.accepted,
      inspectionCount: r.count,
      rejectRatePct: r.accepted + r.rejected > 0 ? Math.round((r.rejected / (r.accepted + r.rejected)) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.rejectedQty - a.rejectedQty)
    .slice(0, 15)

  const mostRaw = [...byItem.values()]
    .map((r) => ({
      itemKey: r.key,
      rejectedQty: r.rejected,
      acceptedQty: r.accepted,
      rejectRatePct: r.accepted + r.rejected > 0 ? Math.round((r.rejected / (r.accepted + r.rejected)) * 1000) / 10 : 0,
      itemCode: undefined as string | undefined,
      itemName: undefined as string | undefined,
    }))
    .sort((a, b) => b.rejectedQty - a.rejectedQty)
    .slice(0, 15)

  const vendorIds = topRaw.map((r) => r.vendorId).filter((id) => id && id !== 'unknown')
  const itemIds = mostRaw.map((r) => r.itemKey).filter((id) => /^[0-9a-f-]{36}$/i.test(id))
  const [vendorRows, itemRows] = await Promise.all([
    vendorIds.length
      ? prisma.masterVendor.findMany({
          where: { tenantId, id: { in: vendorIds }, deletedAt: null },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
    itemIds.length
      ? prisma.masterItem.findMany({
          where: { tenantId, id: { in: itemIds }, deletedAt: null },
          select: { id: true, code: true, name: true },
        })
      : Promise.resolve([]),
  ])
  const vendorById = new Map(vendorRows.map((v) => [v.id, v]))
  const itemById = new Map(itemRows.map((i) => [i.id, i]))

  const topRejectedVendors = topRaw.map((r) => {
    const v = vendorById.get(r.vendorId)
    return {
      ...r,
      vendorCode: v?.code ?? null,
      vendorName: v?.name ?? null,
    }
  })

  const mostRejectedItems = mostRaw.map((r) => {
    const it = itemById.get(r.itemKey)
    return {
      itemKey: r.itemKey,
      rejectedQty: r.rejectedQty,
      acceptedQty: r.acceptedQty,
      rejectRatePct: r.rejectRatePct,
      itemCode: it?.code ?? null,
      itemName: it?.name ?? null,
    }
  })

  const replacementPending = completedReturns.filter(
    (r) => r.returnType === 'REPLACEMENT' && !r.replacementGoodsReceiptId,
  ).length

  const adjustmentsPending = await prisma.purchaseReturn.count({
    where: {
      tenantId,
      deletedAt: null,
      status: 'COMPLETED',
      accountingStatus: { in: ['NONE', 'DRAFT'] },
      returnType: { in: ['CREDIT', 'REPAIR', 'SCRAP_VENDOR'] },
    },
  })

  const rejectedStockQty = rejectedBalances.reduce((s, b) => s + n(b.rejectedQty), 0)

  return {
    generatedAt: new Date().toISOString(),
    supplierRejection: topRejectedVendors,
    mostRejectedItems,
    supplierReturns: {
      openCount: openReturns.length,
      openQty: openReturns.reduce((s, r) => s + r.lines.reduce((ls, l) => ls + n(l.returnQuantity), 0), 0),
      completedCount: completedReturns.length,
      completedQty: completedReturns.reduce(
        (s, r) => s + r.lines.reduce((ls, l) => ls + n(l.returnQuantity), 0),
        0,
      ),
    },
    replacement: {
      pendingLinkCount: replacementPending,
      replacementReturnCount: completedReturns.filter((r) => r.returnType === 'REPLACEMENT').length,
    },
    rejectedStock: {
      balanceLines: rejectedBalances.length,
      totalRejectedQty: rejectedStockQty,
    },
    pendingReturns: openReturns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      returnType: r.returnType,
      vendorId: r.vendorId,
    })),
    dashboard: {
      pendingReturns: openReturns.length,
      rejectedStockQty,
      replacementPending,
      vendorAdjustmentsPending: adjustmentsPending,
      topRejectedVendors: topRejectedVendors.slice(0, 5),
      mostRejectedItems: mostRejectedItems.slice(0, 5),
    },
  }
}

export async function getItemSupplierQualityHistory(tenantId: string, itemId: string) {
  const grnLines = await prisma.goodsReceiptLine.findMany({
    where: { tenantId, itemId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      goodsReceipt: {
        select: { id: true, grnNumber: true, status: true, receiptDate: true, vendorId: true },
      },
    },
  })
  const qiLines = await prisma.purchaseQualityInspectionLine.findMany({
    where: { tenantId, itemId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      qualityInspection: {
        select: {
          id: true,
          inspectionNumber: true,
          status: true,
          result: true,
          decisionCode: true,
          completedAt: true,
        },
      },
    },
  })
  const returnLines = await prisma.purchaseReturnLine.findMany({
    where: { tenantId, itemId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    include: {
      purchaseReturn: {
        select: {
          id: true,
          returnNumber: true,
          status: true,
          returnType: true,
          accountingStatus: true,
          vendorAdjustmentId: true,
          replacementGoodsReceiptId: true,
        },
      },
    },
  })

  type Event = { at: string; type: string; number: string; status: string; href: string; detail?: string }
  const timeline: Event[] = []
  for (const l of grnLines) {
    if (!l.goodsReceipt) continue
    timeline.push({
      at: l.goodsReceipt.receiptDate?.toISOString() ?? l.createdAt.toISOString(),
      type: 'GRN',
      number: l.goodsReceipt.grnNumber,
      status: l.goodsReceipt.status,
      href: `/purchase/grn/${l.goodsReceipt.id}`,
      detail: `Recv ${n(l.receivedQuantity)}`,
    })
  }
  for (const l of qiLines) {
    const qi = l.qualityInspection
    if (!qi) continue
    timeline.push({
      at: qi.completedAt?.toISOString() ?? l.createdAt.toISOString(),
      type: 'PURCHASE_QI',
      number: qi.inspectionNumber,
      status: qi.status,
      href: `/purchase/quality-inspections/${qi.id}`,
      detail: `${qi.decisionCode || qi.result || ''} A${n(l.acceptedQuantity)}/R${n(l.rejectedQuantity)}`,
    })
  }
  for (const l of returnLines) {
    const r = l.purchaseReturn
    if (!r) continue
    timeline.push({
      at: l.createdAt.toISOString(),
      type: 'PURCHASE_RETURN',
      number: r.returnNumber,
      status: r.status,
      href: `/purchase/returns/${r.id}`,
      detail: `${r.returnType} qty ${n(l.returnQuantity)} acct ${r.accountingStatus}`,
    })
    if (r.vendorAdjustmentId) {
      timeline.push({
        at: l.createdAt.toISOString(),
        type: 'VENDOR_ADJUSTMENT',
        number: r.vendorAdjustmentId.slice(0, 8),
        status: r.accountingStatus,
        href: `/accounting/money-out/vendor-adjustments/${r.vendorAdjustmentId}`,
        detail: 'AP handoff',
      })
    }
    if (r.replacementGoodsReceiptId) {
      timeline.push({
        at: l.createdAt.toISOString(),
        type: 'REPLACEMENT_GRN',
        number: r.replacementGoodsReceiptId.slice(0, 8),
        status: 'LINKED',
        href: `/purchase/grn/${r.replacementGoodsReceiptId}`,
      })
    }
  }
  timeline.sort((a, b) => b.at.localeCompare(a.at))
  return { itemId, timeline: timeline.slice(0, 80) }
}
