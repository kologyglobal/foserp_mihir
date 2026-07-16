import { Package, ShoppingCart, Factory, Truck, CheckCircle2, Circle } from 'lucide-react'
import type { Location } from '../../types/master'
import { LOCATION_REGISTERED_TYPE_LABELS } from '../../types/master'
import { ActiveBadge } from '../ui/StatusBadge'
import { cn } from '../../utils/cn'
import { formatLocationAddress } from '../../utils/locationUtils'

export function suggestLocationCode(locations: Location[]): string {
  const nums = locations
    .map((l) => {
      const m = l.locationCode.match(/(\d+)/)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const next = nums.length ? Math.max(...nums) + 1 : locations.length + 1
  return `LOC-${String(next).padStart(2, '0')}`
}

const USAGE_FLAGS: {
  key: keyof Pick<Location, 'allowSales' | 'allowPurchase' | 'allowProduction'>
  label: string
  icon: typeof ShoppingCart
  desc: string
}[] = [
  { key: 'allowSales', label: 'Sales', icon: ShoppingCart, desc: 'Sales orders & dispatch' },
  { key: 'allowPurchase', label: 'Purchase', icon: Package, desc: 'PR, PO & GRN documents' },
  { key: 'allowProduction', label: 'Production', icon: Factory, desc: 'Material issue & WIP moves' },
]

export function DocumentUsagePicker({
  values,
  onChange,
}: {
  values: Pick<Location, 'allowSales' | 'allowPurchase' | 'allowProduction' | 'useAsInTransit'>
  onChange: (patch: Partial<Pick<Location, 'allowSales' | 'allowPurchase' | 'allowProduction' | 'useAsInTransit'>>) => void
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-lg border border-amber-200/60 bg-amber-50/50 p-3">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={values.useAsInTransit}
          onChange={(e) => onChange({ useAsInTransit: e.target.checked })}
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-erp-text">
            <Truck className="h-4 w-4 text-amber-600" />
            Use as In-Transit
          </span>
          <span className="mt-0.5 block text-xs text-erp-muted">Goods moving between locations — no warehouse posting</span>
        </span>
      </label>
      <div className="grid gap-2 sm:grid-cols-3">
        {USAGE_FLAGS.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ [key]: !values[key] })}
            className={cn(
              'rounded-lg border p-3 text-left transition-colors',
              values[key]
                ? 'border-erp-primary/30 bg-erp-primary-soft'
                : 'border-erp-border bg-erp-surface hover:bg-erp-surface-alt',
            )}
          >
            <span className="flex items-center gap-2 text-sm font-medium text-erp-text">
              <Icon className="h-4 w-4 text-erp-primary" />
              {label}
              {values[key] ? <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-600" /> : <Circle className="ml-auto h-4 w-4 text-erp-muted" />}
            </span>
            <span className="mt-1 block text-[11px] text-erp-muted">{desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function LocationFormPreview({
  isEdit,
  values,
  warehouseLabel,
}: {
  isEdit: boolean
  warehouseLabel?: string
  values: {
    locationCode: string
    locationName: string
    name2?: string
    city: string
    state: string
    country: string
    address: string
    address2?: string
    postCode: string
    contactName: string
    phone: string
    email: string
    pan?: string
    registeredType?: Location['registeredType']
    gstin?: string
    tin?: string
    allowSales: boolean
    allowPurchase: boolean
    allowProduction: boolean
    useAsInTransit: boolean
    isDefault: boolean
    isActive: boolean
  }
}) {
  const usage: string[] = []
  if (values.useAsInTransit) usage.push('In-Transit')
  if (values.allowSales) usage.push('Sales')
  if (values.allowPurchase) usage.push('Purchase')
  if (values.allowProduction) usage.push('Production')

  return (
    <aside className="rounded-xl border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-primary">Live preview</p>
          <p className="mt-1 text-sm font-semibold text-erp-text">{values.locationName || 'New location'}</p>
          <p className="font-mono text-xs text-erp-muted">{values.locationCode || 'CODE'}</p>
        </div>
        <ActiveBadge isActive={values.isActive} />
      </div>

      <dl className="space-y-2 text-[12px]">
        <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
          <dt className="text-erp-muted">Warehouse</dt>
          <dd className="text-right font-medium text-erp-text">{values.useAsInTransit ? 'In-Transit' : warehouseLabel || '—'}</dd>
        </div>
        <div className="erp-factbox-row flex flex-col gap-1 border-0 py-1">
          <dt className="text-erp-muted">Address</dt>
          <dd className="text-[11px] font-medium leading-snug text-erp-text">
            {formatLocationAddress(values) || '—'}
          </dd>
        </div>
        <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
          <dt className="text-erp-muted">Usage</dt>
          <dd className="text-right font-medium text-erp-text">{usage.join(' · ') || '—'}</dd>
        </div>
        {values.contactName ? (
          <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
            <dt className="text-erp-muted">Contact</dt>
            <dd className="font-medium text-erp-text">{values.contactName}</dd>
          </div>
        ) : null}
        {values.phone ? (
          <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
            <dt className="text-erp-muted">Phone</dt>
            <dd className="font-medium tabular-nums text-erp-text">{values.phone}</dd>
          </div>
        ) : null}
        {values.gstin ? (
          <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
            <dt className="text-erp-muted">GSTIN</dt>
            <dd className="font-mono text-[11px] font-medium text-erp-text">{values.gstin}</dd>
          </div>
        ) : null}
        {values.registeredType ? (
          <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
            <dt className="text-erp-muted">Registered</dt>
            <dd className="font-medium text-erp-text">{LOCATION_REGISTERED_TYPE_LABELS[values.registeredType]}</dd>
          </div>
        ) : null}
        {values.pan ? (
          <div className="erp-factbox-row flex justify-between gap-2 border-0 py-1">
            <dt className="text-erp-muted">PAN</dt>
            <dd className="font-mono font-medium text-erp-text">{values.pan}</dd>
          </div>
        ) : null}
      </dl>

      <p className="mt-3 rounded-lg bg-erp-surface-alt/60 px-3 py-2 text-[11px] leading-relaxed text-erp-muted">
        {isEdit
          ? 'Location appears on purchase, sales, production, and inventory entry forms as Location Code.'
          : 'After save this location is available as a dropdown on all business entry documents.'}
      </p>
    </aside>
  )
}
