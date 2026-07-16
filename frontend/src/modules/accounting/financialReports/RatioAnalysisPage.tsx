import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { CommandBarButton } from '@/components/ui/CommandBar'
import {
  FinancialReportDemoBanner,
  FinancialReportExportMenu,
  FinancialReportFilterBar,
  FinancialReportLoadingState,
  FinancialReportErrorState,
  FinancialReportNoDataState,
  FinancialReportAccessDeniedState,
  FinancialReportsWorkspaceTabs,
} from '@/components/accounting/financialReports'
import {
  DEFAULT_FINANCIAL_REPORT_FILTER,
  exportFinancialReport,
  FinancialReportsServiceError,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
  getRatioAnalysis,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportFilter, FinancialReportLookups, RatioAnalysisItem } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  DENSE_TD_CLASS,
  DENSE_TH_CLASS,
  denseTableClass,
  downloadTextFile,
  financialReportsBreadcrumb,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

function statusBadge(status: RatioAnalysisItem['status']) {
  const styles = {
    good: 'bg-emerald-50 text-emerald-800',
    watch: 'bg-amber-50 text-amber-900',
    critical: 'bg-rose-50 text-rose-800',
  }
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase', styles[status])}>
      {status}
    </span>
  )
}

export function RatioAnalysisPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')
  const [periodLabel, setPeriodLabel] = useState('')
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof getRatioAnalysis>>['categories']>([])

  useEffect(() => {
    setDraftFilter(appliedFilter)
  }, [appliedFilter])

  useEffect(() => {
    void getFinancialReportLookups().then(setLookups).catch(() => setLookups(null))
  }, [])

  const load = useCallback(async (filter: FinancialReportFilter) => {
    setLoadState('loading')
    try {
      const result = await getRatioAnalysis(filter)
      setCategories(result.categories)
      setPeriodLabel(result.periodLabel)
      setLoadState(result.categories.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setCategories([])
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load ratio analysis')
    }
  }, [])

  useEffect(() => {
    if (!perms.canView) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canView])

  const applyFilter = () => syncFilterToUrl(draftFilter)
  const handleReset = () => {
    setDraftFilter({ ...DEFAULT_FINANCIAL_REPORT_FILTER })
    resetFilter()
  }

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!perms.canExport) {
      notify.error('Permission denied')
      return
    }
    try {
      const result = await exportFinancialReport({ scope: 'ratios', format, filter: appliedFilter })
      downloadTextFile(result.filename, result.content)
      notify.success(`${result.filename} generated (demo).`)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!perms.canPrint) {
      notify.error('Permission denied')
      return
    }
    try {
      const preview = await getFinancialReportPrintPreview('Ratio Analysis', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Ratio Analysis" breadcrumbs={financialReportsBreadcrumb('Ratios')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Ratio Analysis"
      description="Liquidity, profitability, working capital, and leverage ratios."
      breadcrumbs={financialReportsBreadcrumb('Ratios')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/ratios"
      showDescription
      commandBar={(
        <ErpCommandBar inline sticky={false}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinancialReportExportMenu
              disabled={loadState !== 'ready'}
              onExport={perms.canExport ? handleExport : undefined}
              onPrint={perms.canPrint ? handlePrint : undefined}
            />
            <CommandBarButton
              icon={RefreshCw}
              label="Refresh"
              accent
              onClick={() => void load(appliedFilter)}
            />
          </div>
        </ErpCommandBar>
      )}
    >
      <FinancialReportsWorkspaceTabs active="ratios" preserveQuery={preserveQuery} />
      {lookups ? (
        <FinancialReportFilterBar filter={draftFilter} onChange={setDraftFilter} lookups={lookups} onApply={applyFilter} onReset={handleReset} />
      ) : null}
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner />
        {periodLabel ? <p className="text-[11px] text-erp-muted">{periodLabel}</p> : null}
        {loadState === 'loading' ? <FinancialReportLoadingState rows={8} /> : null}
        {loadState === 'error' ? <FinancialReportErrorState onRetry={() => void load(appliedFilter)} /> : null}
        {loadState === 'empty' ? <FinancialReportNoDataState /> : null}
        {loadState === 'ready' ? (
          <div className="space-y-4">
            {categories.map((cat) => (
              <div key={cat.category} className="overflow-x-auto rounded-lg border border-erp-border bg-white">
                <div className="border-b border-erp-border bg-erp-surface px-3 py-1.5 text-[11px] font-semibold uppercase text-erp-muted">
                  {cat.category}
                </div>
                <table className={denseTableClass('min-w-[52rem]')}>
                  <thead>
                    <tr>
                      <th className={DENSE_TH_CLASS}>Ratio</th>
                      <th className={DENSE_TH_CLASS}>Formula</th>
                      <th className={`${DENSE_TH_CLASS} text-right`}>Value</th>
                      <th className={`${DENSE_TH_CLASS} text-right`}>Prior</th>
                      <th className={`${DENSE_TH_CLASS} text-right`}>Benchmark</th>
                      <th className={DENSE_TH_CLASS}>Status</th>
                      <th className={DENSE_TH_CLASS}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cat.items.map((item) => (
                      <tr key={item.id} className="hover:bg-erp-surface-alt/30">
                        <td className={`${DENSE_TD_CLASS} font-medium`}>{item.name}</td>
                        <td className={`${DENSE_TD_CLASS} text-[10px] text-erp-muted`}>{item.formula}</td>
                        <td className={`${DENSE_TD_CLASS} text-right font-semibold tabular-nums`}>
                          {item.value}
                          {item.unit === '%' ? '%' : item.unit === 'x' ? '×' : ` ${item.unit}`}
                        </td>
                        <td className={`${DENSE_TD_CLASS} text-right tabular-nums text-erp-muted`}>
                          {item.priorValue !== undefined
                            ? `${item.priorValue}${item.unit === '%' ? '%' : item.unit === 'x' ? '×' : ` ${item.unit}`}`
                            : '—'}
                        </td>
                        <td className={`${DENSE_TD_CLASS} text-right tabular-nums text-erp-muted`}>
                          {item.benchmark !== undefined
                            ? `${item.benchmark}${item.unit === '%' ? '%' : item.unit === 'x' ? '×' : ` ${item.unit}`}`
                            : '—'}
                        </td>
                        <td className={DENSE_TD_CLASS}>{statusBadge(item.status)}</td>
                        <td className={`${DENSE_TD_CLASS} text-[10px] text-erp-muted`}>{item.note ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
