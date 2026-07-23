/**
 * Phase 7C5 — Dispatch reversal workflow + partial line reverse.
 *
 * Lifecycle: DRAFT_REQUEST → SUBMITTED → APPROVED → APPLIED
 * (reject / cancel terminal). Apply creates compensating Inventory INWARD.
 */
import { randomUUID } from 'node:crypto'
import type { Request } from 'express'
import type { InventoryStockMovement, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { nextCode } from '../../../services/codeSeries.service.js'
import {
  AuthorizationError,
  ConflictError,
  InvalidStateError,
  NotFoundError,
  ValidationError,
} from '../../../utils/errors.js'
import { InventoryPostingService } from '../../inventory/shared/stock-posting.service.js'
import { tryRecordInventoryAccountingEventsForMovements } from '../../inventory/accounting/inventory-accounting-event.service.js'
import { resolveInventoryLegalEntityId } from '../../inventory/accounting/inventory-accounting-gate.service.js'
import { synchroniseDispatchRequirements } from '../requirements/dispatch-requirement-sync.service.js'
import { n, roundQty } from '../shared/dispatch-qty.js'
import { getDispatchPostingPolicy } from './dispatch-policy.js'
import { ensureDispatchPostingForOutbound } from './dispatch-posting-ledger.service.js'

export type DownstreamDependency = {
  code: string
  module: string
  message: string
  documentId?: string
}

export type ReversalLineInput = {
  /** Prefer posting line id; outbound line id accepted as alias. */
  postingLineId?: string
  outboundDispatchLineId?: string
  quantity: number
}

export type CreateReversalInput = {
  reason?: string
  reasonCode?: string
  effectiveDate?: string
  idempotencyKey?: string
  /** Supervisor override when hard downstream deps exist. */
  force?: boolean
  /** When omitted, reverse all remaining reversible qty on every posting line. */
  lines?: ReversalLineInput[]
}

type Tx = Prisma.TransactionClient

function userId(req: Request): string {
  return req.context?.userId ?? ''
}

function perms(req: Request): string[] {
  return req.context?.permissions ?? []
}

function hasAny(req: Request, names: string[]): boolean {
  const p = perms(req)
  return names.some((n) => p.includes(n)) || p.includes('tenant.manage')
}

function requirePerm(req: Request, names: string[], message: string): void {
  if (!hasAny(req, names)) throw new AuthorizationError(message)
}

function mapReversal(
  row: Prisma.DispatchReversalGetPayload<{ include: { lines: true } }>,
) {
  return {
    id: row.id,
    reversalNumber: row.reversalNumber,
    originalPostingId: row.originalPostingId,
    outboundDispatchId: row.outboundDispatchId,
    status: row.status,
    reasonCode: row.reasonCode,
    reason: row.reason,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    appliedBy: row.appliedBy,
    appliedAt: row.appliedAt?.toISOString() ?? null,
    effectiveDate: row.effectiveDate.toISOString().slice(0, 10),
    rejectedBy: row.rejectedBy,
    rejectedAt: row.rejectedAt?.toISOString() ?? null,
    rejectionReason: row.rejectionReason,
    idempotencyKey: row.idempotencyKey,
    lines: row.lines.map((l) => ({
      id: l.id,
      originalPostingLineId: l.originalPostingLineId,
      quantity: n(l.quantity),
      inventoryMovementId: l.inventoryMovementId,
      inventoryMovementNo: l.inventoryMovementNo,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

async function refreshRequirements(tenantId: string, outboundDispatchId: string, actor?: string) {
  const outbound = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
    include: { lines: { select: { salesOrderId: true } } },
  })
  if (!outbound) return
  const soIds = new Set<string>()
  if (outbound.salesOrderId) soIds.add(outbound.salesOrderId)
  for (const line of outbound.lines) {
    if (line.salesOrderId) soIds.add(line.salesOrderId)
  }
  for (const salesOrderId of soIds) {
    await synchroniseDispatchRequirements(tenantId, { salesOrderId, userId: actor })
  }
}

export async function inspectReversalDependencies(
  tenantId: string,
  outboundDispatchId: string,
): Promise<DownstreamDependency[]> {
  const deps: DownstreamDependency[] = []
  const policy = getDispatchPostingPolicy({ forceHardened: true })

  const dispatch = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
    select: { id: true, salesOrderId: true, status: true, dispatchNo: true },
  })
  if (!dispatch) throw new NotFoundError('Outbound dispatch not found')

  if (policy.blockReversalWhenInvoiced) {
    const seenInvoiceIds = new Set<string>()

    const pushInvoiceDep = (inv: {
      id: string
      invoiceNumber: string | null
      status: string
    }) => {
      if (seenInvoiceIds.has(inv.id)) return
      seenInvoiceIds.add(inv.id)
      const label = inv.invoiceNumber ?? inv.id
      // Only POSTED invoices hard-block reverse. DRAFT / READY_TO_POST are released on apply.
      if (inv.status === 'POSTED') {
        deps.push({
          code: 'SALES_INVOICE_POSTED',
          module: 'sales_invoice',
          message: `Posted Sales Invoice ${label} source-links this outbound — reverse the invoice (or release links) before dispatch reverse`,
          documentId: inv.id,
        })
      }
    }

    // 1) ACTIVE source-link ledger (preferred Finance consumption path)
    const invoiceLinks = await prisma.salesInvoiceSourceLink.findMany({
      where: {
        tenantId,
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: outboundDispatchId,
        status: 'ACTIVE',
      },
      select: { salesInvoiceId: true },
      take: 50,
    })
    if (invoiceLinks.length) {
      const invoiceIds = [...new Set(invoiceLinks.map((l) => l.salesInvoiceId))]
      const invoices = await prisma.salesInvoice.findMany({
        where: {
          tenantId,
          id: { in: invoiceIds },
          status: { in: ['DRAFT', 'READY_TO_POST', 'POSTED'] },
        },
        select: { id: true, invoiceNumber: true, status: true },
      })
      for (const inv of invoices) pushInvoiceDep(inv)
    }

    // 2) Header-only OUTBOUND_DISPATCH source (links may not be persisted yet)
    const headerInvoices = await prisma.salesInvoice.findMany({
      where: {
        tenantId,
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: outboundDispatchId,
        status: { in: ['DRAFT', 'READY_TO_POST', 'POSTED'] },
      },
      select: { id: true, invoiceNumber: true, status: true },
      take: 20,
    })
    for (const inv of headerInvoices) pushInvoiceDep(inv)
  }

  if (policy.blockReversalWhenCogsPosted) {
    const cogsEvents = await prisma.inventoryAccountingEvent
      .findMany({
        where: {
          tenantId,
          sourceDocumentType: 'OUTBOUND_DISPATCH',
          sourceDocumentId: outboundDispatchId,
          /** Only hard-posted GL events; RECORDED / SKIPPED_* must not block reverse. */
          status: 'POSTED',
          eventType: { in: ['FG_DISPATCH', 'FG_DISPATCH_REVERSAL'] },
        },
        select: { id: true, eventType: true, voucherId: true },
        take: 10,
      })
      .catch(() => [] as Array<{ id: string; eventType: string; voucherId: string | null }>)

    if (cogsEvents.length > 0) {
      deps.push({
        code: 'COGS_OR_INV_ACCT_POSTED',
        module: 'inventory_accounting',
        message: `Posted inventory/COGS accounting (${cogsEvents.map((e) => e.eventType).join(', ')}) exists for this outbound — reverse/release GL before dispatch reverse`,
        documentId: cogsEvents[0]?.voucherId ?? cogsEvents[0]?.id ?? outboundDispatchId,
      })
    }
  }

  return deps
}

/** Throw ConflictError unless force + dispatch.override. */
function assertReversalDepsClear(
  req: Request,
  deps: DownstreamDependency[],
  force?: boolean,
): void {
  if (!deps.length) return
  const canForce = force === true && hasAny(req, ['dispatch.override'])
  if (canForce) return
  throw new ConflictError(
    `Reversal blocked by downstream dependencies: ${deps.map((d) => d.code).join(', ')}`,
  )
}

function remainingOnPostingLine(line: { quantity: unknown; reversedQuantity: unknown }): number {
  return roundQty(Math.max(0, n(line.quantity) - n(line.reversedQuantity)))
}

async function resolveRequestedLines(
  tx: Tx,
  tenantId: string,
  postingId: string,
  inputLines: ReversalLineInput[] | undefined,
): Promise<Array<{ postingLineId: string; quantity: number; postingLine: {
  id: string
  outboundDispatchLineId: string
  itemId: string
  warehouseId: string
  salesOrderId: string | null
  quantity: unknown
  reversedQuantity: unknown
} }>> {
  const postingLines = await tx.dispatchPostingLine.findMany({
    where: { tenantId, postingId },
    orderBy: { lineNo: 'asc' },
  })
  if (!postingLines.length) throw new ValidationError('Dispatch posting has no lines')

  if (!inputLines?.length) {
    return postingLines
      .map((pl) => ({
        postingLineId: pl.id,
        quantity: remainingOnPostingLine(pl),
        postingLine: pl,
      }))
      .filter((x) => x.quantity > 0)
  }

  const byId = new Map(postingLines.map((pl) => [pl.id, pl]))
  const byOutbound = new Map(postingLines.map((pl) => [pl.outboundDispatchLineId, pl]))
  const resolved: Array<{
    postingLineId: string
    quantity: number
    postingLine: (typeof postingLines)[number]
  }> = []
  const seen = new Set<string>()

  for (const raw of inputLines) {
    const pl =
      (raw.postingLineId ? byId.get(raw.postingLineId) : undefined) ??
      (raw.outboundDispatchLineId ? byOutbound.get(raw.outboundDispatchLineId) : undefined)
    if (!pl) {
      throw new ValidationError('Reversal line does not belong to this Dispatch posting')
    }
    if (seen.has(pl.id)) {
      throw new ValidationError(`Duplicate reversal line for posting line ${pl.lineNo}`)
    }
    seen.add(pl.id)
    const qty = roundQty(raw.quantity)
    if (qty <= 0) throw new ValidationError('Reversal quantity must be greater than zero')
    const remaining = remainingOnPostingLine(pl)
    if (qty > remaining + 1e-9) {
      throw new ConflictError(
        `Over-reversal blocked: line ${pl.lineNo} remaining ${remaining}, requested ${qty}`,
      )
    }
    resolved.push({ postingLineId: pl.id, quantity: qty, postingLine: pl })
  }

  return resolved
}

/**
 * Create a DRAFT_REQUEST reversal (partial or full remaining).
 */
export async function createReversalRequest(
  req: Request,
  tenantId: string,
  outboundDispatchId: string,
  input: CreateReversalInput,
) {
  requirePerm(
    req,
    ['dispatch.post', 'dispatch.reverse.request', 'dispatch.override'],
    'Missing permission to request dispatch reversal',
  )

  if (input.idempotencyKey) {
    const prior = await prisma.dispatchReversal.findFirst({
      where: { tenantId, idempotencyKey: input.idempotencyKey },
      include: { lines: true },
    })
    if (prior) return mapReversal(prior)
  }

  const outbound = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
  })
  if (!outbound) throw new NotFoundError('Outbound dispatch not found')
  if (outbound.status !== 'CONFIRMED') {
    throw new InvalidStateError('Only CONFIRMED outbound dispatches can request reversal')
  }

  const deps = await inspectReversalDependencies(tenantId, outboundDispatchId)
  assertReversalDepsClear(req, deps, input.force)

  const openStatuses = ['DRAFT_REQUEST', 'SUBMITTED', 'APPROVED'] as const
  const open = await prisma.dispatchReversal.findFirst({
    where: {
      tenantId,
      outboundDispatchId,
      status: { in: [...openStatuses] },
    },
  })
  if (open) {
    throw new ConflictError(
      `An open reversal ${open.reversalNumber} (${open.status}) already exists for this outbound`,
    )
  }

  const actor = userId(req) || null
  const effectiveDate = input.effectiveDate ? new Date(input.effectiveDate) : new Date()
  effectiveDate.setHours(0, 0, 0, 0)

  const row = await prisma.$transaction(async (tx) => {
    const posting = await ensureDispatchPostingForOutbound(tx, tenantId, outboundDispatchId)
    const lines = await resolveRequestedLines(tx, tenantId, posting.id, input.lines)
    if (!lines.length) {
      throw new ConflictError('No reversible quantity remains on this posting')
    }

    const reversalNumber = await nextCode(tenantId, 'DISPATCH_REVERSAL', tx)
    const reversalId = randomUUID()
    const now = new Date()

    return tx.dispatchReversal.create({
      data: {
        id: reversalId,
        tenantId,
        reversalNumber,
        originalPostingId: posting.id,
        outboundDispatchId,
        status: 'DRAFT_REQUEST',
        reasonCode: input.reasonCode?.trim() || 'REVERSE',
        reason: input.reason?.trim() || null,
        requestedBy: actor,
        requestedAt: now,
        effectiveDate,
        idempotencyKey: input.idempotencyKey || null,
        lines: {
          create: lines.map((l) => ({
            id: randomUUID(),
            tenantId,
            originalPostingLineId: l.postingLineId,
            quantity: l.quantity,
          })),
        },
      },
      include: { lines: true },
    })
  })

  return mapReversal(row)
}

