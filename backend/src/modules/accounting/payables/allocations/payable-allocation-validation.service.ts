import type { PayableOpenItem, Prisma, VendorAdjustment, VendorPayment } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import {
  convertToBase,
  isPositive,
  isZero,
  roundAmount,
  subtract,
  sumDecimals,
  toDecimal,
} from '../../shared/finance-decimal.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import { resolvePeriodByDate } from '../../posting/posting-period.service.js'
import {
  PayableAllocationConcurrentChangeError,
  PayableAllocationControlAccountMismatchError,
  PayableAllocationCurrencyMismatchError,
  PayableAllocationDateInvalidError,
  PayableAllocationDuplicateTargetError,
  PayableAllocationExceedsSourceError,
  PayableAllocationExceedsTargetError,
  PayableAllocationForexRequiredError,
  PayableAllocationLegalEntityMismatchError,
  PayableAllocationOpenItemInvalidError,
  PayableAllocationPaymentNotPostedError,
  PayableAllocationPeriodClosedError,
  PayableAllocationPeriodUnderReviewError,
  PayableAllocationSourceInvalidError,
  PayableAllocationSourceMissingError,
  PayableAllocationVendorMismatchError,
} from './payable-allocation.errors.js'
import type { AllocateVendorAdjustmentInput, AllocateVendorPaymentInput } from './payable-allocation.types.js'

const ALLOCATABLE_STATUSES = new Set(['OPEN', 'PARTIALLY_SETTLED'])
const SOURCE_DOCUMENT_TYPES = new Set(['VENDOR_PAYMENT', 'VENDOR_ADVANCE', 'VENDOR_DEBIT_NOTE'])
const CREDIT_TARGET_DOCUMENT_TYPES = new Set(['VENDOR_INVOICE', 'VENDOR_CREDIT_ADJUSTMENT'])

export interface ValidatedPayableAllocationLine {
  targetCreditOpenItemId: string
  vendorInvoiceId: string | null
  vendorAdjustmentId: string | null
  invoiceNumber: string
  supplierInvoiceNumber: string | null
  allocationAmount: Prisma.Decimal
  baseAllocationAmount: Prisma.Decimal
  target: PayableOpenItem
  targetOutstandingBefore: Prisma.Decimal
  targetOutstandingAfter: Prisma.Decimal
  baseTargetOutstandingBefore: Prisma.Decimal
  baseTargetOutstandingAfter: Prisma.Decimal
}

export interface PayableAllocationValidationContext {
  payment: VendorPayment
  source: PayableOpenItem
  controlAccountId: string
  allocationDate: string
  allocationDateValue: Date
  currencyCode: string
  exchangeRate: Prisma.Decimal
  lines: ValidatedPayableAllocationLine[]
  totalAllocated: Prisma.Decimal
  baseTotalAllocated: Prisma.Decimal
  sourceOutstandingBefore: Prisma.Decimal
  sourceOutstandingAfter: Prisma.Decimal
  baseSourceOutstandingBefore: Prisma.Decimal
  baseSourceOutstandingAfter: Prisma.Decimal
}

export function resolveOpenItemStatusAfter(
  outstandingAfter: Prisma.Decimal,
): 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED' {
  if (isZero(outstandingAfter)) return 'SETTLED'
  return 'PARTIALLY_SETTLED'
}

async function getRoundingTolerance(tenantId: string, legalEntityId: string): Promise<Prisma.Decimal> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  return toDecimal(settings?.roundingTolerance ?? '0.01')
}

/**
 * Determine whether same-branch is required for payable allocation. FinanceSettings has no
 * dedicated JSON flag today, so default = allow cross-branch within the same legal entity.
 */
async function requiresSameBranch(tenantId: string, legalEntityId: string): Promise<boolean> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  const raw = settings as unknown as Record<string, unknown> | null
  const flag = raw?.requireSameBranchForPayableAllocation
  return flag === true
}

