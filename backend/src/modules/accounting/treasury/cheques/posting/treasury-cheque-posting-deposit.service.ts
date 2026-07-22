import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { post, buildPostedResult } from '../../../posting/posting.service.js'
import type { PostingContext } from '../../../posting/posting.types.js'
import { reserveTreasuryChequeNumberForPosting, reserveTreasuryChequeNumberStandalone } from '../treasury-cheque-number.service.js'
import * as repo from '../treasury-cheque.repository.js'
import { mapPostingErrorToTreasuryChequeError, TreasuryChequeConcurrentPostError, TreasuryChequeWrongDirectionError } from '../treasury-cheque.errors.js'
import { serializeTreasuryCheque } from '../treasury-cheque-read.service.js'
import type { DepositTreasuryChequeInput } from '../treasury-cheque.schemas.js'
import { validateTreasuryChequeForReadyToPostAction } from './treasury-cheque-posting-validation.service.js'
import { buildTreasuryChequeDepositEventKey, buildTreasuryChequePostingRequest } from './treasury-cheque-posting-builder.service.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertDepositPermission(req: Request): void {
  if (!hasPerm(req, 'finance.treasury.cheque.deposit')) {
    throw new AuthorizationError('Missing permission: finance.treasury.cheque.deposit')
  }
}

/** RECEIVED-direction cheques: READY → DEPOSITED. Posts Dr bank / Cr counterpart unless TRACK_ONLY. */
export async function depositTreasuryCheque(req: Request, tenantId: string, chequeId: string, body: DepositTreasuryChequeInput) {
  assertDepositPermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const existing = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
  if (existing.direction !== 'RECEIVED') throw new TreasuryChequeWrongDirectionError()
  if (existing.status === 'DEPOSITED') {
    if (existing.postingEventId && existing.voucherId) {
      const posting = await buildPostedResult(tenantId, existing.postingEventId, existing.voucherId, true)
      return { cheque: await serializeTreasuryCheque(req, existing), posting, idempotentReplay: true }
    }
    return { cheque: await serializeTreasuryCheque(req, existing), posting: null, idempotentReplay: true }
  }

  const validated = await validateTreasuryChequeForReadyToPostAction(tenantId, chequeId, body.expectedUpdatedAt, 'RECEIVED', body.depositDate)
  const { cheque, calc, financialYearId } = validated
  const depositDateValue = parseDateOnly(body.depositDate)

  if (calc.isTrackOnly) {
    const registerNumber = await reserveTreasuryChequeNumberStandalone(tenantId, cheque.legalEntityId)
    const updated = await repo.finalizeLifecycleTransition({
      tenantId,
      chequeId,
      fromStatuses: ['READY'],
      toStatus: 'DEPOSITED',
      expectedUpdatedAt: body.expectedUpdatedAt,
      data: { chequeRegisterNumber: registerNumber, depositDate: depositDateValue, depositedAt: new Date(), depositedById: userId, updatedById: userId },
    })
    if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
    await auditTreasuryChequeDeposited(req, tenantId, chequeId, audit, registerNumber, null)
    return { cheque: await serializeTreasuryCheque(req, await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)), posting: null, idempotentReplay: false }
  }

  const postingRequest = buildTreasuryChequePostingRequest({
    cheque,
    preview: calc.accountingPreview,
    eventKey: buildTreasuryChequeDepositEventKey(chequeId),
    eventType: 'TREASURY_CHEQUE_DEPOSITED',
    postingDate: body.depositDate,
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
        await reserveTreasuryChequeNumberForPosting(tenantId, cheque.legalEntityId, financialYearId, event)
        return undefined
      },
      afterAccounting: async ({ tx, context: txContext, eventId, voucherId }) => {
        const event = await tx.postingEvent.findFirstOrThrow({ where: { id: eventId, tenantId: txContext.tenantId } })
        const registerNumber = event.reservedSourceDocumentNumber
        if (!registerNumber) throw new TreasuryChequeConcurrentPostError()

        await tx.accountingVoucher.update({ where: { id: voucherId }, data: { referenceNumber: registerNumber } })

        const updated = await repo.finalizeLifecycleTransition(
          {
            tenantId: txContext.tenantId,
            chequeId,
            fromStatuses: ['READY'],
            toStatus: 'DEPOSITED',
            expectedUpdatedAt: body.expectedUpdatedAt,
            data: {
              chequeRegisterNumber: registerNumber,
              depositDate: depositDateValue,
              voucherId,
              postingEventId: eventId,
              depositedAt: new Date(),
              depositedById: txContext.userId ?? null,
              updatedById: txContext.userId ?? null,
            },
          },
          tx,
        )
        if (updated.count !== 1) throw new TreasuryChequeConcurrentPostError()
      },
    })

    if (posting.idempotentReplay) {
      const refreshed = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
      return { cheque: await serializeTreasuryCheque(req, refreshed), posting, idempotentReplay: true }
    }

    await auditTreasuryChequeDeposited(req, tenantId, chequeId, audit, posting.voucherNumber, posting.postingEventId)
    const refreshed = await repo.findTreasuryChequeByIdOrThrow(tenantId, chequeId)
    return { cheque: await serializeTreasuryCheque(req, refreshed), posting, idempotentReplay: false }
  } catch (error) {
    mapPostingErrorToTreasuryChequeError(error)
  }
}

async function auditTreasuryChequeDeposited(
  req: Request,
  tenantId: string,
  chequeId: string,
  audit: { ipAddress?: string | null; userAgent?: string | null },
  registerNumber: string,
  postingEventId: string | null,
): Promise<void> {
  await createAuditLog({
    tenantId,
    userId: req.context?.userId,
    module: 'finance',
    entity: 'treasury_cheque',
    entityId: chequeId,
    action: 'TREASURY_CHEQUE_DEPOSITED',
    newValues: { chequeRegisterNumber: registerNumber, postingEventId },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  })
}
