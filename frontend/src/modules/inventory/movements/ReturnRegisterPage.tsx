import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Plus, RefreshCw, RotateCcw, Send, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { SmartFilterBar } from '@/components/design-system/SmartFilterBar'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { TableLink } from '@/components/ui/AppLink'
import { EnterpriseRowActionsMenu, type RowActionItem } from '@/design-system/enterprise/EnterpriseTablePrimitives'
import { MovementRegisterTabs } from '@/components/inventory/movements/MovementPreviewPanels'
import {
  cancelReturnDemo,
  getReturns,
  postReturnDemo,
  seedDemoPhase3IfEmpty,
  InventoryServiceError,
} from '@/services/inventory'
import type { InventoryReturnListRow, InventoryReturnType } from '@/types/inventoryDomain'
import { RETURN_REGISTER_TABS, RETURN_STATUS_LABELS, RETURN_TYPE_LABELS } from '@/utils/inventoryMovementLabels'
import { formatCurrency, formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { useInventoryPermissions } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'

export function ReturnRegisterPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = searchParams.get('tab') ?? 'all'
  const [rows, setRows] = useState<InventoryReturnListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [returnType, setReturnType] = useState<InventoryReturnType | ''>('')
  const statusFilter = RETURN_REGISTER_TABS.find((t) => t.id === tab)?.status ?? undefined

  const load = useCallback(async () => {
    setLoading(true)
    try {
      await seedDemoPhase3IfEmpty()
      setRows(await getReturns({
        status: statusFilter ?? undefined,
        returnType: returnType || undefined,
        search: search || undefined,
      }))
    } catch {
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter, returnType, search])

  useEffect(() => { void load() }, [load])

  const columns = useMemo<ColumnDef<InventoryReturnListRow>[]>(
    () => [
      {
        accessorKey: 'documentNumber',
        header: 'Return Number',
        cell: ({ row }) => (
          <TableLink to={`/inventory/movements/returns/${row.original.id}`} className="font-mono">
            {row.original.documentNumber}
          </TableLink>
        ),
      },
      { accessorKey: 'returnDate', header: 'Date', cell: ({ row }) => formatDate(row.original.returnDate) },
      { accessorKey: 'returnType', header: 'Type', cell: ({ row }) => RETURN_TYPE_LABELS[row.original.returnType] },
      { accessorKey: 'sourceDocumentNo', header: 'Source Document' },
      { accessorKey: 'partyOrDepartment', header: 'Party / Dept', cell: ({ row }) => row.original.partyOrDepartment ?? '—' },
      { accessorKey: 'warehouseName', header: 'Warehouse' },
      { accessorKey: 'itemCount', header: 'Items', cell: ({ row }) => formatNumber(row.original.itemCount) },
      { accessorKey: 'returnQty', header: 'Return Qty', cell: ({ row }) => formatNumber(row.original.returnQty) },
      { accessorKey: 'returnValue', header: 'Value', cell: ({ row }) => formatCurrency(row.original.returnValue) },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot label={RETURN_STATUS_LABELS[row.original.status]} tone={statusToneFromLabel(RETURN_STATUS_LABELS[row.original.status])} />
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => {
          const r = row.original
          const actions: RowActionItem[] = [
            { id: 'view', label: 'View', icon: Eye, onClick: () => navigate(`/inventory/movements/returns/${r.id}`) },
          ]
          if (r.status === 'draft' && perms.canPostReturn) {
            actions.push({
              id: 'post',
              label: 'Post',
              icon: Send,
              onClick: () => void postReturnDemo(r.id).then(() => { notify.success('Return posted'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Post failed')),
            })
            actions.push({
              id: 'edit',
              label: 'Edit',
              icon: Eye,
              onClick: () => navigate(`/inventory/movements/returns/new?type=${r.returnType}&sourceId=${r.id}`),
            })
          }
          if (r.status === 'draft' && perms.canCreateReturn) {
            actions.push({
              id: 'cancel',
              label: 'Cancel',
              icon: XCircle,
              onClick: () => void cancelReturnDemo(r.id).then(() => { notify.success('Cancelled'); void load() }).catch((e) => notify.error(e instanceof InventoryServiceError ? e.message : 'Cancel failed')),
            })
          }
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [navigate, perms, load],
  )

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Inventory & Warehouse"
      title="Returns Register"
      description="Source-driven purchase, sales, production and transfer returns."
      breadcrumbs={[{ label: 'Inventory & Warehouse', to: '/inventory' }, { label: 'Returns' }]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/movements/returns"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canCreateReturn ? { id: 'new', label: 'New Return', icon: Plus, onClick: () => navigate('/inventory/movements/returns/new') } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <MovementRegisterTabs tabs={RETURN_REGISTER_TABS} activeTab={tab} onChange={(id) => setSearchParams((p) => { p.set('tab', id); return p })} />
      <SmartFilterBar className="mb-4">
        <SearchInput value={search} onChange={setSearch} placeholder="Search return no, source, party…" />
        <Select value={returnType} onChange={(e) => setReturnType(e.target.value as InventoryReturnType | '')} className="min-w-[180px]">
          <option value="">All return types</option>
          {Object.entries(RETURN_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </Select>
      </SmartFilterBar>
      {loading ? <LoadingState variant="table" /> : null}
      {!loading && rows.length === 0 ? <EmptyState icon={RotateCcw} title="No returns" description="Select a source document and confirm return quantities." /> : null}
      {!loading && rows.length > 0 ? <DataTable columns={columns} data={rows} /> : null}
    </OperationalPageShell>
  )
}
