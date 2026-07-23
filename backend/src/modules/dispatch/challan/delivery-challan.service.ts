import type { Request } from 'express'
import type { DeliveryChallanMovementReason, Prisma } from '@prisma/client'
import { createHash } from 'node:crypto'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getPagination } from '../../../utils/pagination.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import type { CreateChallanInput, UpdateChallanInput } from '../phase7c4/phase7c4.schemas.js'
import {
  mapChallan,
  packingFingerprint,
  reconcileDispatchForChallan,
} from './delivery-challan-reconciliation.service.js'
import { buildChallanHtml } from './delivery-challan-document.service.js'

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function parseDate(value?: string | null): Date | null {
  if (value == null || value === '') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) throw new ValidationError(`Invalid date: ${value}`)
  return d
}

async function loadChallan(tenantId: string, id: string) {
  const row = await prisma.deliveryChallan.findFirst({
    where: { id, tenantId, deletedAt: null },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      packages: true,
      tracking: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      packingSession: { select: { packingSessionNumber: true, status: true } },
    },
  })
  if (!row) throw new NotFoundError('Delivery challan not found')
  return row
}

export async function createFromDispatch(req: Request, tenantId: string, dispatchId: string, input: CreateChallanInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.deliveryChallan.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey, deletedAt: null },
      include: {
        lines: true,
        packages: true,
        tracking: true,
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
        packingSession: { select: { packingSessionNumber: true, status: true } },
      },
    })
    if (existing) return mapChallan(existing)
  }

  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: dispatchId, tenantId, deletedAt: null },
    include: { lines: true },
  })
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')
  if (dispatch.status === 'CANCELLED') throw new InvalidStateError('Cannot create challan for cancelled dispatch')
  if (dispatch.status === 'CONFIRMED') throw new InvalidStateError('Cannot create challan for confirmed dispatch')

  const active = await prisma.deliveryChallan.count({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { notIn: ['CANCELLED', 'SUPERSEDED'] },
    },
  })
  if (active > 0) throw new ConflictError('An active Delivery Challan already exists for this Dispatch')

  const sessions = await prisma.dispatchPackingSession.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { in: ['PACKED', 'VERIFIED'] },
      ...(input.packingSessionId ? { id: input.packingSessionId } : {}),
    },
    orderBy: { createdAt: 'asc' },
  })
  if (!sessions.length) throw new ValidationError('Packing Session must be PACKED or VERIFIED before creating a challan')
  const session = sessions[0]!

  const recon = await reconcileDispatchForChallan(tenantId, dispatchId)
  if (recon.status !== 'RECONCILED') {
    throw new ConflictError(`Packing-to-challan reconciliation blocked: ${recon.blockers.join('; ') || recon.status}`)
  }

  const packages = await prisma.dispatchPackage.findMany({
    where: {
      tenantId,
      packingSessionId: session.id,
      status: { not: 'CANCELLED' },
    },
    include: {
      lines: { where: { status: { in: ['PACKED', 'MOVED'] } } },
      packageType: { select: { code: true, name: true } },
    },
  })
  const packagesWithQty = packages.filter((p) => p.lines.length > 0)
  if (!packagesWithQty.length) throw new ValidationError('No packed packages to include on challan')
  const packagesToUse = packagesWithQty
  const packageLines = packagesToUse.flatMap((p) => p.lines.map((l) => ({ ...l, packageId: p.id })))

  const itemIds = [...new Set(packageLines.map((l) => l.itemId))]
  const items = await prisma.masterItem.findMany({
    where: { tenantId, id: { in: itemIds } },
    select: { id: true, code: true, name: true, hsnCode: true, baseUomId: true, baseUom: { select: { code: true } } },
  })
  const itemById = new Map(items.map((i) => [i.id, i]))

  const byDispatchLine = new Map<string, typeof packageLines>()
  for (const pl of packageLines) {
    const arr = byDispatchLine.get(pl.outboundDispatchLineId) ?? []
    arr.push(pl)
    byDispatchLine.set(pl.outboundDispatchLineId, arr)
  }

  let customerSnapshot: Prisma.InputJsonValue = {
    customerId: dispatch.customerId,
    name: null as string | null,
    code: null as string | null,
    gstin: null as string | null,
  }
  if (dispatch.customerId) {
    const company = await prisma.crmCompany.findFirst({
      where: { id: dispatch.customerId, tenantId, deletedAt: null },
      select: { id: true, name: true, companyCode: true, gstin: true },
    })
    if (company) {
      customerSnapshot = {
        customerId: company.id,
        name: company.name,
        code: company.companyCode,
        gstin: company.gstin,
      }
    }
  }

  const shipToSnapshot: Prisma.InputJsonValue = {
    shipToKey: dispatch.shipToKey,
    address: dispatch.shipToAddress,
  }

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { name: true, slug: true },
  })
  const legalEntitySnapshot: Prisma.InputJsonValue = {
    name: tenant?.name ?? 'Tenant',
    slug: tenant?.slug ?? null,
    note: 'Legal-entity snapshot from tenant (branch/GSTIN optional until linked on outbound)',
  }

  const salesOrderRefs: Prisma.InputJsonValue = [
    ...new Set(
      packageLines
        .map((l) => l.salesOrderId)
        .filter((id): id is string => Boolean(id))
        .concat(dispatch.salesOrderId ? [dispatch.salesOrderId] : []),
    ),
  ].map((id) => ({ salesOrderId: id, salesOrderNo: dispatch.salesOrderNo }))

  const fingerprint = await packingFingerprint(tenantId, session.id)
  const documentDate = parseDate(input.documentDate) ?? new Date()
  const movementDate = parseDate(input.movementDate ?? null)
  const movementReason = (input.movementReason ?? 'SALES_DELIVERY') as DeliveryChallanMovementReason
  if (movementReason === 'OTHER' && !input.remarks?.trim()) {
    throw new ValidationError('Remarks are required when movement reason is OTHER')
  }

  const row = await prisma.$transaction(async (tx) => {
    const challan = await tx.deliveryChallan.create({
      data: {
        tenantId,
        status: 'DRAFT',
        versionNumber: 1,
        outboundDispatchId: dispatchId,
        packingSessionId: session.id,
        customerId: dispatch.customerId,
        shipToKey: dispatch.shipToKey,
        sourceWarehouseId: session.warehouseId,
        documentDate,
        movementDate,
        movementReason,
        remarks: input.remarks,
        sourceFingerprint: fingerprint,
        customerSnapshotJson: customerSnapshot,
        shipToSnapshotJson: shipToSnapshot,
        legalEntitySnapshotJson: legalEntitySnapshot,
        salesOrderRefsJson: salesOrderRefs,
        idempotencyKey: input.idempotencyKey,
        createdBy: userId(req),
        updatedBy: userId(req),
      },
    })

    let lineNumber = 0
    let totalQty = 0
    let gross = 0
    let net = 0
    const lineIdByDispatchLine = new Map<string, string>()

    for (const [outboundDispatchLineId, pls] of byDispatchLine) {
      lineNumber += 1
      const qty = roundQty(pls.reduce((s, l) => s + n(l.packedQuantity), 0))
      totalQty = roundQty(totalQty + qty)
      const first = pls[0]!
      const item = itemById.get(first.itemId)
      const createdLine = await tx.deliveryChallanLine.create({
        data: {
          tenantId,
          deliveryChallanId: challan.id,
          lineNumber,
          outboundDispatchLineId,
          dispatchRequirementId: first.dispatchRequirementId,
          salesOrderId: first.salesOrderId,
          salesOrderLineId: first.salesOrderLineId,
          packingSessionId: session.id,
          itemId: first.itemId,
          itemCodeSnapshot: item?.code ?? 'UNKNOWN',
          itemNameSnapshot: item?.name ?? 'Unknown item',
          hsnSacSnapshot: item?.hsnCode || null,
          uomId: item?.baseUomId ?? null,
          uomCodeSnapshot: item?.baseUom?.code ?? null,
          packedQuantity: qty,
          challanQuantity: qty,
          packageCount: new Set(pls.map((p) => p.packageId)).size,
        },
      })
      lineIdByDispatchLine.set(outboundDispatchLineId, createdLine.id)

      for (const pl of pls) {
        if (!pl.lotRef && !pl.serialRef && !pl.heatNumber) continue
        await tx.deliveryChallanTrackingAllocation.create({
          data: {
            tenantId,
            deliveryChallanId: challan.id,
            deliveryChallanLineId: createdLine.id,
            packageId: pl.packageId,
            lotRef: pl.lotRef,
            serialRef: pl.serialRef,
            heatNumber: pl.heatNumber,
            quantity: pl.packedQuantity,
          },
        })
      }
    }

    for (const pkg of packagesToUse) {
      gross += n(pkg.grossWeight)
      net += n(pkg.netWeight)
      const dims =
        pkg.length != null && pkg.width != null && pkg.height != null
          ? `${n(pkg.length)}x${n(pkg.width)}x${n(pkg.height)}`
          : null
      await tx.deliveryChallanPackage.create({
        data: {
          tenantId,
          deliveryChallanId: challan.id,
          packageId: pkg.id,
          packageNumberSnapshot: pkg.packageNumber,
          packageTypeSnapshot: pkg.packageTypeCodeSnapshot ?? pkg.packageType?.code ?? null,
          grossWeight: pkg.grossWeight,
          netWeight: pkg.netWeight,
          dimensionsSnapshot: dims,
          sealNumberSnapshot: pkg.sealNumber,
          status: 'ACTIVE',
        },
      })
    }

    return tx.deliveryChallan.update({
      where: { id: challan.id },
      data: {
        totalPackages: packagesToUse.length,
        totalQuantity: totalQty,
        grossWeight: gross || null,
        netWeight: net || null,
        updatedBy: userId(req),
      },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        packages: true,
        tracking: true,
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
        packingSession: { select: { packingSessionNumber: true, status: true } },
      },
    })
  })

  return mapChallan(row)
}