export async function submitReversal(req: Request, tenantId: string, reversalId: string) {
  requirePerm(
    req,
    ['dispatch.post', 'dispatch.reverse.request', 'dispatch.submit', 'dispatch.override'],
    'Missing permission to submit dispatch reversal',
  )
  const existing = await prisma.dispatchReversal.findFirst({
    where: { id: reversalId, tenantId },
    include: { lines: true },
  })
  if (!existing) throw new NotFoundError('Dispatch reversal not found')
  if (existing.status === 'SUBMITTED') return mapReversal(existing)
  if (existing.status !== 'DRAFT_REQUEST') {
    throw new InvalidStateError('Only DRAFT_REQUEST reversals can be submitted')
  }
  const row = await prisma.dispatchReversal.update({
    where: { id: reversalId },
    data: { status: 'SUBMITTED', requestedBy: userId(req) || existing.requestedBy },
    include: { lines: true },
  })
  return mapReversal(row)
}

export async function approveReversal(req: Request, tenantId: string, reversalId: string) {
  requirePerm(
    req,
    ['dispatch.approve', 'dispatch.reverse.approve', 'dispatch.override'],
    'Missing permission to approve dispatch reversal',
  )
  const existing = await prisma.dispatchReversal.findFirst({
    where: { id: reversalId, tenantId },
    include: { lines: true },
  })
  if (!existing) throw new NotFoundError('Dispatch reversal not found')
  if (existing.status === 'APPROVED') return mapReversal(existing)
  if (existing.status !== 'SUBMITTED' && existing.status !== 'DRAFT_REQUEST') {
    throw new InvalidStateError('Only SUBMITTED (or DRAFT) reversals can be approved')
  }
  const now = new Date()
  const row = await prisma.dispatchReversal.update({
    where: { id: reversalId },
    data: {
      status: 'APPROVED',
      approvedBy: userId(req) || null,
      approvedAt: now,
      // Draft direct-approve still counts as requested
      requestedBy: existing.requestedBy ?? (userId(req) || null),
      requestedAt: existing.requestedAt ?? now,
    },
    include: { lines: true },
  })
  return mapReversal(row)
}

