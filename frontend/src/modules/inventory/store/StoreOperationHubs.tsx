import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowDownToLine,
  ArrowLeftRight,
  ArrowUpFromLine,
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

export type StoreOpChoice = {
  id: string
  title: string
  description: string
  href: string
  icon: LucideIcon
  badge?: string
}

export function StoreOpHub({
  title,
  description,
  favoritePath,
  backTo = '/inventory',
  choices,
}: {
  title: string
  description: string
  favoritePath: string
  backTo?: string
  choices: StoreOpChoice[]
}) {
  const navigate = useNavigate()
  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Store"
      title={title}
      description={description}
      backLink={{ to: backTo, label: 'Store Dashboard' }}
      breadcrumbs={[
        { label: 'Store', to: '/inventory' },
        { label: title },
      ]}
      autoBreadcrumbs={false}
      favoritePath={favoritePath}
    >
      <p className="mb-3 text-[12px] text-erp-muted">
        Posts through the existing Inventory Posting Engine · Ledger is source of truth · No duplicate stock tables.
      </p>
      <div className="store-op-choice-grid">
        {choices.map((c) => {
          const Icon = c.icon
          return (
            <button
              key={c.id}
              type="button"
              className="store-op-choice"
              onClick={() => navigate(c.href)}
            >
              <span className="store-op-choice__icon">
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="store-op-choice__body">
                <span className="store-op-choice__title">{c.title}</span>
                <span className="store-op-choice__desc">{c.description}</span>
                {c.badge ? <span className="store-op-choice__badge">{c.badge}</span> : null}
              </span>
            </button>
          )
        })}
      </div>
    </OperationalPageShell>
  )
}

export function MaterialReceiptHubPage() {
  return (
    <StoreOpHub
      title="Material Receipt"
      description="Pick a receipt source. Every path posts through the live inventory / GRN engines."
      favoritePath="/inventory/store/receive"
      choices={[
        {
          id: 'grn',
          title: 'Purchase GRN',
          description: 'Receive against a purchase order — immutable goods receipt.',
          href: '/purchase/grn/new',
          icon: Truck,
          badge: 'Recommended',
        },
        {
          id: 'fg',
          title: 'Production receipt',
          description: 'Finished goods from work orders (store workbench FG queue).',
          href: '/manufacturing/store-workbench',
          icon: Factory,
        },
        {
          id: 'transfer-in',
          title: 'Transfer in',
          description: 'Receive stock already in transit from another warehouse.',
          href: '/inventory/movements/transfers',
          icon: ArrowLeftRight,
        },
        {
          id: 'opening',
          title: 'Opening stock',
          description: 'Opening balance via inventory movement engine.',
          href: '/inventory/opening-stock',
          icon: PackageOpen,
        },
        {
          id: 'inward',
          title: 'General inward / adjustment +',
          description: 'Quick inward movement or stock adjustment increase.',
          href: '/inventory/movements/receipts/new',
          icon: ArrowDownToLine,
        },
        {
          id: 'return-rev',
          title: 'Return / reverse path',
          description: 'Purchase return documents and inventory returns register.',
          href: '/inventory/movements/returns',
          icon: Package,
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
        },
        {
          id: 'maintenance',
          title: 'Maintenance',
          description: 'Spare issue linked to maintenance tickets.',
          href: '/maintenance',
          icon: Wrench,
        },
        {
          id: 'sales',
          title: 'Sales / dispatch',
          description: 'Dispatch readiness and requirement stock.',
          href: '/dispatch/workbench',
          icon: Truck,
        },
        {
          id: 'general',
          title: 'General / sample / scrap / internal',
          description: 'Free-form material issue document (posts inventory ledger).',
          href: '/inventory/movements/issues/new',
          icon: ArrowUpFromLine,
        },
        {
          id: 'jobwork',
          title: 'Job work / subcontract',
          description: 'Subcon-out style issues via inventory issue + reference.',
          href: '/inventory/movements/issues/new',
          icon: Settings2,
        },
        {
          id: 'quick',
          title: 'Quick issue (API post)',
          description: 'Immediate issue movement when simple qty issue is enough.',
          href: '/inventory/issue',
          icon: Package,
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
        },
        {
          id: 'open',
          title: 'Open transfers',
          description: 'In progress, in transit, and receive pending.',
          href: '/inventory/movements/transfers',
          icon: ClipboardList,
        },
        {
          id: 'wip',
          title: 'WIP / production moves',
          description: 'Manufacturing WIP transfer queue.',
          href: '/manufacturing/store-workbench',
          icon: Factory,
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
        },
        {
          id: 'transfer',
          title: 'Move to storage bin',
          description: 'Create a bin-level transfer (Receiving → Storage).',
          href: '/inventory/movements/transfers/new',
          icon: ArrowLeftRight,
          badge: 'Suggested path',
        },
        {
          id: 'scan',
          title: 'Scan to transfer',
          description: 'Barcode-assisted put-away move.',
          href: '/inventory/scan/transfer',
          icon: ScanLine,
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
        },
        {
          id: 'production',
          title: 'Production pick / issue',
          description: 'Production material queues.',
          href: '/manufacturing/store-workbench',
          icon: Factory,
        },
        {
          id: 'sales',
          title: 'Sales / dispatch pick',
          description: 'Dispatch workbench readiness.',
          href: '/dispatch/workbench',
          icon: Truck,
        },
        {
          id: 'transfer',
          title: 'Transfer pick',
          description: 'Dispatch outbound transfer lines.',
          href: '/inventory/movements/transfers',
          icon: ArrowLeftRight,
        },
        {
          id: 'issue',
          title: 'Issue after pick',
          description: 'Post material issue document.',
          href: '/inventory/movements/issues/new',
          icon: ArrowUpFromLine,
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
        },
        {
          id: 'open',
          title: 'Open counts',
          description: 'Resume counting, approve, post variance.',
          href: '/inventory/stock-count',
          icon: Package,
        },
        {
          id: 'adjust',
          title: 'Adjustments',
          description: 'Manual stock adjustment when count is not required.',
          href: '/inventory/movements/adjustments/new',
          icon: Settings2,
        },
        {
          id: 'scan',
          title: 'Scan assist',
          description: 'Barcode scan to identify item then count.',
          href: '/inventory/store/scan',
          icon: ScanLine,
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
        },
        {
          id: 'receive',
          title: 'Scan to receive',
          description: 'Scan-assisted goods receipt movement.',
          href: '/inventory/scan/receive',
          icon: ArrowDownToLine,
        },
        {
          id: 'issue',
          title: 'Scan to issue',
          description: 'Scan-assisted material issue.',
          href: '/inventory/scan/issue',
          icon: ArrowUpFromLine,
        },
        {
          id: 'transfer',
          title: 'Scan to transfer',
          description: 'Scan-assisted warehouse/bin transfer.',
          href: '/inventory/scan/transfer',
          icon: ArrowLeftRight,
        },
      ]}
    />
  )
}
