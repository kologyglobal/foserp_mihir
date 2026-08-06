import { resolveLineGstFromMasters } from '../../accounting/shared/master-resolvers/accounting-tax-resolver.js'
import { resolveGstStateCode } from '../../accounting/receivables/validation/state-code.validator.js'
import { prisma } from '../../../config/prisma.js'

export type PurchaseLineTaxSnapshot = {
  gstRatePctSnapshot: number
  cgstRateSnapshot: number
  sgstRateSnapshot: number
  igstRateSnapshot: number
  gstSchemeSnapshot: string
}

export const EMPTY_TAX_SNAPSHOT: PurchaseLineTaxSnapshot = {
  gstRatePctSnapshot: 0,
  cgstRateSnapshot: 0,
  sgstRateSnapshot: 0,
  igstRateSnapshot: 0,
  gstSchemeSnapshot: 'cgst_sgst',
}

function num(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function gstSchemeFromRates(cgst: number, sgst: number, igst: number): string {
  if (igst > 0 && cgst === 0 && sgst === 0) return 'igst'
  return 'cgst_sgst'
}

/**
 * Persist rate legs for a supply type. Master rate rows often store CGST+SGST and IGST together;
 * zero the unused leg so downstream GRN/invoice inherit a clear scheme.
 */
export function taxSnapshotFromRates(input: {
  cgstRate?: unknown
  sgstRate?: unknown
  igstRate?: unknown
  gstRate?: unknown
  /** When known, force CGST+SGST vs IGST split (purchase: supplier state ≠ place of supply). */
  isInterstate?: boolean
}): PurchaseLineTaxSnapshot {
  const cgst = num(input.cgstRate)
  const sgst = num(input.sgstRate)
  const igst = num(input.igstRate)
  const combinedIntra = cgst + sgst
  const effectiveIgst = igst > 0 ? igst : combinedIntra
  const combined =
    input.gstRate != null && String(input.gstRate).trim() !== ''
      ? num(input.gstRate)
      : combinedIntra > 0
        ? combinedIntra
        : effectiveIgst

  if (input.isInterstate === true) {
    return {
      gstRatePctSnapshot: effectiveIgst > 0 ? effectiveIgst : combined,
      cgstRateSnapshot: 0,
      sgstRateSnapshot: 0,
      igstRateSnapshot: effectiveIgst > 0 ? effectiveIgst : combined,
      gstSchemeSnapshot: 'igst',
    }
  }

  if (input.isInterstate === false) {
    if (combinedIntra > 0) {
      return {
        gstRatePctSnapshot: combinedIntra,
        cgstRateSnapshot: cgst,
        sgstRateSnapshot: sgst,
        igstRateSnapshot: 0,
        gstSchemeSnapshot: 'cgst_sgst',
      }
    }
    const half = Number((effectiveIgst / 2).toFixed(4))
    return {
      gstRatePctSnapshot: effectiveIgst,
      cgstRateSnapshot: half,
      sgstRateSnapshot: half,
      igstRateSnapshot: 0,
      gstSchemeSnapshot: 'cgst_sgst',
    }
  }

  // Legacy: scheme from which rate legs are non-zero on the master row.
  return {
    gstRatePctSnapshot: combined,
    cgstRateSnapshot: cgst,
    sgstRateSnapshot: sgst,
    igstRateSnapshot: igst,
    gstSchemeSnapshot: gstSchemeFromRates(cgst, sgst, igst),
  }
}

export async function resolvePurchaseLineTaxSnapshot(input: {
  tenantId: string
  itemId?: string | null
  hsnId?: string | null
  gstGroupId?: string | null
  asOfDate?: string | Date | null
  vendorId?: string | null
  deliveryWarehouseId?: string | null
}): Promise<PurchaseLineTaxSnapshot> {
  const asOfDate =
    input.asOfDate instanceof Date
      ? input.asOfDate.toISOString().slice(0, 10)
      : input.asOfDate ?? new Date().toISOString().slice(0, 10)

  let vendorState: string | null = null
  let vendorGstin: string | null = null
  if (input.vendorId) {
    const vendor = await prisma.masterVendor.findFirst({
      where: { tenantId: input.tenantId, id: input.vendorId, deletedAt: null },
      select: { state: true, gstin: true },
    })
    vendorState = vendor?.state ?? null
    vendorGstin = vendor?.gstin ?? null
  }

  // Always resolve buyer place of supply (settings → tenant) — not only when warehouse is set.
  let plantState: string | null = null
  let plantStateCode: string | null = null
  const setup = await prisma.purchaseSettings.findFirst({
    where: { tenantId: input.tenantId },
    select: { placeOfSupplyState: true, placeOfSupplyStateCode: true },
  })
  plantState = setup?.placeOfSupplyState ?? null
  plantStateCode = setup?.placeOfSupplyStateCode ?? null
  if (!plantState && !plantStateCode) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: input.tenantId },
      select: { state: true },
    })
    plantState = tenant?.state ?? null
  }

  const supplierCode =
    resolveGstStateCode(vendorState) ?? resolveGstStateCode(vendorGstin)
  const posCode =
    resolveGstStateCode(plantStateCode) ?? resolveGstStateCode(plantState)
  const isInterstate =
    supplierCode != null && posCode != null ? supplierCode !== posCode : undefined

  // Prefer state names/codes that match master GST rate lanes (seeded as state names).
  const fromState = vendorState || vendorGstin || null
  const toState = plantState || plantStateCode || null

  const resolved = await resolveLineGstFromMasters({
    tenantId: input.tenantId,
    applicableFor: 'PURCHASE',
    asOfDate,
    fromState,
    toState,
    itemId: input.itemId,
    hsnId: input.hsnId,
    gstGroupId: input.gstGroupId,
  })

  if (!resolved) return { ...EMPTY_TAX_SNAPSHOT }

  return taxSnapshotFromRates({
    cgstRate: resolved.cgstRate,
    sgstRate: resolved.sgstRate,
    igstRate: resolved.igstRate,
    gstRate: resolved.gstRate,
    isInterstate,
  })
}

