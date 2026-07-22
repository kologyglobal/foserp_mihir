import type { Request } from 'express'
import type { AccountingVoucher, AccountingVoucherLine } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { validateReversalEligibility } from '../ledger/ledger.validators.js'
import { post, buildPostedResult } from '../posting/posting.service.js'
import type { PostingContext, PostingRequest, PostingRequestLine, PostingResult } from '../posting/posting.types.js'
import { formatForPersistence } from '../shared/finance-decimal.js'
import { JournalPostingError } from './journal-posting.errors.js'
import * as repo from './journal.repository.js'
import type { JournalWithLines } from './journal.types.js'

export function buildManualJournalReverseEventKey(journalId: string): string {
  return `MANUAL_JOURNAL_REVERSE:${journalId}:V1`
}

export interface ReverseJournalResult {
  posting: PostingResult
  reversalVoucherId: string
  idempotentReplay: boolean
}

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function mapPostingError(error: unknown): never {
  if (error instanceof JournalPostingError) throw error
  if (error && typeof error === 'object' && 'code' in error) {
    const code = String((error as { code?: string }).code)
    const message = error instanceof Error ? error.message : 'Journal reversal failed'
    if (code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new JournalPostingError('IDEMPOTENCY_PAYLOAD_MISMATCH', message)
    }
    if (code === 'POSTING_EVENT_IN_PROGRESS') {
      throw new JournalPostingError('POSTING_EVENT_IN_PROGRESS', message)
    }
    if (code === 'POSTING_CONCURRENT_ACTION') {
      throw new JournalPostingError('POSTING_CONCURRENT_ACTION', message)
    }
    if (
      code === 'ACCOUNTING_PERIOD_CLOSED' ||
      code === 'ACCOUNTING_PERIOD_UNDER_REVIEW' ||
      code === 'ACCOUNTING_PERIOD_NOT_FOUND' ||
      code === 'BACKDATED_POSTING_NOT_ALLOWED'
    ) {
      throw new JournalPostingError('POSTING_PERIOD_NO_LONGER_OPEN', message)
    }
  }
  if (error instanceof Error) {
    throw new JournalPostingError('JOURNAL_REVERSAL_FAILED', error.message)
  }
  throw new JournalPostingError('JOURNAL_REVERSAL_FAILED', 'Journal reversal failed')
}

function buildReversalPostingRequest(
  original: AccountingVoucher,
  lines: AccountingVoucherLine[],
  reason: string,
): PostingRequest {
  const currencyCode = original.currencyCode
  const exchangeRate = original.exchangeRate.toString()
  const postingDate = original.postingDate.toISOString().slice(0, 10)
  const documentDate = original.documentDate.toISOString().slice(0, 10)

  const reversalLines: PostingRequestLine[] = lines
    .sort((a, b) => a.lineNumber - b.lineNumber)
    .map((line) => ({
      lineNumber: line.lineNumber,
      accountId: line.accountId,
      partyType: (line.partyType as PostingRequestLine['partyType']) ?? null,
      partyId: line.partyId,
      partyNameSnapshot: line.partyNameSnapshot,
      debitAmount: formatForPersistence(line.creditAmount),
      creditAmount: formatForPersistence(line.debitAmount),
      baseDebitAmount: formatForPersistence(line.baseCreditAmount),
      baseCreditAmount: formatForPersistence(line.baseDebitAmount),
      currencyCode: line.currencyCode,
      exchangeRate: line.exchangeRate.toString(),
      costCentreId: line.costCentreId,
      projectReference: line.projectReference,
      departmentReference: line.departmentReference,
      referenceDocumentType: line.referenceDocumentType,
      referenceDocumentId: line.referenceDocumentId,
      referenceDocumentLineId: line.referenceDocumentLineId,
      lineNarration: `Reversal: ${line.lineNarration ?? ''}`.slice(0, 500),
    }))

  return {
    legalEntityId: original.legalEntityId,
    eventKey: buildManualJournalReverseEventKey(original.id),
    eventType: 'MANUAL_JOURNAL_REVERSED',
    postingPurpose: 'REVERSAL',
    voucherType: 'REVERSAL',
    documentDate,
    postingDate,
    branchId: original.branchId,
    referenceNumber: original.referenceNumber,
    narration: `Reversal of journal ${original.voucherNumber ?? original.id}: ${reason}`.slice(0, 500),
    currencyCode,
    exchangeRate,
    sourceModule: 'ACCOUNTING',
    sourceDocumentType: 'MANUAL_JOURNAL',
    sourceDocumentId: original.id,
    lines: reversalLines,
  }
}

export async function canReverseJournal(req: Request, journal: JournalWithLines): Promise<boolean> {
  if (journal.status !== 'POSTED') return false
  if (journal.reversedByVoucherId) return false
  if (journal.voucherType !== 'JOURNAL') return false
  return hasPerm(req, 'finance.voucher.reverse')
}

