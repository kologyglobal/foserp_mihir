import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { compare, formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { loadTreasuryAccountSnapshot } from './treasury-adjustment-account-resolver.service.js'
import { calculateTreasuryAdjustment, computeFromResolvedLines } from './treasury-adjustment-calculation.service.js'
import * as repo from './treasury-adjustment.repository.js'
import { auditTreasuryAdjustment } from './treasury-adjustment-audit.js'
import { TreasuryAdjustmentEditNotAllowedError, TreasuryAdjustmentStatementLineAlreadyLinkedError, TreasuryAdjustmentValidationFailedError } from './treasury-adjustment.errors.js'
import type { CreateTreasuryAdjustmentFromStatementLineInput, CreateTreasuryAdjustmentInput, UpdateTreasuryAdjustmentInput } from './treasury-adjustment.schemas.js'
import type { TreasuryAdjustmentCalculationResult, TreasuryAdjustmentDraftHeaderInput, TreasuryAdjustmentWithLines } from './treasury-adjustment.types.js'
import { serializeTreasuryAdjustment } from './treasury-adjustment-read.service.js'

type DraftBody = Omit<CreateTreasuryAdjustmentFromStatementLineInput, 'idempotencyKey'>

async function resolveApprovalRequired(
  tenantId: string,
  legalEntityId: string,
  bankAmount: string,
  adjustmentType: string,
  override?: boolean,
): Promise<boolean> {
  if (override != null) return override
  if (adjustmentType === 'OTHER_BANK_DEBIT' || adjustmentType === 'OTHER_BANK_CREDIT') return true
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const limit = settings?.treasuryAdjustmentApprovalLimit ?? null
  if (limit == null) return false
  return compare(bankAmount, formatForPersistence(limit)) > 0
}

async function buildHeaderInput(
  tenantId: string,
  legalEntityId: string,
  body: DraftBody & { treasuryAccountId: string },
  draftReference: string,
  approvalRequired: boolean,
  sourceMode: 'MANUAL' | 'BANK_STATEMENT' | 'STANDING_INSTRUCTION',
  extra: { bankStatementLineId?: string | null; standingInstructionExecutionId?: string | null },
  userId?: string | null,
): Promise<TreasuryAdjustmentDraftHeaderInput> {
  return {
    tenantId,
    legalEntityId,
    branchId: body.branchId ?? null,
    treasuryAccountId: body.treasuryAccountId,
    adjustmentType: body.adjustmentType,
    direction: body.direction ?? null,
    sourceMode,
    adjustmentDate: parseDateOnly(body.adjustmentDate),
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    narration: body.narration ?? null,
    internalNote: body.internalNote ?? null,
    bankStatementLineId: extra.bankStatementLineId ?? null,
    standingInstructionExecutionId: extra.standingInstructionExecutionId ?? null,
    draftReference,
    approvalRequired,
    userId: userId ?? null,
    lines: body.lines,
  }
}

export async function createTreasuryAdjustmentDraft(req: Request, tenantId: string, input: CreateTreasuryAdjustmentInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const branchCheck = await validateBranchOwnership(tenantId, input.legalEntityId, input.branchId)
  if (branchCheck.errors.length > 0) {
    throw new TreasuryAdjustmentValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }

  const account = await loadTreasuryAccountSnapshot(tenantId, input.treasuryAccountId)

  const calc = await calculateTreasuryAdjustment({
    tenantId,
    legalEntityId: input.legalEntityId,
    bankGlAccountId: account.glAccountId,
    adjustmentType: input.adjustmentType,
    direction: input.direction,
    narration: input.narration,
    lines: input.lines,
  })
  if (!calc.validation.isValid) {
    throw new TreasuryAdjustmentValidationFailedError(
      calc.validation.errors[0]?.message ?? 'Treasury adjustment failed validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })),
    )
  }

  const approvalRequired = await resolveApprovalRequired(tenantId, input.legalEntityId, calc.bankAmount, input.adjustmentType, input.approvalRequiredOverride)
  const draftReference = await repo.generateUniqueDraftReference(tenantId)

  const header = await buildHeaderInput(tenantId, input.legalEntityId, input, draftReference, approvalRequired, 'MANUAL', {}, req.context?.userId)
  const adjustment = await repo.createTreasuryAdjustmentDraft(header, account.glAccountId, calc, null)
  await auditTreasuryAdjustment(req, tenantId, adjustment.id, 'TREASURY_ADJUSTMENT_CREATED', { draftReference: adjustment.draftReference })
  return serializeTreasuryAdjustment(req, adjustment, calc)
}

/** Statement-led draft creation — enforces the one-adjustment-per-statement-line uniqueness rule. */
export async function createTreasuryAdjustmentDraftFromStatementLine(
  req: Request,
  tenantId: string,
  statementLineId: string,
  treasuryAccountId: string,
  input: DraftBody,
): Promise<{ adjustment: TreasuryAdjustmentWithLines; calc: TreasuryAdjustmentCalculationResult }> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const existingLink = await prisma.treasuryAdjustment.findFirst({ where: { tenantId, bankStatementLineId: statementLineId } })
  if (existingLink) throw new TreasuryAdjustmentStatementLineAlreadyLinkedError()

  const account = await loadTreasuryAccountSnapshot(tenantId, treasuryAccountId)
  const calc = await calculateTreasuryAdjustment({
    tenantId,
    legalEntityId: input.legalEntityId,
    bankGlAccountId: account.glAccountId,
    adjustmentType: input.adjustmentType,
    direction: input.direction,
    narration: input.narration,
    lines: input.lines,
  })
  if (!calc.validation.isValid) {
    throw new TreasuryAdjustmentValidationFailedError(
      calc.validation.errors[0]?.message ?? 'Treasury adjustment failed validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })),
    )
  }

  const approvalRequired = await resolveApprovalRequired(tenantId, input.legalEntityId, calc.bankAmount, input.adjustmentType, input.approvalRequiredOverride)
  const draftReference = await repo.generateUniqueDraftReference(tenantId)
  const uniquenessKey = repo.buildAdjustmentUniquenessKey(tenantId, input.legalEntityId, treasuryAccountId, input.adjustmentType, parseDateOnly(input.adjustmentDate), calc.bankAmount, statementLineId)

  const header = await buildHeaderInput(
    tenantId,
    input.legalEntityId,
    { ...input, treasuryAccountId },
    draftReference,
    approvalRequired,
    'BANK_STATEMENT',
    { bankStatementLineId: statementLineId },
    req.context?.userId,
  )
  const adjustment = await repo.createTreasuryAdjustmentDraft(header, account.glAccountId, calc, uniquenessKey)
  await auditTreasuryAdjustment(req, tenantId, adjustment.id, 'TREASURY_ADJUSTMENT_CREATED_FROM_STATEMENT', { draftReference: adjustment.draftReference, statementLineId })
  return { adjustment, calc }
}

