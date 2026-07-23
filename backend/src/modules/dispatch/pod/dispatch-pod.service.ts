/**
 * Proof of Delivery — logistics confirmation after posted Dispatch.
 * Never creates inventory movements; stock already issued at FG_DISPATCH post.
 */
import type { Request } from 'express'
import { randomUUID } from 'crypto'
import type { DispatchPodAttachmentKind, DispatchPodStatus } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  UnprocessableEntityError,
  ValidationError,
} from '../../../utils/errors.js'
import {
  getAttachmentExtension,
  saveDispatchPodFile,
} from '../../../services/fileStorage.service.js'
import { getDispatchPostingPolicy } from '../posting/dispatch-policy.js'
import type {
  CapturePodInput,
  MarkInTransitInput,
  PodAttachmentInput,
  PodExceptionInput,
} from './dispatch-pod.schemas.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertView(req: Request) {
  if (!hasPerm(req, 'dispatch.pod.view') && !hasPerm(req, 'dispatch.view')) {
    throw new AuthorizationError('Missing permission: dispatch.pod.view')
  }
}

function assertRecord(req: Request) {
  if (!hasPerm(req, 'dispatch.pod.record') && !hasPerm(req, 'dispatch.post')) {
    throw new AuthorizationError('Missing permission: dispatch.pod.record')
  }
}

function userId(req: Request): string | null {
  return req.context?.userId ?? null
}

function n(v: unknown): number {
  return Number(v ?? 0)
}

const POD_INVOICE_OK: DispatchPodStatus[] = ['DELIVERED', 'PARTIALLY_DELIVERED']

export function isPodStatusInvoiceReady(status: DispatchPodStatus | null | undefined): boolean {
  return status != null && POD_INVOICE_OK.includes(status)
}

export async function assertPodAllowsInvoice(tenantId: string, outboundDispatchId: string): Promise<void> {
  const policy = getDispatchPostingPolicy({ forceHardened: true })
  if (!policy.requirePodBeforeInvoice) return
  const pod = await prisma.dispatchProofOfDelivery.findFirst({
    where: { tenantId, outboundDispatchId },
    select: { status: true },
  })
  if (!isPodStatusInvoiceReady(pod?.status)) {
    throw new UnprocessableEntityError(
      'Proof of Delivery must be DELIVERED or PARTIALLY_DELIVERED before invoice (policy requirePodBeforeInvoice)',
      'POD_REQUIRED_BEFORE_INVOICE',
    )
  }
}

function serializePod(row: {
  id: string
  outboundDispatchId: string
  deliveryChallanId: string | null
  salesOrderId: string | null
  customerId: string | null
  status: string
  deliveryAddress: string | null
  deliveredAt: Date | null
  receiverName: string | null
  receiverContact: string | null
  signatureStorageKey: string | null
  quantityDelivered: { toString(): string }
  quantityDamaged: { toString(): string }
  quantityShort: { toString(): string }
  deliveryRemarks: string | null
  transporterRemarks: string | null
  exceptionCode: string | null
  exceptionNotes: string | null
  gpsLatitude: { toString(): string } | null
  gpsLongitude: { toString(): string } | null
  inTransitAt: Date | null
  capturedAt: Date | null
  createdAt: Date
  updatedAt: Date
  lines?: Array<{
    id: string
    outboundDispatchLineId: string
    itemId: string
    dispatchedQty: { toString(): string }
    deliveredQty: { toString(): string }
    damagedQty: { toString(): string }
    shortQty: { toString(): string }
    remarks: string | null
  }>
  attachments?: Array<{
    id: string
    kind: string
    fileName: string
    mimeType: string
    byteSize: number
    createdAt: Date
  }>
  outboundDispatch?: { dispatchNo: string; status: string; salesOrderNo: string | null } | null
}) {
  return {
    id: row.id,
    outboundDispatchId: row.outboundDispatchId,
    dispatchNo: row.outboundDispatch?.dispatchNo ?? null,
    outboundStatus: row.outboundDispatch?.status ?? null,
    deliveryChallanId: row.deliveryChallanId,
    salesOrderId: row.salesOrderId,
    salesOrderNo: row.outboundDispatch?.salesOrderNo ?? null,
    customerId: row.customerId,
    status: row.status,
    deliveryAddress: row.deliveryAddress,
    deliveredAt: row.deliveredAt?.toISOString() ?? null,
    receiverName: row.receiverName,
    receiverContact: row.receiverContact,
    hasSignature: Boolean(row.signatureStorageKey),
    quantityDelivered: n(row.quantityDelivered),
    quantityDamaged: n(row.quantityDamaged),
    quantityShort: n(row.quantityShort),
    deliveryRemarks: row.deliveryRemarks,
    transporterRemarks: row.transporterRemarks,
    exceptionCode: row.exceptionCode,
    exceptionNotes: row.exceptionNotes,
    gpsLatitude: row.gpsLatitude != null ? n(row.gpsLatitude) : null,
    gpsLongitude: row.gpsLongitude != null ? n(row.gpsLongitude) : null,
    inTransitAt: row.inTransitAt?.toISOString() ?? null,
    capturedAt: row.capturedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    lines: (row.lines ?? []).map((l) => ({
      id: l.id,
      outboundDispatchLineId: l.outboundDispatchLineId,
      itemId: l.itemId,
      dispatchedQty: n(l.dispatchedQty),
      deliveredQty: n(l.deliveredQty),
      damagedQty: n(l.damagedQty),
      shortQty: n(l.shortQty),
      remarks: l.remarks,
    })),
    attachments: (row.attachments ?? []).map((a) => ({
      id: a.id,
      kind: a.kind,
      fileName: a.fileName,
      mimeType: a.mimeType,
      byteSize: a.byteSize,
      createdAt: a.createdAt.toISOString(),
    })),
  }
}

