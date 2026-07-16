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
  getManufacturingCostSummary,
} from '@/services/accounting/financialReportsService'
import type { FinancialReportFilter, FinancialReportLookups } from '@/types/financialReports'
import { useFinancialReportsPermissions } from '@/utils/permissions/financialReports'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import {
  DENSE_TD_CLASS,
  DENSE_TH_CLASS,
  denseTableClass,
  downloadTextFile,
  enrichManufacturingRow,
  financialReportsBreadcrumb,
  marginToneClass,
  useFinancialReportFilterSync,
  type FinancialReportLoadState,
} from './financialReportsUi'

export function ManufacturingCostSummaryPage() {
  const perms = useFinancialReportsPermissions()
  const { appliedFilter, preserveQuery, syncFilterToUrl, resetFilter } = useFinancialReportFilterSync()
  const [draftFilter, setDraftFilter] = useState<FinancialReportFilter>(appliedFilter)
  const [lookups, setLookups] = useState<FinancialReportLookups | null>(null)
  const [loadState, setLoadState] = useState<FinancialReportLoadState>('loading')
  const [rawRows, setRawRows] = useState<Awaited<ReturnType<typeof getManufacturingCostSummary>>>([])

  useEffect(() => {
    setDraftFilter(appliedFilter)
  }, [appliedFilter])

  useEffect(() => {
    void getFinancialReportLookups().then(setLookups).catch(() => setLookups(null))
  }, [])

  const rows = useMemo(() => rawRows.map((r, i) => enrichManufacturingRow(r, i)), [rawRows])

  const load = useCallback(async (filter: FinancialReportFilter) => {
    setLoadState('loading')
    try {
      const data = await getManufacturingCostSummary(filter)
      setRawRows(data)
      setLoadState(data.length === 0 ? 'empty' : 'ready')
    } catch (e) {
      setRawRows([])
      setLoadState('error')
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Failed to load manufacturing report')
    }
  }, [])

  useEffect(() => {
    if (!perms.canViewManufacturing) return
    void load(appliedFilter)
  }, [appliedFilter, load, perms.canViewManufacturing])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, r) => ({
          revenue: acc.revenue + r.revenue,
          cogs: acc.cogs + r.cogs,
          grossProfit: acc.grossProfit + r.grossProfit,
          qty: acc.qty + r.qty,
        }),
        { revenue: 0, cogs: 0, grossProfit: 0, qty: 0 },
      ),
    [rows],
  )

  const summaryItems = useMemo(
    () => [
      { id: 'rev', label: 'Revenue', value: formatCurrency(totals.revenue), accent: 'blue' as const },
      { id: 'cogs', label: 'COGS', value: formatCurrency(totals.cogs), accent: 'slate' as const },
      { id: 'gp', label: 'Gross Profit', value: formatCurrency(totals.grossProfit), accent: 'green' as const },
      { id: 'qty', label: 'Units Produced', value: String(totals.qty), accent: 'amber' as const },
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
      const result = await exportFinancialReport({ scope: 'manufacturing', format, filter: appliedFilter })
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
      const preview = await getFinancialReportPrintPreview('Manufacturing Cost Summary', appliedFilter)
      notify.info(preview.disclaimer)
    } catch (e) {
      notify.error(e instanceof FinancialReportsServiceError ? e.message : 'Print failed')
    }
  }

  if (!perms.canViewManufacturing) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Manufacturing Cost Summary" breadcrumbs={financialReportsBreadcrumb('Manufacturing')} autoBreadcrumbs={false}>
        <FinancialReportAccessDeniedState />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Manufacturing Cost Summary"
      description="Product-level COGS build-up — material, labour, machine, and overhead."
      breadcrumbs={financialReportsBreadcrumb('Manufacturing')}
      autoBreadcrumbs={false}
      favoritePath="/accounting/reports/manufacturing"
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
      <FinancialReportsWorkspaceTabs active="manufacturing" preserveQuery={preserveQuery} />
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
            <table className={denseTableClass('min-w-[80rem]')}>
              <thead>
                <tr>
                  {[
                    'Product',
                    'Category',
                    'Prod. Order',
                    'Plant',
                    'Qty',
                    'Revenue',
                    'Material',
                    'Labour',
                    'Machine',
                    'Overhead',
                    'COGS',
                    'Gross Profit',
                    'GM %',
                  ].map((h) => (
                    <th
                      key={h}
                      className={`${DENSE_TH_CLASS} ${h !== 'Product' && h !== 'Category' && h !== 'Prod. Order' && h !== 'Plant' ? 'text-right' : ''}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.productCategory}-${i}`} className="hover:bg-erp-surface-alt/30">
                    <td className={DENSE_TD_CLASS}>{r.product}</td>
                    <td className={DENSE_TD_CLASS}>{r.category}</td>
                    <td className={`${DENSE_TD_CLASS} font-mono text-[10px]`}>{r.productionOrder}</td>
                    <td className={DENSE_TD_CLASS}>{r.plant}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{r.qty || '—'}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.revenue)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.materialCost)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.labourCost)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.machineCost)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right`}>{formatCurrency(r.overheadAlloc)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold`}>{formatCurrency(r.cogs)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold`}>{formatCurrency(r.grossProfit)}</td>
                    <td className={`${DENSE_TD_CLASS} text-right font-semibold ${marginToneClass(r.marginPct)}`}>
                      {r.marginPct.toFixed(1)}%
                    </td>
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
