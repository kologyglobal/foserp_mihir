import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle,
  ClipboardList,
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
  ERP_CARD_FORM_TABS_PR,
  ERP_CARD_FORM_TABS_PR_CREATE,
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
import { purchaseReadonlyValue, purchaseStatusTone } from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseEnterpriseFactBox,
  PurchaseFormSectionNav,
  purchaseSectionId,
  purchaseStatusStripToDocumentStrip,
} from '@/components/purchase/PurchaseEnterpriseFormKit'

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
  const [activeTab, setActiveTab] = useState('lines')
  const [activeSection, setActiveSection] = useState('lines')
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [poVendorId, setPoVendorId] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const [purpose, setPurpose] = useState<ManualPrPurpose>(existing?.purpose ?? 'general')
  const [prSource, setPrSource] = useState<'manual' | 'reorder'>(existing?.source === 'reorder' ? 'reorder' : 'manual')
  const [headerNotes, setHeaderNotes] = useState('')
  const [priority, setPriority] = useState('medium')
  const [department, setDepartment] = useState('Purchase')
  const departmentOptions = useDepartmentOptions()
  const departmentSelectOptions = useMemo(
    () => departmentOptions.map((o) => ({ value: o.value, label: o.label })),
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

  function addLine() {
    const last = lines[lines.length - 1]
    setLines([
      ...lines,
      {
        key: crypto.randomUUID(),
        itemId: last?.itemId ?? '',
        itemCode: last?.itemCode,
        itemName: last?.itemName,
        uomId: last?.uomId,
        uomName: last?.uomName,
        locationId: last?.locationId ?? headerLocationId,
        warehouseId: last?.warehouseId ?? resolveLocationWarehouseId(headerLocationId, allLocations) ?? warehouses[0]?.id ?? '',
        vendorId: '',
        qty: '1',
        rate: last?.itemId ? String(items.find((i) => i.id === last.itemId)?.standardRate ?? 0) : '0',
        requiredDate: last?.requiredDate ?? defaultRequiredDate,
        remarks: '',
      },
    ])
  }

  function applyRequiredDateToLines(date: string) {
    setRequiredDate(date)
    setLines((prev) => prev.map((l) => ({ ...l, requiredDate: date })))
  }

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

  const prSourceOptions = [
    { value: 'manual', label: 'Manual — ad-hoc requirement', searchText: 'manual ad-hoc' },
    { value: 'reorder', label: 'Reorder — replenishment below min stock', searchText: 'reorder replenishment' },
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
        { label: 'Status', value: status, tone: status === 'approved' ? 'success' : status === 'submitted' ? 'warning' : 'neutral' },
        { label: 'Approval', value: status === 'submitted' ? 'Pending' : status === 'approved' ? 'Approved' : '—', tone: status === 'submitted' ? 'warning' : status === 'approved' ? 'success' : 'neutral' },
        { label: 'Created By', value: existing?.createdByName ?? session.name, tone: 'neutral' },
        { label: 'Created On', value: formatDate(existing?.createdAt ?? defaultDate), tone: 'neutral' },
        { label: 'Source', value: sourceLabel, tone: 'neutral' },
        { label: 'Department', value: department, tone: 'neutral' },
      ]

  const tabs = (isCreate ? ERP_CARD_FORM_TABS_PR_CREATE : ERP_CARD_FORM_TABS_PR).map((tab) =>
    isCreate && tab.id === 'lines' ? { ...tab, count: lines.length } : tab,
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isView) persist(false)
  }

  function handleCreateRfq() {
    if (!existing) return
    const vids = selectedVendors.length >= 2
      ? selectedVendors
      : vendors.filter((v) => v.isActive).slice(0, 2).map((v) => v.id)
    const r = createRfqFromPr(existing.id, vids)
    if (r.ok && r.rfqId) navigate(`/purchase/rfqs/${r.rfqId}`)
    else showToast(r.error ?? 'Failed to create RFQ')
  }

  function handleCreatePo() {
    if (!existing) return
    if (!poVendorId) {
      setActiveTab('commercial')
      showToast('Select a vendor on Commercial tab')
      return
    }
    const r = createPoFromPr(existing.id, poVendorId)
    if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`)
    else showToast(r.error ?? 'Failed to create PO')
  }

  const commandBar = (
    <ErpCommandBar
      sticky={false}
      primaryAction={
        isCreate
          ? { id: 'save', label: 'Save', icon: Save, onClick: () => persist(false) }
          : isView
            ? status === 'draft'
              ? { id: 'submit', label: 'Send Approval', icon: Send, onClick: () => { const r = submitPr(existing!.id); showToast(r.ok ? 'Submitted for approval' : r.error ?? 'Failed') }, disabled: !canSubmit }
              : status === 'submitted'
                ? { id: 'approve', label: 'Approve', icon: CheckCircle, onClick: () => { const r = approvePr(existing!.id); showToast(r.ok ? 'Approved' : r.error ?? 'Failed') }, disabled: !canApprove }
                : { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() }
            : { id: 'save', label: 'Save', icon: Save, onClick: () => persist(false), disabled: status !== 'draft' && isEdit }
      }
      secondaryActions={
        isCreate
          ? [
              { id: 'save-close', label: 'Save & Close', icon: Save, onClick: () => { persist(false); navigate('/purchase/requisitions') } },
              { id: 'submit', label: 'Save & Submit', icon: Send, onClick: () => persist(true) },
            ]
          : isView
            ? [
                { id: 'rfq', label: 'Create RFQ', icon: ShoppingCart, onClick: () => setActiveTab('commercial'), disabled: status !== 'approved' || Boolean(linkedRfq) },
                { id: 'po', label: 'Direct PO', icon: Truck, onClick: () => setActiveTab('commercial'), disabled: !['approved', 'submitted'].includes(status) || Boolean(linkedPo) },
                { id: 'attachments', label: 'Attachments', icon: Paperclip, onClick: () => setActiveTab('attachments') },
                { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
              ]
            : [
                { id: 'save-close', label: 'Save & Close', icon: Save, onClick: () => { persist(false); navigate('/purchase/requisitions') } },
                { id: 'submit', label: 'Send Approval', icon: Send, onClick: () => (existing ? submitPr(existing.id) : persist(true)), disabled: !canSubmit || (isEdit && status !== 'draft') },
                { id: 'approve', label: 'Approve', icon: CheckCircle, onClick: () => existing && approvePr(existing.id), disabled: !canApprove || status !== 'submitted' },
                { id: 'attachments', label: 'Attachments', icon: Paperclip, onClick: () => setActiveTab('attachments') },
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

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      hint={
        isCreate
          ? 'Alt+N add line · Alt+S save · Ctrl+Enter save & close · Esc cancel'
          : isView
            ? 'Esc Back · Print'
            : 'Alt+S Save · Ctrl+Enter Save & Close · F4 Lookup · Esc Cancel'
      }
      actions={(
        <ErpButtonGroup>
          {isCreate ? (
            <>
              <Link to="/purchase/requisitions">
                <ErpButton type="button" variant="ghost" icon={ArrowLeft}>Cancel</ErpButton>
              </Link>
              <ErpButton type="button" variant="secondary" onClick={() => persist(false)}>Save Draft</ErpButton>
              <ErpButton type="button" variant="primary" icon={Send} onClick={() => persist(true)}>Save &amp; Submit</ErpButton>
              <ErpButton type="button" variant="secondary" icon={Save} onClick={() => { persist(false); navigate('/purchase/requisitions') }}>Save &amp; Close</ErpButton>
              <ErpButton type="button" variant="primary" icon={Save} onClick={() => persist(false)}>Save</ErpButton>
            </>
          ) : isView ? (
            <>
              <Link to="/purchase/requisitions">
                <ErpButton type="button" variant="ghost" icon={ArrowLeft}>Back</ErpButton>
              </Link>
              <ErpButton type="button" variant="secondary" icon={Send} disabled={status !== 'draft'} onClick={() => { const r = submitPr(existing!.id); showToast(r.ok ? 'Submitted' : r.error ?? 'Failed') }}>
                Submit for Approval
              </ErpButton>
              <ErpButton type="button" variant="secondary" icon={CheckCircle} disabled={status !== 'submitted'} onClick={() => { const r = approvePr(existing!.id); showToast(r.ok ? 'Approved' : r.error ?? 'Failed') }}>
                Approve
              </ErpButton>
              <ErpButton type="button" variant="secondary" icon={ShoppingCart} disabled={status !== 'approved' || Boolean(linkedRfq)} onClick={handleCreateRfq}>
                Create RFQ
              </ErpButton>
              <ErpButton type="button" variant="secondary" icon={Truck} disabled={!['approved', 'submitted'].includes(status) || Boolean(linkedPo)} onClick={handleCreatePo}>
                Create PO
              </ErpButton>
              <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => window.print()}>Print</ErpButton>
            </>
          ) : (
            <>
              <Link to="/purchase/requisitions">
                <ErpButton type="button" variant="ghost" icon={ArrowLeft}>Cancel</ErpButton>
              </Link>
              <ErpButton type="button" variant="secondary" onClick={() => persist(false)}>Save Draft</ErpButton>
              <ErpButton type="button" variant="secondary" onClick={() => { persist(false); navigate('/purchase/requisitions/new') }}>Save &amp; New</ErpButton>
              <ErpButton type="button" variant="secondary" onClick={() => { persist(false); navigate('/purchase/requisitions') }}>Save &amp; Close</ErpButton>
              <ErpButton type="button" variant="secondary" icon={Send} disabled={status !== 'draft' && isEdit} onClick={() => (existing ? submitPr(existing.id) : persist(true))}>
                Submit for Approval
              </ErpButton>
              <ErpButton type="button" variant="secondary" icon={ShoppingCart} disabled={status !== 'approved'} onClick={() => {
                if (!existing) return
                const vids = vendors.filter((v) => v.isActive).slice(0, 2).map((v) => v.id)
                const r = createRfqFromPr(existing.id, vids)
                if (r.ok && r.rfqId) navigate(`/purchase/rfqs/${r.rfqId}`)
              }}>
                Create RFQ
              </ErpButton>
              <ErpButton type="button" variant="primary" icon={Save} onClick={() => persist(false)}>Save</ErpButton>
            </>
          )}
        </ErpButtonGroup>
      )}
    />
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      metrics={[
        { label: 'Lines', value: String(lines.length), accent: 'blue' },
        { label: 'Est. Value', value: formatCurrency(estimatedValue), accent: 'green', highlight: estimatedValue > 0 },
        { label: 'Purpose', value: purposeLabel, accent: 'violet' },
        { label: 'Required', value: formatDate(requiredDate), accent: 'amber' },
      ]}
      summary={[
        { label: 'Document', value: isCreate ? 'New PR' : docNo },
        { label: 'Status', value: isCreate ? 'Draft' : status, highlight: status === 'approved' },
        { label: 'Requester', value: existing?.requestedBy ?? session.name },
        { label: 'Department', value: department },
        { label: 'Open RFQ', value: linkedRfq ? <TableLink to={`/purchase/rfqs/${linkedRfq.id}`}>{linkedRfq.rfqNo}</TableLink> : '—' },
        { label: 'Open PO', value: linkedPo ? <TableLink to={`/purchase/orders/${linkedPo.id}`}>{linkedPo.poNo}</TableLink> : '—' },
        { label: 'Est. Value', value: formatCurrency(estimatedValue), highlight: true },
      ]}
      actions={[
        { id: 'save', label: 'Save', icon: Save, primary: true, onClick: () => persist(false), disabled: isView },
        { id: 'submit', label: 'Submit', icon: Send, onClick: () => persist(true), disabled: isView || !canSubmit },
        { id: 'back', label: 'Back to list', icon: ArrowLeft, onClick: () => navigate('/purchase/requisitions') },
      ]}
    />
  )

  const createCommandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'save', label: 'Save', icon: Save, onClick: () => persist(false), primary: true },
        { id: 'submit', label: 'Save & Submit', icon: Send, onClick: () => persist(true) },
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
        { id: 'lines', label: 'Lines', icon: Package, done: lines.some((l) => l.itemId && Number(l.qty) > 0) },
        { id: 'general', label: 'General', icon: ClipboardList, done: Boolean(purpose && department) },
        { id: 'attachments', label: 'Attachments', icon: Paperclip },
      ]}
      activeId={activeSection}
      onSelect={setActiveSection}
    />
  )

  const linesEssentials = isCreate ? (
    <ErpCardSection title="Line essentials" subtitle="Source, purpose, and scheduling for this requisition">
      <ErpFieldRow label="PR Source">
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
      <ErpFieldRow label="Purpose">
        <ErpSmartSelect compact options={PURPOSE_SEARCH_OPTIONS} value={purpose} onChange={(v) => v && setPurpose(v)} />
      </ErpFieldRow>
      <ErpFieldRow label="Priority">
        <ErpSmartSelect compact options={priorityOptions} value={priority} onChange={(v) => v && setPriority(v)} />
      </ErpFieldRow>
      <ErpFieldRow label="Required Date">
        <Input type="date" value={requiredDate} onChange={(e) => applyRequiredDateToLines(e.target.value)} />
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
    </ErpCardSection>
  ) : null

  const generalTab = (
    <>
      <ErpCardSection title="General" subtitle="Header, requester, and scheduling" collapsible defaultOpen>
        <ErpFieldRow label="PR No" readOnly>
          {purchaseReadonlyValue(docNo)}
        </ErpFieldRow>
        <ErpFieldRow label="PR Date" readOnly>
          {purchaseReadonlyValue(formatDate(existing?.createdAt ?? defaultDate))}
        </ErpFieldRow>
        <ErpFieldRow label="Status" readOnly>
          {purchaseReadonlyValue(status)}
        </ErpFieldRow>
        <ErpFieldRow label="PR Source">
          {isEdit ? purchaseReadonlyValue(sourceLabel) : (
            <ErpSmartSelect compact options={prSourceOptions} value={prSource} onChange={(v) => v && setPrSource(v as 'manual' | 'reorder')} />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Priority">
          {isView ? purchaseReadonlyValue(priority) : (
            <ErpSmartSelect compact options={priorityOptions} value={priority} onChange={(v) => v && setPriority(v)} />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Department">
          {isView ? purchaseReadonlyValue(department) : (
            <ErpSmartSelect
              compact
              options={departmentSelectOptions}
              value={department}
              onChange={(v) => v && setDepartment(v)}
              placeholder="Select department"
            />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Location Code">
          {isView ? purchaseReadonlyValue(getLocationName(headerLocationId)) : (
            <LocationSelect compact usage="purchase" value={headerLocationId} onChange={applyHeaderLocation} />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Cost Center">
          {isView ? purchaseReadonlyValue(costCenter) : <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Requester" readOnly>
          {purchaseReadonlyValue(existing?.requestedBy ?? session.name)}
        </ErpFieldRow>
        <ErpFieldRow label="Buyer">
          {isView ? purchaseReadonlyValue(buyer) : (
            <ErpSmartSelect
              compact
              options={buyerOptions.map((b) => ({ value: b.label, label: b.label, searchText: `${b.label} ${b.value}` }))}
              value={buyer}
              onChange={(v) => v && setBuyer(v)}
            />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Source" readOnly>
          {purchaseReadonlyValue(sourceLabel)}
        </ErpFieldRow>
        <ErpFieldRow label="Purpose">
          {isView ? purchaseReadonlyValue(purposeLabel) : (
            <ErpSmartSelect compact options={PURPOSE_SEARCH_OPTIONS} value={purpose} onChange={(v) => v && setPurpose(v)} />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Required Date">
          {isView ? purchaseReadonlyValue(formatDate(requiredDate)) : <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Expected Delivery">
          {isView ? purchaseReadonlyValue(formatDate(expectedDelivery)) : <Input type="date" value={expectedDelivery} onChange={(e) => setExpectedDelivery(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Project">
          {isView ? purchaseReadonlyValue(project || '—') : <Input value={project} onChange={(e) => setProject(e.target.value)} placeholder="Search project…" />}
        </ErpFieldRow>
        <ErpFieldRow label="Work Order" readOnly>
          {purchaseReadonlyValue(existing?.workOrderNo ?? '—')}
        </ErpFieldRow>
        <ErpFieldRow label="MRP Reference" readOnly>
          {purchaseReadonlyValue(existing?.mrpRunId ?? '—')}
        </ErpFieldRow>
        {!isView ? (
          <>
            <ErpFieldRow label="Header Notes" colSpan={2} horizontal={false}>
              <Textarea value={headerNotes} onChange={(e) => setHeaderNotes(e.target.value)} rows={2} placeholder="Justification, cost centre, urgency…" />
            </ErpFieldRow>
            <ErpFieldRow label="Remarks" colSpan={2} horizontal={false}>
              <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={2} />
            </ErpFieldRow>
          </>
        ) : existing?.lines[0]?.remarks ? (
          <ErpFieldRow label="Remarks" colSpan={2} readOnly>
            {purchaseReadonlyValue(existing.lines.map((l) => l.remarks).filter(Boolean).join(' · ') || '—')}
          </ErpFieldRow>
        ) : null}
      </ErpCardSection>

      <ErpCardSection title="Planning" subtitle="Demand and warehouse context" collapsible defaultOpen={!isCreate}>
        <ErpFieldRow label="Need By" readOnly>
          {purchaseReadonlyValue(formatDate(requiredDate))}
        </ErpFieldRow>
        <ErpFieldRow label="Production Order" readOnly>
          {purchaseReadonlyValue('—')}
        </ErpFieldRow>
        <ErpFieldRow label="Demand Source" readOnly>
          {purchaseReadonlyValue(sourceLabel)}
        </ErpFieldRow>
        <ErpFieldRow label="Location Code">
          <LocationSelect compact usage="purchase" value={lines[0]?.locationId ?? headerLocationId} onChange={applyHeaderLocation} />
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection title="Financial" subtitle="Budget and estimated cost" collapsible defaultOpen={false}>
        <ErpFieldRow label="Budget Code" readOnly>
          {purchaseReadonlyValue(budgetCode)}
        </ErpFieldRow>
        <ErpFieldRow label="Estimated Cost" readOnly>
          {purchaseReadonlyValue(formatCurrency(estimatedValue))}
        </ErpFieldRow>
        <ErpFieldRow label="Approved Budget" readOnly>
          {purchaseReadonlyValue(formatCurrency(500000))}
        </ErpFieldRow>
        <ErpFieldRow label="Variance" readOnly>
          {purchaseReadonlyValue(formatCurrency(500000 - estimatedValue))}
        </ErpFieldRow>
      </ErpCardSection>

      <ErpCardSection title="Vendor" subtitle="Line-level vendor suggestions" collapsible defaultOpen={false} optional>
        <p className="text-sm text-erp-muted col-span-2">Suggested vendors appear on line level. Use assist (…) for lookup.</p>
      </ErpCardSection>

      {!isCreate ? (
        <p className="text-xs text-erp-muted col-span-2">
          Created by {existing?.createdByName ?? session.name} on {formatDate(existing?.createdAt ?? defaultDate)}
          {existing?.modifiedAt ? ` · Modified by ${existing.modifiedByName ?? '—'} on ${formatDate(existing.modifiedAt)}` : ''}
          {' · Version 1'}
        </p>
      ) : null}
    </>
  )

  const tabContent: Record<string, ReactNode> = {
    general: generalTab,
    lines: (
      <>
        {linesEssentials}
        <ErpCardSection
          title="Line items"
          subtitle="Items, quantities, warehouses, and required dates"
          className="col-span-2"
          badge={isCreate ? (
            <ErpButton type="button" variant="secondary" size="sm" onClick={addLine}>Add line</ErpButton>
          ) : undefined}
        >
          <div className="col-span-2">
            <PrLineItemsGrid
              lines={lines}
              onChange={setLines}
              locationOptions={locationOptions}
              warehouseOptions={warehouseOptions}
              stockByItem={stockByItem}
              readOnly={isView}
              compact={isCreate}
            />
          </div>
        </ErpCardSection>
      </>
    ),
    planning: (
      <ErpCardSection title="Planning" subtitle="Scheduling and demand references">
        <ErpFieldRow label="Required Date">
          {isView ? purchaseReadonlyValue(formatDate(requiredDate)) : <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Need By">
          {isView ? purchaseReadonlyValue(formatDate(requiredDate)) : <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Work Order" readOnly>
          {purchaseReadonlyValue(existing?.workOrderNo ?? '—')}
        </ErpFieldRow>
        <ErpFieldRow label="MRP" readOnly>
          {purchaseReadonlyValue(existing?.mrpRunId ?? '—')}
        </ErpFieldRow>
        <ErpFieldRow label="Project">
          {isView ? purchaseReadonlyValue(project || '—') : <Input value={project} onChange={(e) => setProject(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Buyer" readOnly>
          {purchaseReadonlyValue(buyer)}
        </ErpFieldRow>
      </ErpCardSection>
    ),
    commercial: (
      <>
        <ErpCardSection title="Commercial terms" subtitle="Payment, incoterms, and currency">
          <ErpFieldRow label="Payment Terms" readOnly>
            {purchaseReadonlyValue('Net 30')}
          </ErpFieldRow>
          <ErpFieldRow label="Incoterms" readOnly>
            {purchaseReadonlyValue('Ex-Works Pune')}
          </ErpFieldRow>
          <ErpFieldRow label="Currency" readOnly>
            {purchaseReadonlyValue('INR')}
          </ErpFieldRow>
        </ErpCardSection>
        {isView && status === 'approved' && !linkedRfq ? (
          <ErpCardSection title="Create RFQ" subtitle="Select at least two vendors to invite">
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
                Create RFQ
              </ErpButton>
            </div>
          </ErpCardSection>
        ) : null}
        {isView && ['approved', 'submitted'].includes(status) && !linkedPo ? (
          <ErpCardSection title="Direct PO" subtitle="Skip RFQ and create a purchase order">
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
          <p className="text-sm text-erp-muted col-span-2">
            RFQ: <TableLink to={`/purchase/rfqs/${linkedRfq.id}`}>{linkedRfq.rfqNo}</TableLink>
          </p>
        ) : null}
        {isView && linkedPo ? (
          <p className="text-sm text-erp-muted col-span-2">
            PO: <TableLink to={`/purchase/orders/${linkedPo.id}`}>{linkedPo.poNo}</TableLink>
          </p>
        ) : null}
      </>
    ),
    dimensions: (
      <ErpCardSection title="Dimensions" subtitle="Cost centre, department, and budget code">
        <ErpFieldRow label="Cost Center">
          {isView ? purchaseReadonlyValue(costCenter) : <Input value={costCenter} onChange={(e) => setCostCenter(e.target.value)} />}
        </ErpFieldRow>
        <ErpFieldRow label="Department">
          {isView ? purchaseReadonlyValue(department) : (
            <ErpSmartSelect
              compact
              options={departmentSelectOptions}
              value={department}
              onChange={(v) => v && setDepartment(v)}
              placeholder="Select department"
            />
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Budget Code">
          {isView ? purchaseReadonlyValue(budgetCode) : <Input value={budgetCode} onChange={(e) => setBudgetCode(e.target.value)} />}
        </ErpFieldRow>
      </ErpCardSection>
    ),
    approval: (
      <ErpCardSection title="Approval" subtitle="Workflow status and sign-off">
        <ErpFieldRow label="Approval Status" readOnly>
          {purchaseReadonlyValue(status === 'submitted' ? 'Pending' : status)}
        </ErpFieldRow>
        <ErpFieldRow label="Pending With" readOnly>
          {purchaseReadonlyValue(status === 'submitted' ? 'Purchase Head' : '—')}
        </ErpFieldRow>
        <ErpFieldRow label="Approved By" readOnly>
          {purchaseReadonlyValue(existing?.approvedByName ?? '—')}
        </ErpFieldRow>
        <ErpFieldRow label="Approved Date" readOnly>
          {purchaseReadonlyValue(existing?.approvedAt ? formatDate(existing.approvedAt) : '—')}
        </ErpFieldRow>
      </ErpCardSection>
    ),
    attachments: (
      <ErpCardSection title="Attachments" subtitle="Supporting documents for this requisition">
        <ul className="text-sm text-erp-muted list-disc pl-5 space-y-1 col-span-2">
          <li>Drawings (link on save)</li>
          <li>Specifications</li>
          <li>Vendor catalogue PDF</li>
          <li>Inspection sheet</li>
        </ul>
      </ErpCardSection>
    ),
    history: (
      <ErpCardSection title="History" subtitle="Document lifecycle events">
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
    ),
  }

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title={isCreate ? 'New Purchase Requisition' : 'Purchase Requisition'}
        description={
          isCreate
            ? 'Capture line items, purpose, and scheduling — save as draft or submit for approval'
            : isView
              ? 'Review requisition details, approval status, and downstream RFQ / PO links'
              : 'Edit requisition header, lines, and commercial details before workflow actions'
        }
        recordNo={isCreate ? 'New' : docNo}
        status={isCreate ? 'Draft' : status}
        statusTone={isCreate ? 'neutral' : purchaseStatusTone(status)}
        owner={existing?.requestedBy ?? session.name}
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
        tabs={isCreate ? undefined : tabs}
        activeTab={isCreate ? undefined : activeTab}
        onTabChange={isCreate ? undefined : setActiveTab}
        validationErrors={errors}
        onSubmit={isView ? undefined : handleSubmit}
        onSaveShortcut={isView ? undefined : () => persist(false)}
        onSaveCloseShortcut={isView ? undefined : () => { persist(false); navigate('/purchase/requisitions') }}
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        stickyFooter={false}
      >
        {isCreate ? (
          <>
            {createSectionNav}
            <div id={purchaseSectionId('lines')}>{tabContent.lines}</div>
            <div id={purchaseSectionId('general')}>{tabContent.general}</div>
            <div id={purchaseSectionId('attachments')}>{tabContent.attachments}</div>
          </>
        ) : (
          tabContent[activeTab] ?? null
        )}
      </PurchaseCardFormShell>
    </>
  )
}

export function PurchaseRequisitionFormPage() {
  return <PurchaseRequisitionDocumentPage />
}

export function PurchaseRequisitionEditPage() {
  return <PurchaseRequisitionDocumentPage />
}

export { ManualPrFormPage } from './ManualPrFormPage'
