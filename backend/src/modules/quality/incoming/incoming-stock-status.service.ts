/**
 * Shared stock status read model for Incoming Quality (GRN / Purchase QI / Quality Incoming / Item 360).
 * Values are derived from GRN line quantities + QI line disposition — one shape for all consumers.
 */
import { prisma } from '../../../config/prisma.js'
import { qiQty } from '../../purchase/quality-inspections/quality-inspection.workflow.js'

export type IncomingStockStatusPanel = {
  received: number
  qcHold: number
  accepted: number
  rejected: number
  deviationHold: number
  released: number
  goodsReceiptId: string | null
  goodsReceiptNumber: string | null
  qualityInspectionId: string | null
  qualityInspectionNumber: string | null
  warehouseId: string | null
  movementRefs: Array<{
    referenceType: string
    referenceNo: string | null
    quantity: number
    stockStatus: string
    createdAt: string | null
  }>
}

function emptyPanel(partial: Partial<IncomingStockStatusPanel> = {}): IncomingStockStatusPanel {
  return {
    received: 0,
    qcHold: 0,
    accepted: 0,
    rejected: 0,
    deviationHold: 0,
    released: 0,
    goodsReceiptId: null,
    goodsReceiptNumber: null,
    qualityInspectionId: null,
    qualityInspectionNumber: null,
    warehouseId: null,
    movementRefs: [],
    ...partial,
  }
}

async function movementsForRefs(
  tenantId: string,
  refs: Array<{ type: string; no: string }>,
): Promise<IncomingStockStatusPanel['movementRefs']> {
  if (!refs.length) return []
  const or = refs.map((r) => ({
    referenceType: r.type as never,
    referenceNo: r.no,
  }))
  const rows = await prisma.inventoryStockMovement.findMany({
    where: {
      tenantId,
      OR: or,
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
    select: {
      referenceType: true,
      referenceNo: true,
      quantity: true,
      stockStatus: true,
      createdAt: true,
    },
  })
  return rows.map((r) => ({
    referenceType: r.referenceType,
    referenceNo: r.referenceNo,
    quantity: Number(r.quantity) || 0,
    stockStatus: r.stockStatus,
    createdAt: r.createdAt?.toISOString() ?? null,
  }))
}

/** Build stock panel from a goods receipt (+ optional completed QI). */
export async function getStockStatusForGrn(
  tenantId: string,
  goodsReceiptId: string,
): Promise<IncomingStockStatusPanel> {
  const grn = await prisma.goodsReceipt.findFirst({
    where: { id: goodsReceiptId, tenantId, deletedAt: null },
    include: { lines: true },
  })
  if (!grn) return emptyPanel()

  const qi = await prisma.purchaseQualityInspection.findFirst({
    where: {
      tenantId,
      deletedAt: null,
      goodsReceiptId: grn.id,
      status: { notIn: ['CANCELLED'] },
    },
    orderBy: { createdAt: 'desc' },
    include: { lines: true },
  })

  const received = grn.lines.reduce((s, l) => s + (Number(l.receivedQuantity) || 0), 0)
  let accepted = grn.lines.reduce((s, l) => s + (Number(l.acceptedQuantity) || 0), 0)
  let rejected = grn.lines.reduce((s, l) => s + (Number(l.rejectedQuantity) || 0), 0)
  let deviationHold = 0

  if (qi) {
    const qiAccepted = qi.lines.reduce((s, l) => s + qiQty(l.acceptedQuantity), 0)
    const qiRejected = qi.lines.reduce((s, l) => s + qiQty(l.rejectedQuantity), 0)
    const qiDev = qi.lines.reduce((s, l) => s + qiQty(l.deviationQuantity), 0)
    if (['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CLOSED'].includes(qi.status)) {
      accepted = qiAccepted
      rejected = qiRejected
      deviationHold = qiDev
    } else if (qi.status === 'DEVIATION_PENDING') {
      deviationHold = qiDev || received
    }
  }

  const completed = grn.status === 'INVENTORY_POSTED'
    || (qi && ['ACCEPTED', 'PARTIALLY_ACCEPTED', 'REJECTED', 'CLOSED'].includes(qi.status))
  const released = completed ? accepted : 0
  const stillOnHold = Math.max(0, received - released - rejected - (completed ? deviationHold : 0))
  const qcHold =
    grn.status === 'QC_PENDING' || grn.status === 'SUBMITTED'
      ? stillOnHold || received
      : completed
        ? 0
        : stillOnHold

  const refNos: Array<{ type: string; no: string }> = [
    { type: 'GRN', no: grn.grnNumber },
  ]
  if (qi) {
    refNos.push(
      { type: 'QUALITY_RELEASE', no: qi.inspectionNumber },
      { type: 'QUALITY_REJECT', no: qi.inspectionNumber },
    )
  }

  return {
    received,
    qcHold: Math.max(0, qcHold),
    accepted,
    rejected,
    deviationHold,
    released,
    goodsReceiptId: grn.id,
    goodsReceiptNumber: grn.grnNumber,
    qualityInspectionId: qi?.id ?? null,
    qualityInspectionNumber: qi?.inspectionNumber ?? null,
    warehouseId: grn.warehouseId,
    movementRefs: await movementsForRefs(tenantId, refNos),
  }
}

export async function getStockStatusForPurchaseQi(
  tenantId: string,
  qualityInspectionId: string,
): Promise<IncomingStockStatusPanel> {
  const qi = await prisma.purchaseQualityInspection.findFirst({
    where: { id: qualityInspectionId, tenantId, deletedAt: null },
  })
  if (!qi) return emptyPanel()
  if (qi.goodsReceiptId) return getStockStatusForGrn(tenantId, qi.goodsReceiptId)

  const accepted = 0
  return emptyPanel({
    qualityInspectionId: qi.id,
    qualityInspectionNumber: qi.inspectionNumber,
    warehouseId: qi.warehouseId,
  })
}

export async function getStockStatusForItem(
  tenantId: string,
  itemId: string,
  opts?: { warehouseId?: string },
): Promise<{
  itemId: string
  qcHold: number
  unrestricted: number
  rejected: number
  recentIncoming: IncomingStockStatusPanel[]
}> {
  const balances = await prisma.inventoryStockBalance.findMany({
    where: {
      tenantId,
      itemId,
      ...(opts?.warehouseId ? { warehouseId: opts.warehouseId } : {}),
    },
    select: {
      onHandQty: true,
      qcHoldQty: true,
      rejectedQty: true,
      reservedQty: true,
      blockedQty: true,
    },
  })

  let qcHold = 0
  let unrestricted = 0
  let rejected = 0
  for (const b of balances) {
    qcHold += Number(b.qcHoldQty) || 0
    rejected += Number(b.rejectedQty) || 0
    const onHand = Number(b.onHandQty) || 0
    unrestricted += Math.max(0, onHand - (Number(b.qcHoldQty) || 0) - (Number(b.rejectedQty) || 0) - (Number(b.blockedQty) || 0))
  }

  const recentLines = await prisma.goodsReceiptLine.findMany({
    where: {
      tenantId,
      itemId,
      goodsReceipt: { deletedAt: null, tenantId },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
    select: { goodsReceiptId: true },
  })
  const grnIds = [...new Set(recentLines.map((l) => l.goodsReceiptId))]
  const recentIncoming = await Promise.all(grnIds.map((id) => getStockStatusForGrn(tenantId, id)))

  return { itemId, qcHold, unrestricted, rejected, recentIncoming }
}
