import { apiRequest, tenantPath } from './client'

export type ApiDuplicateChallanPolicy = 'BLOCK' | 'WARN' | 'ALLOW'

export type ApiSelfApprovalPolicy = 'NEVER' | 'PERMISSION_ONLY' | 'EVERYONE'

export type ApiGstScheme = 'cgst_sgst' | 'igst'

export type ApiRoundOffRule = 'none' | 'nearest_rupee' | 'nearest_paisa'

export type ApiPrintPaperSize = 'A4' | 'Letter'

export type ApiPrintOrientation = 'portrait' | 'landscape'

export interface ApiPurchaseSetupGeneral {
  defaultPlantId: string | null
  defaultWarehouseId: string | null
  defaultBuyerId: string | null
  defaultCurrency: string
  defaultPaymentTerms: string | null
  defaultPaymentTermCode: string | null
  defaultDeliveryTerms: string
  allowDirectPo: boolean
  requirePrBeforePo: boolean
  requireRfqAboveAmountInr: number
  minimumRfqVendorCount: number
  requireQuotationComparison: boolean
  allowOverReceipt: boolean
  overReceiptTolerancePct: number
  allowShortClose: boolean
  requirePoWarehouse: boolean
  requireExpectedDeliveryDate: boolean
  requirePaymentTerms: boolean
}

export interface ApiPurchaseSetupRequisition {
  skipRfq: boolean
  defaultWarehouseId: string | null
  autoCompleteRef: boolean
}

export interface ApiPurchaseNumberSeriesEntry {
  prefix: string
  padLength: number
  /** Read-only — allocated by the server (`currentValue + 1`). */
  nextNumber: number
}

export type ApiPurchaseNumberSeriesKey =
  | 'purchaseRequisition'
  | 'rfq'
  | 'vendorQuotation'
  | 'purchaseOrder'
  | 'grn'
  | 'qualityInspection'
  | 'purchaseInvoice'
  | 'purchaseReturn'

export type ApiPurchaseSetupNumberSeries = Record<
  ApiPurchaseNumberSeriesKey,
  ApiPurchaseNumberSeriesEntry
>

export interface ApiPurchaseApprovalTier {
  id: string
  minAmount: number
  maxAmount: number | null
  requiredRoles: string[]
  sortOrder: number
  isActive: boolean
  label: string
  documentType: string
}

export interface ApiPurchaseSetupTax {
  defaultGstScheme: ApiGstScheme
  placeOfSupplyState: string
  placeOfSupplyStateCode: string
  reverseChargeDefault: boolean
  tcsEnabled: boolean
  tdsEnabled: boolean
  roundOffRule: ApiRoundOffRule
}

export interface ApiPurchaseInvoiceMatchTolerances {
  requirePoMatch: boolean
  requireGrnMatch: boolean
  quantityTolerancePct: number
  rateTolerancePct: number
  amountToleranceInr: number
  amountTolerancePct: number
  taxToleranceInr: number
  taxTolerancePct: number
  allowAuthorizedOverride: boolean
}

export interface ApiPurchaseSetupReceiving {
  requireGateEntry: boolean
  requireVendorChallan: boolean
  requireVehicleNumber: boolean
  requireBatch: boolean
  requireSerial: boolean
  requireExpiry: boolean
  autoCreateInspection: boolean
  defaultReceivingLocationId: string | null
  duplicateChallanPolicy: ApiDuplicateChallanPolicy
}

export interface ApiPurchaseSetupQuality {
  inspectionRequiredCategories: string[]
  allowAcceptanceUnderDeviation: boolean
  deviationApproverRole: string
  allowRejectedStockInQuarantine: boolean
  defaultQualityHoldLocationId: string | null
  defaultRejectedLocationId: string | null
  defaultVendorReturnLocationId: string | null
}

export interface ApiPurchaseSetupPrint {
  companyName: string
  logoUrl: string | null
  /** @deprecated alias of logoUrl echoed by the API. */
  logoPlaceholderUrl: string | null
  showTermsOnPo: boolean
  showTermsOnGrn: boolean
  showTermsOnInvoice: boolean
  defaultCopies: number
  paperSize: ApiPrintPaperSize
  orientation: ApiPrintOrientation
}

export interface ApiPurchaseNotificationFlags {
  inApp: boolean
  email: boolean
}

