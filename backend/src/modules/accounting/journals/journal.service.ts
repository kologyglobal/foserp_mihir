import type { Request } from 'express'
import { auditFromRequest, createAuditLog } from '../../../services/audit.service.js'
import { JournalApprovalBlockedError, JournalValidationBlockedError } from './journal.errors.js'
import * as repo from './journal.repository.js'
import { validateJournal } from './journal-validation.service.js'
import {
  createJournalApprovalRequestOnSubmit,
  submitJournalWithoutApproval,
} from '../approvals/approval-request.service.js'
import { resolveJournalWorkflowActions } from '../approvals/approval.allowed-actions.js'
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

async function buildAllowedActions(req: Request, journal: JournalWithLines): Promise<JournalAllowedActions> {
  const editable = EDITABLE_VOUCHER_STATUSES.includes(journal.status as never)
  const submittable = SUBMITTABLE_JOURNAL_STATUSES.includes(journal.status)
  const cancellable = CANCELLABLE_JOURNAL_STATUSES.includes(journal.status)
  const canView = hasPerm(req, 'finance.voucher.view')
  const workflow = await resolveJournalWorkflowActions(req, journal)

  return {
    edit: editable && hasPerm(req, 'finance.voucher.edit'),
    validate: canView,
    submit: submittable && hasPerm(req, 'finance.voucher.submit'),
    cancel: cancellable && hasPerm(req, 'finance.voucher.cancel'),
    approve: workflow.approve,
    reject: workflow.reject,
    sendBack: workflow.sendBack,
    post: false,
    reverse: false,
  }
}

async function serializeJournal(journal: JournalWithLines, req?: Request): Promise<JournalDetailDto> {
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
    allowedActions: req
      ? await buildAllowedActions(req, journal)
      : {
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

async function serializeListItem(journal: JournalWithLines, req?: Request): Promise<JournalListItemDto> {
  const detail = await serializeJournal(journal, req)
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

export async function listJournals(req: Request, tenantId: string, query: ListJournalsQuery) {
  const result = await repo.findJournals(tenantId, query)
  const items = await Promise.all(result.items.map((item) => serializeListItem(item, req)))
  return {
    ...result,
    items,
  }
}

export async function getJournal(req: Request, tenantId: string, id: string): Promise<JournalDetailDto> {
  const journal = await repo.findJournalByIdOrThrow(tenantId, id)
  return serializeJournal(journal, req)
}

export async function createJournal(req: Request, tenantId: string, input: CreateJournalInput): Promise<JournalDetailDto> {
  const userId = req.context?.userId ?? ''
  const journal = await repo.createDraftJournal(tenantId, input, userId)
  await writeAudit(req, tenantId, journal.id, 'CREATE_DRAFT', undefined, await serializeJournal(journal))
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
  await writeAudit(req, tenantId, id, 'UPDATE_DRAFT', await serializeJournal(before), await serializeJournal(journal))
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

  const userId = req.context?.userId ?? ''
  let approvalRequestMeta: { requestId: string; cycleNumber: number } | null = null
  if (report.approval.required) {
    approvalRequestMeta = await createJournalApprovalRequestOnSubmit(tenantId, before, report.approval, userId)
  } else {
    await submitJournalWithoutApproval(tenantId, id, userId)
  }

  const journal = await repo.findJournalByIdOrThrow(tenantId, id)
  const submitAction = approvalRequestMeta && approvalRequestMeta.cycleNumber > 1 ? 'RESUBMIT' : 'SUBMIT'
  await writeAudit(req, tenantId, id, submitAction, await serializeJournal(before), {
    status: journal.status,
    approvalRequired: journal.approvalRequired,
    validation: { valid: report.valid, approval: report.approval },
    approvalRequestId: approvalRequestMeta?.requestId,
    cycleNumber: approvalRequestMeta?.cycleNumber,
  })
  if (approvalRequestMeta) {
    const audit = auditMeta(req)
    await createAuditLog({
      tenantId,
      userId: audit.userId,
      module: 'finance',
      entity: 'finance_approval_request',
      entityId: approvalRequestMeta.requestId,
      action: 'APPROVAL_REQUEST_CREATED',
      newValues: {
        journalId: id,
        cycleNumber: approvalRequestMeta.cycleNumber,
        totalLevels: report.approval.totalLevels,
      },
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
    })
  }
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
  await writeAudit(req, tenantId, id, 'CANCEL', await serializeJournal(before), await serializeJournal(journal))
  return serializeJournal(journal, req)
}

export async function getJournalAudit(_req: Request, tenantId: string, id: string) {
  await repo.findJournalByIdOrThrow(tenantId, id)
  return repo.listJournalAudit(tenantId, id)
}
