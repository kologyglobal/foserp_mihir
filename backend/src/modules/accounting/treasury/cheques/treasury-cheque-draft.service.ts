import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../../shared/finance.helpers.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { compare, formatForPersistence, multiply, toDecimal } from '../../shared/finance-decimal.js'
import { loadTreasuryAccountSnapshot, resolveTreasuryChequeCounterpart } from './treasury-cheque-account-resolver.service.js'
import { validateTreasuryCheque } from './treasury-cheque-validation.service.js'
import * as repo from './treasury-cheque.repository.js'
import { auditTreasuryCheque } from './treasury-cheque-audit.js'
import { TreasuryChequeDuplicateError, TreasuryChequeEditNotAllowedError, TreasuryChequeValidationFailedError } from './treasury-cheque.errors.js'
import type { CreateTreasuryChequeInput, UpdateTreasuryChequeInput } from './treasury-cheque.schemas.js'
import type {
  TreasuryAccountSnapshot,
  TreasuryChequeCalculationResult,
  TreasuryChequeDraftHeaderInput,
  TreasuryChequeRow,
} from './treasury-cheque.types.js'
import { serializeTreasuryCheque } from './treasury-cheque-read.service.js'

export const TREASURY_CHEQUE_CALCULATION_VERSION = 1

export function isTrackOnlyCheque(params: {
  accountingMode: string
  direction: string
  customerReceiptId?: string | null
  vendorPaymentId?: string | null
}): boolean {
  if (params.accountingMode === 'TRACK_ONLY') return true
  if (params.direction === 'RECEIVED' && params.customerReceiptId) return true
  if (params.direction === 'ISSUED' && params.vendorPaymentId) return true
  return false
}

export interface TreasuryChequeCalculationInput {
  tenantId: string
  legalEntityId: string
  treasuryAccount: TreasuryAccountSnapshot
  direction: 'ISSUED' | 'RECEIVED'
  accountingMode: string
  currencyCode: string
  exchangeRate: string
  amount: string
  chequeDate: string
  isPdc: boolean
  pdcMaturityDate?: string | null
  customerReceiptId?: string | null
  vendorPaymentId?: string | null
  counterpartGlAccountIdOverride?: string | null
}

export async function calculateTreasuryCheque(input: TreasuryChequeCalculationInput): Promise<TreasuryChequeCalculationResult> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId: input.tenantId, legalEntityId: input.legalEntityId } })
  const requireCounterpartAccount = settings?.treasuryChequeRequireCounterpartAccount ?? true

  const isTrackOnly = isTrackOnlyCheque({
    accountingMode: input.accountingMode,
    direction: input.direction,
    customerReceiptId: input.customerReceiptId,
    vendorPaymentId: input.vendorPaymentId,
  })

  const baseAmount = formatForPersistence(multiply(input.amount, input.exchangeRate))

  const counterpart = isTrackOnly
    ? { counterpartGlAccountId: null, counterpartSource: 'UNRESOLVED' as const }
    : await resolveTreasuryChequeCounterpart({
        tenantId: input.tenantId,
        legalEntityId: input.legalEntityId,
        direction: input.direction,
        providedAccountId: input.counterpartGlAccountIdOverride,
      })

  const validation = validateTreasuryCheque({
    treasuryAccount: input.treasuryAccount,
    currencyCode: input.currencyCode,
    amount: input.amount,
    isPdc: input.isPdc,
    pdcMaturityDate: input.pdcMaturityDate,
    chequeDate: input.chequeDate,
    isTrackOnly,
    counterpart,
    requireCounterpartAccount,
  })

  const canBuildPreview = validation.isValid && !isTrackOnly && counterpart.counterpartGlAccountId
  const accountingPreview = canBuildPreview
    ? buildAccountingPreview(input.direction, input.treasuryAccount.glAccountId, counterpart.counterpartGlAccountId!, baseAmount)
    : {
        step: (input.direction === 'ISSUED' ? 'ISSUE' : 'DEPOSIT') as 'ISSUE' | 'DEPOSIT',
        isBalanced: false,
        totalDebit: '0.0000',
        totalCredit: '0.0000',
        lines: [],
      }

  return {
    baseAmount,
    isTrackOnly,
    counterpart,
    validation,
    accountingPreview,
    calculationVersion: TREASURY_CHEQUE_CALCULATION_VERSION,
  }
}

