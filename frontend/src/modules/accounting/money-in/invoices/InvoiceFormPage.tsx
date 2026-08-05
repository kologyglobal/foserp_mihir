import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2, UserPlus } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpSegmentedControl } from '@/components/erp/ErpSegmentedControl'
import { ErpSmartSelect, type ErpSmartSelectOption } from '@/components/erp/ErpSmartSelect'
import { Checkbox, CurrencyInput, Input, Select, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { CustomerMasterSelect } from '@/components/masters/CustomerMasterSelect'
import { QuickCompanyCreateModal } from '@/components/crm/QuickCompanyCreateModal'
import { canQuickCreateEntity } from '@/utils/quickCreatePermissions'
import type { Customer } from '@/types/master'
import {
  createRecurringSchedule,
  createSalesInvoice,
  getSalesInvoice,
  updateSalesInvoice,
} from '@/services/bridges/receivablesApiBridge'
import type { RecurringInvoiceFrequency } from '@/services/api/receivablesApi'
import {
  ensureLegalEntity,
  resolveLegalEntityId,
  updateLegalEntity,
} from '@/services/bridges/financeApiBridge'
import type { LegalEntity } from '@/types/financeSetup'
import { listSalesOrderLookups, type AccountingSalesOrderLookup } from '@/services/api/accountingLookupsApi'
import { isApiMode } from '@/config/apiConfig'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { useMasterStore } from '@/store/masterStore'
import { useMrpStore } from '@/store/mrpStore'
import type { SalesOrder, SalesOrderStatus } from '@/types/mrp'
import type { SalesInvoiceSourceLinkInput, SalesInvoiceSourceType } from '@/types/moneyIn'
import { notify } from '@/store/toastStore'
import { partyMasterRoute } from '@/modules/accounting/shared/invoices'
import { formatCurrency } from '@/utils/formatters/currency'
import { previewInterLineTotal, previewLineTotal, moneyInPath } from '../moneyInUi'
import { TotalsPanel } from '../components/TotalsPanel'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import { RECURRING_FREQUENCY_LABELS } from '../recurring-invoices/RecurringInvoiceListPage'
import { useAccountingCustomerLookups } from '@/hooks/useAccountingLookups'
import { gstStateCodeFromGstin } from '@/utils/customerUtils'
import {
  formatPlaceOfSupplyLabel,
  listGstStateSelectOptions,
  resolveGstStateCode,
  validateStateCode,
} from '@/utils/gstStateCode'
import { cn } from '@/utils/cn'
import type { DispatchInvoicePrefillState, CrmTaxInvoicePrefillState } from './invoicePrefillState'
import { useTenantProfileStore } from '@/store/tenantProfileStore'
import { ensureTaxInvoiceFromProforma, type TaxInvoicePrefill } from '@/utils/taxInvoicePrefill'

const CURRENCY_OPTIONS = [
  { value: 'INR', label: 'INR — Indian Rupee' },
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'GBP', label: 'GBP — British Pound' },
  { value: 'AED', label: 'AED — UAE Dirham' },
]

const RECURRING_FREQUENCY_OPTIONS: RecurringInvoiceFrequency[] = [
  'WEEKLY',
  'MONTHLY',
  'QUARTERLY',
  'HALF_YEARLY',
  'YEARLY',
]

const STATE_NAME_TO_CODE: Record<string, string> = {
  maharashtra: '27',
  gujarat: '24',
  karnataka: '29',
  'tamil nadu': '33',
  delhi: '07',
  haryana: '06',
  rajasthan: '08',
  'uttar pradesh': '09',
  telangana: '36',
  'andhra pradesh': '37',
  'west bengal': '19',
  'madhya pradesh': '23',
  kerala: '32',
  punjab: '03',
  goa: '30',
}

const GST_STATE_OPTIONS = listGstStateSelectOptions()

function resolvePlaceOfSupplyFromCustomer(opts: {
  lookupStateCode?: string | null
  lookupGstin?: string | null
  storeGstin?: string | null
  storeState?: string | null
}): string | null {
  if (opts.lookupStateCode) {
    const fromLookup = resolveGstStateCode(opts.lookupStateCode)
    if (fromLookup) return fromLookup
  }
  const gstin = opts.lookupGstin || opts.storeGstin
  if (gstin && gstin.trim().length >= 2) {
    const code = validateStateCode(gstStateCodeFromGstin(gstin))
    if (code) return code
  }
  return resolveGstStateCode(opts.storeState) ?? (opts.storeState ? STATE_NAME_TO_CODE[opts.storeState.trim().toLowerCase()] ?? null : null)
}

function deriveSupplyTypeFromStates(
  legalEntityStateCode: string | null | undefined,
  placeOfSupply: string | null | undefined,
): 'INTRA_STATE' | 'INTER_STATE' | null {
  const le = validateStateCode(legalEntityStateCode)
  const pos = validateStateCode(placeOfSupply)
  if (!le || !pos) return null
  return le === pos ? 'INTRA_STATE' : 'INTER_STATE'
}

const lineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  hsnCode: z.string().optional(),
  uom: z.string().optional(),
})

const formSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  invoiceDate: z.string().min(1),
  postingDate: z.string().min(1),
  dueDate: z.string().optional(),
  customerPoNumber: z.string().optional(),
  projectRef: z.string().optional(),
  projectNameSnapshot: z.string().optional(),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  taxTreatment: z.enum(['REGISTERED', 'UNREGISTERED']),
  placeOfSupply: z
    .string()
    .min(1, 'Place of supply is required')
    .refine((v) => Boolean(validateStateCode(v)), 'Select a valid GST state code'),
  currencyCode: z.string().min(1),
  freightAmount: z.string().optional(),
  otherChargesAmount: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(1),
})

type FormValues = z.infer<typeof formSchema>

function today() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Demo-mode SO whitelist. API mode uses `/accounting/lookups/sales-orders`
 * with `eligibleOnly=true` (server-side status whitelist + tenant scope).
 */
const INVOICEABLE_SO_STATUSES: SalesOrderStatus[] = ['confirmed', 'in_production', 'ready_dispatch', 'dispatched']

const EMPTY_LINE = { itemId: '', description: '', quantity: '1', unitPrice: '0', hsnCode: '', uom: '' }

/** Zoho-flat document card — dense header + tight body. Shared by all sections on this page. */
function FormSection({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        'sales-invoice-zoho-form__section mi-create-section rounded-md border border-erp-border bg-white',
        className,
      )}
    >
      <header className="sales-invoice-zoho-form__section-header mi-create-section__header flex flex-wrap items-center justify-between gap-2 border-b border-erp-border">
        <div>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-text">{title}</h3>
          {subtitle && <p className="text-[11px] text-erp-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="mi-create-section__body">{children}</div>
    </section>
  )
}

function customerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}

function formatCustomerBillingAddress(c: Customer): string {
  return [c.addressLine1, c.addressLine2, [c.city, c.state].filter(Boolean).join(', '), c.pincode, c.country]
    .filter(Boolean)
    .join('\n')
}

function formatCustomerShippingAddress(c: Customer): string {
  if (c.shippingAddress?.trim()) {
    return [
      c.shippingAddress,
      c.shippingAddressLine2,
      [c.shippingCity, c.shippingState].filter(Boolean).join(', '),
      c.shippingPincode,
      c.shippingCountry,
    ]
      .filter(Boolean)
      .join('\n')
  }
  return formatCustomerBillingAddress(c)
}

/** Read-only master-derived value shown as a form field for layout parity. */
function ReadonlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <FormField label={label} hint={hint}>
      <div className="erp-input flex min-h-[34px] items-center bg-erp-surface-alt/70 text-erp-text">
        {value || '—'}
      </div>
    </FormField>
  )
}

const LINE_GRID = 'md:grid-cols-[minmax(0,2.4fr)_minmax(0,2.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.5fr)]'

export function InvoiceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const showFreight = !useTenantProfileStore((s) => s.isServices())
  const locationState = location.state as (DispatchInvoicePrefillState & CrmTaxInvoicePrefillState) | null
  const dispatchPrefill = locationState?.dispatchPrefill
  const crmTaxPrefill = locationState?.crmTaxInvoicePrefill
  const proformaId = mode === 'create' ? searchParams.get('proformaId') : null
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [wasReady, setWasReady] = useState(false)
  const [sourceMode, setSourceMode] = useState<SalesInvoiceSourceType>(() =>
    dispatchPrefill
      ? 'OUTBOUND_DISPATCH'
      : proformaId
        ? 'PROFORMA_INVOICE'
        : crmTaxPrefill
          ? 'CRM_TAX_INVOICE'
          : 'DIRECT',
  )
  const [proformaSource, setProformaSource] = useState<TaxInvoicePrefill | null>(null)
  const [salesOrderId, setSalesOrderId] = useState(
    dispatchPrefill?.salesOrderId ?? crmTaxPrefill?.salesOrderId ?? '',
  )
  const [dispatchSourceDocumentId, setDispatchSourceDocumentId] = useState<string | null>(
    dispatchPrefill?.sourceDocumentId ?? null,
  )
  const [crmTaxInvoiceId, setCrmTaxInvoiceId] = useState<string | null>(
    crmTaxPrefill?.sourceDocumentId ?? null,
  )
  const [crmCreatedByName, setCrmCreatedByName] = useState<string | null>(
    crmTaxPrefill?.createdByName ?? null,
  )
  const [dispatchSourceLinks, setDispatchSourceLinks] = useState<SalesInvoiceSourceLinkInput[]>(
    dispatchPrefill?.sourceLinks ?? [],
  )
  const [soLookups, setSoLookups] = useState<AccountingSalesOrderLookup[] | null>(null)
  const [isRecurring, setIsRecurring] = useState(
    () => mode === 'create' && !dispatchPrefill && searchParams.get('recurring') === '1',
  )
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringInvoiceFrequency>('MONTHLY')
  const [recurringEndDate, setRecurringEndDate] = useState('')
  const [showQuickCreateCustomer, setShowQuickCreateCustomer] = useState(false)
  const [legalEntity, setLegalEntity] = useState<LegalEntity | null>(null)
  const [companyStateCode, setCompanyStateCode] = useState('')

  const salesOrders = useMrpStore((s) => s.salesOrders)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const customers = useMasterStore((s) => s.customers)
  const accountingCustomers = useAccountingCustomerLookups(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: '',
      invoiceDate: today(),
      postingDate: today(),
      supplyType: 'INTRA_STATE',
      taxTreatment: 'REGISTERED',
      placeOfSupply: '',
      currencyCode: 'INR',
      freightAmount: '0',
      otherChargesAmount: '0',
      lines: [{ ...EMPTY_LINE }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()

  useEffect(() => {
    let cancelled = false
    void ensureLegalEntity()
      .then((le) => {
        if (cancelled) return
        setLegalEntity(le)
        const code =
          validateStateCode(le.stateCode) ||
          (le.gstin ? validateStateCode(gstStateCodeFromGstin(le.gstin)) : null) ||
          ''
        setCompanyStateCode(code)
      })
      .catch(() => {
        if (!cancelled) {
          setLegalEntity(null)
          setCompanyStateCode('')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Zoho-style form: posting date is not user-facing — it always trails invoice date.
  useEffect(() => {
    if (watched.invoiceDate) form.setValue('postingDate', watched.invoiceDate, { shouldValidate: false })
  }, [watched.invoiceDate, form])

  /** Keep supply type in sync when both LE + place of supply are known. */
  useEffect(() => {
    const next = deriveSupplyTypeFromStates(companyStateCode, watched.placeOfSupply)
    if (next && next !== watched.supplyType) {
      form.setValue('supplyType', next, { shouldDirty: true })
    }
  }, [companyStateCode, watched.placeOfSupply, watched.supplyType, form])

  const invoiceableOrders = useMemo(
    () => salesOrders.filter((so) => INVOICEABLE_SO_STATUSES.includes(so.status)),
    [salesOrders],
  )

  /** Auto-fill tax treatment, due date, and place of supply from the Customer Master on pick. */
  const applyCustomerDefaults = useCallback(
    (customerId: string) => {
      form.setValue('customerId', customerId, { shouldDirty: true, shouldValidate: true })
      if (!customerId) return
      const lookup = accountingCustomers?.find((c) => c.id === customerId)
      const store = customers.find((c) => c.id === customerId)
      const gstin = lookup?.gstin || store?.gstin
      form.setValue('taxTreatment', gstin ? 'REGISTERED' : 'UNREGISTERED', { shouldDirty: true })
      const creditDays = lookup?.creditDays ?? store?.creditDays
      if (creditDays && creditDays > 0) {
        const base = form.getValues('invoiceDate') || today()
        form.setValue('dueDate', addDays(base, creditDays), { shouldDirty: true })
      }
      const pos = resolvePlaceOfSupplyFromCustomer({
        lookupStateCode: lookup?.stateCode,
        lookupGstin: lookup?.gstin,
        storeGstin: store?.gstin,
        storeState: store?.state,
      })
      if (pos) {
        form.setValue('placeOfSupply', pos, { shouldDirty: true, shouldValidate: true })
      }
    },
    [accountingCustomers, customers, form],
  )

  useEffect(() => {
    if (mode !== 'create' || !dispatchPrefill) return
    applyCustomerDefaults(dispatchPrefill.customerId)
    if (dispatchPrefill.customerPoNumber) {
      form.setValue('customerPoNumber', dispatchPrefill.customerPoNumber, { shouldDirty: true })
    }
    if (dispatchPrefill.projectRef) {
      form.setValue('projectRef', dispatchPrefill.projectRef, { shouldDirty: true })
    }
    if (dispatchPrefill.projectNameSnapshot) {
      form.setValue('projectNameSnapshot', dispatchPrefill.projectNameSnapshot, { shouldDirty: true })
    }
    if (dispatchPrefill.paymentTermsDays && dispatchPrefill.paymentTermsDays > 0) {
      const base = form.getValues('invoiceDate') || today()
      form.setValue('dueDate', addDays(base, dispatchPrefill.paymentTermsDays), { shouldDirty: true })
    }
    form.setValue(
      'lines',
      dispatchPrefill.lines.map((l) => ({
        itemId: l.itemId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        hsnCode: l.hsnCode ?? '',
        uom: l.uom ?? '',
      })),
      { shouldDirty: true },
    )
    setDispatchSourceDocumentId(dispatchPrefill.sourceDocumentId)
    setDispatchSourceLinks(dispatchPrefill.sourceLinks)
    setSourceMode('OUTBOUND_DISPATCH')
    if (dispatchPrefill.salesOrderId) setSalesOrderId(dispatchPrefill.salesOrderId)
  }, [applyCustomerDefaults, dispatchPrefill, form, mode])

  /** Sales → Proforma Invoices → ⋯ → Create Tax Invoice: full detail carry-over (Money-In / services tenants). */
  useEffect(() => {
    if (mode !== 'create' || !proformaId || proformaSource) return
    let cancelled = false
    setLoading(true)
    void ensureTaxInvoiceFromProforma(proformaId)
      .then((result) => {
        if (cancelled) return
        if (!result.ok) {
          notify.error(result.error)
          return
        }
        const data = result.data
        setProformaSource(data)
        applyCustomerDefaults(data.customerId)
        if (data.customerPoNumber) form.setValue('customerPoNumber', data.customerPoNumber, { shouldDirty: true })
        if (data.remarks) form.setValue('narration', data.remarks, { shouldDirty: true })
        form.setValue(
          'lines',
          data.lines.map((l) => ({
            itemId: l.itemId || '',
            description: l.description,
            quantity: String(l.qty),
            unitPrice: String(l.unitPrice),
            hsnCode: l.hsnCode || '',
            uom: l.uom || '',
          })),
          { shouldDirty: true },
        )
        if (data.salesOrderId) setSalesOrderId(data.salesOrderId)
        setSourceMode('PROFORMA_INVOICE')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [applyCustomerDefaults, form, mode, proformaId, proformaSource])

  useEffect(() => {
    if (mode !== 'create' || !crmTaxPrefill) return
    applyCustomerDefaults(crmTaxPrefill.customerId)
    if (crmTaxPrefill.invoiceDate) {
      form.setValue('invoiceDate', crmTaxPrefill.invoiceDate, { shouldDirty: true })
      form.setValue('postingDate', crmTaxPrefill.invoiceDate, { shouldDirty: true })
    }
    if (crmTaxPrefill.dueDate) {
      form.setValue('dueDate', crmTaxPrefill.dueDate, { shouldDirty: true })
    }
    if (crmTaxPrefill.customerPoNumber) {
      form.setValue('customerPoNumber', crmTaxPrefill.customerPoNumber, { shouldDirty: true })
    }
    if (crmTaxPrefill.narration) {
      form.setValue('narration', crmTaxPrefill.narration, { shouldDirty: true })
    }
    form.setValue(
      'lines',
      crmTaxPrefill.lines.map((l) => ({
        itemId: l.itemId ?? '',
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        hsnCode: l.hsnCode ?? '',
        uom: l.uom ?? '',
      })),
      { shouldDirty: true },
    )
    setCrmTaxInvoiceId(crmTaxPrefill.sourceDocumentId)
    setCrmCreatedByName(crmTaxPrefill.createdByName)
    if (crmTaxPrefill.salesOrderId) setSalesOrderId(crmTaxPrefill.salesOrderId)
    setSourceMode('CRM_TAX_INVOICE')
  }, [applyCustomerDefaults, crmTaxPrefill, form, mode])

  // API mode: invoice-eligible SOs from the accounting lookup endpoint.
  useEffect(() => {
    if (mode !== 'create' || sourceMode !== 'SALES_ORDER' || !isApiMode()) return
    let cancelled = false
    listSalesOrderLookups({ eligibleOnly: true, limit: 100 })
      .then((res) => {
        if (!cancelled) setSoLookups(res.data ?? [])
      })
      .catch((e) => {
        if (!cancelled) {
          setSoLookups(null)
          notify.error(
            e instanceof Error ? e.message : 'Sales order lookup is unavailable — retry or create a direct invoice.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [mode, sourceMode])

  const soOptions: ErpSmartSelectOption<string>[] = useMemo(() => {
    const resolveParty = (customerId: string, fallbackName?: string | null) => {
      const lookup = accountingCustomers?.find((c) => c.id === customerId)
      const store = customers.find((c) => c.id === customerId)
      const name = (lookup?.name || store?.customerName || fallbackName || '').trim()
      const city = (lookup?.city || store?.city || '').trim()
      return { name, city }
    }

    if (isApiMode()) {
      return (soLookups ?? []).map((so) => {
        const { name, city } = resolveParty(so.customerId)
        const status = so.status.replace(/_/g, ' ')
        // Primary: SO number · Secondary: Customer · City · status · PO (omit missing parts)
        const subtitle =
          [
            name || null,
            city || null,
            status,
            so.customerPoNumber ? `PO ${so.customerPoNumber}` : null,
          ]
            .filter(Boolean)
            .join(' · ') || undefined
        return {
          value: so.id,
          label: so.orderNumber,
          subtitle,
          searchText: `${so.orderNumber} ${name} ${city} ${so.customerPoNumber ?? ''}`.toLowerCase(),
        }
      })
    }
    return invoiceableOrders.map((so) => {
      const { name, city } = resolveParty(so.customerId, so.customerName)
      const status = so.status.replace(/_/g, ' ')
      const subtitle =
        [name || so.customerCode || null, city || null, status].filter(Boolean).join(' · ') || undefined
      return {
        value: so.id,
        label: so.salesOrderNo,
        subtitle,
        searchText: `${so.salesOrderNo} ${name} ${city} ${so.customerCode ?? ''} ${so.customerPoNumber ?? ''}`.toLowerCase(),
      }
    })
  }, [accountingCustomers, customers, invoiceableOrders, soLookups])

  const itemOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      items
        .filter((i) => i.isActive)
        .map((i) => ({
          value: i.id,
          label: `${i.itemCode} — ${i.itemName}`,
          subtitle: i.hsnCode ? `HSN ${i.hsnCode}` : undefined,
          searchText: `${i.itemCode} ${i.itemName} ${i.hsnCode ?? ''}`.toLowerCase(),
        })),
    [items],
  )

  // ── Master-derived customer context (lookup preferred, store fallback) ─────
  const customerLookup = useMemo(
    () => accountingCustomers?.find((c) => c.id === watched.customerId),
    [accountingCustomers, watched.customerId],
  )
  const customerStore = useMemo(
    () => customers.find((c) => c.id === watched.customerId),
    [customers, watched.customerId],
  )
  const customerPlaceOfSupply = useMemo(
    () =>
      resolvePlaceOfSupplyFromCustomer({
        lookupStateCode: customerLookup?.stateCode,
        lookupGstin: customerLookup?.gstin,
        storeGstin: customerStore?.gstin,
        storeState: customerStore?.state,
      }),
    [customerLookup, customerStore],
  )
  const customerCreditDays = customerLookup?.creditDays ?? customerStore?.creditDays ?? null
  const companyStateMissing = !validateStateCode(companyStateCode)
  const placeOfSupplyMissing = !validateStateCode(watched.placeOfSupply)

  const applySalesOrder = useCallback(
    (so: SalesOrder) => {
      applyCustomerDefaults(so.customerId)
      if (so.customerPoNumber) form.setValue('customerPoNumber', so.customerPoNumber, { shouldDirty: true })
      const soLines = so.lines ?? []
      if (soLines.length > 0) {
        form.setValue(
          'lines',
          soLines.map((l) => ({
            itemId: l.productId ?? '',
            description: l.description || l.productOrItem,
            quantity: String(l.qty),
            unitPrice: String(l.unitPrice),
            hsnCode: '',
            uom: l.uom ?? '',
          })),
          { shouldDirty: true },
        )
      } else {
        form.setValue(
          'lines',
          [
            {
              itemId: so.productId ?? '',
              description: so.remarks || `As per sales order ${so.salesOrderNo}`,
              quantity: String(so.qty || 1),
              unitPrice: String(so.unitPrice ?? 0),
              hsnCode: '',
              uom: '',
            },
          ],
          { shouldDirty: true },
        )
      }
    },
    [applyCustomerDefaults, form],
  )

  const onPickSalesOrder = (soId: string) => {
    setSalesOrderId(soId)
    const so = salesOrders.find((o) => o.id === soId)
    if (so) {
      // Store row (hydrated from the API in API mode) carries lines for prefill.
      applySalesOrder(so)
      return
    }
    const lookup = soLookups?.find((o) => o.id === soId)
    if (lookup) {
      applyCustomerDefaults(lookup.customerId)
      if (lookup.customerPoNumber) {
        form.setValue('customerPoNumber', lookup.customerPoNumber, { shouldDirty: true })
      }
    }
  }

  const onPickLineItem = (index: number, itemId: string) => {
    form.setValue(`lines.${index}.itemId`, itemId, { shouldDirty: true })
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    form.setValue(`lines.${index}.description`, item.itemName, { shouldDirty: true })
    if (item.hsnCode) form.setValue(`lines.${index}.hsnCode`, item.hsnCode, { shouldDirty: true })
    const uom = uoms.find((u) => u.id === item.baseUomId)
    if (uom) form.setValue(`lines.${index}.uom`, uom.uomCode, { shouldDirty: true })
    const currentRate = Number(form.getValues(`lines.${index}.unitPrice`) || 0)
    if (!currentRate && item.standardRate) {
      form.setValue(`lines.${index}.unitPrice`, String(item.standardRate), { shouldDirty: true })
    }
  }

  const previewTotals = useMemo(() => {
    const inter = watched.supplyType === 'INTER_STATE'
    let subtotal = 0
    let discount = 0
    let taxable = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    for (const line of watched.lines ?? []) {
      const calc = inter
        ? previewInterLineTotal(Number(line.quantity), Number(line.unitPrice))
        : previewLineTotal(Number(line.quantity), Number(line.unitPrice))
      subtotal += calc.grossAmount
      discount += calc.discountAmount
      taxable += calc.taxableAmount
      cgst += calc.cgstAmount
      sgst += calc.sgstAmount
      igst += calc.igstAmount
    }
    const freight = showFreight ? Number(watched.freightAmount || 0) : 0
    const other = Number(watched.otherChargesAmount || 0)
    const total = taxable + cgst + sgst + igst + freight + other
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
      taxable: taxable.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: igst.toFixed(2),
      freight: showFreight ? freight.toFixed(2) : undefined,
      other: other.toFixed(2),
      roundOff: '0.00',
      total: total.toFixed(2),
    }
  }, [watched, showFreight])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await getSalesInvoice(id)
      setUpdatedAt(inv.updatedAt)
      setWasReady(inv.status === 'READY_TO_POST')
      setSourceMode(inv.sourceType ?? 'DIRECT')
      setSalesOrderId(inv.sourceDocumentId ?? '')
      setDispatchSourceDocumentId(inv.sourceType === 'OUTBOUND_DISPATCH' ? inv.sourceDocumentId : null)
      setDispatchSourceLinks(
        inv.sourceLinks?.map((l) => ({
          sourceType: l.sourceType,
          sourceDocumentId: l.sourceDocumentId,
          sourceLineId: l.sourceLineId,
          salesOrderId: l.salesOrderId,
          salesOrderLineId: l.salesOrderLineId,
          deliveryChallanId: l.deliveryChallanId,
          deliveryChallanLineId: l.deliveryChallanLineId,
          quantity: l.quantity,
          itemId: l.itemId,
        })) ?? [],
      )
      form.reset({
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate,
        postingDate: inv.postingDate ?? inv.invoiceDate,
        dueDate: inv.dueDate ?? undefined,
        customerPoNumber: inv.customerPoNumber ?? '',
        projectRef: inv.projectRef ?? '',
        projectNameSnapshot: inv.projectNameSnapshot ?? '',
        supplyType: inv.supplyType === 'INTER_STATE' ? 'INTER_STATE' : 'INTRA_STATE',
        taxTreatment: inv.taxTreatment === 'UNREGISTERED' ? 'UNREGISTERED' : 'REGISTERED',
        placeOfSupply: validateStateCode(inv.placeOfSupply) ?? inv.placeOfSupply ?? '',
        currencyCode: inv.currencyCode || 'INR',
        freightAmount: inv.freightAmount,
        otherChargesAmount: inv.otherChargesAmount,
        narration: inv.narration ?? '',
        lines: (inv.lines ?? []).map((l) => ({
          itemId: l.itemId ?? '',
          description: l.description ?? l.itemNameSnapshot ?? '',
          quantity: l.quantity,
          unitPrice: l.unitRate,
          hsnCode: l.hsnCodeSnapshot ?? '',
          uom: l.uomSnapshot ?? '',
        })),
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [form, id])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildPayload = (values: FormValues) => {
    const fromSo = sourceMode === 'SALES_ORDER' && salesOrderId
    const fromDispatch = sourceMode === 'OUTBOUND_DISPATCH' && dispatchSourceDocumentId
    const fromProforma = sourceMode === 'PROFORMA_INVOICE' && proformaId
    const fromCrmTax = sourceMode === 'CRM_TAX_INVOICE' && crmTaxInvoiceId
    const linkedItem = (itemId?: string) => (itemId ? items.find((i) => i.id === itemId) : undefined)
    const lookup = accountingCustomers?.find((c) => c.id === values.customerId)
    const storeCustomer = customers.find((c) => c.id === values.customerId)
    const placeOfSupply =
      validateStateCode(values.placeOfSupply) ||
      resolvePlaceOfSupplyFromCustomer({
        lookupStateCode: lookup?.stateCode,
        lookupGstin: lookup?.gstin,
        storeGstin: storeCustomer?.gstin,
        storeState: storeCustomer?.state,
      })
    const prefillLineByIndex = dispatchPrefill?.lines ?? []
    const proformaLineByIndex = fromProforma ? (proformaSource?.lines ?? []) : []
    return {
      legalEntityId: resolveLegalEntityId(),
      customerId: values.customerId,
      // Source is chosen at creation; edits never change the source document.
      ...(mode === 'create'
        ? fromDispatch
          ? {
              sourceType: 'OUTBOUND_DISPATCH' as SalesInvoiceSourceType,
              sourceDocumentId: dispatchSourceDocumentId,
              sourceLinks: dispatchSourceLinks,
              projectRef: values.projectRef?.trim() || null,
              projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
            }
          : fromProforma
            ? {
                sourceType: 'PROFORMA_INVOICE' as SalesInvoiceSourceType,
                sourceDocumentId: proformaId,
                referenceNumber: proformaSource?.proformaNo ?? null,
                projectRef: values.projectRef?.trim() || null,
                projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
              }
            : fromCrmTax
              ? {
                  sourceType: 'CRM_TAX_INVOICE' as SalesInvoiceSourceType,
                  sourceDocumentId: crmTaxInvoiceId,
                  projectRef: values.projectRef?.trim() || null,
                  projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
                }
              : {
                  sourceType: (fromSo ? 'SALES_ORDER' : 'DIRECT') as SalesInvoiceSourceType,
                  sourceDocumentId: fromSo ? salesOrderId : null,
                  projectRef: values.projectRef?.trim() || null,
                  projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
                }
        : {
            projectRef: values.projectRef?.trim() || null,
            projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
          }),
      invoiceDate: values.invoiceDate,
      postingDate: values.postingDate,
      dueDate: values.dueDate || null,
      customerPoNumber: values.customerPoNumber || null,
      placeOfSupply,
      legalEntityStateCode: validateStateCode(companyStateCode) || null,
      supplyType: values.supplyType,
      taxTreatment: values.taxTreatment,
      currencyCode: values.currencyCode || 'INR',
      freightAmount: showFreight ? (values.freightAmount ?? '0') : '0',
      otherChargesAmount: values.otherChargesAmount ?? '0',
      narration: values.narration || null,
      lines: values.lines.map((l, idx) => {
        const item = linkedItem(l.itemId)
        const prefillLine = prefillLineByIndex[idx]
        const proformaLine = proformaLineByIndex[idx]
        return {
          lineNumber: idx + 1,
          itemId: l.itemId || null,
          itemCode: item?.itemCode ?? prefillLine?.itemCode ?? proformaLine?.itemCode ?? null,
          itemName: item?.itemName ?? prefillLine?.itemName ?? proformaLine?.description ?? null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          hsnCode: l.hsnCode || null,
          uom: l.uom || null,
          sourceLineId: prefillLine?.sourceLineId ?? proformaLine?.sourceLineId ?? null,
        }
      }),
      ...(mode === 'edit' && updatedAt ? { updatedAt } : {}),
    }
  }

  /** Recurring schedules freeze a template (no dates/PO) — one due cycle per `invoiceDate` occurrence. */
  const buildRecurringPayload = (values: FormValues) => {
    const linkedItem = (itemId?: string) => (itemId ? items.find((i) => i.id === itemId) : undefined)
    const lookup = accountingCustomers?.find((c) => c.id === values.customerId)
    const storeCustomer = customers.find((c) => c.id === values.customerId)
    const placeOfSupply =
      validateStateCode(values.placeOfSupply) ||
      resolvePlaceOfSupplyFromCustomer({
        lookupStateCode: lookup?.stateCode,
        lookupGstin: lookup?.gstin,
        storeGstin: storeCustomer?.gstin,
        storeState: storeCustomer?.state,
      })
    return {
      frequency: recurringFrequency,
      startDate: values.invoiceDate,
      endDate: recurringEndDate || null,
      template: {
        customerId: values.customerId,
        supplyType: values.supplyType,
        taxTreatment: values.taxTreatment,
        currencyCode: values.currencyCode || 'INR',
        placeOfSupply,
        narration: values.narration || null,
        freightAmount: showFreight ? (values.freightAmount ?? '0') : '0',
        otherChargesAmount: values.otherChargesAmount ?? '0',
        lines: values.lines.map((l, idx) => {
          const item = linkedItem(l.itemId)
          return {
            lineNumber: idx + 1,
            itemId: l.itemId || null,
            itemCode: item?.itemCode ?? null,
            itemName: item?.itemName ?? null,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            hsnCode: l.hsnCode || null,
            uom: l.uom || null,
          }
        }),
      },
    }
  }

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      const leState = validateStateCode(companyStateCode)
      if (!leState) {
        notify.error(
          'Legal entity state code is required. Select company state below (or set it under Accounting → Setup → Legal Entities).',
        )
        setSaving(false)
        return
      }
      if (legalEntity && validateStateCode(legalEntity.stateCode) !== leState) {
        try {
          const updatedLe = await updateLegalEntity(legalEntity.id, {
            stateCode: leState,
            gstin: legalEntity.gstin ?? undefined,
          })
          setLegalEntity(updatedLe)
          setCompanyStateCode(validateStateCode(updatedLe.stateCode) || leState)
        } catch {
          // Invoice still carries legalEntityStateCode for this draft if master update is denied.
        }
      }

      if (mode === 'create' && isRecurring) {
        await createRecurringSchedule(buildRecurringPayload(values))
        notify.success('Recurring invoice schedule created — first occurrence is in Upcoming')
        navigate(moneyInPath('recurring-invoices'))
      } else if (mode === 'create') {
        const created = await createSalesInvoice(buildPayload(values))
        notify.success('Draft saved')
        navigate(moneyInPath(`invoices/${created.id}`))
      } else if (id) {
        const updated = await updateSalesInvoice(id, buildPayload(values) as Parameters<typeof updateSalesInvoice>[1])
        setUpdatedAt(updated.updatedAt)
        notify.success(wasReady ? 'Saved — invoice returned to Draft' : 'Draft updated')
        navigate(moneyInPath(`invoices/${id}`))
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      notify.error(msg)
      if (msg.includes('changed by another user') && id) void loadExisting()
    } finally {
      setSaving(false)
    }
  })

  const canEdit = mode === 'create' ? perms.canCreateInvoice : perms.canEditInvoice

  if (!canEdit) {
    return (
      <MoneyInWorkspaceShell title={mode === 'create' ? 'New Invoice' : 'Edit Invoice'}>
        <p className="text-[13px] text-erp-muted">You do not have permission to {mode === 'create' ? 'create' : 'edit'} invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyInWorkspaceShell title="Edit Invoice">
        <LoadingState variant="form" />
      </MoneyInWorkspaceShell>
    )
  }

  const selectedSoStore = salesOrderId ? salesOrders.find((o) => o.id === salesOrderId) : undefined
  const selectedSoLookup = salesOrderId ? soLookups?.find((o) => o.id === salesOrderId) : undefined
  const selectedSo = selectedSoStore
    ? {
        number: selectedSoStore.salesOrderNo,
        status: selectedSoStore.status,
        customerPoNumber: selectedSoStore.customerPoNumber ?? null,
      }
    : selectedSoLookup
      ? {
          number: selectedSoLookup.orderNumber,
          status: selectedSoLookup.status,
          customerPoNumber: selectedSoLookup.customerPoNumber,
        }
      : undefined

  const lineErrors = form.formState.errors.lines

  const customerLocked =
    (sourceMode === 'SALES_ORDER' && Boolean(salesOrderId)) ||
    (sourceMode === 'OUTBOUND_DISPATCH' && Boolean(watched.customerId)) ||
    (sourceMode === 'PROFORMA_INVOICE' && Boolean(watched.customerId)) ||
    (sourceMode === 'CRM_TAX_INVOICE' && Boolean(watched.customerId))

  const canSwitchSource =
    mode === 'create' &&
    sourceMode !== 'OUTBOUND_DISPATCH' &&
    sourceMode !== 'PROFORMA_INVOICE' &&
    sourceMode !== 'CRM_TAX_INVOICE'

  const customerDisplayName = customerStore?.customerName || customerLookup?.name || 'Customer'
  const customerCode = customerStore?.customerCode || customerLookup?.code || null
  const customerGstin = customerLookup?.gstin ?? customerStore?.gstin ?? null
  const billingAddress = customerStore ? formatCustomerBillingAddress(customerStore) : '—'
  const shippingAddress = customerStore ? formatCustomerShippingAddress(customerStore) : '—'

  return (
    <MoneyInWorkspaceShell title={mode === 'create' ? 'New Invoice' : 'Edit Invoice'}>
      {wasReady && (
        <p className="mi-create-banner mi-create-banner--warn mb-2">
          Editing a Ready to Post invoice returns it to Draft — mark ready again before posting.
        </p>
      )}

      {sourceMode === 'OUTBOUND_DISPATCH' && dispatchSourceDocumentId && (
        <p className="mi-create-banner mi-create-banner--info mb-2">
          Sourced from outbound dispatch — {dispatchSourceLinks.length} line
          {dispatchSourceLinks.length === 1 ? '' : 's'} linked. Quantities are capped by invoice-ready dispatch qty on
          save.
        </p>
      )}

      {sourceMode === 'PROFORMA_INVOICE' && proformaSource && (
        <p className="mi-create-banner mi-create-banner--info mb-2">
          Sourced from proforma invoice {proformaSource.proformaNo} — {proformaSource.lines.length} line
          {proformaSource.lines.length === 1 ? '' : 's'} carried over. Review before saving.
        </p>
      )}

      {sourceMode === 'CRM_TAX_INVOICE' && crmTaxInvoiceId && (
        <p className="mi-create-banner mi-create-banner--crm mb-2">
          Converting CRM tax invoice — created by <strong>CRM · {crmCreatedByName || 'user'}</strong>. Save creates a
          Money In draft linked for Accounting approval / post.
        </p>
      )}

      {canSwitchSource && (
        <div className="mi-create-toolbar mb-2">
          <div className="mi-create-toolbar__group">
            <span className="mi-create-toolbar__label">Source</span>
            <ErpSegmentedControl<'DIRECT' | 'SALES_ORDER'>
              variant="pills"
              name="Invoice source"
              value={sourceMode === 'SALES_ORDER' ? 'SALES_ORDER' : 'DIRECT'}
              onChange={(next) => {
                setSourceMode(next)
                if (next === 'DIRECT') setSalesOrderId('')
              }}
              options={[
                { value: 'DIRECT', label: 'Direct' },
                { value: 'SALES_ORDER', label: 'Sales Order', disabled: isRecurring },
              ]}
            />
          </div>
          <div className="mi-create-toolbar__group">
            <Checkbox
              label="Recurring"
              checked={isRecurring}
              onChange={(e) => {
                const checked = e.target.checked
                setIsRecurring(checked)
                if (checked) {
                  setSourceMode('DIRECT')
                  setSalesOrderId('')
                }
              }}
            />
          </div>
        </div>
      )}

      <form onSubmit={onSave} className="sales-invoice-zoho-form mi-create-form">
        <FormSection
          title="Customer & Invoice Details"
          subtitle="Party, dates, and GST — defaults from Customer Master."
        >
          <div className="mi-create-commercial__body">
            {sourceMode === 'OUTBOUND_DISPATCH' && (
              <div className="mi-create-source-chips">
                <span className="mi-create-source-chip">
                  <span className="mi-create-source-chip__label">Dispatch</span>
                  {dispatchSourceDocumentId ?? '—'}
                </span>
                <span className="mi-create-source-chip">
                  <span className="mi-create-source-chip__label">Lines</span>
                  {dispatchSourceLinks.length}
                </span>
                {selectedSo && (
                  <span className="mi-create-source-chip">
                    <span className="mi-create-source-chip__label">SO</span>
                    {selectedSo.number}
                  </span>
                )}
              </div>
            )}

            {sourceMode === 'PROFORMA_INVOICE' && proformaSource && (
              <div className="mi-create-source-chips">
                <span className="mi-create-source-chip">
                  <span className="mi-create-source-chip__label">Proforma</span>
                  {proformaSource.proformaNo ?? '—'}
                </span>
                <span className="mi-create-source-chip">
                  <span className="mi-create-source-chip__label">Lines</span>
                  {proformaSource.lines.length}
                </span>
                {proformaSource.salesOrderNo && (
                  <span className="mi-create-source-chip">
                    <span className="mi-create-source-chip__label">SO</span>
                    {proformaSource.salesOrderNo}
                  </span>
                )}
              </div>
            )}

            {sourceMode === 'SALES_ORDER' && (
              <div className="mi-create-source-row">
                <FormField
                  label="Sales order"
                  hint={mode === 'edit' ? 'Source document is fixed after creation.' : undefined}
                >
                  {mode === 'create' ? (
                    <ErpSmartSelect
                      options={soOptions}
                      value={salesOrderId}
                      onChange={onPickSalesOrder}
                      placeholder="Select sales order…"
                      emptyMessage="No invoiceable sales orders (confirmed → dispatched)"
                      allowEmpty
                    />
                  ) : (
                    <Input value={selectedSo?.number ?? salesOrderId} readOnly disabled />
                  )}
                </FormField>
                {selectedSo && (
                  <>
                    <ReadonlyField label="SO status" value={selectedSo.status.replace(/_/g, ' ')} />
                    <ReadonlyField label="SO customer PO" value={selectedSo.customerPoNumber ?? '—'} />
                  </>
                )}
              </div>
            )}

            <div className="mi-create-customer-row">
              <FormField label="Customer" required error={form.formState.errors.customerId?.message}>
                <CustomerMasterSelect
                  value={watched.customerId}
                  onChange={applyCustomerDefaults}
                  disabled={customerLocked}
                  allowEmpty
                  source="accounting"
                />
              </FormField>
              {mode === 'create' && sourceMode === 'DIRECT' && canQuickCreateEntity('customer') && (
                <ErpButton
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={UserPlus}
                  onClick={() => setShowQuickCreateCustomer(true)}
                >
                  New
                </ErpButton>
              )}
            </div>

            {watched.customerId && (
              <aside className="mi-create-party" aria-label="Selected customer">
                <div className="mi-create-party__avatar" aria-hidden>
                  {customerInitials(customerDisplayName)}
                </div>
                <div className="mi-create-party__main">
                  <div className="mi-create-party__title-row">
                    <h3 className="mi-create-party__name">
                      {customerCode ? `${customerCode} — ` : ''}
                      {customerDisplayName}
                    </h3>
                    <Link to={partyMasterRoute('crm', watched.customerId)} className="mi-create-party__360">
                      Customer 360
                    </Link>
                  </div>
                  <div className="mi-create-party__chips">
                    <span className="mi-create-party__chip">
                      <span className="mi-create-party__chip-label">GSTIN</span>
                      {customerGstin || '—'}
                    </span>
                    <span className="mi-create-party__chip">
                      <span className="mi-create-party__chip-label">Place of supply</span>
                      {watched.placeOfSupply
                        ? formatPlaceOfSupplyLabel(watched.placeOfSupply)
                        : customerPlaceOfSupply
                          ? formatPlaceOfSupplyLabel(customerPlaceOfSupply)
                          : '—'}
                    </span>
                    {customerCreditDays ? (
                      <span className="mi-create-party__chip">
                        <span className="mi-create-party__chip-label">Credit</span>
                        {customerCreditDays} days
                      </span>
                    ) : null}
                  </div>
                </div>
              </aside>
            )}

            {watched.customerId && (
              <div className="mi-create-addresses">
                <div className="mi-create-address">
                  <p className="mi-create-address__label">Bill to</p>
                  <p className="mi-create-address__body">{billingAddress || '—'}</p>
                </div>
                <div className="mi-create-address">
                  <p className="mi-create-address__label">Ship to</p>
                  <p className="mi-create-address__body">{shippingAddress || '—'}</p>
                </div>
              </div>
            )}

            <div className="mi-create-commercial__grid">
              <FormField
                label={isRecurring ? 'Next invoice date' : 'Invoice date'}
                required
                error={form.formState.errors.invoiceDate?.message}
                hint={isRecurring ? 'Date of the first invoice occurrence' : undefined}
              >
                <Input type="date" {...form.register('invoiceDate')} />
              </FormField>
              {isRecurring ? (
                <>
                  <FormField label="Frequency" required>
                    <Select
                      value={recurringFrequency}
                      onChange={(e) => setRecurringFrequency(e.target.value as RecurringInvoiceFrequency)}
                    >
                      {RECURRING_FREQUENCY_OPTIONS.map((f) => (
                        <option key={f} value={f}>
                          {RECURRING_FREQUENCY_LABELS[f]}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="End date" hint="Leave blank to repeat indefinitely">
                    <Input type="date" value={recurringEndDate} onChange={(e) => setRecurringEndDate(e.target.value)} />
                  </FormField>
                </>
              ) : (
                <FormField
                  label="Due date"
                  hint={customerCreditDays ? `Auto-set from ${customerCreditDays}-day credit terms` : undefined}
                >
                  <Input type="date" {...form.register('dueDate')} />
                </FormField>
              )}
              <FormField label="Currency">
                <Select {...form.register('currencyCode')}>
                  {CURRENCY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Customer PO">
                <Input placeholder="Optional PO reference" {...form.register('customerPoNumber')} />
              </FormField>
              <FormField label="Supply type" hint="Derived from company state vs place of supply">
                <Input
                  readOnly
                  value={
                    watched.supplyType === 'INTER_STATE'
                      ? 'Inter-state (IGST)'
                      : 'Intra-state (CGST + SGST)'
                  }
                  className="font-medium"
                />
              </FormField>
              <FormField label="Tax treatment">
                <Select {...form.register('taxTreatment')}>
                  <option value="REGISTERED">Registered</option>
                  <option value="UNREGISTERED">Unregistered</option>
                </Select>
              </FormField>
              <FormField
                label="Company state"
                required
                error={companyStateMissing ? 'Required to determine CGST/SGST vs IGST' : undefined}
                hint={
                  legalEntity
                    ? `Legal entity: ${legalEntity.displayName}`
                    : 'From Accounting → Setup → Legal Entities'
                }
              >
                <Select
                  value={companyStateCode}
                  onChange={(e) => {
                    setCompanyStateCode(e.target.value)
                  }}
                >
                  <option value="">— Select —</option>
                  {GST_STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Place of supply"
                required
                error={form.formState.errors.placeOfSupply?.message}
                hint={
                  customerPlaceOfSupply
                    ? `Suggested: ${formatPlaceOfSupplyLabel(customerPlaceOfSupply)}`
                    : 'Enter customer state / GSTIN state'
                }
              >
                <Select {...form.register('placeOfSupply')}>
                  <option value="">— Select —</option>
                  {GST_STATE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </Select>
              </FormField>
              {(companyStateMissing || placeOfSupplyMissing) && (
                <p className="mi-create-commercial__hint">
                  Company state and place of supply are required to calculate tax (intra vs inter-state).
                  {legalEntity ? null : (
                    <>
                      {' '}
                      <Link className="underline" to="/accounting/settings/legal-entities">
                        Open legal entities
                      </Link>
                    </>
                  )}
                </p>
              )}
            </div>
          </div>
        </FormSection>

        <FormSection
          title="Item Details"
          subtitle="Item pick fills description, HSN, UOM, and rate from the Item Master."
        >
          {/* Column headers (md+) — Zoho-style table header row */}
          <div
            className={cn(
              'sales-invoice-zoho-form__lines-head mb-1 hidden gap-2 border-b border-erp-border px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-erp-muted md:grid',
              LINE_GRID,
            )}
          >
            <span>Item</span>
            <span>Description *</span>
            <span>HSN</span>
            <span>UOM</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <div>
            {fields.map((field, index) => {
              const line = watched.lines?.[index]
              const amount = Number(line?.quantity || 0) * Number(line?.unitPrice || 0)
              return (
                <div
                  key={field.id}
                  className={cn(
                    'sales-invoice-zoho-form__line-row grid items-start gap-2 rounded border border-erp-border bg-erp-surface-alt/30 p-2 md:rounded-none md:border-0 md:border-b md:bg-transparent md:px-1 md:py-2',
                    LINE_GRID,
                  )}
                >
                  <ErpSmartSelect
                    options={itemOptions}
                    value={line?.itemId ?? ''}
                    onChange={(itemId) => onPickLineItem(index, itemId)}
                    placeholder="Select item…"
                    allowEmpty
                  />
                  <div>
                    <Input
                      placeholder="Description"
                      error={Boolean(lineErrors?.[index]?.description)}
                      {...form.register(`lines.${index}.description`)}
                    />
                    {lineErrors?.[index]?.description && (
                      <p className="mt-0.5 text-[11px] font-medium text-erp-danger-fg">{lineErrors[index]?.description?.message}</p>
                    )}
                  </div>
                  <Input placeholder="HSN" {...form.register(`lines.${index}.hsnCode`)} />
                  <Input placeholder="UOM" {...form.register(`lines.${index}.uom`)} />
                  <Input
                    placeholder="0"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    {...form.register(`lines.${index}.quantity`)}
                  />
                  <Input
                    placeholder="0.00"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    {...form.register(`lines.${index}.unitPrice`)}
                  />
                  <div className="flex min-h-[34px] items-center justify-end pr-1 text-[13px] font-medium tabular-nums text-erp-text">
                    {formatCurrency(Number.isFinite(amount) ? amount : 0)}
                  </div>
                  <div className="flex min-h-[34px] items-center justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className="rounded p-1.5 text-erp-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Remove line"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <button
            type="button"
            className="sales-invoice-zoho-form__add-line mt-2 inline-flex items-center gap-1"
            onClick={() => append({ ...EMPTY_LINE })}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add another line
          </button>

          <p className="mt-2 text-[11px] text-erp-muted">
            Line amounts are gross previews (qty × rate). GST and final totals are calculated by the server on save.
          </p>
        </FormSection>

        <div className="sales-invoice-zoho-form__footer-grid grid gap-2.5 lg:grid-cols-[1.4fr_1fr]">
          <FormSection title="Notes & Charges" subtitle="Header charges on top of line totals.">
            <div className="grid gap-2 sm:grid-cols-2">
              {showFreight ? (
                <FormField label="Freight">
                  <CurrencyInput {...form.register('freightAmount')} />
                </FormField>
              ) : null}
              <FormField label="Narration" className={cn(showFreight ? undefined : 'sm:col-span-2')}>
                <Textarea rows={2} placeholder="Internal narration…" {...form.register('narration')} />
              </FormField>
            </div>
          </FormSection>

          <div className="space-y-2">
            <div className="mi-create-totals">
              <TotalsPanel {...previewTotals} preview />
            </div>
            <details className="rounded-md border border-erp-border bg-white px-3 py-2">
              <summary className="cursor-pointer text-[11px] font-semibold text-erp-muted">Accounting</summary>
              <p className="mt-1.5 text-[11px] text-erp-muted">
                Revenue and receivable accounts resolve from default mappings on save/post (server).
              </p>
            </details>
          </div>
        </div>

        <div className="sales-invoice-zoho-form__sticky-footer flex items-center justify-end gap-2 rounded-md border border-erp-border">
          <ErpButton type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </ErpButton>
          <ErpButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : isRecurring ? 'Create Recurring Schedule' : 'Save Draft'}
          </ErpButton>
        </div>
      </form>

      <QuickCompanyCreateModal
        open={showQuickCreateCustomer}
        onClose={() => setShowQuickCreateCustomer(false)}
        onCreated={(result) => {
          applyCustomerDefaults(result.id)
          setShowQuickCreateCustomer(false)
        }}
      />
    </MoneyInWorkspaceShell>
  )
}

export function InvoiceNewPage() {
  return <InvoiceFormPage mode="create" />
}

export function InvoiceEditPage() {
  return <InvoiceFormPage mode="edit" />
}
