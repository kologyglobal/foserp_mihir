import type { Request } from 'express'
import { prisma } from '../../../../config/database.js'
import { auditFromRequest, createAuditLog } from '../../../../services/audit.service.js'
import { validateBranchOwnership } from '../../ledger/ledger.validators.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import { compare } from '../../shared/finance-decimal.js'
import { isMultiCurrencyEnabled } from '../../posting/posting-currency.service.js'
import { previewNextNumber } from '../../finance-number-series/finance-number-series.repository.js'
import { requireActiveCustomerParty } from '../customer-party/customer-party.service.js'
import { calculateCustomerReceipt, type CalculateCustomerReceiptOptions } from './calculation/customer-receipt-calculation.service.js'
import type {
  CustomerReceiptCalculationInput,
  CustomerReceiptCalculationResult,
  ReceiptValidationIssue,
} from './calculation/customer-receipt-calculation.types.js'
import { validateReceiptInput } from './calculation/customer-receipt-validation-preview.service.js'
import { validateReceiptPaymentMethod } from './validation/receipt-payment-method.validator.js'
import { checkReceiptAccountReadiness } from './validation/receipt-account-readiness.service.js'
import * as repo from './customer-receipt.repository.js'
import type { ResolvedReceiptAccounts } from './customer-receipt.repository.js'
import {
  CustomerReceiptDraftCalculationFailedError,
  CustomerReceiptSourceNotSupportedError,
  CustomerReceiptValidationFailedError,
} from './customer-receipt.errors.js'
import type {
  CancelCustomerReceiptInput,
  CreateCustomerReceiptInput,
  UpdateCustomerReceiptInput,
  ValidateCustomerReceiptInput,
} from './customer-receipt.schemas.js'
import {
  buildCalculationInputFromRequest,
  buildCalculationInputFromStoredReceipt,
  parseCalculationContext,
} from './customer-receipt-validation.service.js'
import { serializeCustomerReceiptDetail } from './customer-receipt-read.service.js'
import type { CustomerReceiptWithDeductions } from './customer-receipt.types.js'

/** Structural error codes that reflect *missing posting accounts* — deferred to mark-ready, not blocking on draft save. */
const DEFERRED_ACCOUNT_CODES = new Set([
  'OTHER_DEDUCTION_ACCOUNT_MISSING',
  'BANK_CHARGE_ACCOUNT_MISSING',
  'CUSTOMER_TDS_ACCOUNT_MISSING',
  'RECEIPT_BANK_CASH_ACCOUNT_MISSING',
])

function filterDeferredIssues(issues: ReceiptValidationIssue[]): ReceiptValidationIssue[] {
  return issues.filter((i) => !DEFERRED_ACCOUNT_CODES.has(i.code))
}

function auditMeta(req: Request) {
  return auditFromRequest(req)
}

async function writeAudit(
  req: Request,
  tenantId: string,
  receiptId: string,
  action: string,
  oldValues?: unknown,
  newValues?: unknown,
): Promise<void> {
  const audit = auditMeta(req)
  await createAuditLog({
    tenantId,
    userId: audit.userId,
    module: 'finance',
    entity: 'customer_receipt',
    entityId: receiptId,
    action,
    oldValues,
    newValues,
    ipAddress: audit.ipAddress,
    userAgent: audit.userAgent,
  })
}

async function assertBranch(tenantId: string, legalEntityId: string, branchId?: string | null): Promise<void> {
  const branchCheck = await validateBranchOwnership(tenantId, legalEntityId, branchId)
  if (!branchCheck.valid) {
    throw new CustomerReceiptValidationFailedError(
      branchCheck.errors[0]?.message ?? 'Invalid branch',
      branchCheck.errors.map((e) => ({ field: e.field ?? 'branchId', message: e.message })),
    )
  }
}

function assertSourceTypeSupported(sourceType: string): void {
  if (sourceType === 'BANK_IMPORT') throw new CustomerReceiptSourceNotSupportedError()
}

function assertPaymentMethodReady(
  input: Pick<
    CustomerReceiptCalculationInput,
    'paymentMethod' | 'instrumentNumber' | 'instrumentDate' | 'bankReference' | 'transactionReference' | 'narration'
  >,
): void {
  const readiness = validateReceiptPaymentMethod(input)
  const blocking = readiness.issues.filter((i) => i.severity === 'ERROR')
  if (blocking.length > 0) {
    throw new CustomerReceiptDraftCalculationFailedError(
      blocking[0]?.message ?? 'Payment method validation failed',
      blocking.map((e) => ({ field: e.field ?? 'paymentMethod', message: e.message })),
    )
  }
}

