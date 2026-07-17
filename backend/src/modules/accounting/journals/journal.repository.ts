import type { AccountingVoucher, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { ConflictError, InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import { toDecimal } from '../shared/finance-decimal.js'
import { resolvePeriodByDate } from '../posting/posting-period.service.js'
import { computeLineTotals, validateVoucherEditability, validateVoucherLinesWithMasters } from '../ledger/ledger.validators.js'
import type { DraftVoucherLineInput } from '../ledger/ledger.types.js'
import type { CreateJournalInput, ListJournalsQuery, UpdateJournalInput } from './journal.schemas.js'
import {
  CANCELLABLE_JOURNAL_STATUSES,
  JOURNAL_SOURCE_DOCUMENT_TYPE,
  JOURNAL_SOURCE_MODULE,
  SUBMITTABLE_JOURNAL_STATUSES,
  type JournalWithLines,
} from './journal.types.js'
import { normalizeLines } from './journal-validation.service.js'

const JOURNAL_FILTER = {
  voucherType: 'JOURNAL' as const,
  sourceModule: JOURNAL_SOURCE_MODULE,
  sourceDocumentType: JOURNAL_SOURCE_DOCUMENT_TYPE,
}

function mapLineData(
  tenantId: string,
  legalEntityId: string,
  voucherId: string,
  line: DraftVoucherLineInput,
): Prisma.AccountingVoucherLineCreateManyInput {
  const rate = toDecimal(line.exchangeRate ?? '1')
  const debit = toDecimal(line.debitAmount)
  const credit = toDecimal(line.creditAmount)
  return {
    tenantId,
    legalEntityId,
    voucherId,
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    partyType: line.partyType ?? null,
    partyId: line.partyId ?? null,
    partyNameSnapshot: line.partyNameSnapshot ?? null,
    debitAmount: debit,
    creditAmount: credit,
    baseDebitAmount: line.baseDebitAmount != null ? toDecimal(line.baseDebitAmount) : debit.mul(rate),
    baseCreditAmount: line.baseCreditAmount != null ? toDecimal(line.baseCreditAmount) : credit.mul(rate),
    currencyCode: line.currencyCode ?? 'INR',
    exchangeRate: rate,
    costCentreId: line.costCentreId ?? null,
    projectReference: line.projectReference ?? null,
    departmentReference: line.departmentReference ?? null,
    referenceDocumentType: line.referenceDocumentType ?? null,
    referenceDocumentId: line.referenceDocumentId ?? null,
    referenceDocumentLineId: line.referenceDocumentLineId ?? null,
    dueDate: line.dueDate ? parseDateOnly(line.dueDate) : null,
    lineNarration: line.lineNarration ?? null,
  }
}

function draftReferenceFor(id: string): string {
  return `JRN-D-${id.slice(0, 8).toUpperCase()}`
}

export async function createDraftJournal(
  tenantId: string,
  input: CreateJournalInput,
  createdBy?: string,
): Promise<JournalWithLines> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const { financialYear, period } = await resolvePeriodByDate(tenantId, input.legalEntityId, input.postingDate)
  const draftLines = normalizeLines(input.lines)

  const lineValidation = await validateVoucherLinesWithMasters(tenantId, input.legalEntityId, draftLines)
  if (!lineValidation.valid) {
    throw new ValidationError(
      lineValidation.errors[0]?.message ?? 'Invalid journal lines',
      lineValidation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })),
    )
  }

  const totals = computeLineTotals(draftLines)

  const voucher = await prisma.$transaction(async (tx) => {
    const created = await tx.accountingVoucher.create({
      data: {
        tenantId,
        legalEntityId: input.legalEntityId,
        branchId: input.branchId ?? null,
        financialYearId: financialYear.id,
        accountingPeriodId: period.id,
        voucherType: 'JOURNAL',
        status: 'DRAFT',
        documentDate: parseDateOnly(input.documentDate),
        postingDate: parseDateOnly(input.postingDate),
        referenceNumber: input.referenceNumber ?? null,
        externalReference: input.externalReference ?? null,
        narration: input.narration ?? null,
        currencyCode: input.currencyCode ?? 'INR',
        exchangeRate: toDecimal(input.exchangeRate ?? '1'),
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        baseTotalDebit: totals.baseTotalDebit,
        baseTotalCredit: totals.baseTotalCredit,
        sourceModule: JOURNAL_SOURCE_MODULE,
        sourceDocumentType: JOURNAL_SOURCE_DOCUMENT_TYPE,
        createdBy: createdBy ?? null,
        updatedBy: createdBy ?? null,
      },
    })

    const ref = input.referenceNumber?.trim() ? input.referenceNumber : draftReferenceFor(created.id)
    await tx.accountingVoucher.update({
      where: { id: created.id },
      data: { referenceNumber: ref },
    })

    const lineData = draftLines.map((line) => mapLineData(tenantId, input.legalEntityId, created.id, line))
    if (lineData.length > 0) await tx.accountingVoucherLine.createMany({ data: lineData })

    return tx.accountingVoucher.findFirstOrThrow({
      where: { id: created.id, tenantId },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
  })

  return voucher
}

export async function updateDraftJournal(
  tenantId: string,
  id: string,
  input: UpdateJournalInput,
  updatedBy?: string,
): Promise<JournalWithLines> {
  const existing = await findJournalById(tenantId, id)
  if (!existing) throw new NotFoundError('Journal not found')

  const editCheck = validateVoucherEditability(existing.status as never, 'updateDraft')
  if (!editCheck.valid) throw new InvalidStateError(editCheck.errors[0]?.message ?? 'Journal not editable')

  if (input.updatedAt) {
    const expected = new Date(input.updatedAt).getTime()
    if (existing.updatedAt.getTime() !== expected) {
      throw new ConflictError('Journal was modified by another user — refresh and try again')
    }
  }

  const postingDate = input.postingDate ?? existing.postingDate.toISOString().slice(0, 10)
  const { financialYear, period } = await resolvePeriodByDate(tenantId, existing.legalEntityId, postingDate)
  const draftLines = normalizeLines(input.lines)

  const lineValidation = await validateVoucherLinesWithMasters(tenantId, existing.legalEntityId, draftLines)
  if (!lineValidation.valid) {
    throw new ValidationError(
      lineValidation.errors[0]?.message ?? 'Invalid journal lines',
      lineValidation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })),
    )
  }

  const totals = computeLineTotals(draftLines)

  return prisma.$transaction(async (tx) => {
    await tx.accountingVoucherLine.deleteMany({ where: { voucherId: id, tenantId } })
    const lineData = draftLines.map((line) => mapLineData(tenantId, existing.legalEntityId, id, line))
    if (lineData.length > 0) await tx.accountingVoucherLine.createMany({ data: lineData })

    return tx.accountingVoucher.update({
      where: { id, tenantId },
      data: {
        branchId: input.branchId !== undefined ? input.branchId : undefined,
        financialYearId: financialYear.id,
        accountingPeriodId: period.id,
        documentDate: input.documentDate ? parseDateOnly(input.documentDate) : undefined,
        postingDate: input.postingDate ? parseDateOnly(input.postingDate) : undefined,
        referenceNumber: input.referenceNumber !== undefined ? input.referenceNumber : undefined,
        externalReference: input.externalReference !== undefined ? input.externalReference : undefined,
        narration: input.narration !== undefined ? input.narration : undefined,
        currencyCode: input.currencyCode ?? undefined,
        exchangeRate: input.exchangeRate ? toDecimal(input.exchangeRate) : undefined,
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        baseTotalDebit: totals.baseTotalDebit,
        baseTotalCredit: totals.baseTotalCredit,
        updatedBy: updatedBy ?? undefined,
      },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    })
  })
}