export async function listChallans(
  tenantId: string,
  query: {
    page?: number
    limit?: number
    sortOrder?: 'asc' | 'desc'
    search?: string
    sortBy?: string
    status?: string
    outboundDispatchId?: string
    q?: string
  },
) {
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: query.sortOrder ?? 'desc',
    search: query.search,
    sortBy: query.sortBy,
  })
  const where: Prisma.DeliveryChallanWhereInput = {
    tenantId,
    deletedAt: null,
    ...(query.status ? { status: query.status as never } : {}),
    ...(query.outboundDispatchId ? { outboundDispatchId: query.outboundDispatchId } : {}),
    ...(query.q
      ? {
          OR: [
            { challanNumber: { contains: query.q } },
            { outboundDispatch: { dispatchNo: { contains: query.q } } },
          ],
        }
      : {}),
  }
  const [total, rows] = await Promise.all([
    prisma.deliveryChallan.count({ where }),
    prisma.deliveryChallan.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
      include: {
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
        packingSession: { select: { packingSessionNumber: true, status: true } },
      },
    }),
  ])
  return { total, page, limit, items: rows.map(mapChallan) }
}

export async function getChallan(tenantId: string, id: string) {
  return mapChallan(await loadChallan(tenantId, id))
}

export async function updateChallan(req: Request, tenantId: string, id: string, input: UpdateChallanInput) {
  const existing = await loadChallan(tenantId, id)
  if (!['DRAFT', 'SENT_BACK'].includes(existing.status)) {
    throw new InvalidStateError('Only DRAFT or SENT_BACK challans can be edited')
  }
  if (input.sourceVersion != null && input.sourceVersion !== existing.sourceVersion) {
    throw new ConflictError('Challan was updated by another user')
  }
  if (input.movementReason === 'OTHER' && !(input.remarks ?? existing.remarks)?.trim()) {
    throw new ValidationError('Remarks are required when movement reason is OTHER')
  }

  const row = await prisma.deliveryChallan.update({
    where: { id },
    data: {
      documentDate: input.documentDate !== undefined ? parseDate(input.documentDate)! : undefined,
      movementDate: input.movementDate !== undefined ? parseDate(input.movementDate) : undefined,
      movementReason: input.movementReason,
      transportMode: input.transportMode === undefined ? undefined : input.transportMode,
      transporterName: input.transporterName === undefined ? undefined : input.transporterName,
      transporterDocumentRef: input.transporterDocumentRef === undefined ? undefined : input.transporterDocumentRef,
      vehicleNumber: input.vehicleNumber === undefined ? undefined : input.vehicleNumber?.trim().toUpperCase() ?? null,
      driverName: input.driverName === undefined ? undefined : input.driverName,
      driverPhone: input.driverPhone === undefined ? undefined : input.driverPhone,
      lrGrNumber: input.lrGrNumber === undefined ? undefined : input.lrGrNumber,
      lrGrDate: input.lrGrDate !== undefined ? parseDate(input.lrGrDate) : undefined,
      destination: input.destination === undefined ? undefined : input.destination,
      remarks: input.remarks === undefined ? undefined : input.remarks,
      termsText: input.termsText === undefined ? undefined : input.termsText,
      sourceVersion: { increment: 1 },
      updatedBy: userId(req),
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      packages: true,
      tracking: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      packingSession: { select: { packingSessionNumber: true, status: true } },
    },
  })
  return mapChallan(row)
}

