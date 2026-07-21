import type {
  DuplicateChallanPolicy,
  PurchaseApprovalMatrixRole,
  PurchaseGstRoundOffRule,
  PurchaseGstScheme,
  PurchasePrintOrientation,
  PurchasePrintPaperSize,
  SelfApprovalPolicy,
} from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { permissionSetIncludes } from '../../../constants/permissions.js'
import { SERVER_DEFAULT_SETUP } from '../setup/purchase-setup.repository.js'

export type EffectivePurchaseDefaults = {
  defaultPlantId: string | null
  defaultWarehouseId: string | null
  defaultRequisitionWarehouseId: string | null
  defaultReceivingLocationId: string | null
  defaultQualityHoldLocationId: string | null
  defaultRejectedLocationId: string | null
  defaultVendorReturnLocationId: string | null
  defaultCurrencyCode: string
  defaultPaymentTermCode: string | null
  defaultPaymentTermName: string | null
  defaultDeliveryTerms: string | null
  defaultBuyerId: string | null
  defaultRfqRequired: boolean
  allowDirectPo: boolean
  requirePrBeforePo: boolean
  requireRfqAboveAmount: number | null
  minimumRfqVendorCount: number
  requireQuotationComparison: boolean
  requirePoWarehouse: boolean
  requireExpectedDeliveryDate: boolean
  requirePaymentTerms: boolean
  allowOverReceipt: boolean
  overReceiptTolerancePct: number
  allowShortClose: boolean
  requireVendorChallan: boolean
  requireVehicleNumber: boolean
  requireGateEntry: boolean
  requireBatch: boolean
  requireSerial: boolean
  requireExpiry: boolean
  duplicateChallanPolicy: DuplicateChallanPolicy
  autoCreateQualityInspection: boolean
  autoCompleteRef: boolean
  allowAcceptanceUnderDeviation: boolean
  deviationApproverRole: PurchaseApprovalMatrixRole | null
  allowRejectedStockInQuarantine: boolean
  allowDirectInvoice: boolean
  requirePoMatch: boolean
  requireGrnMatch: boolean
  quantityTolerancePct: number
  rateTolerancePct: number
  amountToleranceInr: number
  amountTolerancePct: number
  taxToleranceInr: number
  taxTolerancePct: number
  allowAuthorizedOverride: boolean
  defaultGstScheme: PurchaseGstScheme
  placeOfSupplyState: string | null
  placeOfSupplyStateCode: string | null
  reverseChargeDefault: boolean
  tcsEnabled: boolean
  tdsEnabled: boolean
  roundOffRule: PurchaseGstRoundOffRule
  printCompanyName: string | null
  printLogoUrl: string | null
  showTermsOnPo: boolean
  showTermsOnGrn: boolean
  showTermsOnInvoice: boolean
  printDefaultCopies: number
  printPaperSize: PurchasePrintPaperSize
  printOrientation: PurchasePrintOrientation
  selfApprovalPolicy: SelfApprovalPolicy
  inspectionRequiredCategories: string[]
  approvalMatrix: Array<{
    id: string
    minAmount: number
    maxAmount: number | null
    requiredRoles: PurchaseApprovalMatrixRole[]
    sortOrder: number
    isActive: boolean
    label: string
    documentType: 'ALL' | 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'
  }>
  isConfigured: boolean
  version: number
}

