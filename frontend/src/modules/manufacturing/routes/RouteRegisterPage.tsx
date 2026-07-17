import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, Plus, Power, PowerOff, RefreshCw, Route } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import {
  activateManufacturingRoute,
  deactivateManufacturingRoute,
  getManufacturingRoutes,
} from '@/services/manufacturing'
import type { ManufacturingRoute, ManufacturingRouteStatus } from '@/types/manufacturingRoute'
import { ROUTE_STATUS_LABELS } from '@/types/manufacturingRoute'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

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
      header: '',
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
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Manufacturing" title="Routes">
        <EmptyState icon={Route} title="Access denied" description="Missing route view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Route Master"
      description="Reusable production process templates attached to Finished Item / BOM. Create once — Work Orders snapshot the active route automatically."
      breadcrumbs={[
        { label: 'Manufacturing', to: '/manufacturing' },
        { label: 'Routes' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/routes"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateRoute
              ? { id: 'new', label: 'New Route', icon: Plus, onClick: () => navigate('/manufacturing/routes/new') }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            { id: 'wo', label: 'Work Orders', onClick: () => navigate('/manufacturing/work-orders') },
          ]}
        />
      )}
    >
      <ManufacturingDemoBanner message="Create a Route once per Finished Item. Activate it (Draft → Active). New Work Orders copy those stages as a snapshot — you never rebuild Cutting → Welding → … on every WO. Editing a WO does not change this master." />
      <div className="mb-3 flex flex-wrap gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search route / item…" className="max-w-xs" />
        <Select value={status} onChange={(e) => setStatus(e.target.value as ManufacturingRouteStatus | '')} className="w-40">
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </Select>
      </div>
      {loading ? <LoadingState variant="table" rows={5} /> : (
        rows.length === 0
          ? <EmptyState icon={Route} title="No routes" description="Create a route for a finished item, then activate it." />
          : <DataTable columns={columns} data={rows} />
      )}
    </OperationalPageShell>
  )
}
