import type { Request } from 'express'
import type { DispatchPackageStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { isPositive, toDecimal } from '../../inventory/shared/quantity.helpers.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import { netPickedForLine } from '../picking/dispatch-pick-list.service.js'
import {
  netPackedForPickLine,
} from './dispatch-packing.service.js'

export interface CreatePackageInput {
  packageTypeId?: string
  packageReference?: string
  tareWeight?: number
  sealNumber?: string
  externalMarking?: string
  remarks?: string
  idempotencyKey?: string
}

export interface PackInput {
  pickLineId: string
  quantity: number
  lotRef?: string
  serialRef?: string
  heatNumber?: string
  idempotencyKey?: string
  remarks?: string
}

export interface UnpackInput {
  packageLineId: string
  quantity: number
  idempotencyKey?: string
  remarks?: string
}

export interface MoveLinesInput {
  packageLineIds: string[]
  destinationPackageId: string
  idempotencyKey?: string
  remarks?: string
}

export interface UpdatePackageInput {
  packageReference?: string | null
  tareWeight?: number | null
  grossWeight?: number | null
  netWeight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
  sealNumber?: string | null
  externalMarking?: string | null
  remarks?: string | null
}

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function mapPackage(row: {
  id: string
  packageNumber: string
  packingSessionId: string
  outboundDispatchId: string
  warehouseId: string
  packageTypeId: string | null
  packageTypeCodeSnapshot: string | null
  packageReference: string | null
  packageSequence: number
  status: DispatchPackageStatus
  sealNumber: string | null
  externalMarking: string | null
  remarks: string | null
  lines?: Array<{
    id: string
    pickLineId: string
    itemId: string
    packedQuantity: Prisma.Decimal
    lotRef: string | null
    serialRef: string | null
    heatNumber: string | null
    status: string
  }>
}) {
  return {
    id: row.id,
    packageNumber: row.packageNumber,
    packingSessionId: row.packingSessionId,
    outboundDispatchId: row.outboundDispatchId,
    warehouseId: row.warehouseId,
    packageTypeId: row.packageTypeId,
    packageTypeCodeSnapshot: row.packageTypeCodeSnapshot,
    packageReference: row.packageReference,
    packageSequence: row.packageSequence,
    status: row.status,
    sealNumber: row.sealNumber,
    externalMarking: row.externalMarking,
    remarks: row.remarks,
    lines: row.lines?.map((l) => ({
      id: l.id,
      pickLineId: l.pickLineId,
      itemId: l.itemId,
      packedQuantity: n(l.packedQuantity),
      lotRef: l.lotRef,
      serialRef: l.serialRef,
      heatNumber: l.heatNumber,
      status: l.status,
    })),
  }
}

async function loadPackage(tenantId: string, packageId: string) {
  const row = await prisma.dispatchPackage.findFirst({
    where: { id: packageId, tenantId },
    include: { lines: true },
  })
  if (!row) throw new NotFoundError('Package not found')
  return row
}

async function loadOpenSession(tenantId: string, sessionId: string) {
  const session = await prisma.dispatchPackingSession.findFirst({
    where: { id: sessionId, tenantId, deletedAt: null },
  })
  if (!session) throw new NotFoundError('Packing session not found')
  if (['CANCELLED', 'VERIFIED', 'PACKED'].includes(session.status)) {
    throw new InvalidStateError('Packing session is not open for package operations')
  }
  return session
}

async function refreshSessionFromPackages(tx: Prisma.TransactionClient, tenantId: string, sessionId: string) {
  const packedLines = await tx.dispatchPackageLine.findMany({
    where: { tenantId, packingSessionId: sessionId, status: { in: ['PACKED', 'MOVED'] } },
  })
  const totalPacked = roundQty(packedLines.reduce((s, l) => s + n(l.packedQuantity), 0))
  const totalUnpacked = roundQty(
    (
      await tx.dispatchPackingEvent.findMany({
        where: { tenantId, packingSessionId: sessionId, eventType: 'UNPACK' },
      })
    ).reduce((s, e) => s + n(e.quantity), 0),
  )
  const packageCount = await tx.dispatchPackage.count({
    where: { tenantId, packingSessionId: sessionId, status: { not: 'CANCELLED' } },
  })

  const session = await tx.dispatchPackingSession.findFirstOrThrow({ where: { id: sessionId } })
  let status = session.status
  if (!['VERIFIED', 'CANCELLED', 'BLOCKED'].includes(session.status)) {
    if (session.completedAt) status = 'PACKED'
    else if (totalPacked > 0) status = 'PARTIALLY_PACKED'
    else if (session.startedAt) status = 'IN_PROGRESS'
    else status = 'READY'
  }

  await tx.dispatchPackingSession.update({
    where: { id: sessionId },
    data: {
      totalPackedQuantity: totalPacked,
      totalUnpackedQuantity: totalUnpacked,
      totalPackages: packageCount,
      status,
      updatedBy: session.updatedBy,
    },
  })
}

function derivePackageStatus(lines: Array<{ packedQuantity: Prisma.Decimal; status: string }>): DispatchPackageStatus {
  const active = lines.filter((l) => l.status === 'PACKED' || l.status === 'MOVED')
  if (!active.length) return 'OPEN'
  return 'PARTIALLY_FILLED'
}

export async function createPackage(
  req: Request,
  tenantId: string,
  sessionId: string,
  input: CreatePackageInput,
) {
  const session = await loadOpenSession(tenantId, sessionId)
  const actor = userId(req)

  const pkgType = input.packageTypeId
    ? await prisma.dispatchPackageType.findFirst({ where: { id: input.packageTypeId, tenantId } })
    : null

  const created = await prisma.$transaction(async (tx) => {
    const lastSeq = await tx.dispatchPackage.findFirst({
      where: { packingSessionId: sessionId },
      orderBy: { packageSequence: 'desc' },
    })
    const packageSequence = (lastSeq?.packageSequence ?? 0) + 1
    const packageNumber = await nextCode(tenantId, 'DISPATCH_PACKAGE', tx)

    const pkg = await tx.dispatchPackage.create({
      data: {
        tenantId,
        packageNumber,
        packingSessionId: sessionId,
        outboundDispatchId: session.outboundDispatchId,
        warehouseId: session.warehouseId,
        packageTypeId: pkgType?.id ?? null,
        packageTypeCodeSnapshot: pkgType?.code ?? null,
        packageReference: input.packageReference ?? null,
        packageSequence,
        tareWeight: input.tareWeight ?? pkgType?.defaultTareWeight ?? null,
        sealNumber: input.sealNumber ?? null,
        externalMarking: input.externalMarking ?? null,
        remarks: input.remarks ?? null,
        createdBy: actor || null,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })

    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: sessionId,
        packageId: pkg.id,
        eventType: 'PACKAGE_CREATED',
        performedBy: actor,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    })
    await refreshSessionFromPackages(tx, tenantId, sessionId)
    return pkg
  })

  return mapPackage(created)
}

