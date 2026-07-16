import { previewNextCode } from '../../services/codeSeriesService'
import { Building2, CheckCircle2, Circle } from 'lucide-react'
import type { Customer, CustomerType, SalesTerritory } from '../../types/master'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { gstStateCodeFromGstin, panFromGstin } from '../../utils/customerUtils'
import { ActiveBadge, TypeBadge } from '../ui/StatusBadge'
import { Select } from '../forms/Inputs'
import { cn } from '../../utils/cn'

const CUSTOMER_TYPES: { id: CustomerType; label: string }[] = [
  { id: 'corporate', label: 'Corporate' },
  { id: 'dealer', label: 'Dealer' },
  { id: 'government', label: 'Government' },
]

const TERRITORIES: { id: SalesTerritory; label: string; accent: string }[] = [
  { id: 'West', label: 'West', accent: 'border-erp-primary/30 bg-erp-primary-soft' },
  { id: 'North', label: 'North', accent: 'border-sky-300/40 bg-sky-50' },
  { id: 'South', label: 'South', accent: 'border-emerald-300/40 bg-emerald-50' },
  { id: 'East', label: 'East', accent: 'border-amber-300/40 bg-amber-50' },
]

const CREDIT_PRESETS = [15, 30, 45, 60, 90]

export function suggestCustomerCode(_customers: Customer[]): string {
  return previewNextCode('customer')
}

export function CustomerFormHero({ isEdit }: { isEdit: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-erp-primary/15 bg-gradient-to-br from-erp-primary/[0.06] via-erp-surface to-erp-surface-alt/40 p-5 shadow-[var(--erp-shadow-card)]">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-erp-primary/[0.05]" />
      <div className="relative flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-primary">
            {isEdit ? 'Update master record' : 'New master record'}
          </p>
          <p className="mt-1 text-[14px] font-semibold text-erp-text">
            {isEdit ? 'Edit company profile, billing, and contact details' : 'Register a company for quotations, orders, and dispatch'}
          </p>
          <p className="mt-1 max-w-xl text-[13px] text-erp-muted">
            Complete profile, address, and primary contact. GSTIN is required for tax invoicing and e-way bills.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/80 px-3 py-2 text-[12px] text-erp-muted">
          <Building2 className="h-4 w-4 text-erp-primary" />
          {COMPANY_TERMINOLOGY.masterTitle}
        </div>
      </div>
    </div>
  )
}

const CREDIT_LIMIT_PRESETS = [2_500_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000]

export function CreditLimitPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CREDIT_LIMIT_PRESETS.map((amount) => (
        <button
          key={amount}
          type="button"
          onClick={() => onChange(amount)}
          className={cn(
            'rounded-md border px-2.5 py-1 text-[12px] font-semibold tabular-nums transition-colors',
            value === amount ? 'border-erp-primary bg-erp-primary text-white' : 'border-erp-border text-erp-muted hover:bg-erp-surface-alt',
          )}
        >
          ₹{amount >= 10_000_000 ? `${amount / 10_000_000}Cr` : `${amount / 100_000}L`}
        </button>
      ))}
    </div>
  )
}

export function GstinFieldHelper({ gstin }: { gstin: string }) {
  if (!gstin || gstin.length < 2) return null
  const pan = panFromGstin(gstin)
  const stateCode = gstStateCodeFromGstin(gstin)
  return (
    <p className="mt-1 text-[11px] text-erp-muted">
      {gstin.length === 15 ? 'Format OK' : `${gstin.length}/15 characters`}
      {pan ? ` · PAN ${pan}` : ''}
      {stateCode ? ` · State code ${stateCode}` : ''}
    </p>
  )
}

export function CustomerFormStepStrip({
  profileDone,
  addressDone,
  shippingDone,
  contactDone,
}: {
  profileDone: boolean
  addressDone: boolean
  shippingDone: boolean
  contactDone: boolean
}) {
  const steps = [
    { id: 'profile', label: 'Profile & GST', done: profileDone },
    { id: 'billing', label: 'Billing', done: addressDone },
    { id: 'shipping', label: 'Shipping', done: shippingDone },
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
              <div
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  s.done ? 'bg-erp-primary' : 'bg-erp-surface-alt',
                )}
              />
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-erp-muted">
              {s.done ? <CheckCircle2 className="h-3 w-3 text-erp-primary" /> : <Circle className="h-3 w-3" />}
              {s.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function CustomerTypePicker({
  value,
  onChange,
}: {
  value: CustomerType
  onChange: (v: CustomerType) => void
}) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value as CustomerType)}
      className="erp-input w-full"
      aria-label="Customer Type"
    >
      {CUSTOMER_TYPES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </Select>
  )
}

