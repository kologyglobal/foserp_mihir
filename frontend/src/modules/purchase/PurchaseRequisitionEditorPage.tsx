import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Eye,
  FileSpreadsheet,
  Layers,
  Package,
  Paperclip,
  Plus,
  Printer,
  Save,
  Send,
  Trash2,
  Zap,
} from 'lucide-react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseEnterpriseFactBox,
  purchaseSectionId,
  scrollToPurchaseSection,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import {
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseRequisitionWorkspaceTabs,
  derivePrWorkspaceTabs,
  prSectionToWorkspace,
  prWorkspaceHasValidationErrors,
  type PrEditorWorkspace,
} from '@/components/purchase/PurchaseRequisitionWorkspaceTabs'
import { PurchaseRequisitionLinesTable } from '@/components/purchase/PurchaseRequisitionLinesTable'
import {
  PurchaseDocumentAttachments,
  type PurchaseDocumentAttachmentRow,
} from '@/components/purchase/PurchaseDocumentAttachments'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpFormSpan,
  ErpQuickEntrySection,
  ErpStickySaveBar,
  ErpViewField,
} from '@/components/erp/card-form'
import { EnterpriseFormMetrics } from '@/design-system/workspace'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { ErpButton } from '@/components/erp/ErpButton'
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
  deletePurchaseRequisition,
  getApprovalHistory,
  getPurchaseItems,
  getPurchaseRequisitionById,
  getVendors,
  PurchaseServiceError,
  submitPurchaseRequisition,
  updatePurchaseRequisition,
  PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS,
  PURCHASE_REQUISITION_PRIORITY_LABELS,
  PURCHASE_REQUISITION_SOURCE_LABELS,
  PURCHASE_REQUISITION_STATUS_LABELS,
  PURCHASE_REQUISITION_TYPE_LABELS,
} from '@/services/purchase'
import type {
  ApprovalHistory,
  PurchaseItem,
  PurchaseRequisition,
  PurchaseRequisitionAttachmentKind,
  PurchaseRequisitionAttachmentPlaceholder,
  Vendor,
} from '@/types/purchaseDomain'
import { PURCHASE_DEMO_LOCATION } from '@/data/purchase/purchaseDomainSeed'
import {
  summarizePrLines,
  validatePurchaseRequisitionForm,
  type PrEditorHeader,
  type PrEditorLine,
} from '@/utils/purchaseRequisitionValidation'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { systemConfirm } from '@/utils/systemConfirm'
import { usePurchasePermissions } from '@/utils/permissions'

const ACTOR = { id: 'user-buyer-01', code: 'BUY01', name: 'Rahul Patil' }