export async function listPackagesForSession(tenantId: string, sessionId: string) {
  const rows = await prisma.dispatchPackage.findMany({
    where: { tenantId, packingSessionId: sessionId },
    orderBy: { packageSequence: 'asc' },
    include: { lines: true },
  })
  return rows.map(mapPackage)
}

export async function getPackage(tenantId: string, packageId: string) {
  const row = await loadPackage(tenantId, packageId)
  return mapPackage(row)
}

export async function updatePackage(
  req: Request,
  tenantId: string,
  packageId: string,
  input: UpdatePackageInput,
) {
  await loadPackage(tenantId, packageId)
  const row = await prisma.dispatchPackage.update({
    where: { id: packageId },
    data: {
      packageReference: input.packageReference,
      tareWeight: input.tareWeight,
      grossWeight: input.grossWeight,
      netWeight: input.netWeight,
      length: input.length,
      width: input.width,
      height: input.height,
      sealNumber: input.sealNumber,
      externalMarking: input.externalMarking,
      remarks: input.remarks,
      updatedBy: userId(req) || null,
    },
    include: { lines: true },
  })
  return mapPackage(row)
}

export async function packIntoPackage(
  req: Request,
  tenantId: string,
  packageId: string,
  input: PackInput,
) {
  if (input.idempotencyKey) {
    const existing = await prisma.dispatchPackingEvent.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
    })
    if (existing) return getPackage(tenantId, packageId)
  }

  const pkg = await loadPackage(tenantId, packageId)
  if (['CANCELLED', 'VERIFIED', 'COMPLETE'].includes(pkg.status)) {
    throw new InvalidStateError('Package is not open for packing')
  }
  await loadOpenSession(tenantId, pkg.packingSessionId)

  const pickLine = await prisma.dispatchPickLine.findFirst({
    where: { id: input.pickLineId, tenantId },
    include: { pickList: true },
  })
  if (!pickLine) throw new NotFoundError('Pick line not found')
  if (pickLine.pickList.outboundDispatchId !== pkg.outboundDispatchId) {
    throw new ValidationError('Pick line does not belong to this dispatch')
  }
  if (pickLine.warehouseId !== pkg.warehouseId) {
    throw new ValidationError('Pick line warehouse does not match package warehouse')
  }

  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Pack quantity must be positive')

  const netPicked = await netPickedForLine(pickLine.id)
  const netPacked = await netPackedForPickLine(tenantId, pickLine.id)
  const packable = roundQty(netPicked - netPacked)
  if (n(qty) > packable) {
    throw new ConflictError('Pack quantity exceeds packable (net picked minus net packed)')
  }

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    const line = await tx.dispatchPackageLine.create({
      data: {
        tenantId,
        packageId,
        packingSessionId: pkg.packingSessionId,
        outboundDispatchLineId: pickLine.outboundDispatchLineId,
        dispatchRequirementId: pickLine.dispatchRequirementId,
        salesOrderId: pickLine.salesOrderId,
        salesOrderLineId: pickLine.salesOrderLineId,
        pickListId: pickLine.pickListId,
        pickLineId: pickLine.id,
        itemId: pickLine.itemId,
        packedQuantity: qty,
        lotRef: input.lotRef ?? null,
        serialRef: input.serialRef ?? null,
        heatNumber: input.heatNumber ?? null,
        status: 'PACKED',
      },
    })

    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: pkg.packingSessionId,
        packageId,
        packageLineId: line.id,
        eventType: 'PACK',
        itemId: pickLine.itemId,
        quantity: qty,
        lotRef: input.lotRef ?? null,
        serialRef: input.serialRef ?? null,
        heatNumber: input.heatNumber ?? null,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })

    const refreshedLines = await tx.dispatchPackageLine.findMany({
      where: { packageId, status: { in: ['PACKED', 'MOVED'] } },
    })
    await tx.dispatchPackage.update({
      where: { id: packageId },
      data: {
        status: derivePackageStatus(refreshedLines),
        updatedBy: actor || null,
      },
    })
    await refreshSessionFromPackages(tx, tenantId, pkg.packingSessionId)
  })

  return getPackage(tenantId, packageId)
}

