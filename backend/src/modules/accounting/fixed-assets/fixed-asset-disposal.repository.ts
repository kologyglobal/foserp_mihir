import type { FixedAssetDisposalStatus, Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { toDecimal } from '../shared/finance-decimal.js'
import { parseDateOnly } from '../shared/finance.helpers.js'
import { FixedAssetDisposalNotFoundError, FixedAssetDisposalStaleVersionError } from './fixed-asset-disposal.errors.js'
import type {
  FixedAssetDisposalCalculationResult,
  FixedAssetDisposalDraftHeaderInput,
  FixedAssetDisposalWithAsset,
} from './fixed-asset-disposal.types.js'
import type { ListFixedAssetDisposalsQueryInput } from './fixed-assets.schemas.js'

const disposalInclude = {
  asset: {
    include: {
      category: {
        select: { id: true, name: true, assetAccountId: true, accumDepAccountId: true },
      },
    },
  },
} as const

export function buildOpenDisposalUniquenessKey(assetId: string): string {
  return `FA_DISPOSAL_OPEN:${assetId}`
}

const NON_TERMINAL_STATUSES: FixedAssetDisposalStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'READY_TO_POST', 'REJECTED']

export async function findOpenDisposalForAsset(tenantId: string, assetId: string) {
  return prisma.fixedAssetDisposal.findFirst({
    where: { tenantId, assetId, status: { in: NON_TERMINAL_STATUSES } },
  })
}

export async function findDisposalById(tenantId: string, id: string): Promise<FixedAssetDisposalWithAsset | null> {
  return prisma.fixedAssetDisposal.findFirst({
    where: { id, tenantId },
    include: disposalInclude,
  })
}

export async function findDisposalByIdOrThrow(tenantId: string, id: string): Promise<FixedAssetDisposalWithAsset> {
  const row = await findDisposalById(tenantId, id)
  if (!row) throw new FixedAssetDisposalNotFoundError()
  return row
}

export function assertExpectedUpdatedAt(row: { updatedAt: Date }, expectedUpdatedAt: string): void {
  if (row.updatedAt.getTime() !== new Date(expectedUpdatedAt).getTime()) {
    throw new FixedAssetDisposalStaleVersionError()
  }
}

