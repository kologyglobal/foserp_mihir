import type {
  DuplicateChallanPolicy,
  Prisma,
  PurchaseApprovalMatrixRole,
  PurchaseApprovalTierDocumentType,
  PurchaseGstRoundOffRule,
  PurchaseGstScheme,
  PurchasePlantSettings,
  PurchasePrintOrientation,
  PurchasePrintPaperSize,
  PurchaseSettings,
  SelfApprovalPolicy,
} from '@prisma/client'
import { prisma } from '../../../config/database.js'

export type PurchaseSettingsRow = PurchaseSettings
export type PurchasePlantSettingsRow = PurchasePlantSettings

export type PurchaseSettingsWithRelations = PurchaseSettings & {
  approvalTiers: Array<{
    id: string
    minAmount: Prisma.Decimal
    maxAmount: Prisma.Decimal | null
    sortOrder: number
    isActive: boolean
    label: string
    documentType: PurchaseApprovalTierDocumentType
    roles: Array<{ role: PurchaseApprovalMatrixRole; sortOrder: number }>
  }>
  inspectionCategories: Array<{ categoryCode: string }>
}

export const SERVER_DEFAULT_SETUP = {
  defaultPlantId: null as string | null,
  defaultWarehouseId: null as string | null,
  defaultRequisitionWarehouseId: null as string | null,
  defaultReceivingLocationId: null as string | null,
  defaultQualityHoldLocationId: null as string | null,
  defaultRejectedLocationId: null as string | null,
  defaultVendorReturnLocationId: null as string | null,
  defaultCurrencyCode: 'INR',
  defaultPaymentTermCode: null as string | null,
  defaultPaymentTermName: null as string | null,
  defaultDeliveryTerms: null as string | null,
  defaultBuyerId: null as string | null,
  defaultRfqRequired: true,
  allowDirectPo: true,
  requirePrBeforePo: false,
  requireRfqAboveAmount: null as number | null,
  minimumRfqVendorCount: 1,
  requireQuotationComparison: false,
  requirePoWarehouse: false,
  requireExpectedDeliveryDate: false,
  requirePaymentTerms: false,
  allowOverReceipt: false,
  overReceiptTolerancePct: 0,
  allowShortClose: true,
  requireVendorChallan: false,
  requireVehicleNumber: false,
  requireGateEntry: false,
  requireBatch: false,
  requireSerial: false,
  requireExpiry: false,
  duplicateChallanPolicy: 'BLOCK' as DuplicateChallanPolicy,
  autoCreateQualityInspection: false,
  autoCompleteRef: false,
  allowAcceptanceUnderDeviation: false,
  deviationApproverRole: null as PurchaseApprovalMatrixRole | null,
  allowRejectedStockInQuarantine: true,
  allowDirectInvoice: false,
  requirePoMatch: true,
  requireGrnMatch: true,
  quantityTolerancePct: 0,
  rateTolerancePct: 0,
  amountToleranceInr: 0,
  amountTolerancePct: 0,
  taxToleranceInr: 0,
  taxTolerancePct: 0,
  allowAuthorizedOverride: true,
  defaultGstScheme: 'CGST_SGST' as PurchaseGstScheme,
  placeOfSupplyState: null as string | null,
  placeOfSupplyStateCode: null as string | null,
  reverseChargeDefault: false,
  tcsEnabled: false,
  tdsEnabled: false,
  roundOffRule: 'NEAREST_RUPEE' as PurchaseGstRoundOffRule,
  printCompanyName: null as string | null,
  printLogoUrl: null as string | null,
  showTermsOnPo: true,
  showTermsOnGrn: false,
  showTermsOnInvoice: true,
  printDefaultCopies: 1,
  printPaperSize: 'A4' as PurchasePrintPaperSize,
  printOrientation: 'PORTRAIT' as PurchasePrintOrientation,
  selfApprovalPolicy: 'PERMISSION_ONLY' as SelfApprovalPolicy,
  version: 0,
}

const settingsInclude = {
  approvalTiers: {
    include: { roles: { orderBy: { sortOrder: 'asc' as const } } },
    orderBy: { sortOrder: 'asc' as const },
  },
  inspectionCategories: true,
} satisfies Prisma.PurchaseSettingsInclude

