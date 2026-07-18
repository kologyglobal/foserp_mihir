import type { CustomerCreditNoteAllocation, Prisma } from '@prisma/client'
import { prisma } from '../../../../../config/database.js'
import { getPagination } from '../../../../../utils/pagination.js'
import { formatForPersistence, roundExchangeRate } from '../../../shared/finance-decimal.js'
import { hashPayload } from '../../../shared/payload-hash.js'
import type {
  AllocateCustomerCreditNoteInput,
  CustomerCreditNoteAllocationDto,
  ListCreditNoteAllocationsQuery,
} from './customer-credit-note-allocation.types.js'

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function buildCreditNoteAllocationPayloadHash(input: {
  allocationDate: string
  allocations: AllocateCustomerCreditNoteInput['allocations']
}): string {
  return hashPayload({
    allocationDate: input.allocationDate,
    allocations: input.allocations.map((a) => ({
      invoiceId: a.invoiceId,
      invoiceOpenItemId: a.invoiceOpenItemId,
      allocationAmount: a.allocationAmount,
    })),
  })
}

export function mapCustomerCreditNoteAllocationToDto(
  allocation: CustomerCreditNoteAllocation,
): CustomerCreditNoteAllocationDto {
  return {
    id: allocation.id,
    tenantId: allocation.tenantId,
    legalEntityId: allocation.legalEntityId,
    customerId: allocation.customerId,
    batchId: allocation.batchId,
    creditNoteId: allocation.creditNoteId,
    creditNoteOpenItemId: allocation.creditNoteOpenItemId,
    invoiceId: allocation.invoiceId,
    invoiceOpenItemId: allocation.invoiceOpenItemId,
    allocationDate: formatDate(allocation.allocationDate)!,
    postingDate: formatDate(allocation.postingDate),
    currencyCode: allocation.currencyCode,
    exchangeRate: roundExchangeRate(allocation.exchangeRate).toFixed(8),
    allocatedAmount: formatForPersistence(allocation.allocatedAmount),
    baseAllocatedAmount: formatForPersistence(allocation.baseAllocatedAmount),
    invoiceOutstandingBefore:
      allocation.invoiceOutstandingBefore != null
        ? formatForPersistence(allocation.invoiceOutstandingBefore)
        : null,
    invoiceOutstandingAfter:
      allocation.invoiceOutstandingAfter != null
        ? formatForPersistence(allocation.invoiceOutstandingAfter)
        : null,
    baseInvoiceOutstandingBefore:
      allocation.baseInvoiceOutstandingBefore != null
        ? formatForPersistence(allocation.baseInvoiceOutstandingBefore)
        : null,
    baseInvoiceOutstandingAfter:
      allocation.baseInvoiceOutstandingAfter != null
        ? formatForPersistence(allocation.baseInvoiceOutstandingAfter)
        : null,
    status: allocation.status,
    allocationSequence: allocation.allocationSequence,
    createdBy: allocation.createdBy,
    createdAt: allocation.createdAt.toISOString(),
    reversedAt: allocation.reversedAt?.toISOString() ?? null,
    reversedBy: allocation.reversedBy,
    reversalReason: allocation.reversalReason,
  }
}

export async function listCreditNoteAllocationsByBatchId(
  tenantId: string,
  batchId: string,
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerCreditNoteAllocation[]> {
  return tx.customerCreditNoteAllocation.findMany({
    where: { tenantId, batchId },
    orderBy: { allocationSequence: 'asc' },
  })
}

export async function listCreditNoteAllocationHistory(
  tenantId: string,
  creditNoteId: string,
  query: ListCreditNoteAllocationsQuery = {},
) {
  const pageSize = query.pageSize ?? query.limit ?? 50
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: pageSize,
    sortOrder: 'desc',
  })
  const where: Prisma.CustomerCreditNoteAllocationWhereInput = { tenantId, creditNoteId, status: 'POSTED' }
  const [rows, total] = await Promise.all([
    prisma.customerCreditNoteAllocation.findMany({
      where,
      skip,
      take,
      orderBy: [{ allocationDate: 'desc' }, { allocationSequence: 'asc' }],
      include: { invoice: { select: { invoiceNumber: true } } },
    }),
    prisma.customerCreditNoteAllocation.count({ where }),
  ])
  return { rows, total, page, pageSize: limit }
}

