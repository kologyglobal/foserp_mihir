import { Prisma, type TreasuryTransfer } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { toDecimal } from '../../shared/finance-decimal.js'
import { parseDateOnly } from '../../shared/finance.helpers.js'
import type { ListTreasuryTransfersQuery } from './treasury-transfer.schemas.js'
import { TreasuryTransferNotFoundError, TreasuryTransferStaleVersionError } from './treasury-transfer.errors.js'
import type {
  TreasuryTransferAccountResolution,
  TreasuryTransferAccountingPreview,
  TreasuryTransferDraftHeaderInput,
  TreasuryAccountSnapshot,
} from './treasury-transfer.types.js'
import type { TreasuryTransferCalculationResult } from './treasury-transfer.types.js'

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
  return `TTR-DRAFT-${ymd}-${randomDraftSuffix()}`
}

export async function generateUniqueDraftReference(tenantId: string): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const ref = draftReferenceForDate()
    const existing = await prisma.treasuryTransfer.findFirst({ where: { tenantId, draftReference: ref }, select: { id: true } })
    if (!existing) return ref
  }
  throw new Error('Could not generate unique treasury transfer draft reference')
}

export async function findTreasuryTransferById(tenantId: string, id: string): Promise<TreasuryTransfer | null> {
  return prisma.treasuryTransfer.findFirst({ where: { id, tenantId } })
}

export async function findTreasuryTransferByIdOrThrow(tenantId: string, id: string): Promise<TreasuryTransfer> {
  const row = await findTreasuryTransferById(tenantId, id)
  if (!row) throw new TreasuryTransferNotFoundError()
  return row
}

export function assertExpectedUpdatedAt(row: TreasuryTransfer, expectedUpdatedAt: string): void {
  if (row.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new TreasuryTransferStaleVersionError()
  }
}

function headerCreateData(
  header: TreasuryTransferDraftHeaderInput,
  source: TreasuryAccountSnapshot,
  destination: TreasuryAccountSnapshot,
  calc: TreasuryTransferCalculationResult,
) {
  return {
    tenantId: header.tenantId,
    legalEntityId: header.legalEntityId,
    sourceBranchId: header.sourceBranchId ?? null,
    destinationBranchId: header.destinationBranchId ?? null,
    sourceTreasuryAccountId: header.sourceTreasuryAccountId,
    destinationTreasuryAccountId: header.destinationTreasuryAccountId,
    sourceGlAccountId: calc.accounts.sourceGlAccountId,
    destinationGlAccountId: calc.accounts.destinationGlAccountId,
    inTransitGlAccountId: calc.accounts.inTransitGlAccountId,
    transferType: calc.transferType,
    postingMode: calc.postingMode,
    transferPurpose: header.transferPurpose,
    transferDate: header.transferDate,
    sourcePostingDate: header.sourcePostingDate,
    expectedReceiptDate: header.expectedReceiptDate ?? null,
    destinationPostingDate: header.destinationPostingDate ?? null,
    currencyCode: header.currencyCode,
    exchangeRate: toDecimal(header.exchangeRate),
    transferAmount: toDecimal(header.transferAmount),
    baseTransferAmount: toDecimal(calc.baseTransferAmount),
    externalReference: header.externalReference ?? null,
    normalizedExternalReference: header.externalReference ? header.externalReference.trim().toUpperCase() : null,
    sourceAccountNameSnapshot: source.name,
    sourceAccountTypeSnapshot: source.accountType,
    sourceMaskedNumberSnapshot: source.maskedNumber,
    destinationAccountNameSnapshot: destination.name,
    destinationAccountTypeSnapshot: destination.accountType,
    destinationMaskedNumberSnapshot: destination.maskedNumber,
    narration: header.narration ?? null,
    internalNote: header.internalNote ?? null,
    approvalRequired: header.approvalRequired,
    calculationVersion: calc.calculationVersion,
    validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
    accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
    updatedById: header.userId ?? null,
  }
}

export async function createTreasuryTransferDraft(
  header: TreasuryTransferDraftHeaderInput,
  source: TreasuryAccountSnapshot,
  destination: TreasuryAccountSnapshot,
  calc: TreasuryTransferCalculationResult,
): Promise<TreasuryTransfer> {
  return prisma.treasuryTransfer.create({
    data: {
      ...headerCreateData(header, source, destination, calc),
      status: 'DRAFT',
      draftReference: header.draftReference,
      transferNumber: null,
      createdById: header.userId ?? '',
    },
  })
}

export async function replaceTreasuryTransferDraft(
  tenantId: string,
  id: string,
  header: TreasuryTransferDraftHeaderInput,
  source: TreasuryAccountSnapshot,
  destination: TreasuryAccountSnapshot,
  calc: TreasuryTransferCalculationResult,
  expectedUpdatedAt: string,
): Promise<TreasuryTransfer> {
  const existing = await findTreasuryTransferByIdOrThrow(tenantId, id)
  if (existing.status !== 'DRAFT') throw new Error('TREASURY_TRANSFER_EDIT_NOT_ALLOWED')
  assertExpectedUpdatedAt(existing, expectedUpdatedAt)

  return prisma.treasuryTransfer.update({
    where: { id, tenantId },
    data: headerCreateData(header, source, destination, calc),
  })
}

