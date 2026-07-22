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
import { normalizeSupplierInvoiceNumber } from '../vendor-invoice-number-normalization.js'
import { formatDecimal4 } from './vendor-invoice-decimal.js'
import type { VendorInvoiceDuplicateAssessment, VendorInvoiceDuplicateMatch, VendorInvoiceDuplicateRiskLevel } from './vendor-invoice-calculation.types.js'

const AMOUNT_TOLERANCE = '0.01'

export interface AssessVendorInvoiceDuplicatesParams {
  tenantId: string
  legalEntityId: string
  vendorId?: string | null
  normalizedSupplierInvoiceNumber?: string | null
  supplierInvoiceDate?: string | null
  invoiceGrandTotal?: string | null
  excludeVendorInvoiceId?: string | null
  /** Duplicate scanning can be disabled by config/feature-flag — defaults to enabled. */
  enabled?: boolean
}

/** NONE-risk placeholder — used when detection is disabled/skipped and by the sync test helper. */
export function emptyVendorInvoiceDuplicateAssessment(normalized: string): VendorInvoiceDuplicateAssessment {
  return { riskLevel: 'NONE', isBlocking: false, normalizedSupplierInvoiceNumber: normalized, matches: [] }
}

/** Higher-signal matches (exact number) always sort ahead of fuzzy amount/date matches. */
function matchRank(match: VendorInvoiceDuplicateMatch): number {
  return match.matchingSignals.includes('SAME_SUPPLIER_INVOICE_NUMBER') ? 2 : 1
}

export async function assessVendorInvoiceDuplicates(
  params: AssessVendorInvoiceDuplicatesParams,
): Promise<VendorInvoiceDuplicateAssessment> {
  const enabled = params.enabled ?? true
  const normalized = normalizeSupplierInvoiceNumber(params.normalizedSupplierInvoiceNumber ?? '')

  if (!enabled || !normalized || !params.vendorId) {
    return emptyVendorInvoiceDuplicateAssessment(normalized)
  }

  const excludeId = params.excludeVendorInvoiceId ?? null

  const exactRows = await prisma.vendorInvoice.findMany({
    where: {
      tenantId: params.tenantId,
      legalEntityId: params.legalEntityId,
      vendorId: params.vendorId,
      supplierInvoiceNumberNormalized: normalized,
      status: { not: 'CANCELLED' },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: {
      id: true,
      draftReference: true,
      vendorInvoiceNumber: true,
      supplierInvoiceNumber: true,
      supplierInvoiceDate: true,
      status: true,
      invoiceGrandTotal: true,
    },
    orderBy: { supplierInvoiceDate: 'desc' },
  })

  const matches: VendorInvoiceDuplicateMatch[] = exactRows.map((row) => ({
    vendorInvoiceId: row.id,
    draftReference: row.draftReference,
    vendorInvoiceNumber: row.vendorInvoiceNumber,
    supplierInvoiceNumber: row.supplierInvoiceNumber,
    supplierInvoiceDate: row.supplierInvoiceDate.toISOString().slice(0, 10),
    status: row.status,
    invoiceGrandTotal: formatDecimal4(row.invoiceGrandTotal),
    matchingSignals: ['SAME_SUPPLIER_INVOICE_NUMBER'],
  }))

  const excludedIds = new Set(exactRows.map((row) => row.id))
  if (excludeId) excludedIds.add(excludeId)

  if (params.supplierInvoiceDate && params.invoiceGrandTotal && !isZero(params.invoiceGrandTotal)) {
    const invoiceDate = parseDateOnly(params.supplierInvoiceDate)
    const amount = toDecimal(params.invoiceGrandTotal)
    const tolerance = toDecimal(AMOUNT_TOLERANCE)

    const fuzzyRows = await prisma.vendorInvoice.findMany({
      where: {
        tenantId: params.tenantId,
        legalEntityId: params.legalEntityId,
        vendorId: params.vendorId,
        status: { not: 'CANCELLED' },
        id: { notIn: [...excludedIds] },
        supplierInvoiceDate: invoiceDate,
        invoiceGrandTotal: { gte: subtract(amount, tolerance), lte: add(amount, tolerance) },
        supplierInvoiceNumberNormalized: { not: normalized },
      },
      select: {
        id: true,
        draftReference: true,
        vendorInvoiceNumber: true,
        supplierInvoiceNumber: true,
        supplierInvoiceDate: true,
        status: true,
        invoiceGrandTotal: true,
      },
      orderBy: { supplierInvoiceDate: 'desc' },
    })

    for (const row of fuzzyRows) {
      matches.push({
        vendorInvoiceId: row.id,
        draftReference: row.draftReference,
        vendorInvoiceNumber: row.vendorInvoiceNumber,
        supplierInvoiceNumber: row.supplierInvoiceNumber,
        supplierInvoiceDate: row.supplierInvoiceDate.toISOString().slice(0, 10),
        status: row.status,
        invoiceGrandTotal: formatDecimal4(row.invoiceGrandTotal),
        matchingSignals: ['SAME_INVOICE_DATE', 'SAME_GRAND_TOTAL'],
      })
    }
  }

  matches.sort((a, b) => {
    const rankDiff = matchRank(b) - matchRank(a)
    if (rankDiff !== 0) return rankDiff
    return b.supplierInvoiceDate.localeCompare(a.supplierInvoiceDate)
  })

  const riskLevel: VendorInvoiceDuplicateRiskLevel = exactRows.length > 0 ? 'EXACT_BLOCKING' : matches.length > 0 ? 'HIGH' : 'NONE'

  return {
    riskLevel,
    isBlocking: riskLevel === 'EXACT_BLOCKING',
    normalizedSupplierInvoiceNumber: normalized,
    matches,
  }
}
