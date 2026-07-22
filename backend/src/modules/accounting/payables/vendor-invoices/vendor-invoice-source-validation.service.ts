/**
 * Validates VendorInvoice sourceLinks against real PO/GRN + Purchase Setup policy.
 * Soft links only — rejects fabricated source UUIDs.
 */
import { resolveEffectivePurchaseDefaults } from '../../../purchase/shared/purchase-defaults.js'
import {
  deriveVendorInvoiceSourceMode,
  requireEligibleGrn,
  requireEligiblePurchaseOrder,
  type VendorInvoiceSourceMode,
} from '../../shared/master-resolvers/accounting-source-document-resolver.js'
import { VendorInvoiceValidationFailedError } from './vendor-invoice.errors.js'

export type VendorInvoiceSourceLinkType =
  | 'PURCHASE_ORDER'
  | 'GOODS_RECEIPT'
  | 'PURCHASE_RECEIPT'
  | 'CONTRACT'
  | 'PROJECT'
  | 'OTHER'

export type VendorInvoiceSourceLinkInput = {
  sourceType: VendorInvoiceSourceLinkType | string
  sourceDocumentId: string
  sourceDocumentNumberSnapshot?: string | null
  sourceDocumentDateSnapshot?: string | null
  metadata?: Record<string, unknown> | null
}

export type EnrichedVendorInvoiceSourceLink = {
  sourceType: VendorInvoiceSourceLinkType
  sourceDocumentId: string
  sourceDocumentNumberSnapshot?: string | null
  sourceDocumentDateSnapshot?: string | null
  metadata?: Record<string, unknown> | null
}

const PO_TYPES = new Set(['PURCHASE_ORDER'])
const GRN_TYPES = new Set(['GOODS_RECEIPT', 'PURCHASE_RECEIPT'])
/** Soft-reference types that are not PO/GRN — allowed but not validated against purchase docs. */
const SOFT_OTHER_TYPES = new Set(['CONTRACT', 'PROJECT', 'OTHER'])

export function normalizeSourceMode(
  sourceMode: VendorInvoiceSourceMode | undefined,
  sourceLinks: VendorInvoiceSourceLinkInput[],
): VendorInvoiceSourceMode {
  const derived = deriveVendorInvoiceSourceMode(sourceLinks)
  if (!sourceMode) return derived
  return sourceMode
}

function assertModeMatchesLinks(
  sourceMode: VendorInvoiceSourceMode,
  sourceLinks: VendorInvoiceSourceLinkInput[],
): void {
  const hasPo = sourceLinks.some((l) => PO_TYPES.has(l.sourceType))
  const hasGrn = sourceLinks.some((l) => GRN_TYPES.has(l.sourceType))
  const purchaseLinks = sourceLinks.filter(
    (l) => PO_TYPES.has(l.sourceType) || GRN_TYPES.has(l.sourceType),
  )

  switch (sourceMode) {
    case 'DIRECT':
      if (purchaseLinks.length > 0) {
        throw new VendorInvoiceValidationFailedError(
          'sourceMode DIRECT cannot include PURCHASE_ORDER or GRN source links',
          [{ field: 'sourceLinks', message: 'Remove PO/GRN links for DIRECT invoices' }],
        )
      }
      break
    case 'PURCHASE_ORDER':
      if (!hasPo) {
        throw new VendorInvoiceValidationFailedError(
          'sourceMode PURCHASE_ORDER requires at least one PURCHASE_ORDER source link',
          [{ field: 'sourceLinks', message: 'Add a purchase order source link' }],
        )
      }
      if (hasGrn) {
        throw new VendorInvoiceValidationFailedError(
          'sourceMode PURCHASE_ORDER cannot include GRN source links (use PURCHASE_ORDER_AND_GRN)',
          [{ field: 'sourceLinks', message: 'Remove GRN links or change sourceMode' }],
        )
      }
      break
    case 'GRN':
      if (!hasGrn) {
        throw new VendorInvoiceValidationFailedError(
          'sourceMode GRN requires at least one GOODS_RECEIPT source link',
          [{ field: 'sourceLinks', message: 'Add a GRN source link' }],
        )
      }
      if (hasPo) {
        throw new VendorInvoiceValidationFailedError(
          'sourceMode GRN cannot include PURCHASE_ORDER source links (use PURCHASE_ORDER_AND_GRN)',
          [{ field: 'sourceLinks', message: 'Remove PO links or change sourceMode' }],
        )
      }
      break
    case 'PURCHASE_ORDER_AND_GRN':
      if (!hasPo || !hasGrn) {
        throw new VendorInvoiceValidationFailedError(
          'sourceMode PURCHASE_ORDER_AND_GRN requires both PO and GRN source links',
          [{ field: 'sourceLinks', message: 'Add both purchase order and GRN source links' }],
        )
      }
      break
    default:
      throw new VendorInvoiceValidationFailedError(`Unknown sourceMode: ${String(sourceMode)}`, [
        { field: 'sourceMode', message: 'Invalid source mode' },
      ])
  }

  for (const link of sourceLinks) {
    if (!PO_TYPES.has(link.sourceType) && !GRN_TYPES.has(link.sourceType) && !SOFT_OTHER_TYPES.has(link.sourceType)) {
      throw new VendorInvoiceValidationFailedError(`Unsupported sourceType: ${link.sourceType}`, [
        { field: 'sourceLinks', message: `Unsupported sourceType ${link.sourceType}` },
      ])
    }
  }
}

