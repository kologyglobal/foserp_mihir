import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  CheckCircle,
  ClipboardList,
  Copy,
  Eraser,
  Package,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { PoCreateFromPrPanel } from '@/components/purchase/PoCreateFromPrPanel'
import {
  purchaseSectionId,
  scrollToPurchaseValidationTarget,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  PurchaseDocumentFactBox,
  buildPurchaseRelatedLinks,
  purchaseDocumentApprovalFact,
} from '@/components/purchase/PurchaseDocumentFactBox'
import { purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import { PurchaseOrderLinesTable } from '@/components/purchase/PurchaseOrderLinesTable'
import {
  computePoOrderDocumentTotals,
  emptyPurchaseOrderAdjustments,
  orderAdjustmentsFromPoCharges,
  PurchaseOrderAdjustmentsBlock,
  type PoLineForOrderAdjust,
  type PurchaseOrderAdjustmentsState,
} from '@/components/purchase/PurchaseOrderAdjustmentsBlock'
import { PurchaseDocumentWorkflowStrip } from '@/components/purchase/PurchaseDocumentWorkflowStrip'
import {
  PurchaseDocumentAttachments,
  purchaseAttachmentIdsFromRows,
  purchaseAttachmentRowsFromIds,
  type PurchaseDocumentAttachmentRow,
} from '@/components/purchase/PurchaseDocumentAttachments'
import { PurchaseTaxTotalsPanel } from '@/components/purchase/PurchaseTaxTotalsPanel'
import { PurchaseTermsNotesTabs } from '@/components/purchase/PurchaseTermsNotesTabs'
import { PurchaseTermSelect } from '@/components/purchase/PurchaseTermSelect'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
} from '@/components/erp/card-form'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { formatVendorAddress } from '@/utils/vendorAddress'
import {
  mapEngineeringProductTypeToPurchaseCategory,
  mapPurchaseCategoryToEngineeringProductType,
  normalizeEngineeringProductType,
} from '@/utils/purchaseProductType'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  attachmentsSummary,
  commercialTermsSummary,
  hasMeaningfulTaxTotals,
  notesSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import {
  createPurchaseOrder,
  createPurchaseOrderFromBlanket,
  createPurchaseOrderFromComparison,
  createPurchaseOrderFromPr,
  createPurchaseOrderFromVendorQuotation,
  getBlanketOrders,
  getPurchaseItems,
  getPurchaseOrderById,
  getPurchaseSetup,
  getVendors,
  getPurchaseWarehouses,
  previewNextPurchaseOrderNumber,
  PurchaseServiceError,
  updatePurchaseOrder,
  PURCHASE_ORDER_DOMAIN_STATUS_LABELS,
  PURCHASE_ORDER_TYPE_LABELS,
} from '@/services/purchase'
import type {
  BlanketPurchaseOrder,
  PurchaseItem,
  PurchaseItemCategory,
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLineItemType,
  PurchaseOrderOrigin,
  PurchaseOrderType,
  PurchaseSetup,
  Vendor,
} from '@/types/purchaseDomain'
import {
  isPurchaseInsuranceTermsApplicable,
  PURCHASE_DELIVERY_TERMS,
  PURCHASE_FREIGHT_TERMS,
  PURCHASE_INSURANCE_TERMS,
  PURCHASE_PACKING_TERMS,
  PURCHASE_PAYMENT_TERMS,
  PURCHASE_PRICE_BASIS,
} from '@/data/purchase/purchaseCommercialTerms'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import {
  purchaseFieldId,
  validatePurchaseOrderForm,
} from '@/utils/purchaseOrderValidation'
import { nextPurchaseLineNo } from '@/utils/purchaseLineNumbers'
import { notify } from '@/store/toastStore'
import { purchaseUserMessage } from '@/utils/purchase/purchaseErrorMessages'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'
import { useOptionalAuth } from '@/context/AuthProvider'
import { useMasterStore } from '@/store/masterStore'
import { useBinOptions } from '@/hooks/useBinOptions'
import { resolveBinSelection, resolveItemDefaultBin } from '@/utils/itemDefaultBin'
import { resolveDefaultPurchaseUom } from '@/utils/purchaseLineUom'
import { loadQualityTestGroupOptions, type QualityTestGroupOption } from '@/utils/qualityTestGroupOptions'

type LocationOption = {
  id: string
  code: string
  name: string
  address: string
  state: string
  city: string
}
const EMPTY_LOCATION: LocationOption = {
  id: '',
  code: '',
  name: '',
  address: '',
  state: '',
  city: '',
}

// Backend rule: only draft and sent-back POs are editable (submitted POs are locked).
const EDITABLE_STATUSES: PurchaseOrder['status'][] = ['draft', 'sent_back']
const REVISABLE_STATUSES: PurchaseOrder['status'][] = [
  'released',
  'partially_received',
  'fully_received',
  'invoiced',
]

function today() {
  return new Date().toISOString().slice(0, 10)
}

import { formatPlaceOfSupplyLabel } from '../../utils/gstStateCode'
import { determinePurchaseGstSupply } from '../../utils/gstSupply'
import { resolveLineTaxFromLocalMasters } from '../../utils/commercialLineTax'

/** Place of supply follows delivery warehouse state; IGST when vendor state ≠ delivery state. */
function resolvePoGstFromLocations(
  vendor: { state?: string; gstin?: string } | null | undefined,
  deliveryLocation: LocationOption | undefined,
  purchaseSetup: PurchaseSetup | null | undefined,
  explicitPlaceOfSupply?: string,
) {
  const deliveryState = deliveryLocation?.state?.trim() || ''
  const placeOfSupply =
    explicitPlaceOfSupply?.trim() ||
    (deliveryState ? formatPlaceOfSupplyLabel(null, deliveryState) : '') ||
    formatPlaceOfSupplyLabel(
      purchaseSetup?.tax.placeOfSupplyStateCode,
      purchaseSetup?.tax.placeOfSupplyState,
    )
  return determinePurchaseGstSupply({
    supplierState: vendor?.state,
    supplierGstin: vendor?.gstin,
    placeOfSupply,
    defaultPlaceOfSupplyState: deliveryState || purchaseSetup?.tax.placeOfSupplyState,
    defaultPlaceOfSupplyStateCode: purchaseSetup?.tax.placeOfSupplyStateCode,
  })
}

function mentionsInsurance(...values: Array<string | null | undefined>) {
  return values.some((v) => Boolean(v && /insurance/i.test(v)))
}

type PoEditorLine = PurchaseOrderLine & { key: string }

function emptyLine(partial?: Partial<PurchaseOrderLine>): PoEditorLine {
  return {
    key: crypto.randomUUID(),
    id: '',
    lineNo: 1,
    itemType: 'raw_material',
    itemId: '',
    itemCode: '',
    itemName: '',
    description: '',
    specification: '',
    category: 'raw_material',
    productType: '',
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    gstGroupId: null,
    hsnId: null,
    gstGroupCode: '',
    outstandingQty: 0,
    outstandingQtyBase: 0,
    receivedQtyBase: 0,
    qcRequired: false,
    qualityTestGroupCode: null,
    binId: null,
    binCode: '',
    quantity: 0,
    uomQuantity: 0,
    uomConversionFactor: 1,
    uomId: null,
    unitCostPrimary: 0,
    rate: 0,
    discountPct: 0,
    discountAmount: 0,
    gstRatePct: 0,
    taxAmount: 0,
    taxableAmount: 0,
    cgst: 0,
    sgst: 0,
    igst: 0,
    lineTotal: 0,
    requiredDate: today(),
    deliverySchedule: '',
    warehouseId: '',
    warehouseName: '',
    costCentre: '',
    project: '',
    productionOrder: '',
    receivedQty: 0,
    pendingQty: 0,
    invoicedQty: 0,
    invoicedQtyBase: 0,
    lineStatus: 'open',
    locationId: '',
    locationName: '',
    expectedDeliveryDate: today(),
    prLineId: null,
    requisitionNo: null,
    rfqLineId: null,
    vendorQuotationLineId: null,
    remarks: '',
    ...partial,
  }
}

/** Blank seed rows for new POs — ignored by save/validation until the user fills an item. */
function createBlankPoLines(count = 3): PoEditorLine[] {
  return Array.from({ length: count }, (_, i) => emptyLine({ lineNo: i + 1 }))
}

