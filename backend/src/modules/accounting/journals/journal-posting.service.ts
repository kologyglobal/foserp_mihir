import type { Request } from 'express'
import type { GeneralLedgerEntry } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { AuthorizationError } from '../../../utils/errors.js'
import { auditFromRequest } from '../../../services/audit.service.js'
import * as approvalRepo from '../approvals/approval.repository.js'
import * as glRepo from '../ledger/general-ledger.repository.js'
import * as postingReadService from '../posting/posting-read.service.js'
import { buildManualJournalPostEventKey, postExistingApprovedVoucher } from '../posting/posting-existing-voucher.service.js'
import { PostingError } from '../posting/posting.errors.js'
import type { PostingResult } from '../posting/posting.types.js'
import { resolvePeriodByDate, enforcePeriodOpenForPosting } from '../posting/posting-period.service.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import * as repo from './journal.repository.js'
import { JournalPostingError } from './journal-posting.errors.js'
import type { JournalWithLines } from './journal.types.js'

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function mapPostingError(error: unknown): never {
  if (error instanceof PostingError) {
    if (error.code === 'IDEMPOTENCY_PAYLOAD_MISMATCH') {
      throw new JournalPostingError('JOURNAL_CHANGED_AFTER_APPROVAL', error.message)
    }
    if (error.code === 'POSTING_EVENT_IN_PROGRESS') {
      throw new JournalPostingError('JOURNAL_POSTING_IN_PROGRESS', error.message)
    }
    if (error.code === 'POSTING_CONCURRENT_ACTION') {
      throw new JournalPostingError('POSTING_CONCURRENT_ACTION', error.message)
    }
    if (
      error.code === 'ACCOUNTING_PERIOD_CLOSED' ||
      error.code === 'ACCOUNTING_PERIOD_UNDER_REVIEW' ||
      error.code === 'ACCOUNTING_PERIOD_NOT_FOUND' ||
      error.code === 'BACKDATED_POSTING_NOT_ALLOWED'
    ) {
      throw new JournalPostingError('POSTING_PERIOD_NO_LONGER_OPEN', error.message)
    }
    throw new JournalPostingError('JOURNAL_POSTING_FAILED', error.message)
  }
  throw error
}

export async function assertJournalApprovalCompleteForPost(
  tenantId: string,
  journal: JournalWithLines,
): Promise<void> {
  if (journal.status !== 'APPROVED') {
    throw new JournalPostingError('JOURNAL_NOT_APPROVED', `Journal status ${journal.status} is not approved`)
  }

  if (journal.voucherNumber) {
    throw new JournalPostingError('JOURNAL_ALREADY_POSTED', 'Journal already has a voucher number assigned')
  }

  if (journal.lines.length < 2) {
    throw new JournalPostingError('JOURNAL_LINES_MISSING', 'Journal must have at least two lines to post')
  }

  if (!journal.approvalRequired) {
    return
  }

  const requests = await approvalRepo.findRequestsForDocument(tenantId, 'JOURNAL', journal.id)
  if (requests.length === 0) {
    throw new JournalPostingError('JOURNAL_APPROVAL_INCOMPLETE', 'No approval request found for this journal')
  }

  const latest = requests[requests.length - 1]!
  if (latest.status !== 'APPROVED') {
    throw new JournalPostingError('JOURNAL_APPROVAL_INCOMPLETE', 'Latest approval cycle is not fully approved')
  }

  const pendingSteps = latest.steps.filter((s) => s.status === 'PENDING' || s.status === 'WAITING')
  if (pendingSteps.length > 0) {
    throw new JournalPostingError('JOURNAL_APPROVAL_INCOMPLETE', 'Approval workflow has pending steps')
  }
}

async function isPeriodOpenForJournal(tenantId: string, journal: JournalWithLines): Promise<boolean> {
  try {
    const resolved = await resolvePeriodByDate(tenantId, journal.legalEntityId, journal.postingDate.toISOString().slice(0, 10))
    if (resolved.financialYear.status !== 'ACTIVE') return false
    if (!resolved.settings?.financeActivated) return false
    enforcePeriodOpenForPosting(resolved.period, parseDateOnly(journal.postingDate.toISOString().slice(0, 10)), resolved.settings)
    return true
  } catch {
    return false
  }
}

export async function canPostJournal(req: Request, journal: JournalWithLines): Promise<boolean> {
  if (journal.status !== 'APPROVED' || journal.voucherNumber) return false
  if (!hasPerm(req, 'finance.voucher.post')) return false
  if (journal.lines.length < 2) return false

  try {
    await assertJournalApprovalCompleteForPost(journal.tenantId, journal)
  } catch {
    return false
  }

  return isPeriodOpenForJournal(journal.tenantId, journal)
}

export async function postJournal(
  req: Request,
  tenantId: string,
  journalId: string,
): Promise<PostingResult> {
  if (!hasPerm(req, 'finance.voucher.post')) {
    throw new JournalPostingError('JOURNAL_POSTING_NOT_ALLOWED', 'Missing permission: finance.voucher.post')
  }

  const journal = await repo.findJournalByIdOrThrow(tenantId, journalId)

  if (journal.status === 'POSTED') {
    if (!journal.voucherNumber) {
      throw new JournalPostingError('JOURNAL_ALREADY_POSTED', 'Journal is posted but missing voucher number')
    }
  } else if (journal.status !== 'APPROVED') {
    throw new JournalPostingError('JOURNAL_NOT_APPROVED', `Journal status ${journal.status} cannot be posted`)
  } else if (journal.voucherNumber) {
    throw new JournalPostingError('JOURNAL_ALREADY_POSTED', 'Journal is already posted')
  }

  if (journal.status === 'APPROVED') {
    const canPost = await canPostJournal(req, journal)
    if (!canPost) {
      throw new JournalPostingError('JOURNAL_POSTING_NOT_ALLOWED', 'Journal is not eligible for posting at this time')
    }
    await assertJournalApprovalCompleteForPost(tenantId, journal)
  }

  const userId = req.context?.userId
  if (!userId) {
    throw new AuthorizationError('User context required')
  }

  const audit = auditFromRequest(req)

  try {
    const posting = await postExistingApprovedVoucher(
      { voucherId: journalId },
      {
        tenantId,
        userId,
        authorization: { permissionChecked: true, approvalWorkflowSatisfied: true },
        ipAddress: audit.ipAddress,
        userAgent: audit.userAgent,
      },
    )
    return posting
  } catch (error) {
    mapPostingError(error)
  }
}

export async function getJournalLedger(tenantId: string, journalId: string): Promise<GeneralLedgerEntry[]> {
  await repo.findJournalByIdOrThrow(tenantId, journalId)
  return postingReadService.getVoucherLedger(tenantId, journalId)
}

export async function findPostingEventIdForJournal(tenantId: string, journalId: string): Promise<string | null> {
  const event = await prisma.postingEvent.findFirst({
    where: {
      tenantId,
      eventKey: buildManualJournalPostEventKey(journalId),
      status: 'POSTED',
    },
    select: { id: true },
  })
  return event?.id ?? null
}

export async function countLedgerEntries(tenantId: string, journalId: string): Promise<number> {
  return glRepo.findByVoucherId(tenantId, journalId).then((rows) => rows.length)
}