export async function reverseJournalFromRequest(
  req: Request,
  tenantId: string,
  journalId: string,
  reason: string,
): Promise<ReverseJournalResult> {
  if (!hasPerm(req, 'finance.voucher.reverse')) {
    throw new JournalPostingError('JOURNAL_REVERSAL_NOT_ALLOWED', 'Missing permission: finance.voucher.reverse')
  }
  const userId = req.context?.userId
  if (!userId) throw new AuthorizationError('User context required')
  const audit = auditFromRequest(req)

  const journal = await repo.findJournalByIdOrThrow(tenantId, journalId)

  if (journal.status === 'REVERSED') {
    if (!journal.reversedByVoucherId) {
      throw new JournalPostingError(
        'JOURNAL_REVERSAL_NOT_ELIGIBLE',
        'Journal is reversed but missing a reversal voucher link',
      )
    }
    const posting = await buildPostedResult(tenantId, '', journal.reversedByVoucherId, true)
    return {
      posting,
      reversalVoucherId: journal.reversedByVoucherId,
      idempotentReplay: true,
    }
  }

  if (journal.status !== 'POSTED') {
    throw new JournalPostingError(
      'JOURNAL_NOT_POSTED_FOR_REVERSAL',
      `Only POSTED journals can be reversed (current status: ${journal.status})`,
    )
  }
  if (!journal.voucherNumber) {
    throw new JournalPostingError('JOURNAL_NOT_POSTED_FOR_REVERSAL', 'Journal has not been posted to the ledger')
  }
  if (journal.reversedByVoucherId) {
    throw new JournalPostingError('JOURNAL_ALREADY_REVERSED', 'Journal has already been reversed')
  }
  if (journal.voucherType !== 'JOURNAL') {
    throw new JournalPostingError('JOURNAL_REVERSAL_NOT_ELIGIBLE', 'Only manual JOURNAL vouchers can be reversed here')
  }

  const voucherLines = await prisma.accountingVoucherLine.findMany({
    where: { voucherId: journal.id, tenantId },
  })
  if (voucherLines.length < 2) {
    throw new JournalPostingError('JOURNAL_LINES_MISSING', 'Journal must have at least two lines to reverse')
  }

  const postingRequest = buildReversalPostingRequest(journal, voucherLines, reason)
  const postingContext: PostingContext = {
    tenantId,
    userId,
    authorization: { permissionChecked: true },
    workflow: { workflowSatisfied: true },
    ipAddress: audit.ipAddress ?? null,
    userAgent: audit.userAgent ?? null,
  }

  let reversalVoucherId: string | null = null

  try {
    const posting = await post(postingRequest, postingContext, {
      afterAccounting: async ({ tx, context, voucherId }) => {
        const eligibility = validateReversalEligibility(
          journal,
          voucherId,
          context.tenantId,
          journal.legalEntityId,
        )
        if (!eligibility.valid) {
          throw new JournalPostingError(
            'JOURNAL_REVERSAL_NOT_ELIGIBLE',
            eligibility.errors.map((e) => e.message).join('; '),
            eligibility.errors.map((e) => ({ field: e.field ?? 'voucher', message: e.message })),
          )
        }

        const linked = await tx.accountingVoucher.updateMany({
          where: {
            id: journal.id,
            tenantId: context.tenantId,
            status: 'POSTED',
            reversedByVoucherId: null,
          },
          data: {
            status: 'REVERSED',
            reversedByVoucherId: voucherId,
            reversedAt: new Date(),
            reversedBy: context.userId ?? null,
            reversalReason: reason,
            updatedBy: context.userId ?? null,
          },
        })
        if (linked.count !== 1) {
          throw new JournalPostingError('POSTING_CONCURRENT_ACTION', 'Journal changed concurrently during reversal')
        }

        await tx.accountingVoucher.update({
          where: { id: voucherId, tenantId: context.tenantId },
          data: { reversalOfVoucherId: journal.id, reversalReason: reason },
        })

        reversalVoucherId = voucherId
      },
    })

    if (posting.idempotentReplay) {
      return {
        posting,
        reversalVoucherId: posting.voucherId,
        idempotentReplay: true,
      }
    }

    await createAuditLog({
      tenantId,
      userId,
      module: 'finance',
      entity: 'accounting_voucher',
      entityId: journalId,
      action: 'MANUAL_JOURNAL_REVERSED',
      newValues: {
        reversalVoucherId: posting.voucherId,
        reversalVoucherNumber: posting.voucherNumber,
        originalVoucherNumber: journal.voucherNumber,
        reason,
      },
      ipAddress: audit.ipAddress ?? null,
      userAgent: audit.userAgent ?? null,
    })

    return {
      posting,
      reversalVoucherId: reversalVoucherId ?? posting.voucherId,
      idempotentReplay: false,
    }
  } catch (error) {
    mapPostingError(error)
  }
}