function assertSourceUsable(source: PayableOpenItem): void {
  if (source.side !== 'DEBIT') {
    throw new PayableAllocationSourceInvalidError('Payment source open item must be a DEBIT item')
  }
  if (!SOURCE_DOCUMENT_TYPES.has(source.documentType)) {
    throw new PayableAllocationSourceInvalidError(
      'Debit source must be VENDOR_PAYMENT, VENDOR_ADVANCE, or VENDOR_DEBIT_NOTE',
    )
  }
  if (source.reversedAt) {
    throw new PayableAllocationSourceInvalidError('Payment source open item has been reversed')
  }
  if (source.isDisputed || source.isOnHold || source.status === 'ON_HOLD' || source.status === 'DISPUTED') {
    throw new PayableAllocationSourceInvalidError('Payment source open item is on hold or disputed')
  }
  if (!ALLOCATABLE_STATUSES.has(source.status)) {
    throw new PayableAllocationSourceInvalidError(
      `Payment source open item status ${source.status} does not permit allocation`,
    )
  }
  if (!isPositive(toDecimal(source.outstandingAmount))) {
    throw new PayableAllocationSourceInvalidError('Payment source open item has no outstanding balance')
  }
}

/** Resolve the DEBIT source open item from the payment — never trusts a client-supplied source id. */
export async function resolvePaymentSourceOpenItem(
  tenantId: string,
  payment: VendorPayment,
): Promise<PayableOpenItem> {
  let source: PayableOpenItem | null = null
  if (payment.payableOpenItemId) {
    source = await prisma.payableOpenItem.findFirst({
      where: { id: payment.payableOpenItemId, tenantId, legalEntityId: payment.legalEntityId },
    })
  }
  if (!source) {
    source = await prisma.payableOpenItem.findFirst({
      where: { tenantId, legalEntityId: payment.legalEntityId, sourceVendorPaymentId: payment.id },
    })
  }
  if (!source) throw new PayableAllocationSourceMissingError()
  return source
}

function matchTimestamp(actual: Date, expected: string | undefined): boolean {
  if (!expected) return true
  const expectedTime = new Date(expected).getTime()
  if (Number.isNaN(expectedTime)) return false
  return actual.getTime() === expectedTime
}

/** Resolve the DEBIT source open item from a posted debit note — never trusts client source id. */
export async function resolveAdjustmentSourceOpenItem(
  tenantId: string,
  adjustment: VendorAdjustment,
): Promise<PayableOpenItem> {
  let source: PayableOpenItem | null = null
  if (adjustment.payableOpenItemId) {
    source = await prisma.payableOpenItem.findFirst({
      where: { id: adjustment.payableOpenItemId, tenantId, legalEntityId: adjustment.legalEntityId },
    })
  }
  if (!source) {
    source = await prisma.payableOpenItem.findFirst({
      where: { tenantId, legalEntityId: adjustment.legalEntityId, sourceVendorAdjustmentId: adjustment.id },
    })
  }
  if (!source) throw new PayableAllocationSourceMissingError('Posted vendor debit note is missing a DEBIT payable open item')
  return source
}

