import type { AccountingVoucherLine, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { InvalidStateError, ValidationError } from '../../../utils/errors.js'
import { toDecimal } from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import type { DraftVoucherLineInput } from './ledger.types.js'
import * as voucherRepo from './accounting-voucher.repository.js'
import {
  computeLineTotals,
  validateVoucherEditability,
  validateVoucherLinesWithMasters,
} from './ledger.validators.js'

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

export async function createManyForDraft(
  tenantId: string,
  voucherId: string,
  lines: DraftVoucherLineInput[],
): Promise<AccountingVoucherLine[]> {
  const voucher = await voucherRepo.findByIdOrThrow(tenantId, voucherId)
  const editCheck = validateVoucherEditability(voucher.status as never, 'updateDraft')
  if (!editCheck.valid) throw new InvalidStateError(editCheck.errors[0]?.message ?? 'Voucher not editable')

  const validation = await validateVoucherLinesWithMasters(tenantId, voucher.legalEntityId, lines)
  if (!validation.valid) throw new ValidationError(validation.errors[0]?.message ?? 'Invalid voucher lines', validation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })))

  const data = lines.map((line) => mapLineData(tenantId, voucher.legalEntityId, voucherId, line))
  await prisma.accountingVoucherLine.createMany({ data })

  const totals = computeLineTotals(lines)
  await prisma.accountingVoucher.update({
    where: { id: voucherId, tenantId },
    data: {
      totalDebit: totals.totalDebit,
      totalCredit: totals.totalCredit,
      baseTotalDebit: totals.baseTotalDebit,
      baseTotalCredit: totals.baseTotalCredit,
    },
  })

  return findByVoucherId(tenantId, voucherId)
}

export async function replaceDraftLines(
  tenantId: string,
  voucherId: string,
  lines: DraftVoucherLineInput[],
): Promise<AccountingVoucherLine[]> {
  const voucher = await voucherRepo.findByIdOrThrow(tenantId, voucherId)
  const editCheck = validateVoucherEditability(voucher.status as never, 'updateDraft')
  if (!editCheck.valid) throw new InvalidStateError(editCheck.errors[0]?.message ?? 'Voucher not editable')

  const validation = await validateVoucherLinesWithMasters(tenantId, voucher.legalEntityId, lines)
  if (!validation.valid) throw new ValidationError(validation.errors[0]?.message ?? 'Invalid voucher lines', validation.errors.map((e) => ({ field: e.field ?? 'lines', message: e.message })))

  await prisma.$transaction(async (tx) => {
    await tx.accountingVoucherLine.deleteMany({ where: { voucherId, tenantId } })
    const data = lines.map((line) => mapLineData(tenantId, voucher.legalEntityId, voucherId, line))
    if (data.length > 0) await tx.accountingVoucherLine.createMany({ data })
    const totals = computeLineTotals(lines)
    await tx.accountingVoucher.update({
      where: { id: voucherId, tenantId },
      data: {
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        baseTotalDebit: totals.baseTotalDebit,
        baseTotalCredit: totals.baseTotalCredit,
      },
    })
  })

  return findByVoucherId(tenantId, voucherId)
}

export async function findByVoucherId(tenantId: string, voucherId: string): Promise<AccountingVoucherLine[]> {
  return prisma.accountingVoucherLine.findMany({
    where: { voucherId, tenantId },
    orderBy: { lineNumber: 'asc' },
  })
}