export async function rejectReversal(
  req: Request,
  tenantId: string,
  reversalId: string,
  input: { reason?: string },
) {
  requirePerm(
    req,
    ['dispatch.approve', 'dispatch.reverse.approve', 'dispatch.override'],
    'Missing permission to reject dispatch reversal',
  )
  const existing = await prisma.dispatchReversal.findFirst({
    where: { id: reversalId, tenantId },
    include: { lines: true },
  })
  if (!existing) throw new NotFoundError('Dispatch reversal not found')
  if (existing.status === 'REJECTED') return mapReversal(existing)
  if (!['DRAFT_REQUEST', 'SUBMITTED', 'APPROVED'].includes(existing.status)) {
    throw new InvalidStateError('Only open reversals can be rejected')
  }
  const row = await prisma.dispatchReversal.update({
    where: { id: reversalId },
    data: {
      status: 'REJECTED',
      rejectedBy: userId(req) || null,
      rejectedAt: new Date(),
      rejectionReason: input.reason?.trim() || null,
    },
    include: { lines: true },
  })
  return mapReversal(row)
}

export async function cancelReversalRequest(req: Request, tenantId: string, reversalId: string) {
  requirePerm(
    req,
    ['dispatch.post', 'dispatch.reverse.request', 'dispatch.cancel', 'dispatch.override'],
    'Missing permission to cancel dispatch reversal',
  )
  const existing = await prisma.dispatchReversal.findFirst({
    where: { id: reversalId, tenantId },
    include: { lines: true },
  })
  if (!existing) throw new NotFoundError('Dispatch reversal not found')
  if (existing.status === 'CANCELLED') return mapReversal(existing)
  if (!['DRAFT_REQUEST', 'SUBMITTED'].includes(existing.status)) {
    throw new InvalidStateError('Only DRAFT_REQUEST or SUBMITTED reversals can be cancelled')
  }
  const row = await prisma.dispatchReversal.update({
    where: { id: reversalId },
    data: { status: 'CANCELLED' },
    include: { lines: true },
  })
  return mapReversal(row)
}

