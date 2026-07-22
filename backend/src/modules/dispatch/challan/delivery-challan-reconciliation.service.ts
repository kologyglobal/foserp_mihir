import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ConflictError, NotFoundError } from '../../../utils/errors.js'
import { n, roundQty } from '../shared/dispatch-qty.js'

export type ChallanReconciliationStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'RECONCILED'
  | 'QUANTITY_DIFFERENCE'
  | 'PACKAGE_DIFFERENCE'
  | 'TRACKING_DIFFERENCE'
  | 'BLOCKED'

export async function netPackedForDispatchLine(tenantId: string, outboundDispatchLineId: string): Promise<number> {
  const lines = await prisma.dispatchPackageLine.findMany({
    where: { tenantId, outboundDispatchLineId, status: { in: ['PACKED', 'MOVED'] } },
  })
  return roundQty(lines.reduce((s, l) => s + n(l.packedQuantity), 0))
}

export async function packingFingerprint(tenantId: string, packingSessionId: string): Promise<string> {
  const session = await prisma.dispatchPackingSession.findFirst({
    where: { id: packingSessionId, tenantId, deletedAt: null },
    select: {
      status: true,
      sourceVersion: true,
      totalPackedQuantity: true,
      packages: { select: { id: true, status: true, sourceVersion: true, packageNumber: true } },
    },
  })
  if (!session) throw new NotFoundError('Packing session not found')
  return [
    session.status,
    session.sourceVersion,
    String(n(session.totalPackedQuantity)),
    ...session.packages.map((p) => `${p.id}:${p.status}:${p.sourceVersion}`).sort(),
  ].join('|')
}

export async function reconcileDispatchForChallan(tenantId: string, dispatchId: string) {
  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: dispatchId, tenantId, deletedAt: null },
    include: { lines: true },
  })
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')

  const blockers: string[] = []
  const warnings: string[] = []
  const lineRows = []

  for (const line of dispatch.lines) {
    const packed = await netPackedForDispatchLine(tenantId, line.id)
    const requested = n(line.quantity)
    const difference = roundQty(packed - requested)
    let status: ChallanReconciliationStatus = 'RECONCILED'
    if (packed <= 0) status = 'NOT_STARTED'
    else if (difference !== 0) status = 'QUANTITY_DIFFERENCE'
    lineRows.push({
      outboundDispatchLineId: line.id,
      itemId: line.itemId,
      requestedQuantity: requested,
      packedQuantity: packed,
      difference,
      status,
    })
    if (status === 'QUANTITY_DIFFERENCE') {
      blockers.push(`Packed quantity does not match dispatch line ${line.lineNo}`)
    }
  }

  const sessions = await prisma.dispatchPackingSession.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null, status: { not: 'CANCELLED' } },
  })
  if (!sessions.length) blockers.push('No packing session for this dispatch')
  for (const s of sessions) {
    if (!['PACKED', 'VERIFIED'].includes(s.status)) {
      blockers.push(`Packing session ${s.packingSessionNumber} is ${s.status}`)
    }
    if (n(s.totalShortageQuantity) > 0) blockers.push(`Unresolved packing shortage on ${s.packingSessionNumber}`)
  }

  const packages = await prisma.dispatchPackage.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      status: { not: 'CANCELLED' },
    },
  })
  if (!packages.length) blockers.push('No packages for this dispatch')
  const unfinished = packages.filter((p) => !['COMPLETE', 'VERIFIED', 'PARTIALLY_FILLED', 'OPEN'].includes(p.status))
  if (unfinished.length) {
    for (const p of unfinished) blockers.push(`Package ${p.packageNumber} has invalid status ${p.status}`)
  }
  // When session is PACKED/VERIFIED, OPEN/PARTIALLY_FILLED packages with packed lines are accepted (pilot).
  const sessionsPacked = sessions.every((s) => ['PACKED', 'VERIFIED'].includes(s.status))
  if (!sessionsPacked) {
    for (const p of packages) {
      if (!['COMPLETE', 'VERIFIED'].includes(p.status)) {
        blockers.push(`Package ${p.packageNumber} must be COMPLETE or VERIFIED`)
      }
    }
  }

  const activeChallans = await prisma.deliveryChallan.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'SUPERSEDED'] },
    },
  })

  let overall: ChallanReconciliationStatus = blockers.length
    ? 'BLOCKED'
    : lineRows.every((l) => l.status === 'RECONCILED')
      ? 'RECONCILED'
      : 'IN_PROGRESS'

  return {
    outboundDispatchId: dispatchId,
    status: overall,
    lines: lineRows,
    blockers,
    warnings,
    activeChallanCount: activeChallans.length,
    packages: packages.map((p) => ({
      id: p.id,
      packageNumber: p.packageNumber,
      status: p.status,
      grossWeight: p.grossWeight != null ? n(p.grossWeight) : null,
      netWeight: p.netWeight != null ? n(p.netWeight) : null,
    })),
  }
}

