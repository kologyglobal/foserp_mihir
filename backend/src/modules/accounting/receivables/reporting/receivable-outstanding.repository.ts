import type { Prisma, ReceivableOpenItem } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { formatForPersistence, roundExchangeRate, toDecimal } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import {
  classifyDueDateBucket,
  classifyInvoiceAgeBucket,
  dueDateFilterForBucket,
  invoiceAgeFilterForBucket,
  isDueDateBucket,
  isInvoiceAgeBucket,
  parseDateOnly,
} from './receivable-ageing.service.js'
import { ReceivableInvalidAgeingBucketError, ReceivableInvalidSortFieldError } from './receivable-reporting.errors.js'
import type {
  AgeingBasis,
  DueDateBucket,
  InvoiceAgeBucket,
  ListOutstandingQuery,
  OutstandingOpenItemDto,
  ReceivableReadOnlyActions,
  ReceivableReportingContext,
} from './receivable-reporting.types.js'
import { OUTSTANDING_ACTIVE_STATUSES as ACTIVE_STATUSES, READ_ONLY_RECEIVABLE_ACTIONS } from './receivable-reporting.types.js'
import { DEBIT_OPEN_ITEM_SIDE_FILTER } from '../receipts/receivable-open-item-side.validators.js'

type OpenItemWithRelations = ReceivableOpenItem & {
  salesInvoice: {
    invoiceNumber: string | null
    status: string
    customerCodeSnapshot: string | null
    referenceNumber: string | null
    customerPoNumber: string | null
    invoiceDate: Date
    postingDate: Date | null
  } | null
  accountingVoucher: { voucherNumber: string | null } | null
}

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function buildOutstandingStatusFilter(includeSettled?: boolean): Prisma.ReceivableOpenItemWhereInput {
  if (includeSettled) {
    return {
      OR: [
        {
          openAmount: { gt: 0 },
          status: { in: [...ACTIVE_STATUSES, 'SETTLED'] },
        },
        { status: 'SETTLED' },
      ],
    }
  }
  return {
    openAmount: { gt: 0 },
    status: { in: ACTIVE_STATUSES },
  }
}

