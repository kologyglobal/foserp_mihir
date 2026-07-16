import { useCrmStore } from '../store/crmStore'
import { useSalesStore } from '../store/salesStore'
import { useMasterStore } from '../store/masterStore'
import { resolveInheritedLocationId, locationDisplayLabel } from './locationUtils'
import { isQuotationExpired, validateQuotationForSoConversion } from './crmQuotationSoConversion'
import { quotationLineItemsSummary, summarizeQuotationLinesForSo } from './crmQuotationSoLines'
import {
  canCrmPermission,
  canConvertQuotationToSalesOrderPermission,
} from './permissions/crm'

export { canConvertQuotationToSalesOrderPermission }

export const CREATE_SALES_ORDER_LOCKED_REASON = 'Available after quotation approval.'

const REASON_NO_QUOTATION = 'Create and approve a quotation before creating a sales order.'
/** Single commercial approval step (internal approve also records customer acceptance). */
const REASON_NOT_APPROVED = 'Approve the quotation before creating a sales order.'
const REASON_DRAFT = 'Draft quotations cannot be converted — submit and approve first.'
const REASON_PENDING = 'Quotation is pending approval — convert is available after approval.'
const REASON_EXPIRED = 'Quotation validity has expired.'
const REASON_NO_OPPORTUNITY = 'Link this quotation to an opportunity before creating a sales order.'
const REASON_COMMERCIAL = 'Complete commercial requirements on the quotation first.'
const REASON_LOST = 'Lost or cancelled opportunities cannot be converted to a sales order.'
const REASON_PERMISSION = 'You do not have permission to convert quotations to sales orders.'

export interface OpportunitySalesOrderPrefill {
  opportunityId: string
  opportunityNo: string
  opportunityName: string
  customerId: string
  productId: string
  qty: number
  unitPrice: number
  expectedDeliveryDate: string
  deliveryLocation: string
  locationId: string
  paymentTerms: string
  deliveryTerms: string
  internalRemarks: string
  directSoReason: string
  quotationDocumentId: string | null
  quotationId: string | null
  canConvertQuotation: boolean
  convertDisabledReason: string | null
  salesOrderId: string | null
  quotationLineCount: number
  quotationItemsSummary: string
  quotationGrandTotal: number
}

export interface OpportunityCreateSalesOrderGate {
  /** Show Create Sales Order control (hidden only when SO already linked). */
  showCreate: boolean
  /** Enable click-through to new SO form. */
  enabled: boolean
  disabledReason: string | null
  salesOrderId: string | null
  quotationDocumentId: string | null
  hasQuotation: boolean
  quotationApproved: boolean
  customerAccepted: boolean
  commercialComplete: boolean
  stageReady: boolean
}

/** Won or Order Confirmed — only then may CRM open sales order creation. */
export function isOpportunitySalesOrderStage(
  stage: string,
  status?: string | null,
): boolean {
  if (stage === 'won' || stage === 'order_confirmed') return true
  if (status === 'won') return true
  return false
}

/**
 * Convert Quotation → Sales Order is allowed when:
 * - user has crm.quotation.convert + crm.sales_order.create (not owner-gated)
 * - quotation exists, approved (+ customer accepted), commercial checks pass
 * - opportunity linked and not Lost/Archived (Won is OK — convert links SO)
 * - no sales order linked yet
 *
 * Conversion itself marks the opportunity Won — stageReady is informational only.
 */
