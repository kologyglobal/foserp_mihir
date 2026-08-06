/**
 * Resolve and aggregate Sales Order GST header fields (PoS, supply type, scheme totals).
 */
import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/prisma.js'
import { AuthorizationError, ValidationError } from '../../../utils/errors.js'
import {
  resolveCommercialPlaceOfSupply,
  resolveCommercialSupplyType,
  type CommercialPlaceOfSupplySource,
} from '../../tax/commercial-supply-context.js'
import type { SalesOrderLineDto } from './sales-order.types.js'

export const POS_OVERRIDE_PERMISSION = 'crm.commercial.tax_place_override'

export type SalesOrderTaxHeaderInput = {
  placeOfSupply?: string | null
  placeOfSupplyOverride?: boolean | null
  placeOfSupplyOverrideReason?: string | null
  supplierStateCode?: string | null
  deliveryLocation?: string | null
  shippingAddress?: string | null
  billingAddress?: string | null
  isServiceDocument?: boolean
}

export type SalesOrderTaxHeaderResolved = {
  placeOfSupply: string | null
  placeOfSupplyStateCode: string | null
  placeOfSupplySource: CommercialPlaceOfSupplySource
  placeOfSupplyOverride: boolean
  placeOfSupplyOverrideReason: string | null
  supplierStateCode: string | null
  supplyType: string
  gstScheme: string
  cgstAmount: number
  sgstAmount: number
  utgstAmount: number
  igstAmount: number
  cessAmount: number
  /** Lines with scheme/components realigned to resolved header. */
  lines: SalesOrderLineDto[]
}

type CustomerLike = {
  state?: string | null
  gstin?: string | null
}

function r2(n: number) {
  return Math.round(n * 100) / 100
}

export function sumLineTaxComponents(lines: SalesOrderLineDto[]): {
  cgstAmount: number
  sgstAmount: number
  utgstAmount: number
  igstAmount: number
  cessAmount: number
  dominantScheme: string | null
} {
  let cgstAmount = 0
  let sgstAmount = 0
  let utgstAmount = 0
  let igstAmount = 0
  let cessAmount = 0
  const schemes = new Set<string>()
  for (const l of lines) {
    cgstAmount += Number(l.cgstAmount ?? 0)
    sgstAmount += Number(l.sgstAmount ?? 0)
    utgstAmount += Number(l.utgstAmount ?? 0)
    igstAmount += Number(l.igstAmount ?? 0)
    if (l.taxScheme) schemes.add(String(l.taxScheme).toLowerCase())
  }
  let dominantScheme: string | null = null
  if (schemes.has('igst')) dominantScheme = 'igst'
  else if (schemes.has('utgst_pair') || schemes.has('cgst_utgst')) dominantScheme = 'utgst_pair'
  else if (schemes.has('cgst_sgst')) dominantScheme = 'cgst_sgst'
  else if (schemes.size === 1) dominantScheme = [...schemes][0] ?? null

  return {
    cgstAmount: r2(cgstAmount),
    sgstAmount: r2(sgstAmount),
    utgstAmount: r2(utgstAmount),
    igstAmount: r2(igstAmount),
    cessAmount: r2(cessAmount),
    dominantScheme,
  }
}

