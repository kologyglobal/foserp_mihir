import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  Camera,
  ClipboardCheck,
  Download,
  FileText,
  FolderOpen,
  Plus,
  Printer,
  RefreshCw,
  ScanLine,
  Share2,
  SlidersHorizontal,
  Truck,
  UserCheck,
} from 'lucide-react'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'
import { LiveAlertStrip, DocumentLiveRail } from '../../components/live-erp'
import { buildDispatchDocumentAlerts, buildDispatchNextActions, computeDispatchHealth } from '../../utils/liveErpMetrics'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'
import { ApprovalChainPanel } from '../../components/approval/ApprovalChainPanel'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { workflowCreateDispatchPlan } from '../../utils/qrWorkflow'
import { qrValidateDispatchReady } from '../../utils/qrEngine'
import { useQrStore } from '../../store/qrStore'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar, type FilterChip } from '../../components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { Select } from '../../components/forms/Inputs'
import { useUIStore } from '../../store/uiStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { Card } from '../../components/ui/Card'
import { DataTable } from '../../components/tables/DataTable'
import { SearchInput } from '../../components/ui/SearchInput'
import { Badge, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Input, Textarea, MobileInput } from '../../components/forms/Inputs'
import { TransporterQuickCreateField } from '../../components/quick-create/QuickCreateSelect'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { DetailGrid, DetailField, DetailSection } from '../../components/masters/MasterLayouts'
import { useDispatchStore } from '../../store/dispatchStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { useMasterStore } from '../../store/masterStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useInventoryStore } from '../../store/inventoryStore'
import type { DispatchPlan, DispatchReadyCandidate } from '../../types/dispatch'
import { dispatchStatusLabel } from '../../types/dispatch'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { locationDisplayLabel } from '../../utils/locationUtils'
import { cn } from '../../utils/cn'

function Toast({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm rounded-lg border border-erp-border bg-erp-surface px-4 py-2 text-sm text-erp-text shadow-lg">
      {message}
    </div>
  )
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }
  return { toast, show }
}

type DetailTab = 'plan' | 'loading' | 'transport' | 'pod' | 'documents'

