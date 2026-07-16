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
  getCostCentreProfitability,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
} from '@/services/accounting/financialReportsService'
import type { CostCentreProfitabilityRow, FinancialReportFilter, FinancialReportLookups } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
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

export function CostCentreProfitabilityPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [rows, setRows] = useState<CostCentreProfitabilityRow[]>([])
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
      const data = await getCostCentreProfitability(filter)
      setRows(data)
      setLoadState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setRows([])
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load cost centre report')
    }
  }, [])

  useEffect(() => {
    if (!perms.canView) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canView])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => ({
        revenue: acc.revenue + r.revenue,
        directCost: acc.directCost + r.directCost,
        overhead: acc.overhead + r.overhead,
        netContribution: acc.netContribution + r.netContribution,
      }),
      { revenue: 0, directCost: 0, overhead: 0, netContribution: 0 },
    )
  }, [rows])

  const summaryItems = useMemo(
    () => [
      { id: 'rev', label: 'Revenue', value: formatCurrency(totals.revenue), accent: 'blue' as const },
      { id: 'cost', label: 'Direct Cost', value: formatCurrency(totals.directCost), accent: 'slate' as const },
      { id: 'contrib', label: 'Net Contribution', value: formatCurrency(totals.netContribution), accent: 'green' as const },
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
      const result = await exportFinancialReport({ scope: 'cost_centre', format, filter: appliedFilter })
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
      const preview = await getFinancialReportPrintPreview('Cost Centre Profitability', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Cost Centre Profitability" breadcrumbs={financialReportsBreadcrumb('Cost Centre')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Cost Centre Profitability"
      description="Revenue, direct cost, overhead, and contribution by cost centre."
      breadcrumbs={financialReportsBreadcrumb('Cost Centre')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/cost-centre"
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
      <FinancialReportsWorkspaceTabs active="cost_centre" preserveQuery={preserveQuery} />
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
            <table className={denseTableClass()}>
              <thead>
                <tr>
                  <th className={DENSE_TH_CLASS}>Code</th>
                  <th className={DENSE_TH_CLASS}>Cost Centre</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Revenue</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Direct Cost</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Overhead</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Net Contribution</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Margin %</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.costCentreId} className="hover:bg-erp-surface-alt/30">
                    <td className={`${DENSE_TD_CLASS} font-mono`}>{r.costCentreCode}</td>
                    <td className={DENSE_TD_CLASS}>{r.costCentreName}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.revenue)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.directCost)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.overhead)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold`}>{formatCurrency(r.netContribution)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold ${marginToneClass(r.marginPct)}`}>
                      {r.marginPct.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-erp-surface-alt/60 font-semibold">
                  <td colSpan={2} className={DENSE_TD_CLASS}>Total</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.revenue)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.directCost)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.overhead)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.netContribution)}</td>
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
