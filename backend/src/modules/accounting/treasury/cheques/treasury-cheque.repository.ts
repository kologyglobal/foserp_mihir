import { Prisma, type TreasuryCheque, type TreasuryChequeStatus } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import type { ListTreasuryChequesQuery } from './treasury-cheque.schemas.js'
import { TreasuryChequeNotFoundError, TreasuryChequeStaleVersionError } from './treasury-cheque.errors.js'
import type {
  TreasuryAccountSnapshot,
  TreasuryChequeCalculationResult,
  TreasuryChequeDraftHeaderInput,
} from './treasury-cheque.types.js'

const DRAFT_CHARS = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomDraftSuffix(length = 6): string {
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += DRAFT_CHARS[Math.floor(Math.random() * DRAFT_CHARS.length)]
  }
  return out
}

export function draftReferenceForDate(date = new Date()): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, '')
  return `CHQ-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueDraftReference(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.treasuryCheque.findFirst({ where: { tenantId, draftReference: ref }, select: { id: true } })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique treasury cheque draft reference')
}

/** Soft-uniqueness key — freed (set to null) once a cheque is CANCELLED or REVERSED so the number can be reused. */
export function buildChequeUniquenessKey(
  tenantId: string,
  legalEntityId: string,
  direction: string,
  chequeNumber: string,
  chequeDate: Date,
): string {
  const normalizedNumber = chequeNumber.trim().toUpperCase()
  const dateKey = chequeDate.toISOString().slice(0, 10)
  return `${tenantId}:${legalEntityId}:${direction}:${normalizedNumber}:${dateKey}`
}

export async function findActiveChequeByUniquenessKey(uniquenessKey: string): Promise<TreasuryCheque | null> {
  return prisma.treasuryCheque.findFirst({ where: { uniquenessKey } })
}

export async function findTreasuryChequeById(tenantId: string, id: string): Promise<TreasuryCheque | null> {
  return prisma.treasuryCheque.findFirst({ where: { id, tenantId } })
}

export async function findTreasuryChequeByIdOrThrow(tenantId: string, id: string): Promise<TreasuryCheque> {
  const row = await findTreasuryChequeById(tenantId, id)
  if (!row) throw new TreasuryChequeNotFoundError()
  return row
}

export function assertExpectedUpdatedAt(row: TreasuryCheque, expectedUpdatedAt: string): void {
  if (row.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryChequeStaleVersionError()
  }
}

function headerCreateData(
  header: TreasuryChequeDraftHeaderInput,
  account: TreasuryAccountSnapshot,
  calc: TreasuryChequeCalculationResult,
) {
  return {
    tenantId: header.tenantId,
    legalEntityId: header.legalEntityId,
    branchId: header.branchId ?? null,
    treasuryAccountId: header.treasuryAccountId,
    glAccountId: account.glAccountId,
    counterpartGlAccountId: calc.counterpart.counterpartGlAccountId,
    direction: header.direction,
    accountingMode: header.accountingMode,
    chequeNumber: header.chequeNumber,
    chequeDate: header.chequeDate,
    bankName: header.bankName ?? null,
    branchName: header.branchName ?? null,
    ifsc: header.ifsc ?? null,
    payeeOrDrawerName: header.payeeOrDrawerName,
    currencyCode: header.currencyCode,
    exchangeRate: toDecimal(header.exchangeRate),
    amount: toDecimal(header.amount),
    baseAmount: toDecimal(calc.baseAmount),
    isPdc: header.isPdc,
    pdcMaturityDate: header.pdcMaturityDate ?? null,
    customerReceiptId: header.customerReceiptId ?? null,
    vendorPaymentId: header.vendorPaymentId ?? null,
    narration: header.narration ?? null,
    internalNote: header.internalNote ?? null,
    approvalRequired: header.approvalRequired,
    calculationVersion: calc.calculationVersion,
    validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
    accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
    updatedById: header.userId ?? null,
  }
}

export async function createTreasuryChequeDraft(
  header: TreasuryChequeDraftHeaderInput,
  account: TreasuryAccountSnapshot,
  calc: TreasuryChequeCalculationResult,
  uniquenessKey: string,
): Promise<TreasuryCheque> {
  return prisma.treasuryCheque.create({
    data: {
      ...headerCreateData(header, account, calc),
      status: 'DRAFT',
      draftReference: header.draftReference,
      chequeRegisterNumber: null,
      uniquenessKey,
      createdById: header.userId ?? '',
    },
  })
}

export async function replaceTreasuryChequeDraft(
  tenantId: string,
  id: string,
  header: TreasuryChequeDraftHeaderInput,
  account: TreasuryAccountSnapshot,
  calc: TreasuryChequeCalculationResult,
  uniquenessKey: string,
  expectedUpdatedAt: string,
): Promise<TreasuryCheque> {
  const existing = await findTreasuryChequeByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new Error('TREASURY_CHEQUE_EDIT_NOT_ALLOWED')
  assertExpectedUpdatedAt(existing, expectedUpdatedAt)

  return prisma.treasuryCheque.update({
    where: { id, tenantId },
    data: { ...headerCreateData(header, account, calc), uniquenessKey },
  })
}

export async function persistCalculatedFields(
  tenantId: string,
  id: string,
  calc: TreasuryChequeCalculationResult,
  userId?: string | null,
): Promise<TreasuryCheque> {
  return prisma.treasuryCheque.update({
    where: { id, tenantId },
    data: {
      counterpartGlAccountId: calc.counterpart.counterpartGlAccountId,
      baseAmount: toDecimal(calc.baseAmount),
      calculationVersion: calc.calculationVersion,
      validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
      accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
      updatedById: userId ?? null,
    },
  })
}

export async function listTreasuryCheques(
  tenantId: string,
  query: ListTreasuryChequesQuery,
): Promise<{ items: TreasuryCheque[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.TreasuryChequeWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.direction ? { direction: query.direction } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
    ...(query.isPdc != null ? { isPdc: query.isPdc } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          chequeDate: {
            ...(query.dateFrom ? { gte: parseDateOnly(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.chequeNumber ? { chequeNumber: { contains: query.chequeNumber } } : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { chequeRegisterNumber: { contains: query.search } },
            { chequeNumber: { contains: query.search } },
            { payeeOrDrawerName: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.treasuryCheque.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.treasuryCheque.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export interface FinalizeLifecycleTransitionInput {
  tenantId: string
  chequeId: string
  fromStatuses: TreasuryChequeStatus[]
  toStatus: TreasuryChequeStatus
  expectedUpdatedAt: string
  data: Prisma.TreasuryChequeUpdateManyMutationInput
}

/** Generic guarded status transition — atomic via updatedAt + status check. Used by workflow and posting. */
export async function finalizeLifecycleTransition(
  input: FinalizeLifecycleTransitionInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ count: number }> {
  return tx.treasuryCheque.updateMany({
    where: {
      id: input.chequeId,
      tenantId: input.tenantId,
      status: { in: input.fromStatuses },
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: { status: input.toStatus, ...input.data },
  })
}

export { toDecimal }