function buildAccountingPreview(
  direction: 'ISSUED' | 'RECEIVED',
  bankGlAccountId: string,
  counterpartGlAccountId: string,
  baseAmount: string,
) {
  if (direction === 'ISSUED') {
    return {
      step: 'ISSUE' as const,
      isBalanced: true,
      totalDebit: baseAmount,
      totalCredit: baseAmount,
      lines: [
        { lineNumber: 1, role: 'COUNTERPART' as const, accountId: counterpartGlAccountId, direction: 'DEBIT' as const, amount: baseAmount, lineNarration: 'Cheque issued — counterpart' },
        { lineNumber: 2, role: 'BANK' as const, accountId: bankGlAccountId, direction: 'CREDIT' as const, amount: baseAmount, lineNarration: 'Cheque issued — bank' },
      ],
    }
  }
  return {
    step: 'DEPOSIT' as const,
    isBalanced: true,
    totalDebit: baseAmount,
    totalCredit: baseAmount,
    lines: [
      { lineNumber: 1, role: 'BANK' as const, accountId: bankGlAccountId, direction: 'DEBIT' as const, amount: baseAmount, lineNarration: 'Cheque deposited — bank' },
      { lineNumber: 2, role: 'COUNTERPART' as const, accountId: counterpartGlAccountId, direction: 'CREDIT' as const, amount: baseAmount, lineNarration: 'Cheque deposited — counterpart' },
    ],
  }
}

async function resolveApprovalRequired(
  tenantId: string,
  legalEntityId: string,
  baseAmount: string,
  override?: boolean,
): Promise<boolean> {
  if (override != null) return override
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const limit = settings?.treasuryChequeApprovalLimit ?? null
  if (limit == null) return false
  return compare(baseAmount, formatForPersistence(limit)) > 0
}

type DraftBody = Omit<CreateTreasuryChequeInput, 'legalEntityId'>

async function buildHeaderInput(
  tenantId: string,
  legalEntityId: string,
  body: DraftBody,
  draftReference: string,
  approvalRequired: boolean,
  userId?: string | null,
): Promise<TreasuryChequeDraftHeaderInput> {
  return {
    tenantId,
    legalEntityId,
    branchId: body.branchId ?? null,
    treasuryAccountId: body.treasuryAccountId,
    direction: body.direction,
    accountingMode: body.accountingMode,
    chequeNumber: body.chequeNumber,
    chequeDate: parseDateOnly(body.chequeDate),
    bankName: body.bankName ?? null,
    branchName: body.branchName ?? null,
    ifsc: body.ifsc ?? null,
    payeeOrDrawerName: body.payeeOrDrawerName,
    currencyCode: body.currencyCode,
    exchangeRate: body.exchangeRate,
    amount: body.amount,
    isPdc: body.isPdc,
    pdcMaturityDate: body.pdcMaturityDate ? parseDateOnly(body.pdcMaturityDate) : null,
    counterpartGlAccountId: body.counterpartGlAccountId ?? null,
    customerReceiptId: body.customerReceiptId ?? null,
    vendorPaymentId: body.vendorPaymentId ?? null,
    narration: body.narration ?? null,
    internalNote: body.internalNote ?? null,
    draftReference,
    approvalRequired,
    userId: userId ?? null,
  }
}

async function assertNoActiveDuplicate(uniquenessKey: string, excludeId?: string): Promise<void> {
  const existing = await repo.findActiveChequeByUniquenessKey(uniquenessKey)
  if (existing && existing.id !== excludeId) {
    throw new TreasuryChequeDuplicateError()
  }
}

export async function createTreasuryChequeDraft(req: Request, tenantId: string, input: CreateTreasuryChequeInput) {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)

  const branchCheck = await validateBranchOwnership(tenantId, input.legalEntityId, input.branchId)
  if (branchCheck.errors.length > 0) {
    throw new TreasuryChequeValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }

  const account = await loadTreasuryAccountSnapshot(tenantId, input.treasuryAccountId)

  const calc = await calculateTreasuryCheque({
    tenantId,
    legalEntityId: input.legalEntityId,
    treasuryAccount: account,
    direction: input.direction,
    accountingMode: input.accountingMode,
    currencyCode: input.currencyCode,
    exchangeRate: String(input.exchangeRate),
    amount: String(input.amount),
    chequeDate: input.chequeDate,
    isPdc: input.isPdc,
    pdcMaturityDate: input.pdcMaturityDate,
    customerReceiptId: input.customerReceiptId,
    vendorPaymentId: input.vendorPaymentId,
    counterpartGlAccountIdOverride: input.counterpartGlAccountId,
  })

  const approvalRequired = await resolveApprovalRequired(tenantId, input.legalEntityId, calc.baseAmount, input.approvalRequiredOverride)
  const draftReference = await repo.generateUniqueDraftReference(tenantId)
  const uniquenessKey = repo.buildChequeUniquenessKey(tenantId, input.legalEntityId, input.direction, input.chequeNumber, parseDateOnly(input.chequeDate))
  await assertNoActiveDuplicate(uniquenessKey)

  const header = await buildHeaderInput(tenantId, input.legalEntityId, input, draftReference, approvalRequired, req.context?.userId)
  const cheque = await repo.createTreasuryChequeDraft(header, account, calc, uniquenessKey)
  await auditTreasuryCheque(req, tenantId, cheque.id, 'TREASURY_CHEQUE_CREATED', { draftReference: cheque.draftReference })
  return serializeTreasuryCheque(req, cheque, calc)
}