export async function updateTreasuryAdjustmentDraft(req: Request, tenantId: string, id: string, input: UpdateTreasuryAdjustmentInput) {
  const existing = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new TreasuryAdjustmentEditNotAllowedError()

  const branchCheck = await validateBranchOwnership(tenantId, existing.legalEntityId, input.branchId)
  if (branchCheck.errors.length > 0) {
    throw new TreasuryAdjustmentValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }

  const account = await loadTreasuryAccountSnapshot(tenantId, input.treasuryAccountId)
  const calc = await calculateTreasuryAdjustment({
    tenantId,
    legalEntityId: existing.legalEntityId,
    bankGlAccountId: account.glAccountId,
    adjustmentType: input.adjustmentType,
    direction: input.direction,
    narration: input.narration,
    lines: input.lines,
  })
  if (!calc.validation.isValid) {
    throw new TreasuryAdjustmentValidationFailedError(
      calc.validation.errors[0]?.message ?? 'Treasury adjustment failed validation',
      calc.validation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })),
    )
  }

  const approvalRequired = await resolveApprovalRequired(tenantId, existing.legalEntityId, calc.bankAmount, input.adjustmentType, input.approvalRequiredOverride ?? existing.approvalRequired)
  const header = await buildHeaderInput(
    tenantId,
    existing.legalEntityId,
    { ...input, treasuryAccountId: input.treasuryAccountId },
    existing.draftReference,
    approvalRequired,
    existing.sourceMode,
    { bankStatementLineId: existing.bankStatementLineId, standingInstructionExecutionId: existing.standingInstructionExecutionId },
    req.context?.userId,
  )
  const uniquenessKey = existing.uniquenessKey
  const adjustment = await repo.replaceTreasuryAdjustmentDraft(tenantId, id, header, account.glAccountId, calc, uniquenessKey, input.expectedUpdatedAt)
  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_UPDATED')
  return serializeTreasuryAdjustment(req, adjustment, calc)
}

/** Recomputes bank amount / validation / preview from the persisted (already-expanded) lines — never re-derives GST/TDS lines a second time. */
export async function recalculateTreasuryAdjustment(tenantId: string, adjustment: TreasuryAdjustmentWithLines): Promise<TreasuryAdjustmentCalculationResult> {
  const account = await loadTreasuryAccountSnapshot(tenantId, adjustment.treasuryAccountId)
  return computeFromResolvedLines({
    direction: adjustment.direction,
    bankGlAccountId: account.glAccountId,
    adjustmentType: adjustment.adjustmentType,
    narration: adjustment.narration,
    resolvedLines: adjustment.lines.map((line) => ({
      lineNumber: line.lineNumber,
      lineType: line.lineType,
      accountId: line.accountId,
      description: line.description,
      amount: line.amount.toString(),
      gstTreatment: line.gstTreatment,
      gstRate: line.gstRate ? line.gstRate.toString() : null,
      tdsTreatment: line.tdsTreatment,
      tdsRate: line.tdsRate ? line.tdsRate.toString() : null,
      narration: line.narration,
      side: 'DEBIT' as const,
    })),
  })
}

export async function validateTreasuryAdjustmentById(req: Request, tenantId: string, id: string) {
  const adjustment = await repo.findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  const result = await recalculateTreasuryAdjustment(tenantId, adjustment)

  if (['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(adjustment.status)) {
    await repo.persistCalculatedFields(tenantId, id, result, req.context?.userId)
  }

  await auditTreasuryAdjustment(req, tenantId, id, 'TREASURY_ADJUSTMENT_VALIDATED', {
    isValid: result.validation.isValid,
    errorCount: result.validation.errors.length,
    warningCount: result.validation.warnings.length,
  })

  return {
    valid: result.validation.isValid,
    errors: result.validation.errors,
    warnings: result.validation.warnings,
    accountingPreview: result.accountingPreview,
    calculation: result,
  }
}

export { toDecimal }
