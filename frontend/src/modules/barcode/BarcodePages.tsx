import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BarChart3, QrCode } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataGrid } from '../../components/design-system/DataGrid'
import { Badge } from '../../components/ui/Badge'
import { BarcodeLabelPrint } from '../../components/barcode/BarcodeLabelPrint'
import { BarcodeScanDialog } from '../../components/barcode/BarcodeScanDialog'
import { useBarcodeHistory } from '../../hooks/useStableStoreData'
import { useBarcodeStore } from '../../store/barcodeStore'
import { useMasterStore } from '../../store/masterStore'
import { LocationSelect } from '../../components/masters/LocationSelect'
import { resolveLocationWarehouseId } from '../../utils/locationUtils'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useDispatchStore } from '../../store/dispatchStore'
import {
  BARCODE_ENTITY_LABELS,
  BARCODE_EVENT_LABELS,
  type BarcodeEntityType,
  type BarcodeEventType,
} from '../../types/barcode'
import {
  lookupBarcodeTrace,
  scanDispatch,
  scanOperationComplete,
  scanOperationStart,
  scanSubcontractReceive,
  scanSubcontractSend,
  scanToIssue,
  scanToReceive,
  scanToTransfer,
  scanTrailer,
  scanWipMove,
} from '../../utils/barcodeEngine'
import { formatDate } from '../../utils/dates/format'
const ENTITY_TYPES = Object.keys(BARCODE_ENTITY_LABELS) as BarcodeEntityType[]
const EVENT_TYPES = Object.keys(BARCODE_EVENT_LABELS) as BarcodeEventType[]

function statusBadge(status: string) {
  if (status === 'active') return <Badge color="green">Active</Badge>
  if (status === 'consumed') return <Badge color="yellow">Consumed</Badge>
  return <Badge color="red">Void</Badge>
}

