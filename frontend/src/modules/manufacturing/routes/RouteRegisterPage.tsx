import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Power, PowerOff, RefreshCw, Route } from 'lucide-react'
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
import {
  activateManufacturingRoute,
  deactivateManufacturingRoute,
  getManufacturingRoutes,
} from '@/services/manufacturing'
import type { ManufacturingRoute, ManufacturingRouteStatus } from '@/types/manufacturingRoute'
import { ROUTE_STATUS_LABELS } from '@/types/manufacturingRoute'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

export function RouteRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ManufacturingRouteStatus | ''>('')
  const [rows, setRows] = useState<ManufacturingRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getManufacturingRoutes({ search: search || undefined, status: status || undefined }))
    } finally {
      setLoading(false)
    }
  }, [search, status])

  useEffect(() => { void load() }, [load])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const active = rows.filter((r) => r.status === 'active').length
    const draft = rows.filter((r) => r.status === 'draft').length
    const items = new Set(rows.map((r) => r.finishedItemCode)).size
    return [
      { id: 'total', label: 'Routes', value: rows.length, accent: 'blue' },
      { id: 'active', label: 'Active', value: active, accent: 'green' },
      { id: 'draft', label: 'Draft', value: draft, accent: 'amber' },
      { id: 'items', label: 'Finished Items', value: items, accent: 'slate' },
    ]
  }, [rows])

  const columns = useMemo<ColumnDef<ManufacturingRoute>[]>(() => [
    {
      accessorKey: 'routeNo',
      header: 'Route No',
      cell: ({ row }) => (
        <TableLink to={`/manufacturing/routes/${row.original.id}`}>{row.original.routeNo}</TableLink>
      ),
    },
    { accessorKey: 'routeName', header: 'Route Name' },
    {
      id: 'item',
      header: 'Finished Item',
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-[12px] font-medium">{row.original.finishedItemCode}</div>
          <div className="text-[11px] text-erp-muted">{row.original.finishedItemName}</div>
        </div>
      ),
    },
    { accessorKey: 'version', header: 'Version' },
    {
      id: 'ops',
      header: 'Operations',
      cell: ({ row }) => row.original.operations.length,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusDot tone={statusToneFromLabel(row.original.status)} label={ROUTE_STATUS_LABELS[row.original.status]} />
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const r = row.original
        const actions: RowActionItem[] = [
          { id: 'view', label: 'Open', icon: Eye, onClick: () => navigate(`/manufacturing/routes/${r.id}`) },
          { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => navigate(`/manufacturing/routes/${r.id}/edit`), disabled: !perms.canEditRoute },
          {
            id: 'activate',
            label: r.status === 'active' ? 'Deactivate' : 'Activate',
            icon: r.status === 'active' ? PowerOff : Power,
            onClick: () => void (async () => {
              setBusyId(r.id)
              const res = r.status === 'active'
                ? await deactivateManufacturingRoute(r.id)
                : await activateManufacturingRoute(r.id)
              setBusyId(null)
              if (!res.ok) notify.error(res.error ?? 'Failed')
              else { notify.success(r.status === 'active' ? 'Deactivated' : 'Activated'); void load() }
            })(),
            disabled: !perms.canActivateRoute || busyId === r.id,
          },
        ]
        return <EnterpriseRowActionsMenu actions={actions} />
      },
    },
  ], [busyId, load, navigate, perms.canActivateRoute, perms.canEditRoute])

  if (!perms.canViewRoute) {
    return (
      <ProductionPageHeader title="Routes" favoritePath="/manufacturing/routes">
        <ProductionEmptyState icon={Route} title="Access denied" description="Missing route view permission." />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Route Master"
      description="Reusable production process templates attached to Finished Item / BOM. Create once — Work Orders snapshot the active route automatically."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Routes' },
      ]}
      favoritePath="/manufacturing/routes"
      kpiStrip={kpiStrip}
      primaryAction={
        perms.canCreateRoute
          ? { id: 'new', label: 'New Route', icon: Plus, onClick: () => navigate('/manufacturing/routes/new') }
          : undefined
      }
      secondaryActions={[
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
        { id: 'wo', label: 'Work Orders', onClick: () => navigate('/manufacturing/work-orders') },
      ]}
      filterBar={
        <div className="flex flex-wrap items-end gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search route / item…"
            className="min-w-[180px] max-w-xs"
            aria-label="Search routes"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as ManufacturingRouteStatus | '')}
            className="w-40"
            aria-label="Filter by status"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
      }
    >
      <ManufacturingDemoBanner message="Create a Route once per Finished Item. Activate it (Draft → Active). New Work Orders copy those stages as a snapshot — you never rebuild Cutting → Welding → … on every WO. Editing a WO does not change this master." />
      {loading ? <LoadingState variant="table" rows={5} /> : null}
      {!loading && rows.length === 0 ? (
        <ProductionEmptyState
          icon={Route}
          title="No routes"
          description="Create a route for a finished item, then activate it."
          action={
            perms.canCreateRoute ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                onClick={() => navigate('/manufacturing/routes/new')}
              >
                New Route
              </button>
            ) : undefined
          }
        />
      ) : null}
      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
          <DataTable columns={columns} data={rows} />
        </div>
      ) : null}
    </ProductionPageHeader>
  )
}