function throwOnCalcFailure(calc: CustomerReceiptCalculationResult): void {
  const blocking = filterDeferredIssues(calc.errors)
  if (blocking.length > 0) {
    throw new CustomerReceiptDraftCalculationFailedError(
      blocking[0]?.message ?? 'Receipt calculation failed',
      blocking.map((e) => ({ field: e.field ?? 'receipt', message: e.message })),
    )
  }
}

async function resolveCalcOptions(
  tenantId: string,
  legalEntityId: string,
  customerNameSnapshot: string | null,
): Promise<CalculateCustomerReceiptOptions> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const baseCurrencyCode = settings?.baseCurrency ?? 'INR'
  const multiCurrencyEnabled = await isMultiCurrencyEnabled(tenantId, legalEntityId)
  return { baseCurrencyCode, multiCurrencyEnabled, customerNameSnapshot }
}

async function resolveAccountsForDraft(
  tenantId: string,
  legalEntityId: string,
  calcInput: CustomerReceiptCalculationInput,
  calc: CustomerReceiptCalculationResult,
): Promise<ResolvedReceiptAccounts> {
  const readiness = await checkReceiptAccountReadiness(tenantId, legalEntityId, calcInput, calc)
  const allIssues = [
    ...readiness.bankCash.issues,
    ...readiness.customerReceivable.issues,
    ...readiness.customerTds.issues,
    ...readiness.bankCharges.flatMap((b) => b.issues),
    ...readiness.otherDeductions.flatMap((b) => b.issues),
  ].filter((i) => i.severity === 'ERROR')
  const blocking = filterDeferredIssues(allIssues)
  if (blocking.length > 0) {
    throw new CustomerReceiptDraftCalculationFailedError(
      blocking[0]?.message ?? 'Account validation failed',
      blocking.map((e) => ({ field: e.field ?? 'accounts', message: e.message })),
    )
  }
  return readiness.resolved
}

export async function createCustomerReceiptDraft(req: Request, tenantId: string, input: CreateCustomerReceiptInput) {
  assertSourceTypeSupported(input.sourceType)
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  await assertBranch(tenantId, input.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.customerId)
  assertPaymentMethodReady(input)

  const calcInput = buildCalculationInputFromRequest(input, tenantId)
  const calcOptions = await resolveCalcOptions(tenantId, input.legalEntityId, party.name)
  const calc = calculateCustomerReceipt(calcInput, calcOptions)
  throwOnCalcFailure(calc)

  const resolvedAccounts = await resolveAccountsForDraft(tenantId, input.legalEntityId, calcInput, calc)

  const userId = req.context?.userId
  const receipt = await repo.createCustomerReceiptDraft(tenantId, input, calc, party, userId, resolvedAccounts)

  await writeAudit(req, tenantId, receipt.id, 'CUSTOMER_RECEIPT_DRAFT_CREATED', undefined, {
    draftReference: receipt.draftReference,
    status: receipt.status,
  })

  return serializeCustomerReceiptDetail(req, receipt)
}

export async function updateCustomerReceiptDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: UpdateCustomerReceiptInput,
) {
  assertSourceTypeSupported(input.sourceType)
  const existing = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, id)

  await getLegalEntityOrThrow(tenantId, existing.legalEntityId)
  await assertBranch(tenantId, existing.legalEntityId, input.branchId)
  const party = await requireActiveCustomerParty(tenantId, input.customerId)
  assertPaymentMethodReady(input)

  const calcInput = buildCalculationInputFromRequest(
    { ...input, legalEntityId: existing.legalEntityId },
    tenantId,
  )
  const calcOptions = await resolveCalcOptions(tenantId, existing.legalEntityId, party.name)
  const calc = calculateCustomerReceipt(calcInput, calcOptions)
  throwOnCalcFailure(calc)

  const resolvedAccounts = await resolveAccountsForDraft(tenantId, existing.legalEntityId, calcInput, calc)

  const reopenFromReady = existing.status === 'READY_TO_POST'
  const beforeStatus = existing.status
  const userId = req.context?.userId
  const receipt = await repo.replaceEditableReceiptDeductions(tenantId, id, input, calc, party, userId, resolvedAccounts, {
    reopenFromReady,
  })

  await writeAudit(req, tenantId, id, 'CUSTOMER_RECEIPT_DRAFT_UPDATED', { status: beforeStatus }, {
    status: receipt.status,
    draftReference: receipt.draftReference,
  })
  if (reopenFromReady) {
    await writeAudit(req, tenantId, id, 'CUSTOMER_RECEIPT_READY_REOPENED_BY_EDIT', { status: 'READY_TO_POST' }, {
      status: 'DRAFT',
    })
  }

  return serializeCustomerReceiptDetail(req, receipt)
}

