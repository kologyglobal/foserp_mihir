import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../../services/audit.service.js'
import { AuthorizationError } from '../../../../../utils/errors.js'
import { validateReversalEligibility } from '../../../ledger/ledger.validators.js'
import { post } from '../../../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine, PostingResult } from '../../../posting/posting.types.js'
import { formatForPersistence } from '../../../shared/finance-decimal.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'
import * as repo from '../treasury-transfer.repository.js'
import {
  mapPostingErrorToTreasuryTransferReversalError,
  TreasuryTransferConcurrentPostError,
  TreasuryTransferNotFoundError,
  TreasuryTransferReversalBankReconLockError,
  TreasuryTransferReversalNotAllowedError,
  TreasuryTransferReversalNotEligibleError,
  TreasuryTransferStaleVersionError,
} from '../treasury-transfer.errors.js'
import { serializeTreasuryTransfer } from '../treasury-transfer-read.service.js'
import type { TreasuryTransferRow } from '../treasury-transfer.types.js'
import {
  buildTreasuryTransferReversalDirectEventKey,
  buildTreasuryTransferReversalDispatchEventKey,
  buildTreasuryTransferReversalReceiveEventKey,
} from './treasury-transfer-posting-builder.service.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

export function assertReversePermission(req: Request): void {
  if (!hasPerm(req, 'finance.treasury.transfer.reverse')) {
    throw new TreasuryTransferReversalNotAllowedError()
  }
}

/** Blocks reversal while an ACTIVE bank reconciliation match still references either leg's GL entries. */
async function findActiveBankReconLock(tenantId: string, voucherIds: string[]): Promise<string | null> {
  const ids = [...new Set(voucherIds.filter(Boolean))]
  if (ids.length === 0) return null

  const glEntries = await prisma.generalLedgerEntry.findMany({
    where: { tenantId, voucherId: { in: ids } },
    select: { id: true },
  })
  if (glEntries.length === 0) return null

  const activeAllocation = await prisma.bankReconciliationLedgerAllocation.findFirst({
    where: {
      tenantId,
      generalLedgerEntryId: { in: glEntries.map((e) => e.id) },
      reconciliationMatch: { matchStatus: 'ACTIVE' },
    },
    select: { reconciliationMatchId: true },
  })
  return activeAllocation?.reconciliationMatchId ?? null
}

function buildReversalLines(lines: AccountingVoucherLine[], narrationPrefix: string): PostingRequestLine[] {
  return lines
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      debitAmount: formatForPersistence(line.creditAmount),
      creditAmount: formatForPersistence(line.debitAmount),
      baseDebitAmount: formatForPersistence(line.baseCreditAmount),
      baseCreditAmount: formatForPersistence(line.baseDebitAmount),
      currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate.toString(),
      lineNarration: `${narrationPrefix}: ${line.lineNarration ?? ''}`.slice(0, 500),
    }))
}

function buildReversalRequest(params: {
  transfer: TreasuryTransferRow
  originalVoucher: AccountingVoucher
  lines: AccountingVoucherLine[]
  eventKey: string
  eventType: string
  reversalDate: string
  reason: string
  narrationPrefix: string
}): PostingRequest {
  const { transfer, originalVoucher } = params
  return {
    legalEntityId: transfer.legalEntityId,
    eventKey: params.eventKey,
    eventType: params.eventType,
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate: originalVoucher.documentDate.toISOString().slice(0, 10),
    postingDate: params.reversalDate,
    branchId: originalVoucher.branchId,
    referenceNumber: originalVoucher.referenceNumber,
    narration: `${params.narrationPrefix} of treasury transfer ${transfer.transferNumber ?? transfer.draftReference}: ${params.reason}`.slice(0, 500),
    currencyCode: originalVoucher.currencyCode,
    exchangeRate: originalVoucher.exchangeRate.toString(),
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'TREASURY_TRANSFER',
    sourceDocumentId: transfer.id,
    lines: buildReversalLines(params.lines, params.narrationPrefix),
  }
}

export interface TreasuryTransferReversalPreview {
  eligible: boolean
  blockingIssues: string[]
  postingMode: 'DIRECT' | 'IN_TRANSIT'
  sourceVoucherId: string | null
  sourceVoucherNumber: string | null
  destinationVoucherId: string | null
  destinationVoucherNumber: string | null
  bankReconciliationLocked: boolean
}