function prPlaceholdersToRows(
  list: PurchaseRequisitionAttachmentPlaceholder[],
): PurchaseDocumentAttachmentRow[] {
  return list.map((a) => ({
    id: a.id,
    fileName: a.fileName.trim() || a.id,
    type: PURCHASE_REQUISITION_ATTACHMENT_KIND_LABELS[a.kind],
    uploadedBy: ACTOR.name,
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
    category: 'consumable',
    uom: 'NOS',
    hsnCode: '',
    sacCode: null,
    quantity: 1,
    estimatedRate: 0,
    amount: 0,
    currentStock: 0,
    openPoQty: 0,
    preferredVendorId: null,
    preferredVendorName: null,
    requiredDate: today(),
    locationId: PURCHASE_DEMO_LOCATION.id,
    locationName: PURCHASE_DEMO_LOCATION.name,
    purpose: '',
    remarks: '',
    attachmentNote: '',
    ...partial,
  }
}

function defaultHeader(): PrEditorHeader {
  return {
    documentDate: today(),
    department: '',
    locationId: PURCHASE_DEMO_LOCATION.id,
    locationCode: PURCHASE_DEMO_LOCATION.code,
    locationName: PURCHASE_DEMO_LOCATION.name,
    locationState: PURCHASE_DEMO_LOCATION.state,
    locationCity: PURCHASE_DEMO_LOCATION.city,
    requesterId: ACTOR.id,
    requesterCode: ACTOR.code,
    requesterName: ACTOR.name,
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
    rfqRequired: true,
  }
}

function headerFromPr(pr: PurchaseRequisition): PrEditorHeader {
  return {
    documentDate: pr.documentDate,
    department: pr.department,
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
  return pr.lines.map((l) => ({ ...l, key: l.id || crypto.randomUUID() }))
}

const LOCATION_OPTIONS = [
  { ...PURCHASE_DEMO_LOCATION },
  {
    id: 'loc-chakan-fg',
    code: 'CHAKAN-FG',
    name: 'Chakan FG Yard',
    state: 'Maharashtra',
    city: 'Pune',
  },
]

export function PurchaseRequisitionEditorPage() {
  const perms = usePurchasePermissions()
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const [loading, setLoading] = useState(!isNew)
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
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [workspace, setWorkspace] = useState<PrEditorWorkspace>('requisition')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const [forceOpenAdditionalKey, setForceOpenAdditionalKey] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editable = status === 'draft' || status === 'rejected'
  const { dirty, markDirty, resetDirty } = useUnsavedChangesGuard(editable)

  const validation = useMemo(
    () => validatePurchaseRequisitionForm(header, lines),
    [header, lines],
  )
  const showErrors = attemptedSubmit
  const workspaceTabs = useMemo(
    () =>
      derivePrWorkspaceTabs({
        submitValidation: validation,
        attemptedValidation: showErrors ? validation : null,
        dirty,
      }),
    [validation, showErrors, dirty],
  )
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
    header.source === 'work_order' ||
    header.source === 'maintenance' ||
    Boolean(header.costCentre.trim()) ||
    Boolean(header.project.trim()) ||
    Boolean(header.productionOrderNo.trim()) ||
    Boolean(header.maintenanceOrderNo.trim()) ||
    Boolean(header.referenceNumber.trim()) ||
    Boolean(header.remarks.trim())
  const additionalSummaryText = useMemo(
    () =>
      joinFastTabSummary([
        PURCHASE_REQUISITION_SOURCE_LABELS[header.source],
        header.costCentre.trim() || false,
        header.project.trim() || false,
        header.productionOrderNo.trim()
          ? `Prod ${header.productionOrderNo.trim()}`
          : false,
        header.maintenanceOrderNo.trim()
          ? `Maint ${header.maintenanceOrderNo.trim()}`
          : false,
        header.referenceNumber.trim() ? `Ref ${header.referenceNumber.trim()}` : false,
        header.remarks.trim() ? 'Remarks set' : false,
        approvalSummaryText || false,
      ]),
    [
      header.source,
      header.costCentre,
      header.project,
      header.productionOrderNo,
      header.maintenanceOrderNo,
      header.referenceNumber,
      header.remarks,
      approvalSummaryText,
    ],
  )
  const quickEntrySummaryText = useMemo(
    () =>
      joinFastTabSummary([
        header.department.trim() || false,
        PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
        PURCHASE_REQUISITION_TYPE_LABELS[header.requisitionType],
        header.rfqRequired ? 'RFQ after approval' : 'PO after approval',
        header.locationName || false,
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
  const departmentFact = header.department || 'Not selected'

  const recordHeaderFacts = useMemo(
    () => [
      ...(isNew
        ? [{ label: 'PR No', value: documentNumber ?? 'Auto-generated' }]
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
    void Promise.all([getPurchaseItems(), getVendors()]).then(([items, v]) => {
      setCatalogItems(items)
      setVendors(v)
    })
  }, [])

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
    return {
      documentDate: header.documentDate,
      department: header.department,
      location,
      requester: {
        id: header.requesterId,
        code: header.requesterCode,
        name: header.requesterName,
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
        .filter((l) => l.itemName.trim() || l.itemCode.trim() || l.itemId)
        .map(({ key: _key, ...rest }) => rest),
    }
  }, [attachments, header, lines, summary.estimatedTaxPct])

  const saveDraft = async (andStay = true) => {
    if (!editable) return
    setSaving(true)
    try {
      if (recordId) {
        const updated = await updatePurchaseRequisition(recordId, toInput())
        setDocumentNumber(updated.documentNumber)
        setStatus(updated.status)
        setUpdatedMeta({ by: updated.updatedBy ?? '', at: updated.updatedAt ?? '' })
        notify.success(`Draft saved · ${updated.documentNumber}`)
        setLastSavedAt(new Date())
      } else {
        const created = await createPurchaseRequisition(toInput())
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
        setStatus(created.status)
        setCreatedMeta({ by: created.createdBy, at: created.createdAt })
        notify.success(`Draft created · ${created.documentNumber}`)
        setLastSavedAt(new Date())
        resetDirty()
        navigate(`/purchase/requisitions/${created.id}/edit`, { replace: true })
        return
      }
      resetDirty()
      if (!andStay && recordId) navigate(`/purchase/requisitions/${recordId}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const focusValidationSection = useCallback(
    (section: 'general' | 'lines') => {
      const target = prSectionToWorkspace(section)
      setWorkspace(target)
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
      const inRequisition = prWorkspaceHasValidationErrors('requisition', validation)
      const inLineItems = prWorkspaceHasValidationErrors('line_items', validation)
      const looksLikeLine =
        /line/i.test(message) ||
        /quantity/i.test(message) ||
        /description/i.test(message) ||
        /unit/i.test(message)
      const target: PrEditorWorkspace =
        looksLikeLine && inLineItems
          ? 'line_items'
          : inRequisition
            ? 'requisition'
            : inLineItems
              ? 'line_items'
              : 'requisition'
      setWorkspace(target)
      const needsAdditional =
        target === 'requisition' &&
        (Boolean(validation.fieldErrors.productionOrderNo) ||
          Boolean(validation.fieldErrors.maintenanceOrderNo))
      if (needsAdditional) {
        setForceOpenAdditionalKey((k) => k + 1)
      }
      window.requestAnimationFrame(() => {
        scrollToPurchaseSection(
          target === 'line_items' ? 'lines' : needsAdditional ? 'costing' : 'general',
        )
      })
    },
    [validation],
  )

  const submitForApproval = async () => {
    setAttemptedSubmit(true)
    if (validation.errors.length) {
      const section =
        validation.fieldErrors.department ||
        validation.fieldErrors.locationId ||
        validation.fieldErrors.purpose ||
        validation.fieldErrors.productionOrderNo ||
        validation.fieldErrors.maintenanceOrderNo ||
        validation.fieldErrors.expectedDeliveryDate
          ? 'general'
          : validation.errors.some((e) => /line|quantity|description|unit/i.test(e))
            ? 'lines'
            : 'general'
      focusValidationSection(section)
      return
    }
    setSaving(true)
    try {
      let prId = recordId
      if (!prId) {
        const created = await createPurchaseRequisition(toInput())
        prId = created.id
        setRecordId(created.id)
        setDocumentNumber(created.documentNumber)
      } else {
        await updatePurchaseRequisition(prId, toInput())
      }
      const submitted = await submitPurchaseRequisition(prId)
      setStatus(submitted.status)
      resetDirty()
      notify.success(`${submitted.documentNumber} submitted for approval`)
      navigate(`/purchase/requisitions/${prId}`)
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Submit failed')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!recordId) {
      navigate('/purchase/requisitions')
      return
    }
    if (!(await systemConfirm({
      title: 'Delete draft requisition?',
      description: 'This draft will be permanently removed.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'danger',
    }))) return
    try {
      await deletePurchaseRequisition(recordId)
      resetDirty()
      notify.success('Requisition deleted')
      navigate('/purchase/requisitions')
    } catch (err) {
      notify.error(err instanceof PurchaseServiceError ? err.message : 'Delete failed')
    }
  }

  const applyItemCatalog = (key: string, itemId: string) => {
    const item = catalogItems.find((i) => i.id === itemId)
    if (!item) return
    const vendor = item.preferredVendorId
      ? vendors.find((v) => v.id === item.preferredVendorId)
      : undefined
    patchLine(key, {
      itemId: item.id,
      itemCode: item.itemCode,
      itemName: item.itemName,
      category: item.category,
      uom: item.uom,
      hsnCode: item.hsnCode,
      sacCode: item.sacCode,
      estimatedRate: item.standardRate,
      itemType: item.category === 'job_work' ? 'service' : 'inventory',
      preferredVendorId: vendor?.id ?? null,
      preferredVendorName: vendor?.vendorName ?? null,
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
        uom: uom || matched?.uom || 'NOS',
        quantity,
        estimatedRate: estimatedRate || matched?.standardRate || 0,
        hsnCode: matched?.hsnCode ?? '',
        category: matched?.category ?? 'consumable',
      })
    })
    setLinesDirty([...(lines.filter((l) => l.itemName || l.itemCode) ), ...imported])
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
      status={PURCHASE_REQUISITION_STATUS_LABELS[status]}
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
              const workspaceLabel = looksLikeLine ? 'Line Items' : 'Requisition'
              return {
                id: `pr-err-${i}`,
                label: `${workspaceLabel} · ${message}`,
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
      commandBar={
        <div className="relative flex flex-wrap items-center gap-2">
          <ErpCommandBar
            inline
            sticky={false}
            secondaryActions={[
              {
                id: 'back',
                label: 'Back',
                icon: ArrowLeft,
                onClick: () => navigate('/purchase/requisitions'),
              },
              {
                id: 'draft',
                label: saving ? 'Saving…' : 'Save Draft',
                icon: Save,
                onClick: () => void saveDraft(true),
                disabled: !editable || saving,
                disabledReason: editable ? undefined : 'Document is read-only',
                pin: true,
              },
              {
                id: 'print',
                label: 'Print',
                icon: Printer,
                onClick: () => window.print(),
              },
            ]}
            moreActions={[
              {
                id: 'add-line',
                label: 'Add blank line',
                icon: Plus,
                onClick: () => setLinesDirty([...lines, emptyLine()]),
                disabled: !editable,
              },
              {
                id: 'import',
                label: 'Import from Excel / CSV',
                icon: FileSpreadsheet,
                onClick: () => fileInputRef.current?.click(),
                disabled: !editable,
              },
              {
                id: 'view-doc',
                label: 'View document',
                icon: Eye,
                onClick: () => {
                  if (recordId) navigate(`/purchase/requisitions/${recordId}`)
                },
                disabled: !recordId,
                disabledReason: 'Save the requisition first',
              },
            ]}
            destructiveActions={[
              {
                id: 'delete',
                label: 'Delete',
                icon: Trash2,
                onClick: () => void onDelete(),
                disabled: !editable || saving,
              },
            ]}
            primaryAction={
              perms.canSubmitRequisition
                ? {
                    id: 'submit',
                    label: 'Submit for Approval',
                    icon: Send,
                    onClick: () => void submitForApproval(),
                    disabled: !editable || saving || (attemptedSubmit && validation.errors.length > 0),
                    disabledReason:
                      attemptedSubmit && validation.errors.length
                        ? 'Fix validation errors first'
                        : !editable
                          ? 'Document is read-only'
                          : undefined,
                  }
                : undefined
            }
          />
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
        </div>
      }
      factBox={
        <PurchaseEnterpriseFactBox
          title="PR insight"
          metrics={formMetrics}
          summary={[
            { label: 'PR No.', value: documentNumber ?? 'Auto on save' },
            { label: 'Status', value: PURCHASE_REQUISITION_STATUS_LABELS[status] },
            {
              label: 'Department',
              value: header.department || '—',
              highlight: Boolean(header.department),
            },
            {
              label: 'Priority',
              value: PURCHASE_REQUISITION_PRIORITY_LABELS[header.priority],
              highlight: header.priority === 'urgent',
            },
            {
              label: 'After approval',
              value: header.rfqRequired ? 'Create RFQ' : 'Create Purchase Order',
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
          actions={[
            {
              id: 'draft',
              label: saving ? 'Saving…' : 'Save Draft',
              icon: Save,
              onClick: () => void saveDraft(true),
              disabled: !editable || saving,
            },
            ...(perms.canSubmitRequisition
              ? [
                  {
                    id: 'submit',
                    label: 'Submit for Approval',
                    icon: Send,
                    primary: true as const,
                    onClick: () => void submitForApproval(),
                    disabled: !editable || saving,
                  },
                ]
              : []),
          ]}
        >
          <ul className="mt-3 list-disc space-y-1 pl-4 text-[11px] text-erp-muted">
            <li>PR Number is auto-generated on first save.</li>
            <li>Urgent PRs require Purpose before submit.</li>
            <li>Production / Maintenance sources need linked order numbers.</li>
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
        <ErpStickySaveBar
          sticky
          hint={
            <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
              {dirty ? (
                <span className="font-medium text-erp-warning-fg">Unsaved changes</span>
              ) : (
                <span className="text-erp-muted">All changes saved</span>
              )}
              {lastSavedAt ? (
                <span className="text-erp-muted">
                  Last saved{' '}
                  {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              ) : null}
            </span>
          }
          onSaveDraft={() => void saveDraft(true)}
          saveDraftLabel={saving ? 'Saving…' : 'Save Draft'}
          onSave={() => void submitForApproval()}
          submitLabel="Submit for Approval"
          isSubmitting={saving}
          submitDisabled={!editable || saving || (attemptedSubmit && validation.errors.length > 0)}
          submitDisabledReason={
            !editable
              ? 'Document is read-only'
              : attemptedSubmit && validation.errors.length
                ? 'Fix validation errors first'
                : undefined
          }
          cancelLabel="Back"
          onCancel={() => navigate('/purchase/requisitions')}
        />
      }
      onSaveShortcut={() => void saveDraft(true)}
    >
      <EnterpriseFormMetrics metrics={formMetrics} />

      <PurchaseRequisitionWorkspaceTabs
        active={workspace}
        onChange={setWorkspace}
        tabs={workspaceTabs}
      />

      {workspace === 'requisition' ? (
        <div
          id="pr-workspace-panel-requisition"
          role="tabpanel"
          aria-labelledby="pr-workspace-tab-requisition"
          className="space-y-3"
        >
          <ErpQuickEntrySection
            id={purchaseSectionId('general')}
            title="Quick Entry"
            subtitle="Essentials to start this requisition — date, requester, classification, location, need-by"
            icon={Zap}
            collapsible
            defaultOpen
            columns={3}
          >
            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Document</p>
            </ErpFormSpan>
            <ErpFieldRow label="PR Number" readOnly>
              <Input value={documentNumber ?? 'Auto-generated'} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>
            <ErpFieldRow label="PR Date" required>
              <Input
                type="date"
                value={header.documentDate}
                disabled={!editable}
                onChange={(e) => patchHeader({ documentDate: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Requested By" readOnly>
              <Input value={header.requesterName} readOnly className="bg-erp-surface-alt" />
            </ErpFieldRow>

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Request details</p>
            </ErpFormSpan>
            <ErpFieldRow
              label="Department"
              required
              fieldError={showErrors ? validation.fieldErrors.department : undefined}
              fieldState={showErrors && validation.fieldErrors.department ? 'error' : 'idle'}
            >
              <Select
                value={header.department}
                disabled={!editable}
                onChange={(e) => patchHeader({ department: e.target.value })}
              >
                <option value="">Select department</option>
                {['Production Planning', 'Stores', 'Maintenance', 'Dispatch', 'Purchase', 'Quality'].map(
                  (d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ),
                )}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Priority">
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
            <ErpFieldRow label="Requisition Type">
              <Select
                value={header.requisitionType}
                disabled={!editable}
                onChange={(e) =>
                  patchHeader({
                    requisitionType: e.target.value as PrEditorHeader['requisitionType'],
                  })
                }
              >
                {Object.entries(PURCHASE_REQUISITION_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow
              label="RFQ required?"
              required
              hint={
                header.rfqRequired
                  ? 'After approval, create an RFQ and collect vendor quotations.'
                  : 'After approval, this PR is ready for a Purchase Order (skip RFQ).'
              }
            >
              <Select
                value={header.rfqRequired ? 'yes' : 'no'}
                disabled={!editable}
                onChange={(e) => patchHeader({ rfqRequired: e.target.value === 'yes' })}
              >
                <option value="yes">Yes — create RFQ after approval</option>
                <option value="no">No — ready for Purchase Order after approval</option>
              </Select>
            </ErpFieldRow>

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Location &amp; need-by</p>
            </ErpFormSpan>
            <ErpFieldRow
              label="Location"
              required
              fieldError={showErrors ? validation.fieldErrors.locationId : undefined}
              fieldState={showErrors && validation.fieldErrors.locationId ? 'error' : 'idle'}
            >
              <Select
                value={header.locationId}
                disabled={!editable}
                onChange={(e) => {
                  const loc = LOCATION_OPTIONS.find((l) => l.id === e.target.value)
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
                {LOCATION_OPTIONS.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow
              label="Required By Date"
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
              label="Purpose"
              required={header.priority === 'urgent'}
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
          </ErpQuickEntrySection>

          <ErpCardSection
            id={purchaseSectionId('costing')}
            title="Additional Information"
            subtitle="Source links, costing, remarks, and approval activity"
            collapsedSummary={additionalSummaryText || quickEntrySummaryText || undefined}
            icon={Layers}
            accent="slate"
            collapsible
            defaultOpen={additionalDefaultOpen}
            forceOpenKey={forceOpenAdditionalKey || undefined}
            dense
          >
            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Source &amp; costing</p>
            </ErpFormSpan>
            <ErpFieldRow label="Requisition Source">
              <Select
                value={header.source}
                disabled={!editable}
                onChange={(e) =>
                  patchHeader({ source: e.target.value as PrEditorHeader['source'] })
                }
              >
                {Object.entries(PURCHASE_REQUISITION_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </ErpFieldRow>
            <ErpFieldRow label="Cost Centre">
              <Input
                value={header.costCentre}
                disabled={!editable}
                onChange={(e) => patchHeader({ costCentre: e.target.value })}
                placeholder="e.g. CC-PROD-01"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Project">
              <Input
                value={header.project}
                disabled={!editable}
                onChange={(e) => patchHeader({ project: e.target.value })}
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Production Order"
              required={header.source === 'work_order'}
              fieldError={showErrors ? validation.fieldErrors.productionOrderNo : undefined}
              fieldState={
                showErrors && validation.fieldErrors.productionOrderNo ? 'error' : 'idle'
              }
            >
              <Input
                value={header.productionOrderNo}
                disabled={!editable}
                onChange={(e) => patchHeader({ productionOrderNo: e.target.value })}
                placeholder="WO / Production order no."
              />
            </ErpFieldRow>
            <ErpFieldRow
              label="Maintenance Order"
              required={header.source === 'maintenance'}
              fieldError={showErrors ? validation.fieldErrors.maintenanceOrderNo : undefined}
              fieldState={
                showErrors && validation.fieldErrors.maintenanceOrderNo ? 'error' : 'idle'
              }
            >
              <Input
                value={header.maintenanceOrderNo}
                disabled={!editable}
                onChange={(e) => patchHeader({ maintenanceOrderNo: e.target.value })}
                placeholder="MO number"
              />
            </ErpFieldRow>
            <ErpFieldRow label="Reference Number">
              <Input
                value={header.referenceNumber}
                disabled={!editable}
                onChange={(e) => patchHeader({ referenceNumber: e.target.value })}
              />
            </ErpFieldRow>

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Remarks</p>
            </ErpFormSpan>
            <ErpFieldRow label="Remarks" colSpan={3}>
              <Textarea
                value={header.remarks}
                disabled={!editable}
                onChange={(e) => patchHeader({ remarks: e.target.value })}
                rows={2}
              />
            </ErpFieldRow>

            <ErpFormSpan span={3}>
              <p className="erp-field-group__label">Approval and activity</p>
            </ErpFormSpan>
            <ErpViewField
              label="Approval status"
              value={PURCHASE_REQUISITION_STATUS_LABELS[status]}
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
            <div className="erp-form-span erp-form-span--3 mt-1">
              <p className="mb-2 text-[12px] font-semibold text-erp-text">Approval history</p>
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
            </div>
          </ErpCardSection>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-erp-border pt-3">
            <ErpButton
              type="button"
              variant="secondary"
              icon={Save}
              disabled={!editable || saving}
              onClick={() => void saveDraft(true)}
            >
              {saving ? 'Saving…' : 'Save Draft'}
            </ErpButton>
            <ErpButton
              type="button"
              variant="primary"
              icon={ArrowRight}
              onClick={() => setWorkspace('line_items')}
            >
              Continue to Line Items
            </ErpButton>
          </div>
        </div>
      ) : (
        <div
          id="pr-workspace-panel-line_items"
          role="tabpanel"
          aria-labelledby="pr-workspace-tab-line_items"
          className="space-y-3"
        >
          <ErpCardSection
            id={purchaseSectionId('lines')}
            title="Line Items"
            subtitle="Catalog or manual lines — pick item and qty; secondary fields in line details"
            icon={Package}
            accent="teal"
            collapsible
            defaultOpen
            dense
            columns={1}
            className="ring-1 ring-teal-200/70 shadow-sm"
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
              locationOptions={LOCATION_OPTIONS}
              editable={editable}
              showErrors={showErrors}
              lineErrors={validation.lineErrors}
              formatCurrency={formatCurrency}
              estimatedTotal={summary.estimatedTotal}
              onAddLine={() => setLinesDirty([...lines, emptyLine()])}
              onAddMultipleLines={() =>
                setLinesDirty([...lines, emptyLine(), emptyLine(), emptyLine()])
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
                  }),
                ])
              }}
              onImportExcel={() => fileInputRef.current?.click()}
              onClearLines={() => setLinesDirty([])}
              onPatchLine={patchLine}
              onRemoveLine={(key) => setLinesDirty(lines.filter((l) => l.key !== key))}
              onSelectCatalogItem={applyItemCatalog}
            />
            {showErrors &&
            validation.errors.some(
              (e) =>
                e.includes('line') ||
                e.includes('Line') ||
                e.includes('Quantity') ||
                e.includes('description') ||
                e.includes('Unit'),
            ) ? (
              <p className="mt-2 text-[12px] text-erp-danger-fg">Fix line errors before submit.</p>
            ) : null}
          </ErpCardSection>

          <ErpCardSection
            id={purchaseSectionId('finance')}
            title="Financial Summary"
            subtitle="Provisional totals from estimated line amounts"
            collapsedSummary={financeSummaryText || undefined}
            icon={Banknote}
            accent="amber"
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
            accent="violet"
            collapsible
            defaultOpen={false}
            dense
            columns={1}
          >
            <PurchaseDocumentAttachments
              files={prPlaceholdersToRows(attachments)}
              disabled={!editable}
              uploadedBy={ACTOR.name}
              hint="Technical specs, drawings, requirement docs, and supporting files"
              onChange={(next) => {
                setAttachments(rowsToPrPlaceholders(next, attachments))
                markDirty()
              }}
            />
          </ErpCardSection>
        </div>
      )}
    </PurchaseCardFormShell>
  )
}