export function BarcodeHubPage() {
  const count = useBarcodeStore((s) => s.barcodes.length)
  const historyCount = useBarcodeStore((s) => s.history.length)

  const links = [
    { label: 'Barcode Master', path: '/barcode/master', desc: 'Register & status' },
    { label: 'Generator', path: '/barcode/generator', desc: 'Create entity labels' },
    { label: 'Print Labels', path: '/barcode/print', desc: 'Batch label print' },
    { label: 'Barcode History', path: '/barcode/history', desc: 'Full event timeline' },
    { label: 'Traceability Report', path: '/barcode/trace', desc: 'Trailer / chassis / barcode lookup' },
  ]

  const scanLinks = [
    { label: 'Scan To Receive', path: '/inventory/scan/receive' },
    { label: 'Scan To Issue', path: '/inventory/scan/issue' },
    { label: 'Scan To Transfer', path: '/inventory/scan/transfer' },
    { label: 'Scan Operation Start', path: '/production/scan/start' },
    { label: 'Scan Operation Complete', path: '/production/scan/complete' },
    { label: 'Scan WIP Move', path: '/production/scan/wip-move' },
    { label: 'Scan Subcontract Send', path: '/job-work/scan/send' },
    { label: 'Scan Subcontract Receive', path: '/job-work/scan/receive' },
    { label: 'Scan Trailer', path: '/dispatch/scan/trailer' },
    { label: 'Scan Dispatch', path: '/dispatch/scan/dispatch' },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode & QR Traceability"
        description="Phase 1 — master data, label generation, scan workflows, and full entity history"
        badge="Phase 1"
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-erp-border bg-white p-4">
          <p className="text-xs text-erp-muted">Active Barcodes</p>
          <p className="text-3xl font-semibold">{count}</p>
        </div>
        <div className="rounded-lg border border-erp-border bg-white p-4">
          <p className="text-xs text-erp-muted">History Events</p>
          <p className="text-3xl font-semibold">{historyCount}</p>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h2 className="mb-3 font-semibold">Core Modules</h2>
          <ul className="space-y-2">
            {links.map((l) => (
              <li key={l.path}>
                <Link to={l.path} className="flex items-center justify-between rounded border border-erp-border px-3 py-2 hover:border-erp-accent">
                  <span className="font-medium">{l.label}</span>
                  <span className="text-xs text-erp-muted">{l.desc}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-lg border border-erp-border bg-white p-4">
          <h2 className="mb-3 font-semibold">Scan Workflows</h2>
          <ul className="space-y-1 text-sm">
            {scanLinks.map((l) => (
              <li key={l.path}>
                <Link to={l.path} className="text-erp-accent hover:underline">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}

export function BarcodeMasterPage() {
  const barcodes = useBarcodeStore((s) => s.barcodes)
  const updateStatus = useBarcodeStore((s) => s.updateStatus)
  const [entityFilter, setEntityFilter] = useState<BarcodeEntityType | 'all'>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    const q = query.trim().toUpperCase()
    return barcodes.filter((b) => {
      if (entityFilter !== 'all' && b.entityType !== entityFilter) return false
      if (!q) return true
      return (
        b.barcodeValue.toUpperCase().includes(q) ||
        b.entityLabel.toUpperCase().includes(q) ||
        b.entityId.toUpperCase().includes(q)
      )
    })
  }, [barcodes, entityFilter, query])

  return (
    <div className="space-y-6">
      <PageHeader title="Barcode Master" description="All registered barcodes by entity type" autoBreadcrumbs />
      <div className="flex flex-wrap gap-3 rounded-lg border border-erp-border bg-white p-4">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search value, entity…"
          className="min-w-[200px] flex-1 rounded border border-erp-border px-3 py-2 text-sm"
        />
        <select
          value={entityFilter}
          onChange={(e) => setEntityFilter(e.target.value as BarcodeEntityType | 'all')}
          className="rounded border border-erp-border px-3 py-2 text-sm"
        >
          <option value="all">All entities</option>
          {ENTITY_TYPES.map((t) => (
            <option key={t} value={t}>{BARCODE_ENTITY_LABELS[t]}</option>
          ))}
        </select>
      </div>
      <DataGrid
        data={rows}
        columns={[
          { accessorKey: 'barcodeValue', header: 'Barcode', cell: ({ row }) => <span className="font-mono text-sm">{row.original.barcodeValue}</span> },
          { accessorKey: 'entityType', header: 'Entity', cell: ({ row }) => BARCODE_ENTITY_LABELS[row.original.entityType] },
          { accessorKey: 'entityLabel', header: 'Label' },
          { accessorKey: 'status', header: 'Status', cell: ({ row }) => statusBadge(row.original.status) },
          { accessorKey: 'createdDate', header: 'Created' },
          {
            id: 'actions',
            header: '',
            cell: ({ row }) =>
              row.original.status === 'active' ? (
                <button
                  type="button"
                  className="text-xs text-red-600 hover:underline"
                  onClick={() => updateStatus(row.original.barcodeId, 'void')}
                >
                  Void
                </button>
              ) : null,
          },
        ]}
        compact
        emptyMessage="No barcodes registered yet — use Generator or scan workflows."
      />
    </div>
  )
}

export function BarcodeGeneratorPage() {
  const generateBarcode = useBarcodeStore((s) => s.generateBarcode)
  const items = useMasterStore((s) => s.items)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const grns = usePurchaseStore((s) => s.grns)
  const [entityType, setEntityType] = useState<BarcodeEntityType>('item')
  const [entityId, setEntityId] = useState('')
  const [last, setLast] = useState<string | null>(null)

  const options = useMemo(() => {
    switch (entityType) {
      case 'item':
        return items.map((i) => ({ id: i.id, label: `${i.itemCode} — ${i.itemName}` }))
      case 'work_order':
        return workOrders.map((w) => ({ id: w.id, label: w.woNo }))
      case 'grn':
        return grns.map((g) => ({ id: g.id, label: g.grnNo }))
      default:
        return []
    }
  }, [entityType, items, workOrders, grns])

  function handleGenerate() {
    if (!entityId) return
    const label = options.find((o) => o.id === entityId)?.label ?? entityId
    const record = generateBarcode({ entityType, entityId, entityLabel: label })
    setLast(record.barcodeValue)
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Barcode Generator" description="Generate VT barcodes and QR payloads for supported entities" autoBreadcrumbs />
      <div className="max-w-xl space-y-4 rounded-lg border border-erp-border bg-white p-4">
        <label className="block text-sm">
          Entity type
          <select
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value as BarcodeEntityType)
              setEntityId('')
            }}
            className="mt-1 w-full rounded border border-erp-border px-3 py-2"
          >
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{BARCODE_ENTITY_LABELS[t]}</option>
            ))}
          </select>
        </label>
        {options.length > 0 ? (
          <label className="block text-sm">
            Entity
            <select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="mt-1 w-full rounded border border-erp-border px-3 py-2">
              <option value="">Select…</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block text-sm">
            Entity ID
            <input
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="mt-1 w-full rounded border border-erp-border px-3 py-2 font-mono"
              placeholder="Enter entity ID"
            />
          </label>
        )}
        <button type="button" onClick={handleGenerate} className="rounded bg-erp-accent px-4 py-2 text-sm font-medium text-white">
          Generate Barcode
        </button>
        {last && (
          <p className="rounded bg-green-50 px-3 py-2 font-mono text-sm text-green-800">
            Created: {last}
          </p>
        )}
      </div>
    </div>
  )
}