export async function unpackFromPackage(
  req: Request,
  tenantId: string,
  packageId: string,
  input: UnpackInput,
) {
  const pkg = await loadPackage(tenantId, packageId)
  await loadOpenSession(tenantId, pkg.packingSessionId)

  const packageLine = pkg.lines.find((l) => l.id === input.packageLineId)
  if (!packageLine) throw new NotFoundError('Package line not found')
  if (packageLine.status !== 'PACKED' && packageLine.status !== 'MOVED') {
    throw new InvalidStateError('Package line is not packed')
  }

  const qty = toDecimal(input.quantity)
  if (!isPositive(qty)) throw new ValidationError('Unpack quantity must be positive')
  if (n(qty) > n(packageLine.packedQuantity)) {
    throw new ConflictError('Unpack quantity exceeds packed quantity on line')
  }

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    if (n(qty) === n(packageLine.packedQuantity)) {
      await tx.dispatchPackageLine.update({
        where: { id: packageLine.id },
        data: { status: 'UNPACKED', packedQuantity: 0 },
      })
    } else {
      await tx.dispatchPackageLine.update({
        where: { id: packageLine.id },
        data: { packedQuantity: roundQty(n(packageLine.packedQuantity) - n(qty)) },
      })
    }

    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: pkg.packingSessionId,
        packageId,
        packageLineId: packageLine.id,
        eventType: 'UNPACK',
        itemId: packageLine.itemId,
        quantity: qty,
        lotRef: packageLine.lotRef,
        serialRef: packageLine.serialRef,
        heatNumber: packageLine.heatNumber,
        remarks: input.remarks ?? null,
        idempotencyKey: input.idempotencyKey ?? null,
        performedBy: actor,
      },
    })

    const refreshedLines = await tx.dispatchPackageLine.findMany({
      where: { packageId, status: { in: ['PACKED', 'MOVED'] } },
    })
    await tx.dispatchPackage.update({
      where: { id: packageId },
      data: {
        status: refreshedLines.length ? derivePackageStatus(refreshedLines) : 'OPEN',
        updatedBy: actor || null,
      },
    })
    await refreshSessionFromPackages(tx, tenantId, pkg.packingSessionId)
  })

  return getPackage(tenantId, packageId)
}

