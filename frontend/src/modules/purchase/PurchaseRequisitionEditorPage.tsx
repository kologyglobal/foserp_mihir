import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  FileText,
  Layers,
  Package,
  Paperclip,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { useOptionalAuth } from '@/context/AuthProvider'
import { isApiMode } from '@/config/apiConfig'
import {
  PurchaseEnterpriseFactBox,
  purchaseSectionId,
  scrollToPurchaseSection,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import { PurchaseRequisitionLinesTable } from '@/components/purchase/PurchaseRequisitionLinesTable'
import { PurchaseRequisitionPathBanner } from '@/components/purchase/PurchaseRequisitionPathBanner'
import {
  PurchaseDocumentAttachments,
  type PurchaseDocumentAttachmentRow,
} from '@/components/purchase/PurchaseDocumentAttachments'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
  ErpViewField,
} from '@/components/erp/card-form'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { Input, Textarea, Select } from '@/components/forms/Inputs'
import {
  approvalActivitySummary,
  attachmentsSummary,
  formatFastTabDate,
  hasMeaningfulTaxTotals,
  joinFastTabSummary,
  taxTotalsSummary,
} from '@/modules/purchase/purchaseFastTabSummaries'
import { Badge } from '@/components/ui/Badge'
import { LoadingState } from '@/design-system/components/LoadingState'
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard'
import {
  createPurchaseRequisition,
  getApprovalHistory,
  getPurchaseItems,
  getPurchaseRequisitionById,
  getPurchaseSetup,
  getPurchaseWarehouses,
  getVendors,
  previewNextPurchaseRequisitionNumber,
  PurchaseServiceError,
  updatePurchaseRequisition,
  PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  PURCHASE_REQUISITION_TYPE_LABELS,
} from '@/services/purchase'
import {
  type ApprovalHistory,
  type PurchaseItem,
  type PurchaseItemCategory,
  type PurchaseRequisition,
  type PurchaseRequisitionAttachmentKind,
  type PurchaseRequisitionAttachmentPlaceholder,
  type Vendor,
  purchaseRequisitionApprovalStatusLabel,
} from '@/types/purchaseDomain'
import {
  summarizePrLines,
  validatePurchaseRequisitionForm,
  PR_DEPARTMENT_OPTIONS,
  prDepartmentLabel,
  normalizePrDepartmentCode,
  type PrEditorHeader,
  type PrEditorLine,
} from '@/utils/purchaseRequisitionValidation'
import {
  mapEngineeringProductTypeToPurchaseCategory,
  mapPurchaseCategoryToEngineeringProductType,
} from '@/utils/purchaseProductType'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { systemConfirm } from '@/utils/systemConfirm'
import { getSessionUser } from '@/utils/permissions'
import { PURCHASE_FORM_ROUTES } from './purchaseFormRoutes'

const ACTOR = { id: '', code: '', name: '' }

type LocationOption = {
  id: string
  code: string
  name: string
  state: string
  city: string
}

const EMPTY_LOCATION: LocationOption = {
  id: '',
  code: '',
  name: '',
  state: '',
  city: '',
}

function prPlaceholdersToRows(
  list: PurchaseRequisitionAttachmentPlaceholder[],
  uploadedBy: string,
): PurchaseDocumentAttachmentRow[] {
  return list.map((a) => ({
    id: a.id,
    fileName: a.fileName.trim() || a.id,
    type: PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS[a.kind],
    uploadedBy,
    uploadedAt: '',
    sizeBytes: null,
  }))
}

function kindFromTypeLabel(type: string): PurchaseRequisitionAttachmentKind {
  const entry = Object.entries(PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS).find(
    ([, label]) => label === type,
  )
  if (entry) return entry[0] as PurchaseRequisitionAttachmentKind
  const lower = type.toLowerCase()
  if (lower.includes('draw')) return 'drawing'
  if (lower.includes('image')) return 'image'
  if (lower.includes('pdf') || lower.includes('document')) return 'requirement_document'
  if (lower.includes('spec')) return 'technical_specification'
  return 'other'
}

