import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { CommandBarButton } from '@/components/ui/CommandBar'
import {
  FinancialReportAccessDeniedState,
  FinancialReportDemoBanner,
  FinancialReportErrorState,
  FinancialReportExportMenu,
  FinancialReportFilterBar,
  FinancialReportLoadingState,
  FinancialReportNoDataState,
  FinancialReportsWorkspaceTabs,
  FinancialStatementTable,
  type FinancialReportExportFormat,
} from '@/components/accounting/financialReports'
import {
  buildLedgerDrilldownHref,
  exportFinancialReport,
  FinancialReportsServiceError,
  getBalanceSheet,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
} from '@/services/accounting/financialReportsService'
import type {
  BalanceSheetStatement,
  FinancialReportFilter,
  FinancialReportLookups,
  StatementLine,
} from '@/types/financialReports'
import { DEFAULT_FINANCIAL_REPORT_FILTER } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { openPrintWindow } from '@/utils/accounting/ledgerWorkspace'
import { notify } from '@/store/toastStore'
import {
  downloadTextFile,
  financialReportsBreadcrumb,
  type FinancialReportLoadState,
  useFinancialReportFilterSync,
} from './financialReportsUi'

export function BalanceSheetPage() {
  const navigate = useNavigate()
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [data, setData] = useState<BalanceSheetStatement | null>(null)
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  useEffect(() => {
    setDraftFilter(appliedFilter)
  }, [appliedFilter])

  useEffect(() => {
    let cancelled = false
    void getFinancialReportLookups().then((l) => {
      if (!cancelled) setLookups(l)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const load = useCallback(async (signal?: { cancelled: boolean }) => {
    setLoadState('loading')
    setErrorMessage(null)
    try {
      const result = await getBalanceSheet(appliedFilter)
      if (signal?.cancelled) return
      setData(result)
      const lineCount = result.sections.reduce((n, s) => n + s.lines.length, 0)
      setLoadState(lineCount === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Balance sheet could not be loaded.')
      setLoadState('error')
    }
  }, [appliedFilter])

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const handleApply = () => {
    syncFilterToUrl(draftFilter)
  }

  const handleReset = () => {
    setDraftFilter({ ...DEFAULT_FINANCIAL_REPORT_FILTER })
    resetFilter()
  }

  const handleAmountClick = (line: StatementLine) => {
    if (!line.accountId) return
    navigate(buildLedgerDrilldownHref(line.accountId, appliedFilter.fromDate, appliedFilter.toDate))
  }

  const handleExport = async (format: FinancialReportExportFormat) => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportFinancialReport({
        scope: 'balance_sheet',
        format,
        filter: appliedFilter,
        reportName: 'Balance Sheet',
      })
      downloadTextFile(result.filename, result.content)
      notify.success(result.disclaimer)
    } catch (err) {
      notify.error(err instanceof FinancialReportsServiceError ? err.message : 'Export failed')
    }
  }

  const handlePrint = async () => {
    if (!perms.canPrint) return notify.error('Missing print permission')
    try {
      const preview = await getFinancialReportPrintPreview('Balance Sheet', appliedFilter)
      const opened = openPrintWindow(preview.reportName, preview.htmlPreview)
      if (!opened) notify.error('Pop-up blocked — allow pop-ups to print.')
      else notify.info(preview.disclaimer)
    } catch (err) {
      notify.error(err instanceof FinancialReportsServiceError ? err.message : 'Print preview failed')
    }
  }

  if (!perms.canViewBalanceSheet) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Balance Sheet"
        breadcrumbs={financialReportsBreadcrumb('Balance Sheet')}
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
      title="Balance Sheet"
      description={`${data?.companyName ?? 'Company'} · As at ${data?.asOfDate ?? appliedFilter.toDate}`}
      breadcrumbs={financialReportsBreadcrumb('Balance Sheet')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/balance-sheet"
      showDescription
      commandBar={(
        <ErpCommandBar inline sticky={false}>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FinancialReportExportMenu
              disabled={loadState !== 'ready' || (!perms.canExport && !perms.canPrint)}
              onExport={perms.canExport ? (fmt) => void handleExport(fmt) : undefined}
              onPrint={perms.canPrint ? () => void handlePrint() : undefined}
              showDemoDisclaimer
            />
            <CommandBarButton
              icon={RefreshCw}
              label="Refresh"
              accent
              onClick={() => setRefreshToken((n) => n + 1)}
            />
          </div>
        </ErpCommandBar>
      )}
    >
      <FinancialReportsWorkspaceTabs active="balance_sheet" preserveQuery={preserveQuery} />

      {lookups ? (
        <FinancialReportFilterBar
          filter={draftFilter}
          onChange={setDraftFilter}
          lookups={lookups}
          onApply={handleApply}
          onReset={handleReset}
        />
      ) : null}

      <div className="mt-3 space-y-3 px-1">
        <FinancialReportDemoBanner message="Read-only balance sheet — click account amounts to open ledger drill-down." />

        {data && loadState !== 'loading' ? (
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-erp-muted">
            <span>
              Period: <span className="font-semibold text-erp-text">{data.periodLabel}</span>
            </span>
            <span
              className={
                data.isBalanced
                  ? 'rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800'
                  : 'rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-800'
              }
            >
              {data.isBalanced ? 'Assets = Liabilities + Equity' : 'Out of balance'}
            </span>
          </div>
        ) : null}

        {loadState === 'loading' ? <FinancialReportLoadingState variant="table" rows={12} /> : null}

        {loadState === 'error' ? (
          <FinancialReportErrorState
            title="Balance sheet could not be loaded."
            description={errorMessage ?? undefined}
            onRetry={() => setRefreshToken((n) => n + 1)}
          />
        ) : null}

        {loadState === 'empty' ? (
          <FinancialReportNoDataState title="No balance sheet lines for this period" />
        ) : null}

        {loadState === 'ready' && data ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.sections.map((section) => (
              <section key={section.id} className="rounded-lg border border-erp-border bg-white">
                <h2 className="border-b border-erp-border px-3 py-2 text-[13px] font-semibold text-erp-text">
                  {section.title}
                </h2>
                <FinancialStatementTable
                  lines={section.lines}
                  onAmountClick={handleAmountClick}
                  priorPeriodLabel={data.priorPeriodLabel}
                />
              </section>
            ))}

            <div className="lg:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-erp-border bg-erp-surface-alt/50 px-4 py-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-erp-muted">Total assets</p>
                <p className="tabular-nums text-[15px] font-bold text-erp-text">{formatCurrency(data.totalAssets)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] uppercase tracking-wide text-erp-muted">Liabilities & equity</p>
                <p className="tabular-nums text-[15px] font-bold text-erp-text">
                  {formatCurrency(data.totalLiabilitiesAndEquity)}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