function TrailerIdentityEditor({
  plan,
  canEdit,
  onSave,
}: {
  plan: DispatchPlan
  canEdit: boolean
  onSave: (lineId: string, trailerNo: string, chassisNo: string) => void
}) {
  const [draft, setDraft] = useState<Record<string, { trailerNo: string; chassisNo: string }>>({})

  function lineDraft(line: DispatchPlan['lines'][0]) {
    return draft[line.id] ?? { trailerNo: line.trailerNo, chassisNo: line.chassisNo }
  }

  return (
    <div className="mt-6 space-y-4">
      <p className="text-xs font-semibold uppercase text-erp-muted">Trailer Identity</p>
      {plan.lines.map((line, idx) => {
        const d = lineDraft(line)
        return (
          <div key={line.id} className="rounded-lg border border-erp-border p-4">
            <p className="mb-3 text-sm font-medium text-erp-text">
              Unit {idx + 1} · {line.itemCode}
              {line.workOrderNo ? ` · ${line.workOrderNo}` : ''}
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor={`trailer-${line.id}`} className="mb-1 block text-xs text-erp-muted">Trailer Number *</label>
                <Input
                  id={`trailer-${line.id}`}
                  value={d.trailerNo}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [line.id]: { ...d, trailerNo: e.target.value },
                    }))
                  }
                  placeholder="TR-DC-0001-01"
                  disabled={!canEdit}
                />
              </div>
              <div>
                <label htmlFor={`chassis-${line.id}`} className="mb-1 block text-xs text-erp-muted">Chassis Number *</label>
                <Input
                  id={`chassis-${line.id}`}
                  value={d.chassisNo}
                  onChange={(e) =>
                    setDraft((prev) => ({
                      ...prev,
                      [line.id]: { ...d, chassisNo: e.target.value },
                    }))
                  }
                  placeholder="CH-WO-0005-01"
                  disabled={!canEdit}
                />
              </div>
            </div>
            {canEdit && (
              <Button
                size="sm"
                className="mt-3"
                variant="secondary"
                onClick={() => onSave(line.id, d.trailerNo, d.chassisNo)}
              >
                Save Unit {idx + 1}
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function DispatchDashboardPage() {
  const navigate = useNavigate()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savedView, setSavedView] = useState('My View')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const stockMovements = useInventoryStore((s) => s.stockMovements)

  const today = new Date().toISOString().slice(0, 10)
  const candidates = useMemo(
    () => useDispatchStore.getState().getReadyCandidates(),
    [dispatches, workOrders, stockMovements, refreshKey],
  )
  const dispatchInsights = useMemo(() => {
    const active = dispatches.filter((d) => d.status !== 'cancelled')
    const loadingToday = active.filter((d) => d.status === 'loading' && d.plannedDate === today).length
    const dispatchedToday = active.filter((d) => d.dispatchDate === today && ['dispatched', 'in_transit', 'delivered', 'pod_received', 'closed'].includes(d.status)).length
    const podPending = active.filter((d) => ['delivered', 'in_transit', 'dispatched'].includes(d.status) && d.status !== 'pod_received').length
    const delayed = active.filter((d) => d.plannedDate < today && !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status)).length
    return { ready: candidates.length, loadingToday, dispatchedToday, podPending, delayed }
  }, [dispatches, candidates, today, refreshKey])

  const filtered = useMemo(() => {
    let list = [...dispatches]
    if (statusFilter) list = list.filter((d) => d.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (d) =>
          d.dispatchNo.toLowerCase().includes(s) ||
          d.customerName.toLowerCase().includes(s) ||
          d.salesOrderNo.toLowerCase().includes(s) ||
          d.vehicleNo.toLowerCase().includes(s) ||
          d.lrNo.toLowerCase().includes(s),
      )
    }
    return list
  }, [dispatches, statusFilter, search, refreshKey])

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []
    if (statusFilter) chips.push({ id: 'status', label: dispatchStatusLabel(statusFilter as DispatchPlan['status']) })
    if (search) chips.push({ id: 'search', label: `Search: ${search}` })
    return chips
  }, [statusFilter, search])

  function openQuickView(plan: DispatchPlan) {
    setSelectedRowId(plan.id)
    const trailerNos = plan.lines.map((l) => l.trailerNo).filter(Boolean).join(', ') || '—'
    openDetailPanel({
      title: plan.dispatchNo,
      subtitle: `${plan.customerName} · ${plan.salesOrderNo}`,
      fields: [
        { label: 'Customer', value: plan.customerName },
        { label: 'Sales Order', value: plan.salesOrderNo },
        { label: 'Product', value: plan.productCode },
        { label: 'Status', value: dispatchStatusLabel(plan.status) },
        { label: 'Planned Date', value: formatDate(plan.plannedDate) },
        { label: 'Vehicle', value: plan.vehicleNo || '—' },
        { label: 'LR No', value: plan.lrNo || '—' },
        { label: 'Trailer No', value: trailerNos },
        { label: 'Transporter', value: plan.transporter || '—' },
      ],
      links: [{ label: 'Open Dispatch', href: `/dispatch/${plan.id}` }],
      timeline: [{ id: 'planned', label: dispatchStatusLabel(plan.status), time: formatDate(plan.plannedDate), status: 'current' }],
    })
  }

  const columns: ColumnDef<DispatchPlan, unknown>[] = [
    {
      accessorKey: 'dispatchNo',
      header: 'Dispatch No',
      cell: ({ row }) => (
        <Link to={`/dispatch/${row.original.id}`} className="font-mono text-xs font-medium text-erp-primary hover:underline">
          {row.original.dispatchNo}
        </Link>
      ),
    },
    { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrderNo}</span> },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productCode', header: 'Product', cell: ({ row }) => <span className="font-mono text-xs">{row.original.productCode}</span> },
    { accessorKey: 'vehicleNo', header: 'Vehicle', cell: ({ row }) => row.original.vehicleNo || '—' },
    {
      id: 'trailers',
      header: 'Trailer No',
      cell: ({ row }) => {
        const nos = row.original.lines.map((l) => l.trailerNo).filter(Boolean)
        return nos.length ? nos.join(', ') : '—'
      },
    },
    { accessorKey: 'lrNo', header: 'LR No', cell: ({ row }) => row.original.lrNo || '—' },
    { accessorKey: 'transporter', header: 'Transporter', cell: ({ row }) => row.original.transporter || '—' },
    {
      accessorKey: 'plannedDate',
      header: 'Plan Date',
      cell: ({ row }) => formatDate(row.original.plannedDate),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot label={row.original.status} tone={statusToneFromLabel(row.original.status)} />
      ),
    },
  ]

  return (
    <OperationalPageShell
      title="Dispatch Register"
      description="Dispatch planning, loading checklist, trailer identity, transport details, and customer POD"
      favoritePath="/dispatch/register"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={Plus} label="New Dispatch" onClick={() => navigate('/dispatch/plan')} primary />
            <CommandBarButton icon={ClipboardCheck} label="Dispatch Plan" onClick={() => navigate('/dispatch/plan')} />
            <CommandBarButton icon={Download} label="Export" onClick={() => undefined} />
            <CommandBarButton icon={Printer} label="Print" onClick={() => window.print()} />
            <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => setRefreshKey((k) => k + 1)} />
          </CommandBarGroup>
          <CommandBarGroup label="Views">
            <CommandBarButton icon={SlidersHorizontal} label="Save View" onClick={() => setSavedView('My View')} />
            <CommandBarButton icon={Share2} label="Share View" onClick={() => undefined} />
          </CommandBarGroup>
        </CommandBar>
      }
      insights={[
        { label: 'Ready To Dispatch', value: dispatchInsights.ready, accent: 'green' },
        { label: 'Loading Today', value: dispatchInsights.loadingToday, accent: 'blue' },
        { label: 'Dispatched Today', value: dispatchInsights.dispatchedToday, accent: 'slate' },
        { label: 'POD Pending', value: dispatchInsights.podPending, accent: dispatchInsights.podPending > 0 ? 'amber' : 'green' },
        { label: 'Delayed Deliveries', value: dispatchInsights.delayed, accent: dispatchInsights.delayed > 0 ? 'red' : 'green' },
      ]}
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={(id) => { if (id === 'status') setStatusFilter(''); if (id === 'search') setSearch('') }}
          onClearAll={() => { setStatusFilter(''); setSearch('') }}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={filtered.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search dispatches…" className="w-full sm:w-64" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40 text-[13px]">
            <option value="">All Statuses</option>
            <option value="planned">Planned</option>
            <option value="loading">Loading</option>
            <option value="dispatched">Dispatched</option>
            <option value="in_transit">In Transit</option>
            <option value="delivered">Delivered</option>
            <option value="pod_received">POD Received</option>
          </Select>
        </SmartFilterBar>
      }
    >
      <DataTable
        data={filtered}
        columns={columns}
        stickyFirstColumn
        zebra
        showToolbar={false}
        selectedRowId={selectedRowId}
        onRowSelect={(row) => setSelectedRowId(row.id)}
        onRowQuickView={openQuickView}
        emptyMessage="No dispatches match your filters."
        emptyAction={
          <Button size="sm" onClick={() => navigate('/dispatch/plan')}>
            <Plus className="h-4 w-4" /> Create Dispatch Plan
          </Button>
        }
        exportFileName="dispatch-register"
      />
    </OperationalPageShell>
  )
}

