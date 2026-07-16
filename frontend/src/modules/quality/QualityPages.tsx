import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  CheckCircle,
  ClipboardCheck,
  Clock,
  Download,
  Printer,
  RefreshCw,
  RotateCcw,
  Share2,
  ShieldAlert,
  SlidersHorizontal,
  TrendingDown,
  Wrench,
  XCircle,
} from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { SmartFilterBar, type FilterChip } from '../../components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '../../components/design-system/StatusDot'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { Select } from '../../components/forms/Inputs'
import { DynamicQcParameterForm } from '../../components/quality/DynamicQcParameterForm'
import { FailedParameterSummary } from '../../components/quality/FailedParameterSummary'
import { QcPlanMissingBlocker } from '../../components/quick-create/QcPlanMissingBlocker'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'
import { NextBestActionPanel } from '../../components/live-erp'
import { buildQcNextActions } from '../../utils/liveErpMetrics'
import { InspectionQrSection } from '../../components/qr/InspectionQrSection'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { validateQcSubmission } from '../../utils/qcDecisionEngine'
import type { QcParameterResult } from '../../types/qcParameters'
import { useUIStore } from '../../store/uiStore'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card'
import { DataTable } from '../../components/tables/DataTable'
import { SearchInput } from '../../components/ui/SearchInput'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '../../components/masters/MasterLayouts'
import { useQualityStore } from '../../store/qualityStore'
import {
  useOpenNcrs,
  useOpenReworks,
  usePendingInspections,
  useQualityMetrics,
} from '../../hooks/useStableStoreData'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useWorkCenterStore } from '../../store/workCenterStore'
import type { NonConformanceReport, QcDecisionResult, QcInspection, ReworkOrder } from '../../types/quality'
import { QC_INSPECTORS, REWORK_TEAMS } from '../../data/quality/inspectionTypes'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
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

function inspectionStatusTone(status: QcInspection['status']): 'success' | 'danger' | 'warning' | 'neutral' {
  if (status === 'pass') return 'success'
  if (status === 'reject') return 'danger'
  if (status === 'rework') return 'warning'
  return 'warning'
}

