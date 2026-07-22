import type { PayableOpenItem, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { formatForPersistence, roundExchangeRate } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import {
  classifyDocumentAgeBucket,
  classifyDueDateBucket,
  documentAgeFilterForBucket,
  dueDateFilterForBucket,
  isDocumentAgeBucket,
  isDueDateBucket,
  parseDateOnly,
} from './payable-ageing.service.js'
import { PayableInvalidAgeingBucketError, PayableInvalidSortFieldError } from './payable-reporting.errors.js'
import type {
  AgeingBasis,
  DocumentAgeBucket,
  DueDateBucket,
  ListOutstandingQuery,
  OutstandingOpenItemDto,
  PayableReadOnlyActions,
  PayableReportingContext,
} from './payable-reporting.types.js'
import { OUTSTANDING_ACTIVE_STATUSES as ACTIVE_STATUSES, READ_ONLY_PAYABLE_ACTIONS } from './payable-reporting.types.js'
import { CREDIT_OUTSTANDING_DOCUMENT_FILTER } from './payable-open-item-side.filters.js'

type OpenItemWithRelations = PayableOpenItem & {
  sourceVendorInvoice: {
    vendorInvoiceNumber: string | null
    supplierInvoiceNumber: string
    status: string
    documentDate: Date
    postingDate: Date | null
  } | null
  sourceVendorAdjustment: {
    vendorAdjustmentNumber: string | null
    supplierReferenceNumber: string | null
    status: string
    documentDate: Date
    postingDate: Date | null
  } | null
  accountingVoucher: { voucherNumber: string | null } | null
}

function formatDate(value: Date | null | undefined): string | null {
  if (!value) return null
  return value.toISOString().slice(0, 10)
}

export function buildOutstandingStatusFilter(includeSettled?: boolean): Prisma.PayableOpenItemWhereInput {
  if (includeSettled) {
    return {
      OR: [
        {
          outstandingAmount: { gt: 0 },
          status: { in: [...ACTIVE_STATUSES, 'SETTLED'] },
        },
        { status: 'SETTLED' },
      ],
    }
  }
  return {
    outstandingAmount: { gt: 0 },
    status: { in: ACTIVE_STATUSES },
  }
}

export function buildOutstandingWhere(
  ctx: PayableReportingContext,
  query: ListOutstandingQuery,
): Prisma.PayableOpenItemWhereInput {
  const where: Prisma.PayableOpenItemWhereInput = {
    tenantId: ctx.tenantId,
    legalEntityId: ctx.legalEntityId,
    ...CREDIT_OUTSTANDING_DOCUMENT_FILTER,
    ...buildOutstandingStatusFilter(query.includeSettled),
    ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.vendorPayableAccountId ? { vendorPayableAccountId: query.vendorPayableAccountId } : {}),
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
    where.outstandingAmount = {
      ...(typeof where.outstandingAmount === 'object' ? where.outstandingAmount : {}),
      ...(query.amountFrom ? { gte: query.amountFrom } : {}),
      ...(query.amountTo ? { lte: query.amountTo } : {}),
    }
  }

  if (query.search?.trim()) {
    const term = query.search.trim()
    where.OR = [
      { documentNumber: { contains: term } },
      { vendorNameSnapshot: { contains: term } },
      { vendorCodeSnapshot: { contains: term } },
      { sourceVendorInvoice: { supplierInvoiceNumber: { contains: term } } },
      { sourceVendorInvoice: { vendorInvoiceNumber: { contains: term } } },
      { sourceVendorAdjustment: { supplierReferenceNumber: { contains: term } } },
    ]
  }

  if (query.ageingBucket) {
    const basis: AgeingBasis = query.ageingBasis ?? 'due_date'
    if (basis === 'due_date') {
      if (!isDueDateBucket(query.ageingBucket)) {
        throw new PayableInvalidAgeingBucketError(query.ageingBucket, basis)
      }
      Object.assign(where, dueDateFilterForBucket(query.ageingBucket, ctx.reportDate))
    } else {
      if (!isDocumentAgeBucket(query.ageingBucket)) {
        throw new PayableInvalidAgeingBucketError(query.ageingBucket, basis)
      }
      const range = documentAgeFilterForBucket(query.ageingBucket, ctx.reportDate)
      where.postingDate = range.postingDate as Prisma.DateTimeFilter
    }
  }

  return where
}

function resolveOrderBy(query: ListOutstandingQuery): Prisma.PayableOpenItemOrderByWithRelationInput {
  const sortBy = query.sortBy ?? 'dueDate'
  const sortOrder = query.sortOrder ?? 'asc'
  switch (sortBy) {
    case 'dueDate':
      return { dueDate: sortOrder }
    case 'postingDate':
      return { postingDate: sortOrder }
    case 'documentDate':
      return { documentDate: sortOrder }
    case 'outstandingAmount':
      return { outstandingAmount: sortOrder }
    case 'vendorName':
      return { vendorNameSnapshot: sortOrder }
    case 'documentNumber':
      return { documentNumber: sortOrder }
    default:
      throw new PayableInvalidSortFieldError(sortBy)
  }
}