async function loadOutboundOrThrow(tenantId: string, outboundDispatchId: string) {
  const row = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
    include: {
      lines: { orderBy: { lineNo: 'asc' } },
      deliveryChallans: {
        where: { deletedAt: null, status: 'ISSUED' },
        orderBy: { issuedAt: 'desc' },
        take: 1,
        select: { id: true },
      },
    },
  })
  if (!row) throw new NotFoundError('Outbound dispatch not found')
  return row
}

/**
 * After successful Dispatch post — open POD in IN_TRANSIT (idempotent).
 * Does not touch inventory.
 */
export async function ensurePodInTransitAfterPost(
  tenantId: string,
  outboundDispatchId: string,
  actorUserId: string | null,
): Promise<void> {
  const outbound = await loadOutboundOrThrow(tenantId, outboundDispatchId)
  if (outbound.status !== 'CONFIRMED') return

  const existing = await prisma.dispatchProofOfDelivery.findFirst({
    where: { tenantId, outboundDispatchId },
  })
  if (existing) {
    if (!outbound.deliveryStatus) {
      await prisma.outboundDispatch.update({
        where: { id: outboundDispatchId },
        data: { deliveryStatus: existing.status },
      })
    }
    return
  }

  const now = new Date()
  await prisma.$transaction(async (tx) => {
    const pod = await tx.dispatchProofOfDelivery.create({
      data: {
        id: randomUUID(),
        tenantId,
        outboundDispatchId,
        deliveryChallanId: outbound.deliveryChallans[0]?.id ?? null,
        salesOrderId: outbound.salesOrderId,
        customerId: outbound.customerId,
        status: 'IN_TRANSIT',
        deliveryAddress: outbound.shipToAddress,
        inTransitAt: now,
        inTransitBy: actorUserId,
        createdBy: actorUserId,
        lines: {
          create: outbound.lines.map((line) => ({
            id: randomUUID(),
            tenantId,
            outboundDispatchLineId: line.id,
            itemId: line.itemId,
            dispatchedQty: line.quantity,
            deliveredQty: 0,
            damagedQty: 0,
            shortQty: 0,
          })),
        },
      },
    })
    await tx.outboundDispatch.update({
      where: { id: outboundDispatchId },
      data: { deliveryStatus: 'IN_TRANSIT' },
    })
    void pod
  })
}

