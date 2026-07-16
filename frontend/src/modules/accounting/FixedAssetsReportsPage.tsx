import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, FileText, Printer, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  FixedAssetsDemoBanner,
  FixedAssetsEmptyState,
  FixedAssetsWorkspaceTabs,
} from '@/components/accounting/fixedAssets'
import {
  exportFixedAssetsData,
  getFixedAssetsPrintPreview,
  getReports,
  FixedAssetsServiceError,
} from '@/services/accounting/fixedAssetsService'
import type { FixedAssetsReportCard } from '@/types/fixedAssets'
import { useFixedAssetsPermissions } from '@/utils/permissions/fixedAssets'
import { notify } from '@/store/toastStore'
import { FIXED_ASSETS_BREADCRUMB, type LoadState } from './fixedAssetsUi'
import { cn } from '@/utils/cn'

const CATEGORIES = ['All', 'Register', 'Depreciation', 'Compliance', 'Analysis'] as const

export function FixedAssetsReportsPage() {
  const perms = useFixedAssetsPermissions()
  const [catalog, setCatalog] = useState<FixedAssetsReportCard[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('All')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string | number | null>>>([])

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      setCatalog(await getReports())
      setLoadState('ready')
    } catch {
      setLoadState('error')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(() => {
    return catalog.filter((r) => {
      if (category !== 'All' && r.category !== category) return false
      if (search && !`${r.name} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })
  }, [catalog, category, search])

  const selected = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null

  useEffect(() => {
    if (!selected) {
      setPreviewRows([])
      return
    }
    void getFixedAssetsPrintPreview(selected.name).then((p) => setPreviewRows(p.rows))
  }, [selected])

  const handleExport = async (format: 'csv' | 'xlsx' | 'pdf') => {
    if (!selected || !perms.canExport) {
      notify.error('Permission denied')
      return
    }
    try {
      const result = await exportFixedAssetsData({ reportName: selected.name, format, filter: {}, includeAudit: false })
      notify.success(`${result.fileName} generated (${result.rowCount} rows, demo).`)
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!selected || !perms.canPrint) {
      notify.error('Permission denied')
      return
    }
    try {
      const preview = await getFixedAssetsPrintPreview(selected.name)
      notify.info(`${preview.reportName} print preview ready — ${preview.rows.length} row(s) (demo).`)
    } catch (e) {
      notify.error(e instanceof FixedAssetsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canViewReports) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Fixed Assets Reports" breadcrumbs={[...FIXED_ASSETS_BREADCRUMB, { label: 'Reports' }]} autoBreadcrumbs={false}>
        <FixedAssetsEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Fixed Assets Reports"
      description="Report catalog with export and print preview (demo)."
      breadcrumbs={[...FIXED_ASSETS_BREADCRUMB, { label: 'Reports' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/fixed-assets/reports"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            ...(selected && perms.canExport ? [
              { id: 'csv', label: 'Export CSV', icon: Download, onClick: () => void handleExport('csv') },
              { id: 'print', label: 'Print Preview', icon: Printer, onClick: () => void handlePrint() },
            ] : []),
          ]}
        />
      )}
    >
      <FixedAssetsWorkspaceTabs active="reports" />
      <div className="space-y-3 p-4">
        <FixedAssetsDemoBanner />
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1"><SearchInput value={search} onChange={setSearch} placeholder="Search reports…" /></div>
          <nav className="flex gap-1">
            {CATEGORIES.map((c) => (
              <button key={c} type="button" onClick={() => setCategory(c)} className={cn('rounded-full px-3 py-1 text-[11px] font-semibold', category === c ? 'bg-erp-primary text-white' : 'bg-erp-surface text-erp-muted')}>{c}</button>
            ))}
          </nav>
        </div>
        {loadState === 'loading' ? <LoadingState variant="dashboard" rows={6} /> : null}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="space-y-2 lg:col-span-1">
            {visible.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedId(r.id)}
                className={cn('w-full rounded-md border p-3 text-left transition', selected?.id === r.id ? 'border-erp-primary bg-erp-primary/5' : 'border-erp-border bg-white hover:border-erp-primary/40')}
              >
                <div className="flex items-start gap-2">
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-erp-primary" />
                  <div>
                    <p className="text-[13px] font-semibold">{r.name}</p>
                    <p className="mt-0.5 text-[11px] text-erp-muted">{r.description}</p>
                    <span className="mt-1 inline-block rounded bg-erp-surface px-1.5 py-0.5 text-[10px] font-semibold uppercase text-erp-muted">{r.category}</span>
                  </div>
                </div>
              </button>
            ))}
            {visible.length === 0 && loadState !== 'loading' ? <FixedAssetsEmptyState title="No reports match filters" /> : null}
          </div>
          <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-2">
            {selected ? (
              <>
                <h3 className="text-[14px] font-semibold">{selected.name}</h3>
                <p className="mt-1 text-[12px] text-erp-muted">{selected.description}</p>
                <div className="mt-3 max-h-80 overflow-auto rounded border border-erp-border">
                  {previewRows.length > 0 ? (
                    <table className="min-w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-erp-surface text-[10px] uppercase text-erp-muted">
                        <tr>
                          {Object.keys(previewRows[0]).map((k) => <th key={k} className="px-2 py-1 font-semibold">{k}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 30).map((row, i) => (
                          <tr key={i} className="border-t border-erp-border/70">
                            {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1">{v ?? '—'}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="p-4 text-[12px] text-erp-muted">No preview rows for this report.</p>
                  )}
                </div>
              </>
            ) : (
              <p className="text-[13px] text-erp-muted">Select a report from the catalog.</p>
            )}
          </section>
        </div>
      </div>
    </OperationalPageShell>
  )
}
