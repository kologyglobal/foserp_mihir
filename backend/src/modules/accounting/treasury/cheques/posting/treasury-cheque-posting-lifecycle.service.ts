import type { Request } from 'express'
import type { AccountingVoucher } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { validateReversalEligibility } from '../../../ledger/ledger.validators.js'
import { post } from '../../../posting/posting.service.js'
import type { PostingContext, PostingResult } from '../../../posting/posting.types.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'
import * as repo from '../treasury-cheque.repository.js'
import {
  mapPostingErrorToTreasuryChequeReversalError,
  TreasuryChequeConcurrentPostError,
  TreasuryChequeInvalidLifecycleActionError,
  TreasuryChequeInvalidStatusError,
  TreasuryChequeReversalNotAllowedError,
  TreasuryChequeReversalNotEligibleError,
  TreasuryChequeStaleVersionError,
} from '../treasury-cheque.errors.js'
import { serializeTreasuryCheque } from '../treasury-cheque-read.service.js'
import { isTrackOnlyCheque } from '../treasury-cheque-draft.service.js'
import type {
  BounceTreasuryChequeInput,
  ClearTreasuryChequeInput,
  ReverseTreasuryChequeInput,
  StopTreasuryChequeInput,
} from '../treasury-cheque.schemas.js'
import type { TreasuryChequeRow } from '../treasury-cheque.types.js'
import {
  buildTreasuryChequeBounceReversalEventKey,
  buildTreasuryChequeReversalEventKey,
  buildTreasuryChequeReversalRequest,
  buildTreasuryChequeStopReversalEventKey,
} from './treasury-cheque-posting-builder.service.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertPerm(req: Request, permission: string): void {
  if (!hasPerm(req, permission)) throw new AuthorizationError(`Missing permission: ${permission}`)
}

function assertExpectedUpdatedAt(cheque: TreasuryChequeRow, expectedUpdatedAt: string): void {
  if (cheque.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new TreasuryChequeStaleVersionError()
}

async function reverseChequeVoucher(
  cheque: TreasuryChequeRow,
  voucherId: string,
  eventKey: string,
  eventType: string,
  narrationPrefix: string,
  reversalDate: string,
  reason: string,
  postingContext: PostingContext,
): Promise<PostingResult> {
  const originalVoucher = await prisma.accountingVoucher.findFirst({ where: { id: voucherId, tenantId: cheque.tenantId } })
  if (!originalVoucher) throw new TreasuryChequeReversalNotEligibleError('Original voucher is missing')
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new TreasuryChequeReversalNotEligibleError('Original voucher has already been reversed or is not posted')
  }

  const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId, tenantId: cheque.tenantId } })
  const request = buildTreasuryChequeReversalRequest({ cheque, originalVoucher, lines, eventKey, eventType, reversalDate, reason, narrationPrefix })

  return post(request, postingContext, {
    afterAccounting: async ({ tx, context: txContext, voucherId: reversalVoucherId }) => {
      const eligibility = validateReversalEligibility(originalVoucher as AccountingVoucher, reversalVoucherId, txContext.tenantId, cheque.legalEntityId)
      if (!eligibility.valid) {
        throw new TreasuryChequeReversalNotEligibleError(eligibility.errors.map((e) => e.message).join('; '))
      }
      const linked = await tx.accountingVoucher.updateMany({
        where: { id: originalVoucher.id, tenantId: txContext.tenantId, status: 'POSTED', reversedByVoucherId: null },
        data: { status: 'REVERSED', reversedByVoucherId: reversalVoucherId, reversedAt: new Date(), reversedBy: txContext.userId ?? null, reversalReason: reason },
      })
      if (linked.count !== 1) throw new TreasuryChequeConcurrentPostError()
      await tx.accountingVoucher.update({
        where: { id: reversalVoucherId, tenantId: txContext.tenantId },
        data: { reversalOfVoucherId: originalVoucher.id, reversalReason: reason },
      })
    },
  })
}

function buildPostingContext(tenantId: string, userId: string, audit: { ipAddress?: string | null; userAgent?: string | null }): PostingContext {
  return {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }
}