function computeVendorQualityRating(inspections: QcInspection[]): string {
  const incoming = inspections.filter((i) => i.category === 'incoming' && i.status !== 'pending')
  if (incoming.length === 0) return '—'
  const passed = incoming.filter((i) => i.status === 'pass').length
  return `${Math.round((passed / incoming.length) * 100)}%`
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function QualityDashboardPage() {
  const metrics = useQualityMetrics()
  const pending = usePendingInspections()
  const openRework = useOpenReworks()
  const openNcrs = useOpenNcrs()

  return (
    <div>
      <PageHeader
        title="Quality Dashboard"
        description="Manufacturing quality closure — inspections, rework, and NCR tracking"
        actions={
          <Link to="/quality/queue">
            <Button size="sm">
              <ClipboardCheck className="h-4 w-4" />
              QC Queue ({metrics.pendingInspections})
            </Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Pending Inspections" value={metrics.pendingInspections} icon={Clock} accent="amber" />
        <StatCard title="Open Rework" value={metrics.openRework} icon={RotateCcw} accent="purple" />
        <StatCard title="Open NCR" value={metrics.openNcr} icon={ShieldAlert} accent="red" />
        <StatCard
          title="First Pass Yield"
          value={`${metrics.firstPassYieldPct}%`}
          icon={CheckCircle}
          accent="green"
        />
        <StatCard
          title="Rework Hours"
          value={formatNumber(metrics.totalReworkHours)}
          icon={Wrench}
          accent="blue"
        />
        <StatCard
          title="Defect Trend"
          value={metrics.defectTrend.reduce((s, d) => s + d.count, 0)}
          icon={TrendingDown}
          accent="red"
          helper={metrics.defectTrend.length ? `${metrics.defectTrend.at(-1)?.label}: ${metrics.defectTrend.at(-1)?.count} rejects` : 'No rejects yet'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Pending QC Queue</CardTitle>
            <Link to="/quality/queue" className="text-xs text-erp-accent hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 && <p className="text-sm text-slate-500">No inspections pending.</p>}
            {pending.slice(0, 5).map((i) => (
              <Link
                key={i.id}
                to={`/quality/inspections/${i.id}`}
                className="flex items-center justify-between rounded border border-slate-200 px-3 py-2 hover:bg-slate-50"
              >
                <div>
                  <p className="font-mono text-xs font-medium">{i.inspectionNo}</p>
                  <p className="text-xs text-slate-600">
                    {i.woNo} · {i.operationName}
                  </p>
                </div>
                <Badge color="yellow">{i.isReinspection ? 'Re-inspection' : 'Pending'}</Badge>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Open Rework & NCR</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {openRework.slice(0, 3).map((r) => (
              <Link key={r.id} to="/quality/rework" className="block rounded border border-purple-200 bg-purple-50/50 px-3 py-2">
                <p className="font-mono text-xs font-medium text-purple-900">{r.reworkNo}</p>
                <p className="text-xs text-purple-800">
                  {r.woNo} · {r.operationName} · {formatStatus(r.status)}
                </p>
              </Link>
            ))}
            {openNcrs.slice(0, 3).map((n) => (
              <Link key={n.id} to={`/quality/ncr/${n.id}`} className="block rounded border border-red-200 bg-red-50/50 px-3 py-2">
                <p className="font-mono text-xs font-medium text-red-900">{n.ncrNo}</p>
                <p className="text-xs text-red-800">{n.defectDescription}</p>
              </Link>
            ))}
            {openRework.length === 0 && openNcrs.length === 0 && (
              <p className="text-sm text-slate-500">No open rework or NCR records.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── QC Queue ────────────────────────────────────────────────────────────────

export function QcQueuePage() {
  const navigate = useNavigate()
  const inspections = useQualityStore((s) => s.inspections)
  const metrics = useQualityMetrics()
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'pending' | 'decided'>('pending')
  const [savedView, setSavedView] = useState('My View')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const rows = useMemo(() => {
    let list = inspections.filter((i) => i.category !== 'incoming')
    if (filter === 'pending') list = list.filter((i) => i.status === 'pending')
    if (filter === 'decided') list = list.filter((i) => i.status !== 'pending')
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (i) =>
          i.inspectionNo.toLowerCase().includes(s) ||
          (i.woNo ?? '').toLowerCase().includes(s) ||
          i.operationName.toLowerCase().includes(s) ||
          i.inspectionType.toLowerCase().includes(s),
      )
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [inspections, filter, search, refreshKey])

  const vendorRating = useMemo(() => computeVendorQualityRating(inspections), [inspections])

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []
    if (filter !== 'all') chips.push({ id: 'status', label: filter === 'pending' ? 'Pending' : 'Decided' })
    if (search) chips.push({ id: 'search', label: `Search: ${search}` })
    return chips
  }, [filter, search])

  function removeChip(id: string) {
    if (id === 'status') setFilter('all')
    if (id === 'search') setSearch('')
  }

  function openQuickView(inspection: QcInspection) {
    setSelectedRowId(inspection.id)
    openDetailPanel({
      title: inspection.inspectionNo,
      subtitle: `${inspection.woNo ?? '—'} · ${inspection.operationName}`,
      fields: [
        { label: 'Work Order', value: inspection.woNo ?? '—' },
        { label: 'Operation', value: inspection.operationName },
        { label: 'Type', value: inspection.inspectionType },
        { label: 'Status', value: inspection.isReinspection && inspection.status === 'pending' ? 'Re-inspection' : formatStatus(inspection.status) },
        { label: 'Inspector', value: inspection.inspector ?? '—' },
      ],
      links: [{ label: 'Open Inspection', href: `/quality/inspections/${inspection.id}` }],
      timeline: [{ id: 'current', label: formatStatus(inspection.status), time: formatDate(inspection.createdAt.slice(0, 10)), status: 'current' }],
    })
  }

  const columns: ColumnDef<QcInspection, unknown>[] = [
    {
      accessorKey: 'inspectionNo',
      header: 'Inspection',
      cell: ({ row }) => (
        <Link to={`/quality/inspections/${row.original.id}`} className="font-mono text-xs font-medium text-erp-primary hover:underline">
          {row.original.inspectionNo}
        </Link>
      ),
    },
    { accessorKey: 'woNo', header: 'WO' },
    { accessorKey: 'operationName', header: 'Operation' },
    { accessorKey: 'inspectionType', header: 'Type' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot
          label={row.original.isReinspection && row.original.status === 'pending' ? 're-inspection' : row.original.status}
          tone={inspectionStatusTone(row.original.status)}
        />
      ),
    },
    {
      accessorKey: 'inspector',
      header: 'Inspector',
      cell: ({ row }) => row.original.inspector ?? '—',
    },
  ]

  return (
    <OperationalPageShell
      title="QC Queue"
      description="Operations awaiting quality decision — Welding, Leak Test, Paint DFT, Pressure Test"
      favoritePath="/quality/queue"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={ClipboardCheck} label="Inspect Next" onClick={() => rows.find((r) => r.status === 'pending') && navigate(`/quality/inspections/${rows.find((r) => r.status === 'pending')!.id}`)} primary />
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
        { label: 'Pending Inspection', value: metrics.pendingInspections, accent: metrics.pendingInspections > 0 ? 'amber' : 'green' },
        { label: 'Open NCR', value: metrics.openNcr, accent: metrics.openNcr > 0 ? 'red' : 'green' },
        { label: 'Open Rework', value: metrics.openRework, accent: metrics.openRework > 0 ? 'amber' : 'green' },
        { label: 'First Pass Yield', value: `${metrics.firstPassYieldPct}%`, accent: metrics.firstPassYieldPct >= 90 ? 'green' : 'amber' },
        { label: 'Vendor Quality Rating', value: vendorRating, accent: 'blue' },
      ]}
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={removeChip}
          onClearAll={() => { setFilter('all'); setSearch('') }}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={rows.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search WO, operation, inspection…" className="w-full sm:w-72" />
          <Select wrapClassName="w-36" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="h-9">
            <option value="pending">Pending</option>
            <option value="decided">Decided</option>
            <option value="all">All</option>
          </Select>
        </SmartFilterBar>
      }
    >
      <DataTable
        data={rows}
        columns={columns}
        stickyFirstColumn
        zebra
        showToolbar={false}
        selectedRowId={selectedRowId}
        onRowSelect={(row) => setSelectedRowId(row.id)}
        onRowQuickView={openQuickView}
        onRowView={(row) => row.status === 'pending' && navigate(`/quality/inspections/${row.id}`)}
        emptyMessage="No inspections match your filters."
        emptyAction={
          <Link to="/quality">
            <Button size="sm" variant="secondary"><ClipboardCheck className="h-4 w-4" /> Quality Dashboard</Button>
          </Link>
        }
        exportFileName="qc-queue"
      />
    </OperationalPageShell>
  )
}

// ─── QC Inspection Detail ────────────────────────────────────────────────────

function IncomingQcDetail({
  inspection,
  onDone,
}: {
  inspection: QcInspection
  onDone: (msg: string, path: string) => void
}) {
  const recordIncoming = useQualityStore((s) => s.recordIncomingQcDecision)
  const grn = usePurchaseStore((s) => (inspection.grnId ? s.getGrn(inspection.grnId) : undefined))
  const [inspector, setInspector] = useState<string>(QC_INSPECTORS[0])
  const [remarks, setRemarks] = useState('')
  const totalReceived = grn?.lines.reduce((s, l) => s + l.receivedQty, 0) ?? 0
  const [acceptedQty, setAcceptedQty] = useState(totalReceived)
  const [rejectedQty, setRejectedQty] = useState(0)
  const [parameterResults, setParameterResults] = useState<QcParameterResult[]>(() =>
    inspection.parameterResults.map((r) => ({ ...r })),
  )
  const decided = inspection.status !== 'pending'

  function submit(result: 'pass' | 'reject') {
    const r = recordIncoming(inspection.id, {
      inspector,
      result,
      remarks,
      acceptedQty: result === 'pass' ? acceptedQty : 0,
      rejectedQty: result === 'reject' ? rejectedQty || totalReceived : rejectedQty,
      quarantineQty: result === 'reject' ? rejectedQty || totalReceived : 0,
      parameterResults,
      useAutoDecision: true,
    })
    if (!r.ok) {
      onDone(r.error ?? 'Decision failed', '')
      return
    }
    onDone(result === 'pass' ? 'Incoming QC passed — stock released' : 'Incoming QC rejected — NCR raised', '/quality/incoming')
  }

  return (
    <>
      <DetailSection title="Incoming Material Context">
        <DetailGrid>
          <DetailField label="GRN" value={inspection.grnNo ?? '—'} />
          <DetailField label="PO" value={inspection.poId ? inspection.poId : '—'} />
          <DetailField label="Item" value={inspection.itemCode ?? '—'} />
          <DetailField label="Total Received" value={String(totalReceived)} />
        </DetailGrid>
      </DetailSection>
      {parameterResults.length > 0 && (
        <DetailSection title="Incoming QC Parameters">
          <DynamicQcParameterForm results={parameterResults} onChange={setParameterResults} disabled={decided} inspector={inspector} />
        </DetailSection>
      )}
      {!decided && (
        <DetailSection title="Incoming QC Decision">
          <div className="grid max-w-xl gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Inspector</span>
              <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={inspector} onChange={(e) => setInspector(e.target.value)}>
                {QC_INSPECTORS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Accepted Qty</span>
              <input type="number" min={0} max={totalReceived} className="w-full rounded border px-3 py-2 text-sm" value={acceptedQty} onChange={(e) => setAcceptedQty(Number(e.target.value))} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Rejected Qty</span>
              <input type="number" min={0} max={totalReceived} className="w-full rounded border px-3 py-2 text-sm" value={rejectedQty} onChange={(e) => setRejectedQty(Number(e.target.value))} />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Remarks</span>
              <textarea className="w-full rounded border border-slate-300 px-3 py-2 text-sm" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="success" size="sm" onClick={() => submit('pass')}>Accept Material</Button>
            <Button variant="danger" size="sm" onClick={() => submit('reject')}>Reject Material</Button>
          </div>
        </DetailSection>
      )}
    </>
  )
}

function FinalQcDetail({
  inspection,
  onDone,
}: {
  inspection: QcInspection
  onDone: (msg: string, path: string) => void
}) {
  const recordFinal = useQualityStore((s) => s.recordFinalQcDecision)
  const [inspector, setInspector] = useState<string>(QC_INSPECTORS[0])
  const [remarks, setRemarks] = useState('')
  const [parameterResults, setParameterResults] = useState(() => inspection.parameterResults)
  const [adminOverride, setAdminOverride] = useState('')
  const [checklist, setChecklist] = useState(() => inspection.checklistSnapshot.map((c) => ({ ...c })))
  const decided = inspection.status !== 'pending'
  const hasDynamic = parameterResults.length > 0
  const planMissing = inspection.parameterSnapshot.length === 0 && !hasDynamic
  const allMandatoryPassed = hasDynamic
    ? parameterResults.every((r) => !r.mandatory || r.passed === true)
    : checklist.every((c) => c.passed)

  function submit(result: 'pass' | 'reject') {
    if (result === 'pass' && planMissing && !adminOverride.trim()) {
      onDone('Inspection plan required — provide admin override reason or load a plan', '')
      return
    }
    if (result === 'pass' && !hasDynamic && !allMandatoryPassed) {
      onDone('Complete all final QC checklist items before pass', '')
      return
    }
    const r = recordFinal(inspection.id, {
      inspector,
      result,
      remarks,
      parameterResults: hasDynamic ? parameterResults : undefined,
      useAutoDecision: true,
      adminOverrideReason: planMissing ? adminOverride : undefined,
    })
    if (!r.ok) {
      onDone(r.error ?? 'Decision failed', '')
      return
    }
    onDone(result === 'pass' ? 'Final QC approved — dispatch enabled' : 'Final QC rejected', '/quality/queue')
  }

  return (
    <>
      <DetailSection title="Final FG QC Context">
        <DetailGrid>
          <DetailField label="Work Order" value={inspection.woNo ?? '—'} />
          <DetailField label="Item" value={inspection.itemCode ?? '—'} />
          <DetailField label="Inspection Type" value={inspection.inspectionType} />
          <DetailField label="Plan" value={inspection.planId ?? '—'} />
        </DetailGrid>
        {planMissing && !decided && (
          <QcPlanMissingBlocker
            operationName={inspection.operationName ?? undefined}
            itemId={inspection.itemId ?? undefined}
            className="mt-3"
          />
        )}
      </DetailSection>
      {hasDynamic ? (
        <DetailSection title="Final QC Parameters">
          <DynamicQcParameterForm results={parameterResults} onChange={setParameterResults} disabled={decided} inspector={inspector} />
          {!decided && <FailedParameterSummary results={parameterResults} className="mt-4" />}
        </DetailSection>
      ) : (
        <DetailSection title="Final QC Checklist">
          <ul className="space-y-2">
            {checklist.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={c.passed}
                  disabled={decided}
                  onChange={(e) => setChecklist((prev) => prev.map((x) => (x.id === c.id ? { ...x, passed: e.target.checked } : x)))}
                />
                {c.label}
              </label>
            ))}
          </ul>
        </DetailSection>
      )}
      {!decided && (
        <DetailSection title="Final QC Decision">
          <div className="grid max-w-xl gap-4">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Inspector</span>
              <select className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={inspector} onChange={(e) => setInspector(e.target.value)}>
                {QC_INSPECTORS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {planMissing && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Admin Override Reason</span>
                <input className="w-full rounded border border-slate-300 px-3 py-2 text-sm" value={adminOverride} onChange={(e) => setAdminOverride(e.target.value)} placeholder="Required to pass without plan" />
              </label>
            )}
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Remarks</span>
              <textarea className="w-full rounded border border-slate-300 px-3 py-2 text-sm" rows={3} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </label>
          </div>
          <div className="mt-6 flex gap-3">
            <Button variant="success" size="sm" onClick={() => submit('pass')}>Approve Final QC</Button>
            <Button variant="danger" size="sm" onClick={() => submit('reject')}>Reject Final QC</Button>
          </div>
        </DetailSection>
      )}
    </>
  )
}

export function QcInspectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast, show } = useToast()
  const inspection = useQualityStore((s) => (id ? s.getInspection(id) : undefined))
  const recordDecision = useQualityStore((s) => s.recordInspectionDecision)
  const workCenters = useWorkCenterStore((s) => s.workCenters)

  const [inspector, setInspector] = useState<string>(QC_INSPECTORS[0])
  const [remarks, setRemarks] = useState('')
  const [reworkHours, setReworkHours] = useState(4)
  const [reworkWc, setReworkWc] = useState('')
  const [ncrSeverity, setNcrSeverity] = useState<'minor' | 'major' | 'critical'>('major')
  const [defectDesc, setDefectDesc] = useState('')
  const [parameterResults, setParameterResults] = useState<QcParameterResult[]>(() =>
    inspection?.parameterResults.map((r) => ({ ...r })) ?? [],
  )

  if (!inspection) {
    return (
      <div className="p-8 text-center text-slate-500">
        Inspection not found.{' '}
        <Link to="/quality/queue" className="text-erp-accent hover:underline">
          Back to queue
        </Link>
      </div>
    )
  }

  const backTo =
    inspection.category === 'incoming' ? '/quality/incoming' : '/quality/queue'
  const backLabel = inspection.category === 'incoming' ? 'Incoming QC' : 'QC Queue'

  function handleDone(msg: string, path: string) {
    show(msg)
    if (path) navigate(path)
  }

  function submit(result: QcDecisionResult) {
    const r = recordDecision(inspection!.id, {
      inspector,
      result,
      remarks,
      reworkEstimatedHours: reworkHours,
      reworkWorkCenterId: reworkWc || undefined,
      ncrSeverity,
      ncrDefectDescription: defectDesc,
      materialSegregated: result === 'reject',
      parameterResults,
      useAutoDecision: true,
    })
    if (!r.ok) {
      show(r.error ?? 'Decision failed')
      return
    }
    const auto = parameterResults.length ? validateQcSubmission(parameterResults).autoDecision : result
    const effective = parameterResults.length ? auto : result
    if (effective === 'pass') show('QC PASS — next operation released')
    if (effective === 'rework') show(`Rework order created — ${r.reworkId}`)
    if (effective === 'reject') show(`NCR raised — WO blocked (${r.ncrId})`)
    navigate('/quality/queue')
  }

  const decided = inspection.status !== 'pending'

  return (
    <div>
      <Toast message={toast} />
      <DetailLayout
        backTo={backTo}
        backLabel={backLabel}
        title={inspection.inspectionNo}
        subtitle={`${inspection.inspectionType} · ${formatStatus(inspection.category)}`}
        badges={
          <Badge color={statusColor(inspection.status)}>{formatStatus(inspection.status)}</Badge>
        }
      >
        <div className="mb-4 max-w-md">
          <NextBestActionPanel actions={buildQcNextActions(inspection)} title="Next Best Actions" compact />
        </div>
        <InspectionQrSection inspection={inspection} />

        <DetailSection title="Serial Traceability">
          <SerialGenealogyPanel
            workOrderId={inspection.workOrderId}
            grnId={inspection.grnId}
            compact
          />
        </DetailSection>

        {inspection.category === 'incoming' && (
          <IncomingQcDetail inspection={inspection} onDone={handleDone} />
        )}

        {inspection.category === 'final' && (
          <FinalQcDetail inspection={inspection} onDone={handleDone} />
        )}

        {inspection.category === 'in_process' && (
          <>
        <DetailSection title="Work Order Context">
          <DetailGrid>
            <DetailField label="Work Order" value={inspection.woNo ?? '—'} />
            <DetailField label="Operation" value={`Seq ${inspection.sequenceNo} — ${inspection.operationName}`} />
            <DetailField label="Inspection Type" value={inspection.inspectionType} />
            <DetailField label="Job Card" value={inspection.jobCardId ?? '—'} />
            {inspection.isReinspection && <DetailField label="Type" value="Re-inspection after rework" />}
          </DetailGrid>
        </DetailSection>

        {inspection.checklistSnapshot.length > 0 && (
          <DetailSection title="Shop Floor Checklist (snapshot)">
            <ul className="space-y-1 text-sm">
              {inspection.checklistSnapshot.map((c) => (
                <li key={c.id} className="flex items-center gap-2">
                  {c.passed ? (
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  {c.label}
                </li>
              ))}
            </ul>
          </DetailSection>
        )}

        {inspection.parameterResults.length === 0 && !decided && inspection.category === 'in_process' && (
          <QcPlanMissingBlocker
            operationName={inspection.operationName ?? undefined}
            itemId={inspection.itemId ?? undefined}
            className="mb-4"
          />
        )}

        {inspection.parameterResults.length > 0 && (
          <DetailSection title="Process QC Parameters">
            <DynamicQcParameterForm
              results={parameterResults}
              onChange={setParameterResults}
              disabled={decided}
              inspector={inspector}
            />
            {!decided && parameterResults.length > 0 && (
              <p className="mt-2 text-[12px] text-erp-muted">
                Auto decision: {validateQcSubmission(parameterResults).autoDecision?.toUpperCase() ?? '—'}
              </p>
            )}
          </DetailSection>
        )}

        {!decided && (
          <DetailSection title="QC Decision">
            <div className="grid max-w-xl gap-4">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Inspector</span>
                <select
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  value={inspector}
                  onChange={(e) => setInspector(e.target.value)}
                >
                  {QC_INSPECTORS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Remarks</span>
                <textarea
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                  rows={3}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Inspection notes, measurements, defect location…"
                />
              </label>
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <Card className="border-emerald-200">
                <CardContent className="py-4">
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-emerald-800">
                    <CheckCircle className="h-4 w-4" /> PASS
                  </h4>
                  <p className="mb-3 text-xs text-slate-600">Release operation and enable next routing step.</p>
                  <Button variant="success" size="sm" onClick={() => submit('pass')}>
                    Record Pass
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-amber-200">
                <CardContent className="py-4">
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-amber-800">
                    <RotateCcw className="h-4 w-4" /> REWORK
                  </h4>
                  <label className="mb-2 block text-xs">
                    Est. hours
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      className="mt-1 w-full rounded border px-2 py-1"
                      value={reworkHours}
                      onChange={(e) => setReworkHours(Number(e.target.value))}
                    />
                  </label>
                  <label className="mb-3 block text-xs">
                    Work center
                    <select
                      className="mt-1 w-full rounded border px-2 py-1"
                      value={reworkWc}
                      onChange={(e) => setReworkWc(e.target.value)}
                    >
                      <option value="">Same as operation</option>
                      {workCenters.map((w) => (
                        <option key={w.id} value={w.id}>
                          {w.workCenterCode}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button variant="secondary" size="sm" onClick={() => submit('rework')}>
                    Create Rework
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-red-200">
                <CardContent className="py-4">
                  <h4 className="mb-2 flex items-center gap-2 font-semibold text-red-800">
                    <AlertTriangle className="h-4 w-4" /> REJECT
                  </h4>
                  <label className="mb-2 block text-xs">
                    Severity
                    <select
                      className="mt-1 w-full rounded border px-2 py-1"
                      value={ncrSeverity}
                      onChange={(e) => setNcrSeverity(e.target.value as typeof ncrSeverity)}
                    >
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="critical">Critical</option>
                    </select>
                  </label>
                  <label className="mb-3 block text-xs">
                    Defect description
                    <input
                      className="mt-1 w-full rounded border px-2 py-1"
                      value={defectDesc}
                      onChange={(e) => setDefectDesc(e.target.value)}
                      placeholder="e.g. Porosity in longitudinal seam"
                    />
                  </label>
                  <Button variant="danger" size="sm" onClick={() => submit('reject')}>
                    Raise NCR
                  </Button>
                </CardContent>
              </Card>
            </div>
          </DetailSection>
        )}
          </>
        )}

        {decided && (
          <DetailSection title="Decision Record">
            <DetailGrid>
              <DetailField label="Result" value={formatStatus(inspection.status)} />
              <DetailField label="Inspector" value={inspection.inspector ?? '—'} />
              <DetailField label="Date" value={inspection.inspectionDate ? formatDate(inspection.inspectionDate) : '—'} />
              <DetailField label="Remarks" value={inspection.remarks || '—'} />
              {inspection.acceptedQty != null && (
                <DetailField label="Accepted Qty" value={String(inspection.acceptedQty)} />
              )}
              {inspection.rejectedQty != null && inspection.rejectedQty > 0 && (
                <DetailField label="Rejected Qty" value={String(inspection.rejectedQty)} />
              )}
              {inspection.reworkOrderId && (
                <DetailField
                  label="Rework"
                  value={
                    <Link to="/quality/rework" className="text-erp-accent hover:underline">
                      View rework workbench
                    </Link>
                  }
                />
              )}
              {inspection.ncrId && (
                <DetailField
                  label="NCR"
                  value={
                    <Link to={`/quality/ncr/${inspection.ncrId}`} className="text-erp-accent hover:underline">
                      View NCR
                    </Link>
                  }
                />
              )}
            </DetailGrid>
          </DetailSection>
        )}
        <div className="mt-6">
          <EntityDocumentsPanel entityType="qc_inspection" entityId={inspection.id} title="Inspection Documents" />
        </div>
      </DetailLayout>
    </div>
  )
}

// ─── Rework Workbench ────────────────────────────────────────────────────────

export function ReworkWorkbenchPage() {
  const reworks = useQualityStore((s) => s.reworks)
  const startRework = useQualityStore((s) => s.startRework)
  const completeRework = useQualityStore((s) => s.completeRework)
  const { toast, show } = useToast()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [team, setTeam] = useState<string>(REWORK_TEAMS[0])
  const [hours, setHours] = useState(2)
  const [remarks, setRemarks] = useState('')

  const active = reworks.filter((r) => r.status !== 'closed' && r.status !== 'reinspected')
  const selected = active.find((r) => r.id === selectedId) ?? active[0]

  const columns: ColumnDef<ReworkOrder, unknown>[] = [
    {
      accessorKey: 'reworkNo',
      header: 'Rework No',
      cell: ({ row }) => (
        <button type="button" className="font-mono text-xs font-medium text-erp-accent hover:underline" onClick={() => setSelectedId(row.original.id)}>
          {row.original.reworkNo}
        </button>
      ),
    },
    { accessorKey: 'woNo', header: 'WO' },
    { accessorKey: 'operationName', header: 'Operation' },
    { accessorKey: 'workCenterCode', header: 'Work Center' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <Badge color={statusColor(row.original.status)}>{formatStatus(row.original.status)}</Badge>,
    },
    {
      accessorKey: 'estimatedHours',
      header: 'Est / Act Hrs',
      cell: ({ row }) =>
        `${row.original.estimatedHours} / ${row.original.actualHours ?? '—'}`,
    },
  ]

  function handleStart() {
    if (!selected) return
    const r = startRework(selected.id, { assignedTeam: team })
    show(r.ok ? 'Rework started' : (r.error ?? 'Failed'))
  }

  function handleComplete() {
    if (!selected) return
    const r = completeRework(selected.id, { actualHours: hours, remarks })
    show(r.ok ? 'Rework complete — re-inspection queued' : (r.error ?? 'Failed'))
  }

  return (
    <div>
      <Toast message={toast} />
      <PageHeader
        title="Rework Workbench"
        description="Linked rework jobs — assign team, track hours, submit for re-inspection"
        breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Rework' }]}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <DataTable data={active} columns={columns} />
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Rework Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected && <p className="text-sm text-slate-500">No open rework orders.</p>}
            {selected && (
              <>
                <p className="font-mono text-sm font-medium">{selected.reworkNo}</p>
                <p className="text-xs text-slate-600">
                  {selected.woNo} · {selected.operationName} · {formatStatus(selected.status)}
                </p>
                {selected.status === 'open' && (
                  <>
                    <label className="block text-sm">
                      Team
                      <select className="mt-1 w-full rounded border px-2 py-1.5 text-sm" value={team} onChange={(e) => setTeam(e.target.value)}>
                        {REWORK_TEAMS.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button size="sm" onClick={handleStart}>
                      Start Rework
                    </Button>
                  </>
                )}
                {selected.status === 'in_progress' && (
                  <>
                    <label className="block text-sm">
                      Actual hours
                      <input
                        type="number"
                        min={0.5}
                        step={0.5}
                        className="mt-1 w-full rounded border px-2 py-1.5 text-sm"
                        value={hours}
                        onChange={(e) => setHours(Number(e.target.value))}
                      />
                    </label>
                    <label className="block text-sm">
                      Remarks
                      <textarea className="mt-1 w-full rounded border px-2 py-1.5 text-sm" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                    </label>
                    <Button size="sm" variant="success" onClick={handleComplete}>
                      Complete & Queue Re-inspection
                    </Button>
                  </>
                )}
                {selected.status === 'completed' && (
                  <p className="text-sm text-amber-700">Awaiting re-inspection in QC queue.</p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// ─── NCR Register ──────────────────────────────────────────────────────────────

export function NcrRegisterPage() {
  const navigate = useNavigate()
  const ncrs = useQualityStore((s) => s.ncrs)
  const metrics = useQualityMetrics()
  const inspections = useQualityStore((s) => s.inspections)
  const openDetailPanel = useUIStore((s) => s.openDetailPanel)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [savedView, setSavedView] = useState('My View')
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const vendorRating = useMemo(() => computeVendorQualityRating(inspections), [inspections])

  const rows = useMemo(() => {
    let list = [...ncrs]
    if (statusFilter) list = list.filter((n) => n.status === statusFilter)
    if (search) {
      const s = search.toLowerCase()
      list = list.filter(
        (n) =>
          n.ncrNo.toLowerCase().includes(s) ||
          (n.woNo ?? '').toLowerCase().includes(s) ||
          n.defectDescription.toLowerCase().includes(s),
      )
    }
    return list
  }, [ncrs, statusFilter, search, refreshKey])

  const filterChips = useMemo((): FilterChip[] => {
    const chips: FilterChip[] = []
    if (statusFilter) chips.push({ id: 'status', label: formatStatus(statusFilter) })
    if (search) chips.push({ id: 'search', label: `Search: ${search}` })
    return chips
  }, [statusFilter, search])

  function openQuickView(ncr: NonConformanceReport) {
    setSelectedRowId(ncr.id)
    openDetailPanel({
      title: ncr.ncrNo,
      subtitle: ncr.defectDescription,
      fields: [
        { label: 'Work Order', value: ncr.woNo ?? '—' },
        { label: 'Item', value: ncr.itemCode },
        { label: 'Operation', value: ncr.operationName },
        { label: 'Severity', value: formatStatus(ncr.severity) },
        { label: 'Status', value: formatStatus(ncr.status) },
        { label: 'Material Segregated', value: ncr.materialSegregated ? 'Yes' : 'No' },
      ],
      links: [{ label: 'Open NCR', href: `/quality/ncr/${ncr.id}` }],
      timeline: [{ id: 'reported', label: 'Reported', time: formatDate(ncr.reportedDate), status: 'done' }],
    })
  }

  const columns: ColumnDef<NonConformanceReport, unknown>[] = [
    {
      accessorKey: 'ncrNo',
      header: 'NCR No',
      cell: ({ row }) => (
        <Link to={`/quality/ncr/${row.original.id}`} className="font-mono text-xs font-medium text-erp-primary hover:underline">
          {row.original.ncrNo}
        </Link>
      ),
    },
    { accessorKey: 'woNo', header: 'WO' },
    { accessorKey: 'itemCode', header: 'Item' },
    { accessorKey: 'operationName', header: 'Operation' },
    { accessorKey: 'defectDescription', header: 'Defect' },
    {
      accessorKey: 'severity',
      header: 'Severity',
      cell: ({ row }) => (
        <StatusDot label={row.original.severity} tone={statusToneFromLabel(row.original.severity)} />
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot label={row.original.status} tone={statusToneFromLabel(row.original.status)} />
      ),
    },
    {
      accessorKey: 'materialSegregated',
      header: 'Segregated',
      cell: ({ row }) => (row.original.materialSegregated ? 'Yes' : 'No'),
      meta: { align: 'center' },
    },
  ]

  return (
    <OperationalPageShell
      title="NCR Register"
      description="Non-conformance reports — material segregation, engineering review, closure"
      favoritePath="/quality/ncr"
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={ShieldAlert} label="QC Queue" onClick={() => navigate('/quality/queue')} primary />
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
        { label: 'Pending Inspection', value: metrics.pendingInspections, accent: 'amber' },
        { label: 'Open NCR', value: metrics.openNcr, accent: metrics.openNcr > 0 ? 'red' : 'green' },
        { label: 'Open Rework', value: metrics.openRework, accent: 'amber' },
        { label: 'First Pass Yield', value: `${metrics.firstPassYieldPct}%`, accent: 'green' },
        { label: 'Vendor Quality Rating', value: vendorRating, accent: 'blue' },
      ]}
      filterBar={
        <SmartFilterBar
          chips={filterChips}
          onRemoveChip={(id) => { if (id === 'status') setStatusFilter(''); if (id === 'search') setSearch('') }}
          onClearAll={() => { setStatusFilter(''); setSearch('') }}
          savedView={savedView}
          onSavedViewChange={setSavedView}
          resultCount={rows.length}
        >
          <SearchInput value={search} onChange={setSearch} placeholder="Search NCR, WO, defect…" className="w-full sm:w-72" />
          <Select wrapClassName="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="corrective_action">Corrective Action</option>
            <option value="approved">Approved</option>
            <option value="closed">Closed</option>
          </Select>
        </SmartFilterBar>
      }
    >
      <DataTable
        data={rows}
        columns={columns}
        stickyFirstColumn
        zebra
        showToolbar={false}
        selectedRowId={selectedRowId}
        onRowSelect={(row) => setSelectedRowId(row.id)}
        onRowQuickView={openQuickView}
        emptyMessage="No NCR records match your filters."
        emptyAction={
          <Link to="/quality/queue">
            <Button size="sm" variant="secondary"><ClipboardCheck className="h-4 w-4" /> QC Queue</Button>
          </Link>
        }
        exportFileName="ncr-register"
      />
    </OperationalPageShell>
  )
}

// ─── NCR Detail ──────────────────────────────────────────────────────────────

export function NcrDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { toast, show } = useToast()
  const ncr = useQualityStore((s) => (id ? s.getNcr(id) : undefined))
  const sourceInspection = useQualityStore((s) => (ncr?.inspectionId ? s.getInspection(ncr.inspectionId) : undefined))
  const updateNcr = useQualityStore((s) => s.updateNcr)
  const advanceNcrStatus = useQualityStore((s) => s.advanceNcrStatus)
  const closeNcr = useQualityStore((s) => s.closeNcr)

  const [rootCause, setRootCause] = useState(ncr?.rootCause ?? '')
  const [corrective, setCorrective] = useState(ncr?.correctiveAction ?? '')
  const [disposition, setDisposition] = useState(ncr?.disposition ?? '')
  const [engReview, setEngReview] = useState(ncr?.engineeringReview ?? '')

  if (!ncr) {
    return (
      <div className="p-8 text-center text-slate-500">
        NCR not found.{' '}
        <Link to="/quality/ncr" className="text-erp-accent hover:underline">
          Back to register
        </Link>
      </div>
    )
  }

  function saveFields() {
    updateNcr(ncr!.id, {
      rootCause,
      correctiveAction: corrective,
      disposition,
      engineeringReview: engReview,
    })
    show('NCR updated')
  }

  const nextStatus: Record<string, string | null> = {
    open: 'investigating',
    investigating: 'corrective_action',
    corrective_action: 'approved',
    approved: null,
    closed: null,
  }
  const next = nextStatus[ncr.status]

  return (
    <div>
      <Toast message={toast} />
      <DetailLayout
        backTo="/quality/ncr"
        backLabel="NCR Register"
        title={ncr.ncrNo}
        subtitle={ncr.defectDescription}
        badges={<Badge color={statusColor(ncr.status)}>{formatStatus(ncr.status)}</Badge>}
      >
        <DetailSection title="Non-Conformance">
          <DetailGrid>
            <DetailField label="Work Order" value={ncr.woNo} />
            <DetailField label="Item" value={ncr.itemCode} />
            <DetailField label="Operation" value={ncr.operationName} />
            <DetailField label="Severity" value={formatStatus(ncr.severity)} />
            <DetailField label="Reported By" value={ncr.reportedBy} />
            <DetailField label="Reported Date" value={formatDate(ncr.reportedDate)} />
            <DetailField label="Material Segregated" value={ncr.materialSegregated ? 'Yes' : 'No'} />
          </DetailGrid>
        </DetailSection>

        {sourceInspection && sourceInspection.parameterResults.length > 0 && (
          <DetailSection title="Failed Parameter Summary">
            <FailedParameterSummary results={sourceInspection.parameterResults} />
            <p className="mt-3 text-[12px] text-erp-muted">
              Source inspection:{' '}
              <Link to={`/quality/inspections/${sourceInspection.id}`} className="text-erp-primary hover:underline">
                {sourceInspection.inspectionNo}
              </Link>
            </p>
          </DetailSection>
        )}

        <DetailSection title="Investigation & Closure">
          <div className="grid max-w-2xl gap-4">
            <label className="block text-sm">
              <span className="font-medium">Root Cause</span>
              <textarea className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={2} value={rootCause} onChange={(e) => setRootCause(e.target.value)} disabled={ncr.status === 'closed'} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Corrective Action</span>
              <textarea className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={2} value={corrective} onChange={(e) => setCorrective(e.target.value)} disabled={ncr.status === 'closed'} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Disposition</span>
              <input className="mt-1 w-full rounded border px-3 py-2 text-sm" value={disposition} onChange={(e) => setDisposition(e.target.value)} disabled={ncr.status === 'closed'} />
            </label>
            <label className="block text-sm">
              <span className="font-medium">Engineering Review</span>
              <textarea className="mt-1 w-full rounded border px-3 py-2 text-sm" rows={2} value={engReview} onChange={(e) => setEngReview(e.target.value)} disabled={ncr.status === 'closed'} />
            </label>
          </div>
          {ncr.status !== 'closed' && (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={saveFields}>
                Save
              </Button>
              {next && (
                <Button
                  size="sm"
                  onClick={() => {
                    saveFields()
                    const r = advanceNcrStatus(ncr.id, next as NonConformanceReport['status'])
                    show(r.ok ? `Advanced to ${formatStatus(next)}` : (r.error ?? 'Failed'))
                  }}
                >
                  Advance to {formatStatus(next)}
                </Button>
              )}
              {ncr.status === 'approved' && (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() => {
                    saveFields()
                    const r = closeNcr(ncr.id)
                    show(r.ok ? 'NCR closed' : (r.error ?? 'Failed'))
                  }}
                >
                  Close NCR
                </Button>
              )}
            </div>
          )}
        </DetailSection>

        <DetailSection title="NCR Evidence & Documents">
          <EntityDocumentsPanel entityType="ncr" entityId={ncr.id} entityLabel={ncr.ncrNo} title="NCR Documents" />
        </DetailSection>

        <DetailSection title="WO Impact">
          <p className="text-sm text-slate-600">
            Work order and FG receipt remain blocked until this NCR is closed.
            {ncr.status !== 'closed' && (
              <>
                {' '}
                <Link to={`/work-orders/${ncr.workOrderId}`} className="text-erp-accent hover:underline">
                  View work order
                </Link>
              </>
            )}
          </p>
        </DetailSection>
      </DetailLayout>
    </div>
  )
}

/** @deprecated Use QualityDashboardPage — kept for legacy import path */
export { QualityDashboardPage as QualityPage }