/**
 * Apply approved (or policy-skipped) reversal — compensating Inventory + fulfilment impact.
 */
export async function applyReversal(
  req: Request,
  tenantId: string,
  reversalId: string,
  opts?: { force?: boolean },
) {
  requirePerm(
    req,
    ['dispatch.post', 'dispatch.reverse.apply', 'dispatch.override'],
    'Missing permission to apply dispatch reversal',
  )

  const existing = await prisma.dispatchReversal.findFirst({
    where: { id: reversalId, tenantId },
    include: {
      lines: true,
      originalPosting: { include: { lines: true } },
    },
  })
  if (!existing) throw new NotFoundError('Dispatch reversal not found')
  if (existing.status === 'APPLIED') {
    return mapReversal(
      await prisma.dispatchReversal.findFirstOrThrow({
        where: { id: reversalId, tenantId },
        include: { lines: true },
      }),
    )
  }

  const policy = getDispatchPostingPolicy({ forceHardened: true })
  if (policy.reversalApprovalRequired && existing.status !== 'APPROVED') {
    if (!hasAny(req, ['dispatch.override'])) {
      throw new InvalidStateError(
        'Reversal must be APPROVED before apply (or use dispatch.override)',
      )
    }
  } else if (!['APPROVED', 'SUBMITTED', 'DRAFT_REQUEST'].includes(existing.status)) {
    throw new InvalidStateError('Reversal cannot be applied from current status')
  }

  const outbound = await prisma.outboundDispatch.findFirst({
    where: { id: existing.outboundDispatchId, tenantId, deletedAt: null },
    include: { lines: true },
  })
  if (!outbound) throw new NotFoundError('Outbound dispatch not found')
  if (outbound.status !== 'CONFIRMED') {
    throw new InvalidStateError('Outbound must be CONFIRMED to apply reversal')
  }

  // Re-check Finance deps at apply (invoice/COGS may land after request was approved).
  const deps = await inspectReversalDependencies(tenantId, outbound.id)
  assertReversalDepsClear(req, deps, opts?.force)

  const actor = userId(req) || null
  const reversalMovements: InventoryStockMovement[] = []

  const applied = await prisma.$transaction(async (tx) => {
    // Serialize concurrent reverse applies against the same posting.
    await tx.$executeRaw`
      SELECT id FROM dispatch_postings
      WHERE id = ${existing.originalPostingId} AND tenantId = ${tenantId}
      FOR UPDATE
    `

    const locked = await tx.dispatchReversal.findFirst({
      where: { id: reversalId, tenantId },
      include: { lines: true },
    })
    if (!locked) throw new NotFoundError('Dispatch reversal not found')
    if (locked.status === 'APPLIED') {
      return tx.dispatchReversal.findFirstOrThrow({
        where: { id: reversalId, tenantId },
        include: { lines: true },
      })
    }

    const postingLines = await tx.dispatchPostingLine.findMany({
      where: { tenantId, postingId: locked.originalPostingId },
    })
    const postingLineById = new Map(postingLines.map((pl) => [pl.id, pl]))

    // Re-validate remaining qty inside transaction
    for (const rl of locked.lines) {
      const pl = postingLineById.get(rl.originalPostingLineId)
      if (!pl) throw new ValidationError('Posting line missing for reversal line')
      const remaining = remainingOnPostingLine(pl)
      if (n(rl.quantity) > remaining + 1e-9) {
        throw new ConflictError(
          `Over-reversal blocked at apply: remaining ${remaining}, requested ${n(rl.quantity)}`,
        )
      }
    }

    const now = new Date()
    let addedReversed = 0

    for (const rl of locked.lines) {
      const pl = postingLineById.get(rl.originalPostingLineId)!
      const qty = n(rl.quantity)
      const movement = await InventoryPostingService.post(
        {
          tenantId,
          itemId: pl.itemId,
          warehouseId: pl.warehouseId,
          movementType: 'INWARD',
          referenceType: 'FG_DISPATCH',
          quantity: qty,
          salesOrderId: pl.salesOrderId ?? undefined,
          outboundDispatchLineId: pl.outboundDispatchLineId,
          referenceNo: outbound.dispatchNo,
          remarks: locked.reason?.trim()
            ? `FG dispatch reverse ${outbound.dispatchNo}: ${locked.reason.trim()}`
            : `FG dispatch reverse ${outbound.dispatchNo} (${locked.reversalNumber})`,
          idempotencyKey: `fg-dispatch-rev:${locked.id}:${pl.id}`,
          createdBy: actor || undefined,
          allowNegativeStock: true,
        },
        tx,
      )
      reversalMovements.push(movement)

      await tx.dispatchReversalLine.update({
        where: { id: rl.id },
        data: {
          inventoryMovementId: movement.id,
          inventoryMovementNo: movement.movementNumber,
        },
      })

      const newReversed = roundQty(n(pl.reversedQuantity) + qty)
      await tx.dispatchPostingLine.update({
        where: { id: pl.id },
        data: { reversedQuantity: newReversed },
      })
      addedReversed += qty

      // When line fully reversed, stamp last compensating movement on outbound line.
      if (newReversed + 1e-9 >= n(pl.quantity)) {
        await tx.outboundDispatchLine.update({
          where: { id: pl.outboundDispatchLineId },
          data: {
            reverseInventoryMovementId: movement.id,
            reverseInventoryMovementNo: movement.movementNumber,
          },
        })
      }
    }

    const refreshedLines = await tx.dispatchPostingLine.findMany({
      where: { tenantId, postingId: locked.originalPostingId },
    })
    const totalPosted = roundQty(refreshedLines.reduce((s, l) => s + n(l.quantity), 0))
    const totalReversed = roundQty(refreshedLines.reduce((s, l) => s + n(l.reversedQuantity), 0))
    const fullyReversed = totalReversed + 1e-9 >= totalPosted

    await tx.dispatchPosting.update({
      where: { id: locked.originalPostingId },
      data: {
        reversedQuantity: totalReversed,
        status: fullyReversed ? 'REVERSED' : 'PARTIALLY_REVERSED',
      },
    })

    if (fullyReversed) {
      await tx.outboundDispatch.update({
        where: { id: outbound.id },
        data: {
          status: 'REVERSED',
          reversedAt: now,
          reversedBy: actor,
          reverseReason: locked.reason,
          updatedBy: actor,
        },
      })
    }

    // Release ACTIVE links on non-posted auto/manual draft invoices for this outbound.
    // Posted invoices already hard-blocked above. Keeps invoice-ready qty consistent after reverse.
    const openInvoices = await tx.salesInvoice.findMany({
      where: {
        tenantId,
        sourceType: 'OUTBOUND_DISPATCH',
        sourceDocumentId: outbound.id,
        status: { in: ['DRAFT', 'READY_TO_POST'] },
      },
      select: { id: true },
    })
    if (openInvoices.length) {
      await tx.salesInvoiceSourceLink.updateMany({
        where: {
          tenantId,
          salesInvoiceId: { in: openInvoices.map((i) => i.id) },
          sourceType: 'OUTBOUND_DISPATCH',
          sourceDocumentId: outbound.id,
          status: 'ACTIVE',
        },
        data: { status: 'RELEASED' },
      })
      await tx.salesInvoice.updateMany({
        where: {
          tenantId,
          id: { in: openInvoices.map((i) => i.id) },
          status: { in: ['DRAFT', 'READY_TO_POST'] },
        },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelledBy: actor,
          cancellationReason: `Auto-cancelled: Dispatch ${outbound.dispatchNo} reversed (${locked.reversalNumber})`,
        },
      })
    }

    const { enqueueReversalEvents } = await import('./dispatch-domain-events.service.js')
    await enqueueReversalEvents(tx, {
      tenantId,
      outboundDispatchId: outbound.id,
      postingId: locked.originalPostingId,
      reversalId: locked.id,
      salesOrderId: outbound.salesOrderId,
      reversedQty: addedReversed,
      linePayload: locked.lines.map((rl) => {
        const pl = postingLineById.get(rl.originalPostingLineId)!
        return {
          salesOrderLineId: pl.salesOrderLineId,
          quantity: n(rl.quantity),
        }
      }),
    })

    return tx.dispatchReversal.update({
      where: { id: locked.id },
      data: {
        status: 'APPLIED',
        appliedBy: actor,
        appliedAt: now,
        approvedBy: locked.approvedBy ?? actor,
        approvedAt: locked.approvedAt ?? now,
      },
      include: { lines: true },
    })
  })

  // Thin hook — Inventory Accounting owns COGS event + central `post()` (LE flag).
  const inventoryLegalEntityId = await resolveInventoryLegalEntityId(tenantId)
  await tryRecordInventoryAccountingEventsForMovements(req, tenantId, reversalMovements, {
    sourceDocumentType: 'OUTBOUND_DISPATCH',
    sourceDocumentId: outbound.id,
    narration: `FG dispatch reverse ${outbound.dispatchNo} (${applied.reversalNumber})`,
    legalEntityId: inventoryLegalEntityId,
  })

  await refreshRequirements(tenantId, outbound.id, actor || undefined)

  const { drainDispatchDomainOutbox } = await import('./dispatch-domain-events.service.js')
  await drainDispatchDomainOutbox(tenantId).catch(() => {})

  return mapReversal(applied)
}

