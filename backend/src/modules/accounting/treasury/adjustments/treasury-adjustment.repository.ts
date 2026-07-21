import { Prisma, type TreasuryAdjustment, type TreasuryAdjustmentStatus } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import type { ListTreasuryAdjustmentsQuery } from './treasury-adjustment.schemas.js'
import { TreasuryAdjustmentNotFoundError, TreasuryAdjustmentStaleVersionError } from './treasury-adjustment.errors.js'
import type { TreasuryAdjustmentCalculationResult, TreasuryAdjustmentDraftHeaderInput, TreasuryAdjustmentWithLines } from './treasury-adjustment.types.js'

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
  return `TADJ-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueDraftReference(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.treasuryAdjustment.findFirst({ where: { tenantId, draftReference: ref }, select: { id: true } })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique treasury adjustment draft reference')
}

export function buildAdjustmentUniquenessKey(
  tenantId: string,
  legalEntityId: string,
  treasuryAccountId: string,
  adjustmentType: string,
  adjustmentDate: Date,
  bankAmount: string,
  bankStatementLineId?: string | null,
): string {
  if (bankStatementLineId) return `${tenantId}:STMT:${bankStatementLineId}`
  const dateKey = adjustmentDate.toISOString().slice(0, 10)
  return `${tenantId}:${legalEntityId}:${treasuryAccountId}:${adjustmentType}:${dateKey}:${bankAmount}:${randomDraftSuffix(4)}`
}

export async function findTreasuryAdjustmentById(tenantId: string, id: string): Promise<TreasuryAdjustmentWithLines | null> {
  return prisma.treasuryAdjustment.findFirst({ where: { id, tenantId }, include: { lines: { orderBy: { lineNumber: 'asc' } } } })
}

export async function findTreasuryAdjustmentByIdOrThrow(tenantId: string, id: string): Promise<TreasuryAdjustmentWithLines> {
  const row = await findTreasuryAdjustmentById(tenantId, id)
  if (!row) throw new TreasuryAdjustmentNotFoundError()
  return row
}

export function assertExpectedUpdatedAt(row: TreasuryAdjustment, expectedUpdatedAt: string): void {
  if (row.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryAdjustmentStaleVersionError()
  }
}

function headerCreateData(header: TreasuryAdjustmentDraftHeaderInput, glAccountId: string, calc: TreasuryAdjustmentCalculationResult) {
  return {
    tenantId: header.tenantId,
    legalEntityId: header.legalEntityId,
    branchId: header.branchId ?? null,
    treasuryAccountId: header.treasuryAccountId,
    glAccountId,
    adjustmentType: header.adjustmentType,
    direction: calc.direction,
    sourceMode: header.sourceMode,
    adjustmentDate: header.adjustmentDate,
    currencyCode: header.currencyCode,
    exchangeRate: toDecimal(header.exchangeRate),
    bankAmount: toDecimal(calc.bankAmount),
    baseBankAmount: toDecimal(calc.bankAmount).mul(toDecimal(header.exchangeRate)),
    bankStatementLineId: header.bankStatementLineId ?? null,
    standingInstructionExecutionId: header.standingInstructionExecutionId ?? null,
    narration: header.narration ?? null,
    internalNote: header.internalNote ?? null,
    approvalRequired: header.approvalRequired,
    calculationVersion: calc.calculationVersion,
    validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
    accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
    updatedById: header.userId ?? null,
  }
}

export async function createTreasuryAdjustmentDraft(
  header: TreasuryAdjustmentDraftHeaderInput,
  glAccountId: string,
  calc: TreasuryAdjustmentCalculationResult,
  uniquenessKey: string | null,
): Promise<TreasuryAdjustmentWithLines> {
  const created = await prisma.treasuryAdjustment.create({
    data: {
      ...headerCreateData(header, glAccountId, calc),
      status: 'DRAFT',
      draftReference: header.draftReference,
      uniquenessKey,
      createdById: header.userId ?? '',
      lines: {
        create: calc.resolvedLines.map((line) => ({
          tenantId: header.tenantId,
          lineNumber: line.lineNumber,
          lineType: line.lineType,
          accountId: line.accountId,
          description: line.description,
          amount: toDecimal(line.amount),
          gstTreatment: line.gstTreatment,
          gstRate: line.gstRate != null ? toDecimal(line.gstRate) : null,
          tdsTreatment: line.tdsTreatment,
          tdsRate: line.tdsRate != null ? toDecimal(line.tdsRate) : null,
          narration: line.narration,
        })),
      },
    },
    include: { lines: { orderBy: { lineNumber: 'asc' } } },
  })
  return created
}

export async function replaceTreasuryAdjustmentDraft(
  tenantId: string,
  id: string,
  header: TreasuryAdjustmentDraftHeaderInput,
  glAccountId: string,
  calc: TreasuryAdjustmentCalculationResult,
  uniquenessKey: string | null,
  expectedUpdatedAt: string,
): Promise<TreasuryAdjustmentWithLines> {
  const existing = await findTreasuryAdjustmentByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new Error('TREASURY_ADJUSTMENT_EDIT_NOT_ALLOWED')
  assertExpectedUpdatedAt(existing, expectedUpdatedAt)

  await prisma.$transaction([
    prisma.treasuryAdjustmentLine.deleteMany({ where: { treasuryAdjustmentId: id, tenantId } }),
    prisma.treasuryAdjustment.update({
      where: { id, tenantId },
      data: {
        ...headerCreateData(header, glAccountId, calc),
        uniquenessKey,
        lines: {
          create: calc.resolvedLines.map((line) => ({
            tenantId: header.tenantId,
            lineNumber: line.lineNumber,
            lineType: line.lineType,
            accountId: line.accountId,
            description: line.description,
            amount: toDecimal(line.amount),
            gstTreatment: line.gstTreatment,
            gstRate: line.gstRate != null ? toDecimal(line.gstRate) : null,
            tdsTreatment: line.tdsTreatment,
            tdsRate: line.tdsRate != null ? toDecimal(line.tdsRate) : null,
            narration: line.narration,
          })),
        },
      },
    }),
  ])

  return findTreasuryAdjustmentByIdOrThrow(tenantId, id)
}

export async function persistCalculatedFields(
  tenantId: string,
  id: string,
  calc: TreasuryAdjustmentCalculationResult,
  userId?: string | null,
): Promise<void> {
  await prisma.treasuryAdjustment.update({
    where: { id, tenantId },
    data: {
      direction: calc.direction,
      bankAmount: toDecimal(calc.bankAmount),
      calculationVersion: calc.calculationVersion,
      validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
      accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
      updatedById: userId ?? null,
    },
  })
}

export async function listTreasuryAdjustments(
  tenantId: string,
  query: ListTreasuryAdjustmentsQuery,
): Promise<{ items: TreasuryAdjustmentWithLines[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.TreasuryAdjustmentWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.adjustmentType ? { adjustmentType: query.adjustmentType } : {}),
    ...(query.direction ? { direction: query.direction } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          adjustmentDate: {
            ...(query.dateFrom ? { gte: parseDateOnly(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { adjustmentNumber: { contains: query.search } },
            { narration: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.treasuryAdjustment.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: query.sortOrder },
      include: { lines: { orderBy: { lineNumber: 'asc' } } },
    }),
    prisma.treasuryAdjustment.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export interface FinalizeLifecycleTransitionInput {
  tenantId: string
  adjustmentId: string
  fromStatuses: TreasuryAdjustmentStatus[]
  toStatus: TreasuryAdjustmentStatus
  expectedUpdatedAt: string
  data: Prisma.TreasuryAdjustmentUpdateManyMutationInput
}

export async function finalizeLifecycleTransition(
  input: FinalizeLifecycleTransitionInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ count: number }> {
  return tx.treasuryAdjustment.updateMany({
    where: {
      id: input.adjustmentId,
      tenantId: input.tenantId,
      status: { in: input.fromStatuses },
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: { status: input.toStatus, ...input.data },
  })
}

export { toDecimal }