async function validatePayableAllocationCore(
  tenantId: string,
  legalEntityId: string,
  source: PayableOpenItem,
  input: { allocationDate: string; lines: AllocateVendorPaymentInput['lines']; expectedSourceOpenItemUpdatedAt: string },
): Promise<Omit<PayableAllocationValidationContext, 'payment'>> {
  assertSourceUsable(source)

  if (!matchTimestamp(source.updatedAt, input.expectedSourceOpenItemUpdatedAt)) {
    throw new PayableAllocationConcurrentChangeError('Debit source open item changed since it was loaded')
  }
  const controlAccountId = source.vendorPayableAccountId
  const currencyCode = source.currencyCode
  const exchangeRate = toDecimal(source.exchangeRate)
  const tolerance = await getRoundingTolerance(tenantId, legalEntityId)
  const sameBranchRequired = await requiresSameBranch(tenantId, legalEntityId)

  // Duplicate target guard
  const seenTargets = new Set<string>()
  for (const line of input.lines) {
    if (seenTargets.has(line.targetCreditOpenItemId)) throw new PayableAllocationDuplicateTargetError()
    seenTargets.add(line.targetCreditOpenItemId)
    if (!isPositive(toDecimal(line.amount))) {
      throw new PayableAllocationOpenItemInvalidError('Allocation amount must be greater than zero', [
        { field: 'amount', message: 'Must be greater than zero' },
      ])
    }
  }

  // Period gate on allocation date
  const resolved = await resolvePeriodByDate(tenantId, legalEntityId, input.allocationDate)
  if (resolved.period.status === 'CLOSED') throw new PayableAllocationPeriodClosedError()
  if (resolved.period.status === 'UNDER_REVIEW') throw new PayableAllocationPeriodUnderReviewError()

  const allocationDateValue = parseDateOnly(input.allocationDate)
  // Allocation date must be >= source posting date
  if (allocationDateValue < startOfDay(source.postingDate)) {
    throw new PayableAllocationDateInvalidError()
  }

  const lines: ValidatedPayableAllocationLine[] = []
  for (const line of input.lines) {
    const target = await prisma.payableOpenItem.findFirst({
      where: { id: line.targetCreditOpenItemId, tenantId, legalEntityId },
      include: {
        sourceVendorInvoice: { select: { id: true, vendorInvoiceNumber: true, supplierInvoiceNumber: true } },
        sourceVendorAdjustment: { select: { id: true, vendorAdjustmentNumber: true, supplierReferenceNumber: true } },
      },
    })
    if (!target) {
      throw new PayableAllocationOpenItemInvalidError('Target credit open item not found', [
        { field: 'targetCreditOpenItemId', message: 'Not found' },
      ])
    }
    if (target.legalEntityId !== legalEntityId) throw new PayableAllocationLegalEntityMismatchError()
    if (target.side !== 'CREDIT' || !CREDIT_TARGET_DOCUMENT_TYPES.has(target.documentType)) {
      throw new PayableAllocationOpenItemInvalidError('Target must be a CREDIT VENDOR_INVOICE or VENDOR_CREDIT_ADJUSTMENT open item')
    }
    if (target.reversedAt) {
      throw new PayableAllocationOpenItemInvalidError('Target invoice open item has been reversed')
    }
    if (target.vendorId !== source.vendorId) throw new PayableAllocationVendorMismatchError()
    if (target.currencyCode !== currencyCode) throw new PayableAllocationCurrencyMismatchError()
    if (target.vendorPayableAccountId !== controlAccountId) {
      throw new PayableAllocationControlAccountMismatchError()
    }
    if (
      target.isDisputed ||
      target.isOnHold ||
      target.status === 'ON_HOLD' ||
      target.status === 'DISPUTED' ||
      !ALLOCATABLE_STATUSES.has(target.status)
    ) {
      throw new PayableAllocationOpenItemInvalidError(
        `Invoice open item status ${target.status} does not permit allocation`,
      )
    }
    if (sameBranchRequired && target.branchId !== source.branchId) {
      throw new PayableAllocationOpenItemInvalidError('Invoice must belong to the same branch as the payment')
    }
    if (!matchTimestamp(target.updatedAt, line.expectedTargetUpdatedAt)) {
      throw new PayableAllocationConcurrentChangeError('Invoice open item changed since it was loaded')
    }

    // FX: effective-rate match within tolerance
    const targetRate = toDecimal(target.exchangeRate)
    if (targetRate.sub(exchangeRate).abs().gt(tolerance)) {
      throw new PayableAllocationForexRequiredError()
    }

    if (allocationDateValue < startOfDay(target.postingDate)) {
      throw new PayableAllocationDateInvalidError()
    }

    const allocationAmount = roundAmount(toDecimal(line.amount), 4)
    const outstanding = roundAmount(toDecimal(target.outstandingAmount), 4)
    if (!isPositive(outstanding)) {
      throw new PayableAllocationOpenItemInvalidError('Invoice outstanding must be positive')
    }
    if (allocationAmount.gt(outstanding)) throw new PayableAllocationExceedsTargetError()

    const baseBefore = roundAmount(toDecimal(target.baseOutstandingAmount), 4)
    // Base amount server-side: base currency → base = amount; foreign same-rate → amount × rate
    const baseAlloc = roundAmount(convertToBase(allocationAmount, exchangeRate), 4)
    const outstandingAfter = roundAmount(subtract(outstanding, allocationAmount), 4)
    const baseAfter = roundAmount(subtract(baseBefore, baseAlloc), 4)

    lines.push({
      targetCreditOpenItemId: target.id,
      vendorInvoiceId: target.sourceVendorInvoiceId,
      vendorAdjustmentId: target.sourceVendorAdjustmentId,
      invoiceNumber: target.documentNumber,
      supplierInvoiceNumber: target.sourceVendorInvoice?.supplierInvoiceNumber ?? null,
      allocationAmount,
      baseAllocationAmount: baseAlloc,
      target,
      targetOutstandingBefore: outstanding,
      targetOutstandingAfter: outstandingAfter,
      baseTargetOutstandingBefore: baseBefore,
      baseTargetOutstandingAfter: baseAfter,
    })
  }

  const totalAllocated = roundAmount(sumDecimals(lines.map((l) => l.allocationAmount.toString())), 4)
  const baseTotalAllocated = roundAmount(sumDecimals(lines.map((l) => l.baseAllocationAmount.toString())), 4)
  const sourceOutstandingBefore = roundAmount(toDecimal(source.outstandingAmount), 4)
  const baseSourceOutstandingBefore = roundAmount(toDecimal(source.baseOutstandingAmount), 4)

  if (totalAllocated.gt(sourceOutstandingBefore)) throw new PayableAllocationExceedsSourceError()

  const sourceOutstandingAfter = roundAmount(subtract(sourceOutstandingBefore, totalAllocated), 4)
  const baseSourceOutstandingAfter = roundAmount(subtract(baseSourceOutstandingBefore, baseTotalAllocated), 4)

  return {
    source,
    controlAccountId,
    allocationDate: input.allocationDate,
    allocationDateValue,
    currencyCode,
    exchangeRate,
    lines,
    totalAllocated,
    baseTotalAllocated,
    sourceOutstandingBefore,
    sourceOutstandingAfter,
    baseSourceOutstandingBefore,
    baseSourceOutstandingAfter,
  }
}