export async function persistCalculatedFields(
  tenantId: string,
  id: string,
  calc: TreasuryTransferCalculationResult,
  userId?: string | null,
): Promise<TreasuryTransfer> {
  return prisma.treasuryTransfer.update({
    where: { id, tenantId },
    data: {
      sourceGlAccountId: calc.accounts.sourceGlAccountId,
      destinationGlAccountId: calc.accounts.destinationGlAccountId,
      inTransitGlAccountId: calc.accounts.inTransitGlAccountId,
      postingMode: calc.postingMode,
      baseTransferAmount: toDecimal(calc.baseTransferAmount),
      calculationVersion: calc.calculationVersion,
      validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
      accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
      updatedById: userId ?? null,
    },
  })
}

export async function listTreasuryTransfers(
  tenantId: string,
  query: ListTreasuryTransfersQuery,
): Promise<{ items: TreasuryTransfer[]; total: number; page: number; limit: number }> {
  const { skip, take, page } = getPagination(query)
  const where: Prisma.TreasuryTransferWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.transferType ? { transferType: query.transferType } : {}),
    ...(query.postingMode ? { postingMode: query.postingMode } : {}),
    ...(query.sourceTreasuryAccountId ? { sourceTreasuryAccountId: query.sourceTreasuryAccountId } : {}),
    ...(query.destinationTreasuryAccountId ? { destinationTreasuryAccountId: query.destinationTreasuryAccountId } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
          transferDate: {
            ...(query.dateFrom ? { gte: parseDateOnly(query.dateFrom) } : {}),
            ...(query.dateTo ? { lte: parseDateOnly(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { transferNumber: { contains: query.search } },
            { externalReference: { contains: query.search } },
          ],
        }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.treasuryTransfer.findMany({ where, skip, take, orderBy: { createdAt: query.sortOrder } }),
    prisma.treasuryTransfer.count({ where }),
  ])
  return { items, total, page, limit: query.limit }
}

export interface FinalizeDirectPostInput {
  tenantId: string
  transferId: string
  expectedUpdatedAt: string
  transferNumber: string
  sourceVoucherId: string
  sourcePostingEventId: string
  postedById: string | null
}

export async function finalizeDirectPost(
  tx: Prisma.TransactionClient,
  input: FinalizeDirectPostInput,
): Promise<{ count: number }> {
  return tx.treasuryTransfer.updateMany({
    where: {
      id: input.transferId,
      tenantId: input.tenantId,
      status: 'READY_TO_POST',
      transferNumber: null,
      sourceVoucherId: null,
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: {
      status: 'COMPLETED',
      transferNumber: input.transferNumber,
      sourceVoucherId: input.sourceVoucherId,
      sourcePostingEventId: input.sourcePostingEventId,
      destinationVoucherId: input.sourceVoucherId,
      destinationPostingEventId: input.sourcePostingEventId,
      completedAt: new Date(),
      completedById: input.postedById,
      updatedById: input.postedById,
    },
  })
}

export interface FinalizeDispatchInput {
  tenantId: string
  transferId: string
  expectedUpdatedAt: string
  transferNumber: string
  sourceVoucherId: string
  sourcePostingEventId: string
  dispatchedById: string | null
}

export async function finalizeDispatch(
  tx: Prisma.TransactionClient,
  input: FinalizeDispatchInput,
): Promise<{ count: number }> {
  return tx.treasuryTransfer.updateMany({
    where: {
      id: input.transferId,
      tenantId: input.tenantId,
      status: 'READY_TO_POST',
      transferNumber: null,
      sourceVoucherId: null,
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: {
      status: 'IN_TRANSIT',
      transferNumber: input.transferNumber,
      sourceVoucherId: input.sourceVoucherId,
      sourcePostingEventId: input.sourcePostingEventId,
      dispatchedAt: new Date(),
      dispatchedById: input.dispatchedById,
      updatedById: input.dispatchedById,
    },
  })
}

export interface FinalizeReceiveInput {
  tenantId: string
  transferId: string
  expectedUpdatedAt: string
  destinationVoucherId: string
  destinationPostingEventId: string
  receivedById: string | null
}

export async function finalizeReceive(
  tx: Prisma.TransactionClient,
  input: FinalizeReceiveInput,
): Promise<{ count: number }> {
  return tx.treasuryTransfer.updateMany({
    where: {
      id: input.transferId,
      tenantId: input.tenantId,
      status: 'IN_TRANSIT',
      destinationVoucherId: null,
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: {
      status: 'COMPLETED',
      destinationVoucherId: input.destinationVoucherId,
      destinationPostingEventId: input.destinationPostingEventId,
      receivedAt: new Date(),
      receivedById: input.receivedById,
      completedAt: new Date(),
      completedById: input.receivedById,
      updatedById: input.receivedById,
    },
  })
}

export { toDecimal }
export type { TreasuryTransferAccountResolution, TreasuryTransferAccountingPreview }