export async function getReversal(tenantId: string, reversalId: string) {
  const row = await prisma.dispatchReversal.findFirst({
    where: { id: reversalId, tenantId },
    include: { lines: true },
  })
  if (!row) throw new NotFoundError('Dispatch reversal not found')
  return mapReversal(row)
}

export async function listReversalsForOutbound(tenantId: string, outboundDispatchId: string) {
  const rows = await prisma.dispatchReversal.findMany({
    where: { tenantId, outboundDispatchId },
    include: { lines: true },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(mapReversal)
}

/**
 * Compatibility `/outbound/:id/reverse`.
 * - When approval required: create DRAFT → SUBMITTED (or APPROVED+apply with override).
 * - When approval not required / skipApproval+override: create and apply immediately.
 * - Supports partial `lines`.
 */
export async function reverseOutboundDispatchCanonical(
  req: Request,
  tenantId: string,
  outboundDispatchId: string,
  input: CreateReversalInput & {
    force?: boolean
    /** Skip approval gates (requires dispatch.override). */
    skipApproval?: boolean
    /** Apply immediately after create when allowed. Default true when approval not required. */
    applyImmediately?: boolean
    /** Alias: requestOnly=true → applyImmediately=false. */
    requestOnly?: boolean
  },
) {
  requirePerm(
    req,
    ['dispatch.post', 'dispatch.reverse.request', 'dispatch.reverse.apply', 'dispatch.override'],
    'Missing permission to reverse dispatch',
  )

  const outbound = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
  })
  if (!outbound) throw new NotFoundError('Outbound dispatch not found')
  if (outbound.status === 'REVERSED') {
    const applied = await prisma.dispatchReversal.findFirst({
      where: { tenantId, outboundDispatchId, status: 'APPLIED' },
      include: { lines: true },
      orderBy: { appliedAt: 'desc' },
    })
    if (applied) return { kind: 'reversal' as const, reversal: mapReversal(applied), outbound, awaitingApproval: false }
    throw new InvalidStateError('Outbound already reversed')
  }
  if (outbound.status !== 'CONFIRMED') {
    throw new InvalidStateError('Only CONFIRMED outbound dispatches can be reversed')
  }

  const deps = await inspectReversalDependencies(tenantId, outboundDispatchId)
  assertReversalDepsClear(req, deps, input.force)

  const policy = getDispatchPostingPolicy({ forceHardened: true })
  const canSkip =
    input.skipApproval === true && hasAny(req, ['dispatch.override'])
  const approvalRequired = policy.reversalApprovalRequired && !canSkip
  /** Power users with approve+apply may complete in one shot; segregated roles await approval. */
  const canSelfComplete =
    hasAny(req, ['dispatch.reverse.approve', 'dispatch.approve', 'dispatch.override']) &&
    hasAny(req, ['dispatch.reverse.apply', 'dispatch.post', 'dispatch.override'])
  const applyImmediately =
    input.requestOnly === true
      ? false
      : input.applyImmediately === true ||
        (!approvalRequired && input.applyImmediately !== false) ||
        (approvalRequired && canSelfComplete && input.applyImmediately !== false)

  let reversal = await createReversalRequest(req, tenantId, outboundDispatchId, {
    ...input,
    force: input.force,
  })

  if (!applyImmediately) {
    reversal = await submitReversal(req, tenantId, reversal.id)
    return { kind: 'reversal' as const, reversal, outbound: null, awaitingApproval: true }
  }

  if (approvalRequired) {
    reversal = await submitReversal(req, tenantId, reversal.id)
    reversal = await approveReversal(req, tenantId, reversal.id)
  } else {
    // Still mark submitted/approved for audit trail when applying immediately.
    if (reversal.status === 'DRAFT_REQUEST') {
      reversal = await submitReversal(req, tenantId, reversal.id)
    }
    if (reversal.status === 'SUBMITTED') {
      // Auto-approve when policy does not require a separate supervisor step
      const row = await prisma.dispatchReversal.update({
        where: { id: reversal.id },
        data: {
          status: 'APPROVED',
          approvedBy: userId(req) || null,
          approvedAt: new Date(),
        },
        include: { lines: true },
      })
      reversal = mapReversal(row)
    }
  }

  reversal = await applyReversal(req, tenantId, reversal.id, { force: input.force })
  const updatedOutbound = await prisma.outboundDispatch.findFirst({
    where: { id: outboundDispatchId, tenantId, deletedAt: null },
    include: { lines: { orderBy: { lineNo: 'asc' } } },
  })
  return {
    kind: 'applied' as const,
    reversal,
    outbound: updatedOutbound,
    awaitingApproval: false,
  }
}

export const DispatchReversalService = {
  inspectReversalDependencies,
  createReversalRequest,
  submitReversal,
  approveReversal,
  rejectReversal,
  cancelReversalRequest,
  applyReversal,
  getReversal,
  listReversalsForOutbound,
  reverseOutboundDispatchCanonical,
}

/** Reservation restore policy: return qty to free stock; do not auto-recreate reservation. */
export const REVERSAL_RESERVATION_POLICY = 'RESTORE_FREE_STOCK_ONLY' as const
