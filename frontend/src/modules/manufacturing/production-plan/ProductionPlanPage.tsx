import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ClipboardList, Eye, Plus, RefreshCw, Wrench } from 'lucide-react'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { getProductionPlans } from '@/services/manufacturing'
import type { ProductionPlan, ProductionPlanSource, ProductionPlanStatus } from '@/types/manufacturing'
import {
  PRODUCTION_PLAN_SOURCE_LABELS,
  PRODUCTION_PLAN_STATUS_LABELS,
} from '@/types/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

export function ProductionPlanPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [rows, setRows] = useState<ProductionPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [source, setSource] = useState<ProductionPlanSource | ''>('')
  const [status, setStatus] = useState<ProductionPlanStatus | ''>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getProductionPlans({
        search: search || undefined,
        source: source || undefined,
        status: status || undefined,
      }))
    } catch {
      setRows([])
      notify.error('Failed to load production plans')
    } finally {
      setLoading(false)
    }
  }, [search, source, status])

  useEffect(() => {
    void load()
  }, [load])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const open = rows.filter((p) => p.status !== 'closed' && p.status !== 'cancelled').length
    const plannedQty = rows.reduce((sum, p) => sum + p.plannedQty, 0)
    const wosCreated = rows.reduce((sum, p) => sum + p.wosCreated, 0)
    return [
      { id: 'total', label: 'Plans', value: rows.length, accent: 'blue' },
      { id: 'open', label: 'Open', value: open, accent: 'amber' },
      { id: 'qty', label: 'Planned Qty', value: plannedQty, accent: 'slate' },
      { id: 'wos', label: 'WOs Created', value: wosCreated, accent: 'green' },
    ]
  }, [rows])

  const columns = useMemo<ColumnDef<ProductionPlan>[]>(() => [
    {
      accessorKey: 'planNo',
      header: 'Plan No',
      cell: ({ row }) => (
        <TableLink to={`/manufacturing/production-plan/${row.original.id}`} className="font-mono font-semibold">
          {row.original.planNo}
        </TableLink>
      ),
    },
    {
      accessorKey: 'planDate',
      header: 'Plan Date',
      cell: ({ row }) => formatDate(row.original.planDate),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ row }) => PRODUCTION_PLAN_SOURCE_LABELS[row.original.source],
    },
    {
      accessorKey: 'totalItems',
      header: 'Total Items',
      cell: ({ row }) => <span className="tabular-nums">{row.original.totalItems}</span>,
    },
    {
      accessorKey: 'plannedQty',
      header: 'Planned Qty',
      cell: ({ row }) => <span className="tabular-nums font-semibold">{row.original.plannedQty}</span>,
    },
    {
      accessorKey: 'wosCreated',
      header: 'WOs Created',
      cell: ({ row }) => <span className="tabular-nums">{row.original.wosCreated}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot
          label={PRODUCTION_PLAN_STATUS_LABELS[row.original.status]}
          tone={statusToneFromLabel(row.original.status)}
        />
      ),
    },
    { accessorKey: 'owner', header: 'Owner' },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const plan = row.original
        const actions: RowActionItem[] = [
          {
            id: 'view',
            label: 'View',
            icon: Eye,
            onClick: () => navigate(`/manufacturing/production-plan/${plan.id}`),
          },
        ]
        if (perms.canCreateWoFromPlan && plan.status !== 'closed' && plan.status !== 'cancelled') {
          actions.push({
            id: 'generate',
            label: 'Generate Work Orders',
            icon: Wrench,
            onClick: () => navigate(`/manufacturing/production-plan/${plan.id}`),
          })
        }
        return <EnterpriseRowActionsMenu actions={actions} />
      },
    },
  ], [navigate, perms.canCreateWoFromPlan])

  if (!perms.canViewPlan) {
    return (
      <ProductionPageHeader title="Production Plan" favoritePath="/manufacturing/production-plan">
        <ProductionEmptyState
          icon={ClipboardList}
          title="Access denied"
          description="Missing production plan view permission."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Production Plan"
      description="Tells what to make — planning only. Generate Work Orders to execute on the shopfloor."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Production Plan' },
      ]}
      favoritePath="/manufacturing/production-plan"
      kpiStrip={kpiStrip}
      primaryAction={{
        id: 'new',
        label: 'New Plan',
        icon: Plus,
        onClick: () => navigate('/manufacturing/production-plan/new'),
      }}
      secondaryActions={[
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      filterBar={
        <div className="flex flex-wrap items-end gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search plan no / name / owner…"
            className="min-w-[180px] max-w-xs"
            aria-label="Search production plans"
          />
          <label className="text-[11px] font-medium text-erp-muted">
            Source
            <Select
              value={source}
              onChange={(e) => setSource(e.target.value as ProductionPlanSource | '')}
              className="mt-0.5 block w-44"
              aria-label="Filter by source"
            >
              <option value="">All sources</option>
              {(Object.keys(PRODUCTION_PLAN_SOURCE_LABELS) as ProductionPlanSource[]).map((s) => (
                <option key={s} value={s}>{PRODUCTION_PLAN_SOURCE_LABELS[s]}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Status
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProductionPlanStatus | '')}
              className="mt-0.5 block w-48"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {(Object.keys(PRODUCTION_PLAN_STATUS_LABELS) as ProductionPlanStatus[]).map((s) => (
                <option key={s} value={s}>{PRODUCTION_PLAN_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </label>
        </div>
      }
    >
      <ManufacturingDemoBanner message="Production plans are demo documents. Generating WOs creates draft work orders only." />

      {loading ? <LoadingState variant="table" rows={6} /> : null}
      {!loading && rows.length === 0 ? (
        <ProductionEmptyState
          icon={ClipboardList}
          title="No production plans"
          description="Create a plan from sales orders, stock, forecast, or manual demand."
          action={
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              onClick={() => navigate('/manufacturing/production-plan/new')}
            >
              New Plan
            </button>
          }
        />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
          <DataTable data={rows} columns={columns} />
        </div>
      ) : null}
    </ProductionPageHeader>
  )
}