export async function listDisposals(
  tenantId: string,
  query: ListFixedAssetDisposalsQueryInput,
): Promise<{ items: FixedAssetDisposalWithAsset[]; total: number; page: number; pageSize: number }> {
  const where: Prisma.FixedAssetDisposalWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.assetId ? { assetId: query.assetId } : {}),
    ...(query.search
      ? {
          OR: [
            { draftReference: { contains: query.search } },
            { disposalNumber: { contains: query.search } },
            { reason: { contains: query.search } },
          ],
        }
      : {}),
  }

  const [items, total] = await Promise.all([
    prisma.fixedAssetDisposal.findMany({
      where,
      include: disposalInclude,
      orderBy: [{ createdAt: 'desc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
    prisma.fixedAssetDisposal.count({ where }),
  ])

  return { items, total, page: query.page, pageSize: query.pageSize }
}

function headerCreateData(header: FixedAssetDisposalDraftHeaderInput, calc: FixedAssetDisposalCalculationResult) {
  return {
    tenantId: header.tenantId,
    legalEntityId: header.legalEntityId,
    branchId: header.branchId ?? null,
    assetId: header.assetId,
    draftReference: header.draftReference,
    disposalType: header.disposalType,
    isPartial: false,
    disposalDate: header.disposalDate,
    currencyCode: header.currencyCode,
    proceeds: toDecimal(header.proceeds),
    buyerName: header.buyerName ?? null,
    reason: header.reason,
    acquisitionCostSnapshot: toDecimal(calc.acquisitionCostSnapshot),
    accumulatedDepreciationSnapshot: toDecimal(calc.accumulatedDepreciationSnapshot),
    netBookValueSnapshot: toDecimal(calc.netBookValueSnapshot),
    disposedCost: toDecimal(calc.disposedCost),
    disposedAccumDep: toDecimal(calc.disposedAccumDep),
    disposedNbv: toDecimal(calc.disposedNbv),
    gainLoss: toDecimal(calc.gainLoss),
    proceedsTreasuryAccountId: header.proceedsTreasuryAccountId ?? null,
    proceedsAccountId: calc.proceedsAccountId,
    gstApplicable: header.gstApplicable,
    placeOfSupply: header.placeOfSupply ?? null,
    partyGstin: header.partyGstin ?? null,
    taxableAmount: toDecimal(calc.taxableAmount),
    cgstAmount: toDecimal(calc.cgstAmount),
    sgstAmount: toDecimal(calc.sgstAmount),
    igstAmount: toDecimal(calc.igstAmount),
    cessAmount: toDecimal(calc.cessAmount),
    totalTaxAmount: toDecimal(calc.totalTaxAmount),
    totalProceeds: toDecimal(calc.totalProceeds),
    approvalRequired: header.approvalRequired,
    validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
    accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
    updatedById: header.userId ?? null,
  }
}

export async function createDisposalDraft(
  header: FixedAssetDisposalDraftHeaderInput,
  calc: FixedAssetDisposalCalculationResult,
): Promise<FixedAssetDisposalWithAsset> {
  const created = await prisma.fixedAssetDisposal.create({
    data: {
      ...headerCreateData(header, calc),
      status: 'DRAFT',
      uniquenessKey: buildOpenDisposalUniquenessKey(header.assetId),
      createdById: header.userId ?? '',
    },
    include: disposalInclude,
  })
  return created
}

export async function replaceDisposalDraft(
  tenantId: string,
  id: string,
  header: FixedAssetDisposalDraftHeaderInput,
  calc: FixedAssetDisposalCalculationResult,
  expectedUpdatedAt: string,
): Promise<FixedAssetDisposalWithAsset> {
  const existing = await findDisposalByIdOrThrow(tenantId, id)
  assertExpectedUpdatedAt(existing, expectedUpdatedAt)

  await prisma.fixedAssetDisposal.update({
    where: { id, tenantId },
    data: headerCreateData(header, calc),
  })

  return findDisposalByIdOrThrow(tenantId, id)
}

export async function persistCalculatedFields(
  tenantId: string,
  id: string,
  calc: FixedAssetDisposalCalculationResult,
  userId?: string | null,
): Promise<void> {
  await prisma.fixedAssetDisposal.update({
    where: { id, tenantId },
    data: {
      acquisitionCostSnapshot: toDecimal(calc.acquisitionCostSnapshot),
      accumulatedDepreciationSnapshot: toDecimal(calc.accumulatedDepreciationSnapshot),
      netBookValueSnapshot: toDecimal(calc.netBookValueSnapshot),
      disposedCost: toDecimal(calc.disposedCost),
      disposedAccumDep: toDecimal(calc.disposedAccumDep),
      disposedNbv: toDecimal(calc.disposedNbv),
      gainLoss: toDecimal(calc.gainLoss),
      proceedsAccountId: calc.proceedsAccountId,
      taxableAmount: toDecimal(calc.taxableAmount),
      cgstAmount: toDecimal(calc.cgstAmount),
      sgstAmount: toDecimal(calc.sgstAmount),
      igstAmount: toDecimal(calc.igstAmount),
      cessAmount: toDecimal(calc.cessAmount),
      totalTaxAmount: toDecimal(calc.totalTaxAmount),
      totalProceeds: toDecimal(calc.totalProceeds),
      validationSnapshot: calc.validation as unknown as Prisma.InputJsonValue,
      accountingPreviewSnapshot: calc.accountingPreview as unknown as Prisma.InputJsonValue,
      updatedById: userId ?? null,
    },
  })
}

export interface FinalizeDisposalLifecycleInput {
  tenantId: string
  disposalId: string
  fromStatuses: FixedAssetDisposalStatus[]
  toStatus: FixedAssetDisposalStatus
  expectedUpdatedAt: string
  // Unchecked variant: postingEventId / reversalPostingEventId are relation FKs,
  // excluded from the checked UpdateManyMutationInput.
  data: Prisma.FixedAssetDisposalUncheckedUpdateManyInput
}

export async function finalizeDisposalLifecycleTransition(
  input: FinalizeDisposalLifecycleInput,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<{ count: number }> {
  return tx.fixedAssetDisposal.updateMany({
    where: {
      id: input.disposalId,
      tenantId: input.tenantId,
      status: { in: input.fromStatuses },
      updatedAt: new Date(input.expectedUpdatedAt),
    },
    data: { status: input.toStatus, ...input.data },
  })
}

export async function findMappingAccount(
  tenantId: string,
  legalEntityId: string,
  mappingKey:
    | 'ASSET_DISPOSAL_GAIN'
    | 'ASSET_DISPOSAL_LOSS'
    | 'GST_OUTPUT_CGST'
    | 'GST_OUTPUT_SGST'
    | 'GST_OUTPUT_IGST'
    | 'GST_OUTPUT_CESS',
) {
  const mapping = await prisma.defaultAccountMapping.findFirst({
    where: { tenantId, legalEntityId, mappingKey },
    include: { account: true },
  })
  return mapping?.account ?? null
}

export async function findTreasuryAccountInLegalEntity(tenantId: string, legalEntityId: string, treasuryAccountId: string) {
  return prisma.treasuryAccount.findFirst({
    where: { id: treasuryAccountId, tenantId, legalEntityId },
  })
}

export async function findAccountInLegalEntity(tenantId: string, legalEntityId: string, accountId: string) {
  return prisma.account.findFirst({
    where: { id: accountId, tenantId, legalEntityId },
  })
}

export { parseDateOnly, toDecimal }
