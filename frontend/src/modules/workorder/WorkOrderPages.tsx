import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowLeft,
  Bookmark,
  Box,
  CheckCircle,
  Clock,
  Download,
  Layers,
  Package,
  Play,
  Printer,
  RefreshCw,
  Send,
  Share2,
  SlidersHorizontal,
  Truck,
  ListOrdered,
  Calculator,
} from 'lucide-react'
import { DataTable } from '../../components/tables/DataTable'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar, type FilterChip } from '../../components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { Select } from '../../components/forms/Inputs'
import { DocumentHeader } from '../../components/design-system/DocumentExperience'
import { PageHeader } from '../../components/ui/PageHeader'
import { DocumentLayout, FactBox, FactBoxPanel } from '../../components/design-system/FactBox'
import { Card } from '../../components/ui/Card'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useUIStore } from '../../store/uiStore'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { AppLink } from '../../components/ui/AppLink'
import type {
  FgReceipt,
  SaReceipt,
  SubcontractShipment,
  WorkOrder,
  WorkOrderActivity,
  WorkOrderMaterialLine,
  WoCreationMode,
} from '../../types/workorder'
import { isWoEditable } from '../../types/workorder'
import { JobCardPanel } from '../../components/production/JobCardPanel'
import { WipFlowPanel } from '../../components/production/WipFlowPanel'
import { resolveWipFlowStep, buildWipFlowStepsForWo } from '../../utils/wipFlow'
import { resolveSaReceiptWarehouseCode } from '../../utils/saReceipt'
import { workflowPostFgReceipt, workflowPostSaReceipt } from '../../utils/qrWorkflow'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'
import { useWorkCenterStore } from '../../store/workCenterStore'
import { useWorkOrderInspections, useWorkOrderReworks } from '../../hooks/useStableStoreData'
import { canStartOperation } from '../../utils/qualityEngine'
import { WorkOrderCostPanel } from '../../components/costing/WorkOrderCostPanel'
import { useProductionWorkspaceMetrics } from '../../utils/workspaceMetrics'

function woTypeLabel(t: WorkOrder['woType']): string {
  if (t === 'finished_goods') return 'Finished Goods WO'
  if (t === 'manufactured_sub_assembly') return 'Manufactured Sub-Assembly WO'
  return 'Subcontract WO'
}

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

const WO_STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'planned', label: 'Planned' },
  { value: 'released', label: 'Released' },
  { value: 'in_production', label: 'In Production' },
  { value: 'completed', label: 'Completed' },
  { value: 'closed', label: 'Closed' },
]

const WO_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'finished_goods', label: 'Finished Goods' },
  { value: 'manufactured_sub_assembly', label: 'Sub-Assembly' },
  { value: 'subcontract', label: 'Subcontract' },
]

