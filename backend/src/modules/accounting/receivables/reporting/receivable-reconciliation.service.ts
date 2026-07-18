import { prisma } from '../../../../config/database.js'
import { compare, formatForPersistence, subtract, sumDecimals, toDecimal } from '../../shared/finance-decimal.js'
import { compareDateOnly } from './receivable-ageing.service.js'
import {
  aggregateSubledgerByAccount,
  buildOutstandingStatusFilter,
} from './receivable-outstanding.repository.js'
import { DEBIT_OPEN_ITEM_SIDE_FILTER } from '../receipts/receivable-open-item-side.validators.js'
import { resolveReceivableReportingContext } from './receivable-reporting-context.service.js'
import { ArHistoricalAsOfNotSupportedError } from './receivable-reporting.errors.js'
import type {
  ReceivableReconciliationDto,
  ReconciliationException,
  ReconciliationQuery,
  ReconciliationStatus,
} from './receivable-reporting.types.js'

async function getReconciliationTolerance(tenantId: string, legalEntityId: string): Promise<string> {
  const settings = await prisma.financeSettings.findFirst({ where: { tenantId, legalEntityId } })
  return formatForPersistence(settings?.roundingTolerance ?? '0.0100')
}

async function aggregateGlBalancesByAccount(
  tenantId: string,
  legalEntityId: string,
): Promise<Map<string, import('@prisma/client/runtime/library').Decimal>> {
  const rows = await prisma.generalLedgerEntry.groupBy({
    by: ['accountId'],
    where: { tenantId, legalEntityId },
    _sum: { baseDebitAmount: true, baseCreditAmount: true },
  })
  const map = new Map<string, import('@prisma/client/runtime/library').Decimal>()
  for (const row of rows) {
    const debit = row._sum.baseDebitAmount ?? toDecimal(0)
    const credit = row._sum.baseCreditAmount ?? toDecimal(0)
    map.set(row.accountId, debit.sub(credit))
  }
  return map
}