/** ISSUED/DEPOSITED → CLEARED. Status-only confirmation — the GL entry was already posted at issue/deposit time. */
export async function clearTreasuryCheque(req: Request, tenantId: string, chequeId: string, input: ClearTreasuryChequeInput) {
  assertPerm(req, 'finance.treasury.cheque.clear')
  const userId = req.context?.userId
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
  if (!['ISSUED', 'DEPOSITED'].includes(cheque.status)) {
    throw new TreasuryChequeInvalidLifecycleActionError('Only issued or deposited cheques can be cleared')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)

  const updated = await repo.finalizeLifecycleTransition({
    tenantId,
    chequeId,
    fromStatuses: [cheque.status],
    toStatus: 'CLEARED',
    expectedUpdatedAt: input.expectedUpdatedAt,
    data: { clearanceDate: parseDateOnly(input.clearanceDate), clearedAt: new Date(), clearedById: userId, updatedById: userId },
  })
  if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()

  await auditTreasuryChequeLifecycle(req, tenantId, chequeId, 'TREASURY_CHEQUE_CLEARED', { clearanceDate: input.clearanceDate })
  return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId))
}

/** ISSUED/DEPOSITED → BOUNCED. Reverses the posted voucher (if any); TRACK_ONLY cheques are status-only. */
export async function bounceTreasuryCheque(req: Request, tenantId: string, chequeId: string, input: BounceTreasuryChequeInput) {
  assertPerm(req, 'finance.treasury.cheque.bounce')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
  if (!['ISSUED', 'DEPOSITED'].includes(cheque.status)) {
    throw new TreasuryChequeInvalidLifecycleActionError('Only issued or deposited cheques can bounce')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)

  const bounceDateValue = parseDateOnly(input.bounceDate)
  const baseData = {
    bounceDate: bounceDateValue,
    bounceReason: input.bounceReason,
    bouncedAt: new Date(),
    bouncedById: userId,
    updatedById: userId,
  }

  if (!cheque.voucherId) {
    const updated = await repo.finalizeLifecycleTransition({
      tenantId,
      chequeId,
      fromStatuses: [cheque.status],
      toStatus: 'BOUNCED',
      expectedUpdatedAt: input.expectedUpdatedAt,
      data: baseData,
    })
    if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
    await auditTreasuryChequeLifecycle(req, tenantId, chequeId, 'TREASURY_CHEQUE_BOUNCED', { bounceReason: input.bounceReason })
    return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId))
  }

  const postingContext = buildPostingContext(tenantId, userId, audit)
  try {
    const posting = await reverseChequeVoucher(
      cheque,
      cheque.voucherId,
      buildTreasuryChequeBounceReversalEventKey(chequeId),
      'TREASURY_CHEQUE_BOUNCE_REVERSED',
      'Bounce reversal',
      input.bounceDate,
      input.bounceReason,
      postingContext,
    )

    if (!posting.idempotentReplay) {
      const updated = await prisma.treasuryCheque.updateMany({
        where: { id: chequeId, tenantId, status: cheque.status },
        data: { ...baseData, status: 'BOUNCED', reversalVoucherId: posting.voucherId, reversalPostingEventId: posting.postingEventId },
      })
      if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
    }

    await auditTreasuryChequeLifecycle(req, tenantId, chequeId, 'TREASURY_CHEQUE_BOUNCED', { bounceReason: input.bounceReason, reversalVoucherId: posting.voucherId })
    return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId))
  } catch (error) {
    mapPostingErrorToTreasuryChequeReversalError(error)
  }
}

/** ISSUED-direction only. DRAFT/READY (no voucher, status-only) or ISSUED (reverses voucher) → STOPPED. */
export async function stopTreasuryCheque(req: Request, tenantId: string, chequeId: string, input: StopTreasuryChequeInput) {
  assertPerm(req, 'finance.treasury.cheque.stop')
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
  if (cheque.direction !== 'ISSUED') throw new TreasuryChequeInvalidLifecycleActionError('Stop payment only applies to issued cheques')
  if (!['DRAFT', 'READY', 'ISSUED'].includes(cheque.status)) {
    throw new TreasuryChequeInvalidLifecycleActionError('Cheque cannot be stopped in its current status')
  }
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)

  const baseData = { stopReason: input.stopReason, stoppedAt: new Date(), stoppedById: userId, updatedById: userId }

  if (!cheque.voucherId) {
    const updated = await repo.finalizeLifecycleTransition({
      tenantId,
      chequeId,
      fromStatuses: [cheque.status],
      toStatus: 'STOPPED',
      expectedUpdatedAt: input.expectedUpdatedAt,
      data: baseData,
    })
    if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
    await auditTreasuryChequeLifecycle(req, tenantId, chequeId, 'TREASURY_CHEQUE_STOPPED', { stopReason: input.stopReason })
    return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId))
  }

  const postingContext = buildPostingContext(tenantId, userId, audit)
  const stopDate = new Date().toISOString().slice(0, 10)
  try {
    const posting = await reverseChequeVoucher(
      cheque,
      cheque.voucherId,
      buildTreasuryChequeStopReversalEventKey(chequeId),
      'TREASURY_CHEQUE_STOP_REVERSED',
      'Stop payment reversal',
      stopDate,
      input.stopReason,
      postingContext,
    )

    if (!posting.idempotentReplay) {
      const updated = await prisma.treasuryCheque.updateMany({
        where: { id: chequeId, tenantId, status: 'ISSUED' },
        data: { ...baseData, status: 'STOPPED', reversalVoucherId: posting.voucherId, reversalPostingEventId: posting.postingEventId },
      })
      if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
    }

    await auditTreasuryChequeLifecycle(req, tenantId, chequeId, 'TREASURY_CHEQUE_STOPPED', { stopReason: input.stopReason, reversalVoucherId: posting.voucherId })
    return serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId))
  } catch (error) {
    mapPostingErrorToTreasuryChequeReversalError(error)
  }
}