export async function getPodForOutbound(req: Request, tenantId: string, outboundDispatchId: string) {
  assertView(req)
  const row = await prisma.dispatchProofOfDelivery.findFirst({
    where: { tenantId, outboundDispatchId },
    include: {
      lines: true,
      attachments: { orderBy: { createdAt: 'asc' } },
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
    },
  })
  if (!row) {
    const outbound = await loadOutboundOrThrow(tenantId, outboundDispatchId)
    return {
      pod: null,
      outbound: {
        id: outbound.id,
        dispatchNo: outbound.dispatchNo,
        status: outbound.status,
        deliveryStatus: outbound.deliveryStatus,
        salesOrderId: outbound.salesOrderId,
        salesOrderNo: outbound.salesOrderNo,
        customerId: outbound.customerId,
        shipToAddress: outbound.shipToAddress,
      },
      stockNote: 'POD does not modify stock — FG already issued on Dispatch post when CONFIRMED.',
    }
  }
  return {
    pod: serializePod(row),
    outbound: {
      id: outboundDispatchId,
      dispatchNo: row.outboundDispatch?.dispatchNo ?? null,
      status: row.outboundDispatch?.status ?? null,
      deliveryStatus: row.status,
      salesOrderId: row.salesOrderId,
      salesOrderNo: row.outboundDispatch?.salesOrderNo ?? null,
      customerId: row.customerId,
      shipToAddress: row.deliveryAddress,
    },
    stockNote: 'POD does not modify stock — FG already issued on Dispatch post when CONFIRMED.',
  }
}

export async function markInTransit(
  req: Request,
  tenantId: string,
  outboundDispatchId: string,
  _input: MarkInTransitInput,
) {
  assertRecord(req)
  const actor = userId(req)
  const outbound = await loadOutboundOrThrow(tenantId, outboundDispatchId)
  if (outbound.status !== 'CONFIRMED') {
    throw new UnprocessableEntityError(
      'POD in-transit requires posted (CONFIRMED) dispatch',
      'POD_REQUIRES_CONFIRMED',
    )
  }
  await ensurePodInTransitAfterPost(tenantId, outboundDispatchId, actor)
  const row = await prisma.dispatchProofOfDelivery.findFirstOrThrow({
    where: { tenantId, outboundDispatchId },
    include: {
      lines: true,
      attachments: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
    },
  })
  if (row.status !== 'IN_TRANSIT') {
    await prisma.dispatchProofOfDelivery.update({
      where: { id: row.id },
      data: {
        status: 'IN_TRANSIT',
        inTransitAt: row.inTransitAt ?? new Date(),
        inTransitBy: actor,
        updatedBy: actor,
      },
    })
    await prisma.outboundDispatch.update({
      where: { id: outboundDispatchId },
      data: { deliveryStatus: 'IN_TRANSIT' },
    })
  }
  const refreshed = await prisma.dispatchProofOfDelivery.findFirstOrThrow({
    where: { id: row.id },
    include: {
      lines: true,
      attachments: true,
      outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
    },
  })
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'dispatch',
    entity: 'dispatch_proof_of_delivery',
    entityId: refreshed.id,
    action: 'POD_IN_TRANSIT',
    newValues: { outboundDispatchId, status: 'IN_TRANSIT' },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
  return serializePod(refreshed)
}

function deriveStatus(input: {
  status?: DispatchPodStatus
  quantityDelivered: number
  quantityDamaged: number
  quantityShort: number
  totalDispatched: number
}): DispatchPodStatus {
  if (input.status) return input.status
  if (input.quantityDelivered <= 0 && (input.quantityDamaged > 0 || input.quantityShort > 0)) {
    return 'DELIVERY_EXCEPTION'
  }
  if (input.quantityDelivered + input.quantityDamaged + input.quantityShort < input.totalDispatched - 0.0001) {
    return 'PARTIALLY_DELIVERED'
  }
  if (input.quantityShort > 0 || input.quantityDamaged > 0) {
    if (input.quantityDelivered > 0) return 'PARTIALLY_DELIVERED'
    return 'DELIVERY_EXCEPTION'
  }
  return 'DELIVERED'
}

