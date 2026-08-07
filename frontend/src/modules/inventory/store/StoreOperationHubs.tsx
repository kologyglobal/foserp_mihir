import { useMemo } from 'react'
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
  ScanLine,
  Settings2,
  Truck,
  Wrench,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
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
  backTo = '/inventory',
  backLabel = 'Back to Store',
  choices,
}: {
  title: string
  description: string
  favoritePath: string
  backTo?: string
  backLabel?: string
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
      backLink={{ to: backTo, label: backLabel }}
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
          title: 'Purchase GRN',
          description: 'Receive against a purchase order — immutable goods receipt.',
          href: '/purchase/grn/new',
          icon: Truck,
          badge: 'Recommended',
          primary: true,
          group: 'Inbound receipts',
        },
        {
          id: 'fg',
          title: 'Production receipt',
          description: 'Finished goods from work orders (store workbench FG queue).',
          href: '/manufacturing/store-workbench',
          icon: Factory,
          group: 'Inbound receipts',
        },
        {
          id: 'transfer-in',
          title: 'Transfer in',
          description: 'Receive stock already in transit from another warehouse.',
          href: '/inventory/movements/transfers',
          icon: ArrowLeftRight,
          group: 'Inbound receipts',
        },
        {
          id: 'scan',
          title: 'Scan to receive',
          description: 'Barcode-assisted goods receipt movement.',
          href: '/inventory/scan/receive',
          icon: ScanLine,
          group: 'Inbound receipts',
        },
        {
          id: 'opening',
          title: 'Opening stock',
          description: 'Opening balance via inventory movement engine.',
          href: '/inventory/opening-stock',
          icon: PackageOpen,
          group: 'Adjustments & other',
        },
        {
          id: 'inward',
          title: 'General inward / adjustment +',
          description: 'Quick inward movement or stock adjustment increase.',
          href: '/inventory/movements/receipts/new',
          icon: ArrowDownToLine,
          group: 'Adjustments & other',
        },
        {
          id: 'return-rev',
          title: 'Return / reverse path',
          description: 'Purchase return documents and inventory returns register.',
          href: '/inventory/movements/returns',
          icon: Package,
          group: 'Adjustments & other',
        },
        {
          id: 'grn-list',
          title: 'Open GRN register',
          description: 'Review draft, posted, and pending goods receipts.',
          href: '/purchase/grn',
          icon: ClipboardList,
          group: 'Adjustments & other',
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
          title: 'Production',
          description: 'Issue to work orders from the production issue queue.',
          href: '/manufacturing/store-workbench',
          icon: Factory,
          badge: 'WO materials',
          primary: true,
          group: 'Issue paths',
        },
        {
          id: 'maintenance',
          title: 'Maintenance',
          description: 'Spare issue linked to maintenance tickets.',
          href: '/maintenance',
          icon: Wrench,
          group: 'Issue paths',
        },
        {
          id: 'sales',
          title: 'Sales / dispatch',
          description: 'Dispatch readiness and requirement stock.',
          href: '/dispatch/workbench',
          icon: Truck,
          group: 'Issue paths',
        },
        {
          id: 'general',
          title: 'General / sample / scrap / internal',
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
        {
          id: 'scan',
          title: 'Scan to transfer',
          description: 'Barcode-assisted put-away move.',
          href: '/inventory/scan/transfer',
          icon: ScanLine,
          group: 'Put-away',
        },
      ]}
    />
  )
}

export function PickingHubPage() {
  return (
    <StoreOpHub
      title="Picking"
      description="Reservation-based picking for sales, production, transfer, and maintenance."
      favoritePath="/inventory/store/picking"
      choices={[
        {
          id: 'reservations',
          title: 'Active reservations',
          description: 'See reserved qty, source document, release if needed.',
          href: '/inventory/store/reservations',
          icon: ClipboardList,
          badge: 'Source',
          primary: true,
          group: 'Pick queues',
        },
        {
          id: 'production',
          title: 'Production pick / issue',
          description: 'Production material queues.',
          href: '/manufacturing/store-workbench',
          icon: Factory,
          group: 'Pick queues',
        },
        {
          id: 'sales',
          title: 'Sales / dispatch pick',
          description: 'Dispatch workbench readiness.',
          href: '/dispatch/workbench',
          icon: Truck,
          group: 'Pick queues',
        },
        {
          id: 'transfer',
          title: 'Transfer pick',
          description: 'Dispatch outbound transfer lines.',
          href: '/inventory/movements/transfers',
          icon: ArrowLeftRight,
          group: 'Pick queues',
        },
        {
          id: 'issue',
          title: 'Issue after pick',
          description: 'Post material issue document.',
          href: '/inventory/movements/issues/new',
          icon: ArrowUpFromLine,
          group: 'Pick queues',
        },
      ]}
    />
  )
}

export function StockCountHubPage() {
  return (
    <StoreOpHub
      title="Stock Count"
      description="Cycle / physical counts → variance → approval → adjustment through existing count engine."
      favoritePath="/inventory/store/count"
      choices={[
        {
          id: 'new',
          title: 'Start count',
          description: 'Snapshot system qty then enter physical count (manual / barcode).',
          href: '/inventory/stock-count/new',
          icon: ClipboardList,
          badge: 'Cycle / physical',
          primary: true,
          group: 'Count',
        },
        {
          id: 'open',
          title: 'Open counts',
          description: 'Resume counting, approve, post variance.',
          href: '/inventory/stock-count',
          icon: Package,
          group: 'Count',
        },
        {
          id: 'adjust',
          title: 'Adjustments',
          description: 'Manual stock adjustment when count is not required.',
          href: '/inventory/movements/adjustments/new',
          icon: Settings2,
          group: 'Count',
        },
        {
          id: 'scan',
          title: 'Scan assist',
          description: 'Barcode scan to identify item then count.',
          href: '/inventory/store/scan',
          icon: ScanLine,
          group: 'Count',
        },
      ]}
    />
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
