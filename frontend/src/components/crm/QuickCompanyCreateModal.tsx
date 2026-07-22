import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { Building2, ChevronDown, X } from 'lucide-react'
import { FormField } from '../forms/FormField'
import { Input, Select, Checkbox, MobileInput } from '../forms/Inputs'
import { StateSelect, CitySelect, CountrySelect, MasterEnumSelect } from '../masters/GeographySelects'
import { ErpButton, ErpButtonGroup } from '../erp/ErpButton'
import { COMPANY_TERMINOLOGY } from '../../utils/companyLabels'
import { saveQuickCreateEntity } from '../../utils/quickCreateService'
import { isApiMode } from '../../config/apiConfig'
import { useMasterStore } from '../../store/masterStore'
import { resolveStoreAction } from '../../store/storeAction'
import { notify } from '../../store/toastStore'
import { panFromGstin } from '../../utils/customerUtils'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../config/countries'
import { useInlineFormValidation } from '../../hooks/useInlineFormValidation'
import { normalizeEmail, validateEmail } from '../../utils/validation/email'
import { validateMobileForCountry } from '../../utils/validation/mobilePhone'
import { useIndustryOptions, useTerritoryOptions } from '../../hooks/useCrmMasters'
import type { QuickCreateResult } from '../../types/quickCreate'
import type { Customer, CustomerType, SalesTerritory } from '../../types/master'
import { cn } from '../../utils/cn'