export async function capturePod(
  req: Request,
  tenantId: string,
  outboundDispatchId: string,
  input: CapturePodInput,
) {
  assertRecord(req)
  const actor = userId(req)
  const outbound = await loadOutboundOrThrow(tenantId, outboundDispatchId)
  if (outbound.status !== 'CONFIRMED') {
    throw new UnprocessableEntityError(
      'Capture POD requires posted (CONFIRMED) dispatch',
      'POD_REQUIRES_CONFIRMED',
    )
  }
  if (outbound.status === ('REVERSED' as typeof outbound.status)) {
    throw new ConflictError('Cannot capture POD on reversed dispatch')
  }

  await ensurePodInTransitAfterPost(tenantId, outboundDispatchId, actor)
  const pod = await prisma.dispatchProofOfDelivery.findFirstOrThrow({
    where: { tenantId, outboundDispatchId },
    include: { lines: true },
  })

  if (['RETURN_INITIATED'].includes(pod.status) && input.status !== 'RETURN_INITIATED') {
    throw new UnprocessableEntityError('POD is locked after return initiation', 'POD_LOCKED')
  }

  const lineByOb = new Map(pod.lines.map((l) => [l.outboundDispatchLineId, l]))
  const updates: Array<{
    id: string
    deliveredQty: number
    damagedQty: number
    shortQty: number
    remarks: string | null
  }> = []

  let totalDelivered = 0
  let totalDamaged = 0
  let totalShort = 0
  let totalDispatched = 0

  for (const line of pod.lines) {
    totalDispatched += n(line.dispatchedQty)
  }

  if (input.lines?.length) {
    for (const lineIn of input.lines) {
      const existing = lineByOb.get(lineIn.outboundDispatchLineId)
      if (!existing) {
        throw new ValidationError('Unknown outbound dispatch line on POD', [
          { field: 'lines', message: lineIn.outboundDispatchLineId },
        ])
      }
      const dispatched = n(existing.dispatchedQty)
      const delivered = n(lineIn.deliveredQty)
      const damaged = n(lineIn.damagedQty ?? 0)
      const short = n(lineIn.shortQty ?? 0)
      if (delivered < 0 || damaged < 0 || short < 0) {
        throw new ValidationError('POD quantities cannot be negative')
      }
      if (delivered + damaged + short - dispatched > 0.0001) {
        throw new ValidationError(
          `Line ${lineIn.outboundDispatchLineId}: delivered+damaged+short exceeds dispatched qty ${dispatched}`,
        )
      }
      updates.push({
        id: existing.id,
        deliveredQty: delivered,
        damagedQty: damaged,
        shortQty: short,
        remarks: lineIn.remarks ?? null,
      })
      totalDelivered += delivered
      totalDamaged += damaged
      totalShort += short
    }
  } else {
    // Header-level capture: allocate delivered across lines proportionally / first-fit
    const headerDelivered = n(input.quantityDelivered ?? totalDispatched)
    const headerDamaged = n(input.quantityDamaged ?? 0)
    const headerShort = n(input.quantityShort ?? 0)
    if (headerDelivered + headerDamaged + headerShort - totalDispatched > 0.0001) {
      throw new ValidationError('Header delivered+damaged+short exceeds total dispatched qty')
    }
    let remainingD = headerDelivered
    let remainingDm = headerDamaged
    let remainingS = headerShort
    for (const line of pod.lines) {
      const cap = n(line.dispatchedQty)
      const d = Math.min(cap, remainingD)
      remainingD -= d
      const dm = Math.min(cap - d, remainingDm)
      remainingDm -= dm
      const s = Math.min(cap - d - dm, remainingS)
      remainingS -= s
      updates.push({
        id: line.id,
        deliveredQty: d,
        damagedQty: dm,
        shortQty: s,
        remarks: null,
      })
      totalDelivered += d
      totalDamaged += dm
      totalShort += s
    }
  }

  const status = deriveStatus({
    status: input.status as DispatchPodStatus | undefined,
    quantityDelivered: totalDelivered,
    quantityDamaged: totalDamaged,
    quantityShort: totalShort,
    totalDispatched,
  })

  const deliveredAt = input.deliveredAt ? new Date(input.deliveredAt) : new Date()

  const updated = await prisma.$transaction(async (tx) => {
    for (const u of updates) {
      await tx.dispatchPodLine.update({
        where: { id: u.id },
        data: {
          deliveredQty: u.deliveredQty,
          damagedQty: u.damagedQty,
          shortQty: u.shortQty,
          remarks: u.remarks,
        },
      })
    }
    return tx.dispatchProofOfDelivery.update({
      where: { id: pod.id },
      data: {
        status,
        deliveredAt,
        receiverName: input.receiverName ?? pod.receiverName,
        receiverContact: input.receiverContact ?? pod.receiverContact,
        deliveryAddress: input.deliveryAddress ?? pod.deliveryAddress,
        quantityDelivered: totalDelivered,
        quantityDamaged: totalDamaged,
        quantityShort: totalShort,
        deliveryRemarks: input.deliveryRemarks ?? pod.deliveryRemarks,
        transporterRemarks: input.transporterRemarks ?? pod.transporterRemarks,
        gpsLatitude: input.gpsLatitude ?? undefined,
        gpsLongitude: input.gpsLongitude ?? undefined,
        exceptionCode: input.exceptionCode ?? null,
        exceptionNotes: input.exceptionNotes ?? null,
        capturedAt: new Date(),
        capturedBy: actor,
        updatedBy: actor,
      },
      include: {
        lines: true,
        attachments: true,
        outboundDispatch: { select: { dispatchNo: true, status: true, salesOrderNo: true } },
      },
    })
  })

  await prisma.outboundDispatch.update({
    where: { id: outboundDispatchId },
    data: { deliveryStatus: status },
  })

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'dispatch',
    entity: 'dispatch_proof_of_delivery',
    entityId: updated.id,
    action: 'POD_CAPTURED',
    newValues: {
      status,
      quantityDelivered: totalDelivered,
      quantityDamaged: totalDamaged,
      quantityShort: totalShort,
    },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return serializePod(updated)
}

