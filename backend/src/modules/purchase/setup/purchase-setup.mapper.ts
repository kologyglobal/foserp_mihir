import type {
  CodeSeriesEntity,
  PurchaseApprovalMatrixRole,
  PurchaseApprovalTierDocumentType,
  PurchaseGstRoundOffRule,
  PurchaseGstScheme,
  PurchasePlantSettings,
  PurchasePrintOrientation,
  PurchasePrintPaperSize,
} from '@prisma/client'
import { SERVER_DEFAULT_SETUP, type PurchaseSettingsWithRelations } from './purchase-setup.repository.js'

const NOTIFICATIONS_ON_HOLD = {
  status: 'ON_HOLD' as const,
  message:
    'Purchase notifications are not implemented yet. This tab is visible for planning only and is not saved.',
  prPendingApproval: { inApp: false, email: false },
  rfqResponseDue: { inApp: false, email: false },
  poDeliveryApproaching: { inApp: false, email: false },
  poOverdue: { inApp: false, email: false },
  grnPendingInspection: { inApp: false, email: false },
  invoiceMismatch: { inApp: false, email: false },
  invoicePendingApproval: { inApp: false, email: false },
}

export const NUMBER_SERIES_ENTITY_MAP = {
  purchaseRequisition: 'PURCHASE_REQUISITION',
  rfq: 'REQUEST_FOR_QUOTATION',
  vendorQuotation: 'VENDOR_QUOTATION',
  purchaseOrder: 'PURCHASE_ORDER',
  grn: 'GOODS_RECEIPT',
  qualityInspection: 'QUALITY_INSPECTION',
  purchaseInvoice: 'PURCHASE_INVOICE',
  purchaseReturn: 'PURCHASE_RETURN',
} as const satisfies Record<string, CodeSeriesEntity>

export type NumberSeriesKey = keyof typeof NUMBER_SERIES_ENTITY_MAP

const num = (value: unknown, fallback = 0) =>
  value == null || value === '' ? fallback : Number(value)

function roleToApi(role: PurchaseApprovalMatrixRole): string {
  switch (role) {
    case 'DEPARTMENT_HEAD':
      return 'department_head'
    case 'PURCHASE_HEAD':
      return 'purchase_head'
    case 'FINANCE_HEAD':
      return 'finance_head'
    case 'MANAGEMENT':
      return 'management'
    default:
      return 'purchase_head'
  }
}

export function roleFromApi(role: string): PurchaseApprovalMatrixRole {
  switch (role) {
    case 'department_head':
      return 'DEPARTMENT_HEAD'
    case 'purchase_head':
      return 'PURCHASE_HEAD'
    case 'finance_head':
      return 'FINANCE_HEAD'
    case 'management':
      return 'MANAGEMENT'
    default:
      return 'PURCHASE_HEAD'
  }
}

function docTypeToApi(value: PurchaseApprovalTierDocumentType): string {
  switch (value) {
    case 'PURCHASE_REQUISITION':
      return 'purchase_requisition'
    case 'PURCHASE_ORDER':
      return 'purchase_order'
    default:
      return 'all'
  }
}

export function docTypeFromApi(value: string | undefined): PurchaseApprovalTierDocumentType {
  switch (value) {
    case 'purchase_requisition':
      return 'PURCHASE_REQUISITION'
    case 'purchase_order':
      return 'PURCHASE_ORDER'
    default:
      return 'ALL'
  }
}

function gstToApi(value: PurchaseGstScheme): 'cgst_sgst' | 'igst' {
  return value === 'IGST' ? 'igst' : 'cgst_sgst'
}

export function gstFromApi(value: string | undefined): PurchaseGstScheme {
  return value === 'igst' ? 'IGST' : 'CGST_SGST'
}

function roundOffToApi(value: PurchaseGstRoundOffRule): 'none' | 'nearest_rupee' | 'nearest_paisa' {
  switch (value) {
    case 'NONE':
      return 'none'
    case 'NEAREST_PAISA':
      return 'nearest_paisa'
    default:
      return 'nearest_rupee'
  }
}