export function BarcodePrintPage() {
  const allBarcodes = useBarcodeStore((s) => s.barcodes)
  const barcodes = useMemo(() => allBarcodes.filter((b) => b.status === 'active'), [allBarcodes])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const labels = barcodes.filter((b) => selected.has(b.barcodeId))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Print Barcode Labels" description="Select labels for batch printing" autoBreadcrumbs actions={
        <button type="button" onClick={() => setSelected(new Set(barcodes.map((b) => b.barcodeId)))} className="text-sm text-erp-accent">
          Select all active
        </button>
      } />
      <div className="rounded-lg border border-erp-border bg-white p-4">
        <div className="mb-4 max-h-48 overflow-y-auto space-y-1">
          {barcodes.map((b) => (
            <label key={b.barcodeId} className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={selected.has(b.barcodeId)} onChange={() => toggle(b.barcodeId)} />
              <span className="font-mono">{b.barcodeValue}</span>
              <span className="text-erp-muted">{b.entityLabel}</span>
            </label>
          ))}
        </div>
        <BarcodeLabelPrint labels={labels} />
      </div>
    </div>
  )
}

export function BarcodeHistoryPage() {
  const history = useBarcodeHistory()
  const [eventFilter, setEventFilter] = useState<BarcodeEventType | 'all'>('all')

  const rows = useMemo(
    () => (eventFilter === 'all' ? history : history.filter((h) => h.eventType === eventFilter)),
    [history, eventFilter],
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode History"
        description="Created · Received · Issued · Consumed · Moved · Subcontracted · Dispatched"
        autoBreadcrumbs
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEventFilter('all')}
          className={`rounded px-3 py-1 text-sm ${eventFilter === 'all' ? 'bg-erp-accent text-white' : 'border border-erp-border'}`}
        >
          All
        </button>
        {EVENT_TYPES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEventFilter(e)}
            className={`rounded px-3 py-1 text-sm ${eventFilter === e ? 'bg-erp-accent text-white' : 'border border-erp-border'}`}
          >
            {BARCODE_EVENT_LABELS[e]}
          </button>
        ))}
      </div>
      <DataGrid
        data={rows}
        columns={[
          { accessorKey: 'eventDate', header: 'When', cell: ({ row }) => formatDate(row.original.eventDate) },
          { accessorKey: 'eventType', header: 'Event', cell: ({ row }) => BARCODE_EVENT_LABELS[row.original.eventType] },
          { accessorKey: 'barcodeValue', header: 'Barcode', cell: ({ row }) => <span className="font-mono text-xs">{row.original.barcodeValue}</span> },
          { accessorKey: 'referenceNo', header: 'Reference' },
          { accessorKey: 'details', header: 'Details' },
          { accessorKey: 'userName', header: 'User' },
        ]}
        compact
        emptyMessage="No barcode events recorded yet."
      />
    </div>
  )
}