/** Read-only — notifications are ON_HOLD server-side and never persisted. */
export interface ApiPurchaseSetupNotifications {
  status: 'ON_HOLD'
  message: string
  prPendingApproval: ApiPurchaseNotificationFlags
  rfqResponseDue: ApiPurchaseNotificationFlags
  poDeliveryApproaching: ApiPurchaseNotificationFlags
  poOverdue: ApiPurchaseNotificationFlags
  grnPendingInspection: ApiPurchaseNotificationFlags
  invoiceMismatch: ApiPurchaseNotificationFlags
  invoicePendingApproval: ApiPurchaseNotificationFlags
}

export interface ApiPurchaseSetup {
  id: string | null
  tenantId: string | null
  isConfigured: boolean
  version: number
  selfApprovalPolicy: ApiSelfApprovalPolicy
  general: ApiPurchaseSetupGeneral
  requisition: ApiPurchaseSetupRequisition
  numberSeries: ApiPurchaseSetupNumberSeries
  approvalMatrix: ApiPurchaseApprovalTier[]
  tax: ApiPurchaseSetupTax
  invoiceMatchTolerances: ApiPurchaseInvoiceMatchTolerances
  allowDirectInvoice: boolean
  receiving: ApiPurchaseSetupReceiving
  quality: ApiPurchaseSetupQuality
  print: ApiPurchaseSetupPrint
  notifications: ApiPurchaseSetupNotifications
  createdById: string | null
  updatedById: string | null
  createdAt: string | null
  updatedAt: string | null
}

export interface ApiPurchaseApprovalTierInput {
  id?: string
  minAmount: number
  maxAmount: number | null
  requiredRoles: string[]
  sortOrder: number
  isActive: boolean
  label: string
  documentType?: string
}

export type ApiPurchaseNumberSeriesInput = Partial<
  Record<ApiPurchaseNumberSeriesKey, { prefix: string; padLength: number }>
>

/** Nested PUT/PATCH body — notifications are intentionally not accepted. */
export interface ApiPurchaseSetupInput {
  version?: number
  selfApprovalPolicy?: ApiSelfApprovalPolicy
  general?: Partial<ApiPurchaseSetupGeneral>
  requisition?: Partial<ApiPurchaseSetupRequisition>
  numberSeries?: ApiPurchaseNumberSeriesInput
  approvalMatrix?: ApiPurchaseApprovalTierInput[]
  tax?: Partial<ApiPurchaseSetupTax>
  invoiceMatchTolerances?: Partial<ApiPurchaseInvoiceMatchTolerances>
  allowDirectInvoice?: boolean
  receiving?: Partial<ApiPurchaseSetupReceiving>
  quality?: Partial<ApiPurchaseSetupQuality>
  print?: Partial<Omit<ApiPurchaseSetupPrint, 'logoPlaceholderUrl'>>
}

export interface ApiPurchasePlantSetup {
  id: string | null
  tenantId: string
  plantId: string
  defaultWarehouseId: string | null
  defaultReceivingLocationId: string | null
  defaultQualityHoldLocationId: string | null
  defaultRejectedLocationId: string | null
  defaultVendorReturnLocationId: string | null
  isConfigured?: boolean
  createdById: string | null
  updatedById: string | null
  createdAt: string | null
  updatedAt: string | null
}

export type ApiPurchasePlantSetupInput = {
  defaultWarehouseId?: string | null
  defaultReceivingLocationId?: string | null
  defaultQualityHoldLocationId?: string | null
  defaultRejectedLocationId?: string | null
  defaultVendorReturnLocationId?: string | null
}

export async function getPurchaseSetupApi() {
  return apiRequest<ApiPurchaseSetup>(tenantPath('/purchase/setup'))
}

export async function putPurchaseSetupApi(body: ApiPurchaseSetupInput) {
  return apiRequest<ApiPurchaseSetup>(tenantPath('/purchase/setup'), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}

export async function patchPurchaseSetupApi(body: ApiPurchaseSetupInput) {
  return apiRequest<ApiPurchaseSetup>(tenantPath('/purchase/setup'), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function listPurchasePlantSetupsApi() {
  return apiRequest<ApiPurchasePlantSetup[]>(tenantPath('/purchase/setup/plants'))
}

export async function getPurchasePlantSetupApi(plantId: string) {
  return apiRequest<ApiPurchasePlantSetup>(tenantPath(`/purchase/setup/plants/${plantId}`))
}

export async function putPurchasePlantSetupApi(plantId: string, body: ApiPurchasePlantSetupInput) {
  return apiRequest<ApiPurchasePlantSetup>(tenantPath(`/purchase/setup/plants/${plantId}`), {
    method: 'PUT',
    body: JSON.stringify(body),
  })
}