export function mapOpenItemToOutstandingDto(
  item: OpenItemWithRelations,
  reportDate: string,
  allowedActions: PayableReadOnlyActions = READ_ONLY_PAYABLE_ACTIONS,
): OutstandingOpenItemDto {
  const invoice = item.sourceVendorInvoice
  const adjustment = item.sourceVendorAdjustment
  const postingDate = formatDate(item.postingDate ?? invoice?.postingDate ?? adjustment?.postingDate ?? item.documentDate)
  const dueDate = formatDate(item.dueDate)
  const daysOverdue = dueDate ? Math.max(0, Math.floor((parseDateOnly(reportDate).getTime() - parseDateOnly(dueDate).getTime()) / 86_400_000)) : null
  const daysOutstanding = postingDate
    ? Math.max(0, Math.floor((parseDateOnly(reportDate).getTime() - parseDateOnly(postingDate).getTime()) / 86_400_000))
    : 0

  const documentStatus = invoice?.status ?? adjustment?.status ?? null
  const supplierInvoiceNumber = invoice?.supplierInvoiceNumber ?? null
  const supplierReferenceNumber = adjustment?.supplierReferenceNumber ?? null

  return {
    openItemId: item.id,
    vendorInvoiceId: item.sourceVendorInvoiceId,
    vendorAdjustmentId: item.sourceVendorAdjustmentId,
    documentType: item.documentType,
    documentNumber: invoice?.vendorInvoiceNumber ?? adjustment?.vendorAdjustmentNumber ?? item.documentNumber,
    documentStatus,
    vendorId: item.vendorId,
    vendorCode: item.vendorCodeSnapshot,
    vendorName: item.vendorNameSnapshot,
    supplierInvoiceNumber,
    supplierReferenceNumber,
    documentDate: formatDate(item.documentDate),
    postingDate,
    dueDate,
    voucherNumber: item.accountingVoucher?.voucherNumber ?? null,
    voucherId: item.accountingVoucherId,
    currencyCode: item.currencyCode,
    exchangeRate: roundExchangeRate(item.exchangeRate).toFixed(8),
    outstandingAmount: formatForPersistence(item.outstandingAmount),
    baseOutstandingAmount: formatForPersistence(item.baseOutstandingAmount),
    originalAmount: formatForPersistence(item.originalAmount),
    baseOriginalAmount: formatForPersistence(item.baseOriginalAmount),
    daysOutstanding,
    daysOverdue,
    dueDateBucket: classifyDueDateBucket(reportDate, dueDate),
    documentAgeBucket: classifyDocumentAgeBucket(reportDate, postingDate),
    status: item.status,
    isDisputed: item.status === 'DISPUTED' || item.isDisputed,
    isOnHold: item.status === 'ON_HOLD' || item.isOnHold,
    vendorPayableAccountId: item.vendorPayableAccountId,
    allowedActions,
  }
}

const openItemInclude = {
  sourceVendorInvoice: {
    select: {
      vendorInvoiceNumber: true,
      supplierInvoiceNumber: true,
      status: true,
      documentDate: true,
      postingDate: true,
    },
  },
  sourceVendorAdjustment: {
    select: {
      vendorAdjustmentNumber: true,
      supplierReferenceNumber: true,
      status: true,
      documentDate: true,
      postingDate: true,
    },
  },
  accountingVoucher: { select: { voucherNumber: true } },
} satisfies Prisma.PayableOpenItemInclude

export async function listOutstandingOpenItems(
  ctx: PayableReportingContext,
  query: ListOutstandingQuery,
): Promise<{ items: OutstandingOpenItemDto[]; total: number; page: number; pageSize: number }> {
  await getLegalEntityOrThrow(ctx.tenantId, ctx.legalEntityId)
  const page = query.page ?? 1
  const pageSize = query.pageSize ?? 20
  const { skip, take } = getPagination({ page, limit: pageSize, sortOrder: query.sortOrder ?? 'asc' })
  const where = buildOutstandingWhere(ctx, query)
  const orderBy = resolveOrderBy(query)

  const [rows, total] = await Promise.all([
    prisma.payableOpenItem.findMany({
      where,
      include: openItemInclude,
      skip,
      take,
      orderBy,
    }),
    prisma.payableOpenItem.count({ where }),
  ])

  return {
    items: rows.map((row) => mapOpenItemToOutstandingDto(row, ctx.reportDate)),
    total,
    page,
    pageSize,
  }
}

export async function findOutstandingOpenItems(
  ctx: PayableReportingContext,
  query: Pick<ListOutstandingQuery, 'includeSettled' | 'vendorId' | 'vendorPayableAccountId'>,
): Promise<OpenItemWithRelations[]> {
  const where = buildOutstandingWhere(ctx, {
    legalEntityId: ctx.legalEntityId,
    includeSettled: query.includeSettled,
    vendorId: query.vendorId,
    vendorPayableAccountId: query.vendorPayableAccountId,
  })
  return prisma.payableOpenItem.findMany({
    where,
    include: openItemInclude,
    orderBy: { dueDate: 'asc' },
  })
}

export type { OpenItemWithRelations, DueDateBucket, DocumentAgeBucket }