export function BarcodeTraceReportPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [barcode, setBarcode] = useState(searchParams.get('barcode') ?? '')
  const [trailerNo, setTrailerNo] = useState(searchParams.get('trailerNo') ?? '')
  const [chassisNo, setChassisNo] = useState(searchParams.get('chassisNo') ?? '')

  const result = useMemo(
    () => lookupBarcodeTrace({ barcode, trailerNo, chassisNo }),
    [barcode, trailerNo, chassisNo],
  )

  function runSearch() {
    const params = new URLSearchParams()
    if (barcode.trim()) params.set('barcode', barcode.trim())
    if (trailerNo.trim()) params.set('trailerNo', trailerNo.trim())
    if (chassisNo.trim()) params.set('chassisNo', chassisNo.trim())
    setSearchParams(params, { replace: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Barcode Traceability Report"
        description="Enter trailer no, chassis no, or barcode to view full history"
        autoBreadcrumbs
        actions={
          <Link to="/reports/traceability/barcode" className="inline-flex items-center gap-1 text-sm text-erp-accent">
            <BarChart3 className="h-4 w-4" /> Reports hub
          </Link>
        }
      />
      <div className="grid gap-3 rounded-lg border border-erp-border bg-white p-4 sm:grid-cols-3">
        <input value={barcode} onChange={(e) => setBarcode(e.target.value)} placeholder="Barcode" className="rounded border border-erp-border px-3 py-2 text-sm font-mono" />
        <input value={trailerNo} onChange={(e) => setTrailerNo(e.target.value)} placeholder="Trailer No" className="rounded border border-erp-border px-3 py-2 text-sm" />
        <input value={chassisNo} onChange={(e) => setChassisNo(e.target.value)} placeholder="Chassis No" className="rounded border border-erp-border px-3 py-2 text-sm" />
        <button type="button" onClick={runSearch} className="sm:col-span-3 rounded bg-erp-accent px-4 py-2 text-sm font-medium text-white">
          Trace
        </button>
      </div>

      {result.barcode ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="font-semibold">{result.barcode.barcodeValue}</h3>
            <p className="text-sm text-erp-muted">
              {BARCODE_ENTITY_LABELS[result.barcode.entityType]} · {result.barcode.entityLabel}
              {result.barcode.trailerNo && ` · Trailer ${result.barcode.trailerNo}`}
            </p>
          </div>
          <DataGrid
            data={result.history}
            columns={[
              { accessorKey: 'eventDate', header: 'Date', cell: ({ row }) => formatDate(row.original.eventDate) },
              { accessorKey: 'eventType', header: 'Event', cell: ({ row }) => BARCODE_EVENT_LABELS[row.original.eventType] },
              { accessorKey: 'referenceNo', header: 'Ref' },
              { accessorKey: 'details', header: 'Details' },
            ]}
            compact
            emptyMessage="No history for this barcode."
          />
        </div>
      ) : (
        (barcode || trailerNo || chassisNo) && (
          <p className="text-sm text-erp-muted">No matching barcode found.</p>
        )
      )}
    </div>
  )
}

function FieldInput({
  label,
  name,
  value,
  onChange,
  type = 'text',
}: {
  label: string
  name: string
  value: string
  onChange: (name: string, v: string) => void
  type?: string
}) {
  return (
    <label className="block text-sm">
      {label}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(name, e.target.value)}
        className="mt-1 w-full rounded border border-erp-border px-3 py-2"
      />
    </label>
  )
}

function useScanForm(initial: Record<string, string> | (() => Record<string, string>) = {}) {
  const [form, setForm] = useState(initial)
  const set = (name: string, v: string) => setForm((f) => ({ ...f, [name]: v }))
  return { form, set }
}