export function roundOffFromApi(value: string | undefined): PurchaseGstRoundOffRule {
  switch (value) {
    case 'none':
      return 'NONE'
    case 'nearest_paisa':
      return 'NEAREST_PAISA'
    default:
      return 'NEAREST_RUPEE'
  }
}

function paperToApi(value: PurchasePrintPaperSize): 'A4' | 'Letter' {
  return value === 'LETTER' ? 'Letter' : 'A4'
}

export function paperFromApi(value: string | undefined): PurchasePrintPaperSize {
  return value === 'Letter' || value === 'LETTER' ? 'LETTER' : 'A4'
}

function orientationToApi(value: PurchasePrintOrientation): 'portrait' | 'landscape' {
  return value === 'LANDSCAPE' ? 'landscape' : 'portrait'
}

export function orientationFromApi(value: string | undefined): PurchasePrintOrientation {
  return value === 'landscape' || value === 'LANDSCAPE' ? 'LANDSCAPE' : 'PORTRAIT'
}

export type NumberSeriesDto = Record<
  NumberSeriesKey,
  { prefix: string; padLength: number; nextNumber: number }
>

export function mapPurchaseSettingsToDto(
  row: PurchaseSettingsWithRelations | null,
  numberSeries: NumberSeriesDto,
  extras?: { isConfigured?: boolean },
) {
  if (!row) {
    const d = SERVER_DEFAULT_SETUP
    return {
      id: null,
      tenantId: null,
      isConfigured: false,
      version: 0,
      selfApprovalPolicy: d.selfApprovalPolicy,
      general: {
        defaultPlantId: d.defaultPlantId,
        defaultWarehouseId: d.defaultWarehouseId,
        defaultBuyerId: d.defaultBuyerId,
        defaultCurrency: d.defaultCurrencyCode,
        defaultPaymentTerms: d.defaultPaymentTermName,
        defaultPaymentTermCode: d.defaultPaymentTermCode,
        defaultDeliveryTerms: d.defaultDeliveryTerms ?? '',
        allowDirectPo: d.allowDirectPo,
        requirePrBeforePo: d.requirePrBeforePo,
        requireRfqAboveAmountInr: d.requireRfqAboveAmount ?? 0,
        minimumRfqVendorCount: d.minimumRfqVendorCount,
        requireQuotationComparison: d.requireQuotationComparison,
        allowOverReceipt: d.allowOverReceipt,
        overReceiptTolerancePct: d.overReceiptTolerancePct,
        allowShortClose: d.allowShortClose,
        requirePoWarehouse: d.requirePoWarehouse,
        requireExpectedDeliveryDate: d.requireExpectedDeliveryDate,
        requirePaymentTerms: d.requirePaymentTerms,
      },
      requisition: {
        skipRfq: !d.defaultRfqRequired,
        defaultWarehouseId: d.defaultRequisitionWarehouseId,
        autoCompleteRef: d.autoCompleteRef,
      },
      numberSeries,
      approvalMatrix: [] as Array<{
        id: string
        minAmount: number
        maxAmount: number | null
        requiredRoles: string[]
        sortOrder: number
        isActive: boolean
        label: string
        documentType: string
      }>,
      tax: {
        defaultGstScheme: gstToApi(d.defaultGstScheme),
        placeOfSupplyState: d.placeOfSupplyState ?? '',
        placeOfSupplyStateCode: d.placeOfSupplyStateCode ?? '',
        reverseChargeDefault: d.reverseChargeDefault,
        tcsEnabled: d.tcsEnabled,
        tdsEnabled: d.tdsEnabled,
        roundOffRule: roundOffToApi(d.roundOffRule),
      },
      invoiceMatchTolerances: {
        requirePoMatch: d.requirePoMatch,
        requireGrnMatch: d.requireGrnMatch,
        quantityTolerancePct: d.quantityTolerancePct,
        rateTolerancePct: d.rateTolerancePct,
        amountToleranceInr: d.amountToleranceInr,
        amountTolerancePct: d.amountTolerancePct,
        taxToleranceInr: d.taxToleranceInr,
        taxTolerancePct: d.taxTolerancePct,
        allowAuthorizedOverride: d.allowAuthorizedOverride,
      },
      allowDirectInvoice: d.allowDirectInvoice,
      receiving: {
        requireGateEntry: d.requireGateEntry,
        requireVendorChallan: d.requireVendorChallan,
        requireVehicleNumber: d.requireVehicleNumber,
        requireBatch: d.requireBatch,
        requireSerial: d.requireSerial,
        requireExpiry: d.requireExpiry,
        autoCreateInspection: d.autoCreateQualityInspection,
        defaultReceivingLocationId: d.defaultReceivingLocationId,
        duplicateChallanPolicy: d.duplicateChallanPolicy,
      },
      quality: {
        inspectionRequiredCategories: [] as string[],
        allowAcceptanceUnderDeviation: d.allowAcceptanceUnderDeviation,
        deviationApproverRole: d.deviationApproverRole
          ? roleToApi(d.deviationApproverRole)
          : 'purchase_head',
        allowRejectedStockInQuarantine: d.allowRejectedStockInQuarantine,
        defaultQualityHoldLocationId: d.defaultQualityHoldLocationId,
        defaultRejectedLocationId: d.defaultRejectedLocationId,
        defaultVendorReturnLocationId: d.defaultVendorReturnLocationId,
      },
      print: {
        companyName: d.printCompanyName ?? '',
        logoUrl: d.printLogoUrl,
        logoPlaceholderUrl: d.printLogoUrl,
        showTermsOnPo: d.showTermsOnPo,
        showTermsOnGrn: d.showTermsOnGrn,
        showTermsOnInvoice: d.showTermsOnInvoice,
        defaultCopies: d.printDefaultCopies,
        paperSize: paperToApi(d.printPaperSize),
        orientation: orientationToApi(d.printOrientation),
      },
      notifications: NOTIFICATIONS_ON_HOLD,
      createdById: null,
      updatedById: null,
      createdAt: null,
      updatedAt: null,
      ...extras,
    }
  }

  return {
    id: row.id,
    tenantId: row.tenantId,
    isConfigured: extras?.isConfigured ?? true,
    version: row.version,
    selfApprovalPolicy: row.selfApprovalPolicy,
    general: {
      defaultPlantId: row.defaultPlantId,
      defaultWarehouseId: row.defaultWarehouseId,
      defaultBuyerId: row.defaultBuyerId,
      defaultCurrency: row.defaultCurrencyCode,
      defaultPaymentTerms: row.defaultPaymentTermName,
      defaultPaymentTermCode: row.defaultPaymentTermCode,
      defaultDeliveryTerms: row.defaultDeliveryTerms ?? '',
      allowDirectPo: row.allowDirectPo,
      requirePrBeforePo: row.requirePrBeforePo,
      requireRfqAboveAmountInr: num(row.requireRfqAboveAmount, 0),
      minimumRfqVendorCount: row.minimumRfqVendorCount,
      requireQuotationComparison: row.requireQuotationComparison,
      allowOverReceipt: row.allowOverReceipt,
      overReceiptTolerancePct: num(row.overReceiptTolerancePct),
      allowShortClose: row.allowShortClose,
      requirePoWarehouse: row.requirePoWarehouse,
      requireExpectedDeliveryDate: row.requireExpectedDeliveryDate,
      requirePaymentTerms: row.requirePaymentTerms,
    },
    requisition: {
      skipRfq: !row.defaultRfqRequired,
      defaultWarehouseId: row.defaultRequisitionWarehouseId,
      autoCompleteRef: row.autoCompleteRef,
    },
    numberSeries,
    approvalMatrix: row.approvalTiers.map((tier) => ({
      id: tier.id,
      minAmount: num(tier.minAmount),
      maxAmount: tier.maxAmount == null ? null : num(tier.maxAmount),
      requiredRoles: [...tier.roles]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((r) => roleToApi(r.role)),
      sortOrder: tier.sortOrder,
      isActive: tier.isActive,
      label: tier.label,
      documentType: docTypeToApi(tier.documentType),
    })),
    tax: {
      defaultGstScheme: gstToApi(row.defaultGstScheme),
      placeOfSupplyState: row.placeOfSupplyState ?? '',
      placeOfSupplyStateCode: row.placeOfSupplyStateCode ?? '',
      reverseChargeDefault: row.reverseChargeDefault,
      tcsEnabled: row.tcsEnabled,
      tdsEnabled: row.tdsEnabled,
      roundOffRule: roundOffToApi(row.roundOffRule),
    },
    invoiceMatchTolerances: {
      requirePoMatch: row.requirePoMatch,
      requireGrnMatch: row.requireGrnMatch,
      quantityTolerancePct: num(row.quantityTolerancePct),
      rateTolerancePct: num(row.rateTolerancePct),
      amountToleranceInr: num(row.amountToleranceInr),
      amountTolerancePct: num(row.amountTolerancePct),
      taxToleranceInr: num(row.taxToleranceInr),
      taxTolerancePct: num(row.taxTolerancePct),
      allowAuthorizedOverride: row.allowAuthorizedOverride,
    },
    allowDirectInvoice: row.allowDirectInvoice,
    receiving: {
      requireGateEntry: row.requireGateEntry,
      requireVendorChallan: row.requireVendorChallan,
      requireVehicleNumber: row.requireVehicleNumber,
      requireBatch: row.requireBatch,
      requireSerial: row.requireSerial,
      requireExpiry: row.requireExpiry,
      autoCreateInspection: row.autoCreateQualityInspection,
      defaultReceivingLocationId: row.defaultReceivingLocationId,
      duplicateChallanPolicy: row.duplicateChallanPolicy,
    },
    quality: {
      inspectionRequiredCategories: row.inspectionCategories.map((c) => c.categoryCode),
      allowAcceptanceUnderDeviation: row.allowAcceptanceUnderDeviation,
      deviationApproverRole: row.deviationApproverRole
        ? roleToApi(row.deviationApproverRole)
        : 'purchase_head',
      allowRejectedStockInQuarantine: row.allowRejectedStockInQuarantine,
      defaultQualityHoldLocationId: row.defaultQualityHoldLocationId,
      defaultRejectedLocationId: row.defaultRejectedLocationId,
      defaultVendorReturnLocationId: row.defaultVendorReturnLocationId,
    },
    print: {
      companyName: row.printCompanyName ?? '',
      logoUrl: row.printLogoUrl,
      logoPlaceholderUrl: row.printLogoUrl,
      showTermsOnPo: row.showTermsOnPo,
      showTermsOnGrn: row.showTermsOnGrn,
      showTermsOnInvoice: row.showTermsOnInvoice,
      defaultCopies: row.printDefaultCopies,
      paperSize: paperToApi(row.printPaperSize),
      orientation: orientationToApi(row.printOrientation),
    },
    notifications: NOTIFICATIONS_ON_HOLD,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function mapPurchasePlantSettingsToDto(row: PurchasePlantSettings) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    plantId: row.plantId,
    defaultWarehouseId: row.defaultWarehouseId,
    defaultReceivingLocationId: row.defaultReceivingLocationId,
    defaultQualityHoldLocationId: row.defaultQualityHoldLocationId,
    defaultRejectedLocationId: row.defaultRejectedLocationId,
    defaultVendorReturnLocationId: row.defaultVendorReturnLocationId,
    createdById: row.createdById,
    updatedById: row.updatedById,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
