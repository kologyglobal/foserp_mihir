import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import { reserveTreasuryAdjustmentNumberForPosting } from '../treasury-adjustment-number.service.js'
import * as repo from '../treasury-adjustment.repository.js'
import { mapPostingErrorToTreasuryAdjustmentError, TreasuryAdjustmentConcurrentPostError } from '../treasury-adjustment.errors.js'
import { serializeTreasuryAdjustment } from '../treasury-adjustment-read.service.js'
import type { PostTreasuryAdjustmentInput } from '../treasury-adjustment.schemas.js'
import { validateTreasuryAdjustmentForPostAction } from './treasury-adjustment-posting-validation.service.js'
import { buildTreasuryAdjustmentPostEventKey, buildTreasuryAdjustmentPostingRequest } from './treasury-adjustment-posting-builder.service.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.treasury.adjustment.post')) {
    throw new AuthorizationError('Missing permission: finance.treasury.adjustment.post')
  }
}

/** READY_TO_POST → POSTED. Posts Dr/Cr offset lines + system-generated bank leg via the central posting engine. */
export async function postTreasuryAdjustment(req: Request, tenantId: string, adjustmentId: string, body: PostTreasuryAdjustmentInput) {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const existing = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
  if (existing.status === 'POSTED') {
    if (existing.postingEventId && existing.voucherId) {
      const posting = await buildPostedResult(tenantId, existing.postingEventId, existing.voucherId, true)
      return { adjustment: await serializeTreasuryAdjustment(req, existing), posting, idempotentReplay: true }
    }
    return { adjustment: await serializeTreasuryAdjustment(req, existing), posting: null, idempotentReplay: true }
  }

  const postingDate = body.postingDate ?? new Date().toISOString().slice(0, 10)
  const validated = await validateTreasuryAdjustmentForPostAction(tenantId, adjustmentId, body.expectedUpdatedAt, postingDate)
  const { adjustment, calc, financialYearId } = validated

  const postingRequest = buildTreasuryAdjustmentPostingRequest({
    adjustment,
    preview: calc.accountingPreview,
    eventKey: buildTreasuryAdjustmentPostEventKey(adjustmentId),
    postingDate,
  })

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  try {
    const posting = await post(postingRequest, postingContext, {
      beforeTransaction: async (event) => {
        await reserveTreasuryAdjustmentNumberForPosting(tenantId, adjustment.legalEntityId, financialYearId, event)
        return undefined
      },
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId }) => {
        const event = await tx.postingEvent.findFirstOrThrow({ where: { id: eventId, tenantId: txContext.tenantId } })
        const adjustmentNumber = event.reservedSourceDocumentNumber
        if (!adjustmentNumber) throw new TreasuryAdjustmentConcurrentPostError()

        await tx.accountingVoucher.update({ where: { id: voucherId }, data: { referenceNumber: adjustmentNumber } })

        const updated = await repo.finalizeLifecycleTransition(
          {
            tenantId: txContext.tenantId,
            adjustmentId,
            fromStatuses: ['READY_TO_POST'],
            toStatus: 'POSTED',
            expectedUpdatedAt: body.expectedUpdatedAt,
            data: {
              adjustmentNumber,
              voucherId,
              postingEventId: eventId,
              postedAt: new Date(),
              postedById: txContext.userId ?? null,
              updatedById: txContext.userId ?? null,
            },
          },
          tx,
        )
        if (updated.count !== 1) throw new TreasuryAdjustmentConcurrentPostError()
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
      return { adjustment: await serializeTreasuryAdjustment(req, refreshed), posting, idempotentReplay: true }
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'treasury_adjustment',
      entityId: adjustmentId,
      action: 'TREASURY_ADJUSTMENT_POSTED',
      newValues: { voucherNumber: posting.voucherNumber, postingEventId: posting.postingEventId },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })
    const refreshed = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, adjustmentId)
    return { adjustment: await serializeTreasuryAdjustment(req, refreshed), posting, idempotentReplay: false }
  } catch (error) {
    mapPostingErrorToTreasuryAdjustmentError(error)
  }
}
