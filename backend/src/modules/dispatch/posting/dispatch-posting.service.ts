/**
 * Phase 7C5 — canonical Dispatch posting service.
 * All confirm/post paths that create FG_DISPATCH must route through this module.
 */
import type { Request } from 'express'
import type { InventoryStockMovement, OutboundDispatch } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError, AuthorizationError } from '../../../utils/errors.js'
import {
  assertDispatchQtyAllowed,
} from '../../crm/sales-orders/fulfilment/sales-order-fulfilment.service.js'
import { assertSalesOrderAllowsDispatch } from '../../crm/sales-orders/fulfilment/sales-order-dispatch-guard.service.js'
import { InventoryPostingService } from '../../inventory/shared/stock-posting.service.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import { resolveInventoryLegalEntityId } from '../../inventory/accounting/inventory-accounting-gate.service.js'
import { assertPickListsAllowConfirm } from '../picking/dispatch-pick-list.service.js'
import { assertPackingAllowsConfirm } from '../packing/dispatch-packing-reconciliation.service.js'
import { assertChallanAllowsConfirm } from '../challan/delivery-challan-reconciliation.service.js'
import { getReservationPosition } from '../reservation/dispatch-reservation.service.js'
import { synchroniseDispatchRequirements } from '../requirements/dispatch-requirement-sync.service.js'
import * as outboundRepo from '../outbound/outbound-dispatch.repository.js'
import { mapOutboundDispatch } from '../outbound/outbound-dispatch.mappers.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import { getDispatchPostingPolicy, buildEmergencyDispatchPolicy, type DispatchPostingPolicy } from './dispatch-policy.js'
import {
  createDispatchPostingInTx,
  fingerprintDispatchPostRequest,
} from './dispatch-posting-ledger.service.js'

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function canOverrideNegativeStock(req: Request): boolean {
  return (
    req.context?.permissions.includes('inventory.issues.override_negative_stock') === true ||
    req.context?.permissions.includes('tenant.manage') === true
  )
}

function hasDispatchOverride(req: Request): boolean {
  const p = req.context?.permissions ?? []
  return p.includes('dispatch.override') || p.includes('tenant.manage')
}

/**
 * Resolve policy for emergency post: requires dispatch.override.
 * Supervisor override satisfies requireSupervisorApprovalForOverride even when
 * allowDirectEmergencyDispatch is false (pilot default).
 */
export function resolveEmergencyPostingPolicy(
  req: Request,
  base: DispatchPostingPolicy,
): DispatchPostingPolicy {
  if (!hasDispatchOverride(req)) {
    throw new AuthorizationError('Emergency dispatch requires dispatch.override')
  }
  if (!base.allowDirectEmergencyDispatch && !base.requireSupervisorApprovalForOverride) {
    throw new ConflictError('Emergency dispatch is disabled by posting policy')
  }
  // requireSupervisorApprovalForOverride=true + override perm → allowed
  // allowDirectEmergencyDispatch=true → allowed with override
  return buildEmergencyDispatchPolicy(base)
}

async function refreshRequirementsForDispatch(
  tenantId: string,
  dispatch: { salesOrderId: string | null; lines: Array<{ salesOrderId: string | null }> },
  actorUserId?: string,
) {
  const soIds = new Set<string>()
  if (dispatch.salesOrderId) soIds.add(dispatch.salesOrderId)
  for (const line of dispatch.lines) {
    if (line.salesOrderId) soIds.add(line.salesOrderId)
  }
  for (const salesOrderId of soIds) {
    await synchroniseDispatchRequirements(tenantId, { salesOrderId, userId: actorUserId })
  }
}

export type DispatchPostMode = 'confirm' | 'post'

async function assertReservationAllowsPost(tenantId: string, dispatchId: string): Promise<void> {
  const position = await getReservationPosition(tenantId, dispatchId)
  for (const line of position.lines) {
    if (roundQty(line.unreservedQty) > 0) {
      throw new ConflictError(
        `Outbound post blocked: line ${line.lineNo} has ${line.unreservedQty} unreserved of ${line.dispatchQty} (Phase 7C5)`,
      )
    }
  }
}

