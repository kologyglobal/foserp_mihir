/**
 * Remaining returnable qty for supplier quality closure — single calculation for create validation + wizard.
 */
import { prisma } from '../../../config/prisma.js'
import { returnQty } from './purchase-return.workflow.js'

const OPEN_RETURN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'COMPLETED'] as const

export type ReturnableLine = {
  goodsReceiptLineId: string | null
  purchaseOrderLineId: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  batchNumber: string | null
  serialNumber: string | null
  rejectedQuantity: number
  alreadyReturnedQuantity: number
  remainingReturnableQuantity: number
  rate: number
}

/**
 * Rejected qty (from QI preferred, else GRN) minus open/completed returns.
 * Never returns negative remaining.
 */
export async function computeRemainingReturnable(
  tenantId: string,
  args: {
    qualityInspectionId?: string | null
    goodsReceiptId?: string | null
    excludeReturnId?: string | null
  },
): Promise<{
  lines: ReturnableLine[]
  totalRejected: number
  totalReturned: number
  totalRemaining: number
  goodsReceiptId: string | null
  qualityInspectionId: string | null
  vendorId: string | null
  purchaseOrderId: string | null
  warehouseId: string | null
  grnStatus: string | null
  closedForReturn: boolean
}> {
  let qi = args.qualityInspectionId
    ? await prisma.purchaseQualityInspection.findFirst({
        where: { id: args.qualityInspectionId, tenantId, deletedAt: null },
        include: { lines: true },
      })
    : null

  const grnId = args.goodsReceiptId ?? qi?.goodsReceiptId ?? null
  const grn = grnId
    ? await prisma.goodsReceipt.findFirst({
        where: { id: grnId, tenantId, deletedAt: null },
        include: { lines: true },
      })
    : null

  if (!qi && grnId) {
    qi = await prisma.purchaseQualityInspection.findFirst({
      where: {
        tenantId,
        deletedAt: null,
        goodsReceiptId: grnId,
        status: { in: ['REJECTED', 'PARTIALLY_ACCEPTED', 'ACCEPTED', 'CLOSED'] },
      },
      orderBy: { completedAt: 'desc' },
      include: { lines: true },
    })
  }

  const closedForReturn = Boolean(
    grn && ['CANCELLED', 'CLOSED'].includes(grn.status) && grn.status === 'CANCELLED',
  )
  // Block cancelled GRNs; CLOSED still may have returns if stock not fully returned — only CANCELLED blocks hard.
  const hardBlock = grn?.status === 'CANCELLED'

  const returns = await prisma.purchaseReturn.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: [...OPEN_RETURN_STATUSES] },
      ...(args.excludeReturnId ? { id: { not: args.excludeReturnId } } : {}),
      OR: [
        ...(qi ? [{ qualityInspectionId: qi.id }] : []),
        ...(grnId ? [{ goodsReceiptId: grnId }] : []),
      ],
    },
    include: { lines: true },
  })

  const returnedByGrnLine = new Map<string, number>()
  const returnedByPoLine = new Map<string, number>()
  for (const ret of returns) {
    for (const line of ret.lines) {
      const q = returnQty(line.returnQuantity)
      if (line.goodsReceiptLineId) {
        returnedByGrnLine.set(
          line.goodsReceiptLineId,
          (returnedByGrnLine.get(line.goodsReceiptLineId) ?? 0) + q,
        )
      } else if (line.purchaseOrderLineId) {
        returnedByPoLine.set(
          line.purchaseOrderLineId,
          (returnedByPoLine.get(line.purchaseOrderLineId) ?? 0) + q,
        )
      }
    }
  }

  const lines: ReturnableLine[] = []
  if (qi) {
    for (const ql of qi.lines) {
      const rejected = returnQty(ql.rejectedQuantity)
      if (rejected <= 0) continue
      const grnLine = ql.goodsReceiptLineId
        ? grn?.lines.find((g) => g.id === ql.goodsReceiptLineId)
        : undefined
      const already =
        (ql.goodsReceiptLineId ? returnedByGrnLine.get(ql.goodsReceiptLineId) : 0) ??
        (ql.purchaseOrderLineId ? returnedByPoLine.get(ql.purchaseOrderLineId) : 0) ??
        0
      const remaining = Math.max(0, rejected - already)
      lines.push({
        goodsReceiptLineId: ql.goodsReceiptLineId,
        purchaseOrderLineId: ql.purchaseOrderLineId,
        itemId: ql.itemId,
        itemCode: ql.itemCodeSnapshot,
        itemName: ql.itemNameSnapshot,
        batchNumber: grnLine?.batchNumber ?? null,
        serialNumber: grnLine?.serialNumber ?? null,
        rejectedQuantity: rejected,
        alreadyReturnedQuantity: already,
        remainingReturnableQuantity: remaining,
        rate: returnQty(grnLine?.rate),
      })
    }
  } else if (grn) {
    for (const gl of grn.lines) {
      const rejected = returnQty(gl.rejectedQuantity)
      if (rejected <= 0) continue
      const already = returnedByGrnLine.get(gl.id) ?? 0
      lines.push({
        goodsReceiptLineId: gl.id,
        purchaseOrderLineId: gl.purchaseOrderLineId,
        itemId: gl.itemId,
        itemCode: gl.itemCodeSnapshot,
        itemName: gl.itemNameSnapshot,
        batchNumber: gl.batchNumber,
        serialNumber: gl.serialNumber,
        rejectedQuantity: rejected,
        alreadyReturnedQuantity: already,
        remainingReturnableQuantity: Math.max(0, rejected - already),
        rate: returnQty(gl.rate),
      })
    }
  }

  const totalRejected = lines.reduce((s, l) => s + l.rejectedQuantity, 0)
  const totalReturned = lines.reduce((s, l) => s + l.alreadyReturnedQuantity, 0)
  const totalRemaining = lines.reduce((s, l) => s + l.remainingReturnableQuantity, 0)

  return {
    lines,
    totalRejected,
    totalReturned,
    totalRemaining,
    goodsReceiptId: grn?.id ?? null,
    qualityInspectionId: qi?.id ?? null,
    vendorId: qi?.vendorId ?? grn?.vendorId ?? null,
    purchaseOrderId: qi?.purchaseOrderId ?? grn?.purchaseOrderId ?? null,
    warehouseId: qi?.warehouseId ?? grn?.warehouseId ?? null,
    grnStatus: grn?.status ?? null,
    closedForReturn: hardBlock || closedForReturn,
  }
}
