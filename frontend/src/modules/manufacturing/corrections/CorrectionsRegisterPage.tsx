import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Plus, RotateCcw, ShieldAlert } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { SearchInput } from '@/components/ui/SearchInput'
import { TableLink } from '@/components/ui/AppLink'
import { DataTable } from '@/components/tables/DataTable'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import { Select } from '@/components/forms/Inputs'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { listCorrections } from '@/services/api/manufacturingApi'
import type {
  CorrectionAction,
  CorrectionStatus,
  CorrectionTransactionType,
  ManufacturingCorrection,
} from '@/types/manufacturingCorrection'
import {
  CORRECTION_ACTION_LABELS,
  CORRECTION_STATUS_LABELS,
  CORRECTION_STATUSES,
  CORRECTION_TRANSACTION_TYPE_LABELS,
  CORRECTION_TRANSACTION_TYPES,
} from '@/types/manufacturingCorrection'
import {
  canRequestCorrection,
  canViewCorrections,
} from '@/utils/permissions/manufacturing'
import { notify } from '@/store/toastStore'
import { formatDateTime } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'
import { CorrectionDrawer } from './CorrectionDrawer'

type StatusView = '' | CorrectionStatus

function statusTone(status: CorrectionStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'bg-slate-100 text-slate-700'
    case 'PENDING_APPROVAL':
      return 'bg-amber-100 text-amber-800'
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800'
    case 'APPLIED':
      return 'bg-sky-100 text-sky-800'
    case 'REJECTED':
    case 'FAILED':
      return 'bg-rose-100 text-rose-800'
    case 'CANCELLED':
      return 'bg-slate-100 text-slate-500'
    default:
      return 'bg-slate-100 text-slate-700'
  }
}