export async function validatePayableAllocationRequest(
  tenantId: string,
  payment: VendorPayment,
  source: PayableOpenItem,
  input: AllocateVendorPaymentInput,
): Promise<PayableAllocationValidationContext> {
  if (payment.status !== 'POSTED') throw new PayableAllocationPaymentNotPostedError()

  if (!matchTimestamp(payment.updatedAt, input.expectedPaymentUpdatedAt)) {
    throw new PayableAllocationConcurrentChangeError('Vendor payment changed since it was loaded')
  }

  const core = await validatePayableAllocationCore(tenantId, payment.legalEntityId, source, input)
  return { payment, ...core }
}

export async function validatePayableAllocationForAdjustment(
  tenantId: string,
  adjustment: VendorAdjustment,
  source: PayableOpenItem,
  input: AllocateVendorAdjustmentInput,
): Promise<PayableAllocationValidationContext> {
  if (adjustment.status !== 'POSTED') throw new PayableAllocationPaymentNotPostedError('Only POSTED vendor adjustments can be allocated')
  if (adjustment.adjustmentType !== 'VENDOR_DEBIT_NOTE') {
    throw new PayableAllocationSourceInvalidError('Only posted vendor debit notes can be allocated against payables')
  }
  if (source.documentType !== 'VENDOR_DEBIT_NOTE') {
    throw new PayableAllocationSourceInvalidError('Debit note source open item must be VENDOR_DEBIT_NOTE')
  }

  if (!matchTimestamp(adjustment.updatedAt, input.expectedAdjustmentUpdatedAt)) {
    throw new PayableAllocationConcurrentChangeError('Vendor adjustment changed since it was loaded')
  }

  const core = await validatePayableAllocationCore(tenantId, adjustment.legalEntityId, source, input)
  return { payment: adjustment as unknown as VendorPayment, ...core }
}

function startOfDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()))
}