async function findReconciliationExceptions(
  tenantId: string,
  legalEntityId: string,
  includeSettled?: boolean,
): Promise<ReconciliationException[]> {
  const exceptions: ReconciliationException[] = []
  const statusFilter = buildOutstandingStatusFilter(includeSettled)

  const postedWithoutOpenItem = await prisma.salesInvoice.findMany({
    where: { tenantId, legalEntityId, status: 'POSTED', receivableOpenItems: { none: {} } },
    select: { id: true, invoiceNumber: true },
    take: 50,
  })
  for (const invoice of postedWithoutOpenItem) {
    exceptions.push({
      code: 'POSTED_INVOICE_WITHOUT_OPEN_ITEM',
      message: `Posted invoice ${invoice.invoiceNumber ?? invoice.id} has no receivable open item`,
      salesInvoiceId: invoice.id,
    })
  }

  const openItemsWithoutVoucher = await prisma.receivableOpenItem.findMany({
    where: { tenantId, legalEntityId, ...DEBIT_OPEN_ITEM_SIDE_FILTER, ...statusFilter, accountingVoucherId: null },
    select: { id: true, documentNumberSnapshot: true, receivableAccountId: true },
    take: 50,
  })
  for (const item of openItemsWithoutVoucher) {
    exceptions.push({
      code: 'OPEN_ITEM_WITHOUT_VOUCHER',
      message: `Open item ${item.documentNumberSnapshot ?? item.id} has no accounting voucher`,
      openItemId: item.id,
      receivableAccountId: item.receivableAccountId ?? undefined,
    })
  }

  const openItemsWithVoucher = await prisma.receivableOpenItem.findMany({
    where: {
      tenantId,
      legalEntityId,
      ...DEBIT_OPEN_ITEM_SIDE_FILTER,
      ...statusFilter,
      accountingVoucherId: { not: null },
      receivableAccountId: { not: null },
    },
    select: {
      id: true,
      baseOpenAmount: true,
      receivableAccountId: true,
      accountingVoucherId: true,
      documentNumberSnapshot: true,
    },
    take: 200,
  })

  for (const item of openItemsWithVoucher) {
    if (!item.accountingVoucherId || !item.receivableAccountId) continue
    const glDebit = await prisma.generalLedgerEntry.aggregate({
      where: {
        tenantId,
        legalEntityId,
        voucherId: item.accountingVoucherId,
        accountId: item.receivableAccountId,
      },
      _sum: { baseDebitAmount: true },
    })
    const debitTotal = glDebit._sum.baseDebitAmount ?? toDecimal(0)
    if (compare(debitTotal, item.baseOpenAmount) !== 0) {
      exceptions.push({
        code: 'OPEN_ITEM_GL_AMOUNT_MISMATCH',
        message: `Open item ${item.documentNumberSnapshot ?? item.id} base amount does not match receivable GL debit on voucher`,
        openItemId: item.id,
        voucherId: item.accountingVoucherId,
        receivableAccountId: item.receivableAccountId,
        details: {
          openItemBaseAmount: formatForPersistence(item.baseOpenAmount),
          glDebitAmount: formatForPersistence(debitTotal),
        },
      })
    }
  }

  const receivableAccounts = await prisma.account.findMany({
    where: { tenantId, legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
    select: { id: true },
  })
  const receivableAccountIds = receivableAccounts.map((a) => a.id)
  if (receivableAccountIds.length > 0) {
    const manualGl = await prisma.generalLedgerEntry.findMany({
      where: {
        tenantId,
        legalEntityId,
        accountId: { in: receivableAccountIds },
        OR: [{ sourceDocumentType: { not: 'SALES_INVOICE' } }, { sourceDocumentType: null }],
      },
      select: { id: true, accountId: true, voucherId: true, sourceModule: true, sourceDocumentType: true },
      take: 50,
    })
    for (const entry of manualGl) {
      exceptions.push({
        code: 'CONTROL_ACCOUNT_MANUAL_POSTING',
        message: `Receivable control account has non-sales-invoice GL posting (${entry.sourceModule ?? 'null'}/${entry.sourceDocumentType ?? 'null'})`,
        receivableAccountId: entry.accountId,
        voucherId: entry.voucherId,
      })
    }
  }

  return exceptions
}

export async function getReceivableReconciliation(
  tenantId: string,
  query: ReconciliationQuery,
): Promise<ReceivableReconciliationDto> {
  const ctx = await resolveReceivableReportingContext(tenantId, query.legalEntityId, query.asOfDate)
  if (compareDateOnly(ctx.reportDate, ctx.today) !== 0) {
    throw new ArHistoricalAsOfNotSupportedError(ctx.reportDate, ctx.today)
  }

  const tolerance = await getReconciliationTolerance(tenantId, query.legalEntityId)
  const toleranceDecimal = toDecimal(tolerance)
  const [subledgerMap, glMap, receivableAccounts, exceptions] = await Promise.all([
    aggregateSubledgerByAccount(ctx, query.includeSettled),
    aggregateGlBalancesByAccount(tenantId, query.legalEntityId),
    prisma.account.findMany({
      where: { tenantId, legalEntityId: query.legalEntityId, accountType: 'CUSTOMER_RECEIVABLE', isGroup: false },
      select: { id: true, accountCode: true, accountName: true },
    }),
    findReconciliationExceptions(tenantId, query.legalEntityId, query.includeSettled),
  ])

  const accountIds = new Set<string>([
    ...receivableAccounts.map((a) => a.id),
    ...subledgerMap.keys(),
    ...[...glMap.keys()].filter((id) => receivableAccounts.some((a) => a.id === id)),
  ])

  const accounts = [...accountIds].map((accountId) => {
    const meta = receivableAccounts.find((a) => a.id === accountId)
    const subledgerBalance = subledgerMap.get(accountId) ?? toDecimal(0)
    const glBalance = glMap.get(accountId) ?? toDecimal(0)
    const variance = subtract(subledgerBalance, glBalance)
    const matched =
      variance.abs().lte(toleranceDecimal) || (subledgerBalance.isZero() && glBalance.isZero())
    return {
      receivableAccountId: accountId,
      accountCode: meta?.accountCode ?? null,
      accountName: meta?.accountName ?? null,
      subledgerBalance: formatForPersistence(subledgerBalance),
      glBalance: formatForPersistence(glBalance),
      variance: formatForPersistence(variance),
      matched,
    }
  })

  const subledgerTotal = formatForPersistence(sumDecimals([...subledgerMap.values()].map((v) => v.toString())))
  const glTotal = formatForPersistence(
    sumDecimals(
      receivableAccounts.map((a) => (glMap.get(a.id) ?? toDecimal(0)).toString()),
    ),
  )
  const variance = formatForPersistence(subtract(subledgerTotal, glTotal))

  let status: ReconciliationStatus = 'MATCHED'
  if (exceptions.some((e) => e.code === 'POSTED_INVOICE_WITHOUT_OPEN_ITEM' || e.code === 'OPEN_ITEM_WITHOUT_VOUCHER')) {
    status = 'DATA_INCOMPLETE'
  } else if (!accounts.every((a) => a.matched) || exceptions.length > 0) {
    status = 'MISMATCH'
  }
  if (toDecimal(variance).abs().gt(toleranceDecimal)) {
    status = status === 'DATA_INCOMPLETE' ? 'DATA_INCOMPLETE' : 'MISMATCH'
  }

  return {
    asOfDate: ctx.reportDate,
    legalEntityId: query.legalEntityId,
    status,
    tolerance,
    subledgerTotal,
    glTotal,
    variance,
    accounts: accounts.sort((a, b) => (a.accountCode ?? '').localeCompare(b.accountCode ?? '')),
    exceptions,
  }
}