export async function refreshFromPacking(req: Request, tenantId: string, id: string) {
  const existing = await loadChallan(tenantId, id)
  if (!['DRAFT', 'SENT_BACK'].includes(existing.status)) {
    throw new InvalidStateError('Only DRAFT or SENT_BACK challans can refresh from packing')
  }
  // Recreate by cancel + create is heavy; instead update fingerprint after revalidate
  const recon = await reconcileDispatchForChallan(tenantId, existing.outboundDispatchId)
  if (recon.status !== 'RECONCILED') {
    throw new ConflictError(`Cannot refresh: ${recon.blockers.join('; ') || recon.status}`)
  }
  const fingerprint = await packingFingerprint(tenantId, existing.packingSessionId)
  const row = await prisma.deliveryChallan.update({
    where: { id },
    data: {
      sourceFingerprint: fingerprint,
      sourceVersion: { increment: 1 },
      updatedBy: userId(req),
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      packages: true,
      tracking: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      packingSession: { select: { packingSessionNumber: true, status: true } },
    },
  })
  return mapChallan(row)
}

async function transition(
  req: Request,
  tenantId: string,
  id: string,
  from: string[],
  to: Parameters<typeof prisma.deliveryChallan.update>[0]['data'] extends infer D ? D : never,
) {
  const existing = await loadChallan(tenantId, id)
  if (!from.includes(existing.status)) {
    throw new InvalidStateError(`Cannot transition from ${existing.status}`)
  }
  const row = await prisma.deliveryChallan.update({
    where: { id },
    data: { ...to, sourceVersion: { increment: 1 }, updatedBy: userId(req) },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      packages: true,
      tracking: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      packingSession: { select: { packingSessionNumber: true, status: true } },
    },
  })
  return mapChallan(row)
}