function mapTenantSetup(tenantSetup: NonNullable<
  Awaited<ReturnType<typeof prisma.purchaseSettings.findUnique>>
> & {
  approvalTiers?: Array<{
    id: string
    minAmount: unknown
    maxAmount: unknown
    sortOrder: number
    isActive: boolean
    label: string
    documentType: 'ALL' | 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER'
    roles: Array<{ role: PurchaseApprovalMatrixRole; sortOrder: number }>
  }>
  inspectionCategories?: Array<{ categoryCode: string }>
}): EffectivePurchaseDefaults {
  return {
    defaultPlantId: tenantSetup.defaultPlantId,
    defaultWarehouseId: tenantSetup.defaultWarehouseId,
    defaultRequisitionWarehouseId: tenantSetup.defaultRequisitionWarehouseId,
    defaultReceivingLocationId: tenantSetup.defaultReceivingLocationId,
    defaultQualityHoldLocationId: tenantSetup.defaultQualityHoldLocationId,
    defaultRejectedLocationId: tenantSetup.defaultRejectedLocationId,
    defaultVendorReturnLocationId: tenantSetup.defaultVendorReturnLocationId,
    defaultCurrencyCode: tenantSetup.defaultCurrencyCode,
    defaultPaymentTermCode: tenantSetup.defaultPaymentTermCode,
    defaultPaymentTermName: tenantSetup.defaultPaymentTermName,
    defaultDeliveryTerms: tenantSetup.defaultDeliveryTerms,
    defaultBuyerId: tenantSetup.defaultBuyerId,
    defaultRfqRequired: tenantSetup.defaultRfqRequired,
    allowDirectPo: tenantSetup.allowDirectPo,
    requirePrBeforePo: tenantSetup.requirePrBeforePo,
    requireRfqAboveAmount:
      tenantSetup.requireRfqAboveAmount == null
        ? null
        : Number(tenantSetup.requireRfqAboveAmount),
    minimumRfqVendorCount: tenantSetup.minimumRfqVendorCount,
    requireQuotationComparison: tenantSetup.requireQuotationComparison,
    requirePoWarehouse: tenantSetup.requirePoWarehouse,
    requireExpectedDeliveryDate: tenantSetup.requireExpectedDeliveryDate,
    requirePaymentTerms: tenantSetup.requirePaymentTerms,
    allowOverReceipt: tenantSetup.allowOverReceipt,
    overReceiptTolerancePct: Number(tenantSetup.overReceiptTolerancePct ?? 0),
    allowShortClose: tenantSetup.allowShortClose,
    requireVendorChallan: tenantSetup.requireVendorChallan,
    requireVehicleNumber: tenantSetup.requireVehicleNumber,
    requireGateEntry: tenantSetup.requireGateEntry,
    requireBatch: tenantSetup.requireBatch,
    requireSerial: tenantSetup.requireSerial,
    requireExpiry: tenantSetup.requireExpiry,
    duplicateChallanPolicy: tenantSetup.duplicateChallanPolicy,
    autoCreateQualityInspection: tenantSetup.autoCreateQualityInspection,
    autoCompleteRef: tenantSetup.autoCompleteRef,
    allowAcceptanceUnderDeviation: tenantSetup.allowAcceptanceUnderDeviation,
    deviationApproverRole: tenantSetup.deviationApproverRole,
    allowRejectedStockInQuarantine: tenantSetup.allowRejectedStockInQuarantine,
    allowDirectInvoice: tenantSetup.allowDirectInvoice,
    requirePoMatch: tenantSetup.requirePoMatch,
    requireGrnMatch: tenantSetup.requireGrnMatch,
    quantityTolerancePct: Number(tenantSetup.quantityTolerancePct ?? 0),
    rateTolerancePct: Number(tenantSetup.rateTolerancePct ?? 0),
    amountToleranceInr: Number(tenantSetup.amountToleranceInr ?? 0),
    amountTolerancePct: Number(tenantSetup.amountTolerancePct ?? 0),
    taxToleranceInr: Number(tenantSetup.taxToleranceInr ?? 0),
    taxTolerancePct: Number(tenantSetup.taxTolerancePct ?? 0),
    allowAuthorizedOverride: tenantSetup.allowAuthorizedOverride,
    defaultGstScheme: tenantSetup.defaultGstScheme,
    placeOfSupplyState: tenantSetup.placeOfSupplyState,
    placeOfSupplyStateCode: tenantSetup.placeOfSupplyStateCode,
    reverseChargeDefault: tenantSetup.reverseChargeDefault,
    tcsEnabled: tenantSetup.tcsEnabled,
    tdsEnabled: tenantSetup.tdsEnabled,
    roundOffRule: tenantSetup.roundOffRule,
    printCompanyName: tenantSetup.printCompanyName,
    printLogoUrl: tenantSetup.printLogoUrl,
    showTermsOnPo: tenantSetup.showTermsOnPo,
    showTermsOnGrn: tenantSetup.showTermsOnGrn,
    showTermsOnInvoice: tenantSetup.showTermsOnInvoice,
    printDefaultCopies: tenantSetup.printDefaultCopies,
    printPaperSize: tenantSetup.printPaperSize,
    printOrientation: tenantSetup.printOrientation,
    selfApprovalPolicy: tenantSetup.selfApprovalPolicy,
    inspectionRequiredCategories: (tenantSetup.inspectionCategories ?? []).map(
      (c) => c.categoryCode,
    ),
    approvalMatrix: (tenantSetup.approvalTiers ?? []).map((tier) => ({
      id: tier.id,
      minAmount: Number(tier.minAmount),
      maxAmount: tier.maxAmount == null ? null : Number(tier.maxAmount),
      requiredRoles: [...tier.roles]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => r.role),
      sortOrder: tier.sortOrder,
      isActive: tier.isActive,
      label: tier.label,
      documentType: tier.documentType,
    })),
    isConfigured: true,
    version: tenantSetup.version,
  }
}

