import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import { reserveTreasuryTransferNumber } from '../treasury-transfer-number.service.js'
import * as repo from '../treasury-transfer.repository.js'
import {
  mapPostingErrorToTreasuryTransferError,
  TreasuryTransferConcurrentPostError,
} from '../treasury-transfer.errors.js'
import { serializeTreasuryTransfer } from '../treasury-transfer-read.service.js'
import { validateTreasuryTransferForReadyToPostAction } from './treasury-transfer-posting-validation.service.js'
import { buildTreasuryTransferDirectEventKey, buildTreasuryTransferPostingRequest } from './treasury-transfer-posting-builder.service.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertPostPermission(req: Request): void {
  if (!hasPerm(req, 'finance.treasury.transfer.post')) {
    throw new AuthorizationError('Missing permission: finance.treasury.transfer.post')
  }
}

export async function postTreasuryTransferDirect(
  req: Request,
  tenantId: string,
  transferId: string,
  body: { expectedUpdatedAt: string },
) {
  assertPostPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const existing = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
  if (existing.status === 'COMPLETED' && existing.sourceVoucherId && existing.sourcePostingEventId) {
    const posting = await buildPostedResult(tenantId, existing.sourcePostingEventId, existing.sourceVoucherId, true)
    return { transfer: await serializeTreasuryTransfer(req, existing), posting, idempotentReplay: true }
  }

  const validated = await validateTreasuryTransferForReadyToPostAction(tenantId, transferId, body.expectedUpdatedAt, 'DIRECT')
  const { transfer, calc, financialYearId, postingDate } = validated

  const postingRequest = buildTreasuryTransferPostingRequest({
    transfer,
    preview: calc.accountingPreview,
    eventKey: buildTreasuryTransferDirectEventKey(transferId),
    eventType: 'TREASURY_TRANSFER_POSTED',
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
        await reserveTreasuryTransferNumber(tenantId, transfer.legalEntityId, financialYearId, event)
        return undefined
      },
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId }) => {
        const event = await tx.postingEvent.findFirstOrThrow({ where: { id: eventId, tenantId: txContext.tenantId } })
        const transferNumber = event.reservedSourceDocumentNumber
        if (!transferNumber) throw new TreasuryTransferConcurrentPostError()

        await tx.accountingVoucher.update({ where: { id: voucherId }, data: { referenceNumber: transferNumber } })

        const updated = await repo.finalizeDirectPost(tx, {
          tenantId: txContext.tenantId,
          transferId,
          expectedUpdatedAt: body.expectedUpdatedAt,
          transferNumber,
          sourceVoucherId: voucherId,
          sourcePostingEventId: eventId,
          postedById: txContext.userId ?? null,
        })
        if (updated.count !== 1) throw new TreasuryTransferConcurrentPostError()
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
      return { transfer: await serializeTreasuryTransfer(req, refreshed), posting, idempotentReplay: true }
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'treasury_transfer',
      entityId: transferId,
      action: 'TREASURY_TRANSFER_POSTED_DIRECT',
      newValues: { voucherNumber: posting.voucherNumber, postingEventId: posting.postingEventId },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const refreshed = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
    return { transfer: await serializeTreasuryTransfer(req, refreshed), posting, idempotentReplay: false }
  } catch (error) {
    mapPostingErrorToTreasuryTransferError(error)
  }
}
