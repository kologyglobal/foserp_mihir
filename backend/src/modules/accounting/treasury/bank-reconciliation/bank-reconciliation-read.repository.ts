import type { BankStatement, BankStatementLine, GeneralLedgerEntry, Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { getPagination } from '../../../../utils/pagination.js'
import { BankStatementLineNotFoundError, BankStatementNotFoundError } from '../treasury.errors.js'
import type { ListExceptionsQueryInput, ListHistoryQueryInput, ListSessionsQueryInput } from './bank-reconciliation.schemas.js'
import { BankReconciliationLineNotFoundError } from './bank-reconciliation.errors.js'

export async function getStatementOrThrow(tenantId: string, statementId: string): Promise<BankStatement> {
  const statement = await prisma.bankStatement.findFirst({ where: { id: statementId, tenantId } })
  if (!statement) throw new BankStatementNotFoundError()
  return statement
}

export async function getStatementLineOrThrow(
  tenantId: string,
  statementId: string,
  lineId: string,
): Promise<BankStatementLine> {
  const line = await prisma.bankStatementLine.findFirst({ where: { id: lineId, tenantId, bankStatementId: statementId } })
  if (!line) throw new BankStatementLineNotFoundError()
  return line
}

export async function getStatementLinesByIds(
  tenantId: string,
  statementId: string,
  lineIds: string[],
): Promise<BankStatementLine[]> {
  const lines = await prisma.bankStatementLine.findMany({
    where: { id: { in: lineIds }, tenantId, bankStatementId: statementId },
  })
  if (lines.length !== new Set(lineIds).size) throw new BankReconciliationLineNotFoundError()
  return lines
}

export async function listStatementLines(
  tenantId: string,
  statementId: string,
  filter?: { matchStatus?: string },
): Promise<BankStatementLine[]> {
  return prisma.bankStatementLine.findMany({
    where: {
      tenantId,
      bankStatementId: statementId,
      ...(filter?.matchStatus ? { matchStatus: filter.matchStatus as never } : {}),
    },
    orderBy: { lineNumber: 'asc' },
  })
}

export async function getGeneralLedgerEntriesByIds(tenantId: string, ids: string[]): Promise<GeneralLedgerEntry[]> {
  return prisma.generalLedgerEntry.findMany({ where: { id: { in: ids }, tenantId } })
}

export async function getGeneralLedgerEntryOrThrow(tenantId: string, id: string): Promise<GeneralLedgerEntry> {
  const entry = await prisma.generalLedgerEntry.findFirst({ where: { id, tenantId } })
  if (!entry) throw new BankStatementLineNotFoundError('General ledger entry not found')
  return entry
}

/** Distinct clearing GL account ids reachable from a treasury account via CLEARING/SETTLEMENT payment mappings. */
export async function findClearingGlAccountIds(tenantId: string, treasuryAccountId: string): Promise<string[]> {
  const mappings = await prisma.paymentAccountMapping.findMany({
    where: {
      tenantId,
      treasuryAccountId,
      role: { in: ['CLEARING', 'SETTLEMENT'] },
      isActive: true,
      clearingAccountId: { not: null },
    },
    include: { clearingAccount: { select: { glAccountId: true } } },
  })
  const ids = new Set<string>()
  for (const m of mappings) {
    if (m.clearingAccount?.glAccountId) ids.add(m.clearingAccount.glAccountId)
  }
  return [...ids]
}

/**
 * Raw candidate GL entries (before scoring) for one statement line direction.
 * `side` is the ledger side that must be non-zero to be eligible per the direction rules:
 * statement CREDIT ⇒ side DEBIT; statement DEBIT ⇒ side CREDIT.
 */
export async function findCandidateLedgerEntries(
  tenantId: string,
  legalEntityId: string,
  accountIds: string[],
  currencyCode: string,
  side: 'DEBIT' | 'CREDIT',
  excludeGeneralLedgerEntryIds: string[] = [],
): Promise<GeneralLedgerEntry[]> {
  if (accountIds.length === 0) return []
  const where: Prisma.GeneralLedgerEntryWhereInput = {
    tenantId,
    legalEntityId,
    accountId: { in: accountIds },
    currencyCode,
    isReversal: false,
    ...(side === 'DEBIT' ? { debitAmount: { gt: 0 } } : { creditAmount: { gt: 0 } }),
    ...(excludeGeneralLedgerEntryIds.length > 0 ? { id: { notIn: excludeGeneralLedgerEntryIds } } : {}),
  }
  return prisma.generalLedgerEntry.findMany({
    where,
    orderBy: { postingDate: 'asc' },
    take: 200,
  })
}

export async function listSessions(tenantId: string, query: ListSessionsQueryInput) {
  const { skip, take } = getPagination(query)
  const where: Prisma.BankReconciliationSessionWhereInput = {
    tenantId,
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
    ...(query.status ? { status: query.status } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankReconciliationSession.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.bankReconciliationSession.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function listFinalizedSessions(tenantId: string, query: ListHistoryQueryInput) {
  const { skip, take } = getPagination(query)
  const where: Prisma.BankReconciliationSessionWhereInput = {
    tenantId,
    status: { in: ['FINALIZED', 'REOPENED'] },
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.treasuryAccountId ? { treasuryAccountId: query.treasuryAccountId } : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankReconciliationSession.findMany({ where, skip, take, orderBy: { finalizedAt: 'desc' } }),
    prisma.bankReconciliationSession.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function listExceptions(tenantId: string, query: ListExceptionsQueryInput) {
  const { skip, take } = getPagination(query)
  const where: Prisma.BankReconciliationExceptionWhereInput = {
    tenantId,
    ...(query.status ? { status: query.status } : {}),
    ...(query.legalEntityId ? { legalEntityId: query.legalEntityId } : {}),
    ...(query.treasuryAccountId
      ? { reconciliationSession: { treasuryAccountId: query.treasuryAccountId } }
      : {}),
  }
  const [items, total] = await Promise.all([
    prisma.bankReconciliationException.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.bankReconciliationException.count({ where }),
  ])
  return { items, total, page: query.page, limit: query.limit }
}

export async function countLinesByMatchStatus(tenantId: string, statementId: string) {
  const rows = await prisma.bankStatementLine.groupBy({
    by: ['matchStatus'],
    where: { tenantId, bankStatementId: statementId },
    _count: { _all: true },
  })
  const counts: Record<string, number> = {}
  for (const row of rows) counts[row.matchStatus] = row._count._all
  return counts
}