export function resolveOpportunityCreateSalesOrderGate(
  opportunityId?: string | null,
  quotationDocumentId?: string | null,
): OpportunityCreateSalesOrderGate {
  const empty: OpportunityCreateSalesOrderGate = {
    showCreate: false,
    enabled: false,
    disabledReason: CREATE_SALES_ORDER_LOCKED_REASON,
    salesOrderId: null,
    quotationDocumentId: null,
    hasQuotation: false,
    quotationApproved: false,
    customerAccepted: false,
    commercialComplete: false,
    stageReady: false,
  }

  const hasConvertPerm = canConvertQuotationToSalesOrderPermission()

  const prefill = resolveOpportunitySalesOrderPrefill(opportunityId, quotationDocumentId)
  if (!prefill) {
    if (quotationDocumentId) {
      return {
        ...empty,
        showCreate: hasConvertPerm,
        disabledReason: hasConvertPerm ? REASON_NO_OPPORTUNITY : REASON_PERMISSION,
        quotationDocumentId,
      }
    }
    return empty
  }

  if (prefill.salesOrderId) {
    return {
      ...empty,
      showCreate: hasConvertPerm || canCrmPermission('crm.sales_order.view'),
      salesOrderId: prefill.salesOrderId,
      quotationDocumentId: prefill.quotationDocumentId,
      hasQuotation: Boolean(prefill.quotationId),
    }
  }

  if (!hasConvertPerm) {
    return {
      ...empty,
      showCreate: false,
      disabledReason: REASON_PERMISSION,
      quotationDocumentId: prefill.quotationDocumentId,
      hasQuotation: Boolean(prefill.quotationId),
    }
  }

  const opportunity = useCrmStore.getState().getOpportunity(prefill.opportunityId)
  if (
    !opportunity
    || opportunity.stage === 'lost'
    || opportunity.status === 'lost'
  ) {
    return {
      ...empty,
      showCreate: true,
      disabledReason: REASON_LOST,
      quotationDocumentId: prefill.quotationDocumentId,
      hasQuotation: Boolean(prefill.quotationId),
    }
  }

  const salesQuo = prefill.quotationId
    ? useSalesStore.getState().getQuotation(prefill.quotationId)
    : undefined
  const doc = prefill.quotationDocumentId
    ? useCrmStore.getState().getQuotationDocument(prefill.quotationDocumentId)
    : undefined

  const hasQuotation = Boolean(prefill.quotationId || prefill.quotationDocumentId)
  const quotationApproved = Boolean(
    (doc && (doc.status === 'approved' || doc.status === 'converted'))
    || (salesQuo && (salesQuo.status === 'approved' || salesQuo.status === 'converted')),
  )
  const customerAccepted = salesQuo?.customerApproval === 'approved'
  const commercialComplete = Boolean(prefill.canConvertQuotation)
  const stageReady = isOpportunitySalesOrderStage(opportunity.stage, opportunity.status)

  const enabled =
    hasQuotation
    && quotationApproved
    && customerAccepted
    && commercialComplete

  let disabledReason: string | null = null
  if (!enabled) {
    const docStatus = doc?.status ?? salesQuo?.status
    if (!hasQuotation) {
      disabledReason = REASON_NO_QUOTATION
    } else if (docStatus === 'draft') {
      disabledReason = REASON_DRAFT
    } else if (docStatus === 'pending_approval' || docStatus === 'sent') {
      disabledReason = REASON_PENDING
    } else if (isQuotationExpired(salesQuo)) {
      disabledReason = REASON_EXPIRED
    } else if (!quotationApproved || !customerAccepted) {
      disabledReason = REASON_NOT_APPROVED
    } else if (!commercialComplete) {
      disabledReason = prefill.convertDisabledReason?.trim() || REASON_COMMERCIAL
    } else {
      disabledReason = CREATE_SALES_ORDER_LOCKED_REASON
    }
  }

  return {
    showCreate: true,
    enabled,
    disabledReason,
    salesOrderId: null,
    quotationDocumentId: prefill.quotationDocumentId,
    hasQuotation,
    quotationApproved,
    customerAccepted,
    commercialComplete,
    stageReady,
  }
}

