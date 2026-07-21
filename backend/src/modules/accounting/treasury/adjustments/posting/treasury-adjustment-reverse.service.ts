import type { Request } from 'express'
import type { AccountingVoucher } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { validateReversalEligibility } from '../../../ledger/ledger.validators.js'
import { post } from '../../../posting/posting.service.js'
import type { PostingContext, PostingResult } from '../../../posting/posting.types.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'
import * as repo from '../treasury-adjustment.repository.js'
import {
  mapPostingErrorToTreasuryAdjustmentReversalError,
  TreasuryAdjustmentActiveReconciliationMatchError,
  TreasuryAdjustmentConcurrentPostError,
  TreasuryAdjustmentReversalNotAllowedError,
  TreasuryAdjustmentReversalNotEligibleError,
  TreasuryAdjustmentStaleVersionError,
} from '../treasury-adjustment.errors.js'
import { serializeTreasuryAdjustment } from '../treasury-adjustment-read.service.js'
import type { ReverseTreasuryAdjustmentInput } from '../treasury-adjustment.schemas.js'
import type { TreasuryAdjustmentWithLines } from '../treasury-adjustment.types.js'
import { buildTreasuryAdjustmentReversalEventKey, buildTreasuryAdjustmentReversalRequest } from './treasury-adjustment-posting-builder.service.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function assertExpectedUpdatedAt(adjustment: TreasuryAdjustmentWithLines, expectedUpdatedAt: string): void {
  if (adjustment.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) throw new TreasuryAdjustmentStaleVersionError()
}

async function assertNoActiveReconciliationMatch(adjustment: TreasuryAdjustmentWithLines): Promise<void> {
  if (!adjustment.reconciliationMatchId) return
  const match = await prisma.bankReconciliationMatch.findFirst({
    where: { id: adjustment.reconciliationMatchId, tenantId: adjustment.tenantId },
    select: { matchStatus: true },
  })
  if (match?.matchStatus === 'ACTIVE') {
    throw new TreasuryAdjustmentActiveReconciliationMatchError()
  }
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

async function reverseAdjustmentVoucher(
  adjustment: TreasuryAdjustmentWithLines,
  voucherId: string,
  eventKey: string,
  reversalDate: string,
  reason: string,
  postingContext: PostingContext,
): Promise<PostingResult> {
  const originalVoucher = await prisma.accountingVoucher.findFirst({ where: { id: voucherId, tenantId: adjustment.tenantId } })
  if (!originalVoucher) throw new TreasuryAdjustmentReversalNotEligibleError('Original voucher is missing')
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new TreasuryAdjustmentReversalNotEligibleError('Original voucher has already been reversed or is not posted')
  }

  const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId, tenantId: adjustment.tenantId } })
  const request = buildTreasuryAdjustmentReversalRequest({ adjustment, originalVoucher, lines, eventKey, reversalDate, reason })

  return post(request, postingContext, {
    afterAccounting: async ({ tx, context: txContext, voucherId: reversalVoucherId }) => {
      const eligibility = validateReversalEligibility(originalVoucher as AccountingVoucher, reversalVoucherId, txContext.tenantId, adjustment.legalEntityId)
      if (!eligibility.valid) {
        throw new TreasuryAdjustmentReversalNotEligibleError(eligibility.errors.map((e) => e.message).join('; '))
      }
      const linked = await tx.accountingVoucher.updateMany({
        where: { id: originalVoucher.id, tenantId: txContext.tenantId, status: 'POSTED', reversedByVoucherId: null },
        data: { status: 'REVERSED', reversedByVoucherId: reversalVoucherId, reversedAt: new Date(), reversedBy: txContext.userId ?? null, reversalReason: reason },
      })
      if (linked.count !== 1) throw new TreasuryAdjustmentConcurrentPostError()
      await tx.accountingVoucher.update({
        where: { id: reversalVoucherId, tenantId: txContext.tenantId },
        data: { reversalOfVoucherId: originalVoucher.id, reversalReason: reason },
      })
    },
  })
}

/** POSTED → REVERSED (full accounting reversal). Blocked when the bank leg has an active reconciliation match. */
export async function reverseTreasuryAdjustment(req: Request, tenantId: string, adjustmentId: string, input: ReverseTreasuryAdjustmentInput) {
  if (!hasPerm(req, 'finance.treasury.adjustment.reverse')) throw new TreasuryAdjustmentReversalNotAllowedError()
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
  if (adjustment.status === 'REVERSED') {
    return { adjustment: await serializeTreasuryAdjustment(req, adjustment), idempotentReplay: true, posting: null as PostingResult | null }
  }
  if (adjustment.status !== 'POSTED') {
    throw new TreasuryAdjustmentReversalNotEligibleError(`Treasury adjustment must be posted to reverse (current status: ${adjustment.status})`)
  }
  if (!adjustment.voucherId) throw new TreasuryAdjustmentReversalNotEligibleError('Original voucher is missing')
  await assertNoActiveReconciliationMatch(adjustment)
  assertExpectedUpdatedAt(adjustment, input.expectedUpdatedAt)

  const reversalDateValue = parseDateOnly(input.reversalDate)
  const postingContext = buildPostingContext(tenantId, userId, audit)

  try {
    const posting = await reverseAdjustmentVoucher(adjustment, adjustment.voucherId, buildTreasuryAdjustmentReversalEventKey(adjustmentId), input.reversalDate, input.reason, postingContext)

    if (!posting.idempotentReplay) {
      const updated = await prisma.treasuryAdjustment.updateMany({
        where: { id: adjustmentId, tenantId, status: 'POSTED', reversedAt: null },
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
      if (updated.count !== 1) throw new TreasuryAdjustmentConcurrentPostError()
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'treasury_adjustment',
      entityId: adjustmentId,
      action: 'TREASURY_ADJUSTMENT_REVERSED',
      newValues: { reason: input.reason, reversalDate: input.reversalDate, idempotencyKey: input.idempotencyKey },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const refreshed = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
    return { adjustment: await serializeTreasuryAdjustment(req, refreshed), idempotentReplay: false, posting }
  } catch (error) {
    mapPostingErrorToTreasuryAdjustmentReversalError(error)
  }
}
