/**
 * Vendor invoice duplicate detector (Phase 4A2).
 *
 * Read-only scan against previously saved vendor invoices for the same tenant/legal
 * entity/vendor:
 *   - EXACT_BLOCKING: another (non-cancelled) invoice already has the same normalized
 *     supplier invoice number for this vendor — blocks the caller from proceeding.
 *   - HIGH: no exact number match, but another (non-cancelled) invoice for the same
 *     vendor shares the same supplier invoice date and grand total (within paise
 *     rounding tolerance) under a different invoice number — flagged, not blocking.
 */
import { prisma } from '../../../../../config/database.js'
import { add, isZero, subtract, toDecimal } from '../../../shared/finance-decimal.js'
import { parseDateOnly } from '../../../shared/finance.helpers.js'
import { normalizeSupplierReferenceNumber } from '../vendor-adjustment-number-normalization.js'
import { formatDecimal4 } from './vendor-adjustment-decimal.js'
import type { VendorAdjustmentDuplicateAssessment, VendorAdjustmentDuplicateMatch, VendorAdjustmentDuplicateRiskLevel } from './vendor-adjustment-calculation.types.js'

const AMOUNT_TOLERANCE = '0.01'

export interface AssessVendorAdjustmentDuplicatesParams {
  tenantId: string
  legalEntityId: string
  vendorId?: string | null
  normalizedSupplierReferenceNumber?: string | null
  supplierReferenceDate?: string | null
  adjustmentGrandTotal?: string | null
  excludeVendorAdjustmentId?: string | null
  /** Duplicate scanning can be disabled by config/feature-flag — defaults to enabled. */
  enabled?: boolean
}

/** NONE-risk placeholder — used when detection is disabled/skipped and by the sync test helper. */
export function emptyVendorAdjustmentDuplicateAssessment(normalized: string): VendorAdjustmentDuplicateAssessment {
  return { riskLevel: 'NONE', isBlocking: false, normalizedSupplierReferenceNumber: normalized, matches: [] }
}

/** Higher-signal matches (exact number) always sort ahead of fuzzy amount/date matches. */
function matchRank(match: VendorAdjustmentDuplicateMatch): number {
  return match.matchingSignals.includes('SAME_SUPPLIER_INVOICE_NUMBER') ? 2 : 1
}

export async function assessVendorAdjustmentDuplicates(
  params: AssessVendorAdjustmentDuplicatesParams,
): Promise<VendorAdjustmentDuplicateAssessment> {
  const enabled = params.enabled ?? true
  const normalized = normalizeSupplierReferenceNumber(params.normalizedSupplierReferenceNumber ?? '')

  if (!enabled || !normalized || !params.vendorId) {
    return emptyVendorAdjustmentDuplicateAssessment(normalized)
  }

  const excludeId = params.excludeVendorAdjustmentId ?? null

  const exactRows = await prisma.vendorAdjustment.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      vendorId: params.vendorId,
      supplierReferenceNumberNormalized: normalized,
      status: { not: 'CANCELLED' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      draftReference: true,
      vendorAdjustmentNumber: true,
      supplierReferenceNumber: true,
      supplierReferenceDate: true,
      status: true,
      adjustmentGrandTotal: true,
    },
    orderBy: { supplierReferenceDate: 'desc' },
  })

  const matches: VendorAdjustmentDuplicateMatch[] = exactRows.map((row) => ({
    vendorAdjustmentId: row.id,
    draftReference: row.draftReference,
    vendorAdjustmentNumber: row.vendorAdjustmentNumber,
    supplierReferenceNumber: row.supplierReferenceNumber,
    supplierReferenceDate: row.supplierReferenceDate.toISOString().slice(0, 10),
    status: row.status,
    adjustmentGrandTotal: formatDecimal4(row.adjustmentGrandTotal),
    matchingSignals: ['SAME_SUPPLIER_INVOICE_NUMBER'],
  }))

  const excludedIds = new Set(exactRows.map((row) => row.id))
  if (excludeId) excludedIds.add(excludeId)

  if (params.supplierReferenceDate && params.adjustmentGrandTotal && !isZero(params.adjustmentGrandTotal)) {
    const invoiceDate = parseDateOnly(params.supplierReferenceDate)
    const amount = toDecimal(params.adjustmentGrandTotal)
    const tolerance = toDecimal(AMOUNT_TOLERANCE)

    const fuzzyRows = await prisma.vendorAdjustment.findMany({
      where: {
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        vendorId: params.vendorId,
        status: { not: 'CANCELLED' },
        id: { notIn: [...excludedIds] },
        supplierReferenceDate: invoiceDate,
        adjustmentGrandTotal: { gte: subtract(amount, tolerance), lte: add(amount, tolerance) },
        supplierReferenceNumberNormalized: { not: normalized },
      },
      select: {
        id: true,
        draftReference: true,
        vendorAdjustmentNumber: true,
        supplierReferenceNumber: true,
        supplierReferenceDate: true,
        status: true,
        adjustmentGrandTotal: true,
      },
      orderBy: { supplierReferenceDate: 'desc' },
    })

    for (const row of fuzzyRows) {
      matches.push({
        vendorAdjustmentId: row.id,
        draftReference: row.draftReference,
        vendorAdjustmentNumber: row.vendorAdjustmentNumber,
        supplierReferenceNumber: row.supplierReferenceNumber,
        supplierReferenceDate: row.supplierReferenceDate.toISOString().slice(0, 10),
        status: row.status,
        adjustmentGrandTotal: formatDecimal4(row.adjustmentGrandTotal),
        matchingSignals: ['SAME_INVOICE_DATE', 'SAME_GRAND_TOTAL'],
      })
    }
  }

  matches.sort((a, b) => {
    const rankDiff = matchRank(b) - matchRank(a)
    if (rankDiff !== 0) return rankDiff
    return b.supplierReferenceDate.localeCompare(a.supplierReferenceDate)
  })

  const riskLevel: VendorAdjustmentDuplicateRiskLevel = exactRows.length > 0 ? 'EXACT_BLOCKING' : matches.length > 0 ? 'HIGH' : 'NONE'

  return {
    riskLevel,
    isBlocking: riskLevel === 'EXACT_BLOCKING',
    normalizedSupplierReferenceNumber: normalized,
    matches,
  }
}
