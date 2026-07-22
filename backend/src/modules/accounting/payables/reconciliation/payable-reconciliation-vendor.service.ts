import type { Prisma } from '@prisma/client'
import { prisma } from '../../../../config/database.js'
import { compare, formatForPersistence, subtract, toDecimal } from '../../shared/finance-decimal.js'
import {
  aggregateAsOfByVendor,
  aggregateCurrentSubledgerByVendor,
  aggregateGlByVendor,
} from './payable-reconciliation-balances.service.js'
import type { ReconciledOpenItemAsOf, ReconciliationExceptionDraft, VendorBalanceRow } from './payable-reconciliation.types.js'

export interface VendorLevelResult {
  vendors: VendorBalanceRow[]
  exceptions: ReconciliationExceptionDraft[]
  mismatchCount: number
}

/**
 * Vendor-level (party-level) reconciliation: GL posted with partyType VENDOR on the control
 * accounts vs. this vendor's subledger net (CREDIT outstanding − DEBIT outstanding). Raises a
 * VENDOR_PARTY exception for any vendor with a variance beyond tolerance, or with subledger
 * activity but no party-tagged GL postings at all (missing party metadata on the voucher line).
 */
export async function computeVendorLevelReconciliation(
  tenantId: string,
  legalEntityId: string,
  controlAccountIds: string[],
  tolerance: Prisma.Decimal,
  isHistorical: boolean,
  asOfDate: Date,
  asOfItems: ReconciledOpenItemAsOf[],
): Promise<VendorLevelResult> {
  const exceptions: ReconciliationExceptionDraft[] = []
  if (controlAccountIds.length === 0) {
    return { vendors: [], exceptions, mismatchCount: 0 }
  }

  const [glByVendor, subledgerByVendor] = await Promise.all([
    aggregateGlByVendor(tenantId, legalEntityId, controlAccountIds, asOfDate),
    isHistorical
      ? Promise.resolve(aggregateAsOfByVendor(asOfItems))
      : aggregateCurrentSubledgerByVendor(tenantId, legalEntityId, controlAccountIds),
  ])

  const vendorIds = [...new Set([...glByVendor.keys(), ...subledgerByVendor.keys()])]
  if (vendorIds.length === 0) {
    return { vendors: [], exceptions, mismatchCount: 0 }
  }

  const snapshots = await prisma.payableOpenItem.findMany({
    where: { tenantId, legalEntityId, vendorId: { in: vendorIds } },
    select: { vendorId: true, vendorCodeSnapshot: true, vendorNameSnapshot: true },
    distinct: ['vendorId'],
  })
  const nameByVendor = new Map(snapshots.map((s) => [s.vendorId, { code: s.vendorCodeSnapshot, name: s.vendorNameSnapshot }]))

  const rows: VendorBalanceRow[] = []
  let mismatchCount = 0
  for (const vendorId of vendorIds) {
    const glBalance = glByVendor.get(vendorId) ?? toDecimal(0)
    const subledgerEntry = subledgerByVendor.get(vendorId)
    const subledgerBalance = subledgerEntry?.balance ?? toDecimal(0)
    const variance = subtract(glBalance, subledgerBalance)
    const matched = variance.abs().lte(tolerance)
    if (!matched) mismatchCount += 1
    const meta = nameByVendor.get(vendorId)
    rows.push({
      vendorId,
      vendorCode: meta?.code ?? null,
      vendorName: meta?.name ?? null,
      glBalance: formatForPersistence(glBalance),
      subledgerBalance: formatForPersistence(subledgerBalance),
      variance: formatForPersistence(variance),
      matched,
      openItemCount: subledgerEntry?.count ?? 0,
    })

    if (!glByVendor.has(vendorId) && subledgerEntry && compare(subledgerEntry.balance, 0) !== 0) {
      exceptions.push({
        severity: 'WARNING',
        category: 'VENDOR_PARTY',
        code: 'VENDOR_SUBLEDGER_WITHOUT_PARTY_GL',
        message: `Vendor ${meta?.name ?? vendorId} has subledger activity but no party-tagged GL postings on the control account`,
        vendorId,
      })
    } else if (!matched) {
      exceptions.push({
        severity: 'ERROR',
        category: 'VENDOR_PARTY',
        code: 'VENDOR_GL_SUBLEDGER_VARIANCE',
        message: `Vendor ${meta?.name ?? vendorId} GL balance does not match subledger net beyond tolerance`,
        vendorId,
        details: { glBalance: formatForPersistence(glBalance), subledgerBalance: formatForPersistence(subledgerBalance), variance: formatForPersistence(variance) },
      })
    }
  }

  return { vendors: rows.sort((a, b) => (a.vendorName ?? '').localeCompare(b.vendorName ?? '')), exceptions, mismatchCount }
}
