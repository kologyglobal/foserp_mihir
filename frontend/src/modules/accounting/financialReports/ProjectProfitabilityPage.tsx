import { useCallback, useEffect, useMemo, useState } from 'react'
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
  FinancialReportsSummaryCards,
  FinancialReportsWorkspaceTabs,
} from '@/components/accounting/financialReports'
import {
  DEFAULT_FINANCIAL_REPORT_FILTER,
  exportFinancialReport,
  FinancialReportsServiceError,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
  getProjectProfitability,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportFilter, FinancialReportLookups, ProjectProfitabilityRow } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  DENSE_TD_CLASS,
  DENSE_TH_CLASS,
  denseTableClass,
  downloadTextFile,
  financialReportsBreadcrumb,
  marginToneClass,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

export function ProjectProfitabilityPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [rows, setRows] = useState<ProjectProfitabilityRow[]>([])
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')

  useEffect(() => {
    setDraftFilter(appliedFilter)
  }, [appliedFilter])

  useEffect(() => {
    void getFinancialReportLookups().then(setLookups).catch(() => setLookups(null))
  }, [])

  const load = useCallback(async (filter: FinancialReportFilter) => {
    setLoadState('loading')
    try {
      const data = await getProjectProfitability(filter)
      setRows(data)
      setLoadState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setRows([])
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load project report')
    }
  }, [])

  useEffect(() => {
    if (!perms.canView) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canView])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          revenue: acc.revenue + r.revenue,
          cost: acc.cost + r.cost,
          netResult: acc.netResult + r.netResult,
        }),
        { revenue: 0, cost: 0, netResult: 0 },
      ),
    [rows],
  )

  const summaryItems = useMemo(
    () => [
      { id: 'rev', label: 'Revenue', value: formatCurrency(totals.revenue), accent: 'blue' as const },
      { id: 'cost', label: 'Cost', value: formatCurrency(totals.cost), accent: 'slate' as const },
      { id: 'net', label: 'Net Result', value: formatCurrency(totals.netResult), accent: 'green' as const },
    ],
    [totals],
  )

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
      const result = await exportFinancialReport({ scope: 'project', format, filter: appliedFilter })
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
      const preview = await getFinancialReportPrintPreview('Project Profitability', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Project Profitability" breadcrumbs={financialReportsBreadcrumb('Project')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Project Profitability"
      description="Revenue, cost, and margin by customer project."
      breadcrumbs={financialReportsBreadcrumb('Project')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/project"
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
      <FinancialReportsWorkspaceTabs active="project" preserveQuery={preserveQuery} />
      {lookups ? (
        <FinancialReportFilterBar filter={draftFilter} onChange={setDraftFilter} lookups={lookups} onApply={applyFilter} onReset={handleReset} />
      ) : null}
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner />
        {loadState === 'ready' ? <FinancialReportsSummaryCards items={summaryItems} /> : null}
        {loadState === 'loading' ? <FinancialReportLoadingState rows={6} /> : null}
        {loadState === 'error' ? <FinancialReportErrorState onRetry={() => void load(appliedFilter)} /> : null}
        {loadState === 'empty' ? <FinancialReportNoDataState /> : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
            <table className={denseTableClass('min-w-[64rem]')}>
              <thead>
                <tr>
                  <th className={DENSE_TH_CLASS}>Code</th>
                  <th className={DENSE_TH_CLASS}>Project</th>
                  <th className={DENSE_TH_CLASS}>Customer</th>
                  <th className={DENSE_TH_CLASS}>Status</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Revenue</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Cost</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Net Result</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.projectId} className="hover:bg-erp-surface-alt/30">
                    <td className={`${DENSE_TD_CLASS} font-mono`}>{r.projectCode}</td>
                    <td className={DENSE_TD_CLASS}>{r.projectName}</td>
                    <td className={DENSE_TD_CLASS}>{r.customer}</td>
                    <td className={DENSE_TD_CLASS}>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                          r.status === 'Active' ? 'bg-emerald-50 text-emerald-800' : 'bg-erp-surface text-erp-muted',
                        )}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.revenue)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.cost)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold`}>{formatCurrency(r.netResult)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold ${marginToneClass(r.marginPct)}`}>
                      {r.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-erp-surface-alt/60 font-semibold">
                  <td colSpan={4} className={DENSE_TD_CLASS}>Total</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.revenue)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.cost)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.netResult)}</td>
                  <td className={DENSE_TD_CLASS} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