export async function getTreasuryTransferReversalPreview(
  req: Request,
  tenantId: string,
  transferId: string,
): Promise<TreasuryTransferReversalPreview> {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)

  const blockingIssues: string[] = []
  const canReverse = hasPerm(req, 'finance.treasury.transfer.reverse')
  if (!canReverse) blockingIssues.push('Missing permission finance.treasury.transfer.reverse')
  if (transfer.status !== 'COMPLETED') blockingIssues.push('Transfer must be COMPLETED to reverse')
  if (transfer.reversedAt) blockingIssues.push('Transfer is already reversed')
  if (!transfer.sourceVoucherId) blockingIssues.push('Original source-leg voucher is missing')
  if (transfer.postingMode === 'IN_TRANSIT' && !transfer.destinationVoucherId) {
    blockingIssues.push('Original destination-leg voucher is missing')
  }

  const voucherIds = [transfer.sourceVoucherId, transfer.destinationVoucherId].filter((v): v is string => !!v)
  const lockedMatchId = await findActiveBankReconLock(tenantId, voucherIds)
  if (lockedMatchId) {
    blockingIssues.push('An active bank reconciliation match exists on this transfer\u2019s ledger entries. Unmatch first.')
  }

  const [sourceVoucher, destinationVoucher] = await Promise.all([
    transfer.sourceVoucherId
      ? prisma.accountingVoucher.findFirst({ where: { id: transfer.sourceVoucherId, tenantId }, select: { id: true, voucherNumber: true } })
      : Promise.resolve(null),
    transfer.destinationVoucherId
      ? prisma.accountingVoucher.findFirst({ where: { id: transfer.destinationVoucherId, tenantId }, select: { id: true, voucherNumber: true } })
      : Promise.resolve(null),
  ])

  return {
    eligible: blockingIssues.length === 0,
    blockingIssues,
    postingMode: transfer.postingMode,
    sourceVoucherId: sourceVoucher?.id ?? null,
    sourceVoucherNumber: sourceVoucher?.voucherNumber ?? null,
    destinationVoucherId: destinationVoucher?.id ?? null,
    destinationVoucherNumber: destinationVoucher?.voucherNumber ?? null,
    bankReconciliationLocked: !!lockedMatchId,
  }
}

export interface ReverseTreasuryTransferResult {
  idempotentReplay: boolean
  transferId: string
  status: 'REVERSED'
  reversalSourceVoucherId: string | null
  reversalDestinationVoucherId: string | null
  postings: PostingResult[]
}

async function reverseSingleVoucherLeg(
  transfer: TreasuryTransferRow,
  voucherId: string,
  eventKey: string,
  eventType: string,
  narrationPrefix: string,
  reversalDate: string,
  reason: string,
  postingContext: PostingContext,
): Promise<{ posting: PostingResult; originalVoucher: AccountingVoucher }> {
  const originalVoucher = await prisma.accountingVoucher.findFirst({ where: { id: voucherId, tenantId: transfer.tenantId } })
  if (!originalVoucher) throw new TreasuryTransferReversalNotEligibleError('Original voucher is missing')
  if (originalVoucher.status !== 'POSTED' || originalVoucher.reversedByVoucherId) {
    throw new TreasuryTransferReversalNotEligibleError('Original voucher has already been reversed or is not posted')
  }

  const lines = await prisma.accountingVoucherLine.findMany({ where: { voucherId, tenantId: transfer.tenantId } })
  const request = buildReversalRequest({
    transfer,
    originalVoucher,
    lines,
    eventKey,
    eventType,
    reversalDate,
    reason,
    narrationPrefix,
  })

  const posting = await post(request, postingContext, {
    afterAccounting: async ({ tx, context: txContext, voucherId: reversalVoucherId }) => {
      const eligibility = validateReversalEligibility(originalVoucher, reversalVoucherId, txContext.tenantId, transfer.legalEntityId)
      if (!eligibility.valid) {
        throw new TreasuryTransferReversalNotEligibleError(eligibility.errors.map((e) => e.message).join('; '))
      }
      const linked = await tx.accountingVoucher.updateMany({
        where: { id: originalVoucher.id, tenantId: txContext.tenantId, status: 'POSTED', reversedByVoucherId: null },
        data: { status: 'REVERSED', reversedByVoucherId: reversalVoucherId, reversedAt: new Date(), reversedBy: txContext.userId ?? null, reversalReason: reason },
      })
      if (linked.count !== 1) throw new TreasuryTransferConcurrentPostError()
      await tx.accountingVoucher.update({
        where: { id: reversalVoucherId, tenantId: txContext.tenantId },
        data: { reversalOfVoucherId: originalVoucher.id, reversalReason: reason },
      })
    },
  })
  return { posting, originalVoucher }
}

