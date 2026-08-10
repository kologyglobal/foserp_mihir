import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
  ChevronRight,
  ClipboardList,
  Factory,
  Package,
  PackageOpen,
  Plus,
  RefreshCw,
  Settings2,
  Truck,
  Wrench,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import { Button } from '@/components/ui/Button'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import { formatDate } from '@/utils/dates/format'
import { formatNumber } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { appConfirm } from '@/store/confirmDialogStore'
import { listInventoryStockCounts, type ApiInventoryDocument } from '@/services/api/inventoryDocumentsApi'
import {
  cancelInventoryReservation,
  listInventoryReservations,
  type InventoryReservationDemandType,
  type InventoryStockReservation,
} from '@/services/api/inventoryApi'
import { cn } from '@/utils/cn'

export type StoreOpChoice = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  badge?: string
  /** Optional section heading; choices with the same group render together. */
  group?: string
  /** Highlight as the primary recommended path. */
  primary?: boolean
}

export function StoreOpHub({
  title,
  description,
  favoritePath,
  choices,
}: {
  title: string
  description: string
  favoritePath: string
  choices: StoreOpChoice[]
}) {
  const navigate = useNavigate()

  const groups = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, StoreOpChoice[]>()
    for (const c of choices) {
      const key = c.group?.trim() || 'Paths'
      if (!map.has(key)) {
        map.set(key, [])
        order.push(key)
      }
      map.get(key)!.push(c)
    }
    return order.map((name) => ({ name, items: map.get(name)! }))
  }, [choices])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title={title}
      description={description}
      showDescription
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: title },
      ]}
      autoBreadcrumbs={false}
      favoritePath={favoritePath}
    >
      <div className="store-ops-page store-op-hub">
        <p className="store-op-hub__note">
          Posts through the Inventory Posting Engine · Ledger is source of truth · No duplicate stock tables.
        </p>

        {groups.map((g) => (
          <section key={g.name} className="store-section store-op-hub__section">
            <div className="store-section__head">
              <h2 className="store-section__title">{g.name}</h2>
              <span className="text-[12px] text-erp-muted">{g.items.length}</span>
            </div>
            <div className="store-op-choice-grid">
              {g.items.map((c) => {
                const Icon = c.icon
                const isPrimary = Boolean(c.primary || c.badge === 'Recommended')
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={cn('store-op-choice', isPrimary && 'store-op-choice--primary')}
                    onClick={() => navigate(c.href)}
                  >
                    <span className="store-op-choice__icon">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="store-op-choice__body">
                      <span className="store-op-choice__title-row">
                        <span className="store-op-choice__title">{c.title}</span>
                        {c.badge ? <span className="store-op-choice__badge">{c.badge}</span> : null}
                      </span>
                      <span className="store-op-choice__desc">{c.description}</span>
                    </span>
                    <ChevronRight className="store-op-choice__chevron" aria-hidden />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </OperationalPageShell>
  )
}

export function MaterialReceiptHubPage() {
  return (
    <StoreOpHub
      title="Material Receipt"
      description="Choose how stock enters the warehouse. Every path posts through the live inventory / GRN engines."
      favoritePath="/inventory/store/receive"
      choices={[
        {
          id: 'grn',
          title: 'New GRN',
          description: 'Receive against a purchase order — immutable goods receipt. QC then posts to store.',
          href: '/purchase/grn/new',
          icon: Truck,
          badge: 'Recommended',
          primary: true,
          group: 'Purchase Receipt',
        },
        {
          id: 'grn-list',
          title: 'Open GRN register',
          description: 'Review draft, posted, and pending goods receipts.',
          href: '/purchase/grn',
          icon: ClipboardList,
          group: 'Purchase Receipt',
        },
        {
          id: 'opening',
          title: 'Opening stock',
          description: 'Opening balance via inventory movement engine.',
          href: '/inventory/opening-stock',
          icon: PackageOpen,
          primary: true,
          group: 'Opening Stock',
        },
        {
          id: 'fg',
          title: 'Production receipt',
          description: 'Finished goods from work orders (store workbench FG queue).',
          href: '/manufacturing/store-workbench',
          icon: Factory,
          group: 'Other Receipts',
        },
        {
          id: 'transfer-in',
          title: 'Transfer in',
          description: 'Receive stock already in transit from another warehouse.',
          href: '/inventory/movements/transfers',
          icon: ArrowLeftRight,
          group: 'Other Receipts',
        },
        {
          id: 'inward',
          title: 'General inward / adjustment +',
          description: 'Quick inward movement or stock adjustment increase.',
          href: '/inventory/movements/receipts/new',
          icon: ArrowDownToLine,
          group: 'Other Receipts',
        },
        {
          id: 'return-rev',
          title: 'Production material return',
          description: 'Material returned from work orders back to store (inward).',
          href: '/inventory/movements/returns',
          icon: Package,
          group: 'Other Receipts',
        },
      ]}
    />
  )
}

export function MaterialIssueHubPage() {
  return (
    <StoreOpHub
      title="Material Issue"
      description="Select issue purpose. Each posts through inventory issue / manufacturing engines."
      favoritePath="/inventory/store/issue"
      choices={[
        {
          id: 'production',
          title: 'Production Issue',
          description: 'Issue to work orders from the production issue queue.',
          href: '/manufacturing/store-workbench',
          icon: Factory,
          badge: 'WO materials',
          primary: true,
          group: 'Issue types',
        },
        {
          id: 'sales',
          title: 'Sales Issue',
          description: 'Dispatch readiness and requirement stock.',
          href: '/dispatch/workbench',
          icon: Truck,
          group: 'Issue types',
        },
        {
          id: 'department',
          title: 'Department Issue',
          description: 'Spare / consumable issue linked to maintenance tickets or department consumption.',
          href: '/maintenance',
          icon: Wrench,
          group: 'Issue types',
        },
        {
          id: 'scrap',
          title: 'Scrap Issue',
          description: 'Rejection / scrap disposal — posts inventory ledger.',
          href: '/inventory/movements/issues/new',
          icon: ArrowUpFromLine,
          group: 'Issue types',
        },
        {
          id: 'adjustment',
          title: 'Adjustment Issue',
          description: 'Stock adjustment decrease when a count is not required.',
          href: '/inventory/movements/adjustments/new',
          icon: Settings2,
          group: 'Issue types',
        },
        {
          id: 'vendor-return',
          title: 'Vendor Return',
          description: 'Return rejected or excess stock to the supplier — purchase return document (outward).',
          href: '/purchase/returns',
          icon: Truck,
          group: 'Issue types',
        },
        {
          id: 'general',
          title: 'General / sample / internal',
          description: 'Free-form material issue document (posts inventory ledger).',
          href: '/inventory/movements/issues/new',
          icon: ArrowUpFromLine,
          group: 'Other',
        },
        {
          id: 'jobwork',
          title: 'Job work / subcontract',
          description: 'Subcon-out style issues via inventory issue + reference.',
          href: '/inventory/movements/issues/new',
          icon: Settings2,
          group: 'Other',
        },
        {
          id: 'quick',
          title: 'Quick issue (API post)',
          description: 'Immediate issue movement when simple qty issue is enough.',
          href: '/inventory/issue',
          icon: Package,
          group: 'Other',
        },
      ]}
    />
  )
}

export function StockTransferHubPage() {
  return (
    <StoreOpHub
      title="Stock Transfer"
      description="Warehouse, bin, and plant moves with in-transit tracking on the transfer document."
      favoritePath="/inventory/store/transfer"
      choices={[
        {
          id: 'new',
          title: 'New transfer',
          description: 'Warehouse → warehouse (optional bins). Track In Transit → Received.',
          href: '/inventory/movements/transfers/new',
          icon: ArrowLeftRight,
          badge: 'Engine path',
          primary: true,
          group: 'Transfers',
        },
        {
          id: 'open',
          title: 'Open transfers',
          description: 'In progress, in transit, and receive pending.',
          href: '/inventory/movements/transfers',
          icon: ClipboardList,
          group: 'Transfers',
        },
        {
          id: 'wip',
          title: 'WIP / production moves',
          description: 'Manufacturing WIP transfer queue.',
          href: '/manufacturing/store-workbench',
          icon: Factory,
          group: 'Transfers',
        },
      ]}
    />
  )
}

export function PutAwayHubPage() {
  return (
    <StoreOpHub
      title="Put Away"
      description="After GRN post — move stock from receiving to storage. Uses transfer / bin move engines (no second stock ledger)."
      favoritePath="/inventory/store/put-away"
      choices={[
        {
          id: 'grn-queue',
          title: 'Pending GRNs',
          description: 'Finish receiving / post inventory first, then bin move.',
          href: '/purchase/grn',
          icon: Truck,
          primary: true,
          group: 'Put-away',
        },
        {
          id: 'transfer',
          title: 'Move to storage bin',
          description: 'Create a bin-level transfer (Receiving → Storage).',
          href: '/inventory/movements/transfers/new',
          icon: ArrowLeftRight,
          badge: 'Suggested path',
          group: 'Put-away',
        },
      ]}
    />
  )
}

type PickRow = InventoryStockReservation & {
  item?: { code?: string; name?: string }
  warehouse?: { code?: string; name?: string }
}

const PICK_GROUPS: Array<{
  demandType: InventoryReservationDemandType
  label: string
  icon: LucideIcon
  workbenchHref: string
  workbenchLabel: string
}> = [
  { demandType: 'WO', label: 'Production picks', icon: Factory, workbenchHref: '/manufacturing/store-workbench', workbenchLabel: 'Production workbench' },
  { demandType: 'SO', label: 'Sales picks', icon: Truck, workbenchHref: '/dispatch/workbench', workbenchLabel: 'Dispatch workbench' },
  { demandType: 'DISPATCH', label: 'Dispatch picks', icon: Truck, workbenchHref: '/dispatch/workbench', workbenchLabel: 'Dispatch workbench' },
]

/** Live pick queue over active reservations — production, sales, dispatch. */
export function PickingHubPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<PickRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [token, setToken] = useState(0)

  const load = useCallback(async () => {
    void token
    setLoading(true)
    try {
      const res = await listInventoryReservations({ status: 'ACTIVE', limit: 200 })
      setRows((res.data ?? []) as PickRow[])
    } catch {
      notify.error('Could not load pick queue')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { void load() }, [load])

  const release = async (id: string) => {
    const ok = await appConfirm({
      title: 'Release reservation',
      description: 'Release remaining reserved quantity for this demand?',
      confirmLabel: 'Release',
    })
    if (!ok) return
    setBusyId(id)
    try {
      await cancelInventoryReservation(id)
      notify.success('Reservation released')
      setToken((n) => n + 1)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Could not release reservation')
    } finally {
      setBusyId(null)
    }
  }

  const issueHref = (row: PickRow) => {
    const params = new URLSearchParams({
      itemId: row.itemId,
      warehouseId: row.warehouseId,
      quantity: String(Number(row.remainingQty ?? row.quantity ?? 0)),
    })
    if (row.referenceNo) params.set('referenceNo', row.referenceNo)
    return `/inventory/movements/issues/new?${params.toString()}`
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Material Picking (Preview)"
      description="Live pick queue from active reservations — production, sales, and dispatch. Bin-directed picking arrives with bin-level stock."
      showDescription
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Material Picking' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/store/picking"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => setToken((n) => n + 1),
          }}
          secondaryActions={[
            { id: 'transfer', label: 'Transfer pick', icon: ArrowLeftRight, onClick: () => navigate('/inventory/movements/transfers') },
            { id: 'register', label: 'Full reservations register', icon: ClipboardList, onClick: () => navigate('/inventory/reservations') },
          ]}
        />
      )}
    >
      <p className="mb-3 text-[12px] text-erp-muted">
        Flow: <strong>Reservation</strong> (source demand) → <strong>Pick</strong> here → <strong>Issue</strong> to consume,
        or <strong>Release</strong> to free stock for other demands.
      </p>

      {loading ? <LoadingState variant="dashboard" /> : null}

      {!loading && rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nothing to pick"
          description="No active reservations right now. Production, sales, or dispatch demand will queue up here."
        />
      ) : null}

      {!loading && rows.length > 0 ? (
        <div className="store-ops-page max-w-none">
          {PICK_GROUPS.map((group) => {
            const groupRows = rows.filter((r) => r.demandType === group.demandType)
            if (groupRows.length === 0) return null
            const Icon = group.icon
            return (
              <section key={group.demandType} className="store-section">
                <div className="store-section__head">
                  <h2 className="store-section__title">{group.label}</h2>
                  <span className="text-[12px] text-erp-muted">{groupRows.length}</span>
                </div>
                <ul className="store-card-list">
                  {groupRows.map((r) => {
                    const remaining = Number(r.remainingQty ?? r.quantity ?? 0)
                    const itemLabel = r.item ? `${r.item.code} · ${r.item.name}` : r.itemId
                    const whLabel = r.warehouse?.name ?? r.warehouseId
                    return (
                      <li key={r.id}>
                        <div className="store-action-card">
                          <div className="store-action-card__top">
                            <span className="inv-hub-badge inv-hub-badge--info">{r.demandType}</span>
                            <span className="store-action-card__domain">ref {r.referenceNo ?? r.demandId}</span>
                          </div>
                          <div className="store-action-card__title">{itemLabel}</div>
                          <div className="store-action-card__detail">
                            {whLabel} · reserved {formatNumber(Number(r.quantity))} · to pick {formatNumber(remaining)}
                          </div>
                          <div className="store-action-card__detail text-[11px]">
                            Since {formatDate(r.createdAt)} · #{r.reservationNumber ?? r.id.slice(0, 8)}
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button size="sm" variant="secondary" onClick={() => navigate(`/inventory/stock/${r.itemId}`)}>
                              Item 360
                            </Button>
                            <Button size="sm" variant="secondary" onClick={() => navigate(group.workbenchHref)}>
                              <Icon className="h-4 w-4" aria-hidden /> {group.workbenchLabel}
                            </Button>
                            <Button size="sm" onClick={() => navigate(issueHref(r))}>
                              <ArrowUpFromLine className="h-4 w-4" aria-hidden /> Issue
                            </Button>
                            <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => void release(r.id)}>
                              Release
                            </Button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      ) : null}
    </OperationalPageShell>
  )
}

const STOCK_COUNT_STATUS_TONE: Record<string, 'neutral' | 'pending' | 'info' | 'warning' | 'success' | 'critical'> = {
  DRAFT: 'neutral',
  SNAPSHOTTED: 'pending',
  COUNTING: 'pending',
  SUBMITTED: 'info',
  APPROVED: 'warning',
  POSTED: 'success',
  REVERSED: 'critical',
}

function countNumber(row: ApiInventoryDocument): string {
  return row.countNumber ?? row.id.slice(0, 8)
}

function countVarianceSummary(row: ApiInventoryDocument): string {
  const lines = row.lines ?? []
  if (lines.length === 0) return '-'
  const withVariance = lines.filter((l) => l.countedQty != null && Number(l.varianceQty ?? 0) !== 0)
  if (withVariance.length === 0) return lines.some((l) => l.countedQty != null) ? 'No variance' : '-'
  return `${withVariance.length} of ${lines.length} lines`
}

export function StockCountHubPage() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<ApiInventoryDocument[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listInventoryStockCounts({ page: 1, limit: 20 })
      setRows(res.data ?? [])
      setTotal(res.meta?.total ?? (res.data ?? []).length)
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Could not load stock counts')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title="Stock Count"
      description="Cycle / physical counts → variance → approval → adjustment through the live count engine."
      showDescription
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: 'Stock Count' },
      ]}
      autoBreadcrumbs={false}
      favoritePath="/inventory/store/count"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'new',
            label: 'Start Count',
            icon: Plus,
            onClick: () => navigate('/inventory/stock-count/new'),
          }}
          secondaryActions={[
            {
              id: 'adjust',
              label: 'Adjustments',
              icon: Settings2,
              onClick: () => navigate('/inventory/movements/adjustments/new'),
            },
          ]}
        />
      )}
    >
      <div className="store-ops-page">
        <p className="store-op-hub__note">
          Snapshot system qty, enter the physical count (manual / barcode), then approve and post the variance.
          Prefer an adjustment instead when a full count is not required.
        </p>

        {loading ? <LoadingState variant="table" rows={6} /> : null}

        {!loading && rows.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title="No stock counts yet"
            description="Start a cycle or physical count to snapshot system quantities and enter a physical count."
            action={<Button size="sm" onClick={() => navigate('/inventory/stock-count/new')}>Start Count</Button>}
          />
        ) : null}

        {!loading && rows.length > 0 ? (
          <EnterpriseRegisterTableShell>
            <div className="overflow-x-auto">
              <table className="erp-table w-full min-w-[900px] text-[13px]">
                <thead>
                  <tr>
                    <th>Count #</th>
                    <th>Warehouse</th>
                    <th>Status</th>
                    <th>Count Date</th>
                    <th className="text-right">Lines</th>
                    <th>Variance</th>
                    <th aria-hidden />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="cursor-pointer hover:bg-slate-50"
                      onClick={() => navigate(`/inventory/stock-count/${row.id}`)}
                    >
                      <td className="font-mono">{countNumber(row)}</td>
                      <td>{row.warehouse ? `${row.warehouse.code} — ${row.warehouse.name}` : row.warehouseId ?? '-'}</td>
                      <td><DynamicsStatusChip label={row.status} tone={STOCK_COUNT_STATUS_TONE[row.status] ?? 'neutral'} /></td>
                      <td>{row.countDate ? formatDate(row.countDate) : '-'}</td>
                      <td className="text-right tabular-nums">{formatNumber(row.lines?.length ?? 0)}</td>
                      <td className="text-erp-muted">{countVarianceSummary(row)}</td>
                      <td><ChevronRight className="h-4 w-4 text-erp-muted" aria-hidden /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {total > rows.length ? (
              <div className="flex items-center justify-end px-3 py-2 text-[12px] text-erp-muted">
                Showing {rows.length} of {total} ·{' '}
                <button type="button" className="ml-1 text-erp-primary hover:underline" onClick={() => navigate('/inventory/stock-count')}>
                  View all counts
                </button>
              </div>
            ) : null}
          </EnterpriseRegisterTableShell>
        ) : null}
      </div>
    </OperationalPageShell>
  )
}

export function BarcodeHubPage() {
  return (
    <StoreOpHub
      title="Barcode / Scan"
      description="One scan → stock context → issue, receive, transfer, or count."
      favoritePath="/inventory/store/scan"
      choices={[
        {
          id: 'search',
          title: 'Search item / barcode',
          description: 'Global ops search (item, stock, recent receipts).',
          href: '/inventory/ops/search',
          icon: Package,
          primary: true,
          group: 'Scan actions',
        },
        {
          id: 'receive',
          title: 'Scan to receive',
          description: 'Scan-assisted goods receipt movement.',
          href: '/inventory/scan/receive',
          icon: ArrowDownToLine,
          group: 'Scan actions',
        },
        {
          id: 'issue',
          title: 'Scan to issue',
          description: 'Scan-assisted material issue.',
          href: '/inventory/scan/issue',
          icon: ArrowUpFromLine,
          group: 'Scan actions',
        },
        {
          id: 'transfer',
          title: 'Scan to transfer',
          description: 'Scan-assisted warehouse/bin transfer.',
          href: '/inventory/scan/transfer',
          icon: ArrowLeftRight,
          group: 'Scan actions',
        },
      ]}
    />
  )
}