/**
 * Resolve effective purchase defaults.
 * Priority for warehouse/location fields: plant override → tenant setup → null.
 * Policy flags always come from tenant setup (with server defaults when unconfigured).
 */
export async function resolveEffectivePurchaseDefaults(
  tenantId: string,
  plantId?: string | null,
): Promise<EffectivePurchaseDefaults> {
  const [tenantSetup, plantSetup] = await Promise.all([
    prisma.purchaseSettings.findUnique({
      where: { tenantId },
      include: {
        approvalTiers: { include: { roles: true }, orderBy: { sortOrder: 'asc' } },
        inspectionCategories: true,
      },
    }),
    plantId
      ? prisma.purchasePlantSettings.findUnique({
          where: { tenantId_plantId: { tenantId, plantId } },
        })
      : Promise.resolve(null),
  ])

  const base: EffectivePurchaseDefaults = tenantSetup
    ? mapTenantSetup(tenantSetup)
    : {
        ...SERVER_DEFAULT_SETUP,
        requireRfqAboveAmount: SERVER_DEFAULT_SETUP.requireRfqAboveAmount,
        inspectionRequiredCategories: [],
        approvalMatrix: [],
        isConfigured: false,
      }

  if (!plantSetup) return base

  return {
    ...base,
    defaultWarehouseId: plantSetup.defaultWarehouseId ?? base.defaultWarehouseId,
    defaultReceivingLocationId:
      plantSetup.defaultReceivingLocationId ?? base.defaultReceivingLocationId,
    defaultQualityHoldLocationId:
      plantSetup.defaultQualityHoldLocationId ?? base.defaultQualityHoldLocationId,
    defaultRejectedLocationId:
      plantSetup.defaultRejectedLocationId ?? base.defaultRejectedLocationId,
    defaultVendorReturnLocationId:
      plantSetup.defaultVendorReturnLocationId ?? base.defaultVendorReturnLocationId,
  }
}

/** Resolve approval role chain for a document amount from persisted matrix. */
export function resolveApprovalRolesFromDefaults(
  defaults: EffectivePurchaseDefaults,
  amount: number,
  documentType: 'PURCHASE_REQUISITION' | 'PURCHASE_ORDER',
): PurchaseApprovalMatrixRole[] {
  const tiers = [...defaults.approvalMatrix]
    .filter((t) => t.isActive)
    .filter(
      (t) =>
        t.documentType === 'ALL' ||
        t.documentType === documentType,
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const match =
    tiers.find(
      (t) => amount >= t.minAmount && (t.maxAmount == null || amount <= t.maxAmount),
    ) ?? tiers[tiers.length - 1]
  return match?.requiredRoles?.length ? [...match.requiredRoles] : ['PURCHASE_HEAD']
}

/** Permission that unlocks maker-checker bypass under the PERMISSION_ONLY policy. */
export const SELF_APPROVE_PERMISSION = 'purchase.approvals.self_approve'

/**
 * Maker-checker override check for PR/PO approvals.
 * NEVER → false; EVERYONE → true; PERMISSION_ONLY → actor must hold
 * purchase.approvals.self_approve. The approval itself is still audited.
 */
export async function isSelfApprovalAllowed(
  tenantId: string,
  actorPermissions: readonly string[],
): Promise<boolean> {
  const effective = await resolveEffectivePurchaseDefaults(tenantId)
  switch (effective.selfApprovalPolicy) {
    case 'EVERYONE':
      return true
    case 'PERMISSION_ONLY':
      return permissionSetIncludes(actorPermissions, SELF_APPROVE_PERMISSION)
    default:
      return false
  }
}

/**
 * Resolve delivery warehouse for a new PO.
 * Priority: explicit → source document → plant/tenant setup → null.
 * Never picks the first warehouse from a master list.
 */
export async function resolveDeliveryWarehouseId(opts: {
  tenantId: string
  explicitWarehouseId?: string | null
  sourceWarehouseId?: string | null
  plantId?: string | null
}): Promise<string | null> {
  if (opts.explicitWarehouseId) return opts.explicitWarehouseId
  if (opts.sourceWarehouseId) return opts.sourceWarehouseId
  const effective = await resolveEffectivePurchaseDefaults(opts.tenantId, opts.plantId)
  return effective.defaultWarehouseId
}
