import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { DynamicsDashboardPanel } from '../../components/dynamics/DynamicsDashboardPanel'
import { DataGrid } from '../../components/design-system/DataGrid'
import type { ColumnDef } from '@tanstack/react-table'
import { useCrmSalesForecast } from '../../hooks/useCrmSalesForecast'
import { formatCrmCurrency } from '../../utils/crmMetrics'
import { buildForecastKpiStrip } from '../../utils/crmModuleKpis'
import {
  type ForecastMonthRow,
  type ForecastOwnerRow,
  type ForecastStageRow,
  type CrmSalesForecastSnapshot,
} from '../../utils/crmForecastMetrics'
import { opportunityStageLabel } from '../../utils/opportunityUtils'
import { crmModuleBreadcrumbs } from '../../utils/crmNavigation'
import { EnterpriseNumericCell, entNumericMeta } from '../../design-system/enterprise'

const EMPTY_FORECAST: CrmSalesForecastSnapshot = {
  openCount: 0,
  pipelineValue: 0,
  weightedForecast: 0,
  avgProbability: 0,
  closingThisMonth: 0,
  closingThisQuarter: 0,
  byMonth: [],
  byOwner: [],
  byStage: [],
  atRisk: [],
}

const monthColumns: ColumnDef<ForecastMonthRow>[] = [
  { accessorKey: 'label', header: 'Close month', meta: { columnLabel: 'Close month' } },
  { accessorKey: 'count', header: 'Deals', meta: entNumericMeta('Deals'), cell: ({ getValue }) => <EnterpriseNumericCell value={getValue() as number} /> },
  {
    accessorKey: 'pipeline',
    header: 'Pipeline',
    meta: entNumericMeta('Pipeline'),
    cell: ({ getValue }) => <EnterpriseNumericCell value={formatCrmCurrency(getValue<number>())} />,
  },
  {
    accessorKey: 'weighted',
    header: 'Weighted',
    meta: entNumericMeta('Weighted'),
    cell: ({ getValue }) => <EnterpriseNumericCell value={formatCrmCurrency(getValue<number>())} />,
  },
]

const ownerColumns: ColumnDef<ForecastOwnerRow>[] = [
  { accessorKey: 'ownerName', header: 'Owner', meta: { columnLabel: 'Owner' } },
  { accessorKey: 'count', header: 'Deals', meta: entNumericMeta('Deals'), cell: ({ getValue }) => <EnterpriseNumericCell value={getValue() as number} /> },
  {
    accessorKey: 'pipeline',
    header: 'Pipeline',
    meta: entNumericMeta('Pipeline'),
    cell: ({ getValue }) => <EnterpriseNumericCell value={formatCrmCurrency(getValue<number>())} />,
  },
  {
    accessorKey: 'weighted',
    header: 'Weighted',
    meta: entNumericMeta('Weighted'),
    cell: ({ getValue }) => <EnterpriseNumericCell value={formatCrmCurrency(getValue<number>())} />,
  },
]

const stageColumns: ColumnDef<ForecastStageRow>[] = [
  { accessorKey: 'label', header: 'Stage', meta: { columnLabel: 'Stage' } },
  { accessorKey: 'count', header: 'Deals', meta: entNumericMeta('Deals'), cell: ({ getValue }) => <EnterpriseNumericCell value={getValue() as number} /> },
  {
    accessorKey: 'pipeline',
    header: 'Pipeline',
    meta: entNumericMeta('Pipeline'),
    cell: ({ getValue }) => <EnterpriseNumericCell value={formatCrmCurrency(getValue<number>())} />,
  },
  {
    accessorKey: 'weighted',
    header: 'Weighted',
    meta: entNumericMeta('Weighted'),
    cell: ({ getValue }) => <EnterpriseNumericCell value={formatCrmCurrency(getValue<number>())} />,
  },
]

export function CrmSalesForecastPage() {
  const navigate = useNavigate()
  const { forecast: apiOrDemo, loading, error, isApiBacked } = useCrmSalesForecast()
  const forecast = apiOrDemo ?? EMPTY_FORECAST
  const forecastKpiStrip = useMemo(() => buildForecastKpiStrip(forecast), [forecast])

  return (
    <OperationalPageShell
      title="Sales Forecast"
      description={
        isApiBacked
          ? 'Weighted pipeline by close month, owner, and stage (server forecast)'
          : 'Weighted pipeline by close month, owner, and stage'
      }
      autoBreadcrumbs={false}
      breadcrumbs={crmModuleBreadcrumbs('Sales Forecast', '/crm/forecast')}
      kpiStrip={forecastKpiStrip}
    >
      {loading ? (
        <p className="mt-4 px-1 text-sm text-erp-muted">Loading sales forecast…</p>
      ) : error ? (
        <p className="mt-4 px-1 text-sm text-red-600">{error}</p>
      ) : (
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <DynamicsDashboardPanel title="Forecast by close month">
          <DataGrid data={forecast.byMonth} columns={monthColumns} toolbar="none" />
        </DynamicsDashboardPanel>
        <DynamicsDashboardPanel title="Forecast by owner">
          <DataGrid data={forecast.byOwner} columns={ownerColumns} toolbar="none" />
        </DynamicsDashboardPanel>
        <DynamicsDashboardPanel title="Forecast by stage">
          <DataGrid data={forecast.byStage} columns={stageColumns} toolbar="none" />
        </DynamicsDashboardPanel>
        <DynamicsDashboardPanel title="At-risk deals">
          {forecast.atRisk.length === 0 ? (
            <p className="px-3 py-4 text-sm text-erp-muted">No at-risk open deals in the forecast window.</p>
          ) : (
            <ul className="divide-y divide-erp-border">
              {forecast.atRisk.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-erp-primary-soft"
                    onClick={() => navigate(`/crm/opportunities/${o.id}`)}
                  >
                    <span className="min-w-0 truncate text-sm font-medium">{o.opportunityName}</span>
                    <span className="shrink-0 text-xs text-erp-muted">
                      {opportunityStageLabel(o.stage)} · {o.probability}% · {formatCrmCurrency(o.value)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DynamicsDashboardPanel>
      </div>
      )}
    </OperationalPageShell>
  )
}
