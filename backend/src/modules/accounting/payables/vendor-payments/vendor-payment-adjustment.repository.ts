import { Prisma, type VendorPaymentAdjustmentLine } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import {
  VendorPaymentAdjustmentAmountInvalidError,
  VendorPaymentAdjustmentLineConflictError,
  VendorPaymentNotFoundError,
} from './vendor-payment.errors.js'
import type { CreateVendorPaymentAdjustmentLineInput } from './vendor-payment.types.js'

function assertPositiveAmount(value: Prisma.Decimal | number | string, label: string): void {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) {
    throw new VendorPaymentAdjustmentAmountInvalidError(`${label} must be a positive amount`)
  }
}

export async function listVendorPaymentAdjustments(
  tenantId: string,
  legalEntityId: string,
  vendorPaymentId: string,
): Promise<VendorPaymentAdjustmentLine[]> {
  return prisma.vendorPaymentAdjustmentLine.findMany({
    where: { tenantId, legalEntityId, vendorPaymentId },
    orderBy: { lineNumber: 'asc' },
  })
}

/**
 * Replace all adjustment lines for a payment (foundation / future draft update).
 * Does not create GL or change open items. No public delete API for history.
 */
export async function replaceVendorPaymentAdjustmentLines(
  tenantId: string,
  legalEntityId: string,
  vendorPaymentId: string,
  lines: CreateVendorPaymentAdjustmentLineInput[],
): Promise<VendorPaymentAdjustmentLine[]> {
  const payment = await prisma.vendorPayment.findFirst({
    where: { id: vendorPaymentId, tenantId, legalEntityId },
    select: { id: true },
  })
  if (!payment) throw new VendorPaymentNotFoundError()

  const seen = new Set<number>()
  for (const line of lines) {
    if (seen.has(line.lineNumber)) {
      throw new VendorPaymentAdjustmentLineConflictError(
        `Duplicate adjustment line number ${line.lineNumber}`,
      )
    }
    seen.add(line.lineNumber)
    assertPositiveAmount(line.amount, 'amount')
    assertPositiveAmount(line.baseAmount, 'baseAmount')
  }

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.vendorPaymentAdjustmentLine.deleteMany({
        where: { tenantId, legalEntityId, vendorPaymentId },
      })
      if (lines.length === 0) return []
      await tx.vendorPaymentAdjustmentLine.createMany({
        data: lines.map((line) => ({
          tenantId,
          legalEntityId,
          vendorPaymentId,
          lineNumber: line.lineNumber,
          adjustmentType: line.adjustmentType,
          accountingRole: line.accountingRole,
          description: line.description,
          amount: toDecimal(line.amount),
          baseAmount: toDecimal(line.baseAmount),
          calculationBaseAmount:
            line.calculationBaseAmount != null ? toDecimal(line.calculationBaseAmount) : null,
          rate: line.rate != null ? toDecimal(line.rate) : null,
          sectionCode: line.sectionCode ?? null,
          statutoryReference: line.statutoryReference ?? null,
          accountId: line.accountId ?? null,
          costCentreId: line.costCentreId ?? null,
          projectReference: line.projectReference ?? null,
          departmentReference: line.departmentReference ?? null,
          metadata: (line.metadata as Prisma.InputJsonValue | undefined) ?? undefined,
        })),
      })
      return tx.vendorPaymentAdjustmentLine.findMany({
        where: { tenantId, legalEntityId, vendorPaymentId },
        orderBy: { lineNumber: 'asc' },
      })
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new VendorPaymentAdjustmentLineConflictError()
    }
    throw err
  }
}
