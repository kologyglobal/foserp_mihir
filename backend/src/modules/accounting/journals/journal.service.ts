import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { JournalApprovalBlockedError, JournalValidationBlockedError } from './journal.errors.js'
import * as repo from './journal.repository.js'
import { validateJournal } from './journal-validation.service.js'
import type {
  CreateJournalInput,
  CancelJournalInput,
  ListJournalsQuery,
  UpdateJournalInput,
} from './journal.schemas.js'
import type { JournalAllowedActions, JournalDetailDto, JournalListItemDto, JournalWithLines } from './journal.types.js'
import { EDITABLE_VOUCHER_STATUSES } from '../ledger/ledger.types.js'
import { CANCELLABLE_JOURNAL_STATUSES, SUBMITTABLE_JOURNAL_STATUSES } from './journal.types.js'

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

function hasPerm(req: Request, permission: string): boolean {
  const perms = req.context?.permissions ?? []
  return perms.includes('tenant.manage') || perms.includes(permission)
}

function serializeLine(line: JournalWithLines['lines'][number]) {
  return {
    id: line.id,
    lineNumber: line.lineNumber,
    accountId: line.accountId,
    partyType: line.partyType,
    partyId: line.partyId,
    partyNameSnapshot: line.partyNameSnapshot,
    debitAmount: line.debitAmount.toFixed(4),
    creditAmount: line.creditAmount.toFixed(4),
    baseDebitAmount: line.baseDebitAmount.toFixed(4),
    baseCreditAmount: line.baseCreditAmount.toFixed(4),
    currencyCode: line.currencyCode,
    exchangeRate: line.exchangeRate.toFixed(8),
    costCentreId: line.costCentreId,
    projectReference: line.projectReference,
    departmentReference: line.departmentReference,
    referenceDocumentType: line.referenceDocumentType,
    referenceDocumentId: line.referenceDocumentId,
    referenceDocumentLineId: line.referenceDocumentLineId,
    dueDate: line.dueDate ? line.dueDate.toISOString().slice(0, 10) : null,
    lineNarration: line.lineNarration,
  }
}

function buildAllowedActions(req: Request, journal: JournalWithLines): JournalAllowedActions {
  const editable = EDITABLE_VOUCHER_STATUSES.includes(journal.status as never)
  const submittable = SUBMITTABLE_JOURNAL_STATUSES.includes(journal.status)
  const cancellable = CANCELLABLE_JOURNAL_STATUSES.includes(journal.status)
  const canView = hasPerm(req, 'finance.voucher.view')

  return {
    edit: editable && hasPerm(req, 'finance.voucher.edit'),
    validate: canView,
    submit: submittable && hasPerm(req, 'finance.voucher.submit'),
    cancel: cancellable && hasPerm(req, 'finance.voucher.cancel'),
    approve: false,
    reject: false,
    sendBack: false,
    post: false,
    reverse: false,
  }
}

function serializeJournal(journal: JournalWithLines, req?: Request): JournalDetailDto {
  return {
    id: journal.id,
    tenantId: journal.tenantId,
    legalEntityId: journal.legalEntityId,
    branchId: journal.branchId,
    financialYearId: journal.financialYearId,
    accountingPeriodId: journal.accountingPeriodId,
    voucherType: 'JOURNAL',
    voucherNumber: journal.voucherNumber,
    status: journal.status as JournalDetailDto['status'],
    documentDate: journal.documentDate.toISOString().slice(0, 10),
    postingDate: journal.postingDate.toISOString().slice(0, 10),
    referenceNumber: journal.referenceNumber,
    externalReference: journal.externalReference,
    narration: journal.narration,
    currencyCode: journal.currencyCode,
    exchangeRate: journal.exchangeRate.toFixed(8),
    totalDebit: journal.totalDebit.toFixed(4),
    totalCredit: journal.totalCredit.toFixed(4),
    baseTotalDebit: journal.baseTotalDebit.toFixed(4),
    baseTotalCredit: journal.baseTotalCredit.toFixed(4),
    sourceModule: journal.sourceModule ?? 'ACCOUNTING',
    sourceDocumentType: journal.sourceDocumentType ?? 'MANUAL_JOURNAL',
    approvalRequired: journal.approvalRequired,
    currentApprovalLevel: journal.currentApprovalLevel,
    cancellationReason: journal.cancellationReason,
    createdBy: journal.createdBy,
    updatedBy: journal.updatedBy,
    createdAt: journal.createdAt.toISOString(),
    updatedAt: journal.updatedAt.toISOString(),
    lines: journal.lines.map(serializeLine),
    allowedActions: req ? buildAllowedActions(req, journal) : {
      edit: false,
      validate: false,
      submit: false,
      cancel: false,
      approve: false,
      reject: false,
      sendBack: false,
      post: false,
      reverse: false,
    },
  }
}