/** Corrections / reversals register — Accounting-style list with status chips. */
export function CorrectionsRegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workOrderId = searchParams.get('workOrderId') ?? undefined

  const [rows, setRows] = useState<ManufacturingCorrection[]>([])
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState<StatusView>('')
  const [transactionType, setTransactionType] = useState<'' | CorrectionTransactionType>('')
  const [action, setAction] = useState<'' | CorrectionAction>('')
  const [search, setSearch] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    if (!isApiMode()) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await listCorrections({
        limit: 100,
        ...(status ? { status } : {}),
        ...(transactionType ? { transactionType } : {}),
        ...(action ? { action } : {}),
        ...(workOrderId ? { productionOrderId: workOrderId } : {}),
        ...(search.trim() ? { search: search.trim() } : {}),
      })
      setRows(res.data)
    } catch (error) {
      setRows([])
      notify.error(error instanceof Error ? error.message : 'Failed to load corrections')
    } finally {
      setLoading(false)
    }
  }, [action, search, status, transactionType, workOrderId])

  useEffect(() => {
    if (canViewCorrections()) void load()
    else setLoading(false)
  }, [load])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(() => {
    const count = (s: CorrectionStatus) => rows.filter((r) => r.status === s).length
    const kpi = (
      id: string,
      label: string,
      filter: CorrectionStatus,
      accent: EnterpriseKpiItem['accent'],
    ): EnterpriseKpiItem => ({
      id,
      label,
      value: count(filter),
      accent,
      active: status === filter,
      onClick: () => setStatus((prev) => (prev === filter ? '' : filter)),
    })
    return [
      kpi('draft', 'Draft', 'DRAFT', 'slate'),
      kpi('pending', 'Pending Approval', 'PENDING_APPROVAL', 'amber'),
      kpi('approved', 'Approved', 'APPROVED', 'green'),
      kpi('applied', 'Applied', 'APPLIED', 'blue'),
    ]
  }, [rows, status])

  const columns = useMemo<ColumnDef<ManufacturingCorrection>[]>(
    () => [
      {
        accessorKey: 'correctionNumber',
        header: 'Correction',
        cell: ({ row }) => (
          <div>
            <p className="font-mono text-[12px] font-semibold text-erp-text">{row.original.correctionNumber}</p>
            <p className="text-[11px] text-erp-muted">{CORRECTION_ACTION_LABELS[row.original.action]}</p>
          </div>
        ),
      },
      {
        id: 'type',
        header: 'Transaction',
        cell: ({ row }) => (
          <div>
            <p className="text-[12px]">{CORRECTION_TRANSACTION_TYPE_LABELS[row.original.transactionType]}</p>
            <p className="max-w-[160px] truncate font-mono text-[10px] text-erp-muted" title={row.original.sourceEntityId}>
              {row.original.sourceEntityLabel || row.original.sourceEntityId.slice(0, 12)}
            </p>
          </div>
        ),
      },
      {
        id: 'workOrder',
        header: 'Work order',
        cell: ({ row }) =>
          row.original.productionOrderId ? (
            <TableLink
              to={`/manufacturing/work-orders/${row.original.productionOrderId}`}
              className="font-mono text-[12px] font-semibold"
            >
              {row.original.productionOrderNumber ?? row.original.productionOrderId.slice(0, 8)}
            </TableLink>
          ) : (
            <span className="text-erp-muted">—</span>
          ),
      },
      {
        accessorKey: 'status',
        header: 'Status',
        cell: ({ row }) => (
          <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', statusTone(row.original.status))}>
            {CORRECTION_STATUS_LABELS[row.original.status]}
          </span>
        ),
      },
      {
        id: 'risk',
        header: 'Risk',
        cell: ({ row }) => <span className="capitalize text-[12px]">{row.original.riskLevel.toLowerCase()}</span>,
      },
      {
        accessorKey: 'reason',
        header: 'Reason',
        cell: ({ row }) => (
          <span className="max-w-[240px] truncate text-[12px]" title={row.original.reason}>
            {row.original.reason || '—'}
          </span>
        ),
      },
      {
        id: 'requested',
        header: 'Requested',
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-[12px] text-erp-muted">
            {row.original.requestedAt ? formatDateTime(row.original.requestedAt) : '—'}
          </span>
        ),
      },
    ],
    [],
  )

  if (!canViewCorrections()) {
    return (
      <ProductionPageHeader title="Corrections" favoritePath="/manufacturing/corrections">
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="You need manufacturing.correction.view to open this register."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Corrections"
      description="Reverse or correct posted manufacturing transactions — originals stay immutable."
      favoritePath="/manufacturing/corrections"
      kpiStrip={isApiMode() ? kpiStrip : undefined}
      primaryAction={
        canRequestCorrection() && isApiMode()
          ? {
              id: 'new-correction',
              label: 'New correction',
              icon: Plus,
              onClick: () => setDrawerOpen(true),
            }
          : undefined
      }
      filterBar={
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-9 min-w-[150px] text-[12px]"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusView)}
          >
            <option value="">All statuses</option>
            {CORRECTION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CORRECTION_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            className="h-9 min-w-[160px] text-[12px]"
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as '' | CorrectionTransactionType)}
          >
            <option value="">All types</option>
            {CORRECTION_TRANSACTION_TYPES.map((value) => (
              <option key={value} value={value}>
                {CORRECTION_TRANSACTION_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            className="h-9 min-w-[140px] text-[12px]"
            value={action}
            onChange={(e) => setAction(e.target.value as '' | CorrectionAction)}
          >
            <option value="">All actions</option>
            <option value="REVERSE">Full reverse</option>
            <option value="CORRECT">Correct quantities</option>
          </Select>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search number or reason"
            className="min-w-[200px]"
          />
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
          {workOrderId ? (
            <Button variant="ghost" size="sm" onClick={() => navigate('/manufacturing/corrections')}>
              Clear WO filter
            </Button>
          ) : null}
        </div>
      }
    >
      {!isApiMode() ? (
        <ProductionEmptyState
          icon={RotateCcw}
          title="Corrections require API mode"
          description="Turn on VITE_USE_API to list and request manufacturing corrections."
        />
      ) : (
        <>
          {workOrderId ? (
            <p className="mb-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
              Filtered to work order{' '}
              <Link className="font-mono font-semibold hover:underline" to={`/manufacturing/work-orders/${workOrderId}`}>
                {workOrderId.slice(0, 8)}…
              </Link>
            </p>
          ) : null}

          {loading ? (
            <LoadingState variant="table" rows={8} />
          ) : rows.length === 0 ? (
            <ProductionEmptyState
              icon={RotateCcw}
              title="No corrections yet"
              description="Request a reverse or quantity correction for a posted manufacturing transaction."
              action={
                canRequestCorrection() ? (
                  <Button size="sm" onClick={() => setDrawerOpen(true)}>
                    New correction
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <DataTable columns={columns} data={rows} />
            </div>
          )}
        </>
      )}

      <CorrectionDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => void load()}
        context={workOrderId ? { workOrderId } : undefined}
      />
    </ProductionPageHeader>
  )
}
