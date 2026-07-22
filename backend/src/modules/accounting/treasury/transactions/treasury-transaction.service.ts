import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence } from '../../shared/finance-decimal.js'
import { getLegalEntityOrThrow } from '../../shared/finance.helpers.js'
import type { ListTreasuryTransactionsQuery } from './treasury-transaction.schemas.js'

function nextDay(date: string): Date {
  const value = new Date(date)
  value.setUTCDate(value.getUTCDate() + 1)
  return value
}

export async function listTreasuryTransactions(
  tenantId: string,
  query: ListTreasuryTransactionsQuery,
) {
  await getLegalEntityOrThrow(tenantId, query.legalEntityId)

  const treasuryAccounts = await prisma.treasuryAccount.findMany({
    where: {
      tenantId,
      legalEntityId: query.legalEntityId,
      accountType: query.accountType ?? { in: ['BANK', 'CASH'] },
      ...(query.treasuryAccountId ? { id: query.treasuryAccountId } : {}),
    },
    orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      code: true,
      name: true,
      accountType: true,
      status: true,
      glAccountId: true,
      currencyCode: true,
    },
  })

  if (treasuryAccounts.length === 0) {
    return { items: [], total: 0, page: query.page, limit: query.limit }
  }

  // One active treasury account per GL account is enforced by the account service.
  // For historical inactive mappings, keep the first deterministic mapping only.
  const accountByGlId = new Map(treasuryAccounts.map((account) => [account.glAccountId, account]))
  const glAccountIds = [...accountByGlId.keys()]

  const where: Prisma.GeneralLedgerEntryWhereInput = {
    tenantId,
    legalEntityId: query.legalEntityId,
    accountId: { in: glAccountIds },
    ...(query.dateFrom || query.dateTo
      ? {
          postingDate: {
            ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
            ...(query.dateTo ? { lt: nextDay(query.dateTo) } : {}),
          },
        }
      : {}),
    ...(query.reconciliationStatus
      ? { ledgerReconciliationPosition: { is: { status: query.reconciliationStatus } } }
      : {}),
    ...(query.search
      ? {
          OR: [
            { voucherNumber: { contains: query.search } },
            { partyNameSnapshot: { contains: query.search } },
            { sourceModule: { contains: query.search } },
            { sourceDocumentType: { contains: query.search } },
            { voucher: { referenceNumber: { contains: query.search } } },
            { voucher: { externalReference: { contains: query.search } } },
            { voucher: { narration: { contains: query.search } } },
          ],
        }
      : {}),
  }

  const skip = (query.page - 1) * query.limit
  const [entries, total] = await Promise.all([
    prisma.generalLedgerEntry.findMany({
      where,
      skip,
      take: query.limit,
      orderBy: [{ postingDate: query.sortOrder }, { createdAt: query.sortOrder }],
      include: {
        voucher: {
          select: {
            referenceNumber: true,
            externalReference: true,
            narration: true,
          },
        },
        ledgerReconciliationPosition: {
          select: {
            status: true,
            reconciledAmount: true,
            unreconciledAmount: true,
          },
        },
      },
    }),
    prisma.generalLedgerEntry.count({ where }),
  ])

  return {
    items: entries.map((entry) => {
      const treasuryAccount = accountByGlId.get(entry.accountId)!
      return {
        id: entry.id,
        postingDate: entry.postingDate.toISOString().slice(0, 10),
        documentDate: entry.documentDate.toISOString().slice(0, 10),
        voucherId: entry.voucherId,
        voucherNumber: entry.voucherNumber,
        voucherType: entry.voucherType,
        treasuryAccountId: treasuryAccount.id,
        treasuryAccountCode: treasuryAccount.code,
        treasuryAccountName: treasuryAccount.name,
        treasuryAccountType: treasuryAccount.accountType,
        currencyCode: entry.currencyCode || treasuryAccount.currencyCode,
        partyName: entry.partyNameSnapshot ?? null,
        reference:
          entry.voucher.referenceNumber ??
          entry.voucher.externalReference ??
          entry.sourceDocumentId ??
          null,
        narration: entry.voucher.narration ?? null,
        sourceModule: entry.sourceModule ?? null,
        sourceDocumentType: entry.sourceDocumentType ?? null,
        sourceDocumentId: entry.sourceDocumentId ?? null,
        debitAmount: formatForPersistence(entry.debitAmount),
        creditAmount: formatForPersistence(entry.creditAmount),
        reconciliationStatus: entry.ledgerReconciliationPosition?.status ?? null,
        reconciledAmount:
          entry.ledgerReconciliationPosition != null
            ? formatForPersistence(entry.ledgerReconciliationPosition.reconciledAmount)
            : null,
        unreconciledAmount:
          entry.ledgerReconciliationPosition != null
            ? formatForPersistence(entry.ledgerReconciliationPosition.unreconciledAmount)
            : null,
        isReversal: entry.isReversal,
      }
    }),
    total,
    page: query.page,
    limit: query.limit,
  }
}