function serializeListItem(journal: JournalWithLines): JournalListItemDto {
  const detail = serializeJournal(journal)
  const { lines: _lines, allowedActions: _actions, ...rest } = detail
  return {
    ...rest,
    draftReference: journal.referenceNumber,
  }
}

async function writeAudit(
  req: Request,
  tenantId: string,
  journalId: string,
  action: string,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  const audit = auditMeta(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'journal',
    entityId: journalId,
    action,
    oldValues,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

export async function listJournals(_req: Request, tenantId: string, query: ListJournalsQuery) {
  const result = await repo.findJournals(tenantId, query)
  return {
    ...result,
    items: result.items.map(serializeListItem),
  }
}

export async function getJournal(req: Request, tenantId: string, id: string): Promise<JournalDetailDto> {
  const journal = await repo.findJournalByIdOrThrow(tenantId, id)
  return serializeJournal(journal, req)
}

export async function createJournal(req: Request, tenantId: string, input: CreateJournalInput): Promise<JournalDetailDto> {
  const userId = req.context?.userId ?? ''
  const journal = await repo.createDraftJournal(tenantId, input, userId)
  await writeAudit(req, tenantId, journal.id, 'CREATE_DRAFT', undefined, serializeJournal(journal))
  return serializeJournal(journal, req)
}

export async function updateJournal(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateJournalInput,
): Promise<JournalDetailDto> {
  const userId = req.context?.userId ?? ''
  const before = await repo.findJournalByIdOrThrow(tenantId, id)
  const journal = await repo.updateDraftJournal(tenantId, id, input, userId)
  await writeAudit(req, tenantId, id, 'UPDATE_DRAFT', serializeJournal(before), serializeJournal(journal))
  return serializeJournal(journal, req)
}

export async function validateJournalRecord(req: Request, tenantId: string, id: string) {
  const journal = await repo.findJournalByIdOrThrow(tenantId, id)
  const report = await validateJournal(tenantId, journal, 'draft')
  await writeAudit(req, tenantId, id, 'VALIDATE', undefined, { valid: report.valid, errorCount: report.errors.length })
  return report
}

export async function submitJournalRecord(req: Request, tenantId: string, id: string): Promise<JournalDetailDto> {
  const before = await repo.findJournalByIdOrThrow(tenantId, id)
  const report = await validateJournal(tenantId, before, 'submit')
  if (!report.valid) {
    throw new JournalValidationBlockedError(
      report.errors[0]?.message ?? 'Journal validation failed',
      report.errors.map((e) => ({ field: e.field ?? 'journal', message: e.message })),
    )
  }
  if (report.approval.required && !report.approval.canSubmit) {
    throw new JournalApprovalBlockedError(report.approval.blockReason ?? 'Journal approval configuration blocks submission')
  }

  const nextStatus = report.approval.required ? 'PENDING_APPROVAL' : 'APPROVED'
  const updated = await repo.submitJournal(
    tenantId,
    id,
    nextStatus,
    report.approval.required,
    report.approval.approvalLevel ?? 0,
    req.context?.userId,
  )
  const journal = await repo.findJournalByIdOrThrow(tenantId, id)
  await writeAudit(req, tenantId, id, 'SUBMIT', serializeJournal(before), {
    status: updated.status,
    approvalRequired: updated.approvalRequired,
    validation: { valid: report.valid, approval: report.approval },
  })
  return serializeJournal(journal, req)
}

export async function cancelJournalRecord(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelJournalInput,
): Promise<JournalDetailDto> {
  const before = await repo.findJournalByIdOrThrow(tenantId, id)
  await repo.cancelJournal(tenantId, id, input.cancellationReason, req.context?.userId)
  const journal = await repo.findJournalByIdOrThrow(tenantId, id)
  await writeAudit(req, tenantId, id, 'CANCEL', serializeJournal(before), serializeJournal(journal))
  return serializeJournal(journal, req)
}

export async function getJournalAudit(_req: Request, tenantId: string, id: string) {
  await repo.findJournalByIdOrThrow(tenantId, id)
  return repo.listJournalAudit(tenantId, id)
}
