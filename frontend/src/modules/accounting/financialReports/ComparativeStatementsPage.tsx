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
  getComparativeStatements,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
} from '@/services/accounting/financialReportsService'
import type { ComparativeStatementsResult, FinancialReportFilter, FinancialReportLookups } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  DENSE_TD_CLASS,
  DENSE_TH_CLASS,
  denseTableClass,
  downloadTextFile,
  financialReportsBreadcrumb,
  formatSignedAmount,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

export function ComparativeStatementsPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [data, setData] = useState<ComparativeStatementsResult | null>(null)
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
      const result = await getComparativeStatements(filter)
      setData(result)
      setLoadState(result.rows.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setData(null)
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load comparative statements')
    }
  }, [])

  useEffect(() => {
    if (!perms.canViewProfitLoss) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canViewProfitLoss])

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
      const result = await exportFinancialReport({ scope: 'comparative', format, filter: appliedFilter })
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
      const preview = await getFinancialReportPrintPreview('Comparative Statements', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canViewProfitLoss) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Comparative Statements" breadcrumbs={financialReportsBreadcrumb('Comparative')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  const columnIds = data?.columns.map((c) => c.id) ?? []

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Comparative Statements"
      description="Side-by-side P&L comparison — current year, prior year, and budget."
      breadcrumbs={financialReportsBreadcrumb('Comparative')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/comparative"
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
      <FinancialReportsWorkspaceTabs active="comparative" preserveQuery={preserveQuery} />
      {lookups ? (
        <FinancialReportFilterBar filter={draftFilter} onChange={setDraftFilter} lookups={lookups} onApply={applyFilter} onReset={handleReset} />
      ) : null}
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner />
        {data ? (
          <p className="text-[11px] text-erp-muted">
            {data.statementType === 'profit_loss' ? 'Profit & Loss' : 'Balance Sheet'} · {data.periodLabel}
          </p>
        ) : null}
        {loadState === 'loading' ? <FinancialReportLoadingState rows={10} /> : null}
        {loadState === 'error' ? <FinancialReportErrorState onRetry={() => void load(appliedFilter)} /> : null}
        {loadState === 'empty' ? <FinancialReportNoDataState /> : null}
        {loadState === 'ready' && data ? (
          <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
            <table className={denseTableClass('min-w-[48rem]')}>
              <thead>
                <tr>
                  <th className={DENSE_TH_CLASS}>Code</th>
                  <th className={DENSE_TH_CLASS}>Particulars</th>
                  {data.columns.map((col) => (
                    <th key={col.id} className={`${DENSE_TH_CLASS} text-right`}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr
                    key={row.code}
                    className={cn(
                      'border-b border-erp-border/50',
                      row.isTotal && 'bg-erp-surface-alt/50 font-semibold',
                    )}
                  >
                    <td className={`${DENSE_TD_CLASS} font-mono text-[10px]`}>{row.code}</td>
                    <td className={DENSE_TD_CLASS} style={{ paddingLeft: `${8 + row.indent * 12}px` }}>
                      {row.label}
                    </td>
                    {columnIds.map((colId) => (
                      <td key={colId} className={`${DENSE_TD_CLASS} text-right`}>
                        {formatSignedAmount(row.values[colId] ?? 0)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
