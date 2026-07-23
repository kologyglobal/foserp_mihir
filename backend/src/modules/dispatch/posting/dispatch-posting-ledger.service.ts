/**
 * Helpers to persist immutable DispatchPosting / DispatchReversal rows.
 */
import { createHash, randomUUID } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { nextCode } from '../../../services/codeSeries.service.js'
import type { DispatchPostingPolicy } from './dispatch-policy.js'
import { n, roundQty } from '../shared/dispatch-qty.js'

export function fingerprintDispatchPostRequest(input: {
  outboundDispatchId: string
  mode: string
  lineIds: string[]
  quantities: number[]
}): string {
  const payload = JSON.stringify({
    outboundDispatchId: input.outboundDispatchId,
    mode: input.mode,
    lines: input.lineIds.map((id, i) => ({ id, qty: input.quantities[i] })),
  })
  return createHash('sha256').update(payload).digest('hex').slice(0, 64)
}

type Tx = Prisma.TransactionClient

export async function createDispatchPostingInTx(
  tx: Tx,
  args: {
    tenantId: string
    outbound: {
      id: string
      dispatchNo: string
      salesOrderId: string | null
      lines: Array<{
        id: string
        lineNo: number
        itemId: string
        warehouseId: string
        quantity: unknown
        salesOrderId: string | null
        salesOrderLineId: string | null
      }>
    }
    mode: string
    policy: DispatchPostingPolicy
    postedBy: string | null
    idempotencyKey?: string | null
    requestFingerprint?: string | null
    movementsByLineId: Map<string, { id: string; movementNumber: string }>
    deliveryChallanId?: string | null
    pickListId?: string | null
    packingSessionId?: string | null
    status?: 'POSTED' | 'LEGACY_POSTED' | 'REVERSED'
    remarks?: string | null
  },
) {
  const postingNumber = await nextCode(args.tenantId, 'DISPATCH_POSTING', tx)
  const postingDate = new Date()
  postingDate.setHours(0, 0, 0, 0)

  const posting = await tx.dispatchPosting.create({
    data: {
      id: randomUUID(),
      tenantId: args.tenantId,
      postingNumber,
      outboundDispatchId: args.outbound.id,
      salesOrderId: args.outbound.salesOrderId,
      status: args.status ?? 'POSTED',
      postingDate,
      mode: args.mode,
      policySnapshot: args.policy as unknown as Prisma.InputJsonValue,
      idempotencyKey: args.idempotencyKey || null,
      requestFingerprint: args.requestFingerprint || null,
      postedBy: args.postedBy,
      postedAt: new Date(),
      reversedQuantity: 0,
      deliveryChallanId: args.deliveryChallanId ?? null,
      pickListId: args.pickListId ?? null,
      packingSessionId: args.packingSessionId ?? null,
      remarks: args.remarks?.trim() || `FG dispatch posting for ${args.outbound.dispatchNo}`,
      lines: {
        create: args.outbound.lines.map((line) => {
          const mov = args.movementsByLineId.get(line.id)
          const qty = roundQty(n(line.quantity))
          return {
            id: randomUUID(),
            tenantId: args.tenantId,
            lineNo: line.lineNo,
            outboundDispatchLineId: line.id,
            salesOrderId: line.salesOrderId,
            salesOrderLineId: line.salesOrderLineId,
            itemId: line.itemId,
            warehouseId: line.warehouseId,
            quantity: qty,
            inventoryMovementId: mov?.id ?? null,
            inventoryMovementNo: mov?.movementNumber ?? null,
            reservationConsumedQty: qty,
            pickListId: args.pickListId ?? null,
            packingSessionId: args.packingSessionId ?? null,
            challanId: args.deliveryChallanId ?? null,
          }
        }),
      },
    },
    include: { lines: true },
  })

  return posting
}

export async function ensureDispatchPostingForOutbound(
  tx: Tx,
  tenantId: string,
  outboundId: string,
): Promise<{ id: string; lines: Array<{ id: string; outboundDispatchLineId: string; quantity: unknown }> }> {
  const existing = await tx.dispatchPosting.findFirst({
    where: { tenantId, outboundDispatchId: outboundId },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  if (existing) return existing

  const outbound = await tx.outboundDispatch.findFirst({
    where: { id: outboundId, tenantId, deletedAt: null },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  if (!outbound) throw new Error('Outbound not found for posting backfill')

  const movementsByLineId = new Map<string, { id: string; movementNumber: string }>()
  for (const line of outbound.lines) {
    if (line.inventoryMovementId) {
      movementsByLineId.set(line.id, {
        id: line.inventoryMovementId,
        movementNumber: line.inventoryMovementNo ?? '',
      })
    }
  }

  return createDispatchPostingInTx(tx, {
    tenantId,
    outbound,
    mode: 'legacy',
    policy: {
      requireReservationBeforePosting: false,
      requirePickBeforePosting: false,
      requirePackBeforePosting: false,
      requireIssuedChallanBeforePosting: false,
      requireQualityClearance: false,
      allowPartialDispatch: true,
      allowOverDispatch: false,
      allowNegativeStock: false,
      requireSerialAllocation: false,
      requireLotAllocation: false,
      requireSupervisorApprovalForOverride: true,
      allowDirectEmergencyDispatch: false,
      reversalApprovalRequired: true,
      blockReversalWhenInvoiced: true,
      blockReversalWhenCogsPosted: true,
      requirePodBeforeInvoice: false,
    },
    postedBy: outbound.confirmedBy,
    movementsByLineId,
    status: outbound.status === 'REVERSED' ? 'REVERSED' : 'LEGACY_POSTED',
  })
}
