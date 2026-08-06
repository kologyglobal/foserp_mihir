/**
 * Remaining returnable qty for supplier quality closure — single calculation for create validation + wizard.
 */
import { prisma } from '../../../config/prisma.js'
import { returnQty } from './purchase-return.workflow.js'

const OPEN_RETURN_STATUSES = ['DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'COMPLETED'] as const

const POSTED_RETURN_STATUSES = new Set([
  'INVENTORY_POSTED',
  'PARTIALLY_ACCEPTED',
  'FULLY_ACCEPTED',
  'SUBMITTED',
  'RECEIVING_COMPLETED',
])

export type ReturnableLine = {
  goodsReceiptLineId: string | null
  purchaseOrderLineId: string | null
  itemId: string | null
  itemCode: string
  itemName: string
  batchNumber: string | null
  serialNumber: string | null
  /** Total qty eligible for return on this line (rejected or accepted stock). */
  eligibleQuantity: number
  /** @deprecated use eligibleQuantity — kept for API compat */
  rejectedQuantity: number
  alreadyReturnedQuantity: number
  remainingReturnableQuantity: number
  /** rejected = QI/GRN reject bucket; accepted = posted unrestricted stock */
  returnSource: 'rejected' | 'accepted'
  rate: number
  uomId: string | null
  uomCode: string | null
  uomConversionFactor: number
  receivedUomQuantity: number
  receivedQuantity: number
}

function lineReturnCap(
  grnStatus: string | undefined,
  inspectionRequired: boolean,
  rejected: number,
  accepted: number,
  received: number,
  hasQi: boolean,
): { cap: number; source: 'rejected' | 'accepted' } {
  if (rejected > 0 && (hasQi || grnStatus === 'QC_PENDING' || grnStatus === 'PARTIALLY_ACCEPTED')) {
    return { cap: rejected, source: 'rejected' }
  }
  if (grnStatus && POSTED_RETURN_STATUSES.has(grnStatus)) {
    const cap = accepted > 0 ? accepted : received
    if (cap > 0) return { cap, source: 'accepted' }
  }
  if (rejected > 0) return { cap: rejected, source: 'rejected' }
  return { cap: 0, source: 'rejected' }
}

/**
 * Rejected or accepted qty (from QI / GRN) minus open/completed returns.
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

  const hardBlock = grn?.status === 'REVERSED' || grn?.status === 'CANCELLED'

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
  const seenGrnLineIds = new Set<string>()

  const pushLine = (input: {
    goodsReceiptLineId: string | null
    purchaseOrderLineId: string | null
    itemId: string | null
    itemCode: string
    itemName: string
    batchNumber: string | null
    serialNumber: string | null
    cap: number
    source: 'rejected' | 'accepted'
    rate: number
    uomId: string | null
    uomCode: string | null
    uomConversionFactor: number
    receivedUomQuantity: number
    receivedQuantity: number
  }) => {
    if (input.cap <= 0) return
    const already =
      (input.goodsReceiptLineId ? returnedByGrnLine.get(input.goodsReceiptLineId) : 0) ??
      (input.purchaseOrderLineId ? returnedByPoLine.get(input.purchaseOrderLineId) : 0) ??
      0
    const remaining = Math.max(0, input.cap - already)
    lines.push({
      goodsReceiptLineId: input.goodsReceiptLineId,
      purchaseOrderLineId: input.purchaseOrderLineId,
      itemId: input.itemId,
      itemCode: input.itemCode,
      itemName: input.itemName,
      batchNumber: input.batchNumber,
      serialNumber: input.serialNumber,
      eligibleQuantity: input.cap,
      rejectedQuantity: input.cap,
      alreadyReturnedQuantity: already,
      remainingReturnableQuantity: remaining,
      returnSource: input.source,
      rate: input.rate,
      uomId: input.uomId,
      uomCode: input.uomCode,
      uomConversionFactor: input.uomConversionFactor,
      receivedUomQuantity: input.receivedUomQuantity,
      receivedQuantity: input.receivedQuantity,
    })
  }

  if (qi) {
    for (const ql of qi.lines) {
      const rejected = returnQty(ql.rejectedQuantity)
      if (rejected <= 0) continue
      const grnLine = ql.goodsReceiptLineId
        ? grn?.lines.find((g) => g.id === ql.goodsReceiptLineId)
        : undefined
      if (ql.goodsReceiptLineId) seenGrnLineIds.add(ql.goodsReceiptLineId)
      pushLine({
        goodsReceiptLineId: ql.goodsReceiptLineId,
        purchaseOrderLineId: ql.purchaseOrderLineId,
        itemId: ql.itemId,
        itemCode: ql.itemCodeSnapshot,
        itemName: ql.itemNameSnapshot,
        batchNumber: grnLine?.batchNumber ?? null,
        serialNumber: grnLine?.serialNumber ?? null,
        cap: rejected,
        source: 'rejected',
        rate: returnQty(grnLine?.rate),
        uomId: grnLine?.uomId ?? null,
        uomCode: grnLine?.uomCodeSnapshot || null,
        uomConversionFactor: returnQty(grnLine?.uomConversionFactor) || 1,
        receivedUomQuantity: returnQty(grnLine?.receivedUomQuantity),
        receivedQuantity: returnQty(grnLine?.receivedQuantity),
      })
    }
  }

  if (grn && !hardBlock) {
    for (const gl of grn.lines) {
      if (seenGrnLineIds.has(gl.id)) continue
      const reversedReceived = returnQty((gl as { reversedQuantity?: unknown }).reversedQuantity)
      const reversedAccepted = returnQty(
        (gl as { reversedAcceptedQuantity?: unknown }).reversedAcceptedQuantity,
      )
      const reversedRejected = returnQty(
        (gl as { reversedRejectedQuantity?: unknown }).reversedRejectedQuantity,
      )
      const rejected = Math.max(0, returnQty(gl.rejectedQuantity) - reversedRejected)
      const accepted = Math.max(0, returnQty(gl.acceptedQuantity) - reversedAccepted)
      const received = Math.max(0, returnQty(gl.receivedQuantity) - reversedReceived)
      const { cap, source } = lineReturnCap(
        grn.status,
        grn.inspectionRequired,
        rejected,
        accepted,
        received,
        Boolean(qi),
      )
      if (cap <= 0) continue
      pushLine({
        goodsReceiptLineId: gl.id,
        purchaseOrderLineId: gl.purchaseOrderLineId,
        itemId: gl.itemId,
        itemCode: gl.itemCodeSnapshot,
        itemName: gl.itemNameSnapshot,
        batchNumber: gl.batchNumber,
        serialNumber: gl.serialNumber,
        cap,
        source,
        rate: returnQty(gl.rate),
        uomId: gl.uomId,
        uomCode: gl.uomCodeSnapshot || null,
        uomConversionFactor: returnQty(gl.uomConversionFactor) || 1,
        receivedUomQuantity: returnQty(gl.receivedUomQuantity),
        receivedQuantity: received,
      })
    }
  }

  const totalRejected = lines.reduce((s, l) => s + l.eligibleQuantity, 0)
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
    closedForReturn: hardBlock,
  }
}

/** Posted / in-transit material returns count toward returned qty on GRN detail. */
const RETURNED_TO_VENDOR_STATUSES = ['COMPLETED', 'SHIPPED'] as const

export type GrnMaterialReturnLineSummary = {
  returnedQuantity: number
  returnableQuantity: number
}

export type GrnMaterialReturnEntry = {
  purchaseReturnId: string
  returnNumber: string
  goodsReceiptLineId: string
  returnQuantity: number
  status: string
  completedAt: string | null
}

/** Summarize completed material returns per GRN line for GRN detail display. */
export async function summarizeMaterialReturnsForGrn(
  tenantId: string,
  goodsReceiptId: string,
): Promise<{
  byGrnLineId: Map<string, GrnMaterialReturnLineSummary>
  totalReturnedQuantity: number
  totalReturnableQuantity: number
  entries: GrnMaterialReturnEntry[]
}> {
  const [returnable, postedReturns] = await Promise.all([
    computeRemainingReturnable(tenantId, { goodsReceiptId }),
    prisma.purchaseReturn.findMany({
      where: {
        tenantId,
        goodsReceiptId,
        deletedAt: null,
        status: { in: [...RETURNED_TO_VENDOR_STATUSES] },
      },
      include: { lines: true },
    }),
  ])

  const returnedByLine = new Map<string, number>()
  const entries: GrnMaterialReturnEntry[] = []
  for (const ret of postedReturns) {
    for (const line of ret.lines) {
      if (!line.goodsReceiptLineId) continue
      const q = returnQty(line.returnQuantity)
      if (q <= 0) continue
      returnedByLine.set(
        line.goodsReceiptLineId,
        (returnedByLine.get(line.goodsReceiptLineId) ?? 0) + q,
      )
      entries.push({
        purchaseReturnId: ret.id,
        returnNumber: ret.returnNumber,
        goodsReceiptLineId: line.goodsReceiptLineId,
        returnQuantity: q,
        status: ret.status,
        completedAt:
          ret.completedAt?.toISOString() ??
          ret.shippedAt?.toISOString() ??
          null,
      })
    }
  }
  entries.sort((a, b) => {
    const ta = a.completedAt ?? ''
    const tb = b.completedAt ?? ''
    return ta.localeCompare(tb) || a.returnNumber.localeCompare(b.returnNumber)
  })

  const returnableByLine = new Map<string, number>()
  for (const line of returnable.lines) {
    if (!line.goodsReceiptLineId) continue
    returnableByLine.set(line.goodsReceiptLineId, line.remainingReturnableQuantity)
  }

  const byGrnLineId = new Map<string, GrnMaterialReturnLineSummary>()
  for (const id of new Set([...returnedByLine.keys(), ...returnableByLine.keys()])) {
    byGrnLineId.set(id, {
      returnedQuantity: returnedByLine.get(id) ?? 0,
      returnableQuantity: returnableByLine.get(id) ?? 0,
    })
  }

  return {
    byGrnLineId,
    totalReturnedQuantity: [...returnedByLine.values()].reduce((sum, q) => sum + q, 0),
    totalReturnableQuantity: returnable.totalRemaining,
    entries,
  }
}