export async function listInvoiceCreditNoteAllocationHistory(
  tenantId: string,
  invoiceId: string,
  query: { page?: number; pageSize?: number; limit?: number } = {},
) {
  const pageSize = query.pageSize ?? query.limit ?? 50
  const { skip, take, page, limit } = getPagination({
    page: query.page ?? 1,
    limit: pageSize,
    sortOrder: 'desc',
  })
  const where: Prisma.CustomerCreditNoteAllocationWhereInput = { tenantId, invoiceId, status: 'POSTED' }
  const [rows, total] = await Promise.all([
    prisma.customerCreditNoteAllocation.findMany({
      where,
      skip,
      take,
      orderBy: [{ allocationDate: 'desc' }, { allocationSequence: 'asc' }],
      include: {
        creditNote: { select: { creditNoteNumber: true, creditNoteDate: true, customerNameSnapshot: true } },
      },
    }),
    prisma.customerCreditNoteAllocation.count({ where }),
  ])
  return { rows, total, page, pageSize: limit }
}

export interface CreateCreditNoteAllocationRowInput {
  tenantId: string
  legalEntityId: string
  customerId: string
  batchId: string
  creditNoteId: string
  creditNoteOpenItemId: string
  invoiceId: string
  invoiceOpenItemId: string
  allocationDate: Date
  postingDate?: Date | null
  currencyCode: string
  exchangeRate: Prisma.Decimal | string
  allocatedAmount: Prisma.Decimal | string
  baseAllocatedAmount: Prisma.Decimal | string
  invoiceOutstandingBefore: Prisma.Decimal | string
  invoiceOutstandingAfter: Prisma.Decimal | string
  baseInvoiceOutstandingBefore: Prisma.Decimal | string
  baseInvoiceOutstandingAfter: Prisma.Decimal | string
  allocationSequence: number
  createdBy?: string | null
}

export async function createCreditNoteAllocationRows(
  rows: CreateCreditNoteAllocationRowInput[],
  tx: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<CustomerCreditNoteAllocation[]> {
  const created: CustomerCreditNoteAllocation[] = []
  for (const row of rows) {
    const item = await tx.customerCreditNoteAllocation.create({
      data: {
        tenantId: row.tenantId,
        legalEntityId: row.legalEntityId,
        customerId: row.customerId,
        batchId: row.batchId,
        creditNoteId: row.creditNoteId,
        creditNoteOpenItemId: row.creditNoteOpenItemId,
        invoiceId: row.invoiceId,
        invoiceOpenItemId: row.invoiceOpenItemId,
        allocationDate: row.allocationDate,
        postingDate: row.postingDate ?? null,
        currencyCode: row.currencyCode,
        exchangeRate: row.exchangeRate,
        allocatedAmount: row.allocatedAmount,
        baseAllocatedAmount: row.baseAllocatedAmount,
        invoiceOutstandingBefore: row.invoiceOutstandingBefore,
        invoiceOutstandingAfter: row.invoiceOutstandingAfter,
        baseInvoiceOutstandingBefore: row.baseInvoiceOutstandingBefore,
        baseInvoiceOutstandingAfter: row.baseInvoiceOutstandingAfter,
        status: 'POSTED',
        allocationSequence: row.allocationSequence,
        createdBy: row.createdBy ?? null,
      },
    })
    created.push(item)
  }
  return created
}

export async function countOrphanPostedCreditNoteAllocations(tenantId: string, legalEntityId: string): Promise<number> {
  return prisma.customerCreditNoteAllocation.count({
    where: {
      tenantId,
      legalEntityId,
      status: 'POSTED',
      OR: [{ batchId: null }, { batch: { is: null } }, { batch: { status: { not: 'POSTED' } } }],
    },
  })
}
