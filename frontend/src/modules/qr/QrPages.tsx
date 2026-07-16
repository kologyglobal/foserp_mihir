import { useMemo, useState, useEffect } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CheckCircle, GitBranch, Printer, ScanLine } from 'lucide-react'
import { PageHeader } from '../../components/ui/PageHeader'
import { DataGrid } from '../../components/design-system/DataGrid'
import { QrCodeBlock } from '../../components/qr/QrCodeBlock'
import { QrStatusBadge } from '../../components/qr/QrStatusBadge'
import { useQrStore } from '../../store/qrStore'
import { useMasterStore } from '../../store/masterStore'
import type { QrEntityType, QrRecord } from '../../types/qrTraceability'
import { QR_ENTITY_LABELS, QR_EVENT_LABELS } from '../../types/qrTraceability'
import {
  getAllowedActions,
  lookupQrTrace,
  buildTraceChain,
  qrConfirmDispatch,
  qrConfirmLoading,
  qrIssueToWo,
  qrJobCardComplete,
  qrJobCardStart,
  qrJobWorkReceive,
  qrJobWorkSendValidate,
  qrOpenInspection,
  qrReceiveConfirm,
  qrSaConsume,
  qrTransfer,
  qrWipMove,
  resolveQrScan,
} from '../../utils/qrEngine'
import { formatDate } from '../../utils/dates/format'
const SCAN_MODES = [
  'Receive',
  'Issue',
  'Transfer',
  'WIP Move',
  'Job Card Start',
  'Job Card Complete',
  'Job Work Send',
  'Job Work Receive',
  'QC Inspect',
  'Dispatch',
] as const

type ScanMode = (typeof SCAN_MODES)[number]

function LabelShell({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="mx-auto max-w-md rounded-lg border-2 border-dashed border-erp-border bg-white p-6 print:border-black print:shadow-none">
      <h2 className="mb-4 text-center text-sm font-bold uppercase tracking-wide">{title}</h2>
      {children}
    </div>
  )
}

function MaterialLabel({ qr }: { qr: QrRecord }) {
  const m = qr.metadata
  return (
    <LabelShell title="Material Label">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1 text-sm">
          <p><span className="text-erp-muted">Item:</span> <strong>{m.itemCode}</strong></p>
          <p>{m.itemName}</p>
          <p><span className="text-erp-muted">Lot:</span> {m.lotNo ?? qr.displayCode}</p>
          <p><span className="text-erp-muted">GRN:</span> {m.grnNo ?? '—'}</p>
          <p><span className="text-erp-muted">Qty:</span> {m.qty ?? '—'}</p>
          <p><span className="text-erp-muted">Warehouse:</span> {m.warehouseCode ?? '—'}</p>
          <QrStatusBadge status={qr.status} />
        </div>
        <QrCodeBlock value={qr.qrCode} size={120} label={qr.displayCode} />
      </div>
    </LabelShell>
  )
}

function SubAssemblyLabel({ qr }: { qr: QrRecord }) {
  const m = qr.metadata
  return (
    <LabelShell title="Sub Assembly Label">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1 text-sm">
          <p><strong>{qr.displayCode}</strong></p>
          <p><span className="text-erp-muted">WO:</span> {m.woNo}</p>
          <p><span className="text-erp-muted">Product:</span> {m.productCode ?? m.itemCode}</p>
          <p><span className="text-erp-muted">Stage:</span> {m.stage ?? 'SA'}</p>
          <QrStatusBadge status={qr.status} />
        </div>
        <QrCodeBlock value={qr.qrCode} size={120} />
      </div>
    </LabelShell>
  )
}

function TrailerLabel({ qr }: { qr: QrRecord }) {
  const m = qr.metadata
  return (
    <LabelShell title="Trailer Label">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1 text-sm">
          <p><strong>{m.trailerNo ?? qr.displayCode}</strong></p>
          <p><span className="text-erp-muted">Chassis:</span> {m.chassisNo ?? '—'}</p>
          <p><span className="text-erp-muted">WO:</span> {m.woNo}</p>
          <p><span className="text-erp-muted">Customer:</span> {m.customerName ?? '—'}</p>
          <QrStatusBadge status={qr.status} />
        </div>
        <QrCodeBlock value={qr.qrCode} size={120} />
      </div>
    </LabelShell>
  )
}