export async function assertChallanAllowsConfirm(tenantId: string, dispatchId: string): Promise<void> {
  const challans = await prisma.deliveryChallan.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    },
  })
  if (!challans.length) return

  const active = challans.filter((c) => c.status !== 'SUPERSEDED')
  const issued = active.filter((c) => c.status === 'ISSUED')
  if (issued.length !== 1) {
    throw new ConflictError(
      'Outbound confirm blocked: an active Delivery Challan must be ISSUED before confirm (Phase 7C4)',
    )
  }

  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: dispatchId, tenantId, deletedAt: null },
    include: { lines: true },
  })
  if (!dispatch) return
  const dispatchQty = roundQty(dispatch.lines.reduce((s, l) => s + n(l.quantity), 0))
  const challanQty = n(issued[0]!.totalQuantity)
  if (roundQty(challanQty) !== dispatchQty) {
    throw new ConflictError('Issued Delivery Challan quantity must equal dispatch quantity before confirm')
  }
}

export function mapChallan(
  row: Prisma.DeliveryChallanGetPayload<{
    include?: {
      lines?: true
      packages?: true
      tracking?: true
      outboundDispatch?: { select: { dispatchNo: true; status: true; salesOrderNo: true } }
      packingSession?: { select: { packingSessionNumber: true; status: true } }
    }
  }>,
) {
  return {
    id: row.id,
    challanNumber: row.challanNumber,
    status: row.status,
    versionNumber: row.versionNumber,
    outboundDispatchId: row.outboundDispatchId,
    packingSessionId: row.packingSessionId,
    customerId: row.customerId,
    shipToKey: row.shipToKey,
    sourceWarehouseId: row.sourceWarehouseId,
    documentDate: row.documentDate.toISOString().slice(0, 10),
    movementDate: row.movementDate?.toISOString().slice(0, 10) ?? null,
    movementReason: row.movementReason,
    transportMode: row.transportMode,
    transporterName: row.transporterName,
    transporterDocumentRef: row.transporterDocumentRef,
    vehicleNumber: row.vehicleNumber,
    driverName: row.driverName,
    driverPhone: row.driverPhone,
    lrGrNumber: row.lrGrNumber,
    lrGrDate: row.lrGrDate?.toISOString().slice(0, 10) ?? null,
    eWayBillReference: row.eWayBillReference,
    eWayBillDate: row.eWayBillDate?.toISOString().slice(0, 10) ?? null,
    destination: row.destination,
    totalPackages: row.totalPackages,
    totalQuantity: n(row.totalQuantity),
    grossWeight: row.grossWeight != null ? n(row.grossWeight) : null,
    netWeight: row.netWeight != null ? n(row.netWeight) : null,
    remarks: row.remarks,
    termsText: row.termsText,
    sourceVersion: row.sourceVersion,
    sourceFingerprint: row.sourceFingerprint,
    documentGenStatus: row.documentGenStatus,
    issuedAt: row.issuedAt?.toISOString() ?? null,
    issuedBy: row.issuedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    supersedesChallanId: row.supersedesChallanId,
    supersededByChallanId: row.supersededByChallanId,
    customerSnapshot: row.customerSnapshotJson,
    shipToSnapshot: row.shipToSnapshotJson,
    legalEntitySnapshot: row.legalEntitySnapshotJson,
    salesOrderRefs: row.salesOrderRefsJson,
    outboundDispatch: (row as { outboundDispatch?: { dispatchNo: string; status: string; salesOrderNo: string | null } })
      .outboundDispatch,
    packingSession: (row as { packingSession?: { packingSessionNumber: string; status: string } }).packingSession,
    lines: (row as { lines?: unknown[] }).lines,
    packages: (row as { packages?: unknown[] }).packages,
    tracking: (row as { tracking?: unknown[] }).tracking,
    note: 'DELIVERY_CHALLAN_AS_DOCUMENT_ONLY — Packed ≠ Dispatched ≠ Fulfilled',
    allowedActions: allowedActions(row.status),
  }
}

function allowedActions(status: string): string[] {
  switch (status) {
    case 'DRAFT':
    case 'SENT_BACK':
      return ['edit', 'submit', 'cancel', 'preview', 'refresh']
    case 'READY_FOR_REVIEW':
      return ['approve', 'send_back', 'cancel', 'preview']
    case 'APPROVED':
      return ['issue', 'cancel', 'preview']
    case 'ISSUED':
      return ['download', 'print', 'cancel', 'supersede']
    default:
      return ['view']
  }
}
