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
  getDepartmentPerformance,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
} from '@/services/accounting/financialReportsService'
import type { DepartmentPerformanceRow, FinancialReportFilter, FinancialReportLookups } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import {
  DENSE_TD_CLASS,
  DENSE_TH_CLASS,
  denseTableClass,
  downloadTextFile,
  financialReportsBreadcrumb,
  useFinancialReportFilterSync,
  varianceToneClass,
  type FinancialReportLoadState,
} from './financialReportsUi'

export function DepartmentPerformancePage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [rows, setRows] = useState<DepartmentPerformanceRow[]>([])
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
      const data = await getDepartmentPerformance(filter)
      setRows(data)
      setLoadState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setRows([])
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load department report')
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
          budget: acc.budget + r.budget,
          actual: acc.actual + r.actual,
          variance: acc.variance + r.variance,
          headcount: acc.headcount + r.headcount,
        }),
        { budget: 0, actual: 0, variance: 0, headcount: 0 },
      ),
    [rows],
  )

  const summaryItems = useMemo(
    () => [
      { id: 'bud', label: 'Budget', value: formatCurrency(totals.budget), accent: 'slate' as const },
      { id: 'act', label: 'Actual', value: formatCurrency(totals.actual), accent: 'blue' as const },
      {
        id: 'var',
        label: 'Variance',
        value: formatCurrency(totals.variance),
        accent: totals.variance >= 0 ? ('green' as const) : ('amber' as const),
      },
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
      const result = await exportFinancialReport({ scope: 'department', format, filter: appliedFilter })
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
      const preview = await getFinancialReportPrintPreview('Department Performance', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Department Performance" breadcrumbs={financialReportsBreadcrumb('Department')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Department Performance"
      description="Budget vs actual spend and headcount by department."
      breadcrumbs={financialReportsBreadcrumb('Department')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/department"
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
      <FinancialReportsWorkspaceTabs active="department" preserveQuery={preserveQuery} />
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
                  <th className={DENSE_TH_CLASS}>Department</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Budget</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Actual</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Variance</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Var %</th>
                  <th className={`${DENSE_TH_CLASS} text-right`}>Headcount</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.departmentId} className="hover:bg-erp-surface-alt/30">
                    <td className={`${DENSE_TD_CLASS} font-mono`}>{r.departmentCode}</td>
                    <td className={DENSE_TD_CLASS}>{r.departmentName}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.budget)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.actual)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold ${varianceToneClass(r.variance)}`}>
                      {formatCurrency(r.variance)}
                    </td>
                    <td className={`${DENSE_TD_CLASS} text-right ${varianceToneClass(r.variance)}`}>
                      {r.variancePct >= 0 ? '+' : ''}
                      {r.variancePct.toFixed(1)}%
                    </td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{r.headcount}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-erp-surface-alt/60 font-semibold">
                  <td colSpan={2} className={DENSE_TD_CLASS}>Total</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.budget)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(totals.actual)}</td>
                  <td className={`${DENSE_TD_CLASS} text-right ${varianceToneClass(totals.variance)}`}>
                    {formatCurrency(totals.variance)}
                  </td>
                  <td className={DENSE_TD_CLASS} />
                  <td className={`${DENSE_TD_CLASS} text-right`}>{totals.headcount}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
