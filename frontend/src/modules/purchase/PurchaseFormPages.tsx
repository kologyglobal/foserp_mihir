import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  CheckCircle,
  ClipboardList,
  FileText,
  Package,
  Paperclip,
  Printer,
  Save,
  Send,
  ShoppingCart,
  Truck,
  X,
  XCircle,
} from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpStickySaveBar,
  ErpQuickEntrySection,
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpViewField,
  useErpAdditionalInfo,
  type ErpCardFormStatusItem,
} from '../../components/erp/card-form'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { VendorLookupSelect } from '../../components/lookups/VendorLookupSelect'
import { Checkbox, Input, Textarea } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMasterStore } from '../../store/masterStore'
import { usePurchasableItems, useActiveWarehouses, useActiveLocations } from '../../hooks/useMasterLists'
import { useDepartmentOptions } from '../../hooks/useCrmMasters'
import { LocationSelect } from '../../components/masters/LocationSelect'
import {
  filterLocationsByUsage,
  findLocationForWarehouse,
  getDefaultLocation,
  locationDisplayLabel,
  resolveLocationWarehouseId,
} from '../../utils/locationUtils'
import { useBuyerOptions } from '../../hooks/usePurchaseMasters'
import {
  MANUAL_PR_PURPOSE_LABELS,
  PR_SOURCE_LABELS,
  type ManualPrPurpose,
  type PrStatus,
} from '../../types/purchase'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { getSessionUser, canPermission } from '../../utils/permissions'
import { PrLineItemsGrid, type PrLineRow } from '@/components/purchase/PrLineItemsGrid'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { PurchaseProcessStagePanel } from '@/components/purchase/PurchaseProcessMap'
import { purchaseReadonlyValue, purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseFormSectionNav,
  purchaseSectionId,
  purchaseStatusStripToDocumentStrip,
  scrollToPurchaseSection,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import { EnterpriseFormMetrics } from '../../design-system/workspace'
import {
  buildPrProcessNextActions,
  prProcessStep,
  prStatusLabel,
} from '../../utils/purchaseStatusLabels'

const PURPOSE_SEARCH_OPTIONS: { value: ManualPrPurpose; label: string; searchText: string }[] = [
  { value: 'maintenance_parts', label: 'Maintenance', searchText: 'maintenance' },
  { value: 'emergency_material', label: 'Production', searchText: 'production emergency' },
  { value: 'general', label: 'Consumables', searchText: 'consumables general' },
  { value: 'general', label: 'MRP', searchText: 'mrp' },
  { value: 'tooling', label: 'Capital Purchase', searchText: 'capital tooling' },
  { value: 'office_supplies', label: 'Office', searchText: 'office' },
  { value: 'general', label: 'Project', searchText: 'project' },
  { value: 'tooling', label: 'Tooling', searchText: 'tooling' },
]

export function PurchaseRequisitionDocumentPage({ readOnly = false }: { readOnly?: boolean }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = getSessionUser()
  const existing = usePurchaseStore((s) => (id ? s.getPr(id) : undefined))
  const createManualPr = usePurchaseStore((s) => s.createManualPr)
  const submitPr = usePurchaseStore((s) => s.submitPr)
  const approvePr = usePurchaseStore((s) => s.approvePr)
  const cancelPr = usePurchaseStore((s) => s.cancelPr)
  const createRfqFromPr = usePurchaseStore((s) => s.createRfqFromPr)
  const createPoFromPr = usePurchaseStore((s) => s.createPoFromPr)
  const rfqs = usePurchaseStore((s) => s.rfqs)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const vendors = useMasterStore((s) => s.vendors)
  const items = usePurchasableItems()
  const warehouses = useActiveWarehouses()
  const allLocations = useActiveLocations()
  const purchaseLocations = useMemo(() => filterLocationsByUsage(allLocations, 'purchase'), [allLocations])
  const defaultPurchaseLocation = useMemo(() => getDefaultLocation(purchaseLocations), [purchaseLocations])
  const getLocationName = useMasterStore((s) => s.getLocationName)
  const uoms = useMasterStore((s) => s.uoms)
  const isEdit = Boolean(id && existing)
  const isView = readOnly && isEdit
  const isCreate = !id && !readOnly
  const status: PrStatus = existing?.status ?? 'draft'

  const defaultDate = new Date().toISOString().slice(0, 10)
  const defaultRequiredDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
  const [activeSection, setActiveSection] = useState(isCreate ? 'quick' : 'general')
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [poVendorId, setPoVendorId] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const {
    open: showAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo()

  const [purpose, setPurpose] = useState<ManualPrPurpose>(existing?.purpose ?? 'general')
  const [prSource, setPrSource] = useState<'manual' | 'reorder'>(existing?.source === 'reorder' ? 'reorder' : 'manual')
  const [headerNotes, setHeaderNotes] = useState('')
  const [priority, setPriority] = useState('medium')
  const [department, setDepartment] = useState('Purchase')
  const departmentOptions = useDepartmentOptions()
  const departmentSelectOptions = useMemo(
    () =>
      departmentOptions.map((o) => ({
        value: o.value,
        label: o.label,
        searchText: `${o.label} ${o.value}`,
      })),
    [departmentOptions],
  )
  const [headerLocationId, setHeaderLocationId] = useState(
    () => defaultPurchaseLocation?.id ?? purchaseLocations[0]?.id ?? '',
  )
  const [costCenter, setCostCenter] = useState('CC-PROD-01')
  const buyerOptions = useBuyerOptions()
  const [buyer, setBuyer] = useState(() => {
    const match = buyerOptions.find((b) => b.label === session.name)
    return match?.label ?? buyerOptions[0]?.label ?? session.name
  })
  const [requiredDate, setRequiredDate] = useState(defaultRequiredDate)
  const [expectedDelivery, setExpectedDelivery] = useState(defaultRequiredDate)
  const [project, setProject] = useState('')
  const [remarks, setRemarks] = useState('')
  const [budgetCode, setBudgetCode] = useState('BUD-2026-RM')
  const [errors, setErrors] = useState<string[]>([])

  const [lines, setLines] = useState<PrLineRow[]>(() =>
    existing?.lines.map((l) => {
      const item = items.find((i) => i.id === l.itemId)
      const uom = uoms.find((u) => u.id === item?.baseUomId)
      return {
        key: l.id,
        itemId: l.itemId,
        itemCode: item?.itemCode,
        itemName: item?.itemName,
        uomId: item?.baseUomId,
        uomName: uom?.uomCode,
        locationId: findLocationForWarehouse(l.warehouseId, allLocations)?.id ?? defaultPurchaseLocation?.id ?? '',
        warehouseId: l.warehouseId,
        vendorId: '',
        qty: String(l.qty),
        rate: String(item?.standardRate ?? 0),
        requiredDate: l.requiredDate,
        remarks: l.remarks,
      }
    }) ?? [
      {
        key: crypto.randomUUID(),
        itemId: '',
        locationId: defaultPurchaseLocation?.id ?? '',
        warehouseId: defaultPurchaseLocation?.warehouseId ?? warehouses[0]?.id ?? '',
        vendorId: '',
        qty: '1',
        rate: '0',
        requiredDate: defaultRequiredDate,
        remarks: '',
      },
    ],
  )

  const stockByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of useInventoryStore.getState().getStockPositions()) {
      m.set(p.itemId, (m.get(p.itemId) ?? 0) + p.freeQty)
    }
    return m
  }, [lines])

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.warehouseName, searchText: w.warehouseName.toLowerCase() })),
    [warehouses],
  )

  const locationOptions = useMemo(
    () =>
      purchaseLocations.map((loc) => ({
        value: loc.id,
        label: locationDisplayLabel(loc),
        searchText: `${loc.locationCode} ${loc.locationName} ${loc.city}`.toLowerCase(),
      })),
    [purchaseLocations],
  )

  function applyHeaderLocation(locationId: string) {
    setHeaderLocationId(locationId)
    const warehouseId = resolveLocationWarehouseId(locationId, allLocations) ?? ''
    if (!isView && isCreate) {
      setLines((prev) => prev.map((l) => ({ ...l, locationId, warehouseId: warehouseId || l.warehouseId })))
    }
  }

  const estimatedValue = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)
  const linkedRfq = rfqs.find((r) => r.prId === existing?.id)
  const linkedPo = purchaseOrders.find((p) => p.prId === existing?.id)
  const docNo = existing?.prNo ?? 'New'
  const sourceLabel = existing ? PR_SOURCE_LABELS[existing.source] : PR_SOURCE_LABELS[prSource]
  const purposeLabel = existing?.purpose ? MANUAL_PR_PURPOSE_LABELS[existing.purpose] : PURPOSE_SEARCH_OPTIONS.find((o) => o.value === purpose)?.label ?? 'General'

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function applyRequiredDateToLines(date: string) {
    setRequiredDate(date)
    setLines((prev) => prev.map((l) => ({ ...l, requiredDate: date })))
  }

  const linesWithItems = lines.filter((l) => Boolean(l.itemId)).length
  const hasValidLine = lines.some((l) => l.itemId && Number(l.qty) > 0)
  const readinessPercent = Math.round(
    ((purpose ? 1 : 0) + (department ? 1 : 0) + (requiredDate ? 1 : 0) + (hasValidLine ? 1 : 0)) / 4 * 100,
  )

  const formMetrics = [
    {
      label: 'Completion',
      value: `${readinessPercent}%`,
      accent: 'blue' as const,
      hint: hasValidLine ? 'Ready to save' : 'Add at least one item line',
    },
    {
      label: 'Line Items',
      value: String(linesWithItems || lines.length),
      accent: 'green' as const,
      hint: hasValidLine ? formatCurrency(estimatedValue) : 'Select items',
    },
    {
      label: 'Est. Value',
      value: estimatedValue > 0 ? formatCurrency(estimatedValue) : '—',
      accent: 'violet' as const,
      hint: purposeLabel,
    },
    {
      label: 'Need by',
      value: requiredDate ? formatDate(requiredDate) : '—',
      accent: 'amber' as const,
      hint: department || 'Department',
    },
  ]

  if (readOnly && id && !existing) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        PR not found. <Link to="/purchase/requisitions">Back to requisitions</Link>
      </div>
    )
  }

  function persist(submit = false) {
    const parsed = lines.map((l) => {
      const parts = [headerNotes.trim(), l.remarks.trim()].filter(Boolean)
      return {
        itemId: l.itemId,
        warehouseId: l.warehouseId,
        qty: Number(l.qty),
        requiredDate: l.requiredDate,
        salesOrderId: null,
        workOrderId: null,
        remarks: parts.length > 0 ? parts.join(' · ') : '',
      }
    })
    if (parsed.some((l) => !l.itemId || l.qty <= 0)) {
      setErrors(['Each line needs an item and quantity greater than zero.'])
      return
    }
    if (isEdit) {
      setErrors(['Saved PRs use workflow actions — create a new revision from list for major changes.'])
      return
    }
    const result = createManualPr({ source: prSource, purpose, lines: parsed })
    if (!result.ok || !result.prId) {
      setErrors([result.error ?? 'Failed to create PR'])
      return
    }
    if (submit) submitPr(result.prId)
    navigate(`/purchase/requisitions/${result.prId}`)
  }

  const canApprove = canPermission('purchase', 'approve')
  const canSubmit = canPermission('purchase', 'edit')

  const priorityOptions = [
    { value: 'low', label: 'Low', searchText: 'low' },
    { value: 'medium', label: 'Medium', searchText: 'medium' },
    { value: 'high', label: 'High', searchText: 'high' },
    { value: 'critical', label: 'Critical', searchText: 'critical' },
  ]

  const statusStrip: ErpCardFormStatusItem[] = isCreate
    ? [
        { label: 'Document', value: 'New PR', tone: 'neutral' },
        { label: 'Requester', value: session.name, tone: 'neutral' },
        { label: 'Department', value: department, tone: 'neutral' },
        { label: 'Purpose', value: purposeLabel, tone: 'info' },
        { label: 'Required', value: formatDate(requiredDate), tone: 'neutral' },
        { label: 'Lines', value: String(lines.length), tone: 'info' },
        { label: 'Est. Value', value: formatCurrency(estimatedValue), tone: 'success' },
      ]
    : [
        { label: 'PR No', value: docNo, tone: 'neutral' },
        { label: 'Status', value: prStatusLabel(status), tone: status === 'approved' ? 'success' : status === 'submitted' ? 'warning' : 'neutral' },
        { label: 'Approval', value: status === 'submitted' ? 'Awaiting Requisition Approval' : status === 'approved' ? 'Requisition Approved' : '—', tone: status === 'submitted' ? 'warning' : status === 'approved' ? 'success' : 'neutral' },
        { label: 'Created By', value: existing?.createdByName ?? session.name, tone: 'neutral' },
        { label: 'Created On', value: formatDate(existing?.createdAt ?? defaultDate), tone: 'neutral' },
        { label: 'Source', value: sourceLabel, tone: 'neutral' },
        { label: 'Department', value: department, tone: 'neutral' },
      ]

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isView) persist(false)
  }

  function goToSection(section: string) {
    scrollToPurchaseSection(section, setActiveSection)
  }

  const commandBar = (
    <ErpCommandBar
      sticky={false}
      primaryAction={
        isCreate
          ? { id: 'submit', label: 'Submit for Approval', icon: Send, onClick: () => persist(true) }
          : isView
            ? status === 'draft'
              ? { id: 'submit', label: 'Submit for Requisition Approval', icon: Send, onClick: () => { const r = submitPr(existing!.id); showToast(r.ok ? 'Submitted for requisition approval' : r.error ?? 'Failed') }, disabled: !canSubmit }
              : status === 'submitted'
                ? { id: 'approve', label: 'Approve Requisition', icon: CheckCircle, onClick: () => { const r = approvePr(existing!.id); showToast(r.ok ? 'Requisition approved' : r.error ?? 'Failed') }, disabled: !canApprove }
                : { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() }
            : { id: 'save', label: 'Save', icon: Save, onClick: () => persist(false), disabled: status !== 'draft' && isEdit }
      }
      secondaryActions={
        isCreate
          ? [
              { id: 'save-draft', label: 'Save Draft', icon: Save, onClick: () => persist(false) },
              { id: 'save-close', label: 'Save & Close', icon: Save, onClick: () => { persist(false); navigate('/purchase/requisitions') } },
            ]
          : isView
            ? [
                { id: 'rfq', label: 'Send RFQ to Vendors', icon: ShoppingCart, onClick: () => goToSection('commercial'), disabled: status !== 'approved' || Boolean(linkedRfq) },
                { id: 'po', label: 'Create Purchase Order', icon: Truck, onClick: () => goToSection('commercial'), disabled: !['approved', 'submitted'].includes(status) || Boolean(linkedPo) },
                { id: 'attachments', label: 'Attachments', icon: Paperclip, onClick: () => goToSection('attachments') },
                { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
              ]
            : [
                { id: 'save-close', label: 'Save & Close', icon: Save, onClick: () => { persist(false); navigate('/purchase/requisitions') } },
                { id: 'submit', label: 'Submit for Approval', icon: Send, onClick: () => (existing ? submitPr(existing.id) : persist(true)), disabled: !canSubmit || (isEdit && status !== 'draft') },
                { id: 'approve', label: 'Approve Requisition', icon: CheckCircle, onClick: () => existing && approvePr(existing.id), disabled: !canApprove || status !== 'submitted' },
                { id: 'attachments', label: 'Attachments', icon: Paperclip, onClick: () => goToSection('attachments') },
                { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print(), disabled: !isEdit },
              ]
      }
      destructiveActions={
        isView
          ? [{ id: 'cancel', label: 'Cancel PR', icon: XCircle, onClick: () => { const r = cancelPr(existing!.id); showToast(r.ok ? 'Cancelled' : r.error ?? 'Failed') }, disabled: status === 'converted' || status === 'cancelled' }]
          : !isCreate
            ? [{ id: 'cancel', label: 'Cancel', icon: XCircle, onClick: () => existing && cancelPr(existing.id), disabled: !existing || status === 'converted' }]
            : []
      }
    />
  )

  const footer = isView ? (
    <ErpStickySaveBar
      sticky
      hint={<span className="text-[12px] text-erp-muted">Esc Back · Print</span>}
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Send} disabled={status !== 'draft'} onClick={() => { const r = submitPr(existing!.id); showToast(r.ok ? 'Submitted for requisition approval' : r.error ?? 'Failed') }}>
            Submit for Approval
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={CheckCircle} disabled={status !== 'submitted'} onClick={() => { const r = approvePr(existing!.id); showToast(r.ok ? 'Requisition approved' : r.error ?? 'Failed') }}>
            Approve
          </ErpButton>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>Print</ErpButton>
        </ErpButtonGroup>
      )}
    />
  ) : (
    <ErpStickySaveBar
      sticky
      isSubmitting={false}
      submitLabel="Save"
      cancelTo="/purchase/requisitions"
      onSave={isCreate ? undefined : () => persist(false)}
      onSaveAndClose={isCreate ? undefined : () => { persist(false); navigate('/purchase/requisitions') }}
      hint={(
        <span className="text-[12px] text-erp-muted">
          {readinessPercent}% complete · Ctrl+S {isCreate ? 'Save Draft' : 'Save'} · Ctrl+Shift+S Save &amp; Close · Esc Cancel
        </span>
      )}
      actions={isCreate ? (
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" onClick={() => navigate('/purchase/requisitions')}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="secondary" onClick={() => persist(false)}>
            Save Draft
          </ErpButton>
          <ErpButton type="button" variant="primary" icon={Send} onClick={() => persist(true)}>
            Submit for Approval
          </ErpButton>
        </ErpButtonGroup>
      ) : undefined}
    />
  )

  const nextAction = !hasValidLine
    ? { id: 'add_lines', title: 'Add requisition lines', description: 'Select items, qty, and location so demand is clear.', ctaLabel: 'Go to lines' }
    : !purpose || !department
      ? { id: 'header', title: 'Complete request details', description: 'Set purpose and department before submitting.', ctaLabel: 'Go to details' }
      : status === 'draft' || isCreate
        ? { id: 'submit', title: 'Submit for approval', description: 'Save the draft, then route to Purchase Head.', ctaLabel: isCreate ? 'Submit for Approval' : 'Submit' }
        : status === 'submitted'
          ? { id: 'approve', title: 'Approve requisition', description: 'Review lines and approve demand.', ctaLabel: 'Review' }
          : { id: 'list', title: 'Back to requisitions', description: 'Open the PR register.', ctaLabel: 'All PRs' }

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart purchase requisition overview"
      title={isCreate ? 'New requisition' : docNo}
      chips={[
        {
          label: isCreate ? 'Draft' : prStatusLabel(status),
          tone: status === 'approved' ? 'success' : status === 'submitted' ? 'warning' : 'info',
        },
        { label: sourceLabel, tone: 'neutral' },
      ]}
      meta={[
        `Requester: ${existing?.requestedBy ?? session.name}`,
        department ? `Dept: ${department}` : 'No department',
        purposeLabel ? `Purpose: ${purposeLabel}` : 'No purpose',
      ]}
      progressLabel="Requisition readiness"
      progressPercent={readinessPercent}
      signals={[
        ...(hasValidLine ? [] : [{ id: 'lines', label: 'Add at least one item line', tone: 'warn' as const }]),
        ...(purpose ? [] : [{ id: 'purpose', label: 'Purpose required', tone: 'warn' as const }]),
        ...(department ? [] : [{ id: 'dept', label: 'Department required', tone: 'warn' as const }]),
        ...(estimatedValue > 0 ? [{ id: 'value', label: `Est. ${formatCurrency(estimatedValue)}`, tone: 'ok' as const }] : []),
      ]}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'add_lines') goToSection('lines')
        else if (nextAction.id === 'header') goToSection(isCreate ? 'quick' : 'general')
        else if (nextAction.id === 'submit') {
          if (isCreate) persist(true)
          else if (existing) submitPr(existing.id)
        } else if (nextAction.id === 'approve') goToSection('approval')
        else navigate('/purchase/requisitions')
      }}
      quickActions={[
        {
          id: 'list',
          label: 'All Requisitions',
          icon: FileText,
          onClick: () => navigate('/purchase/requisitions'),
        },
        {
          id: 'attachments',
          label: 'Attachments',
          icon: Paperclip,
          onClick: () => goToSection('attachments'),
        },
      ]}
      keyDetails={[
        { label: 'PR No.', value: isCreate ? 'New' : docNo },
        { label: 'Status', value: isCreate ? 'Draft' : prStatusLabel(status) },
        { label: 'Lines', value: String(linesWithItems || lines.length) },
        { label: 'Est. Value', value: estimatedValue > 0 ? formatCurrency(estimatedValue) : '—' },
        { label: 'Need by', value: formatDate(requiredDate) },
        { label: 'RFQ', value: linkedRfq?.rfqNo ?? '—', muted: !linkedRfq },
        { label: 'PO', value: linkedPo?.poNo ?? '—', muted: !linkedPo },
      ]}
      aiInsight={
        hasValidLine
          ? 'Match CRM quotation lines: expand a row for vendor preference and remarks before submit.'
          : 'Start with Quick Entry, then add purchasable items — same line grid pattern as CRM quotations.'
      }
    />
  )

  const createCommandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'submit', label: 'Submit for Approval', icon: Send, onClick: () => persist(true), primary: true },
        { id: 'save-draft', label: 'Save Draft', icon: Save, onClick: () => persist(false) },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate('/purchase/requisitions') },
      ]}
      moreActions={[
        { id: 'save-close', label: 'Save & Close', icon: Save, onClick: () => { persist(false); navigate('/purchase/requisitions') } },
      ]}
    />
  )

  const createSectionNav = (
    <PurchaseFormSectionNav
      sections={[
        { id: 'quick', label: 'Request', icon: ClipboardList, done: Boolean(purpose && department && requiredDate) },
        { id: 'lines', label: 'Lines', icon: Package, done: hasValidLine },
        { id: 'attachments', label: 'Review', icon: Paperclip },
      ]}
      activeId={activeSection}
      onSelect={setActiveSection}
    />
  )

  const detailSectionNav = (
    <PurchaseFormSectionNav
      sections={[
        { id: 'general', label: 'General', icon: ClipboardList },
        { id: 'lines', label: 'Lines', icon: Package, done: lines.length > 0 },
        { id: 'planning', label: 'Planning', icon: ClipboardList },
        { id: 'commercial', label: 'Commercial', icon: ShoppingCart },
        { id: 'approval', label: 'Approval', icon: CheckCircle },
        { id: 'attachments', label: 'Attachments', icon: Paperclip },
        { id: 'history', label: 'History', icon: ClipboardList },
      ]}
      activeId={activeSection}
      onSelect={setActiveSection}
    />
  )

  const createQuickEntry = (
    <>
      <div id={purchaseSectionId('quick')}>
        <ErpQuickEntrySection
          id={purchaseSectionId('quick-fields')}
          subtitle="Source, purpose, department, and need-by — expand Additional Information for the rest."
        >
          <ErpFieldRow label="PR Source" required>
            <ErpSmartSelect
              compact
              options={[
                { value: 'manual', label: 'Manual', searchText: 'manual ad-hoc' },
                { value: 'reorder', label: 'Reorder', searchText: 'reorder replenishment' },
              ]}
              value={prSource}
              onChange={(v) => v && setPrSource(v as 'manual' | 'reorder')}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Purpose" required>
            <ErpSmartSelect compact options={PURPOSE_SEARCH_OPTIONS} value={purpose} onChange={(v) => v && setPurpose(v)} />
          </ErpFieldRow>
          <ErpFieldRow label="Priority">
            <ErpSmartSelect compact options={priorityOptions} value={priority} onChange={(v) => v && setPriority(v)} />
          </ErpFieldRow>
          <ErpFieldRow label="Required Date" required>
            <Input type="date" value={requiredDate} onChange={(e) => applyRequiredDateToLines(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Department" required>
            <ErpSmartSelect
              compact
              options={departmentSelectOptions}
              value={department}
              onChange={(v) => v && setDepartment(v)}
              placeholder="Select department"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Location">
            <LocationSelect compact usage="purchase" value={headerLocationId} onChange={applyHeaderLocation} />
          </ErpFieldRow>
        </ErpQuickEntrySection>
      </div>

      <ErpAdditionalInfoToggle
        open={showAdditionalDetails}
        onToggle={toggleAdditionalDetails}
        panelId={additionalPanelId}
        sectionCount={3}
        summary="Buyer, project, notes, and financial dimensions"
      />
      <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
        <ErpCardSection title="Header details" subtitle="Buyer, scheduling, and references" collapsible defaultOpen>
          <ErpFieldRow label="Buyer">
            <ErpSmartSelect
              compact
              options={buyerOptions.map((b) => ({ value: b.label, label: b.label, searchText: `${b.label} ${b.value}` }))}
              value={buyer}
              onChange={(v) => v && setBuyer(v)}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Expected Delivery">
            <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Project">
            <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Project / job code…" />
          </ErpFieldRow>
          <ErpFieldRow label="Cost Center">
            <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Budget Code">
            <Input value={budgetCode} onChange={(e) => setBudgetCode(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Header Notes" colSpan={2} horizontal={false}>
            <Textarea value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)} rows={2} placeholder="Justification, urgency…" />
          </ErpFieldRow>
          <ErpFieldRow label="Remarks" colSpan={2} horizontal={false}>
            <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
          </ErpFieldRow>
        </ErpCardSection>
        <ErpCardSection title="Financial" subtitle="Estimated cost preview" collapsible defaultOpen={false}>
          <ErpViewField label="Estimated Cost" value={formatCurrency(estimatedValue)} />
          <ErpViewField label="Currency" value="INR" />
        </ErpCardSection>
      </ErpAdditionalInfoPanel>
    </>
  )

  const generalViewSection = (
    <ErpCardSection
      id={purchaseSectionId('general')}
      title="General"
      subtitle="Header, requester, and scheduling"
      icon={ClipboardList}
      accent="blue"
      columns={2}
      collapsible
      defaultOpen
    >
      <ErpViewField label="PR No" value={docNo} />
      <ErpViewField label="PR Date" value={formatDate(existing?.createdAt ?? defaultDate)} />
      <ErpViewField label="Status" value={prStatusLabel(status)} />
      <ErpViewField label="PR Source" value={sourceLabel} />
      <ErpViewField label="Priority" value={priority} />
      <ErpViewField label="Department" value={department} />
      <ErpViewField label="Location" value={getLocationName(headerLocationId)} />
      <ErpViewField label="Cost Center" value={costCenter} />
      <ErpViewField label="Requester" value={existing?.requestedBy ?? session.name} />
      <ErpViewField label="Buyer" value={buyer} />
      <ErpViewField label="Purpose" value={purposeLabel} />
      <ErpViewField label="Required Date" value={formatDate(requiredDate)} />
      <ErpViewField label="Expected Delivery" value={formatDate(expectedDelivery)} />
      <ErpViewField label="Project" value={project || undefined} />
      <ErpViewField label="Work Order" value={existing?.workOrderNo ?? undefined} />
      <ErpViewField label="MRP Reference" value={existing?.mrpRunId ?? undefined} />
      {existing?.lines.some((l) => l.remarks) ? (
        <ErpViewField
          label="Remarks"
          colSpan={2}
          value={existing.lines.map((l) => l.remarks).filter(Boolean).join(' · ')}
        />
      ) : null}
    </ErpCardSection>
  )

  const generalEditSection = (
    <ErpCardSection
      id={purchaseSectionId('general')}
      title="General"
      subtitle="Header, requester, and scheduling"
      icon={ClipboardList}
      accent="blue"
      collapsible
      defaultOpen
    >
      <ErpFieldRow label="PR No" readOnly>{purchaseReadonlyValue(docNo)}</ErpFieldRow>
      <ErpFieldRow label="PR Date" readOnly>{purchaseReadonlyValue(formatDate(existing?.createdAt ?? defaultDate))}</ErpFieldRow>
      <ErpFieldRow label="Status" readOnly>{purchaseReadonlyValue(prStatusLabel(status))}</ErpFieldRow>
      <ErpFieldRow label="PR Source">{purchaseReadonlyValue(sourceLabel)}</ErpFieldRow>
      <ErpFieldRow label="Priority">
        <ErpSmartSelect compact options={priorityOptions} value={priority} onChange={(v) => v && setPriority(v)} />
      </ErpFieldRow>
      <ErpFieldRow label="Department">
        <ErpSmartSelect
          compact
          options={departmentSelectOptions}
          value={department}
          onChange={(v) => v && setDepartment(v)}
          placeholder="Select department"
        />
      </ErpFieldRow>
      <ErpFieldRow label="Location Code">
        <LocationSelect compact usage="purchase" value={headerLocationId} onChange={applyHeaderLocation} />
      </ErpFieldRow>
      <ErpFieldRow label="Cost Center">
        <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />
      </ErpFieldRow>
      <ErpFieldRow label="Requester" readOnly>{purchaseReadonlyValue(existing?.requestedBy ?? session.name)}</ErpFieldRow>
      <ErpFieldRow label="Buyer">
        <ErpSmartSelect
          compact
          options={buyerOptions.map((b) => ({ value: b.label, label: b.label, searchText: `${b.label} ${b.value}` }))}
          value={buyer}
          onChange={(v) => v && setBuyer(v)}
        />
      </ErpFieldRow>
      <ErpFieldRow label="Purpose">
        <ErpSmartSelect compact options={PURPOSE_SEARCH_OPTIONS} value={purpose} onChange={(v) => v && setPurpose(v)} />
      </ErpFieldRow>
      <ErpFieldRow label="Required Date">
        <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
      </ErpFieldRow>
      <ErpFieldRow label="Expected Delivery">
        <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />
      </ErpFieldRow>
      <ErpFieldRow label="Project">
        <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Search project…" />
      </ErpFieldRow>
      <ErpFieldRow label="Header Notes" colSpan={2} horizontal={false}>
        <Textarea value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)} rows={2} />
      </ErpFieldRow>
      <ErpFieldRow label="Remarks" colSpan={2} horizontal={false}>
        <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
      </ErpFieldRow>
    </ErpCardSection>
  )

  const linesSection = (
    <ErpCardSection
      id={purchaseSectionId('lines')}
      title="Line items"
      subtitle="Search items, set qty and rate — same dense grid as CRM quotations"
      icon={Package}
      accent="teal"
      className="col-span-2"
      columns={1}
      collapsible
      defaultOpen
    >
      <div className="col-span-3">
        <PrLineItemsGrid
          lines={lines}
          onChange={setLines}
          locationOptions={locationOptions}
          warehouseOptions={warehouseOptions}
          stockByItem={stockByItem}
          readOnly={isView}
        />
      </div>
    </ErpCardSection>
  )

  const planningSection = (
    <ErpCardSection
      id={purchaseSectionId('planning')}
      title="Planning"
      subtitle="Scheduling and demand references"
      icon={ClipboardList}
      accent="amber"
      columns={2}
      collapsible
      defaultOpen
    >
      {isView ? (
        <>
          <ErpViewField label="Required Date" value={formatDate(requiredDate)} />
          <ErpViewField label="Need By" value={formatDate(requiredDate)} />
          <ErpViewField label="Work Order" value={existing?.workOrderNo ?? undefined} />
          <ErpViewField label="MRP" value={existing?.mrpRunId ?? undefined} />
          <ErpViewField label="Project" value={project || undefined} />
          <ErpViewField label="Buyer" value={buyer} />
          <ErpViewField label="Demand Source" value={sourceLabel} />
          <ErpViewField label="Est. Cost" value={formatCurrency(estimatedValue)} />
        </>
      ) : (
        <>
          <ErpFieldRow label="Required Date">
            <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Need By">
            <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Work Order" readOnly>{purchaseReadonlyValue(existing?.workOrderNo ?? '—')}</ErpFieldRow>
          <ErpFieldRow label="MRP" readOnly>{purchaseReadonlyValue(existing?.mrpRunId ?? '—')}</ErpFieldRow>
          <ErpFieldRow label="Project">
            <Input value={project} onChange={(e) => setProject(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Buyer" readOnly>{purchaseReadonlyValue(buyer)}</ErpFieldRow>
        </>
      )}
    </ErpCardSection>
  )

  const commercialSection = (
    <div id={purchaseSectionId('commercial')} className="space-y-4">
      <ErpCardSection title="Commercial terms" subtitle="Payment, incoterms, and currency" icon={ShoppingCart} accent="violet" columns={2} collapsible defaultOpen>
        {isView ? (
          <>
            <ErpViewField label="Payment Terms" value="Net 30" />
            <ErpViewField label="Incoterms" value="Ex-Works Pune" />
            <ErpViewField label="Currency" value="INR" />
          </>
        ) : (
          <>
            <ErpFieldRow label="Payment Terms" readOnly>{purchaseReadonlyValue('Net 30')}</ErpFieldRow>
            <ErpFieldRow label="Incoterms" readOnly>{purchaseReadonlyValue('Ex-Works Pune')}</ErpFieldRow>
            <ErpFieldRow label="Currency" readOnly>{purchaseReadonlyValue('INR')}</ErpFieldRow>
          </>
        )}
      </ErpCardSection>
      {isView && status === 'approved' && !linkedRfq ? (
        <ErpCardSection title="Send RFQ to Approved Vendors" subtitle="Select at least two vendors to invite (canonical step 5)" accent="green" collapsible defaultOpen>
          <div className="col-span-2 flex flex-wrap gap-2">
            {vendors.filter((v) => v.isActive).map((v) => (
              <Checkbox
                key={v.id}
                label={v.vendorName}
                checked={selectedVendors.includes(v.id)}
                onChange={(e) => setSelectedVendors((prev) => (e.target.checked ? [...prev, v.id] : prev.filter((x) => x !== v.id)))}
                className="text-xs border border-erp-border rounded px-2 py-1 bg-white"
              />
            ))}
          </div>
          <div className="col-span-2">
            <ErpButton type="button" variant="primary" icon={ShoppingCart} disabled={selectedVendors.length < 2} onClick={() => {
              const r = createRfqFromPr(existing!.id, selectedVendors)
              if (r.ok && r.rfqId) navigate(`/purchase/rfqs/${r.rfqId}`)
              else showToast(r.error ?? 'Select at least 2 vendors')
            }}>
              Send RFQ to Vendors
            </ErpButton>
          </div>
        </ErpCardSection>
      ) : null}
      {isView && ['approved', 'submitted'].includes(status) && !linkedPo ? (
        <ErpCardSection title="Create Purchase Order" subtitle="Direct purchase planning when RFQ is not required (canonical step 9)" accent="teal" collapsible defaultOpen>
          <ErpFieldRow label="Vendor">
            <VendorLookupSelect
              compact
              allowEmpty
              value={poVendorId}
              onChange={(sel) => setPoVendorId(sel?.vendorId ?? '')}
            />
          </ErpFieldRow>
          <div className="col-span-2">
            <ErpButton type="button" variant="primary" icon={Truck} disabled={!poVendorId} onClick={() => {
              const r = createPoFromPr(existing!.id, poVendorId)
              if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`)
              else showToast(r.error ?? 'Failed')
            }}>
              Create PO
            </ErpButton>
          </div>
        </ErpCardSection>
      ) : null}
      {isView && linkedRfq ? (
        <p className="text-sm text-erp-muted">
          RFQ: <TableLink to={`/purchase/rfqs/${linkedRfq.id}`}>{linkedRfq.rfqNo}</TableLink>
        </p>
      ) : null}
      {isView && linkedPo ? (
        <p className="text-sm text-erp-muted">
          PO: <TableLink to={`/purchase/orders/${linkedPo.id}`}>{linkedPo.poNo}</TableLink>
        </p>
      ) : null}
    </div>
  )

  const approvalSection = (
    <ErpCardSection
      id={purchaseSectionId('approval')}
      title="Approval"
      subtitle="Workflow status and sign-off"
      icon={CheckCircle}
      accent="green"
      columns={2}
      collapsible
      defaultOpen
    >
      {isView ? (
        <>
          <ErpViewField label="Approval Status" value={status === 'submitted' ? 'Awaiting Requisition Approval' : prStatusLabel(status)} />
          <ErpViewField label="Pending With" value={status === 'submitted' ? 'Purchase Head' : undefined} />
          <ErpViewField label="Approved By" value={existing?.approvedByName ?? undefined} />
          <ErpViewField label="Approved Date" value={existing?.approvedAt ? formatDate(existing.approvedAt) : undefined} />
        </>
      ) : (
        <>
          <ErpFieldRow label="Approval Status" readOnly>{purchaseReadonlyValue(status === 'submitted' ? 'Awaiting Requisition Approval' : prStatusLabel(status))}</ErpFieldRow>
          <ErpFieldRow label="Pending With" readOnly>{purchaseReadonlyValue(status === 'submitted' ? 'Purchase Head' : '—')}</ErpFieldRow>
          <ErpFieldRow label="Approved By" readOnly>{purchaseReadonlyValue(existing?.approvedByName ?? '—')}</ErpFieldRow>
          <ErpFieldRow label="Approved Date" readOnly>{purchaseReadonlyValue(existing?.approvedAt ? formatDate(existing.approvedAt) : '—')}</ErpFieldRow>
        </>
      )}
    </ErpCardSection>
  )

  const attachmentsSection = (
    <ErpCardSection
      id={purchaseSectionId('attachments')}
      title="Attachments"
      subtitle="Supporting documents for this requisition"
      icon={Paperclip}
      accent="slate"
      collapsible
      defaultOpen={false}
    >
      <ul className="text-sm text-erp-muted list-disc pl-5 space-y-1 col-span-2">
        <li>Drawings (link on save)</li>
        <li>Specifications</li>
        <li>Vendor catalogue PDF</li>
        <li>Inspection sheet</li>
      </ul>
      <p className="col-span-2 text-xs text-erp-muted">Demo mode — file upload API is not wired for purchase documents.</p>
    </ErpCardSection>
  )

  const historySection = (
    <ErpCardSection
      id={purchaseSectionId('history')}
      title="History"
      subtitle="Document lifecycle events"
      icon={ClipboardList}
      accent="slate"
      collapsible
      defaultOpen={false}
    >
      <ul className="col-span-2 space-y-3 text-sm">
        {[
          { t: 'Created', d: existing?.createdAt, u: existing?.createdByName },
          { t: 'Modified', d: existing?.modifiedAt, u: existing?.modifiedByName },
          { t: 'Submitted', d: status !== 'draft' ? existing?.modifiedAt : null, u: existing?.requestedBy },
          { t: 'Approved', d: existing?.approvedAt, u: existing?.approvedByName },
          { t: 'RFQ Created', d: linkedRfq?.createdAt, u: linkedRfq?.createdByName },
          { t: 'PO Created', d: linkedPo?.createdAt, u: linkedPo?.createdByName },
        ]
          .filter((e) => e.d)
          .map((e) => (
            <li key={e.t} className="border-l-2 border-erp-border pl-3">
              <strong className="text-erp-text">{e.t}</strong>
              <div className="text-erp-muted">{formatDate(e.d!)} · {e.u ?? '—'}</div>
            </li>
          ))}
      </ul>
    </ErpCardSection>
  )

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title={isCreate ? 'New Purchase Requisition' : 'Purchase Requisition'}
        description={
          isCreate
            ? 'Demand → create requisition — save as draft or submit for approval'
            : isView
              ? 'Requisition 360 — lines, approval, and linked RFQ/PO'
              : 'Edit requisition header and lines before workflow actions'
        }
        recordNo={isCreate ? 'New' : docNo}
        recordTitle={isCreate ? purposeLabel || 'New requisition' : purposeLabel || docNo}
        status={isCreate ? 'Draft' : prStatusLabel(status)}
        statusTone={isCreate ? 'neutral' : purchaseStatusTone(status)}
        owner={existing?.requestedBy ?? session.name}
        company={department || undefined}
        createdDate={formatDate(existing?.createdAt ?? defaultDate)}
        createdBy={existing?.createdByName ?? session.name}
        modifiedDate={existing?.modifiedAt ? formatDate(existing.modifiedAt) : undefined}
        modifiedBy={existing?.modifiedByName ?? undefined}
        favoritePath={isCreate ? '/purchase/requisitions/new' : `/purchase/requisitions/${id}`}
        breadcrumbs={[
          { label: 'Requisitions', to: '/purchase/requisitions' },
          { label: isCreate ? 'New' : docNo },
        ]}
        commandBar={isCreate ? createCommandBar : commandBar}
        documentStrip={purchaseStatusStripToDocumentStrip(statusStrip)}
        detailMode={isView}
        className="enterprise-workspace--dynamics-form enterprise-workspace--crm-smart-overview"
        validationErrors={errors}
        onSubmit={isView ? undefined : handleSubmit}
        onSaveShortcut={isView ? undefined : () => persist(false)}
        onSaveCloseShortcut={isView ? undefined : () => { persist(false); navigate('/purchase/requisitions') }}
        onSaveAndNewShortcut={isCreate ? () => persist(false) : undefined}
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        suppressFactBoxRecord
        stickyFooter
      >
        {isCreate ? (
          <>
            {createSectionNav}
            <EnterpriseFormMetrics metrics={formMetrics} />
            {createQuickEntry}
            {linesSection}
            {attachmentsSection}
          </>
        ) : (
          <>
            {existing ? (
              <PurchaseProcessStagePanel
                currentStep={prProcessStep(existing)}
                statusLabel={prStatusLabel(status)}
                nextActions={buildPrProcessNextActions(existing, {
                  linkedRfqId: linkedRfq?.id,
                  linkedPoId: linkedPo?.id,
                })}
              />
            ) : null}
            {detailSectionNav}
            <EnterpriseFormMetrics metrics={formMetrics} />
            {isView ? generalViewSection : generalEditSection}
            {linesSection}
            {planningSection}
            {commercialSection}
            {approvalSection}
            {attachmentsSection}
            {historySection}
          </>
        )}
      </PurchaseCardFormShell>
    </>
  )
}

import { PurchaseRequisitionEditorPage } from './PurchaseRequisitionEditorPage'

export function PurchaseRequisitionFormPage() {
  return <PurchaseRequisitionEditorPage />
}

export function PurchaseRequisitionEditPage() {
  return <PurchaseRequisitionEditorPage />
}

export { ManualPrFormPage } from './ManualPrFormPage'