/** Prefer GRN snapshots (receive-time copy); fall back to PO line. */
export function taxSnapshotFromGrnOrPoLine(
  grnLine?: {
    hsnIdSnapshot?: string | null
    hsnCodeSnapshot?: string | null
    gstGroupIdSnapshot?: string | null
    gstGroupCodeSnapshot?: string | null
    gstRatePctSnapshot?: unknown
    cgstRateSnapshot?: unknown
    sgstRateSnapshot?: unknown
    igstRateSnapshot?: unknown
    gstSchemeSnapshot?: string | null
  } | null,
  poLine?: Parameters<typeof taxSnapshotFromPoLine>[0] | null,
) {
  const fromGrn =
    grnLine &&
    (num(grnLine.gstRatePctSnapshot) > 0 ||
      Boolean(grnLine.hsnCodeSnapshot?.trim()) ||
      Boolean(grnLine.gstGroupCodeSnapshot?.trim()))
  if (fromGrn) {
    return {
      hsnIdSnapshot: grnLine.hsnIdSnapshot ?? null,
      hsnCodeSnapshot: grnLine.hsnCodeSnapshot ?? '',
      gstGroupIdSnapshot: grnLine.gstGroupIdSnapshot ?? null,
      gstGroupCodeSnapshot: grnLine.gstGroupCodeSnapshot ?? '',
      gstRatePctSnapshot: num(grnLine.gstRatePctSnapshot),
      cgstRateSnapshot: num(grnLine.cgstRateSnapshot),
      sgstRateSnapshot: num(grnLine.sgstRateSnapshot),
      igstRateSnapshot: num(grnLine.igstRateSnapshot),
      gstSchemeSnapshot: grnLine.gstSchemeSnapshot ?? 'cgst_sgst',
    }
  }
  if (poLine) return taxSnapshotFromPoLine(poLine)
  return null
}

/** Copy immutable tax fields from PO line onto GRN / invoice line payloads. */
export function taxSnapshotFromPoLine(poLine: {
  hsnId?: string | null
  hsnCodeSnapshot?: string | null
  gstGroupId?: string | null
  gstGroupCodeSnapshot?: string | null
  gstRatePctSnapshot?: unknown
  cgstRateSnapshot?: unknown
  sgstRateSnapshot?: unknown
  igstRateSnapshot?: unknown
  gstSchemeSnapshot?: string | null
}) {
  return {
    hsnIdSnapshot: poLine.hsnId ?? null,
    hsnCodeSnapshot: poLine.hsnCodeSnapshot ?? '',
    gstGroupIdSnapshot: poLine.gstGroupId ?? null,
    gstGroupCodeSnapshot: poLine.gstGroupCodeSnapshot ?? '',
    gstRatePctSnapshot: num(poLine.gstRatePctSnapshot),
    cgstRateSnapshot: num(poLine.cgstRateSnapshot),
    sgstRateSnapshot: num(poLine.sgstRateSnapshot),
    igstRateSnapshot: num(poLine.igstRateSnapshot),
    gstSchemeSnapshot: poLine.gstSchemeSnapshot ?? 'cgst_sgst',
  }
}
