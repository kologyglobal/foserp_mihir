import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RefreshCw } from 'lucide-react'
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
  getGeneralLedgerReport,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportFilter, FinancialReportLookups, GeneralLedgerReportResult } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  downloadTextFile,
  financialReportsBreadcrumb,
  formatSignedAmount,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

export function GeneralLedgerReportPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [data, setData] = useState<GeneralLedgerReportResult | null>(null)
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
      const result = await getGeneralLedgerReport(filter)
      setData(result)
      setLoadState(result.rows.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setData(null)
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load general ledger report')
    }
  }, [])

  useEffect(() => {
    if (!perms.canView) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canView])

  const applyFilter = () => {
    syncFilterToUrl(draftFilter)
  }

  const handleReset = () => {
    setDraftFilter({ ...DEFAULT_FINANCIAL_REPORT_FILTER })
    resetFilter()
  }

  const summaryItems = useMemo(() => {
    if (!data) return []
    return [
      { id: 'accounts', label: 'Accounts', value: String(data.rows.length), accent: 'blue' as const },
      { id: 'debit', label: 'Period Debit', value: formatCurrency(data.totalDebit), accent: 'slate' as const },
      { id: 'credit', label: 'Period Credit', value: formatCurrency(data.totalCredit), accent: 'slate' as const },
      {
        id: 'balanced',
        label: 'Movement',
        value: Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? 'Balanced' : 'Check',
        accent: Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? ('green' as const) : ('amber' as const),
      },
    ]
  }, [data])

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    if (!perms.canExport) {
      notify.error('Permission denied')
      return
    }
    try {
      const result = await exportFinancialReport({
        scope: 'general_ledger',
        format,
        filter: appliedFilter,
      })
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
      const preview = await getFinancialReportPrintPreview('General Ledger Report', appliedFilter)
      notify.info(`${preview.reportName} — ${preview.disclaimer}`)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canView) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="General Ledger Report"
        breadcrumbs={financialReportsBreadcrumb('General Ledger')}
        autoBreadcrumbs={false}
      >
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="General Ledger Report"
      description="Account-level period movement with drill-down to account ledger."
      breadcrumbs={financialReportsBreadcrumb('General Ledger')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/general-ledger"
      showDescription
      commandBar={(
        <ErpCommandBar inline sticky={false}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinancialReportExportMenu
              disabled={loadState !== 'ready' || !data}
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
      <FinancialReportsWorkspaceTabs active="general_ledger" preserveQuery={preserveQuery} />
      {lookups ? (
        <FinancialReportFilterBar
          filter={draftFilter}
          onChange={setDraftFilter}
          lookups={lookups}
          onApply={applyFilter}
          onReset={handleReset}
        />
      ) : null}
      <div className="space-y-3 p-4">
        <FinancialReportDemoBanner />
        {data ? (
          <div className="space-y-1">
            <p className="text-[12px] font-semibold text-erp-text">{data.companyName}</p>
            <p className="text-[11px] text-erp-muted">{data.periodLabel}</p>
          </div>
        ) : null}
        {loadState === 'ready' && data ? <FinancialReportsSummaryCards items={summaryItems} /> : null}
        {loadState === 'loading' ? <FinancialReportLoadingState rows={10} /> : null}
        {loadState === 'error' ? (
          <FinancialReportErrorState onRetry={() => void load(appliedFilter)} />
        ) : null}
        {loadState === 'empty' ? <FinancialReportNoDataState /> : null}
        {loadState === 'ready' && data ? (
          <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
            <table className="w-full min-w-[56rem] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface">
                  {['Code', 'Account', 'Opening', 'Debit', 'Credit', 'Closing', 'Entries', ''].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        'px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-erp-muted',
                        h && h !== 'Code' && h !== 'Account' ? 'text-right' : 'text-left',
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.accountId} className="border-b border-erp-border/60 hover:bg-erp-surface-alt/30">
                    <td className="px-3 py-1.5 font-mono text-[11px]">{row.accountCode}</td>
                    <td className="px-3 py-1.5 font-medium">{row.accountName}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatSignedAmount(row.openingBalance)} {row.openingSide}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.debit)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatCurrency(row.credit)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {formatSignedAmount(row.closingBalance)} {row.closingSide}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-erp-muted">{row.entryCount}</td>
                    <td className="px-3 py-1.5 text-right">
                      <Link
                        to={row.drilldownHref}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-erp-primary hover:underline"
                      >
                        Ledger
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-erp-surface-alt/60 font-semibold">
                  <td colSpan={3} className="px-3 py-2 text-right text-[11px] uppercase text-erp-muted">
                    Totals
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(data.totalDebit)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(data.totalCredit)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
