import { Link } from 'react-router-dom'
import {
  Building2,
  Package,
  Warehouse,
  Ruler,
  FolderTree,
  ShieldCheck,
  SlidersHorizontal,
  ClipboardCheck,
  CreditCard,
  Truck,
  Ship,
  UserCog,
  FlaskConical,
  Scale,
  RotateCcw,
  Settings2,
  MapPin,
} from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import {
  PURCHASE_LINKED_MASTERS,
  PURCHASE_MASTERS_CATALOG,
} from '../../../config/purchaseMastersCatalog'
import { usePurchaseMasterStore } from '../../../store/purchaseMasterStore'
import { useMasterStore } from '../../../store/masterStore'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import { purchaseBreadcrumbs } from '../../../utils/purchaseNavigation'
import { cn } from '../../../utils/cn'
import type { PurchaseLinkedMasterSource } from '../../../types/purchaseMasters'

const GROUP_LABELS: Record<string, string> = {
  vendor: 'Vendor Setup',
  item: 'Item & Warehouse',
  terms: 'Commercial Terms',
  receiving: 'Receiving & QC',
  governance: 'Governance',
}

const GROUP_ORDER = ['vendor', 'item', 'terms', 'receiving', 'governance']

const SOURCE_LABELS: Record<PurchaseLinkedMasterSource, string> = {
  global: 'Global Master',
  crm: 'CRM Master',
  quality: 'Quality',
  governance: 'Governance',
}

const ICONS: Record<string, typeof Building2> = {
  vendors: Building2,
  items: Package,
  'item-categories': FolderTree,
  warehouses: Warehouse,
  uom: Ruler,
  'approval-matrix': ShieldCheck,
  locations: MapPin,
  'qc-parameters': SlidersHorizontal,
  'inspection-plans': ClipboardCheck,
  'payment-terms': CreditCard,
  'delivery-terms': Truck,
  'freight-terms': Ship,
  buyers: UserCog,
  'qc-rules': FlaskConical,
  'grn-tolerance': Scale,
  'return-reasons': RotateCcw,
}

function MasterCard({
  title,
  description,
  to,
  count,
  sourceLabel,
  icon: Icon,
}: {
  title: string
  description: string
  to: string
  count?: number
  sourceLabel?: string
  icon: typeof Building2
}) {
  return (
    <Link
      to={to}
      className="group block rounded-lg border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)] transition hover:border-erp-primary/30 hover:shadow-md"
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-erp-primary-soft text-erp-primary">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-erp-text group-hover:text-erp-primary">{title}</h3>
            {typeof count === 'number' ? (
              <span className="shrink-0 rounded-full bg-erp-surface-alt px-2 py-0.5 text-[11px] font-semibold text-erp-muted">
                {count}
              </span>
            ) : null}
          </div>
          {sourceLabel ? (
            <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-erp-primary/80">{sourceLabel}</p>
          ) : null}
          <p className="mt-1 text-[12px] leading-relaxed text-erp-muted">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export function PurchaseMastersHubPage() {
  const entries = usePurchaseMasterStore((s) => s.entries)
  const crmEntries = useCrmMasterStore((s) => s.entries)
  const vendors = useMasterStore((s) => s.vendors)
  const items = useMasterStore((s) => s.items)
  const warehouses = useMasterStore((s) => s.warehouses)
  const locations = useMasterStore((s) => s.locations)
  const uoms = useMasterStore((s) => s.uoms)
  const categories = useMasterStore((s) => s.categories)

  const linkedCounts: Record<string, number> = {
    vendors: vendors.length,
    items: items.length,
    warehouses: warehouses.length,
    locations: locations.length,
    uom: uoms.length,
    'item-categories': categories.length,
    'payment-terms': crmEntries.filter((e) => e.kind === 'payment-terms' && e.status === 'active').length,
    'delivery-terms': crmEntries.filter((e) => e.kind === 'delivery-terms' && e.status === 'active').length,
  }

  const grouped = GROUP_ORDER.map((group) => ({
    group,
    label: GROUP_LABELS[group],
    items: [
      ...PURCHASE_LINKED_MASTERS.filter((m) => m.group === group).map((m) => ({
        slug: m.slug,
        title: m.title,
        description: m.description,
        to: m.listRoute,
        count: linkedCounts[m.slug],
        sourceLabel: SOURCE_LABELS[m.sourceModule],
      })),
      ...PURCHASE_MASTERS_CATALOG.filter((m) => m.group === group).map((m) => ({
        slug: m.slug,
        title: m.title,
        description: m.description,
        to: `/purchase/masters/${m.slug}`,
        count: entries.filter((e) => e.kind === m.kind).length,
        sourceLabel: 'Purchase Master',
      })),
    ],
  }))

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Purchase"
      title="Purchase Masters"
      description="Procurement setup — linked global and CRM registers plus purchase-specific rules for receiving and returns."
      breadcrumbs={purchaseBreadcrumbs('Masters')}
      favoritePath="/purchase/masters"
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{
            id: 'payment-terms',
            label: 'Payment Terms',
            icon: CreditCard,
            onClick: () => { window.location.href = '/masters/payment-terms' },
          }}
          secondaryActions={[
            { id: 'vendors', label: 'Vendor Master', onClick: () => { window.location.href = '/masters/vendors' } },
            { id: 'qc-rules', label: 'QC Rules', onClick: () => { window.location.href = '/purchase/masters/qc-rules' } },
          ]}
        />
      )}
    >
      <div className="space-y-8">
        {grouped.map(({ group, label, items: groupItems }) =>
          groupItems.length > 0 ? (
            <section key={group}>
              <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-erp-muted">{label}</h2>
              <div className={cn('grid gap-3 sm:grid-cols-2 xl:grid-cols-3')}>
                {groupItems.map((item) => (
                  <MasterCard
                    key={item.slug}
                    title={item.title}
                    description={item.description}
                    to={item.to}
                    count={item.count}
                    sourceLabel={item.sourceLabel}
                    icon={ICONS[item.slug] ?? Settings2}
                  />
                ))}
              </div>
            </section>
          ) : null,
        )}
        <section className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-5">
          <h2 className="text-[14px] font-semibold text-erp-text">Setup Guide</h2>
          <p className="mt-2 text-[13px] text-erp-muted">
            Configure vendors and items in global masters first. Payment and delivery terms are shared with CRM — maintain them once under CRM Masters.
            Purchase-specific freight terms, QC rules, GRN tolerance, and return reasons are managed here.
          </p>
        </section>
      </div>
    </OperationalPageShell>
  )
}
