import { Factory, ShoppingBag, Wrench, Truck, Star, CheckCircle2, Circle } from 'lucide-react'
import type { Vendor, VendorType } from '../../types/master'
import { ActiveBadge, TypeBadge } from '../ui/StatusBadge'
import { FormSectionHeader } from './CustomerFormSections'
import { cn } from '../../utils/cn'

const VENDOR_TYPES: { id: VendorType; label: string; icon: typeof Factory; desc: string }[] = [
  { id: 'manufacturer', label: 'Manufacturer', icon: Factory, desc: 'OEM parts — axle, suspension, tanks' },
  { id: 'trader', label: 'Trader', icon: ShoppingBag, desc: 'Distributors and trading houses' },
  { id: 'service', label: 'Service', icon: Wrench, desc: 'Subcontracting, calibration, logistics' },
]

const PAYMENT_PRESETS = [15, 21, 30, 45, 60]
const LEAD_TIME_PRESETS = [3, 7, 14, 21, 30]

export { PAYMENT_PRESETS, LEAD_TIME_PRESETS }

export function suggestVendorCode(vendors: Vendor[]): string {
  const nums = vendors
    .map((v) => {
      const m = v.vendorCode.match(/(\d+)/)
      return m ? Number(m[1]) : 0
    })
    .filter((n) => n > 0)
  const next = nums.length ? Math.max(...nums) + 1 : vendors.length + 1
  return `VEND-${String(next).padStart(4, '0')}`
}

export function VendorFormHero({ isEdit }: { isEdit: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-orange-200/60 bg-gradient-to-br from-orange-50/80 via-erp-surface to-erp-surface-alt/40 p-5 shadow-[var(--erp-shadow-card)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-orange-100/40" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-orange-700">
            {isEdit ? 'Update master record' : 'New master record'}
          </p>
          <p className="mt-1 text-[14px] font-semibold text-erp-text">
            {isEdit ? 'Edit vendor profile, supply terms, and contact' : 'Register a supplier for purchase orders and subcontracting'}
          </p>
          <p className="mt-1 max-w-xl text-[13px] text-erp-muted">
            Capture vendor type, lead times, and supplied categories. Used in procurement, GRN, and item-vendor mapping.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/80 px-3 py-2 text-[12px] text-erp-muted">
          <Truck className="h-4 w-4 text-orange-600" />
          Vendor Master
        </div>
      </div>
    </div>
  )
}

export function VendorFormStepStrip({
  profileDone,
  termsDone,
  contactDone,
}: {
  profileDone: boolean
  termsDone: boolean
  contactDone: boolean
}) {
  const steps = [
    { id: 'profile', label: 'Profile', done: profileDone },
    { id: 'terms', label: 'Terms', done: termsDone },
    { id: 'contact', label: 'Contact', done: contactDone },
  ]
  const completed = steps.filter((s) => s.done).length

  return (
    <div className="rounded-xl border border-erp-border bg-erp-surface px-4 py-3 shadow-[var(--erp-shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Form progress</p>
        <p className="text-[12px] font-semibold tabular-nums text-erp-text">{completed}/{steps.length} sections</p>
      </div>
      <div className="flex gap-2">
        {steps.map((s) => (
          <div key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full items-center gap-1">
              <div className={cn('h-1.5 flex-1 rounded-full transition-colors', s.done ? 'bg-orange-500' : 'bg-erp-surface-alt')} />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-erp-muted">
              {s.done ? <CheckCircle2 className="h-3 w-3 text-orange-600" /> : <Circle className="h-3 w-3" />}
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function VendorTypePicker({
  value,
  onChange,
}: {
  value: VendorType
  onChange: (v: VendorType) => void
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      {VENDOR_TYPES.map((t) => {
        const Icon = t.icon
        const selected = value === t.id
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'flex flex-col items-start rounded-lg border p-3 text-left transition-all',
              selected
                ? 'border-orange-400 bg-orange-50 ring-1 ring-orange-300/30'
                : 'border-erp-border bg-erp-surface hover:border-orange-200 hover:bg-erp-surface-alt/50',
            )}
          >
            <Icon className={cn('h-4 w-4', selected ? 'text-orange-600' : 'text-erp-muted')} />
            <p className="mt-2 text-[13px] font-semibold text-erp-text">{t.label}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-erp-muted">{t.desc}</p>
          </button>
        )
      })}
    </div>
  )
}

export function VendorRatingPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            'rounded-md p-1 transition-colors',
            n <= value ? 'text-amber-500' : 'text-erp-border hover:text-amber-300',
          )}
          title={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star className={cn('h-6 w-6', n <= value && 'fill-current')} />
        </button>
      ))}
      <span className="ml-2 text-[13px] font-semibold tabular-nums text-erp-muted">{value}/5</span>
    </div>
  )
}