/** Company names: text only — letters, spaces, and common name punctuation (no digits). */
function sanitizeCompanyName(raw: string): string {
  return raw.replace(/[^A-Za-z\s&.,'()\-]/g, '')
}

/** Contact person names: letters and spaces only (no digits / symbols). */
function sanitizeAlphabeticName(raw: string): string {
  return raw.replace(/[^A-Za-z\s]/g, '')
}

export interface QuickCompanyCreateModalProps {
  open: boolean
  defaultName?: string
  onClose: () => void
  onCreated: (result: QuickCreateResult) => void
}

type CompanyForm = {
  customerName: string
  contactPerson: string
  mobile: string
  email: string
  industry: string
  customerType: string
  salesTerritory: string
  gstin: string
  pan: string
  creditDays: number
  creditLimit: number
  addressLine1: string
  addressLine2: string
  country: string
  state: string
  city: string
  pincode: string
  shippingSameAsBilling: boolean
  shippingAddress: string
  shippingAddressLine2: string
  shippingCountry: string
  shippingState: string
  shippingCity: string
  shippingPincode: string
  isActive: boolean
}

function emptyForm(defaultName = ''): CompanyForm {
  return {
    customerName: defaultName,
    contactPerson: '',
    mobile: '',
    email: '',
    industry: '',
    customerType: 'corporate',
    salesTerritory: '',
    gstin: '',
    pan: '',
    creditDays: 30,
    creditLimit: 0,
    addressLine1: '',
    addressLine2: '',
    country: DEFAULT_CUSTOMER_COUNTRY,
    state: '',
    city: '',
    pincode: '',
    shippingSameAsBilling: true,
    shippingAddress: '',
    shippingAddressLine2: '',
    shippingCountry: DEFAULT_CUSTOMER_COUNTRY,
    shippingState: '',
    shippingCity: '',
    shippingPincode: '',
    isActive: true,
  }
}

function buildCustomerPayload(form: CompanyForm, name: string): Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'updatedBy' | 'isCustomer' | 'firstInvoicedAt'> & Partial<Pick<Customer, 'isCustomer' | 'firstInvoicedAt'>> {
  const gstin = form.gstin.trim().toUpperCase()
  const shippingSame = form.shippingSameAsBilling
  return {
    customerCode: '',
    customerName: name,
    customerType: (form.customerType || 'corporate') as CustomerType,
    industry: form.industry.trim() || undefined,
    addressLine1: form.addressLine1.trim() || '—',
    addressLine2: form.addressLine2.trim() || undefined,
    city: form.city.trim() || '—',
    state: form.state.trim() || 'Maharashtra',
    pincode: form.pincode.trim() || '000000',
    country: form.country.trim() || DEFAULT_CUSTOMER_COUNTRY,
    shippingAddress: shippingSame ? undefined : (form.shippingAddress.trim() || undefined),
    shippingAddressLine2: shippingSame ? undefined : (form.shippingAddressLine2.trim() || undefined),
    shippingCity: shippingSame ? undefined : (form.shippingCity.trim() || undefined),
    shippingState: shippingSame ? undefined : (form.shippingState.trim() || undefined),
    shippingPincode: shippingSame ? undefined : (form.shippingPincode.trim() || undefined),
    shippingCountry: shippingSame ? undefined : (form.shippingCountry.trim() || DEFAULT_CUSTOMER_COUNTRY),
    // Keep GSTIN empty when not provided — a shared placeholder trips the
    // duplicate-GST check on every quick create after the first one.
    gstin,
    pan: form.pan.trim().toUpperCase() || panFromGstin(gstin) || undefined,
    contactPerson: form.contactPerson.trim(),
    contactPhone: form.mobile.trim(),
    contactEmail: form.email.trim() ? normalizeEmail(form.email) : '',
    creditDays: Number(form.creditDays) || 30,
    creditLimit: Number(form.creditLimit) || 0,
    salesTerritory: (form.salesTerritory || 'West') as SalesTerritory,
    isActive: form.isActive,
  }
}

export function QuickCompanyCreateModal({
  open,
  defaultName = '',
  onClose,
  onCreated,
}: QuickCompanyCreateModalProps) {
  const industryOptions = useIndustryOptions()
  const territoryOptions = useTerritoryOptions()
  const [form, setForm] = useState<CompanyForm>(() => emptyForm(defaultName))
  const [showAdditional, setShowAdditional] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm((prev) => {
      if (prev.salesTerritory) return prev
      const firstTerritory = territoryOptions[0]?.value
      return firstTerritory ? { ...prev, salesTerritory: firstTerritory } : prev
    })
  }, [open, territoryOptions])

  // Quick company creation requires only Company Name. Mobile and Email are
  // optional but must be valid when entered (shared validators skip empty values),
  // so collapsed account details still never block creation.
  const inline = useInlineFormValidation(
    {
      customerName: form.customerName,
      mobile: form.mobile,
      email: form.email,
    },
    {
      customerName: {
        required: true,
        message: `${COMPANY_TERMINOLOGY.name} is required`,
      },
      mobile: {
        validate: (v) =>
          validateMobileForCountry(String(v ?? ''), form.country || DEFAULT_CUSTOMER_COUNTRY),
      },
      email: {
        validate: (v) => validateEmail(String(v ?? '')),
      },
    },
  )

  useEffect(() => {
    if (!open) return
    setForm(emptyForm(defaultName.trim()))
    setShowAdditional(false)
    setError(null)
    setSubmitting(false)
    inline.resetTouched()
    // Only reset when the modal opens / default name changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultName])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !submitting) onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, submitting, onClose])

  function setField<K extends keyof CompanyForm>(key: K, value: CompanyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  function handleGstinChange(raw: string) {
    const gst = raw.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 15)
    setForm((prev) => ({
      ...prev,
      gstin: gst,
      pan: panFromGstin(gst) || (gst.length < 12 ? '' : prev.pan),
    }))
    setError(null)
  }

  async function handleSubmit() {
    if (submitting) return
    inline.touchAll()

    // Company Name is the only required field; Mobile and Email block only
    // when they hold an invalid entered value.
    const name = form.customerName.trim()
    const submitFieldOrder = ['customerName', 'mobile', 'email'] as const
    const firstInvalid = submitFieldOrder.find((f) => inline.fieldErrors[f])
    if (firstInvalid) {
      const msg = inline.fieldErrors[firstInvalid] ?? `${COMPANY_TERMINOLOGY.name} is required`
      setError(msg)
      notify.warning(msg)
      // Defer focus until touched errors paint
      window.requestAnimationFrame(() => {
        const root = document.getElementById('quick-company-modal-title')?.closest('.erp-modal-panel')
        const invalid = root?.querySelector<HTMLElement>(
          '[aria-invalid="true"], .erp-field-row--error input, input.erp-input--error, textarea.erp-input--error',
        )
        invalid?.focus({ preventScroll: true })
        invalid?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      })
      return
    }

    setSubmitting(true)
    setError(null)

    const customerData = buildCustomerPayload(form, name)
    const demoPayload = {
      ...customerData,
      mobile: form.mobile.trim(),
      email: form.email.trim() ? normalizeEmail(form.email) : '',
      billingAddress: form.addressLine1.trim(),
    }

    try {
      if (isApiMode()) {
        const customerCode = `CUST-${Date.now().toString(36).toUpperCase()}`
        const created = useMasterStore.getState().addCustomer({
          ...customerData,
          customerCode,
        })

        if (typeof created === 'string') {
          const record = useMasterStore.getState().getCustomer(created)
          notify.success(`${COMPANY_TERMINOLOGY.singular} created — linked to lead`)
          onCreated({ entityType: 'customer', id: created, label: name, record })
          onClose()
          return
        }

        const result = await resolveStoreAction(
          Promise.resolve(created).then((res) =>
            typeof res === 'string' ? { ok: true as const, customerId: res } : res,
          ),
        )
        if (!result.ok || !result.customerId) {
          const msg = result.error ?? `Could not create ${COMPANY_TERMINOLOGY.singular.toLowerCase()}`
          setError(msg)
          notify.failed(msg)
          return
        }
        const record = useMasterStore.getState().getCustomer(result.customerId)
        notify.success(`${COMPANY_TERMINOLOGY.singular} “${name}” created — linked to lead`)
        onCreated({ entityType: 'customer', id: result.customerId, label: name, record })
        onClose()
        return
      }

      const saved = saveQuickCreateEntity('customer', demoPayload)
      if (!saved.ok) {
        setError(saved.error)
        notify.failed(saved.error)
        return
      }
      notify.success(`${COMPANY_TERMINOLOGY.singular} “${name}” created — linked to lead`)
      onCreated(saved.result)
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Could not create ${COMPANY_TERMINOLOGY.singular.toLowerCase()}`
      setError(msg)
      notify.failed(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!open) return null

  // Portal outside the lead page <form> — nested forms break Create Company submit.
  return createPortal(
    <div
      className="erp-modal-backdrop crm-form-surface"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-company-modal-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose()
      }}
    >
      <div className="erp-modal-panel max-h-[90vh] max-w-4xl overflow-y-auto p-0">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-erp-border bg-white px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-erp-primary-soft text-erp-primary">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h2 id="quick-company-modal-title" className="text-[16px] font-semibold text-erp-text">
                {COMPANY_TERMINOLOGY.addQuick}
              </h2>
              <p className="mt-0.5 text-[12px] text-erp-muted">
                Quick account capture — open master details only when needed.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="rounded-md p-1.5 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="px-5 py-4">
          {error ? (
            <p
              role="alert"
              className="mb-3 rounded-md border border-erp-danger-solid/30 bg-red-50 px-3 py-2 text-[12px] font-medium text-erp-danger-fg"
            >
              {error}
            </p>
          ) : null}

          <section className="space-y-3">
            <h3 className="text-[13px] font-semibold text-erp-text">Quick entry</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                label={COMPANY_TERMINOLOGY.name}
                required
                className="sm:col-span-3"
                error={inline.fieldError('customerName')}
              >
                <Input
                  value={form.customerName}
                  onChange={(e) => setField('customerName', sanitizeCompanyName(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      void handleSubmit()
                    }
                  }}
                  placeholder="e.g. Acme Logistics Pvt Ltd"
                  error={Boolean(inline.fieldError('customerName'))}
                  aria-invalid={Boolean(inline.fieldError('customerName'))}
                  autoFocus
                />
              </FormField>
              <FormField label="Contact Person">
                <Input
                  value={form.contactPerson}
                  onChange={(e) => setField('contactPerson', sanitizeAlphabeticName(e.target.value))}
                  placeholder="Primary contact"
                  autoComplete="name"
                  inputMode="text"
                />
              </FormField>
              <FormField label="Mobile" error={inline.fieldError('mobile')}>
                <MobileInput
                  value={form.mobile}
                  onChange={(e) => setField('mobile', e.target.value)}
                  onBlur={() => inline.touch('mobile')}
                  placeholder="10-digit mobile"
                  error={Boolean(inline.fieldError('mobile'))}
                  aria-invalid={Boolean(inline.fieldError('mobile'))}
                />
              </FormField>
              <FormField label="Email" error={inline.fieldError('email')}>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField('email', e.target.value)}
                  onBlur={() => inline.touch('email')}
                  placeholder="name@company.com"
                  error={Boolean(inline.fieldError('email'))}
                  aria-invalid={Boolean(inline.fieldError('email'))}
                />
              </FormField>
            </div>
          </section>

          <div className="my-4">
            <button
              type="button"
              className="inline-flex w-full items-center justify-between gap-2 rounded-md border border-erp-border bg-erp-surface px-4 py-3 text-left text-[13px] font-semibold text-erp-primary hover:bg-erp-primary-soft/40"
              onClick={() => setShowAdditional((v) => !v)}
              aria-expanded={showAdditional}
            >
              <span>{showAdditional ? 'Hide account details' : 'Add account details'}</span>
              <ChevronDown className={cn('h-4 w-4 shrink-0 transition-transform', showAdditional && 'rotate-180')} />
            </button>
          </div>

          {showAdditional ? (
            <div className="mb-4 space-y-4">
              <section className="space-y-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
                <h3 className="text-[13px] font-semibold text-erp-text">{COMPANY_TERMINOLOGY.profile}</h3>
                <p className="text-[11px] text-erp-muted">Identity, territory, and company classification.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Industry">
                    <MasterEnumSelect
                      value={form.industry}
                      onChange={(v) => setField('industry', v)}
                      options={
                        industryOptions.length > 0
                          ? industryOptions.map((o) => o.label || o.value)
                          : []
                      }
                      placeholder="— Select industry —"
                    />
                  </FormField>
                  <FormField label="Company Type">
                    <Select native value={form.customerType} onChange={(e) => setField('customerType', e.target.value)}>
                      <option value="corporate">Corporate</option>
                      <option value="dealer">Dealer</option>
                      <option value="government">Government</option>
                    </Select>
                  </FormField>
                  <FormField label="Sales Territory">
                    <Select native value={form.salesTerritory} onChange={(e) => setField('salesTerritory', e.target.value)}>
                      <option value="">— Select territory —</option>
                      {territoryOptions.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </Select>
                  </FormField>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
                <h3 className="text-[13px] font-semibold text-erp-text">Tax &amp; commercial terms</h3>
                <p className="text-[11px] text-erp-muted">GST registration, PAN, credit days, and approved credit limit.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField
                    label="GSTIN"
                    hint="15-character GST identification number"
                  >
                    <Input
                      value={form.gstin}
                      onChange={(e) => handleGstinChange(e.target.value)}
                      maxLength={15}
                      className="font-mono uppercase"
                      placeholder="27AABCU9603R1ZM"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </FormField>
                  <FormField label="PAN" hint="Auto-derived from GSTIN — edit if needed">
                    <Input
                      value={form.pan}
                      onChange={(e) => setField('pan', e.target.value.toUpperCase())}
                      maxLength={10}
                      className="font-mono uppercase"
                      placeholder="AABCU9603R"
                    />
                  </FormField>
                  <FormField label="Credit Days" hint="Standard payment terms for receivables">
                    <Input
                      type="number"
                      min={0}
                      value={form.creditDays}
                      onChange={(e) => setField('creditDays', Number(e.target.value))}
                    />
                  </FormField>
                  <FormField label="Credit Limit (₹)" hint="Approved exposure limit for open orders and AR">
                    <Input
                      type="number"
                      min={0}
                      step={100000}
                      value={form.creditLimit}
                      onChange={(e) => setField('creditLimit', Number(e.target.value))}
                    />
                  </FormField>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
                <h3 className="text-[13px] font-semibold text-erp-text">Billing address</h3>
                <p className="text-[11px] text-erp-muted">Used on quotations, tax invoices, and e-way bills.</p>
                <div className="grid gap-3 sm:grid-cols-3">
                  <FormField label="Address Line 1" className="sm:col-span-3">
                    <Input
                      value={form.addressLine1}
                      onChange={(e) => setField('addressLine1', e.target.value)}
                      placeholder="Plot no., industrial area, road"
                    />
                  </FormField>
                  <FormField label="Address Line 2" className="sm:col-span-3">
                    <Input
                      value={form.addressLine2}
                      onChange={(e) => setField('addressLine2', e.target.value)}
                      placeholder="Building, floor, landmark (optional)"
                    />
                  </FormField>
                  <FormField label="Country">
                    <CountrySelect
                      value={form.country}
                      onChange={(v) => setField('country', v)}
                    />
                  </FormField>
                  <FormField label="State">
                    <StateSelect
                      value={form.state}
                      onChange={(v) => {
                        setField('state', v)
                        setField('city', '')
                      }}
                    />
                  </FormField>
                  <FormField label="City">
                    <CitySelect
                      stateName={form.state}
                      value={form.city}
                      onChange={(v) => setField('city', v)}
                    />
                  </FormField>
                  <FormField label="Pincode">
                    <Input
                      value={form.pincode}
                      onChange={(e) => setField('pincode', e.target.value)}
                      placeholder="411001"
                    />
                  </FormField>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
                <h3 className="text-[13px] font-semibold text-erp-text">Shipping address</h3>
                <p className="text-[11px] text-erp-muted">Dispatch and logistics address — defaults to billing if not specified.</p>
                <Checkbox
                  label="Same as billing address"
                  checked={form.shippingSameAsBilling}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setForm((prev) => ({
                      ...prev,
                      shippingSameAsBilling: checked,
                      ...(checked
                        ? {
                            shippingAddress: '',
                            shippingAddressLine2: '',
                            shippingCity: '',
                            shippingState: '',
                            shippingPincode: '',
                            shippingCountry: DEFAULT_CUSTOMER_COUNTRY,
                          }
                        : null),
                    }))
                    setError(null)
                  }}
                />
                {form.shippingSameAsBilling ? (
                  <p className="rounded-md bg-white/70 px-3 py-2 text-[12px] text-erp-muted">
                    Shipping documents will use the billing address.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <FormField label="Address Line 1" className="sm:col-span-3">
                      <Input
                        value={form.shippingAddress}
                        onChange={(e) => setField('shippingAddress', e.target.value)}
                        placeholder="Plant / warehouse address for dispatch"
                      />
                    </FormField>
                    <FormField label="Address Line 2" className="sm:col-span-3">
                      <Input
                        value={form.shippingAddressLine2}
                        onChange={(e) => setField('shippingAddressLine2', e.target.value)}
                        placeholder="Building, gate, landmark (optional)"
                      />
                    </FormField>
                    <FormField label="Country">
                      <CountrySelect
                        value={form.shippingCountry}
                        onChange={(v) => setField('shippingCountry', v)}
                      />
                    </FormField>
                    <FormField label="State">
                      <StateSelect
                        value={form.shippingState}
                        onChange={(v) => {
                          setField('shippingState', v)
                          setField('shippingCity', '')
                        }}
                      />
                    </FormField>
                    <FormField label="City">
                      <CitySelect
                        stateName={form.shippingState}
                        value={form.shippingCity}
                        onChange={(v) => setField('shippingCity', v)}
                      />
                    </FormField>
                    <FormField label="Pincode">
                      <Input
                        value={form.shippingPincode}
                        onChange={(e) => setField('shippingPincode', e.target.value)}
                        placeholder="411001"
                      />
                    </FormField>
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4">
                <h3 className="text-[13px] font-semibold text-erp-text">Status</h3>
                <Checkbox
                  label="Active company — available for new orders"
                  checked={form.isActive}
                  onChange={(e) => setField('isActive', e.target.checked)}
                />
              </section>
            </div>
          ) : null}

          <ErpButtonGroup className="sticky bottom-0 justify-end border-t border-erp-border bg-white py-4">
            <ErpButton type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </ErpButton>
            <ErpButton type="button" variant="primary" disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? 'Saving…' : `Create ${COMPANY_TERMINOLOGY.singular}`}
            </ErpButton>
          </ErpButtonGroup>
        </div>
      </div>
    </div>,
    document.body,
  )
}