export async function reverseTreasuryTransferFromRequest(
  req: Request,
  tenantId: string,
  transferId: string,
  body: { reversalDate: string; reason: string; idempotencyKey: string; expectedUpdatedAt: string },
) {
  assertReversePermission(req)
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  let transfer: TreasuryTransferRow
  try {
    transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
  } catch {
    throw new TreasuryTransferNotFoundError()
  }

  if (transfer.status === 'REVERSED') {
    return { transfer: await serializeTreasuryTransfer(req, transfer), idempotentReplay: true, postings: [] as PostingResult[] }
  }
  if (transfer.status !== 'COMPLETED') {
    throw new TreasuryTransferReversalNotEligibleError(`Transfer must be COMPLETED to reverse (current status: ${transfer.status})`)
  }
  if (transfer.updatedAt.getTime() !== new Date(body.expectedUpdatedAt).getTime()) {
    throw new TreasuryTransferStaleVersionError()
  }
  if (!transfer.sourceVoucherId) throw new TreasuryTransferReversalNotEligibleError('Original source-leg voucher is missing')

  const voucherIds = [transfer.sourceVoucherId, transfer.destinationVoucherId].filter((v): v is string => !!v)
  const lockedMatchId = await findActiveBankReconLock(tenantId, voucherIds)
  if (lockedMatchId) throw new TreasuryTransferReversalBankReconLockError()

  const reversalDateValue = parseDateOnly(body.reversalDate)
  if (reversalDateValue < transfer.sourcePostingDate) {
    throw new TreasuryTransferReversalNotEligibleError('Reversal date must not precede the original posting date')
  }

  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  const postings: PostingResult[] = []

  try {
    if (transfer.postingMode === 'DIRECT') {
      const { posting } = await reverseSingleVoucherLeg(
        transfer,
        transfer.sourceVoucherId,
        buildTreasuryTransferReversalDirectEventKey(transferId),
        'TREASURY_TRANSFER_REVERSED',
        'Reversal',
        body.reversalDate,
        body.reason,
        postingContext,
      )
      postings.push(posting)

      if (!posting.idempotentReplay) {
        const updated = await prisma.treasuryTransfer.updateMany({
          where: { id: transferId, tenantId, status: 'COMPLETED', reversedAt: null },
          data: {
            status: 'REVERSED',
            reversalSourceVoucherId: posting.voucherId,
            reversalDestinationVoucherId: posting.voucherId,
            reversalSourcePostingEventId: posting.postingEventId,
            reversalDestinationPostingEventId: posting.postingEventId,
            reversalDate: reversalDateValue,
            reversalReason: body.reason,
            reversedAt: new Date(),
            reversedById: userId,
            updatedById: userId,
          },
        })
        if (updated.count !== 1) throw new TreasuryTransferConcurrentPostError()
      }
    } else {
      if (!transfer.destinationVoucherId) throw new TreasuryTransferReversalNotEligibleError('Original destination-leg voucher is missing')

      // "reverse receipt then dispatch" — reverse in reverse-chronological order.
      const receiveResult = await reverseSingleVoucherLeg(
        transfer,
        transfer.destinationVoucherId,
        buildTreasuryTransferReversalReceiveEventKey(transferId),
        'TREASURY_TRANSFER_RECEIVE_REVERSED',
        'Reversal of receipt',
        body.reversalDate,
        body.reason,
        postingContext,
      )
      postings.push(receiveResult.posting)

      const dispatchResult = await reverseSingleVoucherLeg(
        transfer,
        transfer.sourceVoucherId,
        buildTreasuryTransferReversalDispatchEventKey(transferId),
        'TREASURY_TRANSFER_DISPATCH_REVERSED',
        'Reversal of dispatch',
        body.reversalDate,
        body.reason,
        postingContext,
      )
      postings.push(dispatchResult.posting)

      const updated = await prisma.treasuryTransfer.updateMany({
        where: { id: transferId, tenantId, status: 'COMPLETED', reversedAt: null },
        data: {
          status: 'REVERSED',
          reversalDestinationVoucherId: receiveResult.posting.voucherId,
          reversalDestinationPostingEventId: receiveResult.posting.postingEventId,
          reversalSourceVoucherId: dispatchResult.posting.voucherId,
          reversalSourcePostingEventId: dispatchResult.posting.postingEventId,
          reversalDate: reversalDateValue,
          reversalReason: body.reason,
          reversedAt: new Date(),
          reversedById: userId,
          updatedById: userId,
        },
      })
      if (updated.count !== 1 && !(receiveResult.posting.idempotentReplay && dispatchResult.posting.idempotentReplay)) {
        throw new TreasuryTransferConcurrentPostError()
      }
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'treasury_transfer',
      entityId: transferId,
      action: 'TREASURY_TRANSFER_REVERSED',
      newValues: { reason: body.reason, reversalDate: body.reversalDate, idempotencyKey: body.idempotencyKey },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    const refreshed = await repo.findTreasuryTransferByIdOrThrow(tenantId, transferId)
    return { transfer: await serializeTreasuryTransfer(req, refreshed), idempotentReplay: false, postings }
  } catch (error) {
    mapPostingErrorToTreasuryTransferReversalError(error)
  }
}
