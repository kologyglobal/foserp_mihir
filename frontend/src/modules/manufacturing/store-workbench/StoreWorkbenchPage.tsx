import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Package, RotateCcw, ShieldAlert, Warehouse } from 'lucide-react'
import { isApiMode } from '@/config/apiConfig'
import { ManufacturingDemoBanner } from '@/components/manufacturing'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Button } from '@/design-system/components/Button'
import { StatusDot, statusToneFromLabel } from '@/components/design-system/StatusDot'
import {
  getStoreWorkbenchFinishedGoods,
  getStoreWorkbenchIssues,
  getStoreWorkbenchReconciliation,
  getStoreWorkbenchReservations,
  getStoreWorkbenchReturns,
  getStoreWorkbenchSummary,
  getStoreWorkbenchWip,
  type StoreWorkbenchSummary,
} from '@/services/api/manufacturingApi'
import { canViewStoreWorkbench } from '@/utils/permissions/manufacturing'
import { canInventoryPermission } from '@/utils/permissions/inventory'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { ProductionEmptyState, ProductionPageHeader } from '../ui'

type WorkbenchTab =
  | 'to_reserve'
  | 'to_issue'
  | 'returns'
  | 'wip'
  | 'finished_goods'
  | 'reconciliation'

const TABS: Array<{ id: WorkbenchTab; label: string; kpiKey: keyof StoreWorkbenchSummary['kpis'] | null }> = [
  { id: 'to_issue', label: 'Needs Action', kpiKey: 'waitingIssue' },
  { id: 'to_reserve', label: 'Production Requests', kpiKey: 'waitingReservation' },
  { id: 'wip', label: 'Transfers', kpiKey: 'waitingWip' },
  { id: 'returns', label: 'Incoming', kpiKey: 'waitingReturns' },
  { id: 'finished_goods', label: 'Finished Goods', kpiKey: 'waitingFg' },
  { id: 'reconciliation', label: 'Exceptions', kpiKey: null },
]

const EMPTY_SUMMARY: StoreWorkbenchSummary = {
  asOf: '',
  openWorkOrders: 0,
  kpis: {
    waitingReservation: 0,
    waitingIssue: 0,
    waitingReturns: 0,
    waitingWip: 0,
    waitingFg: 0,
    activeWoReservations: 0,
  },
}

function rowLabel(row: Record<string, unknown>): string {
  const order = String(row.orderNumber ?? '')
  const item = (row.item as { code?: string } | undefined)?.code
    ?? (row.product as { code?: string } | undefined)?.code
    ?? ''
  const status = String(row.status ?? '')
  return [order, item, status].filter(Boolean).join(' · ')
}