function computeLine(line: PoEditorLine, isInterstate: boolean): PoEditorLine {
  const factor = Number(line.uomConversionFactor) > 0 ? Number(line.uomConversionFactor) : 1
  const uomQuantity = Number(
    line.uomQuantity !== undefined && line.uomQuantity !== null ? line.uomQuantity : line.quantity,
  ) || 0
  const primaryQty = Number((uomQuantity / factor).toFixed(4))
  const rate = Number(line.rate) || 0
  const unitCostPrimary = Number((rate * factor).toFixed(4))
  const basic = Number((uomQuantity * rate).toFixed(2))
  const discountAmount =
    line.discountPct > 0
      ? Number(((basic * (Number(line.discountPct) || 0)) / 100).toFixed(2))
      : Number(line.discountAmount) || 0
  const taxableAmount = Math.max(0, Number((basic - discountAmount).toFixed(2)))
  const gstRatePct = Number(line.gstRatePct) || 0
  const taxAmount = Number(((taxableAmount * gstRatePct) / 100).toFixed(2))
  const half = Number((taxAmount / 2).toFixed(2))
  const lineTotal = Number((taxableAmount + taxAmount).toFixed(2))
  const receivedQtyBase = Number(line.receivedQtyBase ?? line.receivedQty) || 0
  const receivedUomQty = factor > 0 ? receivedQtyBase * factor : receivedQtyBase
  const invoicedQtyBase = Number(line.invoicedQtyBase ?? 0) || 0
  const invoicedUomQty = factor > 0 ? invoicedQtyBase * factor : invoicedQtyBase
  const outstandingQtyBase = Math.max(0, Number((primaryQty - receivedQtyBase).toFixed(4)))
  const outstandingQty = Math.max(0, Number((uomQuantity - receivedUomQty).toFixed(4)))
  const lineStatus: PurchaseOrderLine['lineStatus'] =
    line.lineStatus === 'cancelled'
      ? 'cancelled'
      : receivedQtyBase <= 0
        ? 'open'
        : receivedQtyBase >= primaryQty
          ? 'received'
          : 'partial'
  return {
    ...line,
    uomQuantity,
    quantity: primaryQty,
    uomConversionFactor: factor,
    unitCostPrimary,
    discountAmount,
    taxableAmount,
    taxAmount,
    cgst: isInterstate ? 0 : half,
    sgst: isInterstate ? 0 : half,
    igst: isInterstate ? taxAmount : 0,
    lineTotal,
    receivedQty: receivedUomQty,
    receivedQtyBase,
    pendingQty: outstandingQtyBase,
    outstandingQty,
    outstandingQtyBase,
    invoicedQty: invoicedUomQty,
    invoicedQtyBase,
    lineStatus,
  }
}

function computeLines(lines: PoEditorLine[], isInterstate: boolean) {
  return lines.map((l) => computeLine(l, isInterstate))
}

function aggregateTotals(
  orderTotals: ReturnType<typeof computePoOrderDocumentTotals>,
  isInterstate: boolean,
  insuranceCharges: number,
  tcsAmount: number,
) {
  const insurance = Number(insuranceCharges) || 0
  const tcs = Number(tcsAmount) || 0
  const gst = orderTotals.gstAmount
  const half = Number((gst / 2).toFixed(2))
  const rawTotal = orderTotals.grandTotal + insurance + tcs
  const totalAmount = Math.round(rawTotal)
  const roundOff = Number((totalAmount - rawTotal).toFixed(2))
  return {
    subtotal: orderTotals.basicAmount,
    lineDiscount: orderTotals.itemDiscountAmount,
    discount: orderTotals.itemDiscountAmount + orderTotals.orderDiscount.calculatedAmount,
    taxableAmount: orderTotals.discountedTaxableAmount,
    cgst: isInterstate ? 0 : half,
    sgst: isInterstate ? 0 : half,
    igst: isInterstate ? gst : 0,
    roundOff,
    totalAmount,
    orderTotals,
  }
}

interface PoEditorHeader {
  documentDate: string
  orderType: PurchaseOrderType
  vendorId: string
  /** Display snapshots so the vendor select still shows PR/API parties not in the active list. */
  vendorCode: string
  vendorName: string
  vendorGstin: string
  vendorState: string
  vendorAddress: string
  isInterstate: boolean
  placeOfSupply: string
  purchaseLocationId: string
  deliveryLocationId: string
  department: string
  expectedDeliveryDate: string
  validityDate: string
  paymentTerms: string
  deliveryTerms: string
  freightTerms: string
  packingTerms: string
  insuranceTerms: string
  warranty: string
  inspectionRequirement: string
  priceBasis: string
  purchaseRequisitionNumber: string | null
  rfqNumber: string | null
  vendorQuotationNumber: string | null
  comparisonNumber: string | null
  blanketOrderNumber: string | null
  termsAndConditions: string
  internalNotes: string
  remarks: string
  tradeDiscount: number
  freight: number
  packingCharges: number
  insuranceCharges: number
  otherCharges: number
  tcsAmount: number
}

/** Minimal vendor row for select/options when document vendor is missing from active masters. */
function vendorStubFromHeader(header: Pick<
  PoEditorHeader,
  'vendorId' | 'vendorCode' | 'vendorName' | 'vendorGstin' | 'vendorState' | 'vendorAddress' | 'isInterstate' | 'paymentTerms' | 'deliveryTerms'
>): Vendor | null {
  const id = header.vendorId?.trim()
  if (!id) return null
  const name = header.vendorName?.trim() || 'Selected vendor'
  return {
    id,
    vendorCode: header.vendorCode?.trim() || '',
    vendorName: name,
    vendorType: 'manufacturer',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    address: header.vendorAddress || '',
    city: '',
    state: header.vendorState || '',
    stateCode: '',
    pincode: '',
    gstin: header.vendorGstin || '',
    pan: '',
    isInterstate: header.isInterstate,
    paymentTerms: header.paymentTerms || '',
    deliveryTerms: header.deliveryTerms || '',
    currency: 'INR',
    leadTimeDays: 0,
    rating: 0,
    qualityScore: 0,
    deliveryScore: 0,
    isActive: true,
    remarks: '',
    createdBy: '',
    createdAt: '',
    updatedBy: null,
    updatedAt: null,
  }
}

function defaultHeader(): PoEditorHeader {
  return {
    documentDate: today(),
    orderType: 'standard',
    vendorId: '',
    vendorCode: '',
    vendorName: '',
    vendorGstin: '',
    vendorState: '',
    vendorAddress: '',
    isInterstate: false,
    placeOfSupply: '',
    purchaseLocationId: '',
    deliveryLocationId: '',
    department: 'Purchase',
    expectedDeliveryDate: today(),
    validityDate: '',
    paymentTerms: 'Net 30',
    deliveryTerms: 'Ex-Works',
    freightTerms: 'Buyer freight',
    packingTerms: '',
    insuranceTerms: '',
    warranty: '',
    inspectionRequirement: '',
    priceBasis: '',
    purchaseRequisitionNumber: null,
    rfqNumber: null,
    vendorQuotationNumber: null,
    comparisonNumber: null,
    blanketOrderNumber: null,
    termsAndConditions: '',
    internalNotes: '',
    remarks: '',
    tradeDiscount: 0,
    freight: 0,
    packingCharges: 0,
    insuranceCharges: 0,
    otherCharges: 0,
    tcsAmount: 0,
  }
}

function headerFromPo(po: PurchaseOrder): PoEditorHeader {
  return {
    documentDate: po.documentDate,
    orderType: po.orderType,
    vendorId: (po.vendor.id ?? '').trim(),
    vendorCode: (po.vendor.code ?? '').trim(),
    vendorName: (po.vendor.name ?? '').trim(),
    vendorGstin: po.vendor.gstin,
    vendorState: po.vendor.state,
    vendorAddress: formatVendorAddress({
      address: po.vendor.address,
      address2: undefined,
      city: po.vendor.city ?? '',
      state: po.vendor.state ?? '',
      pincode: undefined,
      country: undefined,
    }) || po.vendor.address,
    isInterstate: po.vendor.isInterstate,
    placeOfSupply: po.placeOfSupply,
    purchaseLocationId: po.purchaseLocation.id,
    deliveryLocationId: po.deliveryLocation.id,
    department: po.department,
    expectedDeliveryDate: po.expectedDeliveryDate,
    validityDate: po.validityDate ?? '',
    paymentTerms: po.paymentTerms,
    deliveryTerms: po.deliveryTerms,
    freightTerms: po.freightTerms,
    packingTerms: po.packingTerms,
    insuranceTerms: po.insuranceTerms,
    warranty: po.warranty,
    inspectionRequirement: po.inspectionRequirement,
    priceBasis: po.priceBasis,
    purchaseRequisitionNumber: po.purchaseRequisitionNumber,
    rfqNumber: po.rfqNumber,
    vendorQuotationNumber: po.vendorQuotationNumber,
    comparisonNumber: po.comparisonNumber,
    blanketOrderNumber: po.blanketOrderNumber,
    termsAndConditions: po.termsAndConditions,
    internalNotes: po.internalNotes,
    remarks: po.remarks,
    tradeDiscount: po.tradeDiscount,
    freight: po.freight,
    packingCharges: po.packingCharges,
    insuranceCharges: po.insuranceCharges,
    otherCharges: po.otherCharges,
    tcsAmount: po.tcsAmount,
  }
}