function rowsToPrPlaceholders(
  rows: PurchaseDocumentAttachmentRow[],
  prev: PurchaseRequisitionAttachmentPlaceholder[],
): PurchaseRequisitionAttachmentPlaceholder[] {
  const prevById = new Map(prev.map((p) => [p.id, p]))
  return rows.map((r) => {
    const existing = prevById.get(r.id)
    if (existing) {
      return { ...existing, fileName: r.fileName }
    }
    return {
      id: r.id,
      kind: kindFromTypeLabel(r.type),
      fileName: r.fileName,
      remarks: '',
    }
  })
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function emptyLine(partial?: Partial<PrEditorLine>): PrEditorLine {
  return {
    key: crypto.randomUUID(),
    id: '',
    lineNo: 1,
    itemType: 'inventory',
    itemId: '',
    itemCode: '',
    itemName: '',
    specification: '',
    productType: '',
    category: '',
    uomId: null,
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: 0,
    estimatedRate: 0,
    amount: 0,
    currentStock: 0,
    openPoQty: 0,
    preferredVendorId: null,
    preferredVendorName: null,
    vendorNumber: '',
    requiredDate: today(),
    orderDate: '',
    customerName: '',
    locationId: '',
    locationName: '',
    binCode: '',
    purchaseOrderId: null,
    purchaseOrderNumber: '',
    purchaseQuoteNumber: '',
    purpose: '',
    remarks: '',
    attachmentNote: '',
    actionMessage: false,
    ...partial,
  }
}

function resolveLocation(
  locationId: string,
  options: LocationOption[],
): LocationOption {
  if (!locationId) return EMPTY_LOCATION
  return options.find((l) => l.id === locationId) ?? EMPTY_LOCATION
}

function defaultHeader(opts?: {
  locationId?: string
  skipRfq?: boolean
  locations?: LocationOption[]
  requester?: { id: string; code: string; name: string }
}): PrEditorHeader {
  const locations = opts?.locations?.length ? opts.locations : []
  const loc = resolveLocation(opts?.locationId ?? locations[0]?.id ?? '', locations)
  const requester = opts?.requester ?? ACTOR
  return {
    documentDate: today(),
    department: '',
    locationId: loc.id,
    locationCode: loc.code,
    locationName: loc.name,
    locationState: loc.state,
    locationCity: loc.city,
    requesterId: requester.id,
    requesterCode: requester.code,
    requesterName: requester.name,
    expectedDeliveryDate: today(),
    priority: 'normal',
    requisitionType: 'material',
    source: 'manual',
    costCentre: '',
    project: '',
    productionOrderNo: '',
    maintenanceOrderNo: '',
    referenceNumber: '',
    purpose: '',
    remarks: '',
    rfqRequired: !(opts?.skipRfq ?? false),
  }
}

function headerFromPr(pr: PurchaseRequisition): PrEditorHeader {
  return {
    documentDate: pr.documentDate,
    department: normalizePrDepartmentCode(pr.department),
    locationId: pr.location.id,
    locationCode: pr.location.code,
    locationName: pr.location.name,
    locationState: pr.location.state,
    locationCity: pr.location.city,
    requesterId: pr.requester.id,
    requesterCode: pr.requester.code,
    requesterName: pr.requester.name,
    expectedDeliveryDate: pr.expectedDeliveryDate ?? '',
    priority: pr.priority === ('medium' as string) ? 'normal' : pr.priority,
    requisitionType: pr.requisitionType,
    source: pr.source,
    costCentre: pr.costCentre,
    project: pr.project,
    productionOrderNo: pr.productionOrderNo,
    maintenanceOrderNo: pr.maintenanceOrderNo,
    referenceNumber: pr.referenceNumber,
    purpose: pr.purpose ?? '',
    remarks: pr.remarks,
    rfqRequired: pr.rfqRequired !== false,
  }
}

function linesFromPr(pr: PurchaseRequisition): PrEditorLine[] {
  return pr.lines.map((l) => {
    const productType =
      (l as PrEditorLine).productType ||
      mapPurchaseCategoryToEngineeringProductType(l.category)
    return {
      ...l,
      key: l.id || crypto.randomUUID(),
      productType,
      category: l.category || mapEngineeringProductTypeToPurchaseCategory(productType),
      actionMessage: false,
    }
  })
}

export function PurchaseRequisitionEditorPage() {
  const auth = useOptionalAuth()
  const session = auth?.session ?? null
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [recordId, setRecordId] = useState<string | null>(id ?? null)
  const [documentNumber, setDocumentNumber] = useState<string | null>(null)
  const [status, setStatus] = useState<PurchaseRequisition['status']>('draft')
  const [header, setHeader] = useState<PrEditorHeader>(defaultHeader)
  const [lines, setLines] = useState<PrEditorLine[]>([])
  const [attachments, setAttachments] = useState<PurchaseRequisitionAttachmentPlaceholder[]>([])
  const [history, setHistory] = useState<ApprovalHistory[]>([])
  const [createdMeta, setCreatedMeta] = useState({ by: ACTOR.name, at: '' })
  const [updatedMeta, setUpdatedMeta] = useState({ by: '', at: '' })
  const [catalogItems, setCatalogItems] = useState<PurchaseItem[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([])
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [, setLastSavedAt] = useState<Date | null>(null)
  const [forceOpenAdditionalKey, setForceOpenAdditionalKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editable = status === 'draft' || status === 'rejected'
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(editable)

  useEffect(() => {
    if (!isNew || !isApiMode() || !session?.user) return
    const name = `${session.user.firstName ?? ''} ${session.user.lastName ?? ''}`.trim()
    setHeader((prev) => ({
      ...prev,
      requesterId: session.user.id,
      requesterCode: session.user.email?.split('@')[0] ?? '',
      requesterName: name || session.user.email || session.user.id,
    }))
    setCreatedMeta((prev) => ({ ...prev, by: name || session.user.email || prev.by }))
  }, [isNew, session])

  const validation = useMemo(
    () => validatePurchaseRequisitionForm(header, lines),
    [header, lines],
  )
  const showErrors = attemptedSubmit
  const summary = useMemo(() => summarizePrLines(lines), [lines])
  const financeDefaultOpen = hasMeaningfulTaxTotals(
    summary.estimatedSubtotal,
    summary.estimatedTaxes,
    summary.estimatedTotal,
  )
  const financeSummaryText = useMemo(
    () =>
      taxTotalsSummary({
        subtotal: summary.estimatedSubtotal,
        tax: summary.estimatedTaxes,
        total: summary.estimatedTotal,
      }),
    [summary.estimatedSubtotal, summary.estimatedTaxes, summary.estimatedTotal],
  )
  const attachmentsSummaryText = useMemo(
    () => attachmentsSummary(attachments.length),
    [attachments.length],
  )
  const approvalSummaryText = useMemo(
    () =>
      approvalActivitySummary({
        statusLabel: PURCHASE_REQUISITION_STATUS_LABELS[status],
        historyCount: history.length,
      }),
    [status, history.length],
  )
  const additionalDefaultOpen =
    status === 'pending_approval' || status === 'approved' || history.length > 0
  const additionalSummaryText = useMemo(
    () =>
      joinFastTabSummary([
        PURCHASE_REQUISITION_STATUS_LABELS[status],
        approvalSummaryText || false,
      ]),
    [status, approvalSummaryText],
  )
  const quickEntrySummaryText = useMemo(
    () =>
      joinFastTabSummary([
        header.department.trim() || false,
        PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
        PURCHASE_REQUISITION_TYPE_LABELS[header.requisitionType],
        header.rfqRequired ? 'RFQ Purchase Path' : 'Direct Purchase Planning Path',
        header.locationName || false,
        PURCHASE_REQUISITION_SOURCE_LABELS[header.source],
        header.project.trim() || false,
        header.referenceNumber.trim() ? `Ref ${header.referenceNumber.trim()}` : false,
        header.remarks.trim() ? 'Remarks set' : false,
        formatFastTabDate(header.expectedDeliveryDate)
          ? `Need-by ${formatFastTabDate(header.expectedDeliveryDate)}`
          : false,
      ]),
    [
      header.department,
      header.priority,
      header.requisitionType,
      header.rfqRequired,
      header.locationName,
      header.source,
      header.project,
      header.referenceNumber,
      header.remarks,
      header.expectedDeliveryDate,
    ],
  )

  const formMetrics = useMemo(
    () => [
      {
        label: 'Lines',
        value: String(summary.totalLines),
        accent: 'green' as const,
      },
      {
        label: 'Total Qty',
        value: String(summary.totalQuantity),
        accent: 'slate' as const,
      },
      {
        label: 'Est. Subtotal',
        value: formatCurrency(summary.estimatedSubtotal),
        accent: 'blue' as const,
      },
      {
        label: 'Est. Taxes',
        value: formatCurrency(summary.estimatedTaxes),
        accent: 'violet' as const,
        hint: '18% provisional',
      },
      {
        label: 'Est. Total',
        value: formatCurrency(summary.estimatedTotal),
        accent: 'amber' as const,
        highlight: summary.estimatedTotal > 0,
      },
    ],
    [summary],
  )

  const documentTitle = isNew
    ? 'New Purchase Requisition'
    : (documentNumber ?? 'Purchase Requisition')
  const departmentFact = header.department
    ? prDepartmentLabel(header.department)
    : 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(documentNumber
        ? [{ label: 'PR No', value: documentNumber }]
        : isNew
          ? [{ label: 'PR No', value: 'Loading…' }]
          : []),
      { label: 'Department', value: departmentFact },
      { label: 'Requester', value: header.requesterName },
      {
        label: 'Date',
        value: header.documentDate ? formatDate(header.documentDate) : 'Not selected',
      },
      {
        label: 'Priority',
        value: PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
      },
    ],
    [
      isNew,
      documentNumber,
      departmentFact,
      header.requesterName,
      header.documentDate,
      header.priority,
    ],
  )

  const patchHeader = (patch: Partial<PrEditorHeader>) => {
    setHeader((h) => ({ ...h, ...patch }))
    markDirty()
  }

  const renumber = (next: PrEditorLine[]) =>
    next.map((l, i) => ({ ...l, lineNo: i + 1, amount: Number(((Number(l.quantity) || 0) * (Number(l.estimatedRate) || 0)).toFixed(2)) }))

  const patchLine = (key: string, patch: Partial<PrEditorLine>) => {
    setLines((prev) =>
      renumber(
        prev.map((l) => {
          if (l.key !== key) return l
          const merged = { ...l, ...patch }
          merged.amount = Number(
            ((Number(merged.quantity) || 0) * (Number(merged.estimatedRate) || 0)).toFixed(2),
          )
          return merged
        }),
      ),
    )
    markDirty()
  }

  const setLinesDirty = (next: PrEditorLine[]) => {
    setLines(renumber(next))
    markDirty()
  }

  useEffect(() => {
    void Promise.all([getPurchaseItems(), getVendors(), getPurchaseWarehouses()]).then(
      ([items, v, warehouses]) => {
        setCatalogItems(items)
        setVendors(v)
        if (warehouses.length) {
          setLocationOptions(
            warehouses.map((w) => ({
              id: w.id,
              code: w.code,
              name: w.name,
              state: w.state,
              city: w.city,
            })),
          )
        }
      },
    )
  }, [])

  const threeEmptyLines = (loc?: { locationId: string; locationName: string }) =>
    [emptyLine(loc), emptyLine(loc), emptyLine(loc)].map((l, i) => ({
      ...l,
      lineNo: i + 1,
    }))

  useEffect(() => {
    if (!isNew) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [setup, nextNumber, warehouses] = await Promise.all([
        getPurchaseSetup(),
        previewNextPurchaseRequisitionNumber().catch(() => null),
        getPurchaseWarehouses(),
      ])
      if (cancelled) return
      if (nextNumber) setDocumentNumber(nextNumber)
      const locs =
        warehouses.length > 0
          ? warehouses.map((w) => ({
              id: w.id,
              code: w.code,
              name: w.name,
              state: w.state,
              city: w.city,
            }))
          : []
      setLocationOptions(locs)
      // Requisition Setup default wins; fall back to the General Setup warehouse.
      const candidateIds = [
        setup.requisition.defaultWarehouseId,
        setup.general.defaultWarehouseId,
      ]
      const preferredId =
        candidateIds.find((id) => id && locs.some((l) => l.id === id)) ?? ''
      const loc = resolveLocation(preferredId ?? '', locs)
      setHeader((prev) => {
        // Preserve the session-derived requester — this effect resolves after the
        // session effect and must not reset it back to the empty ACTOR default.
        const fallback = getSessionUser()
        return defaultHeader({
          locationId: loc.id,
          skipRfq: setup.requisition.skipRfq,
          locations: locs,
          requester: prev.requesterId
            ? { id: prev.requesterId, code: prev.requesterCode, name: prev.requesterName }
            : { id: fallback.id, code: '', name: fallback.name },
        })
      })
      const lineLoc = loc.id
        ? { locationId: loc.id, locationName: loc.name }
        : undefined
      setLines(threeEmptyLines(lineLoc))
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [isNew, resetDirty])

  const catalogItemsForPicker = useMemo(
    () =>
      catalogItems.map((item) => ({
        ...item,
        preferredVendorName:
          vendors.find((v) => v.id === item.preferredVendorId)?.vendorName ?? null,
        lastPurchaseRate: item.standardRate,
        availableStock: item.isStockable
          ? Math.max(0, Math.round(item.reorderLevel * 1.4))
          : null,
      })),
    [catalogItems, vendors],
  )

  useEffect(() => {
    if (isNew || !id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const pr = await getPurchaseRequisitionById(id)
      if (cancelled) return
      if (!pr) {
        setLoading(false)
        notify.error('Purchase requisition not found')
        navigate('/purchase/requisitions')
        return
      }
      setRecordId(pr.id)
      setDocumentNumber(pr.documentNumber)
      setStatus(pr.status)
      setHeader(headerFromPr(pr))
      setLines(linesFromPr(pr))
      setAttachments(pr.attachmentPlaceholders ?? [])
      setCreatedMeta({ by: pr.createdBy, at: pr.createdAt })
      setUpdatedMeta({ by: pr.updatedBy ?? '', at: pr.updatedAt ?? '' })
      const hist = await getApprovalHistory(pr.id)
      if (!cancelled) setHistory(hist)
      resetDirty()
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, isNew, navigate, resetDirty])

  const toInput = useCallback(() => {
    const location = {
      id: header.locationId,
      code: header.locationCode,
      name: header.locationName,
      state: header.locationState,
      city: header.locationCity,
    }
    const sessionUser = session?.user
    const requesterId = header.requesterId || sessionUser?.id || ''
    const requesterName =
      header.requesterName ||
      (sessionUser
        ? `${sessionUser.firstName ?? ''} ${sessionUser.lastName ?? ''}`.trim() ||
          sessionUser.email
        : '')
    return {
      documentDate: header.documentDate,
      department: header.department,
      location,
      requester: {
        id: requesterId,
        code: header.requesterCode || sessionUser?.email?.split('@')[0] || '',
        name: requesterName,
      },
      expectedDeliveryDate: header.expectedDeliveryDate || null,
      priority: header.priority,
      requisitionType: header.requisitionType,
      source: header.source,
      costCentre: header.costCentre,
      project: header.project,
      productionOrderNo: header.productionOrderNo,
      maintenanceOrderNo: header.maintenanceOrderNo,
      referenceNumber: header.referenceNumber,
      purpose: header.purpose || null,
      remarks: header.remarks,
      rfqRequired: header.rfqRequired,
      attachmentPlaceholders: attachments,
      estimatedTaxPct: summary.estimatedTaxPct,
      lines: lines
        .filter(
          (l) =>
            (l.itemName.trim() || l.itemCode.trim() || l.itemId) &&
            (l.productType || l.category) &&
            Number(l.quantity) > 0,
        )
        .map(({ key: _key, productType, category, actionMessage: _actionMessage, ...rest }) => ({
          ...rest,
          category: (category ||
            mapEngineeringProductTypeToPurchaseCategory(productType) ||
            'consumable') as PurchaseItemCategory,
        })),
    }
  }, [attachments, header, lines, session, summary.estimatedTaxPct])

  const saveDraft = async () => {
    if (!editable || saving) return
    setAttemptedSubmit(true)
    if (validation.errors.length) {
      const section =
        validation.fieldErrors.department ||
        validation.fieldErrors.locationId ||
        validation.fieldErrors.requesterId ||
        validation.fieldErrors.expectedDeliveryDate
          ? 'general'
          : validation.errors.some((e) => /line|quantity|item|uom/i.test(e))
            ? 'lines'
            : 'general'
      focusValidationSection(section)
      notify.error(validation.errors[0] ?? 'Fix validation errors before saving')
      return
    }
    setSaving(true)
    try {
      if (recordId) {
        const updated = await updatePurchaseRequisition(recordId, toInput())
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setUpdatedMeta({ by: updated.updatedBy ?? '', at: updated.updatedAt ?? '' })
        notify.success(`Saved · ${updated.documentNumber}`)
        setLastSavedAt(new Date())
      } else {
        const created = await createPurchaseRequisition(toInput())
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
        setStatus(created.status)
        setCreatedMeta({ by: created.createdBy, at: created.createdAt })
        notify.success(`Saved · ${created.documentNumber}`)
        setLastSavedAt(new Date())
      }
      resetDirty()
      navigate(PURCHASE_FORM_ROUTES.requisition.list, { replace: true })
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const focusValidationSection = useCallback(
    (section: 'general' | 'lines') => {
      const needsAdditional =
        section === 'general' &&
        (Boolean(validation.fieldErrors.productionOrderNo) ||
          Boolean(validation.fieldErrors.maintenanceOrderNo))
      if (needsAdditional) {
        setForceOpenAdditionalKey((k) => k + 1)
      }
      window.requestAnimationFrame(() => {
        scrollToPurchaseSection(needsAdditional ? 'costing' : section)
      })
    },
    [validation.fieldErrors.productionOrderNo, validation.fieldErrors.maintenanceOrderNo],
  )

  const focusValidationItem = useCallback(
    (message: string) => {
      const looksLikeLine =
        /line/i.test(message) ||
        /quantity/i.test(message) ||
        /description/i.test(message) ||
        /unit/i.test(message) ||
        /At least one line/i.test(message)
      const needsAdditional =
        !looksLikeLine &&
        (Boolean(validation.fieldErrors.productionOrderNo) ||
          Boolean(validation.fieldErrors.maintenanceOrderNo))
      if (needsAdditional) {
        setForceOpenAdditionalKey((k) => k + 1)
      }
      window.requestAnimationFrame(() => {
        scrollToPurchaseSection(
          looksLikeLine ? 'lines' : needsAdditional ? 'costing' : 'general',
        )
      })
    },
    [validation.fieldErrors.productionOrderNo, validation.fieldErrors.maintenanceOrderNo],
  )

  const applyItemCatalog = (key: string, itemId: string) => {
    const line = lines.find((l) => l.key === key)
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item || !line) return
    const productType = item.productType ?? ''
    const category =
      item.category || mapEngineeringProductTypeToPurchaseCategory(productType) || ''
    const vendor = item.preferredVendorId
      ? vendors.find((v) => v.id === item.preferredVendorId)
      : undefined
    patchLine(key, {
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      productType,
      category,
      uomId: item.uomId,
      uom: item.uom,
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      estimatedRate: item.standardRate,
      quantity: Number(line.quantity) > 0 ? line.quantity : 1,
      itemType: category === 'job_work' || productType === 'service' ? 'service' : 'inventory',
      preferredVendorId: vendor?.id ?? null,
      preferredVendorName: vendor?.vendorName ?? null,
      vendorNumber: vendor?.vendorCode ?? '',
      currentStock: Math.max(0, Math.round(item.reorderLevel * 1.4)),
      openPoQty: Math.max(0, Math.round(item.reorderLevel * 0.3)),
    })
  }

  const importCsvText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((r) => r.trim())
      .filter(Boolean)
      .slice(1)
    if (!rows.length) {
      notify.info('No data rows found in file')
      return
    }
    const imported: PrEditorLine[] = rows.map((row, index) => {
      const [code, name, qty, uom, rate] = row.split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
      const quantity = Number(qty) || 1
      const estimatedRate = Number(rate) || 0
      const matched = catalogItems.find((i) => i.itemCode === code)
      return emptyLine({
        lineNo: index + 1,
        itemId: matched?.id ?? '',
        itemCode: code || matched?.itemCode || '',
        itemName: name || matched?.itemName || code || 'Imported item',
        uomId: matched?.uomId ?? null,
        uom: uom || matched?.uom || 'NOS',
        quantity,
        estimatedRate: estimatedRate || matched?.standardRate || 0,
        hsnCode: matched?.hsnCode ?? '',
        category: matched?.category ?? mapEngineeringProductTypeToPurchaseCategory(matched?.productType) ?? '',
        productType: matched?.productType ?? '',
        locationId: header.locationId,
        locationName: header.locationName,
      })
    })
    setLinesDirty([...(lines.filter((l) => l.itemName || l.itemCode)), ...imported])
    notify.success(`Imported ${imported.length} line(s)`)
  }

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="Purchase Requisition"
        description="Loading…"
        status="Draft"
        favoritePath="/purchase/requisitions/new"
        breadcrumbs={[
          { label: 'Purchase', to: '/purchase' },
          { label: 'Requisitions', to: '/purchase/requisitions' },
          { label: 'Loading' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={8} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title={isNew ? 'New Purchase Requisition' : `Edit ${documentNumber ?? 'Purchase Requisition'}`}
      description="Manual purchase requisition — demand capture before RFQ / PO"
      recordNo={documentNumber ?? (isNew ? 'New' : undefined)}
      recordTitle={documentTitle}
      status={purchaseRequisitionApprovalStatusLabel(status)}
      statusTone={purchaseStatusTone(status)}
      statusKey={status}
      recordHeaderFacts={recordHeaderFacts}
      favoritePath={recordId ? `/purchase/requisitions/${recordId}/edit` : '/purchase/requisitions/new'}
      breadcrumbs={[
        { label: 'Requisitions', to: '/purchase/requisitions' },
        { label: isNew ? 'New' : documentNumber ?? 'Edit' },
      ]}
      createdBy={createdMeta.by || undefined}
      createdDate={createdMeta.at ? formatDate(createdMeta.at.slice(0, 10)) : undefined}
      modifiedBy={updatedMeta.by || undefined}
      modifiedDate={updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : undefined}
      validationErrors={showErrors ? validation.errors : []}
      validationItems={[
        ...(showErrors
          ? validation.errors.map((message, i) => {
              const looksLikeLine =
                /line/i.test(message) ||
                /quantity/i.test(message) ||
                /description/i.test(message) ||
                /unit/i.test(message) ||
                /At least one line/i.test(message)
              const sectionLabel = looksLikeLine ? 'Item Details' : 'Requisition Header'
              return {
                id: `pr-err-${i}`,
                label: `${sectionLabel} · ${message}`,
                message: 'Required',
                onClick: () => focusValidationItem(message),
              }
            })
          : []),
        ...validation.warnings.map((message, i) => ({
          id: `pr-warn-${i}`,
          label: message,
          message: 'Warning',
        })),
      ]}
      commandBar={null}
      factBox={
        <PurchaseEnterpriseFactBox
          title="PR insight"
          metrics={formMetrics}
          summary={[
            { label: 'PR No.', value: documentNumber ?? (isNew ? 'Loading…' : '—') },
            { label: 'Status', value: purchaseRequisitionApprovalStatusLabel(status) },
            {
              label: 'Department',
              value: header.department ? prDepartmentLabel(header.department) : '—',
              highlight: Boolean(header.department),
            },
            {
              label: 'Priority',
              value: PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
              highlight: header.priority === 'urgent',
            },
            {
              label: 'Process path',
              value: header.rfqRequired ? 'RFQ Purchase Path' : 'Direct Purchase Planning Path',
              highlight: !header.rfqRequired,
            },
            {
              label: 'Est. Total',
              value: formatCurrency(summary.estimatedTotal),
              highlight: true,
            },
            ...(dirty
              ? [{ label: 'Changes', value: 'Unsaved', highlight: true as const }]
              : []),
          ]}
        >
          <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-erp-muted">
            <li>PR Number is reserved from the series and confirmed on save.</li>
            <li>Urgent PRs require Purpose before submit.</li>
          </ul>
          {dirty ? (
            <div className="mt-2">
              <Badge color="orange">Unsaved changes</Badge>
            </div>
          ) : null}
        </PurchaseEnterpriseFactBox>
      }
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={saving}
          dirty={dirty}
          disabled={!editable}
          disabledReason={!editable ? 'Document is read-only' : undefined}
          onCancel={() => {
            resetDirty()
            navigate(PURCHASE_FORM_ROUTES.requisition.list)
          }}
          onSave={saveDraft}
        />
      }
      onSaveShortcut={() => void saveDraft()}
    >
      <div className="space-y-3">
          <PurchaseRequisitionPathBanner rfqRequired={header.rfqRequired} />

          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (!file) return
              void file.text().then(importCsvText)
              e.target.value = ''
            }}
          />

          <ErpCardSection
            id={purchaseSectionId('general')}
            title="Requisition Header"
            subtitle="PR identity, warehouse, priority, and RFQ path"
            collapsedSummary={quickEntrySummaryText || undefined}
            icon={FileText}
            accent="blue"
            collapsible
            defaultOpen
            dense
            columns={3}
          >
            <ErpFieldRow
              label="PR Number"
              readOnly
              horizontal={false}
              hint={isNew ? 'Preview from number series — assigned when you save' : undefined}
            >
              <Input
                value={documentNumber ?? ''}
                placeholder="Loading number…"
                readOnly
                className="bg-erp-surface-alt"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Requisition Date" required horizontal={false}>
              <Input
                type="date"
                value={header.documentDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ documentDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Department"
              required
              horizontal={false}
              fieldError={showErrors ? validation.fieldErrors.department : undefined}
              fieldState={showErrors && validation.fieldErrors.department ? 'error' : 'idle'}
            >
              <Select
                value={header.department}
                disabled={!editable}
                onChange={(e) => patchHeader({ department: e.target.value })}
              >
                <option value="">Select department</option>
                {PR_DEPARTMENT_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Requested By" readOnly horizontal={false}>
              <Input value={header.requesterName} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow
              label="Required By Date"
              horizontal={false}
              fieldError={showErrors ? validation.fieldErrors.expectedDeliveryDate : undefined}
              fieldState={
                showErrors && validation.fieldErrors.expectedDeliveryDate ? 'error' : 'idle'
              }
            >
              <Input
                type="date"
                value={header.expectedDeliveryDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ expectedDeliveryDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Warehouse"
              required
              horizontal={false}
              fieldError={showErrors ? validation.fieldErrors.locationId : undefined}
              fieldState={showErrors && validation.fieldErrors.locationId ? 'error' : 'idle'}
            >
              <Select
                value={header.locationId}
                disabled={!editable}
                onChange={(e) => {
                  const loc = locationOptions.find((l) => l.id === e.target.value)
                  if (!loc) return
                  patchHeader({
                    locationId: loc.id,
                    locationCode: loc.code,
                    locationName: loc.name,
                    locationState: loc.state,
                    locationCity: loc.city,
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
            <ErpFieldRow label="Priority" horizontal={false}>
              <Select
                value={header.priority}
                disabled={!editable}
                onChange={(e) =>
                  patchHeader({ priority: e.target.value as PrEditorHeader['priority'] })
                }
              >
                {Object.entries(PURCHASE_REQUISITION_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow
              label="RFQ Required?"
              required
              horizontal={false}
              hint={
                header.rfqRequired
                  ? 'RFQ is required to create PO'
                  : 'Create Direct PO'
              }
            >
              <Select
                value={header.rfqRequired ? 'yes' : 'no'}
                disabled={!editable}
                onChange={(e) => patchHeader({ rfqRequired: e.target.value === 'yes' })}
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </Select>
            </ErpFieldRow>
            <ErpFieldRow
              label="Purchase Purpose"
              required={header.priority === 'urgent'}
              horizontal={false}
              fieldError={showErrors ? validation.fieldErrors.purpose : undefined}
              fieldState={showErrors && validation.fieldErrors.purpose ? 'error' : 'idle'}
            >
              <Input
                value={header.purpose}
                disabled={!editable}
                onChange={(e) => patchHeader({ purpose: e.target.value })}
                placeholder={
                  header.priority === 'urgent' ? 'Required for urgent PRs' : 'Brief justification'
                }
              />
            </ErpFieldRow>
            <ErpFieldRow label="Remarks" horizontal={false} colSpan={3}>
              <Textarea
                value={header.remarks}
                disabled={!editable}
                onChange={(e) => patchHeader({ remarks: e.target.value })}
                rows={2}
              />
            </ErpFieldRow>
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('lines')}
            title="Item Details"
            subtitle="Item code, name, qty, rate, vendor, warehouse, BIN, and need-by date"
            icon={Package}
            accent="blue"
            collapsible
            defaultOpen
            dense
            columns={1}
            badge={
              <span className="text-[11px] tabular-nums text-erp-muted">
                {lines.length} line{lines.length === 1 ? '' : 's'}
              </span>
            }
          >
            <PurchaseRequisitionLinesTable
              lines={lines}
              catalogItems={catalogItemsForPicker}
              vendors={vendors}
              editable={editable}
              reqNo={documentNumber}
              showErrors={showErrors}
              lineErrors={validation.lineErrors}
              formatCurrency={formatCurrency}
              estimatedTotal={summary.estimatedTotal}
              onAddLine={() =>
                setLinesDirty([
                  ...lines,
                  emptyLine({
                    locationId: header.locationId,
                    locationName: header.locationName,
                  }),
                ])
              }
              onCopyLastLine={() => {
                const selected = lines[lines.length - 1]
                if (!selected) return
                setLinesDirty([
                  ...lines,
                  emptyLine({
                    ...selected,
                    key: crypto.randomUUID(),
                    id: '',
                    purchaseOrderId: null,
                    purchaseOrderNumber: '',
                    purchaseQuoteNumber: '',
                  }),
                ])
              }}
              onImportExcel={() => fileInputRef.current?.click()}
              onClearLines={() =>
                setLinesDirty(
                  threeEmptyLines({
                    locationId: header.locationId,
                    locationName: header.locationName,
                  }),
                )
              }
              onPatchLine={patchLine}
              onRemoveLine={(key) => {
                void (async () => {
                  const line = lines.find((l) => l.key === key)
                  const hasContent = Boolean(
                    line &&
                      (line.itemId ||
                        line.itemCode.trim() ||
                        line.itemName.trim() ||
                        Number(line.quantity) > 0),
                  )
                  if (hasContent) {
                    const ok = await systemConfirm({
                      title: 'Delete item line?',
                      description: 'This line has entered data and will be removed.',
                      confirmLabel: 'Delete',
                      cancelLabel: 'Keep',
                      variant: 'danger',
                    })
                    if (!ok) return
                  }
                  const next = lines.filter((l) => l.key !== key)
                  if (next.length === 0) {
                    setLinesDirty(
                      [
                        emptyLine({
                          locationId: header.locationId,
                          locationName: header.locationName,
                        }),
                      ].map((l, i) => ({ ...l, lineNo: i + 1 })),
                    )
                    return
                  }
                  setLinesDirty(next)
                })()
              }}
              onSelectCatalogItem={applyItemCatalog}
            />
            {showErrors &&
            validation.errors.some(
              (e) =>
                e.includes('line') ||
                e.includes('Line') ||
                e.includes('Quantity') ||
                e.includes('description') ||
                e.includes('Unit') ||
                e.includes('Product type'),
            ) ? (
              <p className="mt-2 text-[12px] text-erp-danger-fg">Fix line errors before submit.</p>
            ) : null}
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('finance')}
            title="Commercial Information"
            subtitle="Provisional totals from estimated line amounts"
            collapsedSummary={financeSummaryText || undefined}
            icon={Banknote}
            accent="blue"
            collapsible
            defaultOpen={financeDefaultOpen}
            dense
          >
            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Estimate</p>
            </ErpFormSpan>
            <ErpFieldRow label="Lines" readOnly>
              <Input value={String(summary.totalLines)} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Total Qty" readOnly>
              <Input value={String(summary.totalQuantity)} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="Est. Subtotal" readOnly>
              <Input
                value={formatCurrency(summary.estimatedSubtotal)}
                readOnly
                className="bg-erp-surface-alt"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Est. Taxes (18%)" readOnly>
              <Input
                value={formatCurrency(summary.estimatedTaxes)}
                readOnly
                className="bg-erp-surface-alt"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Est. Total" readOnly>
              <Input
                value={formatCurrency(summary.estimatedTotal)}
                readOnly
                className="bg-erp-primary-soft font-semibold text-erp-primary"
              />
            </ErpFieldRow>
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('attachments')}
            title="Attachments"
            subtitle="Supporting files for this requisition (demo stub upload)"
            collapsedSummary={attachmentsSummaryText || undefined}
            icon={Paperclip}
            accent="blue"
            collapsible
            defaultOpen={false}
            dense
            columns={1}
          >
            <PurchaseDocumentAttachments
              files={prPlaceholdersToRows(attachments, header.requesterName || createdMeta.by || 'User')}
              disabled={!editable}
              uploadedBy={header.requesterName || createdMeta.by || 'User'}
              hint="Technical specs, drawings, requirement docs, and supporting files"
              onChange={(next) => {
                setAttachments(rowsToPrPlaceholders(next, attachments))
                markDirty()
              }}
            />
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('costing')}
            title="Status"
            subtitle="Approval-stage status for this requisition"
            collapsedSummary={additionalSummaryText || undefined}
            icon={Layers}
            accent="blue"
            collapsible
            defaultOpen={additionalDefaultOpen}
            forceOpenKey={forceOpenAdditionalKey || undefined}
            dense
          >
            <ErpViewField
              label="Status"
              value={purchaseRequisitionApprovalStatusLabel(status)}
            />
            <ErpViewField
              label="Current approver"
              value={status === 'pending_approval' ? 'Sneha Kulkarni (Purchase Head)' : '—'}
            />
            <ErpViewField label="Created by" value={createdMeta.by || '—'} />
            <ErpViewField
              label="Created date"
              value={createdMeta.at ? formatDate(createdMeta.at.slice(0, 10)) : '—'}
            />
            <ErpViewField label="Last modified by" value={updatedMeta.by || '—'} />
            <ErpViewField
              label="Last modified date"
              value={updatedMeta.at ? formatDate(updatedMeta.at.slice(0, 10)) : '—'}
            />
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('timeline')}
            title="Timeline"
            subtitle="Approval and activity history"
            collapsedSummary={approvalSummaryText || undefined}
            icon={ClipboardList}
            accent="blue"
            collapsible
            defaultOpen={history.length > 0}
            dense
            columns={1}
          >
            {history.length === 0 ? (
              <p className="text-[12px] text-erp-muted">No approval activity yet.</p>
            ) : (
              <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
                {history.map((h) => (
                  <li key={h.id} className="flex justify-between gap-3 px-3 py-2 text-[12px]">
                    <span>
                      <span className="font-medium capitalize text-erp-text">
                        {h.action.replace(/_/g, ' ')}
                      </span>
                      <span className="text-erp-muted"> · {h.actorName}</span>
                      {h.remarks ? (
                        <span className="block text-erp-muted">{h.remarks}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 tabular-nums text-erp-muted">
                      {formatDate(h.actedAt.slice(0, 10))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </ErpCardSection>
      </div>
    </PurchaseCardFormShell>
  )
}
