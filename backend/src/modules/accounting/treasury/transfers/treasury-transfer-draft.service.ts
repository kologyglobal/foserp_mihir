import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { compare, formatForPersistence } from '../../shared/finance-decimal.js'
import { calculateTreasuryTransfer, type TreasuryTransferCalculationInput } from './treasury-transfer-calculation.service.js'
import { loadTreasuryAccountSnapshot } from './treasury-transfer-account-resolver.service.js'
import * as repo from './treasury-transfer.repository.js'
import { auditTreasuryTransfer } from './treasury-transfer-audit.js'
import { TreasuryTransferEditNotAllowedError, TreasuryTransferValidationFailedError } from './treasury-transfer.errors.js'
import type { CreateTreasuryTransferInput, UpdateTreasuryTransferInput } from './treasury-transfer.schemas.js'
import type { TreasuryTransferDraftHeaderInput, TreasuryTransferRow } from './treasury-transfer.types.js'
import { serializeTreasuryTransfer } from './treasury-transfer-read.service.js'

type DraftBody = Omit<CreateTreasuryTransferInput, 'legalEntityId'>

async function resolveApprovalRequired(
  tenantId: string,
  legalEntityId: string,
  baseTransferAmount: string,
  override?: boolean,
): Promise<boolean> {
  if (override != null) return override
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const limit = settings?.treasuryTransferApprovalLimit ?? settings?.journalApprovalLimit ?? null
  if (limit == null) return false
  return compare(baseTransferAmount, formatForPersistence(limit)) > 0
}

async function buildHeaderInput(
  tenantId: string,
  legalEntityId: string,
  body: DraftBody,
  draftReference: string,
  approvalRequired: boolean,
  userId?: string | null,
): Promise<TreasuryTransferDraftHeaderInput> {
  return {
    tenantId,
    legalEntityId,
    sourceBranchId: body.sourceBranchId ?? null,
    destinationBranchId: body.destinationBranchId ?? null,
    sourceTreasuryAccountId: body.sourceTreasuryAccountId,
    destinationTreasuryAccountId: body.destinationTreasuryAccountId,
    transferPurpose: body.transferPurpose,
    transferDate: parseDateOnly(body.transferDate),
    sourcePostingDate: parseDateOnly(body.sourcePostingDate),
    expectedReceiptDate: body.expectedReceiptDate ? parseDateOnly(body.expectedReceiptDate) : null,
    destinationPostingDate: body.destinationPostingDate ? parseDateOnly(body.destinationPostingDate) : null,
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    transferAmount: body.transferAmount,
    externalReference: body.externalReference ?? null,
    narration: body.narration ?? null,
    internalNote: body.internalNote ?? null,
    draftReference,
    approvalRequired,
    userId: userId ?? null,
  }
}