export async function moveLinesBetweenPackages(
  req: Request,
  tenantId: string,
  sourcePackageId: string,
  input: MoveLinesInput,
) {
  const source = await loadPackage(tenantId, sourcePackageId)
  const dest = await loadPackage(tenantId, input.destinationPackageId)
  if (source.packingSessionId !== dest.packingSessionId) {
    throw new ValidationError('Packages must belong to the same packing session')
  }
  await loadOpenSession(tenantId, source.packingSessionId)

  const actor = userId(req)
  await prisma.$transaction(async (tx) => {
    for (const lineId of input.packageLineIds) {
      const line = source.lines.find((l) => l.id === lineId)
      if (!line || (line.status !== 'PACKED' && line.status !== 'MOVED')) {
        throw new NotFoundError('Package line not found or not movable')
      }

      await tx.dispatchPackageLine.update({
        where: { id: line.id },
        data: { packageId: dest.id, status: 'MOVED' },
      })

      await tx.dispatchPackingEvent.create({
        data: {
          tenantId,
          packingSessionId: source.packingSessionId,
          packageId: dest.id,
          packageLineId: line.id,
          eventType: 'MOVE_BETWEEN_PACKAGES',
          itemId: line.itemId,
          quantity: line.packedQuantity,
          sourcePackageId: source.id,
          destinationPackageId: dest.id,
          remarks: input.remarks ?? null,
          idempotencyKey: input.idempotencyKey ?? null,
          performedBy: actor,
        },
      })
    }

    for (const pkgId of [source.id, dest.id]) {
      const refreshedLines = await tx.dispatchPackageLine.findMany({
        where: { packageId: pkgId, status: { in: ['PACKED', 'MOVED'] } },
      })
      await tx.dispatchPackage.update({
        where: { id: pkgId },
        data: {
          status: refreshedLines.length ? derivePackageStatus(refreshedLines) : 'OPEN',
          updatedBy: actor || null,
        },
      })
    }
  })

  return getPackage(tenantId, dest.id)
}

export async function completePackage(req: Request, tenantId: string, packageId: string) {
  const pkg = await loadPackage(tenantId, packageId)
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: pkg.packingSessionId,
        packageId,
        eventType: 'PACKAGE_COMPLETED',
        performedBy: actor,
      },
    })
    return tx.dispatchPackage.update({
      where: { id: packageId },
      data: { status: 'COMPLETE', updatedBy: actor || null },
      include: { lines: true },
    })
  })
  return mapPackage(updated)
}

export async function verifyPackage(req: Request, tenantId: string, packageId: string) {
  const pkg = await loadPackage(tenantId, packageId)
  if (pkg.status !== 'COMPLETE') {
    throw new InvalidStateError('Only COMPLETE packages can be verified')
  }
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: pkg.packingSessionId,
        packageId,
        eventType: 'PACKAGE_VERIFIED',
        performedBy: actor,
      },
    })
    return tx.dispatchPackage.update({
      where: { id: packageId },
      data: {
        status: 'VERIFIED',
        verifiedAt: new Date(),
        verifiedBy: actor || null,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })
  })
  return mapPackage(updated)
}

export async function reopenPackage(req: Request, tenantId: string, packageId: string) {
  const pkg = await loadPackage(tenantId, packageId)
  if (!['COMPLETE', 'VERIFIED'].includes(pkg.status)) {
    throw new InvalidStateError('Only completed packages can be reopened')
  }
  const actor = userId(req)
  const updated = await prisma.$transaction(async (tx) => {
    await tx.dispatchPackingEvent.create({
      data: {
        tenantId,
        packingSessionId: pkg.packingSessionId,
        packageId,
        eventType: 'PACKAGE_REOPENED',
        performedBy: actor,
      },
    })
    const lines = await tx.dispatchPackageLine.findMany({
      where: { packageId, status: { in: ['PACKED', 'MOVED'] } },
    })
    return tx.dispatchPackage.update({
      where: { id: packageId },
      data: {
        status: lines.length ? derivePackageStatus(lines) : 'REOPENED',
        verifiedAt: null,
        verifiedBy: null,
        updatedBy: actor || null,
      },
      include: { lines: true },
    })
  })
  return mapPackage(updated)
}

export async function cancelPackage(req: Request, tenantId: string, packageId: string, reason?: string) {
  const pkg = await loadPackage(tenantId, packageId)
  if (pkg.status === 'VERIFIED') {
    throw new InvalidStateError('Verified package cannot be cancelled')
  }
  const activeLines = pkg.lines.filter((l) => l.status === 'PACKED' || l.status === 'MOVED')
  if (activeLines.length) {
    throw new ConflictError('Unpack all lines before cancelling package')
  }
  const actor = userId(req)
  const updated = await prisma.dispatchPackage.update({
    where: { id: packageId },
    data: {
      status: 'CANCELLED',
      remarks: reason ?? pkg.remarks,
      updatedBy: actor || null,
    },
    include: { lines: true },
  })
  return mapPackage(updated)
}