function JobWorkLabel({ qr }: { qr: QrRecord }) {
  const m = qr.metadata
  return (
    <LabelShell title="Job Work Label">
      <div className="grid grid-cols-[1fr_auto] gap-4">
        <div className="space-y-1 text-sm">
          <p><strong>{qr.displayCode}</strong></p>
          <p><span className="text-erp-muted">Vendor:</span> {m.vendorName ?? '—'}</p>
          <p><span className="text-erp-muted">Item:</span> {m.itemCode}</p>
          <p><span className="text-erp-muted">Qty:</span> {m.qty ?? '—'}</p>
          <QrStatusBadge status={qr.status} />
        </div>
        <QrCodeBlock value={qr.qrCode} size={120} />
      </div>
    </LabelShell>
  )
}

function QrLabelView({ qr }: { qr: QrRecord }) {
  switch (qr.entityType) {
    case 'MATERIAL_LOT':
    case 'GRN_LINE':
    case 'ITEM_BATCH':
      return <MaterialLabel qr={qr} />
    case 'SUB_ASSEMBLY':
      return <SubAssemblyLabel qr={qr} />
    case 'FINISHED_TRAILER':
      return <TrailerLabel qr={qr} />
    case 'JOB_WORK_ORDER':
      return <JobWorkLabel qr={qr} />
    default:
      return (
        <LabelShell title={QR_ENTITY_LABELS[qr.entityType]}>
          <div className="flex items-start justify-between gap-4">
            <div className="text-sm">
              <p className="font-semibold">{qr.displayCode}</p>
              <p className="text-erp-muted">{QR_ENTITY_LABELS[qr.entityType]}</p>
              <QrStatusBadge status={qr.status} />
            </div>
            <QrCodeBlock value={qr.qrCode} size={120} />
          </div>
        </LabelShell>
      )
  }
}

export function QrPrintPage() {
  const { qrId } = useParams()
  const qr = useQrStore((s) => (qrId ? s.getQr(qrId) : undefined))

  if (!qr) {
    return <div className="p-12 text-center text-erp-muted">QR not found</div>
  }

  return (
    <div className="space-y-6 print:space-y-0">
      <PageHeader
        title="Print QR Label"
        description={qr.displayCode}
        autoBreadcrumbs
        className="print:hidden"
        actions={
          <button type="button" onClick={() => window.print()} className="rounded bg-erp-accent px-3 py-2 text-sm text-white print:hidden">
            <Printer className="mr-1 inline h-4 w-4" /> Print
          </button>
        }
      />
      <QrLabelView qr={qr} />
    </div>
  )
}

export function QrPrintBatchPage() {
  const [searchParams] = useSearchParams()
  const ids = (searchParams.get('ids') ?? '').split(',').filter(Boolean)
  const records = useQrStore((s) => (ids.length ? ids.map((id) => s.getQr(id)).filter(Boolean) as QrRecord[] : s.records.slice(0, 12)))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Batch QR Labels"
        description={`${records.length} labels`}
        autoBreadcrumbs
        actions={
          <button type="button" onClick={() => window.print()} className="rounded bg-erp-accent px-3 py-2 text-sm text-white print:hidden">
            Print All
          </button>
        }
      />
      <div className="grid gap-6 print:grid-cols-2 lg:grid-cols-2">
        {records.map((qr) => (
          <QrLabelView key={qr.qrId} qr={qr} />
        ))}
      </div>
    </div>
  )
}

