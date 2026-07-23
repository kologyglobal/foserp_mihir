import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  BarChart3,
  ClipboardCheck,
  FileBarChart2,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  listInspections,
  listNcrs,
  type QualityInspection,
  type QualityNcr,
} from '@/services/api/qualityApi'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'

const OPEN_NCR = new Set(['OPEN', 'INVESTIGATING', 'CORRECTIVE_ACTION', 'APPROVED'])

type Kpi = { label: string; value: string | number; hint?: string; tone?: 'neutral' | 'ok' | 'warn' | 'bad' }

function statusTone(status: string): 'neutral' | 'warning' | 'danger' | 'success' | 'info' {
  const s = status.toUpperCase()
  if (s === 'PASSED' || s === 'CLOSED') return 'success'
  if (s === 'PENDING' || s === 'REWORK' || s === 'INVESTIGATING') return 'warning'
  if (s === 'REJECTED' || s === 'CRITICAL') return 'danger'
  return 'info'
}

function computeKpis(inspections: QualityInspection[], ncrs: QualityNcr[]): Kpi[] {
  const pending = inspections.filter((i) => i.status === 'PENDING' || i.status === 'REWORK').length
  const passed = inspections.filter((i) => i.status === 'PASSED').length
  const rejected = inspections.filter((i) => i.status === 'REJECTED').length
  const rework = inspections.filter((i) => i.status === 'REWORK' || i.decision === 'REWORK').length
  const openNcrs = ncrs.filter((n) => OPEN_NCR.has(n.status)).length

  let inspected = 0
  let accepted = 0
  for (const i of inspections) {
    const iq = Number(i.inspectedQty ?? 0)
    const aq = Number(i.acceptedQty ?? 0)
    if (Number.isFinite(iq) && iq > 0) inspected += iq
    if (Number.isFinite(aq) && aq > 0) accepted += aq
  }
  const fpy = inspected > 0 ? ((accepted / inspected) * 100).toFixed(1) : '—'

  return [
    { label: 'Open inspections', value: pending, tone: pending > 0 ? 'warn' : 'ok' },
    { label: 'Passed', value: passed, tone: 'ok' },
    { label: 'Rejected', value: rejected, tone: rejected > 0 ? 'bad' : 'neutral' },
    { label: 'Rework', value: rework, tone: rework > 0 ? 'warn' : 'neutral' },
    { label: 'Open NCRs', value: openNcrs, tone: openNcrs > 0 ? 'bad' : 'ok' },
    { label: 'First-pass yield', value: fpy === '—' ? '—' : `${fpy}%`, hint: 'Accepted ÷ inspected qty', tone: 'neutral' },
  ]
}

const OPS_REPORT_LINKS = [
  { key: 'quality-dashboard', label: 'Quality Dashboard', desc: 'Counts by category and status' },
  { key: 'quality-inspections', label: 'Quality Inspections', desc: 'Full inspection register export' },
  { key: 'production-quality', label: 'Production Quality / FPY', desc: 'First-pass yield by item' },
  { key: 'ncr-register', label: 'NCR Register', desc: 'Open and closed NCRs with ageing' },
  { key: 'rework-rejection', label: 'Rework & Rejection', desc: 'Stage-level rework / reject rates' },
] as const

