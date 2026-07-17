import type { AccountingVoucher, AccountingVoucherStatus, AccountingVoucherType, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { getPagination } from '../../../utils/pagination.js'
import { InvalidStateError, NotFoundError, ValidationError } from '../../../utils/errors.js'
import { getLegalEntityOrThrow, parseDateOnly } from '../shared/finance.helpers.js'
import { toDecimal } from '../shared/finance-decimal.js'
import type { DraftVoucherInput, VoucherStatus } from './ledger.types.js'
import {
  validateFinancialYearOwnership,
  validatePeriodOwnership,
  validateVoucherEditability,
} from './ledger.validators.js'
import type { LedgerQueryFiltersInput } from './ledger.schemas.js'

export interface CreateDraftInput extends DraftVoucherInput {
  createdBy?: string
}

export interface UpdateDraftInput {
  branchId?: string | null
  documentDate?: string
  postingDate?: string
  referenceNumber?: string | null
  externalReference?: string | null
  narration?: string | null
  currencyCode?: string
  exchangeRate?: string
  updatedBy?: string
}

export async function createDraft(tenantId: string, input: CreateDraftInput): Promise<AccountingVoucher> {
  await getLegalEntityOrThrow(tenantId, input.legalEntityId)
  const fyCheck = await validateFinancialYearOwnership(tenantId, input.legalEntityId, input.financialYearId)
  if (!fyCheck.valid) throw new ValidationError(fyCheck.errors[0]?.message ?? 'Invalid financial year')
  const periodCheck = await validatePeriodOwnership(
    tenantId,
    input.legalEntityId,
    input.financialYearId,
    input.accountingPeriodId,
  )
  if (!periodCheck.valid) throw new ValidationError(periodCheck.errors[0]?.message ?? 'Invalid period')

  return prisma.accountingVoucher.create({
    data: {
      tenantId,
      legalEntityId: input.legalEntityId,
      branchId: input.branchId ?? null,
      financialYearId: input.financialYearId,
      accountingPeriodId: input.accountingPeriodId,
      voucherType: input.voucherType as AccountingVoucherType,
      status: 'DRAFT',
      documentDate: parseDateOnly(input.documentDate),
      postingDate: parseDateOnly(input.postingDate),
      referenceNumber: input.referenceNumber ?? null,
      externalReference: input.externalReference ?? null,
      narration: input.narration ?? null,
      currencyCode: input.currencyCode ?? 'INR',
      exchangeRate: toDecimal(input.exchangeRate ?? '1'),
      sourceModule: input.sourceModule ?? null,
      sourceDocumentType: input.sourceDocumentType ?? null,
      sourceDocumentId: input.sourceDocumentId ?? null,
      sourceDocumentLineId: input.sourceDocumentLineId ?? null,
      createdBy: input.createdBy ?? null,
      updatedBy: input.createdBy ?? null,
    },
  })
}

export async function findById(tenantId: string, id: string): Promise<AccountingVoucher | null> {
  return prisma.accountingVoucher.findFirst({ where: { id, tenantId } })
}

export async function findByIdOrThrow(tenantId: string, id: string): Promise<AccountingVoucher> {
  const item = await findById(tenantId, id)
  if (!item) throw new NotFoundError('Accounting voucher not found')
  return item
}

export async function findMany(tenantId: string, query: LedgerQueryFiltersInput) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take } = getPagination(query)
  const where: Prisma.AccountingVoucherWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.financialYearId ? { financialYearId: query.financialYearId } : {}),
    ...(query.accountingPeriodId ? { accountingPeriodId: query.accountingPeriodId } : {}),
    ...(query.voucherType ? { voucherType: query.voucherType } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.sourceModule ? { sourceModule: query.sourceModule } : {}),
    ...(query.sourceDocumentType ? { sourceDocumentType: query.sourceDocumentType } : {}),
    ...(query.sourceDocumentId ? { sourceDocumentId: query.sourceDocumentId } : {}),
    ...(query.fromDate || query.toDate
      ? {
          postingDate: {
            ...(query.fromDate ? { gte: parseDateOnly(query.fromDate) } : {}),
            ...(query.toDate ? { lte: parseDateOnly(query.toDate) } : {}),
          },
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.accountingVoucher.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.accountingVoucher.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function updateDraft(
  tenantId: string,
  id: string,
  input: UpdateDraftInput,
): Promise<AccountingVoucher> {
  const voucher = await findByIdOrThrow(tenantId, id)
  const editCheck = validateVoucherEditability(voucher.status as VoucherStatus, 'updateDraft')
  if (!editCheck.valid) throw new InvalidStateError(editCheck.errors[0]?.message ?? 'Voucher not editable')

  const data: Prisma.AccountingVoucherUpdateInput = {
    ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
    ...(input.documentDate ? { documentDate: parseDateOnly(input.documentDate) } : {}),
    ...(input.postingDate ? { postingDate: parseDateOnly(input.postingDate) } : {}),
    ...(input.referenceNumber !== undefined ? { referenceNumber: input.referenceNumber } : {}),
    ...(input.externalReference !== undefined ? { externalReference: input.externalReference } : {}),
    ...(input.narration !== undefined ? { narration: input.narration } : {}),
    ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
    ...(input.exchangeRate ? { exchangeRate: toDecimal(input.exchangeRate) } : {}),
    updatedBy: input.updatedBy ?? undefined,
  }
  return prisma.accountingVoucher.update({ where: { id, tenantId }, data })
}

const TERMINAL_STATUSES: AccountingVoucherStatus[] = ['POSTED', 'REVERSED', 'CANCELLED']

export async function changeDraftStatus(
  tenantId: string,
  id: string,
  status: AccountingVoucherStatus,
  updatedBy?: string,
): Promise<AccountingVoucher> {
  const voucher = await findByIdOrThrow(tenantId, id)
  if (TERMINAL_STATUSES.includes(voucher.status)) {
    throw new InvalidStateError(`Cannot change status of voucher in ${voucher.status} state`)
  }
  return prisma.accountingVoucher.update({
    where: { id, tenantId },
    data: { status, updatedBy: updatedBy ?? undefined },
  })
}

export async function findByVoucherNumber(
  tenantId: string,
  legalEntityId: string,
  financialYearId: string,
  voucherType: AccountingVoucherType,
  voucherNumber: string,
): Promise<AccountingVoucher | null> {
  return prisma.accountingVoucher.findFirst({
    where: { tenantId, legalEntityId, financialYearId, voucherType, voucherNumber },
  })
}

export async function findBySourceDocument(
  tenantId: string,
  legalEntityId: string,
  sourceModule: string,
  sourceDocumentType: string,
  sourceDocumentId: string,
): Promise<AccountingVoucher[]> {
  return prisma.accountingVoucher.findMany({
    where: { tenantId, legalEntityId, sourceModule, sourceDocumentType, sourceDocumentId },
    orderBy: { createdAt: 'desc' },
  })
}
