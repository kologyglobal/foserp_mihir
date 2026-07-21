import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calculator, Check, Eye, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  DepreciationRunStatusBadge,
  FixedAssetsConfirmModal,
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsSummaryCards,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import {
  getDepreciationRunById,
  getDepreciationRuns,
  postDepreciationDemo,
  previewDepreciationDemo,
  FixedAssetsServiceError,
} from '@/services/accounting/fixedAssetsService'
import type { DepreciationLine, DepreciationPreview, DepreciationRun } from '@/types/fixedAssets'
import { DEPRECIATION_METHODS } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error'

export function DepreciationWorkbenchPage() {
  const perms = useFixedAssetsPermissions()
  const [runs, setRuns] = useState<DepreciationRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState('')
  const [lines, setLines] = useState<DepreciationLine[]>([])
  const [preview, setPreview] = useState<DepreciationPreview | null>(null)
  const [period, setPeriod] = useState('2026-07')
  const [methodFilter, setMethodFilter] = useState('')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [busy, setBusy] = useState(false)
  const [confirmPost, setConfirmPost] = useState(false)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    try {
      const list = await getDepreciationRuns()
      if (signal?.cancelled) return
      setRuns(list)
      const draft = list.find((r) => r.status === 'Draft' || r.status === 'Preview') ?? list[0]
      const runId = selectedRunId || draft?.id || ''
      setSelectedRunId(runId)
      if (runId) {
        const full = await getDepreciationRunById(runId)
        if (signal?.cancelled) return
        setLines(full?.lines ?? [])
        if (full?.period) setPeriod(full.period)
      }
      setLoadState('ready')
    } catch {
      if (signal?.cancelled) return
      setLoadState('error')
    }
  }, [selectedRunId])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load, refreshToken])

  const selectedRun = runs.find((r) => r.id === selectedRunId) ?? null
  const displayLines = useMemo(() => {
    const src = preview?.lines ?? lines
    if (!methodFilter) return src
    return src.filter((l) => l.method === methodFilter)
  }, [preview, lines, methodFilter])

  const totals = useMemo(() => {
    const opening = displayLines.reduce((s, l) => s + l.openingWDV, 0)
    const dep = displayLines.reduce((s, l) => s + l.depreciationAmount, 0)
    const closing = displayLines.reduce((s, l) => s + l.closingWDV, 0)
    return { opening, dep, closing, count: displayLines.length }
  }, [displayLines])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'assets', label: 'Assets in Run', value: totals.count, accent: 'blue' },
    { id: 'open', label: 'Opening WDV', value: formatCompactCurrency(totals.opening), accent: 'slate' },
    { id: 'dep', label: 'Depreciation Amount', value: formatCompactCurrency(totals.dep), helper: formatCurrency(totals.dep), accent: 'amber' },
    { id: 'close', label: 'Closing WDV', value: formatCompactCurrency(totals.closing), accent: 'green' },
  ]

  const handlePreview = async () => {
    if (!perms.canRunDepreciation) return notify.error('Missing run depreciation permission')
    setBusy(true)
    try {
      const result = await previewDepreciationDemo(period)
      setPreview(result)
      notify.success(result.message || 'Depreciation preview calculated (demo — not posted).')
      setRefreshToken((n) => n + 1)
    } catch (err) {
      notify.error(err instanceof FixedAssetsServiceError ? err.message : 'Preview failed')
    } finally {
      setBusy(false)
    }
  }

  const handlePost = async () => {
    if (!perms.canApproveDepreciation && !perms.canRunDepreciation) {
      notify.error('Missing depreciation permission')
      return
    }
    setBusy(true)
    try {
      const targetId = selectedRunId || runs.find((r) => r.period === period)?.id
      const result = await postDepreciationDemo(targetId ?? period, period)
      notify.success(result.message)
      setConfirmPost(false)
      setPreview(null)
      setRefreshToken((n) => n + 1)
    } catch (err) {
      notify.error(err instanceof FixedAssetsServiceError ? err.message : 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Depreciation" breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Depreciation' }]} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  const isPosted = selectedRun?.status === 'Posted'
  const isLiveApi = perms.isApiMode

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Depreciation Workbench"
      description="Select period, preview depreciation by method, review opening/closing WDV, then approve in demo mode."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Fixed Assets', to: '/accounting/fixed-assets' }, { label: 'Depreciation' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/depreciation"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={
            perms.canRunDepreciation && !isPosted
              ? { id: 'preview', label: busy ? 'Calculating…' : 'Preview Depreciation', icon: Eye, variant: 'primary', onClick: () => void handlePreview() }
              : undefined
          }
          secondaryActions={[
            ...(perms.canApproveDepreciation && !isPosted
              ? [{
                  id: 'post',
                  label: isLiveApi ? 'Post Depreciation' : 'Post in Demo',
                  icon: Check,
                  onClick: () => setConfirmPost(true),
                }]
              : []),
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) },
          ]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="depreciation" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner variant="auto" />

        <div className="sticky top-0 z-10 grid gap-2 rounded-md border border-erp-border bg-white/95 p-3 shadow-sm backdrop-blur sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-[11px] text-erp-muted">
            Depreciation period
            <input type="month" className="mt-0.5 block h-9 w-full rounded-md border border-erp-border px-2 text-[12px]" value={period} onChange={(e) => setPeriod(e.target.value)} disabled={isPosted} />
          </label>
          <label className="text-[11px] text-erp-muted">
            Depreciation run
            <select className="mt-0.5 block h-9 w-full rounded-md border border-erp-border px-2 text-[12px]" value={selectedRunId} onChange={(e) => { setSelectedRunId(e.target.value); setPreview(null); setRefreshToken((n) => n + 1) }}>
              {runs.map((r) => <option key={r.id} value={r.id}>{r.runNumber} · {r.period} · {r.status}</option>)}
            </select>
          </label>
          <label className="text-[11px] text-erp-muted">
            Method filter
            <select className="mt-0.5 block h-9 w-full rounded-md border border-erp-border px-2 text-[12px]" value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
              <option value="">All methods</option>
              {DEPRECIATION_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <div>
            <p className="text-[11px] text-erp-muted">Run status</p>
            <div className="mt-1">{selectedRun ? <DepreciationRunStatusBadge status={selectedRun.status} /> : '—'}</div>
          </div>
          <div>
            <p className="text-[11px] text-erp-muted">Period range</p>
            <p className="mt-1 text-[12px] font-semibold">
              {selectedRun ? `${formatDate(selectedRun.periodFrom)} – ${formatDate(selectedRun.periodTo)}` : '—'}
            </p>
          </div>
        </div>

        <FixedAssetsSummaryCards items={kpis} columns={4} />

        <div className={cn('rounded-md border px-3 py-2 text-[13px] font-semibold', Math.abs(totals.dep) > 0 ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-erp-border bg-white text-erp-text')}>
          <Calculator className="mr-1.5 inline h-4 w-4" />
          Period depreciation total: {formatCurrency(totals.dep)}
          {preview ? <span className="ml-2 font-normal text-[12px]">· Preview loaded ({preview.assetCount} assets)</span> : null}
        </div>

        {loadState === 'loading' ? <LoadingState variant="table" rows={8} /> : null}
        {loadState === 'error' ? <FixedAssetsEmptyState title="Could not load depreciation run" /> : null}

        <div className="overflow-x-auto rounded-md border border-erp-border bg-white">
          <table className="min-w-full text-left text-[12px]">
            <thead className="sticky top-0 z-[1] bg-erp-surface text-[11px] uppercase tracking-wide text-erp-muted">
              <tr>
                <th className="px-3 py-2 font-semibold">Asset Number</th>
                <th className="px-3 py-2 font-semibold">Asset Name</th>
                <th className="px-3 py-2 font-semibold">Method</th>
                <th className="px-3 py-2 font-semibold">Period</th>
                <th className="px-3 py-2 text-right font-semibold">Opening WDV</th>
                <th className="px-3 py-2 text-right font-semibold">Depreciation Amount</th>
                <th className="px-3 py-2 text-right font-semibold">Closing WDV</th>
              </tr>
            </thead>
            <tbody>
              {displayLines.map((line) => (
                <tr key={line.id} className="border-t border-erp-border/80 hover:bg-erp-surface-alt/40">
                  <td className="px-3 py-2 font-medium text-erp-primary">{line.assetNumber}</td>
                  <td className="px-3 py-2">{line.assetName}</td>
                  <td className="px-3 py-2 text-erp-muted">{line.method}</td>
                  <td className="px-3 py-2">{line.period}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(line.openingWDV)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-amber-800">{formatCurrency(line.depreciationAmount)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(line.closingWDV)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 border-t-2 border-erp-border bg-erp-surface text-[12px] font-semibold">
              <tr>
                <td className="px-3 py-2" colSpan={4}>Totals ({totals.count} assets)</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.opening)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-amber-800">{formatCurrency(totals.dep)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(totals.closing)}</td>
              </tr>
            </tfoot>
          </table>
          {displayLines.length === 0 && loadState === 'ready' ? (
            <FixedAssetsEmptyState title="No depreciation lines" description="Run Preview Depreciation for the selected period." />
          ) : null}
        </div>
      </div>

      <FixedAssetsConfirmModal
        open={confirmPost}
        onClose={() => setConfirmPost(false)}
        title={isLiveApi ? 'Post depreciation' : 'Post depreciation in demo mode'}
        description={
          isLiveApi
            ? 'This posts depreciation for the selected period to the general ledger.'
            : 'This marks the depreciation run as posted in frontend demo data only. No general ledger journals will be created.'
        }
        confirmLabel={busy ? 'Posting…' : isLiveApi ? 'Confirm post' : 'Confirm demo post'}
        onConfirm={() => void handlePost()}
      />
    </OperationalPageShell>
  )
}
