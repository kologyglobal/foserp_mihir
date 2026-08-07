/** Incoming Quality command center — operational UI for supplier QC (Purchase QI under the hood). */
import { useCallback, useEffect, useMemo, useState, type ComponentPropsWithoutRef, type ElementType, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ClipboardCheck,
  Package,
  Play,
  PlusCircle,
  RotateCcw,
  UserPlus,
  AlertTriangle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { isApiMode } from '@/config/apiConfig'
import {
  assignIncomingInspector,
  getIncomingQualityQueue,
  getIncomingQualityReports,
  getIncomingStockStatusGrn,
  startIncomingInspection,
  type IncomingQualityReadiness,
  type IncomingQualityReports,
  type IncomingQualityWorkItem,
  type IncomingStockStatusPanel,
} from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { useIncomingPendingInspections } from '@/hooks/useStableStoreData'
import { TableLink } from '@/components/ui/AppLink'
import { cn } from '@/utils/cn'

function AgeingChip({ days, band }: { days: number; band: string }) {
  const tone =
    band === '8+' || days >= 8
      ? 'bg-red-50 text-red-800 border-red-200'
      : band === '4-7' || days >= 4
        ? 'bg-amber-50 text-amber-900 border-amber-200'
        : 'bg-slate-50 text-slate-700 border-slate-200'
  return (
    <span className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${tone}`}>
      {days}d · {band}
    </span>
  )
}

function StatusChip({ status }: { status: string }) {
  const s = status.toUpperCase()
  const tone = s.includes('REJECT')
    ? 'bg-red-50 text-red-800'
    : s.includes('ACCEPT')
      ? 'bg-emerald-50 text-emerald-800'
      : s.includes('PROGRESS') || s.includes('PENDING')
        ? 'bg-sky-50 text-sky-900'
        : s.includes('AWAITING')
          ? 'bg-violet-50 text-violet-900'
          : 'bg-slate-100 text-slate-700'
  return <span className={`inline-flex rounded px-1.5 py-0.5 text-[11px] font-semibold ${tone}`}>{status}</span>
}

type QueueActionTone = 'primary' | 'secondary' | 'success' | 'neutral' | 'warning' | 'danger'

type QueueRowActionProps<T extends ElementType> = {
  as?: T
  tone?: QueueActionTone
  icon?: typeof UserPlus
  children: ReactNode
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>

/** Dense Dynamics-style row action control used in the incoming QC queue. */
function QueueRowAction<T extends ElementType = 'button'>({
  as,
  tone = 'neutral',
  icon: Icon,
  children,
  className,
  ...rest
}: QueueRowActionProps<T>) {
  const Comp = as ?? 'button'
  return (
    <Comp
      className={cn('qi-queue-action', `qi-queue-action--${tone}`, className)}
      {...(Comp === 'button' ? { type: 'button' as const } : {})}
      {...rest}
    >
      {Icon ? <Icon className="qi-queue-action__icon" aria-hidden /> : null}
      <span className="qi-queue-action__label">{children}</span>
    </Comp>
  )
}

export function IncomingQcQueuePage() {
  const navigate = useNavigate()
  const inspections = useIncomingPendingInspections()
  const [queue, setQueue] = useState<IncomingQualityReadiness | null>(null)
  const [apiError, setApiError] = useState<string | null>(null)
  const [reports, setReports] = useState<IncomingQualityReports | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [ageingMin, setAgeingMin] = useState('')
  const [assignOpen, setAssignOpen] = useState<IncomingQualityWorkItem | null>(null)
  const [inspectorId, setInspectorId] = useState('')
  const [inspectorName, setInspectorName] = useState('')
  const [priority, setPriority] = useState('NORMAL')
  const [stockPanel, setStockPanel] = useState<IncomingStockStatusPanel | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!isApiMode()) return
    setApiError(null)
    try {
      const params: Record<string, string | number> = {}
      if (statusFilter) params.status = statusFilter
      if (search.trim()) params.search = search.trim()
      if (ageingMin) params.ageingMinDays = Number(ageingMin)
      const res = await getIncomingQualityQueue(params)
      setQueue(res.data ?? null)
      try {
        const rep = await getIncomingQualityReports()
        setReports(rep.data ?? null)
      } catch {
        /* reports optional if perms */
      }
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Failed to load incoming QC')
    }
  }, [statusFilter, search, ageingMin])

  useEffect(() => {
    void load()
  }, [load])

  const workItems = useMemo(() => queue?.items ?? [], [queue])

  const openStock = async (row: IncomingQualityWorkItem) => {
    if (!row.goodsReceiptId) return
    try {
      const res = await getIncomingStockStatusGrn(row.goodsReceiptId)
      setStockPanel(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not load stock status')
    }
  }

  const doAssign = async () => {
    if (!assignOpen?.qualityInspectionId || !inspectorId.trim()) {
      notify.error('Inspector id is required')
      return
    }
    setBusy(true)
    try {
      await assignIncomingInspector({
        qualityInspectionId: assignOpen.qualityInspectionId,
        inspectedById: inspectorId.trim(),
        inspectedByName: inspectorName.trim() || undefined,
        priority: priority as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL',
      })
      notify.success('Inspector assigned')
      setAssignOpen(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Assign failed')
    } finally {
      setBusy(false)
    }
  }

  const doStart = async (row: IncomingQualityWorkItem) => {
    if (!row.qualityInspectionId) return
    setBusy(true)
    try {
      await startIncomingInspection(row.qualityInspectionId)
      notify.success('Inspection started')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Start failed')
    } finally {
      setBusy(false)
    }
  }

  if (!isApiMode()) {
    return (
      <div className="erp-page">
        <PageHeader
          title="Incoming QC"
          description="Demo mode — switch to API mode for the live command center."
          breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Incoming QC' }]}
        />
        <SectionCard noPadding>
          <table className="erp-table">
            <thead>
              <tr>
                <th>Inspection</th>
                <th>GRN</th>
                <th>Item</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => (
                <tr key={i.id}>
                  <td>
                    <TableLink to={`/quality/inspections/${i.id}`}>{i.inspectionNo}</TableLink>
                  </td>
                  <td>{i.grnNo}</td>
                  <td>{i.itemCode}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SectionCard>
      </div>
    )
  }

  const summary = queue?.summary

  return (
    <div className="erp-page iq-incoming-page">
      <PageHeader
        title="Incoming Quality"
        description="Supplier material QC — one workspace for hold, inspect, release, NCR, and returns."
        breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Incoming QC' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => void load()} disabled={busy}>
              Refresh
            </Button>
            <Button size="sm" variant="secondary" onClick={() => navigate('/purchase/quality-inspections')}>
              QI register
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => navigate('/purchase/quality-inspections?status=completed')}
            >
              Completed QC
            </Button>
            <Button size="sm" onClick={() => navigate('/purchase/grn')}>
              GRN
            </Button>
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: 'Open work', value: summary?.total ?? workItems.length },
          { label: 'Open QI', value: summary?.openQi ?? '-' },
          { label: 'Awaiting QI', value: summary?.grnAwaitingQi ?? '-' },
          { label: 'Hot ageing (4d+)', value: summary?.ageingHot ?? '-' },
          { label: 'QC hold qty', value: summary?.qcHoldQty ?? '-' },
        ].map((k) => (
          <div key={k.label} className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{k.label}</div>
            <div className="mt-0.5 text-lg font-bold tabular-nums text-slate-900">{k.value}</div>
          </div>
        ))}
      </div>

      {reports ? (
        <div className="mb-4 grid gap-2 md:grid-cols-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
            <div className="font-semibold text-slate-700">Ageing buckets</div>
            <div className="mt-1 text-slate-600">
              0–1d {reports.ageing['0-1']} · 2–3d {reports.ageing['2-3']} · 4–7d {reports.ageing['4-7']} · 8d+{' '}
              {reports.ageing['8+']}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
            <div className="font-semibold text-slate-700">Avg turnaround</div>
            <div className="mt-1 tabular-nums text-slate-600">
              {reports.avgTurnaroundHours != null ? `${reports.avgTurnaroundHours} h` : '-'} (
              {reports.turnaroundSampleSize} done)
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
            <div className="font-semibold text-slate-700">Returns from QI</div>
            <div className="mt-1 tabular-nums text-slate-600">
              {reports.purchaseReturnsFromRejection.count} docs · qty {reports.purchaseReturnsFromRejection.quantity}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[12px]">
            <div className="font-semibold text-slate-700">QC hold (report)</div>
            <div className="mt-1 tabular-nums text-slate-600">{reports.qcHoldStock}</div>
          </div>
        </div>
      ) : null}

      <SectionCard className="mb-3">
        <div className="grid gap-2 md:grid-cols-4">
          <label className="text-[12px]">
            <span className="mb-1 block font-medium text-slate-600">Search</span>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="GRN, vendor, item…" />
          </label>
          <label className="text-[12px]">
            <span className="mb-1 block font-medium text-slate-600">Status</span>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              <option value="AWAITING_QI">Awaiting QI</option>
              <option value="DRAFT">Draft</option>
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="DEVIATION_PENDING">Deviation</option>
              <option value="REJECTED">Rejected</option>
              <option value="PARTIALLY_ACCEPTED">Partial</option>
            </Select>
          </label>
          <label className="text-[12px]">
            <span className="mb-1 block font-medium text-slate-600">Min ageing (days)</span>
            <Input value={ageingMin} onChange={(e) => setAgeingMin(e.target.value)} placeholder="e.g. 2" />
          </label>
          <div className="flex items-end">
            <Button size="sm" onClick={() => void load()}>
              Apply filters
            </Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard noPadding>
        {apiError ? (
          <p className="p-4 text-sm text-red-600" role="alert">
            {apiError}
          </p>
        ) : workItems.length === 0 ? (
          <p className="p-6 text-[13px] text-slate-500">No pending incoming QC work.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1100px] text-[12px]">
              <thead>
                <tr>
                  <th>Age</th>
                  <th>GRN</th>
                  <th>Vendor</th>
                  <th>Item</th>
                  <th className="text-right">Recv</th>
                  <th className="text-right">QC hold</th>
                  <th>QI</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Inspector</th>
                  <th>Result</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {workItems.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <AgeingChip days={row.ageingDays} band={row.ageingBand} />
                    </td>
                    <td>
                      <Link className="font-mono text-erp-primary hover:underline" to={row.hrefGrn}>
                        {row.goodsReceiptNumber}
                      </Link>
                    </td>
                    <td className="max-w-[140px] truncate">{row.vendorName ?? '-'}</td>
                    <td>
                      <div className="font-medium">{row.itemCode || '-'}</div>
                      <div className="max-w-[160px] truncate text-[11px] text-slate-500">{row.itemName}</div>
                    </td>
                    <td className="text-right tabular-nums">{row.receivedQuantity}</td>
                    <td className="text-right tabular-nums">{row.qcHoldQuantity}</td>
                    <td className="font-mono">
                      {row.hrefQi ? (
                        <Link to={row.hrefQi} className="text-erp-primary hover:underline">
                          {row.qualityInspectionNumber}
                        </Link>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      <StatusChip status={row.inspectionStatus} />
                    </td>
                    <td>{row.priority}</td>
                    <td className="max-w-[100px] truncate">{row.inspectorName ?? '-'}</td>
                    <td>{row.result ?? '-'}</td>
                    <td className="qi-queue-actions-cell">
                      <div className="qi-queue-actions" role="group" aria-label="Row actions">
                        {!row.qualityInspectionId ? (
                          <QueueRowAction
                            as={Link}
                            to={row.hrefCreateQi}
                            tone="secondary"
                            icon={PlusCircle}
                          >
                            Create QI
                          </QueueRowAction>
                        ) : null}
                        {row.allowedActions.includes('ASSIGN') ? (
                          <QueueRowAction
                            tone="neutral"
                            icon={UserPlus}
                            onClick={() => {
                              setAssignOpen(row)
                              setInspectorId(row.inspectorId ?? '')
                              setInspectorName(row.inspectorName ?? '')
                              setPriority(row.priority || 'NORMAL')
                            }}
                          >
                            Assign
                          </QueueRowAction>
                        ) : null}
                        {row.allowedActions.includes('START') && row.qualityInspectionId ? (
                          <QueueRowAction
                            tone="success"
                            icon={Play}
                            onClick={() => void doStart(row)}
                          >
                            Start
                          </QueueRowAction>
                        ) : null}
                        {row.hrefQi ? (
                          <QueueRowAction
                            as={Link}
                            to={row.hrefQi}
                            tone="primary"
                            icon={ClipboardCheck}
                          >
                            Inspect
                          </QueueRowAction>
                        ) : null}
                        <QueueRowAction
                          tone="neutral"
                          icon={Package}
                          onClick={() => void openStock(row)}
                        >
                          Stock
                        </QueueRowAction>
                        {row.qualityInspectionId && row.allowedActions.includes('CREATE_NCR') ? (
                          <QueueRowAction
                            as={Link}
                            to={`/purchase/quality-inspections/${row.qualityInspectionId}`}
                            tone="warning"
                            icon={AlertTriangle}
                          >
                            NCR
                          </QueueRowAction>
                        ) : null}
                        {row.qualityInspectionId && row.allowedActions.includes('CREATE_RETURN') ? (
                          <QueueRowAction
                            as={Link}
                            to={`/purchase/returns/new?qualityInspectionId=${row.qualityInspectionId}`}
                            tone="danger"
                            icon={RotateCcw}
                          >
                            Return
                          </QueueRowAction>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {stockPanel ? (
        <SectionCard className="mt-3" title="Stock status panel">
          <div className="grid grid-cols-3 gap-2 text-[12px] md:grid-cols-6">
            {[
              ['Received', stockPanel.received],
              ['QC hold', stockPanel.qcHold],
              ['Accepted', stockPanel.accepted],
              ['Rejected', stockPanel.rejected],
              ['Deviation', stockPanel.deviationHold],
              ['Released', stockPanel.released],
            ].map(([l, v]) => (
              <div key={String(l)} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                <div className="text-[10px] uppercase text-slate-500">{l}</div>
                <div className="font-semibold tabular-nums">{v as number}</div>
              </div>
            ))}
          </div>
          {stockPanel.movementRefs.length ? (
            <ul className="mt-3 space-y-1 text-[11px] text-slate-600">
              {stockPanel.movementRefs.slice(0, 8).map((m, i) => (
                <li key={`${m.referenceType}-${m.referenceNo}-${i}`} className="font-mono">
                  {m.referenceType} · {m.referenceNo} · {m.quantity} · {m.stockStatus}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[12px] text-slate-500">No movements linked yet.</p>
          )}
          <Button size="sm" variant="secondary" className="mt-2" onClick={() => setStockPanel(null)}>
            Close
          </Button>
        </SectionCard>
      ) : null}

      {assignOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-4 shadow-xl">
            <h3 className="text-sm font-bold text-slate-900">Assign inspector</h3>
            <p className="mt-1 text-[12px] text-slate-500">
              {assignOpen.qualityInspectionNumber} · {assignOpen.goodsReceiptNumber}
            </p>
            <label className="mt-3 block text-[12px]">
              <span className="mb-1 block font-medium">User id *</span>
              <Input value={inspectorId} onChange={(e) => setInspectorId(e.target.value)} />
            </label>
            <label className="mt-2 block text-[12px]">
              <span className="mb-1 block font-medium">Display name</span>
              <Input value={inspectorName} onChange={(e) => setInspectorName(e.target.value)} />
            </label>
            <label className="mt-2 block text-[12px]">
              <span className="mb-1 block font-medium">Priority</span>
              <Select value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="LOW">Low</option>
                <option value="NORMAL">Normal</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </Select>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => setAssignOpen(null)}>
                Cancel
              </Button>
              <Button size="sm" disabled={busy} onClick={() => void doAssign()}>
                Assign
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