export function QrScannerPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [mode, setMode] = useState<ScanMode>((searchParams.get('mode') as ScanMode) || 'Issue')
  const [scan, setScan] = useState(searchParams.get('qr') ?? '')
  const [record, setRecord] = useState<QrRecord | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState('')
  const [form, setForm] = useState({ woId: '', qty: '1', toWarehouseId: '', dispatchId: '', receivedQty: '1', rejectedQty: '0' })
  const warehouses = useMasterStore((s) => s.warehouses)

  useEffect(() => {
    const q = searchParams.get('qr')
    const modeParam = searchParams.get('mode')
    const dispatchId = searchParams.get('dispatchId')
    if (modeParam && SCAN_MODES.includes(modeParam as ScanMode)) {
      setMode(modeParam as ScanMode)
    }
    if (dispatchId) {
      setForm((f) => ({ ...f, dispatchId }))
    }
    if (q?.trim()) {
      setScan(q)
      const r = resolveQrScan(q)
      if (r.ok) {
        setRecord(r.record)
        setMessage(null)
      } else {
        setRecord(null)
        setMessage({ type: 'err', text: r.error })
      }
    }
  }, [searchParams])

  const actions = record ? getAllowedActions(record, mode) : []

  function decode() {
    setMessage(null)
    const r = resolveQrScan(scan)
    if (!r.ok) {
      setRecord(null)
      setMessage({ type: 'err', text: r.error })
      return
    }
    setRecord(r.record)
  }

  async function execute(action: string) {
    if (!record) return
    setMessage(null)
    let result: { ok: boolean; error?: string; message?: string; path?: string } = { ok: false, error: 'Unknown action' }

    if (action === 'Issue to WO') {
      result = qrIssueToWo({ scan: record.qrCode, woId: form.woId, qty: Number(form.qty) || 0 })
    } else if (action === 'Transfer') {
      result = qrTransfer({ scan: record.qrCode, toWarehouseId: form.toWarehouseId, qty: Number(form.qty) || 0 })
    } else if (action === 'WIP Move') {
      result = qrWipMove({ scan: record.qrCode })
    } else if (action === 'Consume to Parent WO') {
      result = qrSaConsume({ scan: record.qrCode, parentWoId: form.woId, qty: Number(form.qty) || 0 })
    } else if (action === 'Start Job Card') {
      result = qrJobCardStart({ scan: record.qrCode })
    } else if (action === 'Complete Job Card') {
      result = qrJobCardComplete({ scan: record.qrCode })
    } else if (action === 'Receive Confirm') {
      result = qrReceiveConfirm({ scan: record.qrCode })
    } else if (action === 'Receive from Vendor') {
      result = qrJobWorkReceive({ scan: record.qrCode, receivedQty: Number(form.receivedQty) || 0, rejectedQty: Number(form.rejectedQty) || 0 })
    } else if (action === 'Open QC' || action === 'Open Final QC') {
      result = qrOpenInspection(record)
      if (result.ok && result.path) navigate(result.path)
    } else if (action === 'Confirm Dispatch') {
      result = qrConfirmDispatch({ scan: record.qrCode, dispatchId: form.dispatchId })
    } else if (action === 'Open WO 360' && record.metadata.woId) {
      navigate(`/work-orders/${record.metadata.woId}/360`)
      return
    } else if (action === 'View Traceability') {
      navigate(`/traceability?qr=${encodeURIComponent(record.displayCode)}`)
      return
    } else if (action === 'Confirm Loading') {
      result = qrConfirmLoading({ scan: record.qrCode })
    } else if (action === 'Validate Vendor Send') {
      result = qrJobWorkSendValidate({ scan: record.qrCode })
    }

    setMessage({ type: result.ok ? 'ok' : 'err', text: result.message ?? result.error ?? (result.ok ? 'Done' : 'Failed') })
    setConfirmOpen(false)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Scanner"
        description="Scan or paste QR JSON — select mode, validate entity, confirm transaction"
        autoBreadcrumbs
        badge="QR First"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-lg border border-erp-border bg-white p-4">
          <label className="block text-sm font-medium">Scan mode</label>
          <select value={mode} onChange={(e) => setMode(e.target.value as ScanMode)} className="w-full rounded border border-erp-border px-3 py-2 text-sm">
            {SCAN_MODES.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>

          <label className="block text-sm font-medium">
            QR code (camera not available — paste JSON or scan with handheld)
            <textarea
              value={scan}
              onChange={(e) => setScan(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded border border-erp-border px-3 py-2 font-mono text-xs"
              placeholder='{"type":"MATERIAL_LOT","id":"LOT-GRN-..."}'
            />
          </label>
          <button type="button" onClick={decode} className="inline-flex items-center gap-2 rounded bg-erp-accent px-4 py-2 text-sm text-white">
            <ScanLine className="h-4 w-4" /> Decode QR
          </button>
        </div>

        {record && (
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="font-semibold">Entity Card</h3>
            <p className="text-sm text-erp-muted">{QR_ENTITY_LABELS[record.entityType]}</p>
            <p className="text-lg font-mono">{record.displayCode}</p>
            <QrStatusBadge status={record.status} />
            <div className="mt-3">
              <QrCodeBlock value={record.qrCode} size={100} />
            </div>
            <ul className="mt-4 space-y-1 text-sm">
              {Object.entries(record.metadata)
                .filter(([, v]) => v)
                .slice(0, 8)
                .map(([k, v]) => (
                  <li key={k}><span className="text-erp-muted">{k}:</span> {String(v)}</li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {record && (
        <div className="rounded-lg border border-erp-border bg-white p-4">
          <h3 className="mb-3 font-semibold">Allowed actions — {mode}</h3>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(mode === 'Issue' || mode === 'WIP Move') && (
              <input value={form.woId} onChange={(e) => setForm((f) => ({ ...f, woId: e.target.value }))} placeholder="WO No or ID" className="rounded border px-3 py-2 text-sm" />
            )}
            {(mode === 'Issue' || mode === 'Transfer') && (
              <>
                <input value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="Qty" type="number" className="rounded border px-3 py-2 text-sm" />
                {mode === 'Transfer' && (
                  <select value={form.toWarehouseId} onChange={(e) => setForm((f) => ({ ...f, toWarehouseId: e.target.value }))} className="rounded border px-3 py-2 text-sm">
                    <option value="">Target warehouse</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.warehouseName}</option>)}
                  </select>
                )}
              </>
            )}
            {mode === 'Dispatch' && (
              <input value={form.dispatchId} onChange={(e) => setForm((f) => ({ ...f, dispatchId: e.target.value }))} placeholder="Dispatch ID" className="rounded border px-3 py-2 text-sm" />
            )}
            {mode === 'Job Work Receive' && (
              <>
                <input value={form.receivedQty} onChange={(e) => setForm((f) => ({ ...f, receivedQty: e.target.value }))} placeholder="Received qty" className="rounded border px-3 py-2 text-sm" />
                <input value={form.rejectedQty} onChange={(e) => setForm((f) => ({ ...f, rejectedQty: e.target.value }))} placeholder="Rejected qty" className="rounded border px-3 py-2 text-sm" />
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {actions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  setPendingAction(action)
                  setConfirmOpen(true)
                  setMessage(null)
                }}
                className="rounded border border-erp-border px-3 py-2 text-sm hover:border-erp-accent"
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {confirmOpen && record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-4 shadow-xl">
            <h3 className="font-semibold">Confirm transaction</h3>
            <p className="mt-2 text-sm text-erp-muted">
              Execute <strong>{pendingAction}</strong> for {record.displayCode}?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded border px-3 py-2 text-sm">Cancel</button>
              <button
                type="button"
                onClick={() => execute(pendingAction)}
                className="inline-flex items-center gap-1 rounded bg-erp-accent px-3 py-2 text-sm text-white"
              >
                <CheckCircle className="h-4 w-4" /> Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {message && (
        <p className={`rounded px-4 py-3 text-sm ${message.type === 'ok' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
          {message.text}
        </p>
      )}
    </div>
  )
}

export function Traceability360Page() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [qrCode, setQrCode] = useState(searchParams.get('qr') ?? '')
  const [trailerNo, setTrailerNo] = useState(searchParams.get('trailerNo') ?? '')
  const [chassisNo, setChassisNo] = useState(searchParams.get('chassisNo') ?? '')
  const [woNo, setWoNo] = useState(searchParams.get('woNo') ?? '')
  const [itemCode, setItemCode] = useState(searchParams.get('itemCode') ?? '')
  const [batchNo, setBatchNo] = useState(searchParams.get('batchNo') ?? '')

  const result = useMemo(
    () => lookupQrTrace({ qrCode, trailerNo, chassisNo, woNo, itemCode, batchNo }),
    [qrCode, trailerNo, chassisNo, woNo, itemCode, batchNo],
  )

  function search() {
    const params = new URLSearchParams()
    if (qrCode) params.set('qr', qrCode)
    if (trailerNo) params.set('trailerNo', trailerNo)
    if (chassisNo) params.set('chassisNo', chassisNo)
    if (woNo) params.set('woNo', woNo)
    if (itemCode) params.set('itemCode', itemCode)
    if (batchNo) params.set('batchNo', batchNo)
    setSearchParams(params, { replace: true })
  }

  const genealogySteps = [
    { key: 'MATERIAL_LOT', label: 'Raw Material (RM)' },
    { key: 'SUB_ASSEMBLY', label: 'Sub Assembly (SA)' },
    { key: 'FINISHED_TRAILER', label: 'Finished Trailer (FG)' },
    { key: 'DISPATCH', label: 'Dispatch' },
    { key: 'CUSTOMER', label: 'Customer', virtual: true },
  ] as const

  const chain = result.qr ? buildTraceChain(result.qr.qrId) : []
  const chainTypes = new Set(chain.map((n) => n.entityType))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Traceability 360"
        description="Full genealogy — Material Lot → WO → SA → FG → QC → Dispatch → Customer"
        autoBreadcrumbs
        actions={
          <Link to="/scan" className="inline-flex items-center gap-1 text-sm text-erp-accent">
            <ScanLine className="h-4 w-4" /> Open Scanner
          </Link>
        }
      />

      <div className="grid gap-3 rounded-lg border border-erp-border bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <input value={qrCode} onChange={(e) => setQrCode(e.target.value)} placeholder="QR code" className="rounded border px-3 py-2 text-sm font-mono" />
        <input value={trailerNo} onChange={(e) => setTrailerNo(e.target.value)} placeholder="Trailer No" className="rounded border px-3 py-2 text-sm" />
        <input value={chassisNo} onChange={(e) => setChassisNo(e.target.value)} placeholder="Chassis No" className="rounded border px-3 py-2 text-sm" />
        <input value={woNo} onChange={(e) => setWoNo(e.target.value)} placeholder="WO No" className="rounded border px-3 py-2 text-sm" />
        <input value={itemCode} onChange={(e) => setItemCode(e.target.value)} placeholder="Item Code" className="rounded border px-3 py-2 text-sm" />
        <input value={batchNo} onChange={(e) => setBatchNo(e.target.value)} placeholder="Batch / Lot" className="rounded border px-3 py-2 text-sm" />
        <button type="button" onClick={search} className="sm:col-span-3 lg:col-span-6 rounded bg-erp-accent px-4 py-2 text-sm font-medium text-white">
          <GitBranch className="mr-1 inline h-4 w-4" /> Trace
        </button>
      </div>

      {result.qr ? (
        <>
          <div className="rounded-lg border border-erp-border bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">{result.qr.displayCode}</h2>
                <p className="text-sm text-erp-muted">{QR_ENTITY_LABELS[result.qr.entityType]}</p>
                <QrStatusBadge status={result.qr.status} />
              </div>
              <QrCodeBlock value={result.qr.qrCode} size={100} />
            </div>
          </div>

          <div className="rounded-lg border border-erp-border bg-white p-4">
            <h3 className="mb-3 font-semibold">Genealogy — RM → SA → FG → Dispatch</h3>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              {genealogySteps.map((step, i) => {
                const present =
                  step.key === 'CUSTOMER'
                    ? chainTypes.has('DISPATCH') && result.qr?.status === 'DISPATCHED'
                    : chainTypes.has(step.key as QrEntityType)
                return (
                  <span key={step.key} className="flex items-center gap-2">
                    {i > 0 && <span className="text-erp-muted">↓</span>}
                    <span
                      className={`rounded-full border px-3 py-1 ${
                        present ? 'border-green-300 bg-green-50 text-green-800' : 'border-erp-border text-erp-muted'
                      }`}
                    >
                      {present && <CheckCircle className="mr-1 inline h-3.5 w-3.5" />}
                      {step.label}
                    </span>
                  </span>
                )
              })}
            </div>
            {chain.length > 0 && (
              <ul className="mt-4 space-y-2">
                {chain.map((n) => (
                  <li key={n.qrId} className="flex items-center justify-between rounded border border-erp-border px-3 py-2 text-sm">
                    <span>{n.label}: <strong>{n.displayCode}</strong></span>
                    <div className="flex items-center gap-2">
                      <QrStatusBadge status={n.status} />
                      <Link to={`/qr/print/${n.qrId}`} className="text-xs text-erp-accent hover:underline">Print</Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <DataGrid
            data={result.history}
            columns={[
              { accessorKey: 'eventAt', header: 'When', cell: ({ row }) => formatDate(row.original.eventAt) },
              { accessorKey: 'eventType', header: 'Event', cell: ({ row }) => QR_EVENT_LABELS[row.original.eventType] },
              { accessorKey: 'referenceNo', header: 'Reference' },
              { accessorKey: 'details', header: 'Details' },
              { accessorKey: 'movementKind', header: 'Movement', cell: ({ row }) => row.original.movementKind ?? '—' },
            ]}
            compact
            emptyMessage="No timeline events."
          />
        </>
      ) : (
        (qrCode || trailerNo || woNo) && <p className="text-sm text-erp-muted">No matching QR registry entry.</p>
      )}
    </div>
  )
}

export function QrRegistryPage() {
  const records = useQrStore((s) => s.records)
  return (
    <div className="space-y-6">
      <PageHeader title="QR Registry" description="All registered QR entities" autoBreadcrumbs />
      <DataGrid
        data={records}
        columns={[
          { accessorKey: 'displayCode', header: 'Code' },
          { accessorKey: 'entityType', header: 'Type', cell: ({ row }) => QR_ENTITY_LABELS[row.original.entityType as QrEntityType] },
          { accessorKey: 'status', header: 'Status', cell: ({ row }) => <QrStatusBadge status={row.original.status} /> },
          { accessorKey: 'createdAt', header: 'Created', cell: ({ row }) => formatDate(row.original.createdAt) },
          {
            id: 'print',
            header: '',
            cell: ({ row }) => (
              <Link to={`/qr/print/${row.original.qrId}`} className="text-xs text-erp-accent hover:underline">Print</Link>
            ),
          },
        ]}
        compact
        emptyMessage="No QR codes registered."
      />
    </div>
  )
}
