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
import { isApiMode } from '@/config/apiConfig'
import { fetchLookup } from '@/services/api/masterApi'
import { usePurchaseMasterStore } from '@/store/purchaseMasterStore'

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
    gstRatePct: 18,
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
  lines: PoEditorLine[],
  tradeDiscount: number,
  freight: number,
  packingCharges: number,
  insuranceCharges: number,
  otherCharges: number,
  tcsAmount: number,
) {
  const subtotal = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0)
  const lineDiscount = lines.reduce((s, l) => s + (Number(l.discountAmount) || 0), 0)
  const discount = lineDiscount + tradeDiscount
  const taxableAmount = lines.reduce((s, l) => s + l.taxableAmount, 0)
  const cgst = lines.reduce((s, l) => s + l.cgst, 0)
  const sgst = lines.reduce((s, l) => s + l.sgst, 0)
  const igst = lines.reduce((s, l) => s + l.igst, 0)
  const rawTotal =
    taxableAmount + cgst + sgst + igst + freight + packingCharges + insuranceCharges + otherCharges + tcsAmount
  const totalAmount = Math.round(rawTotal)
  const roundOff = Number((totalAmount - rawTotal).toFixed(2))
  return {
    subtotal: Number(subtotal.toFixed(2)),
    lineDiscount: Number(lineDiscount.toFixed(2)),
    discount: Number(discount.toFixed(2)),
    taxableAmount: Number(taxableAmount.toFixed(2)),
    cgst: Number(cgst.toFixed(2)),
    sgst: Number(sgst.toFixed(2)),
    igst: Number(igst.toFixed(2)),
    roundOff,
    totalAmount,
  }
}

