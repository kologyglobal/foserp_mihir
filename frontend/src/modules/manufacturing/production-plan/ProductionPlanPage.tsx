import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  Calendar,
  CheckSquare,
  ClipboardList,
  ExternalLink,
  EyeOff,
  Hash,
  RefreshCw,
  Wrench,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  EnterpriseRowActionsMenu,
  type RowActionItem,
} from '@/design-system/enterprise/EnterpriseTablePrimitives'
import {
  checkPlannedMaterialAvailability,
  createSelectedWorkOrdersDemo,
  createWorkOrderDraftFromPlanDemo,
  getProductionPlan,
  ignoreProductionRequirementDemo,
  updateProductionPlanLineDemo,
} from '@/services/manufacturing'
import type { ProductionPlanLine } from '@/types/manufacturing'
import {
  MATERIAL_STATUS_LABELS,
  PRODUCTION_METHOD_LABELS,
  REQUIREMENT_SOURCE_LABELS,
} from '@/types/manufacturing'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { useManufacturingPermissions } from '@/utils/permissions/manufacturing'

export function ProductionPlanPage() {
  const navigate = useNavigate()
  const perms = useManufacturingPermissions()
  const [rows, setRows] = useState<ProductionPlanLine[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setRows(await getProductionPlan())
    } catch {
      setRows([])
      notify.error('Failed to load production plan')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = useCallback(() => {
    if (selected.size === rows.length) setSelected(new Set())
    else setSelected(new Set(rows.map((r) => r.id)))
  }, [rows, selected.size])

  const createWo = useCallback(async (id: string) => {
    setBusy(true)
    try {
      const r = await createWorkOrderDraftFromPlanDemo(id)
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success(`Draft work order ${r.workOrderNo} created`)
      setSelected((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
      await load()
    } finally {
      setBusy(false)
    }
  }, [load])

  const createSelected = async () => {
    if (selected.size === 0) {
      notify.warning('Select at least one requirement')
      return
    }
    setBusy(true)
    try {
      const r = await createSelectedWorkOrdersDemo([...selected])
      if (!r.ok) {
        notify.error(r.error)
        return
      }
      notify.success(`Created ${r.created.length} draft work order(s)`)
      setSelected(new Set())
      await load()
    } finally {
      setBusy(false)
    }
  }

  const checkMaterials = async () => {
    setBusy(true)
    try {
      const ids = selected.size > 0 ? [...selected] : undefined
      setRows(await checkPlannedMaterialAvailability(ids))
      notify.success('Material availability checked')
    } finally {
      setBusy(false)
    }
  }

  const columns = useMemo<ColumnDef<ProductionPlanLine>[]>(
    () => [
      {
        id: 'select',
        header: () => (
          <input
            type="checkbox"
            aria-label="Select all"
            checked={rows.length > 0 && selected.size === rows.length}
            onChange={toggleAll}
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            aria-label={`Select ${row.original.finishedItemCode}`}
            checked={selected.has(row.original.id)}
            onChange={() => toggle(row.original.id)}
          />
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
      {
        accessorKey: 'source',
        header: 'Source',
        cell: ({ row }) => REQUIREMENT_SOURCE_LABELS[row.original.source],
      },
      {
        accessorKey: 'sourceDocumentNo',
        header: 'Source Doc',
        cell: ({ row }) =>
          row.original.source === 'sales_order' && row.original.sourceDocumentId ? (
            <Link
              to={`/sales/orders/${row.original.sourceDocumentId}`}
              className="font-mono text-erp-primary hover:underline"
            >
              {row.original.sourceDocumentNo}
            </Link>
          ) : (
            <span className="font-mono text-[12px]">{row.original.sourceDocumentNo}</span>
          ),
      },
      {
        accessorKey: 'demandQuantity',
        header: 'Demand',
        cell: ({ row }) => <span className="tabular-nums">{row.original.demandQuantity}</span>,
      },
      {
        accessorKey: 'safetyStock',
        header: 'Safety',
        cell: ({ row }) => <span className="tabular-nums">{row.original.safetyStock}</span>,
      },
      {
        accessorKey: 'availableFinishedStock',
        header: 'FG Stock',
        cell: ({ row }) => <span className="tabular-nums">{row.original.availableFinishedStock}</span>,
      },
      {
        accessorKey: 'openWorkOrderQuantity',
        header: 'Open WO',
        cell: ({ row }) => <span className="tabular-nums">{row.original.openWorkOrderQuantity}</span>,
      },
      {
        accessorKey: 'requiredProductionQuantity',
        header: 'To Produce',
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">{row.original.requiredProductionQuantity}</span>
        ),
      },
      {
        accessorKey: 'materialStatus',
        header: 'Materials',
        cell: ({ row }) => (
          <StatusDot
            label={MATERIAL_STATUS_LABELS[row.original.materialStatus]}
            tone={statusToneFromLabel(row.original.materialStatus)}
          />
        ),
      },
      {
        accessorKey: 'requiredDate',
        header: 'Required Date',
        cell: ({ row }) => formatDate(row.original.requiredDate),
      },
      {
        accessorKey: 'productionMethod',
        header: 'Method',
        cell: ({ row }) => PRODUCTION_METHOD_LABELS[row.original.productionMethod],
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const line = row.original
          const actions: RowActionItem[] = []
          if (perms.canCreateWoFromPlan) {
            actions.push({
              id: 'wo',
              label: 'Create Work Order',
              icon: Wrench,
              onClick: () => void createWo(line.id),
              disabled: busy || line.requiredProductionQuantity <= 0,
            })
          }
          actions.push(
            {
              id: 'qty',
              label: 'Change Qty',
              icon: Hash,
              onClick: () => {
                const raw = window.prompt('Demand quantity', String(line.demandQuantity))
                if (raw == null) return
                const demandQuantity = Number(raw)
                if (!(demandQuantity > 0)) {
                  notify.error('Quantity must be greater than zero')
                  return
                }
                void updateProductionPlanLineDemo(line.id, { demandQuantity }).then((r) => {
                  if (!r.ok) notify.error(r.error)
                  else {
                    notify.success('Quantity updated')
                    void load()
                  }
                })
              },
            },
            {
              id: 'date',
              label: 'Change Date',
              icon: Calendar,
              onClick: () => {
                const raw = window.prompt('Required date (YYYY-MM-DD)', line.requiredDate)
                if (raw == null || !raw.trim()) return
                void updateProductionPlanLineDemo(line.id, { requiredDate: raw.trim() }).then((r) => {
                  if (!r.ok) notify.error(r.error)
                  else {
                    notify.success('Date updated')
                    void load()
                  }
                })
              },
            },
            {
              id: 'ignore',
              label: 'Ignore',
              icon: EyeOff,
              onClick: () => {
                void ignoreProductionRequirementDemo(line.id).then((r) => {
                  if (!r.ok) notify.error(r.error)
                  else {
                    notify.success('Requirement ignored')
                    setSelected((prev) => {
                      const next = new Set(prev)
                      next.delete(line.id)
                      return next
                    })
                    void load()
                  }
                })
              },
            },
          )
          if (line.source === 'sales_order' && line.sourceDocumentId) {
            actions.push({
              id: 'source',
              label: 'Open Source',
              icon: ExternalLink,
              onClick: () => navigate(`/sales/orders/${line.sourceDocumentId}`),
            })
          }
          return <EnterpriseRowActionsMenu actions={actions} />
        },
      },
    ],
    [busy, createWo, load, navigate, perms.canCreateWoFromPlan, rows.length, selected, toggleAll],
  )

  if (!perms.canViewPlan) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Manufacturing"
        title="Production Plan"
        breadcrumbs={[
          { label: 'Manufacturing & Production', to: '/manufacturing' },
          { label: 'Production Plan' },
        ]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ClipboardList} title="Access denied" description="Missing production plan view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Manufacturing"
      title="Production Plan"
      description="Convert demand into work order drafts — check materials before releasing."
      breadcrumbs={[
        { label: 'Manufacturing & Production', to: '/manufacturing' },
        { label: 'Production Plan' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/manufacturing/production-plan"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateWoFromPlan
              ? {
                  id: 'create-selected',
                  label: selected.size > 0 ? `Create Selected (${selected.size})` : 'Create Selected',
                  icon: CheckSquare,
                  onClick: () => void createSelected(),
                  disabled: busy || selected.size === 0,
                }
              : undefined
          }
          secondaryActions={[
            {
              id: 'check',
              label: 'Check Materials',
              onClick: () => void checkMaterials(),
              disabled: busy,
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      )}
    >
      {loading ? <LoadingState variant="table" rows={6} /> : null}
      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No production requirements"
          description="All requirements are fulfilled or ignored."
        />
      ) : null}
      {!loading && rows.length > 0 ? <DataTable data={rows} columns={columns} /> : null}
    </OperationalPageShell>
  )
}