async function applyPurchaseSetupPolicy(
  tenantId: string,
  sourceMode: VendorInvoiceSourceMode,
  sourceLinks: VendorInvoiceSourceLinkInput[],
): Promise<void> {
  const defaults = await resolveEffectivePurchaseDefaults(tenantId)
  // Unconfigured tenants keep historical AP behavior (DIRECT allowed).
  // Only enforce Purchase Setup flags when the tenant has saved purchase settings.
  if (!defaults.isConfigured) return

  const hasPo = sourceLinks.some((l) => PO_TYPES.has(l.sourceType))
  const hasGrn = sourceLinks.some((l) => GRN_TYPES.has(l.sourceType))

  if (sourceMode === 'DIRECT' && !defaults.allowDirectInvoice) {
    throw new VendorInvoiceValidationFailedError(
      'Direct vendor invoices are disabled by Purchase Setup (allowDirectInvoice=false)',
      [{ field: 'sourceMode', message: 'Select a PO and/or GRN source' }],
    )
  }

  if (defaults.requirePoMatch && !hasPo) {
    throw new VendorInvoiceValidationFailedError(
      'Purchase Setup requires a purchase order match (requirePoMatch=true)',
      [{ field: 'sourceLinks', message: 'Link at least one purchase order' }],
    )
  }

  if (defaults.requireGrnMatch && !hasGrn) {
    throw new VendorInvoiceValidationFailedError(
      'Purchase Setup requires a GRN match (requireGrnMatch=true)',
      [{ field: 'sourceLinks', message: 'Link at least one goods receipt' }],
    )
  }
}

/**
 * Revalidate all PO/GRN soft links: existence, tenant, vendor match, eligibility.
 * Enriches number/date snapshots when missing.
 */
export async function validateAndEnrichVendorInvoiceSourceLinks(
  tenantId: string,
  vendorId: string,
  sourceLinks: VendorInvoiceSourceLinkInput[],
  sourceModeInput?: VendorInvoiceSourceMode,
): Promise<{
  sourceMode: VendorInvoiceSourceMode
  sourceLinks: EnrichedVendorInvoiceSourceLink[]
  warnings: Array<{ code: string; message: string }>
}> {
  const sourceMode = normalizeSourceMode(sourceModeInput, sourceLinks)
  assertModeMatchesLinks(sourceMode, sourceLinks)
  await applyPurchaseSetupPolicy(tenantId, sourceMode, sourceLinks)

  const warnings: Array<{ code: string; message: string }> = []
  const enriched: EnrichedVendorInvoiceSourceLink[] = []

  for (const link of sourceLinks) {
    if (PO_TYPES.has(link.sourceType)) {
      const eligibility = await requireEligiblePurchaseOrder(tenantId, link.sourceDocumentId, vendorId)
      warnings.push(...eligibility.warnings)
      enriched.push({
        sourceDocumentId: link.sourceDocumentId,
        sourceType: 'PURCHASE_ORDER',
        sourceDocumentNumberSnapshot:
          link.sourceDocumentNumberSnapshot ?? eligibility.documentNumber,
        sourceDocumentDateSnapshot: link.sourceDocumentDateSnapshot ?? eligibility.documentDate,
        metadata: {
          ...(link.metadata ?? {}),
          status: eligibility.status,
        },
      })
      continue
    }

    if (GRN_TYPES.has(link.sourceType)) {
      const eligibility = await requireEligibleGrn(tenantId, link.sourceDocumentId, vendorId)
      warnings.push(...eligibility.warnings)
      enriched.push({
        sourceDocumentId: link.sourceDocumentId,
        sourceType: 'GOODS_RECEIPT',
        sourceDocumentNumberSnapshot:
          link.sourceDocumentNumberSnapshot ?? eligibility.documentNumber,
        sourceDocumentDateSnapshot: link.sourceDocumentDateSnapshot ?? eligibility.documentDate,
        metadata: {
          ...(link.metadata ?? {}),
          status: eligibility.status,
          purchaseOrderId: eligibility.snapshot.purchaseOrderId,
        },
      })
      continue
    }

    // CONTRACT / PROJECT / OTHER — soft refs, no purchase document lookup
    enriched.push({
      sourceDocumentId: link.sourceDocumentId,
      sourceType: link.sourceType as VendorInvoiceSourceLinkType,
      sourceDocumentNumberSnapshot: link.sourceDocumentNumberSnapshot,
      sourceDocumentDateSnapshot: link.sourceDocumentDateSnapshot,
      metadata: link.metadata,
    })
  }

  return { sourceMode, sourceLinks: enriched, warnings }
}

/** Soft-link revalidation for validate/post — same rules, no enrichment required. */
export async function revalidateVendorInvoiceSourceLinks(
  tenantId: string,
  vendorId: string,
  sourceLinks: Array<{ sourceType: string; sourceDocumentId: string }>,
  sourceModeInput?: VendorInvoiceSourceMode,
): Promise<void> {
  await validateAndEnrichVendorInvoiceSourceLinks(
    tenantId,
    vendorId,
    sourceLinks,
    sourceModeInput,
  )
}