function linesFromPo(po: PurchaseOrder): PoEditorLine[] {
  return po.lines.map((l) => {
    const productType =
      l.productType || mapPurchaseCategoryToEngineeringProductType(l.category) || ''
    return {
      ...l,
      key: l.id || crypto.randomUUID(),
      productType,
      category: l.category || mapEngineeringProductTypeToPurchaseCategory(productType) || 'raw_material',
    }
  })
}

export function PurchaseOrderEditorPage() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const auth = useOptionalAuth()
  const sessionUser = auth?.session?.user
  const ACTOR = useMemo(() => {
    const name = sessionUser
      ? `${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim() ||
        sessionUser.email ||
        sessionUser.id
      : ''
    return {
      id: sessionUser?.id ?? '',
      code: sessionUser?.email?.split('@')[0] ?? '',
      name,
    }
  }, [sessionUser])

  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [, setCreating] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<PurchaseOrder['status']>('draft')
  const [revisionNo, setRevisionNo] = useState(0)
  const [createdMeta, setCreatedMeta] = useState({ by: '', at: '' })
  const [updatedMeta, setUpdatedMeta] = useState({ by: '', at: '' })

  const [header, setHeader] = useState<PoEditorHeader>(defaultHeader)
  const [lines, setLines] = useState<PoEditorLine[]>(() => (isNew ? createBlankPoLines(3) : []))
  const [orderAdjustments, setOrderAdjustments] = useState<PurchaseOrderAdjustmentsState>(
    emptyPurchaseOrderAdjustments,
  )
  const [attachments, setAttachments] = useState<PurchaseDocumentAttachmentRow[]>([])
  const [, setActiveSection] = useState('general')
  const [attemptedMode, setAttemptedMode] = useState<'draft' | 'submit' | null>(null)
  const [forceOpenKey, setForceOpenKey] = useState(0)
  const [forceOpenSections, setForceOpenSections] = useState<
    Partial<Record<'general' | 'lines' | 'notes', number>>
  >({})
  const [, setLastSavedAt] = useState<Date | null>(null)
  const attachmentIds = purchaseAttachmentIdsFromRows(attachments)

  const [vendors, setVendors] = useState<Vendor[]>([])
  const [catalogItems, setCatalogItems] = useState<PurchaseItem[]>([])
  const [purchaseSetup, setPurchaseSetup] = useState<PurchaseSetup | null>(null)
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([])
  /** All active bins (warehouse filter applied client-side so empty warehouses don't blank the field). */
  const binOptions = useBinOptions()
  const [qualityTestGroupOptions, setQualityTestGroupOptions] = useState<QualityTestGroupOption[]>([])

  const originParam = (searchParams.get('origin') ?? '') as string
  const modeParam = searchParams.get('mode') ?? ''
  const prIdFromQuery = searchParams.get('prId') ?? ''
  /** Interactive PR → PO with line selection (partial). Replaces silent full convert. */
  const showPrLineSelector =
    isNew &&
    !id &&
    (modeParam === 'pr' || originParam === 'pr' || Boolean(prIdFromQuery))
  const originModeFromParam: PurchaseOrderOrigin =
    originParam === 'pr' || modeParam === 'pr' || Boolean(prIdFromQuery)
      ? 'purchase_requisition'
      : originParam === 'vq'
        ? 'vendor_quotation'
        : originParam === 'comparison'
          ? 'quotation_comparison'
          : originParam === 'blanket'
            ? 'blanket_order'
            : 'manual'

  const [originMode, setOriginMode] = useState<PurchaseOrderOrigin>(originModeFromParam)
  /**
   * Blank `/purchase/orders/new` opens the manual PO form immediately (no origin chooser).
   * PR deep links (`?mode=pr`, `?origin=pr`, `?prId=`) open line selection — not auto-create.
   * Comparison / VQ with an id still auto-create.
   */
  const [selectedPrId] = useState(prIdFromQuery)
  const [selectedPrVendorId] = useState(searchParams.get('vendorId') ?? '')
  const [selectedComparisonId] = useState(searchParams.get('comparisonId') ?? '')
  const [selectedVqId] = useState(searchParams.get('vqId') ?? '')

  const [activeBlankets, setActiveBlankets] = useState<BlanketPurchaseOrder[]>([])
  const [selectedBlanketId] = useState(searchParams.get('blanketId') ?? '')
  const [blanketQuantities] = useState<Record<string, number>>({})

  const editable = EDITABLE_STATUSES.includes(status)
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(editable)

  const selectedVendor = useMemo(() => {
    const fromList = vendors.find((v) => v.id === header.vendorId)
    if (fromList) return fromList
    return vendorStubFromHeader(header)
  }, [vendors, header])

  /** Active masters + current document vendor so Select/SmartSelect always shows the chosen party. */
  const vendorSelectList = useMemo(() => {
    if (!header.vendorId) return vendors
    if (vendors.some((v) => v.id === header.vendorId)) return vendors
    const stub = vendorStubFromHeader(header)
    return stub ? [stub, ...vendors] : vendors
  }, [vendors, header])

  const selectedPurchaseLocation = useMemo(
    () => locationOptions.find((location) => location.id === header.purchaseLocationId),
    [header.purchaseLocationId, locationOptions],
  )
  const selectedDeliveryLocation = useMemo(
    () => locationOptions.find((location) => location.id === header.deliveryLocationId),
    [header.deliveryLocationId, locationOptions],
  )
  /** Prefer bins for delivery warehouse; keep line-selected bins; never blank the list when scoped empty. */
  const warehouseBinOptions = useMemo(() => {
    const selectedIds = new Set(lines.map((l) => l.binId).filter(Boolean) as string[])
    const selectedCodes = new Set(
      lines.map((l) => l.binCode?.trim()).filter((c): c is string => Boolean(c)),
    )
    const keepSelected = (b: (typeof binOptions)[number]) =>
      selectedIds.has(b.id) ||
      selectedCodes.has(b.code) ||
      [...selectedIds].some(
        (id) => b.code.localeCompare(id, undefined, { sensitivity: 'accent' }) === 0,
      )

    if (!header.deliveryLocationId) return binOptions
    const forWarehouse = binOptions.filter(
      (b) =>
        !b.warehouseId ||
        b.warehouseId === header.deliveryLocationId ||
        b.storageLocationId === header.deliveryLocationId ||
        keepSelected(b),
    )
    return forWarehouse.length > 0 ? forWarehouse : binOptions
  }, [binOptions, header.deliveryLocationId, lines])
  const catalogItemsForPicker = useMemo(
    () =>
      catalogItems.map((item) => ({
        ...item,
        preferredVendorName:
          vendors.find((v) => v.id === item.preferredVendorId)?.vendorName ?? null,
        // Rate comes from Item Master standardRate — no fabricated stock/rate proxies.
        lastPurchaseRate: item.standardRate,
        availableStock: null,
      })),
    [catalogItems, vendors],
  )
  const isInterstate = header.isInterstate

  const [sourceDocRefs, setSourceDocRefs] = useState<{
    purchaseRequisitionId: string | null
    rfqId: string | null
    vendorQuotationId: string | null
    comparisonId: string | null
    blanketOrderId: string | null
  }>({
    purchaseRequisitionId: null,
    rfqId: null,
    vendorQuotationId: null,
    comparisonId: null,
    blanketOrderId: null,
  })

  const inspectionCategories = purchaseSetup?.quality.inspectionRequiredCategories ?? []
  const showInspectionRequirement = useMemo(() => {
    if (header.inspectionRequirement.trim()) return true
    if (header.orderType === 'capital' || header.orderType === 'job_work') return true
    return lines.some((line) => {
      const hasItem = Boolean(line.itemId || line.itemCode.trim() || line.itemName.trim())
      if (!hasItem) return false
      const catalog = line.itemId ? catalogItems.find((i) => i.id === line.itemId) : undefined
      if (catalog?.qcRequired) return true
      const category = (catalog?.category ?? line.category) as PurchaseItemCategory | ''
      return Boolean(category && inspectionCategories.includes(category))
    })
  }, [
    header.inspectionRequirement,
    header.orderType,
    lines,
    catalogItems,
    inspectionCategories,
  ])

  const showTcs = Boolean(purchaseSetup?.tax.tcsEnabled) || Number(header.tcsAmount) > 0

  const showInsuranceTerms =
    isPurchaseInsuranceTermsApplicable(
      header.priceBasis,
      header.deliveryTerms,
      header.insuranceTerms,
    ) ||
    Number(header.insuranceCharges) > 0 ||
    mentionsInsurance(header.freightTerms, header.deliveryTerms, header.packingTerms)

  const computedLines = useMemo(() => computeLines(lines, isInterstate), [lines, isInterstate])
  const validation = useMemo(
    () =>
      validatePurchaseOrderForm(
        {
          documentDate: header.documentDate,
          vendorId: header.vendorId,
          expectedDeliveryDate: header.expectedDeliveryDate,
          placeOfSupply: header.placeOfSupply,
        },
        computedLines,
        'submit',
      ),
    [header.documentDate, header.vendorId, header.expectedDeliveryDate, header.placeOfSupply, computedLines],
  )
  const draftValidation = useMemo(
    () =>
      validatePurchaseOrderForm(
        {
          documentDate: header.documentDate,
          vendorId: header.vendorId,
          expectedDeliveryDate: header.expectedDeliveryDate,
        },
        computedLines,
        'draft',
      ),
    [header.documentDate, header.vendorId, header.expectedDeliveryDate, computedLines],
  )
  const showErrors = attemptedMode !== null
  const activeValidation = attemptedMode === 'draft' ? draftValidation : validation
  const orderDocumentTotals = useMemo(
    () => computePoOrderDocumentTotals(computedLines, orderAdjustments),
    [computedLines, orderAdjustments],
  )
  const totals = useMemo(
    () =>
      aggregateTotals(
        orderDocumentTotals,
        isInterstate,
        Number(header.insuranceCharges) || 0,
        Number(header.tcsAmount) || 0,
      ),
    [orderDocumentTotals, isInterstate, header.insuranceCharges, header.tcsAmount],
  )

  const gstTotal = totals.cgst + totals.sgst + totals.igst
  const taxTotalsDefaultOpen = hasMeaningfulTaxTotals(
    totals.subtotal,
    gstTotal,
    totals.totalAmount,
  )

  const commercialSummary = useMemo(
    () =>
      commercialTermsSummary({
        expectedDelivery: header.expectedDeliveryDate,
        paymentTerms: header.paymentTerms,
        freightTerms: header.freightTerms,
        deliveryTerms: header.deliveryTerms,
        priceBasis: header.priceBasis,
        validityDate: header.validityDate,
      }),
    [
      header.expectedDeliveryDate,
      header.paymentTerms,
      header.freightTerms,
      header.deliveryTerms,
      header.priceBasis,
      header.validityDate,
    ],
  )

  const taxSummary = useMemo(
    () =>
      taxTotalsSummary({
        subtotal: totals.subtotal,
        tax: gstTotal,
        total: totals.totalAmount,
      }),
    [totals.subtotal, gstTotal, totals.totalAmount],
  )

  const documentFactBox = useMemo(() => {
    const approval = purchaseDocumentApprovalFact(status)
    const firstLine = computedLines.find((l) => l.itemId || l.itemCode.trim() || l.itemName.trim())
    const related = buildPurchaseRelatedLinks({
      purchaseRequisitionId: sourceDocRefs.purchaseRequisitionId,
      purchaseRequisitionNumber: header.purchaseRequisitionNumber,
      rfqId: sourceDocRefs.rfqId,
      rfqNumber: header.rfqNumber,
      vendorQuotationId: sourceDocRefs.vendorQuotationId,
      vendorQuotationNumber: header.vendorQuotationNumber,
      comparisonId: sourceDocRefs.comparisonId,
      comparisonNumber: header.comparisonNumber,
      blanketOrderId: sourceDocRefs.blanketOrderId,
      blanketOrderNumber: header.blanketOrderNumber,
    })
    return (
      <PurchaseDocumentFactBox
        vendor={
          selectedVendor
            ? {
                id: selectedVendor.id,
                code: selectedVendor.vendorCode,
                name: selectedVendor.vendorName,
                rating: selectedVendor.rating,
                paymentTerms: header.paymentTerms || selectedVendor.paymentTerms,
                leadTimeDays: selectedVendor.leadTimeDays,
              }
            : null
        }
        purchaseHistory={{
          lastPurchasePrice: firstLine && firstLine.rate > 0 ? firstLine.rate : null,
          lastVendorName: selectedVendor?.vendorName ?? null,
          averageLeadTimeDays: selectedVendor?.leadTimeDays ?? null,
        }}
        documentStatus={{
          statusLabel: PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status],
          ...approval,
          createdBy: createdMeta.by || ACTOR.name,
          modifiedBy: updatedMeta.by || null,
          modifiedDate: updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : null,
        }}
        related={related}
      />
    )
  }, [
    status,
    computedLines,
    sourceDocRefs,
    header.purchaseRequisitionNumber,
    header.rfqNumber,
    header.vendorQuotationNumber,
    header.comparisonNumber,
    header.blanketOrderNumber,
    header.paymentTerms,
    selectedVendor,
    createdMeta.by,
    updatedMeta.by,
    updatedMeta.at,
    ACTOR.name,
  ])

  const notesPeek = useMemo(
    () => notesSummary(header.termsAndConditions, header.internalNotes, header.remarks),
    [header.termsAndConditions, header.internalNotes, header.remarks],
  )

  const attachmentsPeek = useMemo(
    () => attachmentsSummary(attachments.length),
    [attachments.length],
  )

  const documentTitle = isNew ? 'New Purchase Order' : (documentNumber ?? 'Purchase Order')
  const vendorFact =
    selectedVendor?.vendorName ||
    header.vendorName?.trim() ||
    (header.vendorId && header.vendorGstin ? header.vendorGstin : '') ||
    'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'PO No', value: documentNumber ?? 'Loading…' }]
        : []),
      { label: 'Vendor', value: vendorFact },
      { label: 'Buyer', value: ACTOR.name },
      {
        label: 'Date',
        value: header.documentDate ? formatDate(header.documentDate) : 'Not selected',
      },
    ],
    [isNew, documentNumber, vendorFact, header.documentDate],
  )

  const patchHeader = (patch: Partial<PoEditorHeader>) => {
    setHeader((h) => ({ ...h, ...patch }))
    markDirty()
  }

  const setLinesDirty = (next: PoEditorLine[]) => {
    setLines(next)
    markDirty()
  }

  /** When bins load after an item was chosen, resolve id/code so the Bin drop-down shows a value. */
  useEffect(() => {
    if (!binOptions.length || !editable) return
    setLines((prev) => {
      let changed = false
      const next = prev.map((line) => {
        if (!line.itemId && !line.binId && !line.binCode) return line

        if (line.binId || line.binCode) {
          const resolved = resolveBinSelection(line.binId, line.binCode, binOptions)
          if (resolved.binId !== line.binId || resolved.binCode !== (line.binCode || '')) {
            changed = true
            return { ...line, binId: resolved.binId, binCode: resolved.binCode }
          }
          return line
        }

        if (line.itemId) {
          const store = useMasterStore.getState()
          const master = store.items.find((i) => i.id === line.itemId)
          const catalog = catalogItems.find((i) => i.id === line.itemId)
          const resolved = resolveItemDefaultBin(
            {
              defaultBinId: master?.defaultBinId ?? catalog?.defaultBinId,
              defaultBinCode: master?.defaultBinCode ?? catalog?.defaultBinCode,
            },
            binOptions,
          )
          if (resolved.binId || resolved.binCode) {
            changed = true
            return {
              ...line,
              binId: resolved.binId,
              binCode: resolved.binCode,
            }
          }
        }
        return line
      })
      return changed ? next : prev
    })
  }, [binOptions, catalogItems, editable])

  const patchLine = (key: string, patch: Partial<PurchaseOrderLine>) => {
    const nextPatch =
      'uomQuantity' in patch
        ? patch
        : 'quantity' in patch
          ? { ...patch, uomQuantity: Number(patch.quantity) || 0 }
          : patch
    setLinesDirty(
      lines.map((l) =>
        l.key === key ? computeLine({ ...l, ...nextPatch }, header.isInterstate) : l,
      ),
    )
  }

  const applyVendor = (vendorId: string) => {
    const vendor = vendors.find((v) => v.id === vendorId) ?? vendorSelectList.find((v) => v.id === vendorId)
    if (!vendor) {
      patchHeader({
        vendorId: '',
        vendorCode: '',
        vendorName: '',
        vendorGstin: '',
        vendorState: '',
        vendorAddress: '',
        isInterstate: false,
      })
      return
    }
    const gst = resolvePoGstFromLocations(
      vendor,
      selectedDeliveryLocation,
      purchaseSetup,
      header.placeOfSupply,
    )
    patchHeader({
      vendorId: vendor.id,
      vendorCode: vendor.vendorCode,
      vendorName: vendor.vendorName,
      vendorGstin: vendor.gstin,
      vendorState: vendor.state,
      vendorAddress: formatVendorAddress(vendor),
      placeOfSupply: gst.placeOfSupplyLabel,
      isInterstate: gst.isInterstate,
      paymentTerms: header.paymentTerms || vendor.paymentTerms,
      deliveryTerms: header.deliveryTerms || vendor.deliveryTerms,
    })
  }

  const applyItemCatalog = (key: string, itemId: string) => {
    const line = lines.find((l) => l.key === key)
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item || !item.isActive) return
    // Guard: Product Type filter is strict — do not accept cross-type picks.
    if (
      line?.productType &&
      item.productType &&
      normalizeEngineeringProductType(item.productType) !==
        normalizeEngineeringProductType(line.productType)
    ) {
      return
    }
    const master = useMasterStore.getState().items.find((i) => i.id === itemId)
    if (master && (master.isBlocked === true || master.isActive === false)) {
      return
    }
    // Prefer Item Master UOM conversion mappings (same path as PR/RFQ); legacy columns are fallback.
    const defaultUom = resolveDefaultPurchaseUom(itemId)
    const purchaseUomId = defaultUom?.id ?? master?.purchaseUomId ?? master?.baseUomId ?? null
    const factor = defaultUom?.factor ?? (
      master?.purchaseUomId && master.purchaseUomId !== master.baseUomId
        ? Number(master.uomConversionFactor ?? master.purchaseQtyPerUom ?? 1) || 1
        : 1
    )
    const purchaseUomCode =
      defaultUom?.code ||
      (purchaseUomId && useMasterStore.getState().uoms.find((u) => u.id === purchaseUomId)?.uomCode) ||
      item.uom
    // Prefer Item Master product type; if master has none, keep the filter the user already chose.
    const productType =
      normalizeEngineeringProductType(item.productType) ||
      line?.productType ||
      mapPurchaseCategoryToEngineeringProductType(item.category) ||
      ''
    const category =
      item.category ||
      mapEngineeringProductTypeToPurchaseCategory(productType) ||
      line?.category ||
      'raw_material'
    const gstGroupId = item.gstGroupId ?? master?.gstGroupId ?? null
    const hsnId = item.hsnId ?? master?.hsnId ?? null
    const hsnMaster = hsnId ? useMasterStore.getState().getHsn(hsnId) : null
    const gstGroupMaster = gstGroupId ? useMasterStore.getState().getGstGroup(gstGroupId) : null
    const store = useMasterStore.getState()
    const masterItem =
      master ??
      ({
        id: item.id,
        hsnCode: item.hsnCode ?? '',
        hsnId,
        gstGroupId,
      } as import('../../types/master').Item)
    const vendorForTax =
      vendors.find((v) => v.id === header.vendorId) ??
      vendorSelectList.find((v) => v.id === header.vendorId)
    const taxSnap = resolveLineTaxFromLocalMasters({
      direction: 'PURCHASE',
      item: masterItem,
      hsnById: (id) => store.getHsn(id),
      hsnByCode: (code) => store.getHsnByCode(code),
      gstRates: store.gstRates,
      placeOfSupply: header.placeOfSupply,
      partyState: vendorForTax?.state ?? header.vendorState,
      partyGstin: vendorForTax?.gstin ?? header.vendorGstin,
      companyState:
        selectedDeliveryLocation?.state ||
        purchaseSetup?.tax.placeOfSupplyState ||
        undefined,
      companyStateCode: purchaseSetup?.tax.placeOfSupplyStateCode || undefined,
    })
    const defaultBin = resolveItemDefaultBin(
      {
        defaultBinId: master?.defaultBinId ?? item.defaultBinId,
        defaultBinCode: master?.defaultBinCode ?? item.defaultBinCode,
      },
      warehouseBinOptions.length ? warehouseBinOptions : binOptions,
    )
    // Prefer item default; keep existing line bin when item has no default.
    const nextBin =
      defaultBin.binId || defaultBin.binCode
        ? defaultBin
        : resolveBinSelection(line?.binId, line?.binCode, warehouseBinOptions.length ? warehouseBinOptions : binOptions)
    patchLine(key, {
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      description: item.itemName,
      productType,
      category,
      itemType: (category === 'job_work' ? 'job_work' : category) as PurchaseOrderLineItemType,
      uom: purchaseUomCode,
      uomId: purchaseUomId,
      uomConversionFactor: factor,
      hsnCode: taxSnap.hsnSacCode || hsnMaster?.code || item.hsnCode,
      hsnId,
      gstGroupId,
      gstGroupCode: gstGroupMaster?.code ?? '',
      sacCode: item.sacCode,
      qcRequired: Boolean(item.qcRequired ?? master?.qcRequired),
      qualityTestGroupCode: item.qualityTestGroupCode ?? master?.qualityTestGroupCode ?? null,
      rate: item.standardRate,
      gstRatePct: taxSnap.resolved
        ? taxSnap.taxPct
        : Number(item.gstRatePct) > 0
          ? Number(item.gstRatePct)
          : 0,
      cgst: taxSnap.cgstRate,
      sgst: taxSnap.sgstRate,
      igst: taxSnap.igstRate,
      binId: nextBin.binId,
      binCode: nextBin.binCode,
    })
  }

  useEffect(() => {
    void import('@/services/bridges/masterApiBridge')
      .then((m) => m.syncCoreMastersFromApi())
      .catch(() => undefined)
    void import('@/services/bridges/masterBatchApiBridge')
      .then((m) => m.syncBatchMastersFromApi())
      .catch(() => undefined)
    void Promise.all([
      getVendors(),
      getPurchaseItems({ forceRefresh: true, purchasableOnly: false }),
      getBlanketOrders(),
      getPurchaseSetup(),
      getPurchaseWarehouses(),
      loadQualityTestGroupOptions(),
    ]).then(([vendorRows, items, blankets, setup, warehouses, qtgOptions]) => {
      setVendors(vendorRows.filter((v) => v.isActive))
      setCatalogItems(items)
      setPurchaseSetup(setup)
      const locs = warehouses.map((w) => ({
        id: w.id,
        code: w.code,
        name: w.name,
        address: w.address,
        state: w.state,
        city: w.city,
      }))
      setLocationOptions(locs)
      setQualityTestGroupOptions(qtgOptions)
      if (isNew) {
        const preferred =
          (setup.general.defaultWarehouseId &&
            locs.find((l) => l.id === setup.general.defaultWarehouseId)?.id) ||
          ''
        const defaultDelivery = preferred ? locs.find((l) => l.id === preferred) : locs[0]
        const gst = resolvePoGstFromLocations(null, defaultDelivery, setup)
        setHeader((prev) => ({
          ...prev,
          purchaseLocationId: prev.purchaseLocationId || preferred,
          deliveryLocationId: prev.deliveryLocationId || preferred,
          paymentTerms: prev.paymentTerms || setup.general.defaultPaymentTerms || prev.paymentTerms,
          deliveryTerms: prev.deliveryTerms || setup.general.defaultDeliveryTerms || prev.deliveryTerms,
          placeOfSupply: prev.placeOfSupply || gst.placeOfSupplyLabel,
          isInterstate: prev.vendorId ? prev.isInterstate : gst.isInterstate,
        }))
        void previewNextPurchaseOrderNumber()
          .then((next) => {
            if (next) setDocumentNumber(next)
          })
          .catch(() => {
            /* preview is optional — save still allocates server-side */
          })
      }
      setActiveBlankets(blankets.filter((b) => b.status === 'active'))
    })
  }, [isNew])

  /** When active master list loads, backfill vendor labels for the document vendor id. */
  useEffect(() => {
    if (!header.vendorId) return
    const master = vendors.find((v) => v.id === header.vendorId)
    if (!master) return
    if (header.vendorName.trim() && header.vendorCode.trim()) return
    setHeader((h) => ({
      ...h,
      vendorCode: h.vendorCode.trim() || master.vendorCode,
      vendorName: h.vendorName.trim() || master.vendorName,
      vendorGstin: h.vendorGstin.trim() || master.gstin,
      vendorState: h.vendorState.trim() || master.state,
      vendorAddress: h.vendorAddress.trim() || formatVendorAddress(master),
    }))
  }, [vendors, header.vendorId, header.vendorName, header.vendorCode])

  /**
   * Reconcile place of supply + IGST/CGST scheme when vendor, delivery, or setup is ready.
   * Does not mark dirty — hydrate / master load only.
   */
  useEffect(() => {
    if (!editable) return
    if (!header.vendorId && !header.vendorGstin && !header.vendorState) return
    if (!selectedDeliveryLocation && !purchaseSetup) return
    const vendor =
      selectedVendor ??
      ({
        state: header.vendorState,
        gstin: header.vendorGstin,
      } as { state?: string; gstin?: string })
    const gst = resolvePoGstFromLocations(
      vendor,
      selectedDeliveryLocation,
      purchaseSetup,
      header.placeOfSupply || undefined,
    )
    setHeader((h) => {
      const nextPos = h.placeOfSupply.trim() || gst.placeOfSupplyLabel
      if (h.isInterstate === gst.isInterstate && h.placeOfSupply === nextPos) return h
      return {
        ...h,
        placeOfSupply: nextPos,
        isInterstate: gst.isInterstate,
      }
    })
  }, [
    editable,
    header.vendorId,
    header.vendorGstin,
    header.vendorState,
    header.placeOfSupply,
    selectedVendor,
    selectedDeliveryLocation,
    purchaseSetup,
  ])

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const po = await getPurchaseOrderById(id)
      if (cancelled) return
      if (!po) {
        setLoading(false)
        notify.error('Purchase order not found')
        navigate('/purchase/orders')
        return
      }
      if (REVISABLE_STATUSES.includes(po.status)) {
        notify.info('This order is released — opening the revise workflow')
        navigate(`/purchase/orders/${po.id}/revise`, { replace: true })
        return
      }
      if (!EDITABLE_STATUSES.includes(po.status)) {
        notify.info(`${po.documentNumber} is ${PURCHASE_ORDER_DOMAIN_STATUS_LABELS[po.status]} — opening read-only view`)
        navigate(`/purchase/orders/${po.id}`, { replace: true })
        return
      }
      setRecordId(po.id)
      setDocumentNumber(po.documentNumber)
      setStatus(po.status)
      setRevisionNo(po.revisionNo)
      setOriginMode(po.origin)
      const loadedHeader = headerFromPo(po)
      setHeader(loadedHeader)
      setOrderAdjustments(orderAdjustmentsFromPoCharges(loadedHeader))
      setLines(linesFromPo(po))
      setAttachments(purchaseAttachmentRowsFromIds(po.attachmentIds ?? [], { uploadedBy: ACTOR.name }))
      setCreatedMeta({ by: po.createdBy, at: po.createdAt })
      setUpdatedMeta({ by: po.updatedBy ?? '', at: po.updatedAt ?? '' })
      setLastSavedAt(po.updatedAt ? new Date(po.updatedAt) : po.createdAt ? new Date(po.createdAt) : null)
      setSourceDocRefs({
        purchaseRequisitionId: po.purchaseRequisitionId,
        rfqId: po.rfqId,
        vendorQuotationId: po.vendorQuotationId,
        comparisonId: po.comparisonId,
        blanketOrderId: po.blanketOrderId,
      })
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, resetDirty])

  const toInput = useCallback(() => {
    const purchaseLocation =
      locationOptions.find((l) => l.id === header.purchaseLocationId) ?? EMPTY_LOCATION
    const deliveryLocation =
      locationOptions.find((l) => l.id === header.deliveryLocationId) ?? EMPTY_LOCATION
    return {
      vendorId: header.vendorId,
      documentDate: header.documentDate,
      orderType: header.orderType,
      location: { ...purchaseLocation },
      purchaseLocation: { ...purchaseLocation },
      deliveryLocation: { ...deliveryLocation },
      department: header.department,
      buyer: ACTOR,
      requester: ACTOR,
      placeOfSupply: header.placeOfSupply,
      expectedDeliveryDate: header.expectedDeliveryDate,
      validityDate: header.validityDate || null,
      paymentTerms: header.paymentTerms,
      deliveryTerms: header.deliveryTerms,
      freightTerms: header.freightTerms,
      packingTerms: header.packingTerms,
      insuranceTerms: header.insuranceTerms,
      warranty: header.warranty,
      inspectionRequirement: header.inspectionRequirement,
      priceBasis: header.priceBasis,
      termsAndConditions: header.termsAndConditions,
      internalNotes: header.internalNotes,
      remarks: header.remarks,
      attachmentIds,
      freight: orderDocumentTotals.freight.calculatedAmount,
      otherCharges: orderDocumentTotals.otherCharges.calculatedAmount,
      packingCharges: orderDocumentTotals.installation.calculatedAmount,
      insuranceCharges: Number(header.insuranceCharges) || 0,
      tradeDiscount: orderDocumentTotals.orderDiscount.calculatedAmount,
      tcsAmount: Number(header.tcsAmount) || 0,
      discount: totals.discount,
      lines: computedLines
        .filter((l) => l.itemId || l.itemCode.trim() || l.itemName.trim())
        .map(({ key: _key, productType: _productType, ...rest }) => ({
          ...rest,
          category: (rest.category ||
            mapEngineeringProductTypeToPurchaseCategory(_productType) ||
            'raw_material') as PurchaseItemCategory,
        })),
    }
  }, [attachmentIds, computedLines, header, orderDocumentTotals, totals.discount, locationOptions, ACTOR])

  const revealValidation = useCallback(
    (result: typeof validation, mode: 'draft' | 'submit') => {
      setAttemptedMode(mode)
      if (!result.errors.length) return
      const nextKey = forceOpenKey + 1
      setForceOpenKey(nextKey)
      const opened: Partial<Record<'general' | 'lines' | 'notes', number>> = {}
      for (const section of result.sectionsToOpen) {
        opened[section] = nextKey
      }
      setForceOpenSections(opened)
      window.requestAnimationFrame(() => {
        scrollToPurchaseValidationTarget({
          fieldId: result.firstFieldId,
          sectionId: result.firstSection,
          onActive: setActiveSection,
        })
      })
    },
    [forceOpenKey],
  )

  const focusValidationItem = useCallback(() => {
    window.requestAnimationFrame(() => {
      scrollToPurchaseValidationTarget({
        fieldId: activeValidation.firstFieldId,
        sectionId: activeValidation.firstSection,
        onActive: setActiveSection,
      })
    })
  }, [activeValidation])

  const saveDraft = async () => {
    if (!editable || saving) return
    if (draftValidation.errors.length) {
      revealValidation(draftValidation, 'draft')
      return
    }
    setSaving(true)
    try {
      const input = toInput()
      if (recordId) {
        const updated = await updatePurchaseOrder(recordId, input)
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setUpdatedMeta({ by: updated.updatedBy ?? '', at: updated.updatedAt ?? '' })
        notify.success(`Saved · ${updated.documentNumber}`)
        setLastSavedAt(new Date())
        resetDirty()
      } else {
        const created = await createPurchaseOrder(input)
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
        setStatus(created.status)
        setCreatedMeta({ by: created.createdBy, at: created.createdAt })
        notify.success(`Saved · ${created.documentNumber}`)
        setLastSavedAt(new Date())
        resetDirty()
      }
      navigate(PURCHASE_FORM_ROUTES.purchaseOrder.list, { replace: true })
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const createFromOrigin = async () => {
    setCreating(true)
    try {
      let created: PurchaseOrder
      if (originMode === 'purchase_requisition') {
        if (!selectedPrId) {
          notify.error('Select an approved requisition')
          return
        }
        created = await createPurchaseOrderFromPr(selectedPrId, selectedPrVendorId || undefined)
      } else if (originMode === 'quotation_comparison') {
        if (!selectedComparisonId) {
          notify.error('Select a completed & approved comparison')
          return
        }
        created = await createPurchaseOrderFromComparison(selectedComparisonId)
      } else if (originMode === 'vendor_quotation') {
        if (!selectedVqId) {
          notify.error('Select an approved vendor quotation')
          return
        }
        created = await createPurchaseOrderFromVendorQuotation(selectedVqId)
      } else if (originMode === 'blanket_order') {
        if (!selectedBlanketId) {
          notify.error('Select an active blanket order')
          return
        }
        const blanket = activeBlankets.find((b) => b.id === selectedBlanketId)
        const lineInputs = (blanket?.lines ?? [])
          .map((l) => ({ itemId: l.itemId, quantity: Number(blanketQuantities[l.itemId]) || 0 }))
          .filter((l) => l.quantity > 0)
        if (!lineInputs.length) {
          notify.error('Enter a quantity for at least one blanket line')
          return
        }
        created = await createPurchaseOrderFromBlanket(selectedBlanketId, lineInputs)
      } else {
        return
      }
      notify.success(`${created.documentNumber} created`)
      navigate(`/purchase/orders/${created.id}/edit`, { replace: true })
    } catch (err) {
      notify.error(purchaseUserMessage(err, 'Could not create purchase order'))
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    if (!isNew || recordId) return
    // PR uses interactive line selector — never silent full convert.
    if (showPrLineSelector) return
    if (originMode === 'quotation_comparison' && selectedComparisonId) {
      void createFromOrigin()
    }
    if (originMode === 'vendor_quotation' && selectedVqId) {
      void createFromOrigin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only deep-link auto-create
  }, [])

  if (showPrLineSelector) {
    return (
      <PoCreateFromPrPanel
        initialPrId={selectedPrId}
        initialVendorId={selectedPrVendorId}
        onCancel={() => navigate(PURCHASE_FORM_ROUTES.purchaseOrder.list)}
      />
    )
  }

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Order"
        description="Loading…"
        status="Open"
        favoritePath="/purchase/orders/new"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Orders', to: '/purchase/orders' },
          { label: 'Loading' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  /** Manual create form only — source origins create via deep-link then navigate to edit. */
  const showPoForm = originMode === 'manual' || Boolean(recordId)

  return (
    <>
    <PurchaseCardFormShell
      title={isNew ? 'New Purchase Order' : `Edit ${documentNumber ?? 'Purchase Order'}`}
      description="Vendor purchase commitment — draft and pending-approval documents only"
      className="purchase-order-editor--scrollbar-hidden"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status]}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderId={revisionNo > 0 ? `R${revisionNo}` : undefined}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/orders/${recordId}/edit` : '/purchase/orders/new'}
      breadcrumbs={[
        { label: 'Orders', to: '/purchase/orders' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      createdBy={createdMeta.by || undefined}
      createdDate={createdMeta.at ? formatDate(createdMeta.at.slice(0, 10)) : undefined}
      modifiedBy={updatedMeta.by || undefined}
      modifiedDate={updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : undefined}
      validationTitle={
        showErrors && activeValidation.errors.length
          ? attemptedMode === 'draft'
            ? 'Purchase Order cannot be saved.'
            : 'Purchase Order cannot be submitted.'
          : undefined
      }
      validationErrors={showErrors ? activeValidation.errors : []}
      validationItems={
        showErrors
          ? activeValidation.errors.map((message, i) => ({
              id: `po-err-${i}`,
              label: message,
              message: 'Required',
              onClick: () => focusValidationItem(),
            }))
          : undefined
      }
      commandBar={null}
      factBox={showPoForm ? documentFactBox : undefined}
      collapsibleFactBox={showPoForm}
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={saving}
          dirty={dirty}
          disabled={!showPoForm || !editable}
          disabledReason={
            !showPoForm
              ? 'Creating purchase order from source…'
              : !editable
                ? 'Document is read-only'
                : undefined
          }
          onCancel={() => {
            resetDirty()
            navigate(PURCHASE_FORM_ROUTES.purchaseOrder.list)
          }}
          onSave={saveDraft}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      {showPoForm ? (

        <>
          <PurchaseDocumentWorkflowStrip
            status={status}
            nextActionContext={{ canSubmit: editable }}
          />

          <div className="space-y-3">
          <ErpCardSection
            id={purchaseSectionId('general')}
            title="General"
            subtitle="Document identity, vendor, and delivery locations"
            icon={ClipboardList}
            accent="blue"
            collapsible
            defaultOpen
            forceOpenKey={forceOpenSections.general}
            dense
            columns={6}
          >
            <ErpFieldRow label="PO Number" readOnly hint={isNew ? 'Preview from number series — assigned when you save' : undefined}>
              <Input
                value={documentNumber ?? ''}
                placeholder="Loading number…"
                readOnly
                className="bg-erp-surface-alt"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Status" readOnly hint="Lifecycle status — not editable on the form">
              <Input
                value={PURCHASE_ORDER_DOMAIN_STATUS_LABELS[status]}
                readOnly
                className="bg-erp-surface-alt"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Revised version" readOnly>
              <Input
                value={String(revisionNo)}
                readOnly
                className="bg-erp-surface-alt tabular-nums"
              />
            </ErpFieldRow>
            <ErpFieldRow
              id={purchaseFieldId('documentDate')}
              label="PO Date"
              required
              fieldError={showErrors ? activeValidation.fieldErrors.documentDate : undefined}
              fieldState={showErrors && activeValidation.fieldErrors.documentDate ? 'error' : 'idle'}
            >
              <Input
                type="date"
                value={header.documentDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ documentDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Order Type">
              <Select
                native={false}
                value={header.orderType}
                disabled={!editable}
                onChange={(e) => patchHeader({ orderType: e.target.value as PurchaseOrderType })}
              >
                {Object.entries(PURCHASE_ORDER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Buyer" readOnly>
              <Input value={ACTOR.name} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Currency" readOnly>
              <Input value="INR" readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Department">
              <Input
                value={header.department}
                disabled={!editable}
                onChange={(e) => patchHeader({ department: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow
              id={purchaseFieldId('vendorId')}
              label="Vendor"
              required
              fieldError={showErrors ? activeValidation.fieldErrors.vendorId : undefined}
              fieldState={showErrors && activeValidation.fieldErrors.vendorId ? 'error' : 'idle'}
            >
              <Select value={header.vendorId} disabled={!editable} onChange={(e) => applyVendor(e.target.value)}>
                <option value="">Select vendor…</option>
                {vendorSelectList.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorCode ? `${v.vendorCode} — ${v.vendorName}` : v.vendorName}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Vendor GST Number" readOnly>
              <Input value={header.vendorGstin} readOnly className="bg-erp-surface-alt font-mono" />
            </ErpFieldRow>
            <ErpFieldRow
              label="Place of Supply"
              hint={
                header.vendorId
                  ? header.isInterstate
                    ? 'Inter-state supply → IGST on lines and totals'
                    : 'Intra-state supply → CGST + SGST on lines and totals'
                  : 'Set vendor and delivery location to derive GST split'
              }
            >
              <Input
                value={header.placeOfSupply}
                disabled={!editable}
                onChange={(e) => {
                  const gst = resolvePoGstFromLocations(
                    selectedVendor,
                    selectedDeliveryLocation,
                    purchaseSetup,
                    e.target.value,
                  )
                  patchHeader({
                    placeOfSupply: gst.placeOfSupplyLabel,
                    isInterstate: gst.isInterstate,
                  })
                }}
              />
            </ErpFieldRow>
            <ErpFieldRow label="GST scheme" readOnly>
              <Input
                readOnly
                className="bg-erp-surface-alt"
                value={
                  !header.vendorId
                    ? '—'
                    : header.isInterstate
                      ? 'IGST (inter-state)'
                      : 'CGST + SGST (intra-state)'
                }
              />
            </ErpFieldRow>
            <ErpFormSpan span={3}>
              <ErpFieldRow label="Vendor Address" readOnly>
                <Textarea
                  value={
                    header.vendorAddress ||
                    formatVendorAddress(selectedVendor) ||
                    ''
                  }
                  readOnly
                  rows={3}
                  className="bg-erp-surface-alt resize-none whitespace-pre-wrap"
                  placeholder="Select a vendor to show the full address"
                />
              </ErpFieldRow>
            </ErpFormSpan>
            <ErpFieldRow label="Purchase Location">
              <Select
                value={header.purchaseLocationId}
                disabled={!editable}
                onChange={(e) => patchHeader({ purchaseLocationId: e.target.value })}
              >
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Delivery Location">
              <Select
                value={header.deliveryLocationId}
                disabled={!editable}
                onChange={(e) => {
                  const deliveryLocationId = e.target.value
                  const loc = locationOptions.find((l) => l.id === deliveryLocationId)
                  const gst = resolvePoGstFromLocations(
                    selectedVendor,
                    loc,
                    purchaseSetup,
                  )
                  patchHeader({
                    deliveryLocationId,
                    placeOfSupply: gst.placeOfSupplyLabel,
                    isInterstate: gst.isInterstate,
                  })
                }}
              >
                {locationOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFormSpan span={3}>
              <div className="grid gap-3 md:grid-cols-2">
                <ErpFieldRow label="Purchase Location Address" readOnly>
                  <Textarea
                    value={
                      selectedPurchaseLocation?.address ||
                      [
                        selectedPurchaseLocation?.name,
                        selectedPurchaseLocation?.city,
                        selectedPurchaseLocation?.state,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    }
                    readOnly
                    rows={3}
                    className="resize-none whitespace-pre-wrap bg-erp-surface-alt"
                    placeholder="Select a purchase location to show its full address"
                  />
                </ErpFieldRow>
                <ErpFieldRow label="Delivery Location Address" readOnly>
                  <Textarea
                    value={
                      selectedDeliveryLocation?.address ||
                      [
                        selectedDeliveryLocation?.name,
                        selectedDeliveryLocation?.city,
                        selectedDeliveryLocation?.state,
                      ]
                        .filter(Boolean)
                        .join(', ')
                    }
                    readOnly
                    rows={3}
                    className="resize-none whitespace-pre-wrap bg-erp-surface-alt"
                    placeholder="Select a delivery location to show its full address"
                  />
                </ErpFieldRow>
              </div>
            </ErpFormSpan>
            <ErpFieldRow
              id={purchaseFieldId('expectedDeliveryDate')}
              label="Expected Delivery Date"
              required
              fieldError={showErrors ? activeValidation.fieldErrors.expectedDeliveryDate : undefined}
              fieldState={
                showErrors && activeValidation.fieldErrors.expectedDeliveryDate ? 'error' : 'idle'
              }
            >
              <Input
                type="date"
                value={header.expectedDeliveryDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ expectedDeliveryDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Validity Date">
              <Input
                type="date"
                value={header.validityDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ validityDate: e.target.value })}
              />
            </ErpFieldRow>
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('lines')}
            title="Item Lines"
            subtitle="Catalog or manual lines — table on tablet/desktop; expandable cards on mobile"
            icon={Package}
            accent="teal"
            collapsible
            defaultOpen
            forceOpenKey={forceOpenSections.lines}
            dense
            columns={1}
            className="purchase-doc-lines-section ring-1 ring-teal-200/70 shadow-sm"
            badge={
              <span className="text-[11px] tabular-nums text-erp-muted">
                {computedLines.length} line{computedLines.length === 1 ? '' : 's'}
              </span>
            }
          >
            <div id={purchaseFieldId('lines')} className="min-w-0 max-w-full">
              <PurchaseOrderLinesTable
                lines={computedLines}
                catalogItems={catalogItemsForPicker}
                warehouseOptions={locationOptions}
                binOptions={warehouseBinOptions}
                qualityTestGroupOptions={qualityTestGroupOptions}
                editable={editable}
                isInterstate={isInterstate}
                dirty={dirty}
                formatCurrency={formatCurrency}
                showErrors={showErrors}
                lineErrors={activeValidation.lineErrors}
                onAddLine={() =>
                  setLinesDirty([...lines, emptyLine({ lineNo: nextPurchaseLineNo(lines) })])
                }
                onPatchLine={patchLine}
                onRemoveLine={(key) => setLinesDirty(lines.filter((l) => l.key !== key))}
                onSelectCatalogItem={applyItemCatalog}
                secondaryActions={[
                  {
                    id: 'copy',
                    label: 'Copy last line',
                    icon: Copy,
                    disabled: !editable || lines.length === 0,
                    onClick: () => {
                      const last = lines[lines.length - 1]
                      if (!last) return
                      setLinesDirty([
                        ...lines,
                        {
                          ...last,
                          key: crypto.randomUUID(),
                          id: '',
                          lineNo: nextPurchaseLineNo(lines),
                        },
                      ])
                    },
                  },
                  {
                    id: 'clear',
                    label: 'Clear lines',
                    icon: Eraser,
                    disabled: !editable || lines.length === 0,
                    onClick: () => setLinesDirty(createBlankPoLines(3)),
                  },
                ]}
              />
              {showErrors &&
              activeValidation.errors.some(
                (e) =>
                  /line/i.test(e) ||
                  /item/i.test(e) ||
                  /quantity/i.test(e) ||
                  /rate/i.test(e),
              ) ? (
                <p className="mt-2 text-[12px] text-erp-danger-fg">
                  Fix line errors before submit.
                </p>
              ) : null}
            </div>
            <PurchaseOrderAdjustmentsBlock
              className="mt-4"
              lines={computedLines}
              value={orderAdjustments}
              readOnly={!editable}
              computeTotals={(lines, adj) =>
                computePoOrderDocumentTotals(lines as PoLineForOrderAdjust[], adj)
              }
              onChange={(next) => {
                setOrderAdjustments(next)
                markDirty()
              }}
            />
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('tax')}
            title="Tax & Totals"
            subtitle="Charges, GST breakdown, and grand total"
            collapsedSummary={taxSummary || undefined}
            icon={Banknote}
            accent="amber"
            collapsible
            defaultOpen={taxTotalsDefaultOpen}
            dense
            columns={1}
          >
            <PurchaseTaxTotalsPanel
              charges={[
                {
                  id: 'basic',
                  label: 'Basic Amount',
                  kind: 'value',
                  value: formatCurrency(totals.subtotal),
                },
                {
                  id: 'lineDiscount',
                  label: 'Line Discount',
                  kind: 'value',
                  value: formatCurrency(totals.lineDiscount),
                },
                {
                  id: 'orderDiscount',
                  label: 'Order Discount',
                  kind: 'value',
                  value: formatCurrency(orderDocumentTotals.orderDiscount.calculatedAmount),
                  hidden: orderDocumentTotals.orderDiscount.calculatedAmount <= 0,
                },
                {
                  id: 'freight',
                  label: 'Freight',
                  kind: 'value',
                  value: formatCurrency(orderDocumentTotals.freight.calculatedAmount),
                  hidden: orderDocumentTotals.freight.calculatedAmount <= 0,
                },
                {
                  id: 'installation',
                  label: 'Installation',
                  kind: 'value',
                  value: formatCurrency(orderDocumentTotals.installation.calculatedAmount),
                  hidden: orderDocumentTotals.installation.calculatedAmount <= 0,
                },
                {
                  id: 'other',
                  label: 'Other Charges',
                  kind: 'value',
                  value: formatCurrency(orderDocumentTotals.otherCharges.calculatedAmount),
                  hidden: orderDocumentTotals.otherCharges.calculatedAmount <= 0,
                },
                {
                  id: 'insurance',
                  label: 'Insurance',
                  kind: 'input',
                  value: header.insuranceCharges,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ insuranceCharges: v }),
                },
                {
                  id: 'tcs',
                  label: 'TCS',
                  kind: 'input',
                  value: header.tcsAmount,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ tcsAmount: v }),
                  hidden: !showTcs,
                },
              ]}
              calcRows={[
                {
                  id: 'taxable',
                  label: 'Taxable Amount',
                  value: formatCurrency(totals.taxableAmount),
                },
                {
                  id: 'cgst',
                  label: 'CGST',
                  value: formatCurrency(totals.cgst),
                  hidden: isInterstate,
                },
                {
                  id: 'sgst',
                  label: 'SGST',
                  value: formatCurrency(totals.sgst),
                  hidden: isInterstate,
                },
                {
                  id: 'igst',
                  label: 'IGST',
                  value: formatCurrency(totals.igst),
                  hidden: !isInterstate,
                },
                {
                  id: 'roundOff',
                  label: 'Round Off',
                  value: formatCurrency(totals.roundOff),
                },
              ]}
              grandTotalValue={formatCurrency(totals.totalAmount)}
            />
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('notes')}
            title="Terms, Notes & Attachments"
            subtitle="Commercial terms, narrative, internal notes, and supporting files"
            collapsedSummary={
              [commercialSummary, notesPeek, attachmentsPeek].filter(Boolean).join(' · ') ||
              undefined
            }
            icon={CheckCircle}
            accent="slate"
            collapsible
            defaultOpen={false}
            forceOpenKey={forceOpenSections.notes}
            dense
            columns={1}
          >
            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Commercial</p>
            </ErpFormSpan>
            <ErpFieldRow label="Price Basis">
              <PurchaseTermSelect
                value={header.priceBasis}
                options={PURCHASE_PRICE_BASIS}
                disabled={!editable}
                onChange={(v) => patchHeader({ priceBasis: v })}
                emptyLabel="Select price basis…"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Payment Terms">
              <PurchaseTermSelect
                value={header.paymentTerms}
                options={PURCHASE_PAYMENT_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ paymentTerms: v })}
                emptyLabel="Select payment terms…"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Delivery Terms">
              <PurchaseTermSelect
                value={header.deliveryTerms}
                options={PURCHASE_DELIVERY_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ deliveryTerms: v })}
                emptyLabel="Select delivery terms…"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Freight Terms">
              <PurchaseTermSelect
                value={header.freightTerms}
                options={PURCHASE_FREIGHT_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ freightTerms: v })}
                emptyLabel="Select freight terms…"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Packing Terms">
              <PurchaseTermSelect
                value={header.packingTerms}
                options={PURCHASE_PACKING_TERMS}
                disabled={!editable}
                onChange={(v) => patchHeader({ packingTerms: v })}
                emptyLabel="Select packing terms…"
              />
            </ErpFieldRow>
            {showInsuranceTerms ? (
              <ErpFieldRow label="Insurance Terms">
                <PurchaseTermSelect
                  value={header.insuranceTerms}
                  options={PURCHASE_INSURANCE_TERMS}
                  disabled={!editable}
                  onChange={(v) => patchHeader({ insuranceTerms: v })}
                  emptyLabel="Select insurance terms…"
                />
              </ErpFieldRow>
            ) : null}
            <ErpFieldRow label="Warranty">
              <Input
                value={header.warranty}
                disabled={!editable}
                onChange={(e) => patchHeader({ warranty: e.target.value })}
                placeholder="e.g. 12 months manufacturing defect"
              />
            </ErpFieldRow>
            {showInspectionRequirement ? (
              <ErpFieldRow label="Inspection Requirement" colSpan={3}>
                <Input
                  value={header.inspectionRequirement}
                  disabled={!editable}
                  onChange={(e) => patchHeader({ inspectionRequirement: e.target.value })}
                  placeholder="e.g. Mill TC + dimensional check on receipt"
                />
              </ErpFieldRow>
            ) : null}

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label mt-2">Notes &amp; Attachments</p>
            </ErpFormSpan>
            <PurchaseTermsNotesTabs
              disabled={!editable}
              values={{
                termsAndConditions: header.termsAndConditions,
                internalNotes: header.internalNotes,
                remarks: header.remarks,
              }}
              onChange={(patch) => patchHeader(patch)}
              attachmentsIndicator={attachments.length > 0}
              attachmentsTitle={
                attachments.length
                  ? `${attachments.length} file${attachments.length === 1 ? '' : 's'}`
                  : undefined
              }
              attachmentsPanel={
                <PurchaseDocumentAttachments
                  files={attachments}
                  disabled={!editable}
                  uploadedBy={ACTOR.name}
                  hint="PO specifications, drawings, quotations, and supporting documents"
                  onChange={(next) => {
                    setAttachments(next)
                    markDirty()
                  }}
                />
              }
            />
          </ErpCardSection>
          </div>
        </>
      ) : (
        <LoadingState variant="form" rows={6} />
      )}
    </PurchaseCardFormShell>
    </>
  )
}
