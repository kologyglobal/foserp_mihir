import { useCallback, useEffect, useState } from 'react'
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
  exportFinancialReport,
  FinancialReportsServiceError,
  getCashFlowStatement,
  getFinancialReportLookups,
  getFinancialReportPrintPreview,
} from '@/services/accounting/financialReportsService'
import type {
  CashFlowStatement,
  FinancialReportFilter,
  FinancialReportLookups,
} from '@/types/financialReports'
import { DEFAULT_FINANCIAL_REPORT_FILTER } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { openPrintWindow } from '@/utils/accounting/ledgerWorkspace'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import {
  downloadTextFile,
  formatSignedAmount,
  financialReportsBreadcrumb,
  type FinancialReportLoadState,
  useFinancialReportFilterSync,
} from './financialReportsUi'

const SECTION_LABELS = {
  Operating: 'Cash flows from operating activities',
  Investing: 'Cash flows from investing activities',
  Financing: 'Cash flows from financing activities',
} as const

export function CashFlowPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [data, setData] = useState<CashFlowStatement | null>(null)
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
      const result = await getCashFlowStatement(appliedFilter)
      if (signal?.cancelled) return
      setData(result)
      const lineCount = result.sections.reduce((n, s) => n + s.lines.length, 0)
      setLoadState(lineCount === 0 ? 'empty' : 'ready')
    } catch (err) {
      if (signal?.cancelled) return
      setErrorMessage(err instanceof Error ? err.message : 'Cash flow statement could not be loaded.')
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

  const handleExport = async (format: FinancialReportExportFormat) => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportFinancialReport({
        scope: 'cash_flow',
        format,
        filter: appliedFilter,
        reportName: 'Cash Flow Statement',
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
      const preview = await getFinancialReportPrintPreview('Cash Flow Statement', appliedFilter)
      const opened = openPrintWindow(preview.reportName, preview.htmlPreview)
      if (!opened) notify.error('Pop-up blocked — allow pop-ups to print.')
      else notify.info(preview.disclaimer)
    } catch (err) {
      notify.error(err instanceof FinancialReportsServiceError ? err.message : 'Print preview failed')
    }
  }

  if (!perms.canViewCashFlow) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Cash Flow Statement"
        breadcrumbs={financialReportsBreadcrumb('Cash Flow Statement')}
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
      title="Cash Flow Statement"
      description={`${data?.companyName ?? 'Company'} · ${data?.periodLabel ?? 'Period'} · Read-only indirect method`}
      breadcrumbs={financialReportsBreadcrumb('Cash Flow Statement')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/cash-flow"
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
      <FinancialReportsWorkspaceTabs active="cash_flow" preserveQuery={preserveQuery} />

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
        <FinancialReportDemoBanner message="Read-only cash flow statement — opening and closing cash are derived from posted ledger (demo)." />

        {loadState === 'loading' ? <FinancialReportLoadingState variant="table" rows={10} /> : null}

        {loadState === 'error' ? (
          <FinancialReportErrorState
            title="Cash flow statement could not be loaded."
            description={errorMessage ?? undefined}
            onRetry={() => setRefreshToken((n) => n + 1)}
          />
        ) : null}

        {loadState === 'empty' ? (
          <FinancialReportNoDataState title="No cash flow lines for this period" />
        ) : null}

        {loadState === 'ready' && data ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-erp-border bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Opening cash</p>
                <p className="mt-1 tabular-nums text-[16px] font-bold text-erp-text">
                  {formatCurrency(data.openingCash)}
                </p>
              </div>
              <div className="rounded-lg border border-erp-border bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Net change in cash</p>
                <p
                  className={cn(
                    'mt-1 tabular-nums text-[16px] font-bold',
                    data.netChangeInCash >= 0 ? 'text-emerald-700' : 'text-rose-700',
                  )}
                >
                  {formatSignedAmount(data.netChangeInCash)}
                </p>
              </div>
              <div className="rounded-lg border border-erp-border bg-erp-primary-soft/30 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Closing cash</p>
                <p className="mt-1 tabular-nums text-[16px] font-bold text-erp-primary">
                  {formatCurrency(data.closingCash)}
                </p>
              </div>
            </div>

            {data.sections.map((section) => (
              <section key={section.section} className="rounded-lg border border-erp-border bg-white">
                <div className="flex items-center justify-between border-b border-erp-border px-3 py-2">
                  <h2 className="text-[13px] font-semibold text-erp-text">
                    {SECTION_LABELS[section.section]}
                  </h2>
                  <span
                    className={cn(
                      'tabular-nums text-[13px] font-semibold',
                      section.subtotal >= 0 ? 'text-emerald-700' : 'text-rose-700',
                    )}
                  >
                    Subtotal: {formatSignedAmount(section.subtotal)}
                  </span>
                </div>
                <FinancialStatementTable lines={section.lines} />
              </section>
            ))}
          </div>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