export async function readyForReview(req: Request, tenantId: string, id: string) {
  const existing = await loadChallan(tenantId, id)
  const recon = await reconcileDispatchForChallan(tenantId, existing.outboundDispatchId)
  if (recon.status !== 'RECONCILED') {
    throw new ConflictError(`Cannot submit: ${recon.blockers.join('; ') || recon.status}`)
  }
  const fp = await packingFingerprint(tenantId, existing.packingSessionId)
  if (existing.sourceFingerprint && existing.sourceFingerprint !== fp) {
    throw new ConflictError('Packing changed after this Challan was prepared. Refresh before submit.')
  }
  return transition(req, tenantId, id, ['DRAFT', 'SENT_BACK'], { status: 'READY_FOR_REVIEW' })
}

export async function sendBack(req: Request, tenantId: string, id: string, reason: string) {
  if (!reason?.trim()) throw new ValidationError('Reason is required')
  return transition(req, tenantId, id, ['READY_FOR_REVIEW', 'APPROVED'], {
    status: 'SENT_BACK',
    sentBackAt: new Date(),
    sentBackBy: userId(req),
    sendBackReason: reason,
  })
}

export async function approve(req: Request, tenantId: string, id: string) {
  return transition(req, tenantId, id, ['READY_FOR_REVIEW'], {
    status: 'APPROVED',
    approvedAt: new Date(),
    approvedBy: userId(req),
  })
}