export async function createTreasuryTransferDraft(req: Request, tenantId: string, input: CreateTreasuryTransferInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const branchChecks = await Promise.all([
    validateBranchOwnership(tenantId, input.legalEntityId, input.sourceBranchId),
    validateBranchOwnership(tenantId, input.legalEntityId, input.destinationBranchId),
  ])
  const branchErrors = branchChecks.flatMap((c) => c.errors)
  if (branchErrors.length > 0) {
    throw new TreasuryTransferValidationFailedError(
      branchErrors[0]?.message ?? 'Invalid branch',
      branchErrors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }

  const [source, destination] = await Promise.all([
    loadTreasuryAccountSnapshot(tenantId, input.sourceTreasuryAccountId),
    loadTreasuryAccountSnapshot(tenantId, input.destinationTreasuryAccountId),
  ])

  const calcInput: TreasuryTransferCalculationInput = {
    tenantId,
    legalEntityId: input.legalEntityId,
    sourceBranchId: input.sourceBranchId ?? source.branchId,
    destinationBranchId: input.destinationBranchId ?? destination.branchId,
    source,
    destination,
    currencyCode: input.currencyCode,
    exchangeRate: String(input.exchangeRate),
    transferAmount: String(input.transferAmount),
    transferDate: input.transferDate,
    sourcePostingDate: input.sourcePostingDate,
    expectedReceiptDate: input.expectedReceiptDate ?? null,
    destinationPostingDate: input.destinationPostingDate ?? null,
    postingModeOverride: input.postingModeOverride,
  }
  const result = await calculateTreasuryTransfer(calcInput)

  const approvalRequired = await resolveApprovalRequired(
    tenantId,
    input.legalEntityId,
    result.baseTransferAmount,
    input.approvalRequiredOverride,
  )

  const draftReference = await repo.generateUniqueDraftReference(tenantId)
  const header = await buildHeaderInput(tenantId, input.legalEntityId, input, draftReference, approvalRequired, req.context?.userId)

  const transfer = await repo.createTreasuryTransferDraft(header, source, destination, result)
  await auditTreasuryTransfer(req, tenantId, transfer.id, 'TREASURY_TRANSFER_CREATED', { draftReference: transfer.draftReference })
  return serializeTreasuryTransfer(req, transfer, result)
}

export async function updateTreasuryTransferDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateTreasuryTransferInput,
) {
  const existing = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new TreasuryTransferEditNotAllowedError()

  const branchChecks = await Promise.all([
    validateBranchOwnership(tenantId, existing.legalEntityId, input.sourceBranchId),
    validateBranchOwnership(tenantId, existing.legalEntityId, input.destinationBranchId),
  ])
  const branchErrors = branchChecks.flatMap((c) => c.errors)
  if (branchErrors.length > 0) {
    throw new TreasuryTransferValidationFailedError(
      branchErrors[0]?.message ?? 'Invalid branch',
      branchErrors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }

  const [source, destination] = await Promise.all([
    loadTreasuryAccountSnapshot(tenantId, input.sourceTreasuryAccountId),
    loadTreasuryAccountSnapshot(tenantId, input.destinationTreasuryAccountId),
  ])

  const calcInput: TreasuryTransferCalculationInput = {
    tenantId,
    legalEntityId: existing.legalEntityId,
    sourceBranchId: input.sourceBranchId ?? source.branchId,
    destinationBranchId: input.destinationBranchId ?? destination.branchId,
    source,
    destination,
    currencyCode: input.currencyCode,
    exchangeRate: String(input.exchangeRate),
    transferAmount: String(input.transferAmount),
    transferDate: input.transferDate,
    sourcePostingDate: input.sourcePostingDate,
    expectedReceiptDate: input.expectedReceiptDate ?? null,
    destinationPostingDate: input.destinationPostingDate ?? null,
    postingModeOverride: input.postingModeOverride,
  }
  const result = await calculateTreasuryTransfer(calcInput)

  const approvalRequired = await resolveApprovalRequired(
    tenantId,
    existing.legalEntityId,
    result.baseTransferAmount,
    input.approvalRequiredOverride ?? existing.approvalRequired,
  )

  const header = await buildHeaderInput(
    tenantId,
    existing.legalEntityId,
    input,
    existing.draftReference,
    approvalRequired,
    req.context?.userId,
  )

  const transfer = await repo.replaceTreasuryTransferDraft(tenantId, id, header, source, destination, result, input.expectedUpdatedAt)
  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_UPDATED')
  return serializeTreasuryTransfer(req, transfer, result)
}

/** Re-runs the calculation engine against the persisted row's current column values — used by validate/submit/mark-ready/approve. */
export async function recalculateTreasuryTransfer(
  tenantId: string,
  transfer: TreasuryTransferRow,
): Promise<ReturnType<typeof calculateTreasuryTransfer>> {
  const [source, destination] = await Promise.all([
    loadTreasuryAccountSnapshot(tenantId, transfer.sourceTreasuryAccountId),
    loadTreasuryAccountSnapshot(tenantId, transfer.destinationTreasuryAccountId),
  ])

  const calcInput: TreasuryTransferCalculationInput = {
    tenantId,
    legalEntityId: transfer.legalEntityId,
    sourceBranchId: transfer.sourceBranchId,
    destinationBranchId: transfer.destinationBranchId,
    source,
    destination,
    currencyCode: transfer.currencyCode,
    exchangeRate: transfer.exchangeRate.toString(),
    transferAmount: transfer.transferAmount.toString(),
    transferDate: transfer.transferDate.toISOString().slice(0, 10),
    sourcePostingDate: transfer.sourcePostingDate.toISOString().slice(0, 10),
    expectedReceiptDate: transfer.expectedReceiptDate ? transfer.expectedReceiptDate.toISOString().slice(0, 10) : null,
    destinationPostingDate: transfer.destinationPostingDate ? transfer.destinationPostingDate.toISOString().slice(0, 10) : null,
    postingModeOverride: transfer.postingMode,
  }
  return calculateTreasuryTransfer(calcInput)
}

export async function validateTreasuryTransfer(req: Request, tenantId: string, id: string) {
  const transfer = await repo.findTreasuryTransferByIdOrThrow(tenantId, id)
  const result = await recalculateTreasuryTransfer(tenantId, transfer)

  if (['DRAFT', 'READY_TO_POST', 'REJECTED', 'PENDING_APPROVAL'].includes(transfer.status)) {
    await repo.persistCalculatedFields(tenantId, id, result, req.context?.userId)
  }

  await auditTreasuryTransfer(req, tenantId, id, 'TREASURY_TRANSFER_VALIDATED', {
    isValid: result.validation.isValid,
    errorCount: result.validation.errors.length,
    warningCount: result.validation.warnings.length,
  })

  return {
    valid: result.validation.isValid,
    errors: result.validation.errors,
    warnings: result.validation.warnings,
    balanceCheck: result.balanceCheck,
    accountingPreview: result.accountingPreview,
    calculation: result,
  }
}
