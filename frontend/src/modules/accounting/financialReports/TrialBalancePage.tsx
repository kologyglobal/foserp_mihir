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
  TrialBalanceTable,
  type FinancialReportExportFormat,
} from '@/components/accounting/financialReports'
import {
  buildLedgerDrilldownHref,
  exportFinancialReport,
  FinancialReportsServiceError,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
  getTrialBalance,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportFilter, FinancialReportLookups, TrialBalanceResult } from '@/types/financialReports'
import { DEFAULT_FINANCIAL_REPORT_FILTER } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { openPrintWindow } from '@/utils/accounting/ledgerWorkspace'
import { notify } from '@/store/toastStore'
import {
  downloadTextFile,
  financialReportsBreadcrumb,
  type FinancialReportLoadState,
  useFinancialReportFilterSync,
} from './financialReportsUi'

export function TrialBalancePage() {
  const navigate = useNavigate()
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [data, setData] = useState<TrialBalanceResult | null>(null)
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
      const result = await getTrialBalance(appliedFilter)
      if (signal?.cancelled) return
      setData(result)
      setLoadState(result.rows.length === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Trial balance could not be loaded.')
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

  const handleDrillDown = (accountId: string) => {
    navigate(buildLedgerDrilldownHref(accountId, appliedFilter.fromDate, appliedFilter.toDate))
  }

  const handleExport = async (format: FinancialReportExportFormat) => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportFinancialReport({
        scope: 'trial_balance',
        format,
        filter: appliedFilter,
        reportName: 'Trial Balance',
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
      const preview = await getFinancialReportPrintPreview('Trial Balance', appliedFilter)
      const opened = openPrintWindow(preview.reportName, preview.htmlPreview)
      if (!opened) notify.error('Pop-up blocked — allow pop-ups to print.')
      else notify.info(preview.disclaimer)
    } catch (err) {
      notify.error(err instanceof FinancialReportsServiceError ? err.message : 'Print preview failed')
    }
  }

  if (!perms.canViewTrialBalance) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Trial Balance"
        breadcrumbs={financialReportsBreadcrumb('Trial Balance')}
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
      title="Trial Balance"
      description={`${data?.companyName ?? 'Company'} · ${data?.periodLabel ?? 'Period'}`}
      breadcrumbs={financialReportsBreadcrumb('Trial Balance')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/trial-balance"
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
      <FinancialReportsWorkspaceTabs active="trial_balance" preserveQuery={preserveQuery} />

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
        <FinancialReportDemoBanner message="Read-only trial balance from posted ledger — amounts are not editable." />

        {data && loadState !== 'loading' ? (
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-erp-muted">
            <span>
              As of <span className="font-semibold text-erp-text">{data.asOfDate}</span>
            </span>
            <span
              className={
                data.isBalanced
                  ? 'rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-800'
                  : 'rounded-full bg-rose-50 px-2 py-0.5 font-semibold text-rose-800'
              }
            >
              {data.isBalanced ? 'Balanced' : 'Out of balance'}
            </span>
          </div>
        ) : null}

        {loadState === 'loading' ? <FinancialReportLoadingState variant="table" rows={10} /> : null}

        {loadState === 'error' ? (
          <FinancialReportErrorState
            title="Trial balance could not be loaded."
            description={errorMessage ?? undefined}
            onRetry={() => setRefreshToken((n) => n + 1)}
          />
        ) : null}

        {loadState === 'empty' ? (
          <FinancialReportNoDataState
            title="No trial balance rows"
            description="Try enabling zero-balance accounts or widening the date range."
          />
        ) : null}

        {loadState === 'ready' && data ? (
          <TrialBalanceTable
            rows={data.rows}
            totals={{
              openingDebit: data.totalOpeningDebit,
              openingCredit: data.totalOpeningCredit,
              periodDebit: data.totalPeriodDebit,
              periodCredit: data.totalPeriodCredit,
              closingDebit: data.totalClosingDebit,
              closingCredit: data.totalClosingCredit,
            }}
            onDrillDown={(accountId) => handleDrillDown(accountId)}
          />
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
