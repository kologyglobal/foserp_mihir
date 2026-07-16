import { useCallback, useEffect, useMemo, useState } from 'react'
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
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
  getProfitAndLoss,
} from '@/services/accounting/financialReportsService'
import type {
  FinancialReportFilter,
  FinancialReportLookups,
  ProfitLossStatement,
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

export function ProfitLossPage() {
  const navigate = useNavigate()
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [data, setData] = useState<ProfitLossStatement | null>(null)
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
      const result = await getProfitAndLoss(appliedFilter)
      if (signal?.cancelled) return
      setData(result)
      const lineCount = result.sections.reduce((n, s) => n + s.lines.length, 0)
      setLoadState(lineCount === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Profit & Loss could not be loaded.')
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

  const allLines = useMemo(
    () => data?.sections.flatMap((s) => s.lines) ?? [],
    [data],
  )

  const showVariance = appliedFilter.comparisonMode === 'budget'

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
        scope: 'profit_loss',
        format,
        filter: appliedFilter,
        reportName: 'Profit & Loss',
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
      const preview = await getFinancialReportPrintPreview('Profit & Loss', appliedFilter)
      const opened = openPrintWindow(preview.reportName, preview.htmlPreview)
      if (!opened) notify.error('Pop-up blocked — allow pop-ups to print.')
      else notify.info(preview.disclaimer)
    } catch (err) {
      notify.error(err instanceof FinancialReportsServiceError ? err.message : 'Print preview failed')
    }
  }

  if (!perms.canViewProfitLoss) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Profit & Loss"
        breadcrumbs={financialReportsBreadcrumb('Profit & Loss')}
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
      title="Profit & Loss"
      description={`${data?.companyName ?? 'Company'} · ${data?.periodLabel ?? 'Period'}`}
      breadcrumbs={financialReportsBreadcrumb('Profit & Loss')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/profit-loss"
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
      <FinancialReportsWorkspaceTabs active="profit_loss" preserveQuery={preserveQuery} />

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
        <FinancialReportDemoBanner message="Read-only P&L from posted ledger — click amounts with account links to drill down." />

        {loadState === 'loading' ? <FinancialReportLoadingState variant="table" rows={12} /> : null}

        {loadState === 'error' ? (
          <FinancialReportErrorState
            title="Profit & Loss could not be loaded."
            description={errorMessage ?? undefined}
            onRetry={() => setRefreshToken((n) => n + 1)}
          />
        ) : null}

        {loadState === 'empty' ? (
          <FinancialReportNoDataState title="No P&L lines for this period" />
        ) : null}

        {loadState === 'ready' && data ? (
          <div className="space-y-4">
            {data.sections.map((section) => (
              <section key={section.id} className="rounded-lg border border-erp-border bg-white">
                <h2 className="border-b border-erp-border px-3 py-2 text-[13px] font-semibold text-erp-text">
                  {section.title}
                </h2>
                <FinancialStatementTable
                  lines={section.lines}
                  onAmountClick={handleAmountClick}
                  priorPeriodLabel={data.priorPeriodLabel}
                  budgetLabel={data.budgetLabel}
                  showVariance={showVariance}
                />
              </section>
            ))}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-erp-border bg-erp-surface-alt/50 px-4 py-3">
              <span className="text-[13px] font-semibold text-erp-text">Net Profit</span>
              <span className="tabular-nums text-[15px] font-bold text-emerald-700">
                {formatCurrency(data.netProfit)}
              </span>
              {data.priorNetProfit !== undefined ? (
                <span className="text-[12px] text-erp-muted">
                  Prior: {formatCurrency(data.priorNetProfit)}
                </span>
              ) : null}
            </div>

            {allLines.length === 0 ? (
              <FinancialReportNoDataState title="No statement lines" />
            ) : null}
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