export async function validateCustomerReceiptRecord(
  req: Request,
  tenantId: string,
  id: string,
  input?: ValidateCustomerReceiptInput,
) {
  const receipt = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, id)
  const calcInput = buildCalculationInputFromStoredReceipt(receipt, tenantId)
  if (!calcInput) throw new CustomerReceiptValidationFailedError('Receipt calculation context is missing')
  if (input?.proposedAllocations) calcInput.proposedAllocations = input.proposedAllocations

  const preview = await validateReceiptInput(calcInput, {
    tenantId,
    customerNameSnapshot: receipt.customerNameSnapshot,
  })

  await writeAudit(req, tenantId, id, 'CUSTOMER_RECEIPT_VALIDATED', undefined, {
    valid: preview.valid,
    errorCount: preview.errors.length,
    warningCount: preview.warnings.length,
  })

  return preview
}

function amountsDrift(
  receipt: CustomerReceiptWithDeductions,
  calc: CustomerReceiptCalculationResult,
): boolean {
  return (
    compare(receipt.grossReceiptAmount, calc.grossReceiptAmount) !== 0 ||
    compare(receipt.allocatableAmount, calc.allocatableAmount) !== 0 ||
    compare(receipt.customerTdsAmount, calc.customerTdsAmount) !== 0 ||
    compare(receipt.bankChargeAmount, calc.bankChargeAmount) !== 0 ||
    compare(receipt.otherDeductionAmount, calc.otherDeductionAmount) !== 0
  )
}

export async function markCustomerReceiptReady(req: Request, tenantId: string, id: string) {
  const existing = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') {
    throw new CustomerReceiptValidationFailedError('Only draft receipts can be marked ready to post')
  }

  const calcInput = buildCalculationInputFromStoredReceipt(existing, tenantId)
  if (!calcInput) throw new CustomerReceiptValidationFailedError('Receipt calculation context is missing')

  const preview = await validateReceiptInput(calcInput, {
    tenantId,
    customerNameSnapshot: existing.customerNameSnapshot,
  })
  if (!preview.valid || !preview.calculation) {
    throw new CustomerReceiptValidationFailedError(
      preview.errors[0]?.message ?? 'Receipt validation failed',
      preview.errors.map((e) => ({ field: e.field ?? 'receipt', message: e.message })),
    )
  }

  try {
    await previewNextNumber(tenantId, existing.legalEntityId, 'CUSTOMER_RECEIPT')
  } catch {
    throw new CustomerReceiptValidationFailedError('Customer receipt number series is not configured', [
      { field: 'receiptNumber', message: 'Configure CUSTOMER_RECEIPT number series before marking ready' },
    ])
  }

  const calc = preview.calculation
  let receipt = existing
  const context = parseCalculationContext(existing.calculationContext)
  if (context && amountsDrift(existing, calc)) {
    receipt = await repo.persistRecalculatedAmounts(tenantId, id, calc, context, req.context?.userId)
  }

  receipt = await repo.markCustomerReceiptReady(tenantId, id, req.context?.userId)
  await writeAudit(req, tenantId, id, 'CUSTOMER_RECEIPT_READY', { status: 'DRAFT' }, { status: 'READY_TO_POST' })

  return serializeCustomerReceiptDetail(req, receipt)
}

export async function cancelCustomerReceiptDraft(
  req: Request,
  tenantId: string,
  id: string,
  input: CancelCustomerReceiptInput,
) {
  const before = await repo.findCustomerReceiptWithDeductionsOrThrow(tenantId, id)
  const receipt = await repo.cancelCustomerReceiptDraft(tenantId, id, input.cancellationReason, req.context?.userId)
  await writeAudit(req, tenantId, id, 'CUSTOMER_RECEIPT_DRAFT_CANCELLED', { status: before.status }, {
    status: receipt.status,
    cancellationReason: input.cancellationReason,
  })
  return serializeCustomerReceiptDetail(req, receipt)
}