export async function recordPodException(
  req: Request,
  tenantId: string,
  outboundDispatchId: string,
  input: PodExceptionInput,
) {
  return capturePod(req, tenantId, outboundDispatchId, {
    status: input.status ?? 'DELIVERY_EXCEPTION',
    exceptionCode: input.exceptionCode,
    exceptionNotes: input.exceptionNotes,
    deliveryRemarks: input.deliveryRemarks,
    quantityDelivered: input.quantityDelivered,
    quantityDamaged: input.quantityDamaged,
    quantityShort: input.quantityShort,
    lines: input.lines,
  })
}

export async function addPodAttachment(
  req: Request,
  tenantId: string,
  outboundDispatchId: string,
  input: PodAttachmentInput,
) {
  assertRecord(req)
  const actor = userId(req)
  await ensurePodInTransitAfterPost(tenantId, outboundDispatchId, actor)
  const pod = await prisma.dispatchProofOfDelivery.findFirstOrThrow({
    where: { tenantId, outboundDispatchId },
  })

  const buf = Buffer.from(input.contentBase64, 'base64')
  if (!buf.length) throw new ValidationError('Empty attachment')
  if (buf.length > 10 * 1024 * 1024) throw new ValidationError('Attachment exceeds 10MB')

  const id = randomUUID()
  const ext = getAttachmentExtension(input.fileName) || '.bin'
  const storageKey = await saveDispatchPodFile(tenantId, id, buf, ext)

  if (input.kind === 'SIGNATURE') {
    await prisma.dispatchProofOfDelivery.update({
      where: { id: pod.id },
      data: { signatureStorageKey: storageKey, updatedBy: actor },
    })
  }

  const att = await prisma.dispatchPodAttachment.create({
    data: {
      id,
      tenantId,
      proofOfDeliveryId: pod.id,
      kind: input.kind as DispatchPodAttachmentKind,
      fileName: input.fileName,
      storageKey,
      mimeType: input.mimeType,
      byteSize: buf.length,
      createdBy: actor,
    },
  })

  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'dispatch',
    entity: 'dispatch_pod_attachment',
    entityId: att.id,
    action: 'POD_ATTACHMENT_ADDED',
    newValues: { kind: att.kind, fileName: att.fileName, outboundDispatchId },
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })

  return {
    id: att.id,
    kind: att.kind,
    fileName: att.fileName,
    mimeType: att.mimeType,
    byteSize: att.byteSize,
    createdAt: att.createdAt.toISOString(),
  }
}