export function WorkOrderListPage() {
  const navigate = useNavigate()
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const runs = useMrpStore((s) => s.runs)
  const pm = useProductionWorkspaceMetrics()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [savedView, setSavedView] = useState('My View')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const openWoCount = useMemo(
    () => workOrders.filter((w) => !['closed', 'cancelled', 'completed', 'fg_received'].includes(w.status)).length,
    [workOrders, refreshKey],
  )
  const releasedCount = useMemo(
    () => workOrders.filter((w) => w.status === 'released').length,
    [workOrders, refreshKey],
  )
  const inProductionCount = useMemo(
    () => workOrders.filter((w) => w.status === 'in_production').length,
    [workOrders, refreshKey],
  )

  const filtered = useMemo(() => {
    let list = [...workOrders]
    if (statusFilter) list = list.filter((w) => w.status === statusFilter)
    if (typeFilter) list = list.filter((w) => w.woType === typeFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (w) =>
          w.woNo.toLowerCase().includes(s) ||
          w.outputItemCode.toLowerCase().includes(s) ||
          w.salesOrderNo.toLowerCase().includes(s),
      )
    }
    return list
  }, [workOrders, statusFilter, typeFilter, search, refreshKey])

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []
    if (statusFilter) chips.push({ id: 'status', label: formatStatus(statusFilter) })
    if (typeFilter) chips.push({ id: 'type', label: WO_TYPE_OPTIONS.find((t) => t.value === typeFilter)?.label ?? typeFilter })
    if (search) chips.push({ id: 'search', label: `Search: ${search}` })
    return chips
  }, [statusFilter, typeFilter, search])

  function removeChip(id: string) {
    if (id === 'status') setStatusFilter('')
    if (id === 'type') setTypeFilter('')
    if (id === 'search') setSearch('')
  }

  function clearFilters() {
    setStatusFilter('')
    setTypeFilter('')
    setSearch('')
  }

  function openQuickView(wo: WorkOrder) {
    setSelectedRowId(wo.id)
    openDetailPanel({
      title: wo.woNo,
      subtitle: `${woTypeLabel(wo.woType)} · ${wo.outputItemCode}`,
      fields: [
        { label: 'Sales Order', value: wo.salesOrderNo },
        { label: 'Output Item', value: wo.outputItemCode },
        { label: 'Quantity', value: formatNumber(wo.qty) },
        { label: 'Status', value: formatStatus(wo.status) },
        { label: 'Planned Start', value: formatDate(wo.plannedStartDate) },
        { label: 'Planned Finish', value: formatDate(wo.plannedFinishDate) },
        { label: 'BOM Revision', value: wo.bomRevision },
      ],
      timeline: [
        { id: 'created', label: 'Created', time: formatDate(wo.createdAt.slice(0, 10)), status: 'done' },
        { id: 'current', label: formatStatus(wo.status), time: formatDate(wo.updatedAt.slice(0, 10)), status: 'current' },
      ],
      links: [
        { label: 'Open Work Order', href: `/work-orders/${wo.id}` },
        { label: 'Sales Order', href: `/sales/orders/${wo.salesOrderId}` },
      ],
    })
  }

  const columns: ColumnDef<WorkOrder, unknown>[] = [
    {
      accessorKey: 'woNo',
      header: 'WO No',
      cell: ({ row }) => (
        <Link to={`/work-orders/${row.original.id}`} className="font-mono text-xs font-medium text-erp-primary hover:underline">
          {row.original.woNo}
        </Link>
      ),
    },
    {
      accessorKey: 'woType',
      header: 'Type',
      cell: ({ row }) => <span className="text-xs">{woTypeLabel(row.original.woType)}</span>,
    },
    {
      accessorKey: 'outputItemCode',
      header: 'Output',
      cell: ({ row }) => <span className="font-mono text-xs">{row.original.outputItemCode}</span>,
    },
    { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <span className="font-mono text-xs">{row.original.salesOrderNo}</span> },
    { accessorKey: 'qty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.qty), meta: { align: 'right' } },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot label={row.original.status} tone={statusToneFromLabel(row.original.status)} />
      ),
    },
    {
      accessorKey: 'plannedFinishDate',
      header: 'Finish',
      cell: ({ row }) => formatDate(row.original.plannedFinishDate),
    },
    { accessorKey: 'bomRevision', header: 'BOM Rev', cell: ({ row }) => row.original.bomRevision },
  ]

  const createAction = runs.length > 0 ? (
    <Link to={`/work-orders/create-from-mrp?run=${runs[0].id}`}>
      <Button size="sm"><Layers className="h-4 w-4" /> Create from MRP</Button>
    </Link>
  ) : (
    <Link to="/mrp/run">
      <Button size="sm" variant="secondary"><Layers className="h-4 w-4" /> Run MRP First</Button>
    </Link>
  )

  return (
    <OperationalPageShell
      title="Work Orders"
      description="Manufacturing control between MRP and shop floor — reservation, issue, production, FG receipt"
      favoritePath="/work-orders"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            {runs.length > 0 ? (
              <CommandBarButton icon={Layers} label="Create from MRP" onClick={() => navigate(`/work-orders/create-from-mrp?run=${runs[0].id}`)} primary />
            ) : (
              <CommandBarButton icon={Layers} label="Run MRP First" onClick={() => navigate('/mrp/run')} primary />
            )}
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
        { label: 'Open WO', value: openWoCount, accent: 'blue' },
        { label: 'Released WO', value: releasedCount, accent: 'green' },
        { label: 'In Production', value: inProductionCount, accent: 'slate' },
        { label: 'QC Hold', value: pm.qcHolds, accent: pm.qcHolds > 0 ? 'amber' : 'green' },
        { label: 'Delayed WO', value: pm.late, accent: pm.late > 0 ? 'red' : 'green' },
      ]}
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={removeChip}
          onClearAll={clearFilters}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={filtered.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search WO, output, SO…" className="w-full sm:w-64" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 w-40 text-[13px]">
            {WO_STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
          </Select>
          <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="h-9 w-44 text-[13px]">
            {WO_TYPE_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>{o.label}</option>
            ))}
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
        emptyMessage="No work orders match your filters."
        emptyAction={createAction}
        exportFileName="work-orders"
      />
    </OperationalPageShell>
  )
}

