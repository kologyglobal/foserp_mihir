import { prisma } from '../../../config/database.js'
import { NotFoundError } from '../../../utils/errors.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import * as outboundRepo from '../outbound/outbound-dispatch.repository.js'

export async function getPickingReconciliation(tenantId: string, dispatchId: string) {
  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')

  const [reservations, pickLists, movements] = await Promise.all([
    prisma.inventoryStockReservation.findMany({
      where: { tenantId, outboundDispatchId: dispatchId },
    }),
    prisma.dispatchPickList.findMany({
      where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null },
      include: { lines: true, events: true },
    }),
    prisma.inventoryStockMovement.findMany({
      where: {
        tenantId,
        referenceType: 'FG_DISPATCH',
        referenceNo: dispatch.dispatchNo,
      },
    }),
  ])

  const lines = dispatch.lines.map((line) => {
    const lineRes = reservations.filter((r) => r.outboundDispatchLineId === line.id)
    const netReserved = roundQty(
      lineRes.reduce((s, r) => {
        const net = n(r.quantity) - n(r.fulfilledQty) - n(r.releasedQty)
        return s + Math.max(0, net)
      }, 0),
    )

    const pickLines = pickLists.flatMap((pl) =>
      pl.lines.filter((l) => l.outboundDispatchLineId === line.id),
    )
    const events = pickLists.flatMap((pl) =>
      pl.events.filter((e) => pickLines.some((pln) => pln.id === e.pickLineId)),
    )
    let netPicked = 0
    for (const e of events) {
      const q = n(e.quantity)
      if (e.eventType === 'PICK') netPicked += q
      else if (e.eventType === 'UNPICK') netPicked -= q
    }
    netPicked = roundQty(Math.max(0, netPicked))

    const fgMovements = movements.filter((m) => m.itemId === line.itemId)

    return {
      outboundDispatchLineId: line.id,
      lineNo: line.lineNo,
      dispatchQty: n(line.quantity),
      netReservedQty: netReserved,
      netPickedQty: netPicked,
      shortageQty: roundQty(pickLines.reduce((s, l) => s + n(l.shortageQuantity), 0)),
      fgDispatchMovementCount: fgMovements.length,
      reconciled: netPicked <= netReserved && fgMovements.length === 0 && dispatch.status === 'DRAFT',
      warnings: [] as string[],
    }
  })

  return {
    outboundDispatchId: dispatchId,
    dispatchNo: dispatch.dispatchNo,
    status: dispatch.status,
    lines,
    invariantNotes: [
      'Reservation and pick must not create FG_DISPATCH movements while dispatch is DRAFT.',
      'On-hand quantity unchanged until confirm posts stock.',
    ],
  }
}

export async function getWorkbenchReservations(tenantId: string, limit = 50) {
  const rows = await prisma.inventoryStockReservation.findMany({
    where: {
      tenantId,
      demandType: 'DISPATCH',
      status: 'ACTIVE',
      outboundDispatchId: { not: null },
    },
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      item: { select: { code: true, name: true } },
      warehouse: { select: { code: true, name: true } },
    },
  })
  return rows.map((r) => ({
    id: r.id,
    reservationNumber: r.reservationNumber,
    outboundDispatchId: r.outboundDispatchId,
    itemCode: r.item.code,
    warehouseCode: r.warehouse.code,
    netReservedQty: roundQty(n(r.quantity) - n(r.fulfilledQty) - n(r.releasedQty)),
  }))
}

export async function getWorkbenchPickLists(tenantId: string, limit = 50) {
  const rows = await prisma.dispatchPickList.findMany({
    where: { tenantId, deletedAt: null },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: { lines: true },
  })
  return rows.map((pl) => ({
    id: pl.id,
    pickListNumber: pl.pickListNumber,
    outboundDispatchId: pl.outboundDispatchId,
    status: pl.status,
    lineCount: pl.lines.length,
  }))
}

export async function getWorkbenchShortages(tenantId: string, limit = 50) {
  const rows = await prisma.dispatchPickLine.findMany({
    where: {
      tenantId,
      shortageQuantity: { gt: 0 },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
    include: {
      pickList: { select: { pickListNumber: true, outboundDispatchId: true, status: true } },
      item: { select: { code: true, name: true } },
    },
  })
  return rows.map((l) => ({
    pickLineId: l.id,
    pickListNumber: l.pickList.pickListNumber,
    outboundDispatchId: l.pickList.outboundDispatchId,
    itemCode: l.item.code,
    shortageQty: n(l.shortageQuantity),
    reason: l.primaryShortageReason,
  }))
}