/** Phase 7A5 — Store workbench: reservation / issue / return / WIP / FG queues. */
export function StoreWorkbenchPage() {
  const navigate = useNavigate()
  const hasAccess = canViewStoreWorkbench()
    || canInventoryPermission('inventory.stock.view')
    || canInventoryPermission('inventory.view')
  const [tab, setTab] = useState<WorkbenchTab>('to_issue')
  const [summary, setSummary] = useState<StoreWorkbenchSummary>(EMPTY_SUMMARY)
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)

  const loadSummary = useCallback(async () => {
    if (!isApiMode()) {
      setSummary(EMPTY_SUMMARY)
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setSummary((await getStoreWorkbenchSummary()).data ?? EMPTY_SUMMARY)
    } catch (error) {
      setSummary(EMPTY_SUMMARY)
      notify.error(error instanceof Error ? error.message : 'Failed to load store workbench')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadRows = useCallback(async (active: WorkbenchTab) => {
    if (!isApiMode()) {
      setRows([])
      return
    }
    setRowsLoading(true)
    try {
      const fetchers: Record<WorkbenchTab, () => Promise<{ data: { rows: Record<string, unknown>[] } }>> = {
        to_reserve: () => getStoreWorkbenchReservations(50),
        to_issue: () => getStoreWorkbenchIssues(50),
        returns: () => getStoreWorkbenchReturns(50),
        wip: () => getStoreWorkbenchWip(50),
        finished_goods: () => getStoreWorkbenchFinishedGoods(50),
        reconciliation: () => getStoreWorkbenchReconciliation(50),
      }
      const res = await fetchers[active]()
      setRows(res.data?.rows ?? [])
    } catch (error) {
      setRows([])
      notify.error(error instanceof Error ? error.message : 'Failed to load queue')
    } finally {
      setRowsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (hasAccess) void loadSummary()
    else setLoading(false)
  }, [hasAccess, loadSummary])

  useEffect(() => {
    if (hasAccess && isApiMode() && !loading) void loadRows(tab)
  }, [hasAccess, tab, loading, loadRows])

  const kpiStrip = useMemo<EnterpriseKpiItem[]>(
    () => [
      {
        id: 'waitingReservation',
        label: 'Production requests',
        value: summary.kpis.waitingReservation,
        accent: 'amber',
        active: tab === 'to_reserve',
        onClick: () => setTab('to_reserve'),
      },
      {
        id: 'waitingIssue',
        label: 'Material to issue',
        value: summary.kpis.waitingIssue,
        accent: 'blue',
        active: tab === 'to_issue',
        onClick: () => setTab('to_issue'),
      },
      {
        id: 'waitingReturns',
        label: 'Incoming today',
        value: summary.kpis.waitingReturns,
        accent: 'slate',
        active: tab === 'returns',
        onClick: () => setTab('returns'),
      },
      {
        id: 'waitingWip',
        label: 'Transfers pending',
        value: summary.kpis.waitingWip,
        accent: 'blue',
        active: tab === 'wip',
        onClick: () => setTab('wip'),
      },
      {
        id: 'waitingFg',
        label: 'FG receipts pending',
        value: summary.kpis.waitingFg,
        accent: 'green',
        active: tab === 'finished_goods',
        onClick: () => setTab('finished_goods'),
      },
    ],
    [summary.kpis, tab],
  )

  if (!hasAccess) {
    return (
      <ProductionPageHeader title="Store Workbench" favoritePath="/manufacturing/store-workbench">
        <ProductionEmptyState
          icon={ShieldAlert}
          title="Access denied"
          description="You need Store Workbench or inventory stock access to open this page."
        />
      </ProductionPageHeader>
    )
  }

  return (
    <ProductionPageHeader
      title="Store Workbench"
      description="Receive, reserve, issue, transfer and track material from one place."
      favoritePath="/manufacturing/store-workbench"
      secondaryActions={
        isApiMode()
          ? [
              {
                id: 'stock-lookup',
                label: 'Stock Lookup',
                icon: Warehouse,
                onClick: () => navigate('/inventory/stock'),
              },
              {
                id: 'open-work-orders',
                label: 'New Movement',
                icon: Package,
                onClick: () => navigate('/inventory/inward'),
              },
              {
                id: 'refresh',
                label: 'Refresh',
                icon: RotateCcw,
                onClick: () => {
                  void loadSummary()
                  void loadRows(tab)
                },
              },
            ]
          : undefined
      }
      kpiStrip={isApiMode() && !loading ? kpiStrip : undefined}
      filterBar={
        isApiMode() ? (
          <div className="flex flex-wrap items-center gap-1">
            {TABS.map((t) => {
              const count = t.kpiKey ? summary.kpis[t.kpiKey] : null
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'rounded border px-3 py-1.5 text-[12px] font-medium transition-colors',
                    tab === t.id
                      ? 'border-erp-accent/40 bg-slate-50 text-erp-text'
                      : 'border-transparent text-erp-muted hover:border-erp-border hover:bg-white',
                  )}
                >
                  {t.label}
                  {count != null ? <span className="ml-1.5 tabular-nums text-erp-muted">{count}</span> : null}
                </button>
              )
            })}
          </div>
        ) : undefined
      }
    >
      {!isApiMode() ? (
        <>
          <ManufacturingDemoBanner message="Store Workbench requires API mode — enable VITE_USE_API to load reservation, issue, WIP, and FG queues." />
          <ProductionEmptyState
            icon={Warehouse}
            title="Store Workbench requires API mode"
            description="Turn on VITE_USE_API to load live store queues from manufacturing work orders."
          />
        </>
      ) : loading ? (
        <LoadingState variant="table" rows={6} />
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-erp-border bg-white px-3 py-2 text-[12px] text-erp-muted">
            {summary.openWorkOrders} open work order{summary.openWorkOrders === 1 ? '' : 's'}
            {summary.asOf ? (
              <>
                {' '}
                · as of <span className="tabular-nums">{new Date(summary.asOf).toLocaleString()}</span>
              </>
            ) : null}
            {summary.kpis.activeWoReservations > 0 ? (
              <>
                {' '}
                · {summary.kpis.activeWoReservations} active WO reservation
                {summary.kpis.activeWoReservations === 1 ? '' : 's'}
              </>
            ) : null}
          </div>

          {rowsLoading ? (
            <LoadingState variant="table" rows={4} />
          ) : rows.length === 0 ? (
            <ProductionEmptyState
              icon={Warehouse}
              title="Queue empty"
              description="No rows in this store queue. Open Work Orders to reserve, issue, return, or post FG."
              action={
                <Button size="sm" onClick={() => navigate('/manufacturing/work-orders')}>
                  Open Work Orders
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
              <table className="erp-table w-full min-w-[560px] text-left text-[12px]">
                <thead>
                  <tr>
                    <th>Work Order / Item</th>
                    <th>Status</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const woId = String(row.workOrderId ?? '')
                    const status = String(row.status ?? '')
                    return (
                      <tr key={`${woId}-${idx}`}>
                        <td className="text-erp-text">{rowLabel(row)}</td>
                        <td>
                          {status ? (
                            <StatusDot label={status.replace(/_/g, ' ')} tone={statusToneFromLabel(status)} />
                          ) : (
                            <span className="text-erp-muted">—</span>
                          )}
                        </td>
                        <td className="text-right">
                          {woId ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => navigate(`/manufacturing/work-orders/${woId}`)}
                            >
                              Open
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </ProductionPageHeader>
  )
}
