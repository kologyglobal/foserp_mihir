import { prisma } from '../../../config/prisma.js'
import * as glRepo from '../ledger/general-ledger.repository.js'
import * as lineRepo from '../ledger/accounting-voucher-line.repository.js'
import * as voucherRepo from '../ledger/accounting-voucher.repository.js'
import * as postingEventRepo from '../ledger/posting-event.repository.js'

function dateOnly(value: Date | string | null | undefined): string | null {
  if (!value) return null
  if (typeof value === 'string') return value.slice(0, 10)
  return value.toISOString().slice(0, 10)
}

function decimalString(value: { toString(): string } | null | undefined): string {
  if (value == null) return '0'
  return value.toString()
}

export async function getPostingEvent(tenantId: string, id: string) {
  return postingEventRepo.findByIdOrThrow(tenantId, id)
}

export async function getVoucher(tenantId: string, id: string) {
  const voucher = await voucherRepo.findByIdOrThrow(tenantId, id)
  const lines = await lineRepo.findByVoucherId(tenantId, id)
  return { ...voucher, lines }
}

/** Raw posted GL rows (no account join). Prefer for internal callers. */
export async function getVoucherLedgerRaw(tenantId: string, id: string) {
  await voucherRepo.findByIdOrThrow(tenantId, id)
  return glRepo.findByVoucherId(tenantId, id)
}

/**
 * Posted GL lines + voucher header for Money-in/out "View Accounting" drill-through.
 */
export async function getVoucherLedger(tenantId: string, id: string) {
  const voucher = await voucherRepo.findByIdOrThrow(tenantId, id)
  const entries = await prisma.generalLedgerEntry.findMany({
    where: { tenantId, voucherId: id },
    orderBy: [{ lineNumber: 'asc' }],
    include: {
      account: {
        select: {
          id: true,
          accountCode: true,
          accountName: true,
          category: true,
          accountType: true,
          isGroup: true,
          normalBalance: true,
          isControlAccount: true,
        },
      },
    },
  })

  return {
    voucher: {
      id: voucher.id,
      voucherNumber: voucher.voucherNumber,
      voucherType: voucher.voucherType,
      status: voucher.status,
      documentDate: dateOnly(voucher.documentDate),
      postingDate: dateOnly(voucher.postingDate),
      referenceNumber: voucher.referenceNumber,
      externalReference: voucher.externalReference,
      narration: voucher.narration,
      currencyCode: voucher.currencyCode,
      exchangeRate: decimalString(voucher.exchangeRate),
      sourceModule: voucher.sourceModule,
      sourceDocumentType: voucher.sourceDocumentType,
      sourceDocumentId: voucher.sourceDocumentId,
      reversalOfVoucherId: voucher.reversalOfVoucherId,
      reversedByVoucherId: voucher.reversedByVoucherId,
      reversalReason: voucher.reversalReason,
      postedAt: voucher.postedAt?.toISOString() ?? null,
      postedBy: voucher.postedBy,
      totalDebit: decimalString(voucher.totalDebit),
      totalCredit: decimalString(voucher.totalCredit),
    },
    entries: entries.map((e) => ({
      id: e.id,
      voucherId: e.voucherId,
      voucherLineId: e.voucherLineId,
      voucherType: e.voucherType,
      voucherNumber: e.voucherNumber,
      lineNumber: e.lineNumber,
      postingDate: dateOnly(e.postingDate),
      documentDate: dateOnly(e.documentDate),
      accountId: e.accountId,
      account: e.account
        ? {
            id: e.account.id,
            code: e.account.accountCode,
            name: e.account.accountName,
            category: e.account.category,
            accountType: e.account.accountType,
            isGroup: e.account.isGroup,
            normalBalance: e.account.normalBalance,
            isControlAccount: e.account.isControlAccount,
          }
        : null,
      partyType: e.partyType,
      partyId: e.partyId,
      partyNameSnapshot: e.partyNameSnapshot,
      debitAmount: decimalString(e.debitAmount),
      creditAmount: decimalString(e.creditAmount),
      baseDebitAmount: decimalString(e.baseDebitAmount),
      baseCreditAmount: decimalString(e.baseCreditAmount),
      currencyCode: e.currencyCode,
      exchangeRate: decimalString(e.exchangeRate),
      costCentreId: e.costCentreId,
      projectReference: e.projectReference,
      departmentReference: e.departmentReference,
      sourceModule: e.sourceModule,
      sourceDocumentType: e.sourceDocumentType,
      sourceDocumentId: e.sourceDocumentId,
      isReversal: e.isReversal,
      reversalOfEntryId: e.reversalOfEntryId,
      reversedByEntryId: e.reversedByEntryId,
      postedBy: e.postedBy,
      postedAt: e.postedAt?.toISOString() ?? null,
    })),
  }
}