/** Same Create SO gate, resolved from a quotation document id. */
export function resolveCreateSalesOrderGateForQuotationDocument(
  documentId: string,
): OpportunityCreateSalesOrderGate {
  const doc = useCrmStore.getState().getQuotationDocument(documentId)
  if (!doc) {
    return {
      showCreate: false,
      enabled: false,
      disabledReason: CREATE_SALES_ORDER_LOCKED_REASON,
      salesOrderId: null,
      quotationDocumentId: documentId,
      hasQuotation: false,
      quotationApproved: false,
      customerAccepted: false,
      commercialComplete: false,
      stageReady: false,
    }
  }
  return resolveOpportunityCreateSalesOrderGate(doc.opportunityId, doc.id)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Build new sales order form defaults from an opportunity (and optional approved quotation doc). */
export function resolveOpportunitySalesOrderPrefill(
  opportunityId?: string | null,
  quotationDocumentId?: string | null,
): OpportunitySalesOrderPrefill | null {
  const crm = useCrmStore.getState()
  const docFromParam = quotationDocumentId ? crm.getQuotationDocument(quotationDocumentId) : undefined
  const resolvedOppId = opportunityId ?? docFromParam?.opportunityId ?? null
  if (!resolvedOppId) return null

  const opportunity = crm.getOpportunity(resolvedOppId)
  if (!opportunity) return null

  const masters = useMasterStore.getState()
  const sales = useSalesStore.getState()
  const customer = masters.getCustomer(opportunity.customerId)
  const product = opportunity.productId ? masters.getProduct(opportunity.productId) : undefined

  const doc = docFromParam
    ?? (opportunity.quotationId ? crm.getLatestQuotationDocument(opportunity.quotationId) : undefined)

  const salesQuo = doc?.quotationId
    ? sales.getQuotation(doc.quotationId)
    : opportunity.quotationId
      ? sales.getQuotation(opportunity.quotationId)
      : undefined

  const quoProduct = salesQuo?.productId ? masters.getProduct(salesQuo.productId) : undefined
  const resolvedProductId = salesQuo?.productId ?? opportunity.productId ?? product?.id ?? ''
  const quotationSummary = doc ? summarizeQuotationLinesForSo(doc) : null
  const qty = quotationSummary?.totalQty ?? salesQuo?.qty ?? 1
  const unitPrice = salesQuo?.pricing.unitPrice
    ?? (qty > 0 ? Math.round((opportunity.value / 1.18) / qty) : opportunity.value)

  const validation = doc && salesQuo
    ? validateQuotationForSoConversion({
        document: doc,
        latestDocument: crm.getLatestQuotationDocument(doc.quotationId),
        salesQuotation: salesQuo,
        customer,
        contactName: doc.contactId ? crm.getContact(doc.contactId)?.name : undefined,
        opportunityName: opportunity.opportunityName,
        productName: quoProduct?.productName,
      })
    : null

  const existingSoId = opportunity.salesOrderId
    ?? doc?.salesOrderId
    ?? salesQuo?.salesOrderId
    ?? null

  const lead = opportunity.leadId ? sales.getLead(opportunity.leadId) : undefined
  const locations = masters.locations ?? []
  const locationId = resolveInheritedLocationId(
    locations,
    'sales',
    opportunity.locationId,
    salesQuo?.locationId,
    lead?.locationId,
  )
  const loc = locations.find((l) => l.id === locationId)
  const deliveryLocationLabel = loc ? locationDisplayLabel(loc) : (customer?.city ? `${customer.city} — customer site` : '')

  return {
    opportunityId: opportunity.id,
    opportunityNo: opportunity.opportunityNo,
    opportunityName: opportunity.opportunityName,
    customerId: opportunity.customerId,
    productId: resolvedProductId,
    qty,
    unitPrice,
    expectedDeliveryDate: opportunity.expectedCloseDate?.slice(0, 10) || addDays(new Date().toISOString(), 60),
    deliveryLocation: deliveryLocationLabel,
    locationId,
    paymentTerms: salesQuo?.paymentTerms ?? '30% advance, balance before dispatch',
    deliveryTerms: salesQuo?.deliveryTerms ?? 'Ex-works Pune',
    internalRemarks: `From opportunity ${opportunity.opportunityNo} — ${opportunity.opportunityName}`,
    directSoReason: validation?.canConvert
      ? `Approved quotation handover for ${opportunity.opportunityName}`
      : `Sales order from CRM opportunity ${opportunity.opportunityNo}`,
    quotationDocumentId: doc?.id ?? null,
    quotationId: doc?.quotationId ?? opportunity.quotationId,
    canConvertQuotation: validation?.canConvert ?? false,
    convertDisabledReason: validation?.disabledReason ?? null,
    salesOrderId: existingSoId,
    quotationLineCount: quotationSummary?.lineCount ?? 1,
    quotationItemsSummary: doc ? quotationLineItemsSummary(doc) : product?.productName ?? '—',
    quotationGrandTotal: quotationSummary?.summary.grandTotal ?? salesQuo?.pricing.grandTotal ?? opportunity.value,
  }
}

export {
  buildSalesOrderNewUrl,
  resolveSalesOrderNewPath,
  type BuildSalesOrderNewUrlOptions,
} from './crmSalesOrderNavigation'