export async function issue(req: Request, tenantId: string, id: string, opts?: { idempotencyKey?: string; sourceVersion?: number }) {
  const existing = await loadChallan(tenantId, id)
  if (existing.status === 'ISSUED') return mapChallan(existing)
  if (!['APPROVED', 'READY_FOR_REVIEW'].includes(existing.status)) {
    throw new InvalidStateError(`Cannot issue from ${existing.status}`)
  }
  if (opts?.sourceVersion != null && opts.sourceVersion !== existing.sourceVersion) {
    throw new ConflictError('Challan was updated by another user')
  }

  const recon = await reconcileDispatchForChallan(tenantId, existing.outboundDispatchId)
  if (recon.status !== 'RECONCILED') {
    throw new ConflictError(`Cannot issue: ${recon.blockers.join('; ') || recon.status}`)
  }
  const fp = await packingFingerprint(tenantId, existing.packingSessionId)
  if (existing.sourceFingerprint && existing.sourceFingerprint !== fp) {
    throw new ConflictError('Packing changed after this Challan was prepared.')
  }

  const row = await prisma.$transaction(async (tx) => {
    const locked = await tx.deliveryChallan.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        packages: true,
        tracking: true,
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
        packingSession: { select: { packingSessionNumber: true, status: true } },
      },
    })
    if (!locked) throw new NotFoundError('Delivery challan not found')
    if (locked.status === 'ISSUED') return locked

    const number = locked.challanNumber ?? (await nextCode(tenantId, 'DELIVERY_CHALLAN', tx))
    const issuedAt = new Date()
    const issuedBy = userId(req)
    const html = buildChallanHtml({
      ...locked,
      challanNumber: number,
      status: 'ISSUED',
      issuedAt,
      issuedBy,
    })

    return tx.deliveryChallan.update({
      where: { id },
      data: {
        status: 'ISSUED',
        challanNumber: number,
        issuedAt,
        issuedBy,
        approvedAt: locked.approvedAt ?? issuedAt,
        approvedBy: locked.approvedBy ?? issuedBy,
        documentHtml: html,
        documentGenStatus: 'GENERATED',
        documentGenError: null,
        sourceFingerprint: fp,
        sourceVersion: { increment: 1 },
        updatedBy: issuedBy,
      },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        packages: true,
        tracking: true,
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
        packingSession: { select: { packingSessionNumber: true, status: true } },
      },
    })
  })

  return mapChallan(row)
}

export async function cancel(req: Request, tenantId: string, id: string, reason: string) {
  if (!reason?.trim()) throw new ValidationError('Reason is required')
  const existing = await loadChallan(tenantId, id)
  if (['CANCELLED', 'SUPERSEDED'].includes(existing.status)) {
    throw new InvalidStateError(`Cannot cancel ${existing.status} challan`)
  }
  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: existing.outboundDispatchId, tenantId },
    select: { status: true },
  })
  if (dispatch?.status === 'CONFIRMED') {
    throw new ConflictError('Cannot cancel Delivery Challan after Dispatch is confirmed (Phase 7C5 policy)')
  }
  return transition(req, tenantId, id, ['DRAFT', 'SENT_BACK', 'READY_FOR_REVIEW', 'APPROVED', 'ISSUED'], {
    status: 'CANCELLED',
    cancelledAt: new Date(),
    cancelledBy: userId(req),
    cancellationReason: reason,
  })
}