export async function findJournalById(tenantId: string, id: string): Promise<JournalWithLines | null> {
  return prisma.accountingVoucher.findFirst({
    where: { id, tenantId, ...JOURNAL_FILTER },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
}

export async function findJournalByIdOrThrow(tenantId: string, id: string): Promise<JournalWithLines> {
  const item = await findJournalById(tenantId, id)
  if (!item) throw new NotFoundError('Journal not found')
  return item
}

export async function findJournals(tenantId: string, query: ListJournalsQuery) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.AccountingVoucherWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...JOURNAL_FILTER,
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.approvalRequired !== undefined ? { approvalRequired: query.approvalRequired } : {}),
    ...(query.createdBy ? { createdBy: query.createdBy } : {}),
    ...(query.postingDateFrom || query.postingDateTo
      ? {
          postingDate: {
            ...(query.postingDateFrom ? { gte: parseDateOnly(query.postingDateFrom) } : {}),
            ...(query.postingDateTo ? { lte: parseDateOnly(query.postingDateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { referenceNumber: { contains: query.search } },
            { externalReference: { contains: query.search } },
            { narration: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.accountingVoucher.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    }),
    prisma.accountingVoucher.count({ where }),
  ])

  return { items, total, page: query.page, limit: query.limit }
}

export async function submitJournal(
  tenantId: string,
  id: string,
  status: 'PENDING_APPROVAL' | 'APPROVED',
  approvalRequired: boolean,
  approvalLevel: number,
  updatedBy?: string,
): Promise<AccountingVoucher> {
  const journal = await findJournalByIdOrThrow(tenantId, id)
  if (!SUBMITTABLE_JOURNAL_STATUSES.includes(journal.status)) {
    throw new InvalidStateError(`Journal in status ${journal.status} cannot be submitted`)
  }

  return prisma.accountingVoucher.update({
    where: { id, tenantId },
    data: {
      status,
      approvalRequired,
      currentApprovalLevel: approvalRequired ? approvalLevel : 0,
      updatedBy: updatedBy ?? undefined,
    },
  })
}

export async function cancelJournal(
  tenantId: string,
  id: string,
  cancellationReason: string,
  cancelledBy?: string,
): Promise<AccountingVoucher> {
  const journal = await findJournalByIdOrThrow(tenantId, id)
  if (!CANCELLABLE_JOURNAL_STATUSES.includes(journal.status)) {
    throw new InvalidStateError(`Journal in status ${journal.status} cannot be cancelled`)
  }
  if (!cancellationReason.trim()) {
    throw new ValidationError('Cancellation reason is required')
  }

  return prisma.accountingVoucher.update({
    where: { id, tenantId },
    data: {
      status: 'CANCELLED',
      cancellationReason: cancellationReason.trim(),
      cancelledAt: new Date(),
      cancelledBy: cancelledBy ?? null,
      updatedBy: cancelledBy ?? undefined,
    },
  })
}

export async function listJournalAudit(tenantId: string, journalId: string) {
  return prisma.auditLog.findMany({
    where: {
      tenantId,
      module: 'finance',
      entity: 'journal',
      entityId: journalId,
    },
    orderBy: { createdAt: 'desc' },
  })
}