// ─── Dispatch Plan (create from FG-ready WOs) ────────────────────────────────

export function DispatchPlanPage() {
  const navigate = useNavigate()
  const { toast, show } = useToast()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const dispatches = useDispatchStore((s) => s.dispatches)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const stockMovements = useInventoryStore((s) => s.stockMovements)
  const [search, setSearch] = useState('')
  const [savedView, setSavedView] = useState('My View')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const today = new Date().toISOString().slice(0, 10)
  const candidates = useMemo(
    () => useDispatchStore.getState().getReadyCandidates(),
    [dispatches, workOrders, stockMovements, refreshKey],
  )

  const dispatchInsights = useMemo(() => {
    const active = dispatches.filter((d) => d.status !== 'cancelled')
    const loadingToday = active.filter((d) => d.status === 'loading' && d.plannedDate === today).length
    const dispatchedToday = active.filter((d) => d.dispatchDate === today && ['dispatched', 'in_transit', 'delivered', 'pod_received', 'closed'].includes(d.status)).length
    const podPending = active.filter((d) => ['delivered', 'in_transit', 'dispatched'].includes(d.status) && d.status !== 'pod_received').length
    const delayed = active.filter((d) => d.plannedDate < today && !['delivered', 'pod_received', 'closed', 'cancelled'].includes(d.status)).length
    return { ready: candidates.length, loadingToday, dispatchedToday, podPending, delayed }
  }, [dispatches, candidates, today, refreshKey])

  const filtered = useMemo(() => {
    if (!search) return candidates
    const s = search.toLowerCase()
    return candidates.filter(
      (c) =>
        c.salesOrderNo.toLowerCase().includes(s) ||
        c.customerName.toLowerCase().includes(s) ||
        c.workOrderNo.toLowerCase().includes(s) ||
        c.productName.toLowerCase().includes(s),
    )
  }, [candidates, search, refreshKey])

  function openCandidateQuickView(candidate: DispatchReadyCandidate) {
    setSelectedRowId(candidate.workOrderId)
    openDetailPanel({
      title: candidate.workOrderNo,
      subtitle: `${candidate.customerName} · ${candidate.salesOrderNo}`,
      fields: [
        { label: 'Customer', value: candidate.customerName },
        { label: 'Sales Order', value: candidate.salesOrderNo },
        { label: 'Product', value: candidate.productName },
        { label: 'WO Qty', value: formatNumber(candidate.woQty) },
        { label: 'FG Stock', value: formatNumber(candidate.fgOnHand) },
        { label: 'Destination', value: candidate.destination },
        { label: 'Required Date', value: formatDate(candidate.requiredDate) },
      ],
      links: [{ label: 'Work Order', href: `/work-orders/${candidate.workOrderId}` }],
      timeline: [{ id: 'ready', label: 'Ready for Dispatch', time: formatDate(candidate.requiredDate), status: 'current' }],
    })
  }

  const columns: ColumnDef<DispatchReadyCandidate, unknown>[] = [
    { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrderNo}</span> },
    { accessorKey: 'customerName', header: 'Customer' },
    { accessorKey: 'productName', header: 'Product' },
    { accessorKey: 'workOrderNo', header: 'FG WO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.workOrderNo}</span> },
    { accessorKey: 'woQty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.woQty), meta: { align: 'right' } },
    { accessorKey: 'fgOnHand', header: 'FG Stock', cell: ({ row }) => formatNumber(row.original.fgOnHand), meta: { align: 'right' } },
    { accessorKey: 'destination', header: 'Destination' },
    {
      accessorKey: 'requiredDate',
      header: 'Required',
      cell: ({ row }) => formatDate(row.original.requiredDate),
    },
  ]

  return (
    <>
      <Toast message={toast} />
      <OperationalPageShell
        title="Dispatch Planning"
        description="FG work orders with stock in FG Yard — ready for dispatch planning"
        favoritePath="/dispatch/plan"
        commandBar={
          <CommandBar>
            <CommandBarGroup label="Actions">
              <CommandBarButton icon={ArrowLeft} label="Back to Register" onClick={() => navigate('/dispatch/register')} />
              <CommandBarButton icon={RefreshCw} label="Refresh" onClick={() => setRefreshKey((k) => k + 1)} />
              <CommandBarButton icon={Download} label="Export" onClick={() => undefined} />
            </CommandBarGroup>
            <CommandBarGroup label="Views">
              <CommandBarButton icon={SlidersHorizontal} label="Save View" onClick={() => setSavedView('My View')} />
            </CommandBarGroup>
          </CommandBar>
        }
        insights={[
          { label: 'Ready To Dispatch', value: dispatchInsights.ready, accent: 'green' },
          { label: 'Loading Today', value: dispatchInsights.loadingToday, accent: 'blue' },
          { label: 'Dispatched Today', value: dispatchInsights.dispatchedToday, accent: 'slate' },
          { label: 'POD Pending', value: dispatchInsights.podPending, accent: dispatchInsights.podPending > 0 ? 'amber' : 'green' },
          { label: 'Delayed Deliveries', value: dispatchInsights.delayed, accent: dispatchInsights.delayed > 0 ? 'red' : 'green' },
        ]}
        filterBar={
          <SmartFilterBar
            chips={search ? [{ id: 'search', label: `Search: ${search}` }] : []}
            onRemoveChip={() => setSearch('')}
            onClearAll={() => setSearch('')}
            savedView={savedView}
            onSavedViewChange={setSavedView}
            resultCount={filtered.length}
          >
            <SearchInput value={search} onChange={setSearch} placeholder="Search SO, customer, WO…" className="w-full sm:w-64" />
          </SmartFilterBar>
        }
      >
        <DataTable
          data={filtered}
          columns={columns}
          stickyFirstColumn
          zebra
          showToolbar={false}
          selectedRowId={selectedRowId}
          onRowSelect={(row) => setSelectedRowId(row.workOrderId)}
          onRowQuickView={openCandidateQuickView}
          onRowView={(row) => {
            const r = workflowCreateDispatchPlan(row)
            if (r.ok && r.id) {
              show('Dispatch plan created — open to add vehicle & LR')
              navigate(`/dispatch/${r.id}`)
            } else {
              show(r.error ?? 'Failed to create plan')
            }
          }}
          emptyMessage="No trailers ready for dispatch."
          emptyAction={
            <p className="text-sm text-erp-muted">Complete FG work orders and post FG receipt into FG Yard first.</p>
          }
          exportFileName="dispatch-planning"
        />
      </OperationalPageShell>
    </>
  )
}

// ─── Dispatch Detail ─────────────────────────────────────────────────────────

export function DispatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  useQuickCreate()
  const { toast, show } = useToast()
  const [tab, setTab] = useState<DetailTab>('plan')
  const dispatches = useDispatchStore((s) => s.dispatches)
  const invoices = useInvoiceStore((s) => s.invoices)
  const locations = useMasterStore((s) => s.locations)

  const plan = useMemo(
    () => (id ? useDispatchStore.getState().getDispatch(id) : undefined),
    [id, dispatches, invoices],
  )
  const planLocation = useMemo(
    () => (plan?.locationId ? locations.find((l) => l.id === plan.locationId) : undefined),
    [plan?.locationId, locations],
  )

  const fgWoId = plan?.lines[0]?.workOrderId
  const trailerQr = useQrStore((s) =>
    fgWoId ? s.getForEntity('FINISHED_TRAILER', fgWoId)[0] : undefined,
  )

  const existingInvoice = useMemo(
    () => (id ? useInvoiceStore.getState().getInvoiceByDispatch(id) : undefined),
    [id, invoices],
  )

  const updateLogistics = useDispatchStore((s) => s.updateLogistics)
  const updateLineIdentity = useDispatchStore((s) => s.updateLineIdentity)
  const toggleChecklistItem = useDispatchStore((s) => s.toggleChecklistItem)
  const addPhoto = useDispatchStore((s) => s.addPhoto)
  const removePhoto = useDispatchStore((s) => s.removePhoto)
  const markLoading = useDispatchStore((s) => s.markLoading)
  const approveSecurityGate = useDispatchStore((s) => s.approveSecurityGate)
  const closeDispatch = useDispatchStore((s) => s.closeDispatch)
  const markInTransit = useDispatchStore((s) => s.markInTransit)
  const recordCustomerAck = useDispatchStore((s) => s.recordCustomerAck)
  const cancelDispatch = useDispatchStore((s) => s.cancelDispatch)
  const createFromDispatch = useInvoiceStore((s) => s.createFromDispatch)

  const [vehicleNo, setVehicleNo] = useState('')
  const [lrNo, setLrNo] = useState('')
  const [transporter, setTransporter] = useState('')
  const [driverName, setDriverName] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [photoLabel, setPhotoLabel] = useState('Loading photo')
  const [ackName, setAckName] = useState('')
  const [ackDesignation, setAckDesignation] = useState('')
  const [ackDate, setAckDate] = useState(new Date().toISOString().slice(0, 10))
  const [ackRemarks, setAckRemarks] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const ackPhotoRef = useRef<HTMLInputElement>(null)
  const [ackPhotoDataUrl, setAckPhotoDataUrl] = useState<string | null>(null)

  if (!plan) {
    return (
      <div className="p-8 text-center text-slate-500">
        Dispatch not found.{' '}
        <Link to="/dispatch/register" className="text-erp-accent hover:underline">
          Back to register
        </Link>
      </div>
    )
  }

  const checklistDone = plan.checklist.filter((c) => c.passed).length
  const missingChecklist = plan.checklist.filter((c) => c.mandatory && !c.passed)
  const dispatchQrReady = qrValidateDispatchReady(plan.id).ok
  const canEditLogistics = !['dispatched', 'in_transit', 'delivered', 'cancelled'].includes(plan.status)
  const canConfirm = ['planned', 'loading'].includes(plan.status)
  const canAck = ['dispatched', 'in_transit', 'delivered'].includes(plan.status)
  const canApproveGate = canConfirm && !plan.gatePass?.securityApprovedBy
  const canClose = plan.status === 'pod_received'

  const dispatchAlerts = buildDispatchDocumentAlerts(plan)
  const dispatchHealth = computeDispatchHealth(plan)
  const dispatchNextActions = buildDispatchNextActions(plan)
  const dispatchStatusMessage =
    missingChecklist.length > 0 && ['planned', 'loading'].includes(plan.status)
      ? `${missingChecklist.length} checklist item(s) blocking dispatch`
      : ['dispatched', 'in_transit', 'delivered'].includes(plan.status) && !plan.customerAck
        ? 'POD confirmation pending from customer'
        : undefined

  function saveLogistics() {
    const r = updateLogistics(plan!.id, {
      vehicleNo: vehicleNo || plan!.vehicleNo,
      lrNo: lrNo || plan!.lrNo,
      transporter: transporter || plan!.transporter,
      driverName: driverName || plan!.driverName,
      driverPhone: driverPhone || plan!.driverPhone,
    })
    show(r.ok ? 'Logistics saved' : r.error ?? 'Save failed')
  }

  function handlePhotoUpload(file: File | undefined) {
    if (!file || !id) return
    const reader = new FileReader()
    reader.onload = () => {
      const r = addPhoto(id, photoLabel, reader.result as string)
      show(r.ok ? 'Photo added' : r.error ?? 'Failed')
    }
    reader.readAsDataURL(file)
  }

  const tabs: { id: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'plan', label: 'Dispatch Planning', icon: FileText },
    { id: 'loading', label: 'Loading Checklist', icon: ClipboardCheck },
    { id: 'transport', label: 'Transport Details', icon: Truck },
    { id: 'pod', label: 'Customer POD', icon: UserCheck },
    { id: 'documents', label: 'Documents', icon: FolderOpen },
  ]

  return (
    <div>
      <Toast message={toast} />
      <PageHeader
        title={plan.dispatchNo}
        description={`${plan.customerName} · ${plan.productName} · SO ${plan.salesOrderNo}`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to="/dispatch/register">
              <Button variant="secondary" size="sm">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            {plan.gatePass?.gatePassNo && (
              <Link to={`/dispatch/${plan.id}/gate-pass`}>
                <Button size="sm" variant="secondary">Print Gate Pass</Button>
              </Link>
            )}
            {canApproveGate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  saveLogistics()
                  const r = approveSecurityGate(plan.id)
                  show(r.ok ? `Gate pass ${useDispatchStore.getState().getDispatch(plan.id)?.gatePass?.gatePassNo}` : r.error ?? 'Gate approval failed')
                }}
              >
                Approve Security Gate
              </Button>
            )}
            {canConfirm && (
              <>
                <Button variant="secondary" size="sm" onClick={() => { const r = markLoading(plan.id); show(r.ok ? 'Marked loading' : r.error ?? '') }}>
                  Start Loading
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    navigate(
                      `/scan?mode=Dispatch&dispatchId=${plan.id}${trailerQr ? `&qr=${encodeURIComponent(trailerQr.qrCode)}` : ''}`,
                    )
                  }
                  disabled={!dispatchQrReady}
                  title={!trailerQr ? 'Finished trailer QR required' : 'Scan trailer QR to confirm dispatch'}
                >
                  <ScanLine className="h-4 w-4" /> Scan Trailer QR & Dispatch
                </Button>
              </>
            )}
            {canClose && (
              <Button size="sm" onClick={() => { const r = closeDispatch(plan.id); show(r.ok ? 'Dispatch closed' : r.error ?? 'Close failed') }}>
                Close Dispatch
              </Button>
            )}
            {plan.status === 'dispatched' && (
              <Button size="sm" onClick={() => { const r = markInTransit(plan.id); show(r.ok ? 'In transit' : r.error ?? '') }}>
                Mark In Transit
              </Button>
            )}
            {['dispatched', 'in_transit', 'delivered'].includes(plan.status) && !existingInvoice && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const r = createFromDispatch(plan.id)
                  if (r.ok && r.id) navigate(`/invoices/${r.id}`)
                  else show(r.error ?? 'Failed to create invoice')
                }}
              >
                Create Invoice
              </Button>
            )}
            {existingInvoice && (
              <Link to={`/invoices/${existingInvoice.id}`}>
                <Button size="sm" variant="secondary">
                  View Invoice
                </Button>
              </Link>
            )}
            {canEditLogistics && (
              <Button variant="ghost" size="sm" onClick={() => { const r = cancelDispatch(plan.id); if (r.ok) navigate('/dispatch/register'); else show(r.error ?? '') }}>
                Cancel
              </Button>
            )}
          </div>
        }
      />

      {dispatchAlerts.length > 0 && (
        <div className="mb-4">
          <LiveAlertStrip alerts={dispatchAlerts} />
        </div>
      )}

      <div className="mb-4 max-w-md">
        <DocumentLiveRail
          health={dispatchHealth}
          statusMessage={dispatchStatusMessage}
          statusVariant={dispatchHealth === 'blocked' || dispatchHealth === 'at_risk' ? 'warning' : 'neutral'}
          nextActions={dispatchNextActions}
        />
      </div>

      <EntityQrToolbar
        entityType="DISPATCH"
        entityId={plan.id}
        displayCode={plan.dispatchNo}
        metadata={{ dispatchNo: plan.dispatchNo, customerName: plan.customerName, trailerNo: plan.lines[0]?.trailerNo }}
        payload={{ id: plan.dispatchNo, trailer: plan.lines[0]?.trailerNo }}
        className="mb-4"
      />

      <div className="mb-4">
        <ApprovalChainPanel documentType="dispatch_override" entityId={plan.id} compact />
      </div>

      <SerialGenealogyPanel
        workOrderId={plan.lines[0]?.workOrderId}
        trailerNo={plan.lines[0]?.trailerNo}
        compact
      />

      {canConfirm && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {trailerQr ? (
            <>
              Dispatch requires scanning finished trailer QR <strong>{trailerQr.displayCode}</strong> before confirmation.
              Use <strong>Scan Trailer QR & Dispatch</strong> above.
            </>
          ) : (
            <>Finished trailer QR not found — post FG receipt and pass final QC before dispatch.</>
          )}
        </div>
      )}

      <div className="mb-4 flex items-center gap-3">
        <Badge color={statusColor(plan.status)}>{dispatchStatusLabel(plan.status)}</Badge>
        <span className="text-sm text-slate-500">
          Checklist {checklistDone}/{plan.checklist.length} · Photos {plan.photos.length}
        </span>
      </div>

      <div className="mb-4 flex flex-wrap gap-1 border-b border-erp-border">
        {tabs.map(({ id: tabId, label, icon: Icon }) => (
          <button
            key={tabId}
            type="button"
            onClick={() => setTab(tabId)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              tab === tabId ? 'border-erp-accent text-erp-accent' : 'border-transparent text-slate-500 hover:text-slate-800',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <Card>
        {tab === 'plan' && (
          <div className="p-6">
            <DetailSection title="Dispatch Planning">
              <DetailGrid>
                <DetailField label="Dispatch No" value={plan.dispatchNo} />
                <DetailField label="Sales Order" value={plan.salesOrderNo} />
                <DetailField label="Customer" value={plan.customerName} />
                <DetailField label="Product" value={`${plan.productCode} — ${plan.productName}`} />
                <DetailField label="Destination" value={plan.destination} />
                <DetailField
                  label="Location Code"
                  value={planLocation ? locationDisplayLabel(planLocation) : '—'}
                />
                <DetailField label="Planned Date" value={formatDate(plan.plannedDate)} />
                <DetailField label="Units" value={String(plan.lines.length)} />
                <DetailField label="Movement No" value={plan.movementNo ?? '—'} />
                <DetailField label="Gate Pass" value={plan.gatePass?.gatePassNo ?? '—'} />
                <DetailField label="Security Approved" value={plan.gatePass?.securityApprovedBy ?? '—'} />
                <DetailField label="Dispatched At" value={plan.dispatchedAt ? formatDate(plan.dispatchedAt.slice(0, 10)) : '—'} />
              </DetailGrid>
              <TrailerIdentityEditor
                plan={plan}
                canEdit={canEditLogistics}
                onSave={(lineId, trailerNo, chassisNo) => {
                  const r = updateLineIdentity(plan.id, lineId, { trailerNo, chassisNo })
                  show(r.ok ? 'Trailer identity saved' : r.error ?? 'Save failed')
                }}
              />
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">Dispatch Lines</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-slate-500">
                      <th className="py-2">Unit</th>
                      <th className="py-2">Item</th>
                      <th className="py-2">Trailer No</th>
                      <th className="py-2">Chassis No</th>
                      <th className="py-2">WO</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map((line, idx) => (
                      <tr key={line.id} className="border-b border-erp-border">
                        <td className="py-2">{idx + 1}</td>
                        <td className="py-2 font-mono text-xs">{line.itemCode}</td>
                        <td className="py-2 font-mono text-xs">{line.trailerNo || '—'}</td>
                        <td className="py-2 font-mono text-xs">{line.chassisNo || '—'}</td>
                        <td className="py-2 font-mono text-xs">{line.workOrderNo ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </DetailSection>
          </div>
        )}

        {tab === 'loading' && (
          <div>
            <div className="border-b border-erp-border px-6 py-3 text-sm text-slate-600">
              Complete all loading checks before confirming dispatch. Loading photos required ({plan.photos.length} uploaded).
            </div>
            <div className="divide-y divide-erp-border">
              {plan.checklist.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 px-6 py-4 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={item.passed}
                    disabled={!canEditLogistics && !canConfirm}
                    onChange={(e) => {
                      toggleChecklistItem(plan.id, item.id, e.target.checked)
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <p className={cn('text-sm font-medium', item.passed ? 'text-emerald-700' : 'text-slate-800')}>
                      {item.label}
                    </p>
                    {item.notes && <p className="mt-1 text-xs text-slate-500">{item.notes}</p>}
                  </div>
                </label>
              ))}
            </div>
            <div className="border-t border-erp-border p-6">
              <p className="mb-3 text-xs font-semibold uppercase text-slate-500">Loading Photos</p>
              {canEditLogistics || canConfirm ? (
                <div className="mb-6 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Photo label</label>
                    <Input value={photoLabel} onChange={(e) => setPhotoLabel(e.target.value)} className="w-48" />
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
                  />
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-4 w-4" />
                    Upload Loading Photo
                  </Button>
                </div>
              ) : null}
              {plan.photos.length === 0 ? (
                <p className="text-sm text-slate-500">No loading photos yet — required before dispatch confirmation.</p>
              ) : (
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {plan.photos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-lg border border-erp-border">
                      <img src={photo.dataUrl} alt={photo.label} className="aspect-video w-full object-cover" />
                      <div className="flex items-center justify-between p-2 text-xs">
                        <span className="font-medium">{photo.label}</span>
                        {(canEditLogistics || canConfirm) && (
                          <button
                            type="button"
                            className="text-red-600 hover:underline"
                            onClick={() => removePhoto(plan.id, photo.id)}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === 'transport' && (
          <div className="space-y-4 p-6">
            {!canEditLogistics && (
              <p className="text-sm text-amber-700">Transport details locked after dispatch confirmation.</p>
            )}
            <p className="text-sm text-slate-600">
              Vehicle, transporter, driver, and LR number — required before loading and dispatch.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-slate-500">Vehicle No *</label>
                <Input
                  value={vehicleNo || plan.vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="MH-12-AB-1234"
                  disabled={!canEditLogistics}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">LR Number *</label>
                <Input
                  value={lrNo || plan.lrNo}
                  onChange={(e) => setLrNo(e.target.value)}
                  placeholder="LR-2026-004521"
                  disabled={!canEditLogistics}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Transporter *</label>
                <TransporterQuickCreateField
                  value={transporter || plan.transporter}
                  onChange={setTransporter}
                  disabled={!canEditLogistics}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Driver Name *</label>
                <Input
                  value={driverName || plan.driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Driver full name"
                  disabled={!canEditLogistics}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-slate-500">Driver Phone</label>
                <MobileInput
                  value={driverPhone || plan.driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  disabled={!canEditLogistics}
                />
              </div>
            </div>
            {canEditLogistics && (
              <Button size="sm" onClick={saveLogistics}>
                Save Transport Details
              </Button>
            )}
          </div>
        )}

        {tab === 'pod' && (
          <div className="p-6">
            <p className="mb-4 text-sm text-slate-600">
              Proof of Delivery — customer sign-off after trailer receipt at destination.
            </p>
            {plan.customerAck ? (
              <DetailGrid>
                <DetailField label="Received By" value={plan.customerAck.acknowledgedBy} />
                <DetailField label="Designation" value={plan.customerAck.designation || '—'} />
                <DetailField label="POD Date" value={formatDate(plan.customerAck.ackDate)} />
                <DetailField label="Remarks" value={plan.customerAck.remarks || '—'} />
                <DetailField label="Recorded" value={formatDate(plan.customerAck.recordedAt.slice(0, 10))} />
              </DetailGrid>
            ) : canAck ? (
              <div className="max-w-lg space-y-4">
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Received By *</label>
                  <Input value={ackName} onChange={(e) => setAckName(e.target.value)} placeholder="Customer representative name" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Designation</label>
                  <Input value={ackDesignation} onChange={(e) => setAckDesignation(e.target.value)} placeholder="Plant Manager / Store In-charge" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">POD Date *</label>
                  <Input type="date" value={ackDate} onChange={(e) => setAckDate(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Remarks</label>
                  <Textarea value={ackRemarks} onChange={(e) => setAckRemarks(e.target.value)} rows={3} placeholder="Condition on receipt, seal intact, etc." />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">POD Photo (optional)</label>
                  <input
                    ref={ackPhotoRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const reader = new FileReader()
                      reader.onload = () => setAckPhotoDataUrl(reader.result as string)
                      reader.readAsDataURL(file)
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={() => ackPhotoRef.current?.click()}>
                    <Camera className="h-4 w-4" />
                    Upload POD Photo
                  </Button>
                  {ackPhotoDataUrl && (
                    <img src={ackPhotoDataUrl} alt="POD" className="mt-2 max-h-40 rounded border" />
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    const r = recordCustomerAck(plan.id, {
                      acknowledgedBy: ackName,
                      designation: ackDesignation,
                      ackDate,
                      remarks: ackRemarks,
                      signatureDataUrl: null,
                      photoDataUrl: ackPhotoDataUrl,
                    })
                    show(r.ok ? 'Customer POD recorded — delivered' : r.error ?? 'Failed')
                  }}
                >
                  <UserCheck className="h-4 w-4" />
                  Record Customer POD
                </Button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">
                Customer POD is available after dispatch is confirmed.
              </p>
            )}
            {plan.customerAck?.photoDataUrl && (
              <div className="mt-6">
                <p className="mb-2 text-xs font-semibold uppercase text-slate-500">POD Photo</p>
                <img src={plan.customerAck.photoDataUrl} alt="POD" className="max-h-64 rounded border" />
              </div>
            )}
          </div>
        )}
        {tab === 'documents' && (
          <div className="p-2">
            <EntityDocumentsPanel entityType="dispatch" entityId={plan.id} showHubLink />
          </div>
        )}
      </Card>
    </div>
  )
}