export function TerritoryPicker({
  value,
  onChange,
}: {
  value: SalesTerritory
  onChange: (v: SalesTerritory) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {TERRITORIES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            'rounded-lg border px-4 py-2 text-[13px] font-semibold transition-all',
            value === t.id ? cn(t.accent, 'border-erp-primary text-erp-primary shadow-sm') : 'border-erp-border text-erp-muted hover:border-erp-border-strong',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function CreditDaysPicker({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  const options = CREDIT_PRESETS.includes(value) ? CREDIT_PRESETS : [...CREDIT_PRESETS, value].sort((a, b) => a - b)

  return (
    <Select
      value={String(value)}
      onChange={(e) => onChange(Number(e.target.value))}
      className="erp-input w-full"
      aria-label="Credit Days"
    >
      {options.map((d) => (
        <option key={d} value={d}>
          {d} days
        </option>
      ))}
    </Select>
  )
}

export function CustomerFormPreview({
  values,
  isEdit,
}: {
  values: {
    customerCode: string
    customerName: string
    customerType: CustomerType
    addressLine1?: string
    city: string
    state: string
    pincode?: string
    country?: string
    gstin: string
    pan?: string
    contactPerson: string
    contactPhone: string
    creditDays: number
    creditLimit: number
    shippingAddress?: string
    salesTerritory: SalesTerritory
    isActive: boolean
  }
  isEdit: boolean
}) {
  const hasName = Boolean(values.customerName.trim())

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-erp-border bg-gradient-to-br from-erp-surface-alt/50 to-erp-surface p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
            <Building2 className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-[14px] font-semibold text-erp-text">
                {hasName ? values.customerName : 'Company name'}
              </p>
              <ActiveBadge isActive={values.isActive} />
            </div>
            <p className="mt-0.5 font-mono text-[12px] text-erp-primary">{values.customerCode || 'CUST-XXXX'}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <TypeBadge value={values.customerType} color="blue" />
              <span className="rounded-md border border-erp-border bg-erp-surface px-2 py-0.5 text-[11px] font-semibold text-erp-muted">
                {values.salesTerritory}
              </span>
            </div>
          </div>
        </div>
      </div>

      <dl className="space-y-1.5 text-[12px]">
        <div className="flex justify-between gap-2 py-1">
          <dt className="text-erp-muted">GSTIN</dt>
          <dd className="font-mono font-medium text-erp-text">{values.gstin || '—'}</dd>
        </div>
        {values.pan ? (
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-erp-muted">PAN</dt>
            <dd className="font-mono font-medium text-erp-text">{values.pan}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2 py-1">
          <dt className="text-erp-muted">Location</dt>
          <dd className="text-right font-medium text-erp-text">
            {values.city
              ? `${values.city}${values.state ? `, ${values.state}` : ''}${values.country && values.country !== 'India' ? ` · ${values.country}` : ''}`
              : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2 py-1">
          <dt className="text-erp-muted">Credit limit</dt>
          <dd className="font-medium tabular-nums text-erp-text">
            {values.creditLimit > 0 ? `₹${values.creditLimit.toLocaleString('en-IN')}` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2 py-1">
          <dt className="text-erp-muted">Credit days</dt>
          <dd className="font-medium tabular-nums text-erp-text">{values.creditDays} days</dd>
        </div>
        {values.contactPerson ? (
          <div className="flex justify-between gap-2 py-1">
            <dt className="text-erp-muted">Contact</dt>
            <dd className="text-right font-medium text-erp-text">{values.contactPerson}</dd>
          </div>
        ) : null}
      </dl>

      <p className="rounded-lg bg-erp-surface-alt/60 px-3 py-2 text-[11px] leading-relaxed text-erp-muted">
        {isEdit
          ? 'Changes save to the company master and reflect across CRM, sales, and dispatch.'
          : `After save you will land on ${COMPANY_TERMINOLOGY.hub360} to add contacts and view order history.`}
      </p>
    </div>
  )
}

export function FormSectionHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: typeof Building2
  title: string
  subtitle: string
}) {
  return (
    <div className="flex items-start gap-3 border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-4 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft">
        <Icon className="h-4 w-4 text-erp-primary" />
      </div>
      <div>
        <h2 className="erp-section-title">{title}</h2>
        <p className="mt-0.5 text-[12px] text-erp-muted">{subtitle}</p>
      </div>
    </div>
  )
}