export async function updateTreasuryChequeDraft(req: Request, tenantId: string, id: string, input: UpdateTreasuryChequeInput) {
  const existing = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new TreasuryChequeEditNotAllowedError()

  const branchCheck = await validateBranchOwnership(tenantId, existing.legalEntityId, input.branchId)
  if (branchCheck.errors.length > 0) {
    throw new TreasuryChequeValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }

  const account = await loadTreasuryAccountSnapshot(tenantId, input.treasuryAccountId)

  const calc = await calculateTreasuryCheque({
    tenantId,
    legalEntityId: existing.legalEntityId,
    treasuryAccount: account,
    direction: input.direction,
    accountingMode: input.accountingMode,
    currencyCode: input.currencyCode,
    exchangeRate: String(input.exchangeRate),
    amount: String(input.amount),
    chequeDate: input.chequeDate,
    isPdc: input.isPdc,
    pdcMaturityDate: input.pdcMaturityDate,
    customerReceiptId: input.customerReceiptId,
    vendorPaymentId: input.vendorPaymentId,
    counterpartGlAccountIdOverride: input.counterpartGlAccountId,
  })

  const approvalRequired = await resolveApprovalRequired(
    tenantId,
    existing.legalEntityId,
    calc.baseAmount,
    input.approvalRequiredOverride ?? existing.approvalRequired,
  )

  const uniquenessKey = repo.buildChequeUniquenessKey(tenantId, existing.legalEntityId, input.direction, input.chequeNumber, parseDateOnly(input.chequeDate))
  await assertNoActiveDuplicate(uniquenessKey, id)

  const header = await buildHeaderInput(tenantId, existing.legalEntityId, input, existing.draftReference, approvalRequired, req.context?.userId)
  const cheque = await repo.replaceTreasuryChequeDraft(tenantId, id, header, account, calc, uniquenessKey, input.expectedUpdatedAt)
  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_UPDATED')
  return serializeTreasuryCheque(req, cheque, calc)
}

/** Re-runs the calculation engine against the persisted row's current column values — used by validate/submit/mark-ready/approve/lifecycle actions. */
export async function recalculateTreasuryCheque(tenantId: string, cheque: TreasuryChequeRow): Promise<TreasuryChequeCalculationResult> {
  const account = await loadTreasuryAccountSnapshot(tenantId, cheque.treasuryAccountId)
  return calculateTreasuryCheque({
    tenantId,
    legalEntityId: cheque.legalEntityId,
    treasuryAccount: account,
    direction: cheque.direction,
    accountingMode: cheque.accountingMode,
    currencyCode: cheque.currencyCode,
    exchangeRate: cheque.exchangeRate.toString(),
    amount: cheque.amount.toString(),
    chequeDate: cheque.chequeDate.toISOString().slice(0, 10),
    isPdc: cheque.isPdc,
    pdcMaturityDate: cheque.pdcMaturityDate ? cheque.pdcMaturityDate.toISOString().slice(0, 10) : null,
    customerReceiptId: cheque.customerReceiptId,
    vendorPaymentId: cheque.vendorPaymentId,
    counterpartGlAccountIdOverride: cheque.counterpartGlAccountId,
  })
}

export async function validateTreasuryChequeById(req: Request, tenantId: string, id: string) {
  const cheque = await repo.findTreasuryChequeByIdOrThrow(tenantId, id)
  const result = await recalculateTreasuryCheque(tenantId, cheque)

  if (['DRAFT', 'READY', 'REJECTED', 'PENDING_APPROVAL'].includes(cheque.status)) {
    await repo.persistCalculatedFields(tenantId, id, result, req.context?.userId)
  }

  await auditTreasuryCheque(req, tenantId, id, 'TREASURY_CHEQUE_VALIDATED', {
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