export async function supersede(req: Request, tenantId: string, id: string, reason: string) {
  if (!reason?.trim()) throw new ValidationError('Reason is required')
  const existing = await loadChallan(tenantId, id)
  if (existing.status !== 'ISSUED') throw new InvalidStateError('Only ISSUED challans can be superseded')
  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: existing.outboundDispatchId, tenantId },
    select: { status: true },
  })
  if (dispatch?.status === 'CONFIRMED') {
    throw new ConflictError('Cannot supersede after Dispatch is confirmed')
  }

  const replacement = await prisma.$transaction(async (tx) => {
    await tx.deliveryChallan.update({
      where: { id },
      data: {
        status: 'SUPERSEDED',
        documentGenStatus: 'SUPERSEDED',
        sourceVersion: { increment: 1 },
        updatedBy: userId(req),
        remarks: `${existing.remarks ?? ''}\nSuperseded: ${reason}`.trim(),
      },
    })

    const draft = await tx.deliveryChallan.create({
      data: {
        tenantId,
        status: 'DRAFT',
        versionNumber: existing.versionNumber + 1,
        supersedesChallanId: existing.id,
        outboundDispatchId: existing.outboundDispatchId,
        packingSessionId: existing.packingSessionId,
        customerId: existing.customerId,
        shipToKey: existing.shipToKey,
        sourceWarehouseId: existing.sourceWarehouseId,
        documentDate: new Date(),
        movementDate: existing.movementDate,
        movementReason: existing.movementReason,
        transportMode: existing.transportMode,
        transporterName: existing.transporterName,
        transporterDocumentRef: existing.transporterDocumentRef,
        vehicleNumber: existing.vehicleNumber,
        driverName: existing.driverName,
        driverPhone: existing.driverPhone,
        lrGrNumber: existing.lrGrNumber,
        lrGrDate: existing.lrGrDate,
        eWayBillReference: existing.eWayBillReference,
        eWayBillDate: existing.eWayBillDate,
        destination: existing.destination,
        totalPackages: existing.totalPackages,
        totalQuantity: existing.totalQuantity,
        grossWeight: existing.grossWeight,
        netWeight: existing.netWeight,
        weightUomId: existing.weightUomId,
        remarks: `Replacement for ${existing.challanNumber}. Reason: ${reason}`,
        termsText: existing.termsText,
        sourceFingerprint: existing.sourceFingerprint,
        customerSnapshotJson: existing.customerSnapshotJson ?? undefined,
        shipToSnapshotJson: existing.shipToSnapshotJson ?? undefined,
        legalEntitySnapshotJson: existing.legalEntitySnapshotJson ?? undefined,
        salesOrderRefsJson: existing.salesOrderRefsJson ?? undefined,
        createdBy: userId(req),
        updatedBy: userId(req),
      },
    })

    for (const line of existing.lines) {
      const newLine = await tx.deliveryChallanLine.create({
        data: {
          tenantId,
          deliveryChallanId: draft.id,
          lineNumber: line.lineNumber,
          outboundDispatchLineId: line.outboundDispatchLineId,
          dispatchRequirementId: line.dispatchRequirementId,
          salesOrderId: line.salesOrderId,
          salesOrderLineId: line.salesOrderLineId,
          packingSessionId: line.packingSessionId,
          itemId: line.itemId,
          itemCodeSnapshot: line.itemCodeSnapshot,
          itemNameSnapshot: line.itemNameSnapshot,
          itemDescriptionSnapshot: line.itemDescriptionSnapshot,
          hsnSacSnapshot: line.hsnSacSnapshot,
          uomId: line.uomId,
          uomCodeSnapshot: line.uomCodeSnapshot,
          packedQuantity: line.packedQuantity,
          challanQuantity: line.challanQuantity,
          packageCount: line.packageCount,
          grossWeight: line.grossWeight,
          netWeight: line.netWeight,
          remarks: line.remarks,
        },
      })
      for (const tr of existing.tracking.filter((t) => t.deliveryChallanLineId === line.id)) {
        await tx.deliveryChallanTrackingAllocation.create({
          data: {
            tenantId,
            deliveryChallanId: draft.id,
            deliveryChallanLineId: newLine.id,
            packageId: tr.packageId,
            lotRef: tr.lotRef,
            serialRef: tr.serialRef,
            heatNumber: tr.heatNumber,
            quantity: tr.quantity,
          },
        })
      }
    }

    for (const pkg of existing.packages) {
      await tx.deliveryChallanPackage.create({
        data: {
          tenantId,
          deliveryChallanId: draft.id,
          packageId: pkg.packageId,
          packageNumberSnapshot: pkg.packageNumberSnapshot,
          packageTypeSnapshot: pkg.packageTypeSnapshot,
          grossWeight: pkg.grossWeight,
          netWeight: pkg.netWeight,
          dimensionsSnapshot: pkg.dimensionsSnapshot,
          sealNumberSnapshot: pkg.sealNumberSnapshot,
          status: 'ACTIVE',
        },
      })
    }

    await tx.deliveryChallan.update({
      where: { id: existing.id },
      data: { supersededByChallanId: draft.id },
    })

    return tx.deliveryChallan.findFirstOrThrow({
      where: { id: draft.id },
      include: {
        lines: { orderBy: { lineNumber: 'asc' } },
        packages: true,
        tracking: true,
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
        packingSession: { select: { packingSessionNumber: true, status: true } },
      },
    })
  })

  return mapChallan(replacement)
}

