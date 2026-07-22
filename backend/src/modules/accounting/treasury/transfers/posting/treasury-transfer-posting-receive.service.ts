import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import { buildTreasuryTransferReceivePreview } from '../treasury-transfer-accounting-preview.service.js'
import * as repo from '../treasury-transfer.repository.js'
import {
  mapPostingErrorToTreasuryTransferError,
  TreasuryTransferConcurrentPostError,
  TreasuryTransferDispatcherReceiveNotAllowedError,
} from '../treasury-transfer.errors.js'
import { serializeTreasuryTransfer } from '../treasury-transfer-read.service.js'
import { validateTreasuryTransferForReceiveAction } from './treasury-transfer-posting-validation.service.js'
import { buildTreasuryTransferPostingRequest, buildTreasuryTransferReceiveEventKey } from './treasury-transfer-posting-builder.service.js'
import { prisma } from '../../../../../config/database.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertReceivePermission(req: Request): void {
  if (!hasPerm(req, 'finance.treasury.transfer.receive')) {
    throw new AuthorizationError('Missing permission: finance.treasury.transfer.receive')
  }
}

export async function receiveTreasuryTransfer(
  req: Request,
  tenantId: string,
  transferId: string,
  body: { expectedUpdatedAt: string },
) {
  assertReceivePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const existing = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
  if (existing.status === 'COMPLETED' && existing.destinationVoucherId && existing.destinationPostingEventId) {
    const posting = await buildPostedResult(tenantId, existing.destinationPostingEventId, existing.destinationVoucherId, true)
    return { transfer: await serializeTreasuryTransfer(req, existing), posting, idempotentReplay: true }
  }

  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId: existing.legalEntityId } })
  if (settings?.treasuryTransferPreventDispatcherReceive && existing.dispatchedById && existing.dispatchedById === userId) {
    throw new TreasuryTransferDispatcherReceiveNotAllowedError()
  }

  const validated = await validateTreasuryTransferForReceiveAction(tenantId, transferId, body.expectedUpdatedAt)
  const { transfer, calc, postingDate } = validated

  const preview = buildTreasuryTransferReceivePreview({
    postingMode: 'IN_TRANSIT',
    accounts: calc.accounts,
    transferAmount: calc.baseTransferAmount,
    sourceLabel: transfer.sourceAccountNameSnapshot,
    destinationLabel: transfer.destinationAccountNameSnapshot,
  })

  const postingRequest = buildTreasuryTransferPostingRequest({
    transfer,
    preview,
    eventKey: buildTreasuryTransferReceiveEventKey(transferId),
    eventType: 'TREASURY_TRANSFER_RECEIVED',
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
      afterAccounting: async ({ tx, context: txContext, voucherId, eventId }) => {
        const updated = await repo.finalizeReceive(tx, {
          tenantId: txContext.tenantId,
          transferId,
          expectedUpdatedAt: body.expectedUpdatedAt,
          destinationVoucherId: voucherId,
          destinationPostingEventId: eventId,
          receivedById: txContext.userId ?? null,
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
      action: 'TREASURY_TRANSFER_RECEIVED',
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
