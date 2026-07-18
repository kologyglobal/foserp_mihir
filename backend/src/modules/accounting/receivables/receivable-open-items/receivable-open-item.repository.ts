import type { Prisma, ReceivableOpenItem } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { formatForPersistence, roundExchangeRate } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import type { ListReceivableOpenItemsQuery, ReceivableOpenItemDto } from './receivable-open-item.types.js'
import { DEBIT_OPEN_ITEM_SIDE_FILTER } from '../receipts/receivable-open-item-side.validators.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapReceivableOpenItemToDto(item: ReceivableOpenItem): ReceivableOpenItemDto {
  return {
    id: item.id,
    tenantId: item.tenantId,
    legalEntityId: item.legalEntityId,
    branchId: item.branchId,
    side: item.side,
    documentType: item.documentType,
    documentId: item.documentId,
    documentNumberSnapshot: item.documentNumberSnapshot,
    salesInvoiceId: item.salesInvoiceId,
    customerReceiptId: item.customerReceiptId,
    customerCreditNoteId: item.customerCreditNoteId,
    customerId: item.customerId,
    customerNameSnapshot: item.customerNameSnapshot,
    receivableAccountId: item.receivableAccountId,
    currencyCode: item.currencyCode,
    exchangeRate: roundExchangeRate(item.exchangeRate).toFixed(8),
    originalAmount: formatForPersistence(item.originalAmount),
    openAmount: formatForPersistence(item.openAmount),
    allocatedAmount: formatForPersistence(item.allocatedAmount),
    adjustedAmount: formatForPersistence(item.adjustedAmount),
    writtenOffAmount: formatForPersistence(item.writtenOffAmount),
    baseOriginalAmount: formatForPersistence(item.baseOriginalAmount),
    baseOpenAmount: formatForPersistence(item.baseOpenAmount),
    baseAllocatedAmount: formatForPersistence(item.baseAllocatedAmount),
    baseAdjustedAmount: formatForPersistence(item.baseAdjustedAmount),
    baseWrittenOffAmount: formatForPersistence(item.baseWrittenOffAmount),
    documentDate: formatDate(item.documentDate),
    dueDate: formatDate(item.dueDate),
    status: item.status,
    accountingVoucherId: item.accountingVoucherId,
    createdBy: item.createdBy,
    updatedBy: item.updatedBy,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export async function findReceivableOpenItemById(
  tenantId: string,
  id: string,
): Promise<ReceivableOpenItemDto | null> {
  const item = await prisma.receivableOpenItem.findFirst({ where: { id, tenantId } })
  return item ? mapReceivableOpenItemToDto(item) : null
}

export async function findReceivableOpenItemRecordById(
  tenantId: string,
  id: string,
): Promise<ReceivableOpenItem | null> {
  return prisma.receivableOpenItem.findFirst({ where: { id, tenantId } })
}

export async function findReceivableOpenItemByDocument(
  tenantId: string,
  legalEntityId: string,
  documentType: ReceivableOpenItem['documentType'],
  documentId: string,
): Promise<ReceivableOpenItemDto | null> {
  const item = await prisma.receivableOpenItem.findFirst({
    where: { tenantId, legalEntityId, documentType, documentId },
  })
  return item ? mapReceivableOpenItemToDto(item) : null
}

export async function listReceivableOpenItems(
  tenantId: string,
  query: ListReceivableOpenItemsQuery,
): Promise<{ items: ReceivableOpenItemDto[]; total: number; page: number; limit: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where: Prisma.ReceivableOpenItemWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.documentType ? { documentType: query.documentType } : {}),
    ...(query.side ? { side: query.side } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.receivableOpenItem.findMany({ where, skip, take, orderBy: { dueDate: 'asc' } }),
    prisma.receivableOpenItem.count({ where }),
  ])
  return { items: items.map(mapReceivableOpenItemToDto), total, page, limit }
}

export async function findDebitOpenItems(
  tenantId: string,
  legalEntityId: string,
  extra?: Omit<Prisma.ReceivableOpenItemWhereInput, 'tenantId' | 'legalEntityId' | 'side'>,
): Promise<ReceivableOpenItemDto[]> {
  const items = await prisma.receivableOpenItem.findMany({
    where: { tenantId, legalEntityId, ...DEBIT_OPEN_ITEM_SIDE_FILTER, ...extra },
    orderBy: { dueDate: 'asc' },
  })
  return items.map(mapReceivableOpenItemToDto)
}

export async function findCreditOpenItems(
  tenantId: string,
  legalEntityId: string,
  extra?: Omit<Prisma.ReceivableOpenItemWhereInput, 'tenantId' | 'legalEntityId' | 'side'>,
): Promise<ReceivableOpenItemDto[]> {
  const items = await prisma.receivableOpenItem.findMany({
    where: { tenantId, legalEntityId, side: 'CREDIT', ...extra },
    orderBy: { documentDate: 'desc' },
  })
  return items.map(mapReceivableOpenItemToDto)
}

type AllocationTx = Prisma.TransactionClient

export interface ApplyOpenItemAllocationInput {
  tenantId: string
  legalEntityId: string
  openItemId: string
  expectedOpenAmount: Prisma.Decimal | string
  expectedAllocatedAmount: Prisma.Decimal | string
  expectedBaseOpenAmount: Prisma.Decimal | string
  expectedBaseAllocatedAmount: Prisma.Decimal | string
  allocationAmount: Prisma.Decimal | string
  baseAllocationAmount: Prisma.Decimal | string
  newStatus: 'OPEN' | 'PARTIALLY_SETTLED' | 'SETTLED'
  settledAt: Date | null
  updatedBy?: string | null
}

/** Internal: conditional debit open-item balance update for receipt allocation. Not HTTP-routable. */
export async function applyDebitAllocation(tx: AllocationTx, input: ApplyOpenItemAllocationInput): Promise<number> {
  const result = await tx.receivableOpenItem.updateMany({
    where: {
      id: input.openItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      side: 'DEBIT',
      openAmount: input.expectedOpenAmount,
      allocatedAmount: input.expectedAllocatedAmount,
      baseOpenAmount: input.expectedBaseOpenAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
    },
    data: {
      openAmount: { decrement: input.allocationAmount },
      allocatedAmount: { increment: input.allocationAmount },
      baseOpenAmount: { decrement: input.baseAllocationAmount },
      baseAllocatedAmount: { increment: input.baseAllocationAmount },
      status: input.newStatus,
      settledAt: input.settledAt,
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}

/** Internal: conditional credit open-item balance update for receipt allocation. Not HTTP-routable. */
export async function applyCreditAllocation(tx: AllocationTx, input: ApplyOpenItemAllocationInput): Promise<number> {
  const result = await tx.receivableOpenItem.updateMany({
    where: {
      id: input.openItemId,
      tenantId: input.tenantId,
      legalEntityId: input.legalEntityId,
      side: 'CREDIT',
      openAmount: input.expectedOpenAmount,
      allocatedAmount: input.expectedAllocatedAmount,
      baseOpenAmount: input.expectedBaseOpenAmount,
      baseAllocatedAmount: input.expectedBaseAllocatedAmount,
      status: { in: ['OPEN', 'PARTIALLY_SETTLED'] },
    },
    data: {
      openAmount: { decrement: input.allocationAmount },
      allocatedAmount: { increment: input.allocationAmount },
      baseOpenAmount: { decrement: input.baseAllocationAmount },
      baseAllocatedAmount: { increment: input.baseAllocationAmount },
      status: input.newStatus,
      settledAt: input.settledAt,
      updatedBy: input.updatedBy ?? null,
    },
  })
  return result.count
}