interface PoEditorHeader {
  documentDate: string
  orderType: PurchaseOrderType
  vendorId: string
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

function defaultHeader(): PoEditorHeader {
  return {
    documentDate: today(),
    orderType: 'standard',
    vendorId: '',
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
    vendorId: po.vendor.id,
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
  const [binOptions, setBinOptions] = useState<Array<{ id: string; code: string; name: string; warehouseId?: string }>>([])

  const originParam = (searchParams.get('origin') ?? '') as string
  const originModeFromParam: PurchaseOrderOrigin =
    originParam === 'pr'
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
   * Deep links (`?origin=…`, `?prId=…`, etc.) auto-create then navigate to edit.
   */
  const [selectedPrId] = useState(searchParams.get('prId') ?? '')
  const [selectedPrVendorId] = useState('')
  const [selectedComparisonId] = useState(searchParams.get('comparisonId') ?? '')
  const [selectedVqId] = useState(searchParams.get('vqId') ?? '')

  const [activeBlankets, setActiveBlankets] = useState<BlanketPurchaseOrder[]>([])
  const [selectedBlanketId] = useState(searchParams.get('blanketId') ?? '')
  const [blanketQuantities] = useState<Record<string, number>>({})

  const editable = EDITABLE_STATUSES.includes(status)
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(editable)

  const selectedVendor = useMemo(() => vendors.find((v) => v.id === header.vendorId), [vendors, header.vendorId])
  const selectedPurchaseLocation = useMemo(
    () => locationOptions.find((location) => location.id === header.purchaseLocationId),
    [header.purchaseLocationId, locationOptions],
  )
  const selectedDeliveryLocation = useMemo(
    () => locationOptions.find((location) => location.id === header.deliveryLocationId),
    [header.deliveryLocationId, locationOptions],
  )
  const warehouseBinOptions = useMemo(
    () =>
      binOptions.filter(
        (b) => !header.deliveryLocationId || !b.warehouseId || b.warehouseId === header.deliveryLocationId,
      ),
    [binOptions, header.deliveryLocationId],
  )
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
  const totals = useMemo(
    () =>
      aggregateTotals(
        computedLines,
        Number(header.tradeDiscount) || 0,
        Number(header.freight) || 0,
        Number(header.packingCharges) || 0,
        Number(header.insuranceCharges) || 0,
        Number(header.otherCharges) || 0,
        Number(header.tcsAmount) || 0,
      ),
    [computedLines, header.tradeDiscount, header.freight, header.packingCharges, header.insuranceCharges, header.otherCharges, header.tcsAmount],
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
  const vendorFact = selectedVendor?.vendorName || 'Not selected'

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
    const vendor = vendors.find((v) => v.id === vendorId)
    if (!vendor) {
      patchHeader({ vendorId: '', vendorGstin: '', vendorState: '', vendorAddress: '', isInterstate: false })
      return
    }
    const gst = determinePurchaseGstSupply({
      supplierState: vendor.state,
      supplierStateCode: vendor.stateCode,
      supplierGstin: vendor.gstin,
      placeOfSupply: header.placeOfSupply,
      defaultPlaceOfSupplyState: purchaseSetup?.tax.placeOfSupplyState,
      defaultPlaceOfSupplyStateCode: purchaseSetup?.tax.placeOfSupplyStateCode,
    })
    const placeOfSupply = header.placeOfSupply || gst.placeOfSupplyLabel
    patchHeader({
      vendorId: vendor.id,
      vendorGstin: vendor.gstin,
      vendorState: vendor.state,
      vendorAddress: formatVendorAddress(vendor),
      placeOfSupply,
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
    const factor =
      master?.purchaseUomId && master.purchaseUomId !== master.baseUomId
        ? Number(master.uomConversionFactor ?? master.purchaseQtyPerUom ?? 1) || 1
        : 1
    const purchaseUomId = master?.purchaseUomId ?? master?.baseUomId ?? null
    const purchaseUomCode =
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
      hsnCode: hsnMaster?.code ?? item.hsnCode,
      hsnId,
      gstGroupId,
      gstGroupCode: gstGroupMaster?.code ?? '',
      sacCode: item.sacCode,
      qcRequired: Boolean(item.qcRequired ?? master?.qcRequired),
      qualityTestGroupCode: item.qualityTestGroupCode ?? master?.qualityTestGroupCode ?? null,
      rate: item.standardRate,
      gstRatePct: item.gstRatePct,
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
    ]).then(([vendorRows, items, blankets, setup, warehouses]) => {
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
      if (isNew) {
        const preferred =
          (setup.general.defaultWarehouseId &&
            locs.find((l) => l.id === setup.general.defaultWarehouseId)?.id) ||
          ''
        setHeader((prev) => ({
          ...prev,
          purchaseLocationId: prev.purchaseLocationId || preferred,
          deliveryLocationId: prev.deliveryLocationId || preferred,
          paymentTerms: prev.paymentTerms || setup.general.defaultPaymentTerms || prev.paymentTerms,
          deliveryTerms: prev.deliveryTerms || setup.general.defaultDeliveryTerms || prev.deliveryTerms,
          placeOfSupply:
            prev.placeOfSupply ||
            formatPlaceOfSupplyLabel(
              setup.tax.placeOfSupplyStateCode,
              setup.tax.placeOfSupplyState,
            ),
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

  useEffect(() => {
    if (isApiMode()) {
      let cancelled = false
      fetchLookup('bins')
        .then((res) => {
          if (cancelled) return
          setBinOptions(
            res.data.map((b) => ({
              id: b.id,
              code: b.code ?? b.name,
              name: b.name,
              warehouseId: b.warehouseId,
            })),
          )
        })
        .catch(() => undefined)
      return () => {
        cancelled = true
      }
    }
    const demoBins = usePurchaseMasterStore.getState().getByKind('bin-codes', true)
    setBinOptions(
      demoBins.map((e) => ({
        id: e.code,
        code: e.code,
        name: e.name,
      })),
    )
  }, [])

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
      setHeader(headerFromPo(po))
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
      freight: Number(header.freight) || 0,
      otherCharges: Number(header.otherCharges) || 0,
      packingCharges: Number(header.packingCharges) || 0,
      insuranceCharges: Number(header.insuranceCharges) || 0,
      tradeDiscount: Number(header.tradeDiscount) || 0,
      tcsAmount: Number(header.tcsAmount) || 0,
      discount: totals.lineDiscount + (Number(header.tradeDiscount) || 0),
      lines: computedLines
        .filter((l) => l.itemId || l.itemCode.trim() || l.itemName.trim())
        .map(({ key: _key, productType: _productType, ...rest }) => ({
          ...rest,
          category: (rest.category ||
            mapEngineeringProductTypeToPurchaseCategory(_productType) ||
            'raw_material') as PurchaseItemCategory,
        })),
    }
  }, [attachmentIds, computedLines, header, totals.lineDiscount, locationOptions, ACTOR])

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
    if (originMode === 'quotation_comparison' && selectedComparisonId) {
      void createFromOrigin()
    }
    if (originMode === 'vendor_quotation' && selectedVqId) {
      void createFromOrigin()
    }
    if (originMode === 'purchase_requisition' && selectedPrId) {
      void createFromOrigin()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vendorCode} — {v.vendorName}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Vendor GST Number" readOnly>
              <Input value={header.vendorGstin} readOnly className="bg-erp-surface-alt font-mono" />
            </ErpFieldRow>
            <ErpFieldRow label="Place of Supply">
              <Input
                value={header.placeOfSupply}
                disabled={!editable}
                onChange={(e) => {
                  const placeOfSupply = e.target.value
                  const gst = determinePurchaseGstSupply({
                    supplierState: header.vendorState,
                    supplierGstin: header.vendorGstin,
                    placeOfSupply,
                    defaultPlaceOfSupplyState: purchaseSetup?.tax.placeOfSupplyState,
                    defaultPlaceOfSupplyStateCode: purchaseSetup?.tax.placeOfSupplyStateCode,
                  })
                  patchHeader({
                    placeOfSupply,
                    isInterstate: gst.isInterstate,
                  })
                }}
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
                onChange={(e) => patchHeader({ deliveryLocationId: e.target.value })}
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
                  id: 'tradeDiscount',
                  label: 'Trade Discount',
                  kind: 'input',
                  value: header.tradeDiscount,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ tradeDiscount: v }),
                },
                {
                  id: 'freight',
                  label: 'Freight',
                  kind: 'input',
                  value: header.freight,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ freight: v }),
                },
                {
                  id: 'packing',
                  label: 'Packing Charges',
                  kind: 'input',
                  value: header.packingCharges,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ packingCharges: v }),
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
                  id: 'other',
                  label: 'Other Charges',
                  kind: 'input',
                  value: header.otherCharges,
                  disabled: !editable,
                  onChange: (v) => patchHeader({ otherCharges: v }),
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