export async function resolveSupplierStateCode(
  tenantId: string,
  legalEntityId: string | null | undefined,
  explicit?: string | null,
): Promise<string | null> {
  if (explicit?.trim()) {
    const { resolveGstStateCode } = await import(
      '../../accounting/receivables/validation/state-code.validator.js'
    )
    return resolveGstStateCode(explicit)
  }
  if (!legalEntityId) {
    const def = await prisma.legalEntity.findFirst({
      where: { tenantId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
      select: { stateCode: true, gstin: true },
    })
    if (!def) return null
    const { resolveGstStateCode } = await import(
      '../../accounting/receivables/validation/state-code.validator.js'
    )
    return resolveGstStateCode(def.stateCode) ?? resolveGstStateCode(def.gstin)
  }
  const le = await prisma.legalEntity.findFirst({
    where: { id: legalEntityId, tenantId },
    select: { stateCode: true, gstin: true },
  })
  if (!le) return null
  const { resolveGstStateCode } = await import(
    '../../accounting/receivables/validation/state-code.validator.js'
  )
  return resolveGstStateCode(le.stateCode) ?? resolveGstStateCode(le.gstin)
}

export function assertPlaceOfSupplyOverrideAllowed(
  input: SalesOrderTaxHeaderInput,
  permissions: string[] | undefined,
): void {
  if (!input.placeOfSupplyOverride) return
  const reason = input.placeOfSupplyOverrideReason?.trim()
  if (!reason) {
    throw new ValidationError('Place of Supply override requires a non-empty reason')
  }
  if (!input.placeOfSupply?.trim()) {
    throw new ValidationError('Place of Supply override requires a place of supply value')
  }
  const allowed =
    !permissions ||
    permissions.includes(POS_OVERRIDE_PERMISSION) ||
    permissions.includes('tenant.manage')
  if (!allowed) {
    throw new AuthorizationError('You are not authorised to override Place of Supply')
  }
}

export async function resolveSalesOrderTaxHeader(opts: {
  tenantId: string
  legalEntityId?: string | null
  customer: CustomerLike
  lines: SalesOrderLineDto[]
  input: SalesOrderTaxHeaderInput
  permissions?: string[]
}): Promise<SalesOrderTaxHeaderResolved> {
  assertPlaceOfSupplyOverrideAllowed(opts.input, opts.permissions)

  const supplierStateCode = await resolveSupplierStateCode(
    opts.tenantId,
    opts.legalEntityId,
    opts.input.supplierStateCode,
  )

  const isOverride = Boolean(opts.input.placeOfSupplyOverride)
  // Auto path must not re-use a previously saved PoS label (that blocks ship-to recalculation).
  const pos = resolveCommercialPlaceOfSupply({
    placeOfSupplyOverride: isOverride,
    placeOfSupplyOverrideValue: isOverride ? opts.input.placeOfSupply : null,
    shipToState: opts.input.deliveryLocation ?? opts.input.shippingAddress,
    billToState: opts.input.billingAddress,
    customerState: opts.customer.state,
    customerGstin: opts.customer.gstin,
    isServiceDocument: opts.input.isServiceDocument,
  })

  const supply = resolveCommercialSupplyType({
    supplierStateCode,
    placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
  })

  // Force line components to match resolved scheme (intra↔inter swap).
  const { applyDocumentTaxSchemeToLines } = await import('./sales-order.workflow.js')
  const alignedLines =
    supply.taxScheme !== 'UNRESOLVED'
      ? applyDocumentTaxSchemeToLines(opts.lines, supply.taxScheme)
      : opts.lines

  const components = sumLineTaxComponents(alignedLines)
  const gstScheme =
    supply.taxScheme !== 'UNRESOLVED'
      ? supply.taxScheme
      : components.dominantScheme ?? 'UNRESOLVED'

  return {
    placeOfSupply: pos.placeOfSupplyLabel,
    placeOfSupplyStateCode: pos.placeOfSupplyStateCode,
    placeOfSupplySource: pos.source === 'UNRESOLVED' ? 'AUTO' : pos.source,
    placeOfSupplyOverride: isOverride,
    placeOfSupplyOverrideReason: isOverride
      ? (opts.input.placeOfSupplyOverrideReason?.trim() ?? null)
      : null,
    supplierStateCode: supply.supplierStateCode,
    supplyType: supply.supplyType,
    gstScheme,
    cgstAmount: components.cgstAmount,
    sgstAmount: components.sgstAmount,
    utgstAmount: components.utgstAmount,
    igstAmount: components.igstAmount,
    cessAmount: components.cessAmount,
    lines: alignedLines,
  }
}

export function taxHeaderToPrismaCreate(
  header: SalesOrderTaxHeaderResolved,
): Pick<
  Prisma.CrmSalesOrderCreateInput,
  | 'placeOfSupply'
  | 'placeOfSupplyStateCode'
  | 'placeOfSupplySource'
  | 'placeOfSupplyOverride'
  | 'placeOfSupplyOverrideReason'
  | 'supplierStateCode'
  | 'supplyType'
  | 'gstScheme'
  | 'cgstAmount'
  | 'sgstAmount'
  | 'utgstAmount'
  | 'igstAmount'
  | 'cessAmount'
> {
  return {
    placeOfSupply: header.placeOfSupply,
    placeOfSupplyStateCode: header.placeOfSupplyStateCode,
    placeOfSupplySource: header.placeOfSupplySource,
    placeOfSupplyOverride: header.placeOfSupplyOverride,
    placeOfSupplyOverrideReason: header.placeOfSupplyOverrideReason,
    supplierStateCode: header.supplierStateCode,
    supplyType: header.supplyType,
    gstScheme: header.gstScheme,
    cgstAmount: header.cgstAmount,
    sgstAmount: header.sgstAmount,
    utgstAmount: header.utgstAmount,
    igstAmount: header.igstAmount,
    cessAmount: header.cessAmount,
  }
}

export function taxHeaderToPrismaUpdate(
  header: SalesOrderTaxHeaderResolved,
): Prisma.CrmSalesOrderUpdateInput {
  return taxHeaderToPrismaCreate(header) as Prisma.CrmSalesOrderUpdateInput
}