export function CreateWorkOrderFromMrpPage() {
  const [searchParams] = useSearchParams()
  const runId = searchParams.get('run') ?? ''
  const navigate = useNavigate()
  const { toast, show } = useToast()

  const run = useMrpStore((s) => (runId ? s.getRun(runId) : undefined))
  const runs = useMrpStore((s) => s.runs)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const config = useWorkOrderStore((s) => s.config)
  const setConfig = useWorkOrderStore((s) => s.setConfig)
  const createFromMrpRun = useWorkOrderStore((s) => s.createFromMrpRun)
  const existingWos = useWorkOrderStore((s) => s.workOrders)
  const getProduct = useMasterStore((s) => s.getProduct)

  const [soId, setSoId] = useState(run?.salesOrderIds[0] ?? 'so-0001')

  const so = salesOrders.find((s) => s.id === soId)
  const alreadyCreated = existingWos.some((w) => w.salesOrderId === soId && w.mrpRunId === runId)

  function handleCreate() {
    if (!runId) {
      show('Select an MRP run')
      return
    }
    const r = createFromMrpRun(runId, soId)
    if (r.ok && r.woIds?.length) {
      show(`Created ${r.woIds.length} work order(s)`)
      navigate('/work-orders')
    } else {
      show(r.error ?? 'Failed to create work orders')
    }
  }

  return (
    <div>
      <Toast message={toast} />
      <Link to="/work-orders" className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
        <ArrowLeft className="h-4 w-4" /> Back to Work Orders
      </Link>

      <PageHeader
        title="Create Work Orders from MRP"
        description="Generate FG, manufactured sub-assembly, and subcontract WOs from MRP recommendations"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">MRP Run</h3>
          <select
            className="mb-3 w-full rounded-md border border-erp-border px-3 py-2 text-sm"
            value={runId}
            onChange={(e) => navigate(`/work-orders/create-from-mrp?run=${e.target.value}`)}
          >
            <option value="">Select MRP run…</option>
            {runs.map((r) => (
              <option key={r.id} value={r.id}>{r.runNo} — {formatDate(r.runAt.slice(0, 10))}</option>
            ))}
          </select>

          {run && (
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-500">WO requirements:</span> {run.woRequirements.length}</p>
              <p><span className="text-slate-500">Material lines:</span> {run.materialLines.length}</p>
              <p><span className="text-slate-500">Exceptions:</span> {run.exceptions.length}</p>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 text-sm font-semibold">Sales Order</h3>
          <select
            className="mb-3 w-full rounded-md border border-erp-border px-3 py-2 text-sm"
            value={soId}
            onChange={(e) => setSoId(e.target.value)}
          >
            {salesOrders.map((s) => (
              <option key={s.id} value={s.id}>
                {s.salesOrderNo} — {getProduct(s.productId)?.productName} × {s.qty}
              </option>
            ))}
          </select>
          {so && (
            <p className="text-sm text-slate-600">
              Required by {formatDate(so.requiredDate)} · Customer order for {getProduct(so.productId)?.productName}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <h3 className="mb-3 text-sm font-semibold">WO Creation Rules</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Creation mode</span>
            <select
              className="rounded-md border border-erp-border px-3 py-2"
              value={config.creationMode}
              onChange={(e) => setConfig({ creationMode: e.target.value as WoCreationMode })}
            >
              <option value="per_sub_assembly">Separate WO per manufactured sub-assembly</option>
              <option value="one_per_trailer">One WO per finished trailer</option>
            </select>
          </label>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.createManufacturedSubAssemblyWo} onChange={(e) => setConfig({ createManufacturedSubAssemblyWo: e.target.checked })} />
              Manufactured sub-assemblies (Running Gear, Tank, Chassis)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.createSubcontractWo} onChange={(e) => setConfig({ createSubcontractWo: e.target.checked })} />
              Subcontract WOs (Paint Process)
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={config.createFinishedGoodsWo} onChange={(e) => setConfig({ createFinishedGoodsWo: e.target.checked })} />
              Finished Goods WO (45 M3 Bulker Trailer)
            </label>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Phantom assemblies do not create WO. Purchased items flow to purchase requisition via MRP. Subcontract items create subcontract WO.
        </p>
      </Card>

      {run && so && (
        <Card className="mt-4 p-5">
          <h3 className="mb-2 text-sm font-semibold">Expected WOs (45 M3 Bulker × {so.qty})</h3>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-600">
            {config.createManufacturedSubAssemblyWo && (
              <>
                <li>SA-RUN-GEAR — Running Gear Assembly (manufactured)</li>
                <li>SA-TANK-ASM — Tank Assembly (manufactured)</li>
                <li>SA-CHASSIS — Chassis Assembly (manufactured)</li>
              </>
            )}
            {config.createSubcontractWo && <li>SA-PAINT-SYS — Paint Process (subcontract)</li>}
            {config.createFinishedGoodsWo && <li>FG-BULKER-45 — 45 M3 Bulker Trailer (finished goods)</li>}
          </ul>
          <div className="mt-4 flex gap-2">
            <Button onClick={handleCreate} disabled={alreadyCreated || !runId}>
              {alreadyCreated ? 'Already Created for this MRP Run' : 'Create Work Orders'}
            </Button>
          </div>
        </Card>
      )}
    </div>
  )
}

type DetailTab = 'materials' | 'reservation' | 'issue' | 'operations' | 'subcontract' | 'sa_receipt' | 'fg_receipt' | 'cost' | 'timeline'

const detailTabs: { id: DetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'materials', label: 'Material Requirements', icon: Package },
  { id: 'reservation', label: 'Reservation', icon: Bookmark },
  { id: 'issue', label: 'Material Issue', icon: Send },
  { id: 'operations', label: 'Production Operations', icon: ListOrdered },
  { id: 'cost', label: 'Cost', icon: Calculator },
  { id: 'subcontract', label: 'Subcontract', icon: Truck },
  { id: 'sa_receipt', label: 'SA Receipt', icon: Layers },
  { id: 'fg_receipt', label: 'FG Receipt', icon: Box },
  { id: 'timeline', label: 'Activity Timeline', icon: Clock },
]

export function WorkOrderDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { toast, show } = useToast()
  const tabParam = searchParams.get('tab')
  const initialTab: DetailTab =
    tabParam === 'cost' ||
    tabParam === 'materials' ||
    tabParam === 'reservation' ||
    tabParam === 'issue' ||
    tabParam === 'operations' ||
    tabParam === 'subcontract' ||
    tabParam === 'sa_receipt' ||
    tabParam === 'fg_receipt' ||
    tabParam === 'timeline'
      ? tabParam
      : 'materials'
  const [tab, setTab] = useState<DetailTab>(initialTab)

  const wo = useWorkOrderStore((s) => (id ? s.getWorkOrder(id) : undefined))
  const allMaterialLines = useWorkOrderStore((s) => s.materialLines)
  const allActivities = useWorkOrderStore((s) => s.activities)
  const allShipments = useWorkOrderStore((s) => s.subcontractShipments)
  const allFgReceipts = useWorkOrderStore((s) => s.fgReceipts)
  const allSaReceipts = useWorkOrderStore((s) => s.saReceipts)
  const allWorkOrders = useWorkOrderStore((s) => s.workOrders)
  const allProductionOps = useWorkOrderStore((s) => s.productionOperations)
  const allJobCards = useWorkOrderStore((s) => s.jobCards)
  const woInspections = useWorkOrderInspections(id)
  const woReworks = useWorkOrderReworks(id)

  const planWorkOrder = useWorkOrderStore((s) => s.planWorkOrder)
  const releaseWorkOrder = useWorkOrderStore((s) => s.releaseWorkOrder)
  const reserveMaterials = useWorkOrderStore((s) => s.reserveMaterials)
  const issueMaterialLine = useWorkOrderStore((s) => s.issueMaterialLine)
  const issueAllReserved = useWorkOrderStore((s) => s.issueAllReserved)
  const startJobCard = useWorkOrderStore((s) => s.startJobCard)
  const completeJobCard = useWorkOrderStore((s) => s.completeJobCard)
  const startProduction = useWorkOrderStore((s) => s.startProduction)
  const completeWorkOrder = useWorkOrderStore((s) => s.completeWorkOrder)
  const closeWorkOrder = useWorkOrderStore((s) => s.closeWorkOrder)
  const sendSubcontractMaterial = useWorkOrderStore((s) => s.sendSubcontractMaterial)
  const receiveSubcontractMaterial = useWorkOrderStore((s) => s.receiveSubcontractMaterial)

  const getProduct = useMasterStore((s) => s.getProduct)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const getUomCode = useMasterStore((s) => s.uoms)
  const vendors = useMasterStore((s) => s.vendors)
  const getFreeQty = useInventoryStore((s) => s.getFreeQty)

  const materials = useMemo(
    () => (id ? allMaterialLines.filter((m) => m.workOrderId === id) : []),
    [allMaterialLines, id],
  )
  const activities = useMemo(
    () => (id ? allActivities.filter((a) => a.workOrderId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [allActivities, id],
  )
  const shipments = useMemo(
    () => (id ? allShipments.filter((s) => s.workOrderId === id) : []),
    [allShipments, id],
  )
  const fgReceipts = useMemo(
    () => (id ? allFgReceipts.filter((r) => r.workOrderId === id) : []),
    [allFgReceipts, id],
  )
  const saReceipts = useMemo(
    () => (id ? allSaReceipts.filter((r) => r.sourceWoId === id) : []),
    [allSaReceipts, id],
  )
  const parentWo = useMemo(
    () => (wo?.parentWoId ? allWorkOrders.find((w) => w.id === wo.parentWoId) : undefined),
    [allWorkOrders, wo?.parentWoId],
  )
  const saReceiptPosted = saReceipts.some((r) => r.status === 'posted')
  const productionOps = useMemo(
    () => (id ? allProductionOps.filter((o) => o.workOrderId === id).sort((a, b) => a.sequenceNo - b.sequenceNo) : []),
    [allProductionOps, id],
  )
  const jobCardsByOperationId = useMemo(() => {
    const map = new Map<string, (typeof allJobCards)[number]>()
    if (!id) return map
    for (const jc of allJobCards) {
      if (jc.workOrderId === id) map.set(jc.productionOperationId, jc)
    }
    return map
  }, [allJobCards, id])

  const workCenters = useWorkCenterStore((s) => s.workCenters)
  const saReceiptWarehouseCode = useMemo(() => {
    if (!id || productionOps.length === 0) return 'WIP_ASSEMBLY'
    return resolveSaReceiptWarehouseCode(productionOps, workCenters)
  }, [id, productionOps, workCenters])

  const wipFlowSteps = useMemo(
    () => (productionOps.length > 0 ? buildWipFlowStepsForWo(productionOps, workCenters) : []),
    [productionOps, workCenters],
  )

  const wipFlowStepId = useMemo(
    () => (wo ? resolveWipFlowStep(wo, materials, productionOps, workCenters) : 'rm_store'),
    [wo, materials, productionOps, workCenters],
  )

  const [subForm, setSubForm] = useState({ lineId: '', vendorId: '', challanNo: '', qty: '', expectedReturnDate: '' })
  const [recvForm, setRecvForm] = useState({ shipmentId: '', receivedQty: '', rejectedQty: '' })

  if (!wo) {
    return (
      <div className="py-12 text-center">
        <p className="text-slate-500">Work order not found.</p>
        <Link to="/work-orders" className="mt-2 text-sm text-erp-accent hover:underline">Back</Link>
      </div>
    )
  }

  const editable = isWoEditable(wo.status)
  const uomCode = (uomId: string) => getUomCode.find((u) => u.id === uomId)?.uomCode ?? '—'

  const materialColumns: ColumnDef<WorkOrderMaterialLine, unknown>[] = [
    { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
    { accessorKey: 'itemName', header: 'Name', cell: ({ row }) => getItem(row.original.itemId)?.itemName },
    { accessorKey: 'uomId', header: 'UOM', cell: ({ row }) => uomCode(row.original.uomId) },
    { accessorKey: 'warehouseId', header: 'Issue WH', cell: ({ row }) => getWarehouse(row.original.warehouseId)?.warehouseCode },
    { accessorKey: 'requiredQty', header: 'Required', cell: ({ row }) => formatNumber(row.original.requiredQty) },
    { accessorKey: 'reservedQty', header: 'Reserved', cell: ({ row }) => formatNumber(row.original.reservedQty) },
    { accessorKey: 'issuedQty', header: 'Issued', cell: ({ row }) => formatNumber(row.original.issuedQty) },
    { accessorKey: 'balanceQty', header: 'Balance', cell: ({ row }) => formatNumber(row.original.balanceQty) },
    { accessorKey: 'sourceType', header: 'Source', cell: ({ row }) => row.original.sourceType },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>,
    },
  ]

  const reservationColumns: ColumnDef<WorkOrderMaterialLine, unknown>[] = [
    ...materialColumns.slice(0, 6),
    {
      id: 'free',
      header: 'Free Stock',
      cell: ({ row }) => formatNumber(getFreeQty(row.original.itemId, row.original.warehouseId)),
    },
    {
      id: 'toReserve',
      header: 'To Reserve',
      cell: ({ row }) => formatNumber(Math.max(0, row.original.requiredQty - row.original.reservedQty)),
    },
  ]

  const issueColumns: ColumnDef<WorkOrderMaterialLine, unknown>[] = [
    ...materialColumns.slice(0, 7),
    {
      id: 'pending',
      header: 'Pending Issue',
      cell: ({ row }) => formatNumber(Math.max(0, row.original.reservedQty - row.original.issuedQty)),
    },
    {
      id: 'actions',
      header: 'Issue',
      cell: ({ row }) => {
        const pending = row.original.reservedQty - row.original.issuedQty
        if (pending <= 0 || wo.status === 'closed') return '—'
        return (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              const r = issueMaterialLine(wo.id, row.original.id, pending)
              show(r.ok ? `Issued ${pending} × ${row.original.itemCode}` : r.error ?? 'Issue failed')
            }}
          >
            Issue {formatNumber(pending)}
          </Button>
        )
      },
    },
  ]

  const shipmentColumns: ColumnDef<SubcontractShipment, unknown>[] = [
    { accessorKey: 'challanNo', header: 'Challan No' },
    { accessorKey: 'vendorId', header: 'Vendor', cell: ({ row }) => vendors.find((v) => v.id === row.original.vendorId)?.vendorName ?? '—' },
    { accessorKey: 'itemId', header: 'Item', cell: ({ row }) => getItem(row.original.itemId)?.itemCode },
    { accessorKey: 'sentQty', header: 'Sent', cell: ({ row }) => formatNumber(row.original.sentQty) },
    { accessorKey: 'receivedQty', header: 'Received', cell: ({ row }) => formatNumber(row.original.receivedQty) },
    { accessorKey: 'rejectedQty', header: 'Rejected', cell: ({ row }) => formatNumber(row.original.rejectedQty) },
    { accessorKey: 'expectedReturnDate', header: 'Expected Return', cell: ({ row }) => formatDate(row.original.expectedReturnDate) },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge> },
  ]

  const fgColumns: ColumnDef<FgReceipt, unknown>[] = [
    { accessorKey: 'receiptDate', header: 'Date', cell: ({ row }) => formatDate(row.original.receiptDate) },
    { accessorKey: 'itemId', header: 'FG Item', cell: ({ row }) => getItem(row.original.itemId)?.itemCode },
    { accessorKey: 'warehouseId', header: 'Warehouse', cell: ({ row }) => getWarehouse(row.original.warehouseId)?.warehouseCode },
    { accessorKey: 'qty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.qty) },
    { accessorKey: 'movementNo', header: 'Movement', cell: ({ row }) => row.original.movementNo ?? '—' },
  ]

  const saColumns: ColumnDef<SaReceipt, unknown>[] = [
    { accessorKey: 'receiptDate', header: 'Date', cell: ({ row }) => formatDate(row.original.receiptDate) },
    { accessorKey: 'itemCode', header: 'Output Item', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
    { accessorKey: 'warehouseCode', header: 'Receipt WH' },
    { accessorKey: 'qty', header: 'Qty', cell: ({ row }) => formatNumber(row.original.qty) },
    { accessorKey: 'parentWoNo', header: 'Parent WO', cell: ({ row }) => row.original.parentWoNo ?? '—' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <Badge color={row.original.status === 'posted' ? 'green' : 'gray'}>{formatStatus(row.original.status)}</Badge> },
    { accessorKey: 'movementNo', header: 'Movement', cell: ({ row }) => row.original.movementNo ?? '—' },
  ]

  const timelineColumns: ColumnDef<WorkOrderActivity, unknown>[] = [
    { accessorKey: 'createdAt', header: 'When', cell: ({ row }) => formatDate(row.original.createdAt.slice(0, 10)) },
    { accessorKey: 'action', header: 'Action', cell: ({ row }) => <span className="font-medium">{row.original.action}</span> },
    { accessorKey: 'details', header: 'Details' },
    { accessorKey: 'createdBy', header: 'By' },
  ]

  const materialRequired = materials.reduce((s, m) => s + m.requiredQty, 0)
  const materialIssued = materials.reduce((s, m) => s + m.issuedQty, 0)
  const materialReserved = materials.reduce((s, m) => s + m.reservedQty, 0)

  const docActions = (
    <div className="flex flex-wrap gap-2">
      <Link to="/work-orders">
        <Button size="sm" variant="ghost"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </Link>
      <Link to={`/work-orders/${wo.id}/360`}>
        <Button size="sm" variant="secondary">WO 360</Button>
      </Link>
      {wo.woType === 'subcontract' && (
        <Link to={`/job-work/${wo.id}`}>
          <Button size="sm" variant="secondary">Job Work</Button>
        </Link>
      )}
      {wo.status === 'draft' && (
        <Button size="sm" variant="secondary" onClick={() => { const r = planWorkOrder(wo.id); show(r.ok ? 'Planned' : r.error ?? 'Failed') }}>
          Plan
        </Button>
      )}
      {(wo.status === 'draft' || wo.status === 'planned') && (
        <Button size="sm" onClick={() => { const r = releaseWorkOrder(wo.id); show(r.ok ? 'Released' : r.error ?? 'Failed') }}>
          <Play className="h-4 w-4" /> Release
        </Button>
      )}
      {wo.status === 'released' && materials.length > 0 && (
        <Button size="sm" onClick={() => { const r = reserveMaterials(wo.id); show(r.ok ? `Reserved ${r.reserved ?? 0} units` : r.error ?? 'Failed') }}>
          <Bookmark className="h-4 w-4" /> Reserve Materials
        </Button>
      )}
      {['material_reserved', 'partially_issued'].includes(wo.status) && (
        <Button size="sm" variant="secondary" onClick={() => { const r = issueAllReserved(wo.id); show(r.ok ? `Issued ${r.issued ?? 0} units` : r.error ?? 'Failed') }}>
          Issue All Reserved
        </Button>
      )}
      {['fully_issued', 'material_reserved', 'released'].includes(wo.status) && materials.every((m) => m.requiredQty === 0 || m.issuedQty >= m.requiredQty) && (
        <Button size="sm" onClick={() => { const r = startProduction(wo.id); show(r.ok ? 'Production started' : r.error ?? 'Failed') }}>
          Start Production
        </Button>
      )}
      {wo.status === 'in_production' && (
        <Button size="sm" onClick={() => { const r = completeWorkOrder(wo.id); show(r.ok ? 'Completed' : r.error ?? 'Failed') }}>
          <CheckCircle className="h-4 w-4" /> Complete
        </Button>
      )}
      {wo.woType === 'manufactured_sub_assembly' && wo.status === 'completed' && !saReceiptPosted && (
        <Button size="sm" onClick={() => { const r = workflowPostSaReceipt(wo.id); show(r.ok ? 'Semi-finished receipt posted — SA QR generated' : r.error ?? 'Failed') }}>
          <Layers className="h-4 w-4" /> Post Semi-Finished Receipt
        </Button>
      )}
      {wo.woType === 'finished_goods' && wo.status === 'completed' && (
        <Button size="sm" onClick={() => { const r = workflowPostFgReceipt(wo.id); show(r.ok ? 'FG received — Trailer QR generated' : r.error ?? 'Failed') }}>
          <Box className="h-4 w-4" /> FG Receipt
        </Button>
      )}
      {((wo.woType === 'finished_goods' && wo.status === 'fg_received') ||
        (wo.woType === 'manufactured_sub_assembly' && wo.status === 'completed' && saReceiptPosted) ||
        (wo.woType === 'subcontract' && wo.status === 'completed')) && (
        <Button size="sm" variant="secondary" onClick={() => { const r = closeWorkOrder(wo.id); show(r.ok ? 'WO closed' : r.error ?? 'Failed') }}>
          Close WO
        </Button>
      )}
    </div>
  )

  return (
    <div className="erp-page">
      <Toast message={toast} />
      <DocumentHeader
        docNo={wo.woNo}
        docType={woTypeLabel(wo.woType)}
        status={wo.status}
        createdDate={formatDate(wo.createdAt.slice(0, 10))}
        actions={docActions}
      />
      <EntityQrToolbar
        entityType={wo.woType === 'finished_goods' ? 'FINISHED_TRAILER' : wo.woType === 'manufactured_sub_assembly' ? 'SUB_ASSEMBLY' : 'WORK_ORDER'}
        entityId={wo.id}
        displayCode={wo.woNo}
        metadata={{ woNo: wo.woNo, itemCode: wo.outputItemCode }}
        payload={{ wo: wo.woNo, item: wo.outputItemCode }}
        className="mb-4 px-1"
      />
      <DocumentLayout
        main={
          <>
            <div className="flex flex-wrap gap-2">
              <Badge color={statusColor(wo.status)}>{formatStatus(wo.status)}</Badge>
              <Badge color="blue">{woTypeLabel(wo.woType)}</Badge>
              <Badge color="purple">BOM {wo.bomRevision}</Badge>
              {wo.routingRevision ? (
                <Badge color="purple">RTG {wo.routingRevision}</Badge>
              ) : (
                <Badge color="red">No Routing</Badge>
              )}
              <Badge color="green">SO {wo.salesOrderNo}</Badge>
              {!editable && <Badge color="gray">Read-only</Badge>}
            </div>

            <WipFlowPanel steps={wipFlowSteps} currentStepId={wipFlowStepId} />

            <div className="flex flex-wrap gap-1 border-b border-erp-border">
              {detailTabs.map(({ id: tabId, label, icon: Icon }) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setTab(tabId)}
                  className={`flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
                    tab === tabId ? 'border-erp-primary text-erp-primary' : 'border-transparent text-erp-muted hover:text-erp-text'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>

            <Card>
        {tab === 'materials' && (
          materials.length === 0
            ? <p className="p-6 text-sm text-slate-500">{wo.woType === 'finished_goods' ? 'No sub-assembly consumption lines — check MRP WO creation mode.' : 'No material lines for this work order.'}</p>
            : <DataTable data={materials} columns={materialColumns} />
        )}

        {tab === 'reservation' && (
          <>
            {wo.status === 'released' && materials.some((m) => m.reservedQty < m.requiredQty) && (
              <div className="border-b border-erp-border px-4 py-3">
                <Button size="sm" onClick={() => { const r = reserveMaterials(wo.id); show(r.ok ? `Reserved ${r.reserved ?? 0}` : r.error ?? 'Failed') }}>
                  <Bookmark className="h-4 w-4" /> Reserve Available Stock
                </Button>
                <p className="mt-2 text-xs text-slate-500">Reservation reduces free stock but not on-hand stock.</p>
              </div>
            )}
            {materials.length === 0
              ? <p className="p-6 text-sm text-slate-500">No materials to reserve.</p>
              : <DataTable data={materials} columns={reservationColumns} />}
          </>
        )}

        {tab === 'issue' && (
          materials.length === 0
            ? <p className="p-6 text-sm text-slate-500">No material issue lines.</p>
            : <DataTable data={materials} columns={issueColumns} />
        )}

        {tab === 'operations' && (
          productionOps.length === 0 ? (
            <div className="p-6 text-sm text-erp-muted">
              <p>Production operations are generated from released product routing when you <strong>Start Production</strong>.</p>
              <p className="mt-2">No production execution without a released routing.</p>
            </div>
          ) : (
            <div className="space-y-4 p-4">
              <p className="text-[13px] text-erp-muted">
                {productionOps.length} operations · {jobCardsByOperationId.size} job cards — shop floor execution per routing step
              </p>
              <div className="space-y-4">
                {productionOps.map((op) => {
                  const seqGate = canStartOperation(productionOps, op.id)
                  return (
                  <JobCardPanel
                    key={op.id}
                    woNo={wo.woNo}
                    workOrderId={wo.id}
                    operation={op}
                    jobCard={jobCardsByOperationId.get(op.id)}
                    inspections={woInspections}
                    reworks={woReworks}
                    sequenceBlocked={!seqGate.ok}
                    sequenceBlockReason={seqGate.error}
                    onStart={(jobCardId, assignedTeam, startTime) => {
                      const r = startJobCard(jobCardId, { assignedTeam, startTime })
                      show(r.ok ? `Job card started · ${assignedTeam}` : r.error ?? 'Failed')
                    }}
                    onComplete={(jobCardId, endTime, actualHours, remarks, qcChecks) => {
                      const r = completeJobCard(jobCardId, { endTime, actualHours, remarks, qcChecks })
                      show(r.ok ? `Job card completed · ${actualHours}h — QC queued if required` : r.error ?? 'Failed')
                    }}
                  />
                  )
                })}
              </div>
            </div>
          )
        )}

        {tab === 'subcontract' && wo.woType === 'subcontract' && (
          <div>
            <div className="border-b border-erp-border p-4">
              <h4 className="mb-3 text-sm font-semibold">Send Material to Vendor</h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <select className="rounded border px-2 py-1.5 text-sm" value={subForm.lineId} onChange={(e) => setSubForm({ ...subForm, lineId: e.target.value })}>
                  <option value="">Material line…</option>
                  {materials.map((m) => <option key={m.id} value={m.id}>{m.itemCode}</option>)}
                </select>
                <select className="rounded border px-2 py-1.5 text-sm" value={subForm.vendorId} onChange={(e) => setSubForm({ ...subForm, vendorId: e.target.value })}>
                  <option value="">Vendor…</option>
                  {vendors.filter((v) => v.isActive).map((v) => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
                </select>
                <input className="rounded border px-2 py-1.5 text-sm" placeholder="Challan No" value={subForm.challanNo} onChange={(e) => setSubForm({ ...subForm, challanNo: e.target.value })} />
                <input className="rounded border px-2 py-1.5 text-sm" type="number" placeholder="Qty" value={subForm.qty} onChange={(e) => setSubForm({ ...subForm, qty: e.target.value })} />
                <input className="rounded border px-2 py-1.5 text-sm" type="date" value={subForm.expectedReturnDate} onChange={(e) => setSubForm({ ...subForm, expectedReturnDate: e.target.value })} />
              </div>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => {
                  const qty = parseFloat(subForm.qty)
                  const r = sendSubcontractMaterial(wo.id, subForm.lineId, subForm.vendorId, subForm.challanNo, qty, subForm.expectedReturnDate)
                  show(r.ok ? 'Material sent to vendor' : r.error ?? 'Failed')
                }}
              >
                Send to Vendor
              </Button>
            </div>
            <div className="border-b border-erp-border p-4">
              <h4 className="mb-3 text-sm font-semibold">Receive Processed Material</h4>
              <div className="flex flex-wrap gap-2">
                <select className="rounded border px-2 py-1.5 text-sm" value={recvForm.shipmentId} onChange={(e) => setRecvForm({ ...recvForm, shipmentId: e.target.value })}>
                  <option value="">Shipment…</option>
                  {shipments.map((s) => <option key={s.id} value={s.id}>{s.challanNo}</option>)}
                </select>
                <input className="rounded border px-2 py-1.5 text-sm w-24" type="number" placeholder="Received" value={recvForm.receivedQty} onChange={(e) => setRecvForm({ ...recvForm, receivedQty: e.target.value })} />
                <input className="rounded border px-2 py-1.5 text-sm w-24" type="number" placeholder="Rejected" value={recvForm.rejectedQty} onChange={(e) => setRecvForm({ ...recvForm, rejectedQty: e.target.value })} />
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const r = receiveSubcontractMaterial(recvForm.shipmentId, parseFloat(recvForm.receivedQty) || 0, parseFloat(recvForm.rejectedQty) || 0)
                    show(r.ok ? 'Receipt recorded' : r.error ?? 'Failed')
                  }}
                >
                  Record Receipt
                </Button>
              </div>
            </div>
            {shipments.length === 0
              ? <p className="p-6 text-sm text-slate-500">No subcontract shipments yet.</p>
              : <DataTable data={shipments} columns={shipmentColumns} />}
          </div>
        )}
        {tab === 'subcontract' && wo.woType !== 'subcontract' && (
          <p className="p-6 text-sm text-slate-500">Subcontract tab applies to subcontract work orders only (e.g. Paint Process).</p>
        )}

        {tab === 'sa_receipt' && wo.woType === 'manufactured_sub_assembly' && (
          <>
            <div className="border-b border-erp-border px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs uppercase text-slate-500">Output Item</p>
                  <p className="font-mono text-sm font-medium">{wo.outputItemCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Qty to Receive</p>
                  <p className="text-sm font-medium">{formatNumber(wo.qty)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Receipt Warehouse</p>
                  <p className="font-mono text-sm">{saReceiptWarehouseCode}</p>
                </div>
                <div>
                  <p className="text-xs uppercase text-slate-500">Parent WO</p>
                  <p className="font-mono text-sm">{parentWo?.woNo ?? '—'}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Badge color={saReceiptPosted ? 'green' : wo.status === 'completed' ? 'yellow' : 'gray'}>
                  {saReceiptPosted ? 'Receipt Posted' : wo.status === 'completed' ? 'Pending Receipt' : 'WO Not Completed'}
                </Badge>
                {wo.status === 'completed' && !saReceiptPosted && (
                  <Button size="sm" onClick={() => { const r = workflowPostSaReceipt(wo.id); show(r.ok ? 'Semi-finished receipt posted into WIP warehouse' : r.error ?? 'Failed') }}>
                    Post Semi-Finished Receipt
                  </Button>
                )}
              </div>
            </div>
            {saReceipts.length === 0
              ? <p className="p-6 text-sm text-slate-500">Complete WO first, then post semi-finished receipt (SA_RECEIPT) into the work center output WIP warehouse.</p>
              : <DataTable data={saReceipts} columns={saColumns} />}
          </>
        )}
        {tab === 'sa_receipt' && wo.woType !== 'manufactured_sub_assembly' && (
          <p className="p-6 text-sm text-slate-500">Semi-finished receipt applies to manufactured sub-assembly work orders only.</p>
        )}

        {tab === 'fg_receipt' && wo.woType === 'finished_goods' && (
          <>
            {wo.status === 'completed' && (
              <div className="border-b border-erp-border px-4 py-3">
                <Button size="sm" onClick={() => { const r = workflowPostFgReceipt(wo.id); show(r.ok ? 'FG received' : r.error ?? 'Failed') }}>
                  Post FG Receipt to FG Yard
                </Button>
              </div>
            )}
            {fgReceipts.length === 0
              ? <p className="p-6 text-sm text-slate-500">Complete WO first, then receive finished goods into FG Yard (FG_RECEIPT).</p>
              : <DataTable data={fgReceipts} columns={fgColumns} />}
          </>
        )}
        {tab === 'fg_receipt' && wo.woType !== 'finished_goods' && (
          <p className="p-6 text-sm text-slate-500">FG receipt applies to Finished Goods work orders only.</p>
        )}

        {tab === 'cost' && id && <WorkOrderCostPanel workOrderId={id} />}

        {tab === 'timeline' && (
          activities.length === 0
            ? <p className="p-6 text-sm text-slate-500">No activity yet.</p>
            : <DataTable data={activities} columns={timelineColumns} />
        )}
      </Card>
          </>
        }
        factBoxes={
          <FactBoxPanel>
            <FactBox
              title="Details"
              fields={[
                { label: 'Product', value: getProduct(wo.productId)?.productName ?? '—' },
                { label: 'Output Item', value: wo.outputItemCode },
                { label: 'Qty', value: formatNumber(wo.qty) },
                { label: 'Planned Start', value: formatDate(wo.plannedStartDate) },
                { label: 'Planned Finish', value: formatDate(wo.plannedFinishDate) },
                { label: 'BOM Rev', value: wo.bomRevision },
                { label: 'Routing Rev', value: wo.routingRevision ?? '—' },
              ]}
            />
            <FactBox
              title="Materials"
              fields={[
                { label: 'Lines', value: materials.length },
                { label: 'Required', value: formatNumber(materialRequired) },
                { label: 'Reserved', value: formatNumber(materialReserved) },
                { label: 'Issued', value: formatNumber(materialIssued) },
                {
                  label: 'Issue Progress',
                  value: materialRequired > 0 ? `${Math.round((materialIssued / materialRequired) * 100)}%` : '—',
                },
              ]}
            />
            <FactBox
              title="Quality"
              fields={[
                { label: 'Inspections', value: woInspections.length },
                { label: 'Open Rework', value: woReworks.filter((r) => r.status !== 'closed' && r.status !== 'reinspected').length },
                { label: 'Operations', value: productionOps.length },
              ]}
            />
            <FactBox
              title="Links"
              fields={[
                { label: 'Sales Order', value: <AppLink to={`/sales/orders/${wo.salesOrderId}`}>{wo.salesOrderNo}</AppLink> },
                ...(parentWo
                  ? [{ label: 'Parent WO', value: <AppLink to={`/work-orders/${parentWo.id}`}>{parentWo.woNo}</AppLink> }]
                  : []),
                ...(wo.mrpRunId
                  ? [{ label: 'MRP Run', value: <AppLink to={`/mrp/runs/${wo.mrpRunId}`}>View run</AppLink> }]
                  : []),
              ]}
            />
          </FactBoxPanel>
        }
      />
    </div>
  )
}
