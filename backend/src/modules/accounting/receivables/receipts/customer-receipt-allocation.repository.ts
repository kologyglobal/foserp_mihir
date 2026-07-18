import type { CustomerReceiptAllocation, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { formatForPersistence, roundExchangeRate } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import type { CustomerReceiptAllocationDto, ListCustomerReceiptAllocationsQuery } from './customer-receipt.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function mapCustomerReceiptAllocationToDto(
  allocation: CustomerReceiptAllocation,
): CustomerReceiptAllocationDto {
  return {
    id: allocation.id,
    tenantId: allocation.tenantId,
    legalEntityId: allocation.legalEntityId,
    customerId: allocation.customerId,
    receiptId: allocation.receiptId,
    receiptOpenItemId: allocation.receiptOpenItemId,
    invoiceId: allocation.invoiceId,
    invoiceOpenItemId: allocation.invoiceOpenItemId,
    allocationDate: formatDate(allocation.allocationDate)!,
    postingDate: formatDate(allocation.postingDate),
    currencyCode: allocation.currencyCode,
    exchangeRate: roundExchangeRate(allocation.exchangeRate).toFixed(8),
    allocatedAmount: formatForPersistence(allocation.allocatedAmount),
    baseAllocatedAmount: formatForPersistence(allocation.baseAllocatedAmount),
    status: allocation.status,
    allocationSequence: allocation.allocationSequence,
    createdBy: allocation.createdBy,
    createdAt: allocation.createdAt.toISOString(),
    reversedAt: allocation.reversedAt?.toISOString() ?? null,
    reversedBy: allocation.reversedBy,
    reversalReason: allocation.reversalReason,
  }
}

export async function findCustomerReceiptAllocationById(
  tenantId: string,
  id: string,
): Promise<CustomerReceiptAllocationDto | null> {
  const row = await prisma.customerReceiptAllocation.findFirst({ where: { id, tenantId } })
  return row ? mapCustomerReceiptAllocationToDto(row) : null
}

export async function findCustomerReceiptAllocationRecordById(
  tenantId: string,
  id: string,
): Promise<CustomerReceiptAllocation | null> {
  return prisma.customerReceiptAllocation.findFirst({ where: { id, tenantId } })
}

export async function listCustomerReceiptAllocations(
  tenantId: string,
  query: ListCustomerReceiptAllocationsQuery,
): Promise<{ items: CustomerReceiptAllocationDto[]; total: number; page: number; limit: number }> {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    sortOrder: 'desc',
  })
  const where: Prisma.CustomerReceiptAllocationWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    ...(query.receiptId ? { receiptId: query.receiptId } : {}),
    ...(query.invoiceId ? { invoiceId: query.invoiceId } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.customerReceiptAllocation.findMany({
      where,
      skip,
      take,
      orderBy: [{ allocationDate: 'desc' }, { allocationSequence: 'asc' }],
    }),
    prisma.customerReceiptAllocation.count({ where }),
  ])
  return { items: items.map(mapCustomerReceiptAllocationToDto), total, page, limit }
}

export async function listAllocationsByReceiptId(
  tenantId: string,
  receiptId: string,
): Promise<CustomerReceiptAllocationDto[]> {
  const rows = await prisma.customerReceiptAllocation.findMany({
    where: { tenantId, receiptId },
    orderBy: { allocationSequence: 'asc' },
  })
  return rows.map(mapCustomerReceiptAllocationToDto)
}