export function buildOutstandingWhere(
  ctx: ReceivableReportingContext,
  query: ListOutstandingQuery,
): Prisma.ReceivableOpenItemWhereInput {
  const where: Prisma.ReceivableOpenItemWhereInput = {
    tenantId: ctx.tenantId,
    legalEntityId: ctx.legalEntityId,
    ...DEBIT_OPEN_ITEM_SIDE_FILTER,
    ...buildOutstandingStatusFilter(query.includeSettled),
    ...(query.customerId ? { customerId: query.customerId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.receivableAccountId ? { receivableAccountId: query.receivableAccountId } : {}),
    ...(query.currencyCode ? { currencyCode: query.currencyCode } : {}),
    ...(query.dueDateFrom || query.dueDateTo
      ? {
          dueDate: {
            ...(query.dueDateFrom ? { gte: parseDateOnly(query.dueDateFrom) } : {}),
            ...(query.dueDateTo ? { lte: parseDateOnly(query.dueDateTo) } : {}),
          },
        }
      : {}),
  }

  if (query.amountFrom || query.amountTo) {
    where.openAmount = {
      ...(typeof where.openAmount === 'object' ? where.openAmount : {}),
      ...(query.amountFrom ? { gte: query.amountFrom } : {}),
      ...(query.amountTo ? { lte: query.amountTo } : {}),
    }
  }

  if (query.search?.trim()) {
    const term = query.search.trim()
    where.OR = [
      { documentNumberSnapshot: { contains: term } },
      { customerNameSnapshot: { contains: term } },
      { salesInvoice: { referenceNumber: { contains: term } } },
      { salesInvoice: { customerPoNumber: { contains: term } } },
      { salesInvoice: { invoiceNumber: { contains: term } } },
    ]
  }

  if (query.ageingBucket) {
    const basis: AgeingBasis = query.ageingBasis ?? 'due_date'
    if (basis === 'due_date') {
      if (!isDueDateBucket(query.ageingBucket)) {
        throw new ReceivableInvalidAgeingBucketError(query.ageingBucket, basis)
      }
      Object.assign(where, dueDateFilterForBucket(query.ageingBucket, ctx.reportDate))
    } else {
      if (!isInvoiceAgeBucket(query.ageingBucket)) {
        throw new ReceivableInvalidAgeingBucketError(query.ageingBucket, basis)
      }
      const range = invoiceAgeFilterForBucket(query.ageingBucket, ctx.reportDate)
      where.salesInvoice = {
        OR: [
          { postingDate: range.postingDate as Prisma.DateTimeNullableFilter },
          { postingDate: null, invoiceDate: range.invoiceDate as Prisma.DateTimeFilter },
        ],
      }
    }
  }

  return where
}

function resolveOrderBy(query: ListOutstandingQuery): Prisma.ReceivableOpenItemOrderByWithRelationInput {
  const sortBy = query.sortBy ?? 'dueDate'
  const sortOrder = query.sortOrder ?? 'asc'
  switch (sortBy) {
    case 'dueDate':
      return { dueDate: sortOrder }
    case 'postingDate':
      return { salesInvoice: { postingDate: sortOrder } }
    case 'invoiceDate':
      return { salesInvoice: { invoiceDate: sortOrder } }
    case 'outstandingAmount':
      return { openAmount: sortOrder }
    case 'customerName':
      return { customerNameSnapshot: sortOrder }
    case 'invoiceNumber':
      return { documentNumberSnapshot: sortOrder }
    default:
      throw new ReceivableInvalidSortFieldError(sortBy)
  }
}

export function mapOpenItemToOutstandingDto(
  item: OpenItemWithRelations,
  reportDate: string,
  allowedActions: ReceivableReadOnlyActions = READ_ONLY_RECEIVABLE_ACTIONS,
): OutstandingOpenItemDto {
  const invoice = item.salesInvoice
  const postingDate = formatDate(invoice?.postingDate ?? invoice?.invoiceDate ?? item.documentDate)
  const dueDate = formatDate(item.dueDate)
  const daysOverdue = dueDate ? Math.max(0, Math.floor((parseDateOnly(reportDate).getTime() - parseDateOnly(dueDate).getTime()) / 86_400_000)) : null
  const daysOutstanding = postingDate
    ? Math.max(0, Math.floor((parseDateOnly(reportDate).getTime() - parseDateOnly(postingDate).getTime()) / 86_400_000))
    : 0

  return {
    openItemId: item.id,
    salesInvoiceId: item.salesInvoiceId,
    invoiceNumber: invoice?.invoiceNumber ?? item.documentNumberSnapshot,
    invoiceStatus: invoice?.status ?? null,
    customerId: item.customerId,
    customerCode: invoice?.customerCodeSnapshot ?? null,
    customerName: item.customerNameSnapshot,
    referenceNumber: invoice?.referenceNumber ?? null,
    customerPoNumber: invoice?.customerPoNumber ?? null,
    invoiceDate: formatDate(invoice?.invoiceDate ?? item.documentDate),
    postingDate,
    dueDate,
    voucherNumber: item.accountingVoucher?.voucherNumber ?? null,
    voucherId: item.accountingVoucherId,
    currencyCode: item.currencyCode,
    exchangeRate: roundExchangeRate(item.exchangeRate).toFixed(8),
    outstandingAmount: formatForPersistence(item.openAmount),
    baseOutstandingAmount: formatForPersistence(item.baseOpenAmount),
    originalAmount: formatForPersistence(item.originalAmount),
    baseOriginalAmount: formatForPersistence(item.baseOriginalAmount),
    daysOutstanding,
    daysOverdue,
    dueDateBucket: classifyDueDateBucket(reportDate, dueDate),
    invoiceAgeBucket: classifyInvoiceAgeBucket(reportDate, postingDate),
    status: item.status,
    isDisputed: item.status === 'DISPUTED',
    isOnHold: item.status === 'ON_HOLD',
    receivableAccountId: item.receivableAccountId,
    allowedActions,
  }
}

const openItemInclude = {
  salesInvoice: {
    select: {
      invoiceNumber: true,
      status: true,
      customerCodeSnapshot: true,
      referenceNumber: true,
      customerPoNumber: true,
      invoiceDate: true,
      postingDate: true,
    },
  },
  accountingVoucher: { select: { voucherNumber: true } },
} satisfies Prisma.ReceivableOpenItemInclude

export async function listOutstandingOpenItems(
  ctx: ReceivableReportingContext,
  query: ListOutstandingQuery,
): Promise<{ items: OutstandingOpenItemDto[]; total: number; page: number; pageSize: number }> {
  await getLegalEntityOrThrow(ctx.tenantId, ctx.legalEntityId)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const { skip, take } = getPagination({ page, limit: pageSize, sortOrder: query.sortOrder ?? 'asc' })
  const where = buildOutstandingWhere(ctx, query)
  const orderBy = resolveOrderBy(query)

  const [rows, total] = await Promise.all([
    prisma.receivableOpenItem.findMany({
      where,
      include: openItemInclude,
      skip,
      take,
      orderBy,
    }),
    prisma.receivableOpenItem.count({ where }),
  ])

  return {
    items: rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate)),
    total,
    page,
    pageSize,
  }
}