export function DaysPresetPicker({
  value,
  onChange,
  presets,
  suffix = 'd',
}: {
  value: number
  onChange: (v: number) => void
  presets: number[]
  suffix?: string
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {presets.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onChange(d)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[12px] font-semibold tabular-nums transition-colors',
            value === d ? 'border-orange-500 bg-orange-500 text-white' : 'border-erp-border text-erp-muted hover:bg-erp-surface-alt',
          )}
        >
          {d}{suffix}
        </button>
      ))}
    </div>
  )
}

export function CategoryChipPicker({
  options,
  selected,
  onChange,
}: {
  options: { code: string; name: string }[]
  selected: string[]
  onChange: (codes: string[]) => void
}) {
  function toggle(code: string) {
    onChange(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code])
  }

  if (options.length === 0) {
    return <p className="text-[12px] text-erp-muted">No categories available — enter codes manually below.</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.slice(0, 12).map((c) => {
        const on = selected.includes(c.code)
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => toggle(c.code)}
            className={cn(
              'rounded-md border px-2 py-1 text-[11px] font-semibold transition-colors',
              on ? 'border-orange-400 bg-orange-50 text-orange-800' : 'border-erp-border text-erp-muted hover:border-orange-200',
            )}
            title={c.name}
          >
            {c.code}
          </button>
        )
      })}
    </div>
  )
}

export function VendorFormPreview({
  values,
  isEdit,
}: {
  values: {
    vendorCode: string
    vendorName: string
    vendorType: VendorType
    city: string
    state: string
    gstin: string
    contactPerson: string
    contactPhone: string
    paymentTermsDays: number
    defaultLeadTimeDays: number
    suppliedCategories: string
    rating: number
    isActive: boolean
  }
  isEdit: boolean
}) {
  const cats = values.suppliedCategories.split(',').map((s) => s.trim()).filter(Boolean)
  const stars = '★'.repeat(values.rating) + '☆'.repeat(5 - values.rating)

  return (
    <aside className="erp-factbox overflow-hidden">
      <div className="erp-factbox-header">
        <span className="text-[13px] font-semibold text-erp-text">Live preview</span>
      </div>
      <div className="erp-factbox-body space-y-3 p-4">
        <div className="rounded-lg border border-erp-border bg-gradient-to-br from-orange-50/40 to-erp-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            {values.vendorName.trim() ? (
              <p className="text-[15px] font-bold text-erp-text">{values.vendorName}</p>
            ) : (
              <p className="text-[15px] font-medium italic text-erp-muted">Vendor name</p>
            )}
            <ActiveBadge isActive={values.isActive} />
          </div>
          <p className="mt-1 font-mono text-[12px] text-orange-700">{values.vendorCode || 'VEND-XXXX'}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeBadge value={values.vendorType} color="orange" />
            <span className="text-[12px] text-amber-600" aria-label={`Rating ${values.rating} of 5`}>{stars}</span>
          </div>
        </div>

        <dl className="space-y-2 text-[12px]">
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-erp-muted">GSTIN</dt>
            <dd className="font-mono font-medium text-erp-text">{values.gstin || '—'}</dd>
          </div>
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-erp-muted">Location</dt>
            <dd className="text-right font-medium text-erp-text">
              {values.city ? `${values.city}${values.state ? `, ${values.state}` : ''}` : '—'}
            </dd>
          </div>
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-erp-muted">Lead time</dt>
            <dd className="font-medium tabular-nums text-erp-text">{values.defaultLeadTimeDays} days</dd>
          </div>
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-erp-muted">Payment</dt>
            <dd className="font-medium tabular-nums text-erp-text">{values.paymentTermsDays} days</dd>
          </div>
          {cats.length > 0 ? (
            <div className="py-1">
              <dt className="text-erp-muted">Categories</dt>
              <dd className="mt-1 flex flex-wrap gap-1">
                {cats.map((c) => (
                  <span key={c} className="rounded bg-erp-surface-alt px-1.5 py-0.5 font-mono text-[10px]">{c}</span>
                ))}
              </dd>
            </div>
          ) : null}
        </dl>

        <p className="rounded-lg bg-erp-surface-alt/60 px-3 py-2 text-[11px] leading-relaxed text-erp-muted">
          {isEdit
            ? 'Changes update procurement defaults and item-vendor mappings.'
            : 'After save you can map items to this vendor from Item Master or PO screens.'}
        </p>
      </div>
    </aside>
  )
}

export { FormSectionHeader }