async function assertPickRequired(tenantId: string, dispatchId: string): Promise<void> {
  const lists = await prisma.dispatchPickList.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
    },
    select: { id: true },
  })
  if (!lists.length) {
    throw new ConflictError(
      'Outbound post blocked: a completed Pick List is required before post (Phase 7C5)',
    )
  }
  await assertPickListsAllowConfirm(tenantId, dispatchId)
}

async function assertPackRequired(tenantId: string, dispatchId: string): Promise<void> {
  const sessions = await prisma.dispatchPackingSession.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      deletedAt: null,
      status: { not: 'CANCELLED' },
    },
    select: { id: true },
  })
  if (!sessions.length) {
    throw new ConflictError(
      'Outbound post blocked: a completed Packing Session is required before post (Phase 7C5)',
    )
  }
  await assertPackingAllowsConfirm(tenantId, dispatchId)
}

async function assertSerialLotAllocation(
  tenantId: string,
  dispatchId: string,
  policy: DispatchPostingPolicy,
): Promise<void> {
  if (!policy.requireSerialAllocation && !policy.requireLotAllocation) return

  const lines = await prisma.outboundDispatchLine.findMany({
    where: { outboundDispatchId: dispatchId, tenantId },
    select: { id: true, lineNo: true, quantity: true, itemId: true },
  })
  const items = await prisma.masterItem.findMany({
    where: { tenantId, id: { in: lines.map((l) => l.itemId) }, deletedAt: null },
    select: { id: true, serialTracked: true, batchTracked: true },
  })
  const itemById = new Map(items.map((i) => [i.id, i]))

  const allocations = await prisma.dispatchTrackingAllocation.findMany({
    where: {
      tenantId,
      outboundDispatchId: dispatchId,
      status: { not: 'CANCELLED' },
    },
    select: {
      outboundDispatchLineId: true,
      allocatedQuantity: true,
      serialRef: true,
      lotRef: true,
      inventorySerialId: true,
      inventoryLotId: true,
    },
  })

  for (const line of lines) {
    const item = itemById.get(line.itemId)
    const lineAllocs = allocations.filter((a) => a.outboundDispatchLineId === line.id)
    const allocQty = roundQty(lineAllocs.reduce((s, a) => s + n(a.allocatedQuantity), 0))
    const need = roundQty(n(line.quantity))

    if (policy.requireSerialAllocation && item?.serialTracked) {
      const serialOk = lineAllocs.every((a) => a.serialRef || a.inventorySerialId)
      if (!serialOk || allocQty + 1e-9 < need) {
        throw new ConflictError(
          `Outbound post blocked: serial allocation incomplete on line ${line.lineNo} (Phase 7C5)`,
        )
      }
      const refs = lineAllocs.map((a) => a.serialRef || a.inventorySerialId).filter(Boolean)
      if (new Set(refs).size !== refs.length) {
        throw new ConflictError(
          `Outbound post blocked: duplicate serial allocation on line ${line.lineNo} (Phase 7C5)`,
        )
      }
    }

    if (policy.requireLotAllocation && item?.batchTracked) {
      const lotOk = lineAllocs.every((a) => a.lotRef || a.inventoryLotId)
      if (!lotOk || allocQty + 1e-9 < need) {
        throw new ConflictError(
          `Outbound post blocked: lot/batch allocation incomplete on line ${line.lineNo} (Phase 7C5)`,
        )
      }
    }
  }
}

async function runPolicyGates(
  tenantId: string,
  dispatchId: string,
  policy: DispatchPostingPolicy,
): Promise<void> {
  if (policy.requireReservationBeforePosting) {
    await assertReservationAllowsPost(tenantId, dispatchId)
  }

  if (policy.requirePickBeforePosting) {
    await assertPickRequired(tenantId, dispatchId)
  } else {
    await assertPickListsAllowConfirm(tenantId, dispatchId)
  }

  if (policy.requirePackBeforePosting) {
    await assertPackRequired(tenantId, dispatchId)
  } else {
    await assertPackingAllowsConfirm(tenantId, dispatchId)
  }

  await assertChallanAllowsConfirm(tenantId, dispatchId, {
    requireIssuedChallan: policy.requireIssuedChallanBeforePosting,
  })

  await assertSerialLotAllocation(tenantId, dispatchId, policy)
}

