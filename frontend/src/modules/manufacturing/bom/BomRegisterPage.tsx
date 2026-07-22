import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Copy,
  Eye,
  Layers,
  Pencil,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
} from 'lucide-react'
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
  activateBom,
  deactivateBom,
  duplicateBom,
  getBoms,
} from '@/services/manufacturing'
import type { BillOfMaterial, BomStatus } from '@/types/manufacturing'
import { BOM_STATUS_LABELS } from '@/types/manufacturing'
import { seedManufacturingBoms } from '@/data/manufacturing/seed'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

const FINISHED_ITEM_OPTIONS = Array.from(
  new Map(
    seedManufacturingBoms.map((b) => [
      b.finishedItemCode,
      `${b.finishedItemCode} — ${b.finishedItemName}`,
    ]),
  ).entries(),
)

const VERSION_OPTIONS = [...new Set(seedManufacturingBoms.map((b) => b.version))].sort()

export function BomRegisterPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [search, setSearch] = useState('')
  const [finishedItem, setFinishedItem] = useState('')
  const [status, setStatus] = useState<BomStatus | ''>('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [version, setVersion] = useState('')
  const [rows, setRows] = useState<BillOfMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const list = await getBoms({
        search: search || undefined,
        finishedItem: finishedItem || undefined,
        status: status || (activeFilter === 'all' ? undefined : activeFilter),
        version: version || undefined,
      })
      setRows(list)
    } catch {
      setRows([])
      notify.error('Failed to load BOMs')
    } finally {
      setLoading(false)
    }
  }, [search, finishedItem, status, activeFilter, version])

  useEffect(() => {
    void load()
  }, [load])

  const runAction = useCallback(
    async (
      id: string,
      action: () => Promise<{ ok: boolean; error?: string; bom?: BillOfMaterial }>,
      successMsg: string,
      goToBom?: boolean,
    ) => {
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

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const active = rows.filter((b) => b.status === 'active').length
    const draft = rows.filter((b) => b.status === 'draft').length
    const finishedItems = new Set(rows.map((b) => b.finishedItemCode)).size
    return [
      { id: 'total', label: 'BOMs', value: rows.length, accent: 'blue' },
      { id: 'active', label: 'Active', value: active, accent: 'green' },
      { id: 'draft', label: 'Draft', value: draft, accent: 'amber' },
      { id: 'items', label: 'Finished Items', value: finishedItems, accent: 'slate' },
    ]
  }, [rows])

  const columns = useMemo<ColumnDef<BillOfMaterial>[]>(() => [
    {
      accessorKey: 'bomNumber',
      header: 'BOM No',
      cell: ({ row }) => (
        <TableLink to={`/manufacturing/bom/${row.original.id}`} className="font-mono font-semibold">
          {row.original.bomNumber}
        </TableLink>
      ),
    },
    {
      accessorKey: 'finishedItemCode',
      header: 'Finished Item',
      cell: ({ row }) => (
        <div>
          <div className="font-mono text-[12px]">{row.original.finishedItemCode}</div>
          <div className="text-[12px] text-erp-muted">{row.original.finishedItemName}</div>
        </div>
      ),
    },
    { accessorKey: 'version', header: 'Version' },
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
      header: 'Components Count',
      cell: ({ row }) => <span className="tabular-nums">{row.original.componentCount}</span>,
    },
    {
      accessorKey: 'updatedAt',
      header: 'Last Updated',
      cell: ({ row }) => formatDate(row.original.updatedAt.slice(0, 10)),
    },
    { accessorKey: 'createdBy', header: 'Created By' },
    {
      id: 'actions',
      header: 'Actions',
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
            disabledReason: bom.status === 'active' ? 'Deactivate before editing, or duplicate' : undefined,
          })
        }
        if (perms.canCreateBom) {
          actions.push({
            id: 'duplicate',
            label: 'Duplicate',
            icon: Copy,
            onClick: () => void runAction(bom.id, () => duplicateBom(bom.id), 'BOM duplicated', true),
          })
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
        return (
          <div className={busy ? 'pointer-events-none opacity-50' : undefined} onClick={(e) => e.stopPropagation()}>
            <EnterpriseRowActionsMenu actions={actions} />
          </div>
        )
      },
    },
  ], [busyId, navigate, perms, runAction])

  if (!perms.canViewBom) {
    return (
      <ProductionPageHeader title="Bill of Materials" favoritePath="/manufacturing/bom">
        <ProductionEmptyState icon={Layers} title="Access denied" description="Missing BOM view permission." />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Bill of Materials"
      description="Tells what is needed — recipes that Work Orders consume. Not a separate production document."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'BOM' },
      ]}
      favoritePath="/manufacturing/bom"
      kpiStrip={kpiStrip}
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
        {
          id: 'traveler',
          label: 'ISO Tank Traveler BOM',
          icon: Layers,
          onClick: () => navigate('/manufacturing/bom/mfg-bom-003'),
        },
        { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
      ]}
      filterBar={
        <div className="flex flex-wrap items-end gap-2">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search BOM / item…"
            className="min-w-[180px] max-w-xs"
            aria-label="Search BOMs"
          />
          <label className="text-[11px] font-medium text-erp-muted">
            Finished Item
            <Select
              value={finishedItem}
              onChange={(e) => setFinishedItem(e.target.value)}
              className="mt-0.5 block w-56"
              aria-label="Filter by finished item"
            >
              <option value="">All items</option>
              {FINISHED_ITEM_OPTIONS.map(([id, label]) => (
                <option key={id} value={id}>{label}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Status
            <Select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as BomStatus | '')
                setActiveFilter('all')
              }}
              className="mt-0.5 block w-36"
              aria-label="Filter by status"
            >
              <option value="">All statuses</option>
              {(Object.keys(BOM_STATUS_LABELS) as BomStatus[]).map((s) => (
                <option key={s} value={s}>{BOM_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Active / Inactive
            <Select
              value={activeFilter}
              onChange={(e) => {
                const v = e.target.value as 'all' | 'active' | 'inactive'
                setActiveFilter(v)
                if (v !== 'all') setStatus('')
              }}
              className="mt-0.5 block w-40"
              aria-label="Filter active or inactive"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </label>
          <label className="text-[11px] font-medium text-erp-muted">
            Version
            <Select
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              className="mt-0.5 block w-28"
              aria-label="Filter by version"
            >
              <option value="">All</option>
              {VERSION_OPTIONS.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </Select>
          </label>
        </div>
      }
    >
      <ManufacturingDemoBanner message="BOM tells what is needed. Execution stays on the Work Order." />

      {loading ? <LoadingState variant="table" rows={8} /> : null}
      {!loading && rows.length === 0 ? (
        <ProductionEmptyState
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
      {!loading && rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
          <DataTable data={rows} columns={columns} />
        </div>
      ) : null}
    </ProductionPageHeader>
  )
}