export async function findOutstandingOpenItems(
  ctx: ReceivableReportingContext,
  query: Pick<ListOutstandingQuery, 'includeSettled' | 'customerId' | 'receivableAccountId'>,
): Promise<OpenItemWithRelations[]> {
  const where = buildOutstandingWhere(ctx, {
    legalEntityId: ctx.legalEntityId,
    includeSettled: query.includeSettled,
    customerId: query.customerId,
    receivableAccountId: query.receivableAccountId,
  })
  return prisma.receivableOpenItem.findMany({
    where,
    include: openItemInclude,
    orderBy: { dueDate: 'asc' },
  })
}

export async function aggregateSubledgerByAccount(
  ctx: ReceivableReportingContext,
  includeSettled?: boolean,
): Promise<Map<string, import('@prisma/client/runtime/library').Decimal>> {
  const statusFilter = buildOutstandingStatusFilter(includeSettled)
  const baseWhere = {
    tenantId: ctx.tenantId,
    legalEntityId: ctx.legalEntityId,
    receivableAccountId: { not: null },
    ...statusFilter,
  } as const

  const [debitGroups, creditGroups] = await Promise.all([
    prisma.receivableOpenItem.groupBy({
      by: ['receivableAccountId'],
      where: { ...baseWhere, ...DEBIT_OPEN_ITEM_SIDE_FILTER },
      _sum: { baseOpenAmount: true },
    }),
    prisma.receivableOpenItem.groupBy({
      by: ['receivableAccountId'],
      where: { ...baseWhere, side: 'CREDIT' },
      _sum: { baseOpenAmount: true },
    }),
  ])

  const map = new Map<string, import('@prisma/client/runtime/library').Decimal>()
  for (const row of debitGroups) {
    if (row.receivableAccountId && row._sum.baseOpenAmount) {
      map.set(row.receivableAccountId, row._sum.baseOpenAmount)
    }
  }
  for (const row of creditGroups) {
    if (!row.receivableAccountId || !row._sum.baseOpenAmount) continue
    const current = map.get(row.receivableAccountId) ?? toDecimal(0)
    map.set(row.receivableAccountId, current.sub(row._sum.baseOpenAmount))
  }
  return map
}

export type { OpenItemWithRelations, DueDateBucket, InvoiceAgeBucket }