export async function getPreviewHtml(tenantId: string, id: string): Promise<{ html: string; filename: string; status: string }> {
  const row = await loadChallan(tenantId, id)
  if (row.status === 'ISSUED' && row.documentHtml) {
    return {
      html: row.documentHtml,
      filename: `${row.challanNumber ?? 'challan'}.html`,
      status: row.status,
    }
  }
  const html = buildChallanHtml(row)
  return {
    html,
    filename: `DRAFT-${row.id.slice(0, 8)}.html`,
    status: row.status,
  }
}

export async function generateDraftPreview(req: Request, tenantId: string, id: string) {
  const row = await loadChallan(tenantId, id)
  if (row.status === 'ISSUED') throw new InvalidStateError('Issued challan uses immutable document')
  const html = buildChallanHtml(row)
  const updated = await prisma.deliveryChallan.update({
    where: { id },
    data: {
      documentHtml: html,
      documentGenStatus: 'GENERATED',
      updatedBy: userId(req),
      sourceVersion: { increment: 1 },
    },
    include: {
      lines: { orderBy: { lineNumber: 'asc' } },
      packages: true,
      tracking: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      packingSession: { select: { packingSessionNumber: true, status: true } },
    },
  })
  return mapChallan(updated)
}

export async function getChallanPosition(tenantId: string, dispatchId: string) {
  const recon = await reconcileDispatchForChallan(tenantId, dispatchId)
  const challans = await prisma.deliveryChallan.findMany({
    where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null },
    orderBy: { versionNumber: 'desc' },
    include: {
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      packingSession: { select: { packingSessionNumber: true, status: true } },
    },
  })
  return { reconciliation: recon, challans: challans.map(mapChallan) }
}

export async function getSessionReconciliation(tenantId: string, challanId: string) {
  const row = await loadChallan(tenantId, challanId)
  return reconcileDispatchForChallan(tenantId, row.outboundDispatchId)
}

/** Stable hash helper for fingerprints (exported for tests). */
export function shaShort(input: string): string {
  return createHash('sha256').update(input).digest('hex').slice(0, 32)
}