function ScanPageShell({
  title,
  description,
  submitLabel,
  children,
  onScan,
}: {
  title: string
  description: string
  submitLabel?: string
  children: React.ReactNode
  onScan: (scan: string) => { ok: boolean; message?: string; error?: string }
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} autoBreadcrumbs />
      <div className="max-w-md space-y-4 rounded-lg border border-erp-border bg-white p-4">{children}</div>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded bg-erp-accent px-4 py-2 text-sm text-white">
        <QrCode className="h-4 w-4" /> {submitLabel ?? 'Scan'}
      </button>
      <BarcodeScanDialog open={open} title={title} onClose={() => setOpen(false)} onSubmit={onScan} submitLabel={submitLabel} fields={children} />
    </div>
  )
}

export function ScanToReceivePage() {
  const allPos = usePurchaseStore((s) => s.purchaseOrders)
  const pos = useMemo(
    () => allPos.filter((p) => p.status === 'sent' || p.status === 'partial'),
    [allPos],
  )
  const getItem = useMasterStore((s) => s.getItem)
  const { form, set } = useScanForm({ poId: '', poLineId: '', receivedQty: '1' })
  const po = pos.find((p) => p.id === form.poId)

  return (
    <ScanPageShell
      title="Scan To Receive"
      description="Post GRN receipt by scanning item or PO barcode"
      submitLabel="Receive"
      onScan={(scan) =>
        scanToReceive({
          scan,
          poId: form.poId,
          poLineId: form.poLineId,
          receivedQty: Number(form.receivedQty) || 0,
        })
      }
    >
      <label className="block text-sm">PO
        <select value={form.poId} onChange={(e) => set('poId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          <option value="">Select PO</option>
          {pos.map((p) => <option key={p.id} value={p.id}>{p.poNo}</option>)}
        </select>
      </label>
      <label className="block text-sm">PO Line
        <select value={form.poLineId} onChange={(e) => set('poLineId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          <option value="">Select line</option>
          {po?.lines.map((l) => <option key={l.id} value={l.id}>{getItem(l.itemId)?.itemCode ?? l.itemId} — qty {l.qty}</option>)}
        </select>
      </label>
      <FieldInput label="Received Qty" name="receivedQty" value={form.receivedQty} onChange={set} type="number" />
    </ScanPageShell>
  )
}

export function ScanToIssuePage() {
  const locations = useMasterStore((s) => s.locations)
  const defaultLoc = locations.find((l) => l.isDefault) ?? locations[0]
  const { form, set } = useScanForm({
    locationId: defaultLoc?.id ?? '',
    warehouseId: defaultLoc?.warehouseId ?? '',
    qty: '1',
  })
  return (
    <ScanPageShell title="Scan To Issue" description="Issue stock from location by item barcode" submitLabel="Issue" onScan={(scan) => scanToIssue({ scan, warehouseId: form.warehouseId, qty: Number(form.qty) || 0 })}>
      <label className="block text-sm">Location Code
        <div className="mt-1">
          <LocationSelect
            value={form.locationId}
            onChange={(locId) => {
              set('locationId', locId)
              set('warehouseId', resolveLocationWarehouseId(locId, locations) ?? form.warehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <FieldInput label="Qty" name="qty" value={form.qty} onChange={set} type="number" />
    </ScanPageShell>
  )
}

export function ScanToTransferPage() {
  const locations = useMasterStore((s) => s.locations)
  const defaultLoc = locations.find((l) => l.isDefault) ?? locations[0]
  const secondLoc = locations.find((l) => l.id !== defaultLoc?.id) ?? defaultLoc
  const { form, set } = useScanForm({
    fromLocationId: defaultLoc?.id ?? '',
    fromWarehouseId: defaultLoc?.warehouseId ?? '',
    toLocationId: secondLoc?.id ?? '',
    toWarehouseId: secondLoc?.warehouseId ?? '',
    qty: '1',
  })
  return (
    <ScanPageShell title="Scan To Transfer" description="Inter-location transfer by barcode" submitLabel="Transfer" onScan={(scan) => scanToTransfer({ scan, fromWarehouseId: form.fromWarehouseId, toWarehouseId: form.toWarehouseId, qty: Number(form.qty) || 0 })}>
      <label className="block text-sm">From Location
        <div className="mt-1">
          <LocationSelect
            value={form.fromLocationId}
            onChange={(locId) => {
              set('fromLocationId', locId)
              set('fromWarehouseId', resolveLocationWarehouseId(locId, locations) ?? form.fromWarehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <label className="block text-sm">To Location
        <div className="mt-1">
          <LocationSelect
            value={form.toLocationId}
            onChange={(locId) => {
              set('toLocationId', locId)
              set('toWarehouseId', resolveLocationWarehouseId(locId, locations) ?? form.toWarehouseId)
            }}
            usage="all"
          />
        </div>
      </label>
      <FieldInput label="Qty" name="qty" value={form.qty} onChange={set} type="number" />
    </ScanPageShell>
  )
}

export function ScanOperationStartPage() {
  return (
    <ScanPageShell title="Scan Operation Start" description="Start job card / WIP move by WO or job card barcode" submitLabel="Start" onScan={(scan) => scanOperationStart({ scan })}>
      <p className="text-sm text-erp-muted">Scan work order or job card barcode to start the next open operation.</p>
    </ScanPageShell>
  )
}

export function ScanOperationCompletePage() {
  return (
    <ScanPageShell title="Scan Operation Complete" description="Complete in-progress operation by scan" submitLabel="Complete" onScan={(scan) => scanOperationComplete({ scan })}>
      <p className="text-sm text-erp-muted">Scan work order or job card barcode to complete the active operation.</p>
    </ScanPageShell>
  )
}

export function ScanWipMovePage() {
  return (
    <ScanPageShell title="Scan WIP Move" description="Move WIP to work center on operation start" submitLabel="Move WIP" onScan={(scan) => scanWipMove({ scan })}>
      <p className="text-sm text-erp-muted">Equivalent to operation start with WIP routing.</p>
    </ScanPageShell>
  )
}

export function ScanSubcontractSendPage() {
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const wos = useMemo(() => workOrders.filter((w) => w.woType === 'subcontract'), [workOrders])
  const allVendors = useMasterStore((s) => s.vendors)
  const vendors = useMemo(() => allVendors.filter((v) => v.isActive), [allVendors])
  const { form, set } = useScanForm(() => ({
    woId: '',
    lineId: '',
    vendorId: vendors[0]?.id ?? '',
    challanNo: 'SC-001',
    qty: '1',
    expectedReturnDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  }))
  const lines = form.woId ? useWorkOrderStore.getState().getWoMaterials(form.woId) : []

  return (
    <ScanPageShell title="Scan Subcontract Send" description="Send material to vendor with barcode trace" submitLabel="Send" onScan={(scan) => scanSubcontractSend({ scan, woId: form.woId, lineId: form.lineId, vendorId: form.vendorId, challanNo: form.challanNo, qty: Number(form.qty) || 0, expectedReturnDate: form.expectedReturnDate })}>
      <label className="block text-sm">Subcontract WO
        <select value={form.woId} onChange={(e) => set('woId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          <option value="">Select WO</option>
          {wos.map((w) => <option key={w.id} value={w.id}>{w.woNo}</option>)}
        </select>
      </label>
      <label className="block text-sm">Material line
        <select value={form.lineId} onChange={(e) => set('lineId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          <option value="">Select line</option>
          {lines.map((l) => <option key={l.id} value={l.id}>{l.itemCode}</option>)}
        </select>
      </label>
      <label className="block text-sm">Vendor
        <select value={form.vendorId} onChange={(e) => set('vendorId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          {vendors.map((v) => <option key={v.id} value={v.id}>{v.vendorName}</option>)}
        </select>
      </label>
      <FieldInput label="Challan No" name="challanNo" value={form.challanNo} onChange={set} />
      <FieldInput label="Qty" name="qty" value={form.qty} onChange={set} type="number" />
      <FieldInput label="Expected return" name="expectedReturnDate" value={form.expectedReturnDate} onChange={set} type="date" />
    </ScanPageShell>
  )
}

export function ScanSubcontractReceivePage() {
  const allShipments = useWorkOrderStore((s) => s.subcontractShipments)
  const shipments = useMemo(
    () => allShipments.filter((sh) => sh.status !== 'received'),
    [allShipments],
  )
  const { form, set } = useScanForm(() => ({ shipmentId: shipments[0]?.id ?? '', receivedQty: '1' }))
  return (
    <ScanPageShell title="Scan Subcontract Receive" description="Receive subcontract return by barcode" submitLabel="Receive" onScan={(scan) => scanSubcontractReceive({ scan, shipmentId: form.shipmentId, receivedQty: Number(form.receivedQty) || 0 })}>
      <label className="block text-sm">Shipment
        <select value={form.shipmentId} onChange={(e) => set('shipmentId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          {shipments.map((s) => <option key={s.id} value={s.id}>{s.challanNo} — sent {s.sentQty}</option>)}
        </select>
      </label>
      <FieldInput label="Received Qty" name="receivedQty" value={form.receivedQty} onChange={set} type="number" />
    </ScanPageShell>
  )
}

export function ScanTrailerPage() {
  const allDispatches = useDispatchStore((s) => s.dispatches)
  const dispatches = useMemo(
    () => allDispatches.filter((d) => ['planned', 'loading'].includes(d.status)),
    [allDispatches],
  )
  const { form, set } = useScanForm(() => ({
    dispatchId: dispatches[0]?.id ?? '',
    lineId: dispatches[0]?.lines[0]?.id ?? '',
    trailerNo: '',
    chassisNo: '',
  }))
  const plan = dispatches.find((d) => d.id === form.dispatchId)

  return (
    <ScanPageShell title="Scan Trailer" description="Link trailer and chassis to dispatch line" submitLabel="Link Trailer" onScan={(scan) => scanTrailer({ scan, dispatchId: form.dispatchId, lineId: form.lineId, trailerNo: form.trailerNo || undefined, chassisNo: form.chassisNo || undefined })}>
      <label className="block text-sm">Dispatch plan
        <select value={form.dispatchId} onChange={(e) => set('dispatchId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          {dispatches.map((d) => <option key={d.id} value={d.id}>{d.dispatchNo}</option>)}
        </select>
      </label>
      <label className="block text-sm">Line
        <select value={form.lineId} onChange={(e) => set('lineId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          {plan?.lines.map((l) => <option key={l.id} value={l.id}>{l.itemCode} — {l.serialNo || l.trailerNo || l.id.slice(0, 6)}</option>)}
        </select>
      </label>
      <FieldInput label="Trailer No (optional override)" name="trailerNo" value={form.trailerNo} onChange={set} />
      <FieldInput label="Chassis No (optional override)" name="chassisNo" value={form.chassisNo} onChange={set} />
    </ScanPageShell>
  )
}

export function ScanDispatchConfirmPage() {
  const allDispatches = useDispatchStore((s) => s.dispatches)
  const dispatches = useMemo(
    () => allDispatches.filter((d) => ['planned', 'loading'].includes(d.status)),
    [allDispatches],
  )
  const { form, set } = useScanForm(() => ({ dispatchId: dispatches[0]?.id ?? '' }))
  return (
    <ScanPageShell title="Scan Dispatch" description="Confirm dispatch gate with barcode scan" submitLabel="Confirm Dispatch" onScan={(scan) => scanDispatch({ scan, dispatchId: form.dispatchId })}>
      <label className="block text-sm">Dispatch plan
        <select value={form.dispatchId} onChange={(e) => set('dispatchId', e.target.value)} className="mt-1 w-full rounded border px-3 py-2">
          {dispatches.map((d) => <option key={d.id} value={d.id}>{d.dispatchNo}</option>)}
        </select>
      </label>
    </ScanPageShell>
  )
}

export function BarcodeTraceReportAliasPage() {
  return <BarcodeTraceReportPage />
}