async function loadDocumentRefs(tenantId: string, dispatchId: string) {
  const [pick, pack, challan] = await Promise.all([
    prisma.dispatchPickList.findFirst({
      where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null, status: 'PICKED' },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.dispatchPackingSession.findFirst({
      where: {
        tenantId,
        outboundDispatchId: dispatchId,
        deletedAt: null,
        status: { in: ['PACKED', 'VERIFIED'] },
      },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.deliveryChallan.findFirst({
      where: { tenantId, outboundDispatchId: dispatchId, deletedAt: null, status: 'ISSUED' },
      select: { id: true },
      orderBy: { updatedAt: 'desc' },
    }),
  ])
  return {
    pickListId: pick?.id ?? null,
    packingSessionId: pack?.id ?? null,
    deliveryChallanId: challan?.id ?? null,
  }
}

/**
 * Canonical FG_DISPATCH posting. Used by both `/confirm` and `/post`.
 * Creates immutable DispatchPosting + lines in the same transaction as Inventory ISSUE.
 */
export async function postFgDispatch(
  req: Request,
  tenantId: string,
  id: string,
  options: {
    mode: DispatchPostMode
    policy?: DispatchPostingPolicy
    idempotencyKey?: string
    /** Supervisor emergency post — softens document gates (requires dispatch.override). */
    emergency?: boolean
    overrideReason?: string
    emergencyOverride?: {
      businessReason: string
      urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
      riskAcknowledged: boolean
      approvedByName?: string
      approvalReference?: string
      expiresAt?: string
      scope?: string
      remarks?: string
      overrideId?: string
    }
  },
) {
  const existing = await outboundRepo.findById(tenantId, id)
  if (!existing) throw new NotFoundError('Outbound dispatch not found')
  if (existing.status === 'CONFIRMED') return mapOutboundDispatch(existing)
  if (existing.status === 'REVERSED') {
    throw new InvalidStateError('Reversed outbound dispatches cannot be re-posted; create a new draft')
  }
  if (existing.status !== 'DRAFT') {
    throw new InvalidStateError('Only DRAFT outbound dispatches can be posted')
  }
  if (!existing.lines.length) throw new ValidationError('Outbound dispatch has no lines')

  if (options.idempotencyKey) {
    const prior = await prisma.dispatchPosting.findFirst({
      where: { tenantId, idempotencyKey: options.idempotencyKey },
      select: { outboundDispatchId: true },
    })
    if (prior) {
      const row = await outboundRepo.findById(tenantId, prior.outboundDispatchId)
      if (row) return mapOutboundDispatch(row)
    }
  }

  let policy =
    options.policy ??
    getDispatchPostingPolicy({
      planningSource: existing.planningSource,
      forceHardened: options.mode === 'post' && existing.planningSource === 'WORKBENCH_7C1',
    })

  let emergencyOverrideId: string | null = null
  const emergencyReason =
    options.emergencyOverride?.businessReason?.trim() || options.overrideReason?.trim() || ''

  if (options.emergency) {
    policy = resolveEmergencyPostingPolicy(req, policy)

    const { getOutboundPostingReadiness } = await import('./dispatch-posting-readiness.service.js')
    const { grantEmergencyOverride, assertBlockersAllowEmergencyOverride } = await import(
      '../../shared/emergency-override/emergency-override.service.js'
    )

    // Evaluate blockers under normal (non-emergency) policy — never soft-bypass hard integrity codes.
    const readiness = await getOutboundPostingReadiness(tenantId, id, 'post')
    const blockers = readiness.hardBlockers.filter((b) => b.severity === 'BLOCKER')

    if (options.emergencyOverride?.overrideId) {
      emergencyOverrideId = options.emergencyOverride.overrideId
      assertBlockersAllowEmergencyOverride(blockers)
    } else {
      const granted = await grantEmergencyOverride({
        tenantId,
        module: 'dispatch',
        documentType: 'OUTBOUND_DISPATCH',
        documentId: id,
        documentNo: existing.dispatchNo,
        blockedAction: 'POST_DISPATCH',
        blockers,
        businessReason: emergencyReason,
        urgency: options.emergencyOverride?.urgency,
        riskAcknowledged: options.emergencyOverride?.riskAcknowledged ?? Boolean(emergencyReason),
        approvedByName: options.emergencyOverride?.approvedByName,
        approvedByUserId: userId(req) || null,
        approvalReference: options.emergencyOverride?.approvalReference,
        requestedByUserId: userId(req) || null,
        expiresAt: options.emergencyOverride?.expiresAt,
        scope: options.emergencyOverride?.scope,
        remarks: options.emergencyOverride?.remarks,
        grantImmediately: true,
        actorUserId: userId(req) || null,
      })
      emergencyOverrideId = granted.id
    }
  }

  await runPolicyGates(tenantId, id, policy)

  const confirmSalesOrders = new Set<string>()
  if (existing.salesOrderId) confirmSalesOrders.add(existing.salesOrderId)
  for (const line of existing.lines) {
    if (line.salesOrderId) confirmSalesOrders.add(line.salesOrderId)
  }
  for (const salesOrderId of confirmSalesOrders) {
    await assertSalesOrderAllowsDispatch(tenantId, salesOrderId)
  }

  for (const line of existing.lines) {
    if (line.salesOrderLineId && line.salesOrderId) {
      await assertDispatchQtyAllowed(
        tenantId,
        line.salesOrderId,
        line.salesOrderLineId,
        Number(line.quantity),
      )
    }
  }

  const allowNegative =
    policy.allowNegativeStock === true ? true : canOverrideNegativeStock(req)

  const refs = await loadDocumentRefs(tenantId, id)
  const requestFingerprint = fingerprintDispatchPostRequest({
    outboundDispatchId: id,
    mode: options.mode,
    lineIds: existing.lines.map((l) => l.id),
    quantities: existing.lines.map((l) => Number(l.quantity)),
  })

  const issueMovements: InventoryStockMovement[] = []
  const row = await prisma.$transaction(async (tx) => {
    const locked = await tx.outboundDispatch.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    })
    if (!locked) throw new NotFoundError('Outbound dispatch not found')
    if (locked.status === 'CONFIRMED') return locked
    if (locked.status !== 'DRAFT') {
      throw new InvalidStateError('Only DRAFT outbound dispatches can be posted')
    }

    const alreadyPosted = await tx.dispatchPosting.findFirst({
      where: { tenantId, outboundDispatchId: id },
      select: { id: true },
    })
    if (alreadyPosted) {
      throw new ConflictError('Outbound already has a DispatchPosting record')
    }

    const movementsByLineId = new Map<string, { id: string; movementNumber: string }>()

    for (const line of locked.lines) {
      if (line.salesOrderLineId && line.salesOrderId) {
        await assertDispatchQtyAllowed(
          tenantId,
          line.salesOrderId,
          line.salesOrderLineId,
          Number(line.quantity),
        )
      }

      const movementKey =
        options.idempotencyKey && locked.lines.length === 1
          ? options.idempotencyKey
          : `fg-dispatch:${id}:${line.id}`

      const lineAllocs = await tx.dispatchTrackingAllocation.findMany({
        where: {
          tenantId,
          outboundDispatchLineId: line.id,
          status: { not: 'CANCELLED' },
        },
        orderBy: { createdAt: 'asc' },
      })
      const primaryAlloc = lineAllocs[0]

      const movement = await InventoryPostingService.postFgDispatchIssue(
        {
          tenantId,
          itemId: line.itemId,
          warehouseId: line.warehouseId,
          quantity: line.quantity,
          salesOrderId: line.salesOrderId ?? undefined,
          outboundDispatchLineId: line.id,
          referenceNo: locked.dispatchNo,
          remarks: line.remarks ?? `FG dispatch ${locked.dispatchNo}`,
          idempotencyKey: movementKey,
          createdBy: userId(req) || undefined,
          allowNegativeStock: allowNegative,
          consumeSoReservation: true,
          batchNumber: primaryAlloc?.lotRef ?? undefined,
          serialNumber: primaryAlloc?.serialRef ?? undefined,
        },
        tx,
      )
      await tx.outboundDispatchLine.update({
        where: { id: line.id },
        data: {
          inventoryMovementId: movement.id,
          inventoryMovementNo: movement.movementNumber,
        },
      })
      movementsByLineId.set(line.id, { id: movement.id, movementNumber: movement.movementNumber })
      issueMovements.push(movement)
    }

    await createDispatchPostingInTx(tx, {
      tenantId,
      outbound: locked,
      mode: options.emergency ? 'emergency' : options.mode,
      policy,
      postedBy: userId(req) || null,
      idempotencyKey: options.idempotencyKey || `fg-dispatch-post:${id}`,
      requestFingerprint,
      movementsByLineId,
      deliveryChallanId: refs.deliveryChallanId,
      pickListId: refs.pickListId,
      packingSessionId: refs.packingSessionId,
      status: policy.requireReservationBeforePosting ? 'POSTED' : 'LEGACY_POSTED',
      remarks: options.emergency
        ? `EMERGENCY FG dispatch ${locked.dispatchNo}${
            emergencyReason ? `: ${emergencyReason}` : ''
          }`
        : undefined,
    })

    const posting = await tx.dispatchPosting.findFirstOrThrow({
      where: { tenantId, outboundDispatchId: id },
      include: { lines: true },
    })

    const { enqueuePostingEvents } = await import('./dispatch-domain-events.service.js')
    const postedQty = posting.lines.reduce((s, l) => s + Number(l.quantity), 0)
    await enqueuePostingEvents(tx, {
      tenantId,
      outboundDispatchId: id,
      dispatchNo: locked.dispatchNo,
      postingId: posting.id,
      postingNumber: posting.postingNumber,
      salesOrderId: locked.salesOrderId,
      postedQty,
      deliveryChallanId: refs.deliveryChallanId,
      postedBy: userId(req) || null,
      postingDate: posting.postingDate.toISOString().slice(0, 10),
      linePayload: posting.lines.map((l) => ({
        salesOrderLineId: l.salesOrderLineId,
        itemId: l.itemId,
        quantity: Number(l.quantity),
        warehouseId: l.warehouseId,
      })),
    })

    return tx.outboundDispatch.update({
      where: { id },
      data: {
        status: 'CONFIRMED',
        confirmedAt: new Date(),
        confirmedBy: userId(req) || null,
        updatedBy: userId(req) || null,
      },
      include: { lines: { orderBy: { lineNo: 'asc' } } },
    })
  })

  if (emergencyOverrideId) {
    const { consumeEmergencyOverride } = await import(
      '../../shared/emergency-override/emergency-override.service.js'
    )
    await consumeEmergencyOverride({
      tenantId,
      overrideId: emergencyOverrideId,
      consumedByAction: 'POST_DISPATCH',
      consumedDocumentId: id,
      actorUserId: userId(req) || null,
    })
  }

  // Thin hook only — Inventory Accounting owns COGS event + central `post()`.
  // Do not create vouchers / hardcode COGS accounts here or in Dispatch UI.
  const inventoryLegalEntityId = await resolveInventoryLegalEntityId(tenantId)
  await tryRecordInventoryAccountingEventsForMovements(req, tenantId, issueMovements, {
    sourceDocumentType: 'OUTBOUND_DISPATCH',
    sourceDocumentId: id,
    narration: `FG dispatch ${row.dispatchNo}`,
    legalEntityId: inventoryLegalEntityId,
  })

  // Logistics POD shell (IN_TRANSIT) — no stock side-effects.
  const { ensurePodInTransitAfterPost } = await import('../pod/dispatch-pod.service.js')
  await ensurePodInTransitAfterPost(tenantId, id, userId(req)).catch(() => {})

  await refreshRequirementsForDispatch(tenantId, row, userId(req) || undefined)

  const { drainDispatchDomainOutbox } = await import('./dispatch-domain-events.service.js')
  await drainDispatchDomainOutbox(tenantId).catch(() => {})

  return mapOutboundDispatch(row)
}

/** Resolve policy for a given outbound (exported for readiness). */
export function resolvePostingPolicyForOutbound(
  outbound: Pick<OutboundDispatch, 'planningSource'>,
  mode: DispatchPostMode,
): DispatchPostingPolicy {
  return getDispatchPostingPolicy({
    planningSource: outbound.planningSource,
    forceHardened: mode === 'post' && outbound.planningSource === 'WORKBENCH_7C1',
  })
}

export { n, roundQty }

/** Named facade — all FG_DISPATCH posting must go through postFgDispatch. */
export const DispatchPostingService = {
  postFgDispatch,
  resolvePostingPolicyForOutbound,
}
