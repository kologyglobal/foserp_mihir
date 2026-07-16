import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ClipboardList, Download, RefreshCw } from 'lucide-react'
import { TaxComplianceShell, TaxStatusBadge } from '@/components/accounting/tax-compliance'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  exportTaxPreviewCsv,
  loadPeriodFilter,
} from '@/services/accounting/taxComplianceService'
import type { PeriodFilterState } from '@/types/taxCompliance'
import { useTaxCompliancePermissions } from '@/utils/permissions/taxCompliance'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

export type RegisterColumn<T> = {
  key: string
  header: string
  className?: string
  render: (row: T) => ReactNode
}

function downloadText(fileName: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

/** Shared dense register used by GST/TDS list screens */
export function TaxRegisterPage<T extends { id: string }>({
  title,
  description,
  loadRows,
  columns,
  exportKind,
  searchKeys,
  emptyTitle = 'No demo records',
  emptyHint,
  headerExtra,
}: {
  title: string
  description?: string
  loadRows: (filter: PeriodFilterState) => Promise<T[]>
  columns: RegisterColumn<T>[]
  exportKind: string
  searchKeys?: (row: T) => string
  emptyTitle?: string
  emptyHint?: string
  headerExtra?: ReactNode
}) {
  const perms = useTaxCompliancePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodFilter())
  const [rows, setRows] = useState<T[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setRows(await loadRows(filter))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load register')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter, loadRows])

  useEffect(() => {
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle || !searchKeys) return rows
    return rows.filter((r) => searchKeys(r).toLowerCase().includes(needle))
  }, [rows, q, searchKeys])

  const onExport = async () => {
    if (!perms.canExport) return
    const payload = filtered.map((row) => {
      const obj: Record<string, string | number> = {}
      for (const col of columns) {
        const rendered = col.render(row)
        obj[col.header] = typeof rendered === 'string' || typeof rendered === 'number' ? rendered : String(row.id)
      }
      return obj
    })
    const csv = await exportTaxPreviewCsv(exportKind, payload)
    downloadText(`${exportKind}-preview.csv`, csv)
    notify.info('Preview CSV downloaded — not a statutory filing extract.')
  }

  return (
    <TaxComplianceShell
      title={title}
      description={description}
      periodFilter={filter}
      onPeriodChange={setFilter}
      denseBanner
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'export',
              label: 'Export Preview',
              icon: Download,
              disabled: !perms.canExport,
              onClick: () => void onExport(),
            },
          ]}
        />
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search register…"
          aria-label={`Search ${title}`}
          className="h-8 w-full max-w-xs rounded border border-erp-border px-2 text-[12px]"
        />
        {headerExtra}
        <span className="text-[11px] text-erp-muted">{filtered.length} row(s)</span>
      </div>
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && filtered.length === 0 ? (
        <EmptyState icon={ClipboardList} title={emptyTitle} description={emptyHint ?? 'Adjust period filters or import demo data.'} />
      ) : null}
      {!loading && filtered.length > 0 ? (
        <div className="overflow-auto rounded border border-erp-border">
          <table className="min-w-full border-collapse text-left text-[12px]">
            <thead className="bg-erp-surface text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className={cn('whitespace-nowrap border-b border-erp-border px-2 py-1.5', c.className)}>
                    {c.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} className="border-b border-erp-border/70 hover:bg-erp-surface/60">
                  {columns.map((c) => (
                    <td key={c.key} className={cn('whitespace-nowrap px-2 py-1.5 align-top', c.className)}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </TaxComplianceShell>
  )
}

export function inr(n: number) {
  return formatCurrency(n)
}

export function statusCell(status: string) {
  return <TaxStatusBadge status={status} />
}