export async function findPurchaseSettings(
  tenantId: string,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseSettings.findUnique({
    where: { tenantId },
    include: settingsInclude,
  }) as Promise<PurchaseSettingsWithRelations | null>
}

export async function createPurchaseSettings(
  tenantId: string,
  actorId: string,
  data: Omit<
    Prisma.PurchaseSettingsUncheckedCreateInput,
    'tenantId' | 'createdById' | 'updatedById' | 'version' | 'approvalTiers' | 'inspectionCategories'
  >,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchaseSettings.create({
    data: {
      ...data,
      tenantId,
      createdById: actorId,
      updatedById: actorId,
      version: 1,
    },
    include: settingsInclude,
  }) as Promise<PurchaseSettingsWithRelations>
}

export async function updatePurchaseSettings(
  tenantId: string,
  actorId: string,
  expectedVersion: number,
  data: Prisma.PurchaseSettingsUncheckedUpdateInput,
  tx: Prisma.TransactionClient = prisma,
) {
  const result = await tx.purchaseSettings.updateMany({
    where: { tenantId, version: expectedVersion },
    data: {
      ...data,
      updatedById: actorId,
      version: { increment: 1 },
    },
  })
  if (result.count === 0) return null
  return tx.purchaseSettings.findUnique({
    where: { tenantId },
    include: settingsInclude,
  }) as Promise<PurchaseSettingsWithRelations | null>
}

export async function replaceApprovalTiers(
  tenantId: string,
  purchaseSettingsId: string,
  tiers: Array<{
    minAmount: number
    maxAmount: number | null
    sortOrder: number
    isActive: boolean
    label: string
    documentType: PurchaseApprovalTierDocumentType
    roles: PurchaseApprovalMatrixRole[]
  }>,
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchaseApprovalTierRole.deleteMany({
    where: { tier: { tenantId, purchaseSettingsId } },
  })
  await tx.purchaseApprovalTier.deleteMany({ where: { tenantId, purchaseSettingsId } })

  for (const tier of tiers) {
    await tx.purchaseApprovalTier.create({
      data: {
        tenantId,
        purchaseSettingsId,
        minAmount: tier.minAmount,
        maxAmount: tier.maxAmount,
        sortOrder: tier.sortOrder,
        isActive: tier.isActive,
        label: tier.label,
        documentType: tier.documentType,
        roles: {
          create: tier.roles.map((role, idx) => ({
            role,
            sortOrder: idx + 1,
          })),
        },
      },
    })
  }
}

export async function replaceInspectionCategories(
  tenantId: string,
  purchaseSettingsId: string,
  categoryCodes: string[],
  tx: Prisma.TransactionClient = prisma,
) {
  await tx.purchaseInspectionCategory.deleteMany({ where: { tenantId, purchaseSettingsId } })
  if (categoryCodes.length === 0) return
  await tx.purchaseInspectionCategory.createMany({
    data: categoryCodes.map((categoryCode) => ({
      tenantId,
      purchaseSettingsId,
      categoryCode,
    })),
  })
}

export async function listPlantSettings(tenantId: string) {
  return prisma.purchasePlantSettings.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'asc' },
  })
}

export async function findPlantSettings(tenantId: string, plantId: string) {
  return prisma.purchasePlantSettings.findUnique({
    where: { tenantId_plantId: { tenantId, plantId } },
  })
}

export async function upsertPlantSettings(
  tenantId: string,
  plantId: string,
  actorId: string,
  data: Omit<
    Prisma.PurchasePlantSettingsUncheckedCreateInput,
    'id' | 'tenantId' | 'plantId' | 'createdById' | 'updatedById' | 'createdAt' | 'updatedAt'
  >,
  tx: Prisma.TransactionClient = prisma,
) {
  return tx.purchasePlantSettings.upsert({
    where: { tenantId_plantId: { tenantId, plantId } },
    create: {
      tenantId,
      plantId,
      ...data,
      createdById: actorId,
      updatedById: actorId,
    },
    update: {
      ...data,
      updatedById: actorId,
    },
  })
}
