import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Copy,
  Eye,
  FilePlus2,
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Wrench,
} from 'lucide-react'
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
import {
  activateBom,
  createBomVersion,
  deactivateBom,
  duplicateBom,
  getBoms,
} from '@/services/manufacturing'
import type { BillOfMaterial, BomStatus, ManufacturingFilter, ProductionMethod } from '@/types/manufacturing'
import {
  BOM_STATUS_LABELS,
  PRODUCTION_METHOD_LABELS,
} from '@/types/manufacturing'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { cn } from '@/utils/cn'

const BOM_TABS: { id: NonNullable<ManufacturingFilter['tab']>; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'draft', label: 'Draft' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'in_house', label: 'In-House' },
  { id: 'job_work', label: 'Job Work' },
  { id: 'mixed', label: 'Mixed' },
]

export function BomRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [tab, setTab] = useState<NonNullable<ManufacturingFilter['tab']>>('all')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<BomStatus | ''>('')
  const [method, setMethod] = useState<ProductionMethod | ''>('')
  const [rows, setRows] = useState<BillOfMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getBoms({
        tab,
        search: search || undefined,
        status: status || undefined,
        productionMethod: method || undefined,
      })
      setRows(list)
    } catch {
      setRows([])
      notify.error('Failed to load BOMs')
    } finally {
      setLoading(false)
    }
  }, [tab, search, status, method])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(
    async (id: string, action: () => Promise<{ ok: boolean; error?: string; bom?: BillOfMaterial }>, successMsg: string, goToBom?: boolean) => {
      setBusyId(id)
      try {
        const r = await action()
        if (!r.ok) {
          notify.error(r.error ?? 'Action failed')
          return
        }
        notify.success(successMsg)
        if (goToBom && r.bom) navigate(`/manufacturing/bom/${r.bom.id}`)
        else await load()
      } finally {
        setBusyId(null)
      }
    },
    [load, navigate],
  )

  const columns = useMemo<ColumnDef<BillOfMaterial>[]>(() => {
    const cols: ColumnDef<BillOfMaterial>[] = [
      {
        accessorKey: 'bomNumber',
        header: 'BOM Number',
        cell: ({ row }) => (
          <TableLink to={`/manufacturing/bom/${row.original.id}`} className="font-mono">
            {row.original.bomNumber}
          </TableLink>
        ),
      },
      { accessorKey: 'finishedItemCode', header: 'Finished Item', cell: ({ row }) => (
        <div>
          <div className="font-mono text-[12px]">{row.original.finishedItemCode}</div>
          <div className="text-[12px] text-erp-muted">{row.original.finishedItemName}</div>
        </div>
      ) },
      { accessorKey: 'itemCategory', header: 'Category' },
      { accessorKey: 'version', header: 'Version' },
      {
        accessorKey: 'productionMethod',
        header: 'Method',
        cell: ({ row }) => PRODUCTION_METHOD_LABELS[row.original.productionMethod],
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <StatusDot
            label={BOM_STATUS_LABELS[row.original.status]}
            tone={statusToneFromLabel(row.original.status)}
          />
        ),
      },
      {
        accessorKey: 'componentCount',
        header: 'Components',
        cell: ({ row }) => <span className="tabular-nums">{row.original.componentCount}</span>,
      },
    ]

    if (perms.canViewCost) {
      cols.push({
        accessorKey: 'estimatedCost',
        header: 'Estimated Cost',
        cell: ({ row }) => (
          <span className="tabular-nums">{formatCurrency(row.original.estimatedCost)}</span>
        ),
      })
    }

    cols.push(
      {
        accessorKey: 'effectiveFrom',
        header: 'Effective From',
        cell: ({ row }) => formatDate(row.original.effectiveFrom),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const bom = row.original
          const busy = busyId === bom.id
          const actions: RowActionItem[] = [
            {
              id: 'view',
              label: 'View',
              icon: Eye,
              onClick: () => navigate(`/manufacturing/bom/${bom.id}`),
            },
          ]
          if (perms.canEditBom) {
            actions.push({
              id: 'edit',
              label: 'Edit',
              icon: Pencil,
              onClick: () => navigate(`/manufacturing/bom/${bom.id}/edit`),
              disabled: bom.status === 'active',
              disabledReason: bom.status === 'active' ? 'Deactivate before editing, or create a new version' : undefined,
            })
          }
          if (perms.canCreateBom) {
            actions.push(
              {
                id: 'duplicate',
                label: 'Duplicate',
                icon: Copy,
                onClick: () => void runAction(bom.id, () => duplicateBom(bom.id), 'BOM duplicated', true),
              },
              {
                id: 'version',
                label: 'Create New Version',
                icon: FilePlus2,
                onClick: () => void runAction(bom.id, () => createBomVersion(bom.id), 'New version created', true),
              },
            )
          }
          if (perms.canActivateBom && bom.status !== 'active') {
            actions.push({
              id: 'activate',
              label: 'Activate',
              icon: Power,
              onClick: () => void runAction(bom.id, () => activateBom(bom.id), 'BOM activated'),
            })
          }
          if (perms.canDeactivateBom && bom.status === 'active') {
            actions.push({
              id: 'deactivate',
              label: 'Deactivate',
              icon: PowerOff,
              onClick: () => void runAction(bom.id, () => deactivateBom(bom.id), 'BOM deactivated'),
            })
          }
          actions.push({
            id: 'wo',
            label: 'Create Work Order',
            icon: Wrench,
            onClick: () => navigate(`/manufacturing/work-orders/new?bomId=${bom.id}`),
          })
          return (
            <div className={busy ? 'pointer-events-none opacity-50' : undefined} onClick={(e) => e.stopPropagation()}>
              <EnterpriseRowActionsMenu actions={actions} />
            </div>
          )
        },
      },
    )

    return cols
  }, [busyId, navigate, perms, runAction])

  if (!perms.canViewBom) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="Bill of Materials"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'BOM' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={Layers} title="Access denied" description="Missing BOM view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Bill of Materials"
      description="Define finished goods structure, materials and production method."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'BOM' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/bom"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateBom
              ? {
                  id: 'new',
                  label: 'New BOM',
                  icon: Plus,
                  onClick: () => navigate('/manufacturing/bom/new'),
                }
              : undefined
          }
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="BOM tabs">
          {BOM_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={cn(
                'erp-btn h-8 px-3 text-[12px]',
                tab === t.id ? 'erp-btn-primary' : 'erp-btn-ghost',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search BOM / item / category…"
          className="ml-auto max-w-xs"
        />
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value as BomStatus | '')}
          className="w-36"
        >
          <option value="">All statuses</option>
          {(Object.keys(BOM_STATUS_LABELS) as BomStatus[]).map((s) => (
            <option key={s} value={s}>{BOM_STATUS_LABELS[s]}</option>
          ))}
        </Select>
        <Select
          value={method}
          onChange={(e) => setMethod(e.target.value as ProductionMethod | '')}
          className="w-40"
        >
          <option value="">All methods</option>
          {(Object.keys(PRODUCTION_METHOD_LABELS) as ProductionMethod[]).map((m) => (
            <option key={m} value={m}>{PRODUCTION_METHOD_LABELS[m]}</option>
          ))}
        </Select>
      </div>

      {loading ? <LoadingState variant="table" rows={8} /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No BOMs found"
          description="Create a bill of materials for a finished item."
          action={
            perms.canCreateBom ? (
              <button
                type="button"
                className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
                onClick={() => navigate('/manufacturing/bom/new')}
              >
                New BOM
              </button>
            ) : undefined
          }
        />
      ) : null}
      {!loading && rows.length > 0 ? <DataTable data={rows} columns={columns} /> : null}
    </OperationalPageShell>
  )
}
