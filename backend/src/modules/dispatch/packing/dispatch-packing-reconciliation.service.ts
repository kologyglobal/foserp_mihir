import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import { netPickedForLine } from '../picking/dispatch-pick-list.service.js'
import * as outboundRepo from '../outbound/outbound-dispatch.repository.js'
import { netPackedForDispatchLine } from './dispatch-packing.service.js'

export async function getPackingReconciliation(tenantId: string, dispatchId: string) {
  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')

  const [pickLists, sessions, movements] = await Promise.all([
    prisma.dispatchPickList.findMany({
      where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null },
      include: { lines: true, events: true },
    }),
    prisma.dispatchPackingSession.findMany({
      where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null },
      include: { packages: { include: { lines: true } }, events: true },
    }),
    prisma.inventoryStockMovement.findMany({
      where: {
        tenantId,
        referenceType: 'FG_DISPATCH',
        referenceNo: dispatch.dispatchNo,
      },
    }),
  ])

  const lines = await Promise.all(
    dispatch.lines.map(async (line) => {
      const pickLines = pickLists.flatMap((pl) =>
        pl.lines.filter((l) => l.outboundDispatchLineId === line.id),
      )
      let netPicked = 0
      for (const pl of pickLines) {
        netPicked += await netPickedForLine(pl.id)
      }
      netPicked = roundQty(netPicked)

      const netPacked = await netPackedForDispatchLine(tenantId, line.id)
      const packable = roundQty(Math.max(0, netPicked - netPacked))
      const fgMovements = movements.filter((m) => m.itemId === line.itemId)

      return {
        outboundDispatchLineId: line.id,
        lineNo: line.lineNo,
        dispatchQty: n(line.quantity),
        netPickedQty: netPicked,
        netPackedQty: netPacked,
        packableQty: packable,
        fgDispatchMovementCount: fgMovements.length,
        reconciled: netPacked <= netPicked && fgMovements.length === 0 && dispatch.status === 'DRAFT',
        warnings: [] as string[],
      }
    }),
  )

  return {
    outboundDispatchId: dispatchId,
    dispatchNo: dispatch.dispatchNo,
    status: dispatch.status,
    packingSessions: sessions.map((s) => ({
      id: s.id,
      packingSessionNumber: s.packingSessionNumber,
      status: s.status,
      totalPackedQuantity: n(s.totalPackedQuantity),
      totalPackages: s.totalPackages,
    })),
    lines,
    invariantNotes: [
      'Pack/unpack/move must not create FG_DISPATCH movements while dispatch is DRAFT.',
      'On-hand quantity unchanged until confirm posts stock.',
      'Packable = net picked − net packed.',
    ],
  }
}

export async function getSessionReconciliation(tenantId: string, sessionId: string) {
  const session = await prisma.dispatchPackingSession.findFirst({
    where: { id: sessionId, tenantId, deletedAt: null },
    include: {
      packages: { include: { lines: true } },
      events: { orderBy: { performedAt: 'asc' } },
    },
  })
  if (!session) throw new NotFoundError('Packing session not found')

  return {
    packingSessionId: session.id,
    packingSessionNumber: session.packingSessionNumber,
    status: session.status,
    totalPickedQuantity: n(session.totalPickedQuantity),
    totalPackedQuantity: n(session.totalPackedQuantity),
    totalUnpackedQuantity: n(session.totalUnpackedQuantity),
    totalShortageQuantity: n(session.totalShortageQuantity),
    packages: session.packages.map((p) => ({
      id: p.id,
      packageNumber: p.packageNumber,
      status: p.status,
      lineCount: p.lines.filter((l) => l.status === 'PACKED' || l.status === 'MOVED').length,
    })),
    eventCount: session.events.length,
  }
}

export async function getWorkbenchReadyToPack(tenantId: string, limit = 50) {
  const rows = await prisma.dispatchPackingSession.findMany({
    where: { tenantId, deletedAt: null, status: 'READY' },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((s) => ({
    id: s.id,
    packingSessionNumber: s.packingSessionNumber,
    outboundDispatchId: s.outboundDispatchId,
    totalPickedQuantity: n(s.totalPickedQuantity),
  }))
}

export async function getWorkbenchPackingInProgress(tenantId: string, limit = 50) {
  const rows = await prisma.dispatchPackingSession.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['IN_PROGRESS', 'PARTIALLY_PACKED'] },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((s) => ({
    id: s.id,
    packingSessionNumber: s.packingSessionNumber,
    outboundDispatchId: s.outboundDispatchId,
    status: s.status,
    totalPackedQuantity: n(s.totalPackedQuantity),
  }))
}

export async function getWorkbenchPackedSessions(tenantId: string, limit = 50) {
  const rows = await prisma.dispatchPackingSession.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: { in: ['PACKED', 'VERIFIED'] },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((s) => ({
    id: s.id,
    packingSessionNumber: s.packingSessionNumber,
    outboundDispatchId: s.outboundDispatchId,
    status: s.status,
  }))
}

export async function getWorkbenchPackingShortages(tenantId: string, limit = 50) {
  const rows = await prisma.dispatchPackingSession.findMany({
    where: {
      tenantId,
      deletedAt: null,
      status: 'BLOCKED',
      totalShortageQuantity: { gt: 0 },
    },
    take: limit,
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map((s) => ({
    id: s.id,
    packingSessionNumber: s.packingSessionNumber,
    outboundDispatchId: s.outboundDispatchId,
    totalShortageQuantity: n(s.totalShortageQuantity),
  }))
}

export async function assertPackingAllowsConfirm(tenantId: string, dispatchId: string): Promise<void> {
  const sessions = await prisma.dispatchPackingSession.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    },
  })
  if (!sessions.length) return

  const dispatch = await outboundRepo.findById(tenantId, dispatchId)
  if (!dispatch) return

  for (const session of sessions) {
    if (!['PACKED', 'VERIFIED'].includes(session.status)) {
      throw new ConflictError(
        'Outbound confirm blocked: active packing session must be PACKED or VERIFIED before confirm (Phase 7C3)',
      )
    }
  }

  for (const line of dispatch.lines) {
    const netPacked = await netPackedForDispatchLine(tenantId, line.id)
    const lineQty = n(line.quantity)
    if (roundQty(netPacked) !== lineQty) {
      throw new ConflictError('Net packed quantity must equal dispatch line quantity before confirm')
    }
  }
}
