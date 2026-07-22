import type { BankStatement, BankStatementLine, GeneralLedgerEntry } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { formatForPersistence, toDecimal } from '../../shared/finance-decimal.js'
import { getTreasuryAccount } from '../accounts/treasury-account.repository.js'
import * as readRepo from './bank-reconciliation-read.repository.js'
import type { LedgerCandidateDto, LedgerCandidatePool } from './bank-reconciliation.types.js'

/** Statement CREDIT (money in) requires a DEBIT ledger side; DEBIT requires CREDIT. Rule #1/#2. */
export function requiredLedgerSideFor(direction: BankStatementLine['direction']): 'DEBIT' | 'CREDIT' {
  return direction === 'CREDIT' ? 'DEBIT' : 'CREDIT'
}

async function getUnreconciledAmounts(tenantId: string, entryIds: string[]): Promise<Map<string, ReturnType<typeof toDecimal>>> {
  const positions = await prisma.bankLedgerReconciliationPosition.findMany({
    where: { tenantId, generalLedgerEntryId: { in: entryIds } },
  })
  const map = new Map<string, ReturnType<typeof toDecimal>>()
  for (const p of positions) map.set(p.generalLedgerEntryId, toDecimal(p.unreconciledAmount))
  return map
}

function toCandidateDto(
  entry: GeneralLedgerEntry & { voucher: { voucherNumber: string | null; voucherType: string; narration: string | null } },
  pool: LedgerCandidatePool,
  side: 'DEBIT' | 'CREDIT',
  unreconciledAmount: ReturnType<typeof toDecimal>,
): LedgerCandidateDto {
  const originalAmount = side === 'DEBIT' ? entry.debitAmount : entry.creditAmount
  return {
    generalLedgerEntryId: entry.id,
    accountingVoucherId: entry.voucherId,
    accountId: entry.accountId,
    pool,
    matchSource: pool === 'DIRECT_BANK_GL' ? 'DIRECT_BANK_GL' : 'CLEARING_GL',
    sourceDocumentType: entry.sourceDocumentType ?? null,
    sourceDocumentId: entry.sourceDocumentId ?? null,
    sourceDocumentNumber: entry.voucher.voucherNumber ?? null,
    voucherNumber: entry.voucher.voucherNumber ?? '',
    voucherType: entry.voucher.voucherType,
    postingDate: entry.postingDate.toISOString().slice(0, 10),
    documentDate: entry.documentDate.toISOString().slice(0, 10),
    currencyCode: entry.currencyCode,
    side,
    originalAmount: formatForPersistence(originalAmount),
    unreconciledAmount: formatForPersistence(unreconciledAmount),
    referenceNumber: null,
    narration: entry.voucher.narration ?? null,
    partyType: entry.partyType ?? null,
    partyId: entry.partyId ?? null,
    partyNameSnapshot: entry.partyNameSnapshot ?? null,
  }
}

/** Eligible bank/clearing GL candidates for one statement line, split by pool, unreconciled amount > 0 only. */
export async function findCandidatesForLine(
  tenantId: string,
  statement: BankStatement,
  line: BankStatementLine,
): Promise<{ direct: LedgerCandidateDto[]; clearing: LedgerCandidateDto[] }> {
  const treasuryAccount = await getTreasuryAccount(tenantId, statement.treasuryAccountId)
  const side = requiredLedgerSideFor(line.direction)

  const [directEntries, clearingGlAccountIds] = await Promise.all([
    readRepo.findCandidateLedgerEntries(tenantId, statement.legalEntityId, [treasuryAccount.glAccountId], statement.currencyCode, side),
    readRepo.findClearingGlAccountIds(tenantId, statement.treasuryAccountId),
  ])
  const clearingEntries =
    clearingGlAccountIds.length > 0
      ? await readRepo.findCandidateLedgerEntries(tenantId, statement.legalEntityId, clearingGlAccountIds, statement.currencyCode, side)
      : []

  const allIds = [...directEntries, ...clearingEntries].map((e) => e.id)
  const unreconciledMap = await getUnreconciledAmounts(tenantId, allIds)

  const withVouchers = async (entries: GeneralLedgerEntry[]) => {
    const voucherIds = [...new Set(entries.map((e) => e.voucherId))]
    const vouchers = await prisma.accountingVoucher.findMany({
      where: { id: { in: voucherIds }, tenantId },
      select: { id: true, voucherNumber: true, voucherType: true, narration: true },
    })
    const voucherMap = new Map(vouchers.map((v) => [v.id, v]))
    return entries.map((e) => ({ ...e, voucher: voucherMap.get(e.voucherId) ?? { voucherNumber: null, voucherType: e.voucherType, narration: null } }))
  }

  const [directWithVouchers, clearingWithVouchers] = await Promise.all([withVouchers(directEntries), withVouchers(clearingEntries)])

  const direct = directWithVouchers
    .map((e) => toCandidateDto(e, 'DIRECT_BANK_GL', side, unreconciledMap.get(e.id) ?? toDecimal(side === 'DEBIT' ? e.debitAmount : e.creditAmount)))
    .filter((c) => toDecimal(c.unreconciledAmount).gt(0))

  const clearing = clearingWithVouchers
    .map((e) => toCandidateDto(e, 'CLEARING_GL', side, unreconciledMap.get(e.id) ?? toDecimal(side === 'DEBIT' ? e.debitAmount : e.creditAmount)))
    .filter((c) => toDecimal(c.unreconciledAmount).gt(0))

  return { direct, clearing }
}