/** Live Quality Reports hub — inspections + NCRs from API, plus ops-report deep links. */
export function ApiQualityReportsPage() {
  const navigate = useNavigate()
  const [inspections, setInspections] = useState<QualityInspection[]>([])
  const [ncrs, setNcrs] = useState<QualityNcr[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [inspRes, ncrRes] = await Promise.all([
        listInspections({ limit: 200 }),
        listNcrs({ limit: 100 }),
      ])
      setInspections(Array.isArray(inspRes.data) ? inspRes.data : [])
      setNcrs(Array.isArray(ncrRes.data) ? ncrRes.data : [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load quality reports')
      setInspections([])
      setNcrs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => computeKpis(inspections, ncrs), [inspections, ncrs])
  const recentInspections = useMemo(
    () =>
      [...inspections]
        .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
        .slice(0, 25),
    [inspections],
  )
  const openNcrs = useMemo(
    () => ncrs.filter((n) => OPEN_NCR.has(n.status)).slice(0, 20),
    [ncrs],
  )
  const byCategory = useMemo(() => {
    const map = new Map<string, { total: number; pending: number; passed: number; rejected: number }>()
    for (const i of inspections) {
      const row = map.get(i.category) ?? { total: 0, pending: 0, passed: 0, rejected: 0 }
      row.total += 1
      if (i.status === 'PENDING' || i.status === 'REWORK') row.pending += 1
      if (i.status === 'PASSED') row.passed += 1
      if (i.status === 'REJECTED') row.rejected += 1
      map.set(i.category, row)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [inspections])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Quality"
      title="Quality Reports"
      description="Live inspection throughput, NCR ageing, and ops report runners."
      breadcrumbs={[{ label: 'Quality', to: '/quality' }, { label: 'Reports' }]}
      autoBreadcrumbs={false}
      favoritePath="/quality/reports"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'queue',
              label: 'QC Queue',
              icon: ClipboardCheck,
              onClick: () => navigate('/quality/queue'),
            },
          ]}
        />
      }
    >
      {loading ? (
        <LoadingState variant="card" />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {kpis.map((k) => (
              <div
                key={k.label}
                className={cn(
                  'rounded-xl border bg-white px-4 py-3 shadow-sm',
                  k.tone === 'ok' && 'border-emerald-200',
                  k.tone === 'warn' && 'border-amber-200',
                  k.tone === 'bad' && 'border-rose-200',
                  (!k.tone || k.tone === 'neutral') && 'border-erp-border',
                )}
              >
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{k.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-erp-text">{k.value}</p>
                {k.hint ? <p className="mt-0.5 text-[11px] text-erp-muted">{k.hint}</p> : null}
              </div>
            ))}
          </div>

          <section className="rounded-xl border border-erp-border bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <FileBarChart2 className="h-4 w-4 text-erp-primary" />
              <h2 className="text-sm font-bold text-erp-text">Ops report runners</h2>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {OPS_REPORT_LINKS.map((r) => (
                <Link
                  key={r.key}
                  to={`/manufacturing/reports/${r.key}`}
                  className="rounded-lg border border-erp-border bg-slate-50/80 px-3 py-2.5 transition hover:border-erp-primary hover:bg-sky-50"
                >
                  <p className="text-sm font-semibold text-erp-text">{r.label}</p>
                  <p className="text-[12px] text-erp-muted">{r.desc}</p>
                </Link>
              ))}
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
              <div className="border-b border-erp-border bg-slate-50 px-4 py-2.5">
                <h2 className="text-sm font-bold text-erp-text">By category</h2>
              </div>
              {byCategory.length === 0 ? (
                <EmptyState icon={BarChart3} title="No inspections yet" description="Throughput appears after QC is recorded." />
              ) : (
                <table className="min-w-full text-left text-[13px]">
                  <thead className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
                    <tr>
                      <th className="px-4 py-2">Category</th>
                      <th className="px-4 py-2 text-right">Total</th>
                      <th className="px-4 py-2 text-right">Open</th>
                      <th className="px-4 py-2 text-right">Passed</th>
                      <th className="px-4 py-2 text-right">Rejected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byCategory.map(([cat, row]) => (
                      <tr key={cat} className="border-b border-erp-border/50 last:border-0">
                        <td className="px-4 py-2 font-medium">{cat.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.total}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-amber-800">{row.pending}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-emerald-700">{row.passed}</td>
                        <td className="px-4 py-2 text-right tabular-nums text-rose-700">{row.rejected}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-erp-border bg-slate-50 px-4 py-2.5">
                <h2 className="text-sm font-bold text-erp-text">Open NCRs</h2>
                <Link to="/quality/ncr" className="text-[12px] font-semibold text-erp-primary hover:underline">
                  NCR register →
                </Link>
              </div>
              {openNcrs.length === 0 ? (
                <EmptyState icon={ShieldAlert} title="No open NCRs" description="All non-conformances are closed or none exist." />
              ) : (
                <table className="min-w-full text-left text-[13px]">
                  <thead className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
                    <tr>
                      <th className="px-4 py-2">NCR</th>
                      <th className="px-4 py-2">Severity</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {openNcrs.map((n) => (
                      <tr key={n.id} className="border-b border-erp-border/50 last:border-0">
                        <td className="px-4 py-2 font-mono text-xs">
                          <Link to={`/quality/ncr/${n.id}`} className="text-erp-primary hover:underline">
                            {n.ncrNumber}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{n.severity}</td>
                        <td className="px-4 py-2">
                          <StatusDot label={n.status.toLowerCase()} tone={statusTone(n.status)} />
                        </td>
                        <td className="px-4 py-2 text-erp-muted">{formatDateTime(n.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </div>

          <section className="overflow-hidden rounded-xl border border-erp-border bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-erp-border bg-slate-50 px-4 py-2.5">
              <h2 className="text-sm font-bold text-erp-text">Recent inspections</h2>
              <Link to="/quality/queue" className="text-[12px] font-semibold text-erp-primary hover:underline">
                Open queue →
              </Link>
            </div>
            {recentInspections.length === 0 ? (
              <EmptyState
                icon={ClipboardCheck}
                title="No inspections"
                description="Complete a QC-required stage or create an inspection to populate this report."
              />
            ) : (
              <table className="min-w-full text-left text-[13px]">
                <thead className="border-b border-erp-border text-[11px] uppercase tracking-wide text-erp-muted">
                  <tr>
                    <th className="px-4 py-2">Inspection</th>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Title</th>
                    <th className="px-4 py-2">Decision</th>
                    <th className="px-4 py-2 text-right">Inspected</th>
                    <th className="px-4 py-2">Requested</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {recentInspections.map((row) => (
                    <tr key={row.id} className="border-b border-erp-border/50 last:border-0">
                      <td className="px-4 py-2 font-mono text-xs">
                        <Link to={`/quality/inspections/${row.id}`} className="text-erp-primary hover:underline">
                          {row.inspectionNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{row.category.replace(/_/g, ' ')}</td>
                      <td className="max-w-[14rem] truncate px-4 py-2" title={row.title}>
                        {row.title}
                      </td>
                      <td className="px-4 py-2">{row.decision?.replace(/_/g, ' ') ?? '—'}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{row.inspectedQty ?? '—'}</td>
                      <td className="px-4 py-2 text-erp-muted">{formatDateTime(row.requestedAt)}</td>
                      <td className="px-4 py-2">
                        <StatusDot label={row.status.toLowerCase()} tone={statusTone(row.status)} />
                      </td>
                      <td className="px-4 py-2 text-right">
                        {row.status === 'PASSED' || row.status === 'REJECTED' ? (
                          <Link
                            to={`/quality/inspections/${row.id}/report`}
                            className="text-[12px] font-semibold text-erp-primary hover:underline"
                          >
                            Report
                          </Link>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      )}
    </OperationalPageShell>
  )
}