/** ISSUED/DEPOSITED/CLEARED → REVERSED (full accounting reversal). Not applicable to TRACK_ONLY cheques. */
export async function reverseTreasuryCheque(req: Request, tenantId: string, chequeId: string, input: ReverseTreasuryChequeInput) {
  if (!hasPerm(req, 'finance.treasury.cheque.reverse')) throw new TreasuryChequeReversalNotAllowedError()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
  if (cheque.status === 'REVERSED') {
    return { cheque: await serializeTreasuryCheque(req, cheque), idempotentReplay: true, posting: null as PostingResult | null }
  }
  if (!['ISSUED', 'DEPOSITED', 'CLEARED'].includes(cheque.status)) {
    throw new TreasuryChequeReversalNotEligibleError(`Cheque must be issued, deposited, or cleared to reverse (current status: ${cheque.status})`)
  }
  if (isTrackOnlyCheque({
    accountingMode: cheque.accountingMode,
    direction: cheque.direction,
    customerReceiptId: cheque.customerReceiptId,
    vendorPaymentId: cheque.vendorPaymentId,
  })) {
    throw new TreasuryChequeInvalidStatusError('TRACK_ONLY cheques cannot be reversed here — reverse the linked receipt/payment instead')
  }
  if (!cheque.voucherId) throw new TreasuryChequeReversalNotEligibleError('Original voucher is missing')
  assertExpectedUpdatedAt(cheque, input.expectedUpdatedAt)

  const reversalDateValue = parseDateOnly(input.reversalDate)
  const postingContext = buildPostingContext(tenantId, userId, audit)

  try {
    const posting = await reverseChequeVoucher(
      cheque,
      cheque.voucherId,
      buildTreasuryChequeReversalEventKey(chequeId),
      'TREASURY_CHEQUE_REVERSED',
      'Reversal',
      input.reversalDate,
      input.reason,
      postingContext,
    )

    if (!posting.idempotentReplay) {
      const updated = await prisma.treasuryCheque.updateMany({
        where: { id: chequeId, tenantId, status: cheque.status, reversedAt: null },
        data: {
          status: 'REVERSED',
          reversalVoucherId: posting.voucherId,
          reversalPostingEventId: posting.postingEventId,
          reversalDate: reversalDateValue,
          reversalReason: input.reason,
          reversedAt: new Date(),
          reversedById: userId,
          updatedById: userId,
          uniquenessKey: null,
        },
      })
      if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'treasury_cheque',
      entityId: chequeId,
      action: 'TREASURY_CHEQUE_REVERSED',
      newValues: { reason: input.reason, reversalDate: input.reversalDate, idempotencyKey: input.idempotencyKey },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const refreshed = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
    return { cheque: await serializeTreasuryCheque(req, refreshed), idempotentReplay: false, posting }
  } catch (error) {
    mapPostingErrorToTreasuryChequeReversalError(error)
  }
}

async function auditTreasuryChequeLifecycle(req: Request, tenantId: string, chequeId: string, action: string, newValues: unknown): Promise<void> {
  const audit = auditFromRequest(req)
  await createAuditLog({
    tenantId,
    userId: req.context?.userId,
    module: 'finance',
    entity: 'treasury_cheque',
    entityId: chequeId,
    action,
    newValues,
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })
}
