import { useMemo, useState, useRef, type FormEvent } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, MapPin, User, Truck, Receipt, Save, Paperclip, History, Plus, X } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '../../../components/masters/MasterLayouts'
import {
  CustomerTypePicker,
  TerritoryPicker,
  CreditDaysPicker,
  CreditLimitPicker,
  GstinFieldHelper,
} from '../../../components/masters/CustomerFormSections'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'
import { resolveCustomerEntityType } from '../../../config/masterCodeSeriesConfig'
import {
  formatCustomerBillingAddress,
  hasCustomShippingAddress,
  panFromGstin,
  resolveCustomerShippingAddress,
} from '../../../utils/customerUtils'
import { EntityDocumentsPanel } from '../../../components/dms/EntityDocumentsPanel'
import { ActivityTimeline } from '../../../components/crm'
import { useCrmStore } from '../../../store/crmStore'
import { resolveStoreAction } from '../../../store/storeAction'
import { notify } from '../../../store/toastStore'
import { getSessionUser } from '../../../utils/permissions'
import { ActiveBadge, TypeBadge } from '../../../components/ui/StatusBadge'
import { Input, Select, Checkbox, MobileInput } from '../../../components/forms/Inputs'
import { phoneDigitsField, refineMobileWithCountryField } from '../../../utils/phoneValidationZod'
import { normalizeEmail } from '../../../utils/validation/email'
import { optionalEmailField } from '../../../utils/validation/emailZod'
import { StateSelect, CitySelect, CountrySelect } from '../../../components/masters/GeographySelects'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { focusAndHighlightField } from '../../../utils/formValidation'
import { ErpCardCommandBar } from '../../../components/erp/card-form/ErpCardCommandBar'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpQuickEntrySection,
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpAdditionalSectionNav,
  useErpAdditionalInfo,
} from '../../../components/erp/card-form'
import { CrmCardFormShell } from '@/components/crm/CrmCardFormShell'
import { CompanySmartOverviewPanel } from '@/components/crm/CompanySmartOverviewPanel'
import { ENTERPRISE_FORM_CLASS } from '../../../design-system/workspace'
import { getMasterGroupById } from '../../../config/mastersSetupCatalog'
import { buildMasterFormBreadcrumbs } from '../../../utils/masterNavigation'
import { cn } from '../../../utils/cn'
import { useMasterStore } from '../../../store/masterStore'
import { TableLink } from '../../../components/ui/AppLink'
import { customer360Path } from '../../../config/entity360Routes'
import { COMPANY_TERMINOLOGY } from '../../../utils/companyLabels'
import { CompanyCustomerBadge } from '../../../components/masters/CompanyCustomerBadge'
import type { Customer } from '../../../types/master'
import { formatDate, formatDateTime } from '../../../utils/dates/format'
import { appendAuditStripFields, resolveRecordCreatedBy, resolveRecordCreatedDate } from '../../../utils/masterAudit'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const schema = z
  .object({
    customerCode: z.string().min(1),
    customerName: z.string().min(1),
    customerType: z.enum(['corporate', 'dealer', 'government']),
    addressLine1: z.string(),
    addressLine2: z.string().optional(),
    shippingAddress: z.string().optional(),
    shippingAddressLine2: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingState: z.string().optional(),
    shippingPincode: z.string().optional(),
    shippingCountry: z.string().optional(),
    shippingSameAsBilling: z.boolean().optional(),
    city: z.string().min(1, 'City required'),
    state: z.string().min(1, 'State required'),
    pincode: z.string(),
    country: z.string().min(1, 'Country required'),
    gstin: z.string().length(15, 'GSTIN must be 15 characters').regex(GSTIN_RE, 'Invalid GSTIN format'),
    pan: z.string().max(10).optional(),
    contactPerson: z.string(),
    contactPhone: phoneDigitsField,
    contactEmail: optionalEmailField,
    creditDays: z.coerce.number().min(0),
    creditLimit: z.coerce.number().min(0),
    salesTerritory: z.enum(['West', 'North', 'South', 'East']),
    isActive: z.boolean(),
  })
  .superRefine(refineMobileWithCountryField('contactPhone', 'country'))

type FormData = z.infer<typeof schema>

export function CustomerListPage() {
  const customers = useMasterStore((s) => s.customers)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [territory, setTerritory] = useState('all')

  const filtered = useMemo(
    () =>
      customers.filter((c) => {
        const s = search.toLowerCase()
        return (
          matchesStatusFilter(c.isActive, status) &&
          (territory === 'all' || c.salesTerritory === territory) &&
          (c.customerCode.toLowerCase().includes(s) ||
            c.customerName.toLowerCase().includes(s) ||
            c.city.toLowerCase().includes(s))
        )
      }),
    [customers, search, status, territory],
  )

  const columns: ColumnDef<Customer, unknown>[] = [
    { accessorKey: 'customerCode', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.customerCode}</span> },
    { accessorKey: 'customerName', header: COMPANY_TERMINOLOGY.name, cell: ({ row }) => <TableLink to={customer360Path(row.original.id)}>{row.original.customerName}</TableLink> },
    { accessorKey: 'isCustomer', header: 'Party Status', cell: ({ row }) => <CompanyCustomerBadge company={row.original} /> },
    { accessorKey: 'city', header: 'City' },
    { accessorKey: 'salesTerritory', header: 'Territory' },
    { accessorKey: 'customerType', header: 'Type', cell: ({ row }) => <TypeBadge value={row.original.customerType} color="blue" /> },
    { accessorKey: 'creditDays', header: 'Credit Days', cell: ({ row }) => `${row.original.creditDays} days` },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={customer360Path(row.original.id)} editTo={`/masters/companies/${row.original.id}/edit`} /> },
  ]

  return (
    <MasterListShell
      title={COMPANY_TERMINOLOGY.masterTitle}
      description={COMPANY_TERMINOLOGY.masterDescription}
      masterGroupId="crm"
      createLabel={COMPANY_TERMINOLOGY.new}
      createTo="/masters/companies/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={
        <Select value={territory} onChange={(e) => setTerritory(e.target.value)} className="w-32">
          <option value="all">All Regions</option>
          <option value="West">West</option>
          <option value="North">North</option>
          <option value="South">South</option>
          <option value="East">East</option>
        </Select>
      }
      stats={[
        { label: COMPANY_TERMINOLOGY.plural, value: customers.length },
        { label: 'Customers', value: customers.filter((c) => c.isCustomer).length, accent: 'green' },
        { label: 'Corporate', value: customers.filter((c) => c.customerType === 'corporate').length },
        { label: 'Active', value: customers.filter((c) => c.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function CustomerFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const codeEntityType = resolveCustomerEntityType(pathname)
  const session = getSessionUser()
  const customers = useMasterStore((s) => s.customers)
  const existing = useMasterStore((s) => (id ? s.getCustomer(id) : undefined))
  const addCustomer = useMasterStore((s) => s.addCustomer)
  const updateCustomer = useMasterStore((s) => s.updateCustomer)
  const createActivity = useCrmStore((s) => s.createActivity)
  const crmActivities = useCrmStore((s) => s.activities)
  const isEdit = Boolean(id && existing)
  const effectiveCustomerId = id ?? null
  const [activeAdditionalSection, setActiveAdditionalSection] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)
  const formRootRef = useRef<HTMLDivElement | null>(null)

  const customerActivities = useMemo(
    () => (effectiveCustomerId ? crmActivities.filter((a) => a.customerId === effectiveCustomerId) : []),
    [crmActivities, effectiveCustomerId],
  )

  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          ...existing,
          pan: existing.pan ?? panFromGstin(existing.gstin),
          creditLimit: existing.creditLimit ?? 0,
          addressLine2: existing.addressLine2 ?? '',
          shippingAddress: existing.shippingAddress ?? '',
          shippingAddressLine2: existing.shippingAddressLine2 ?? '',
          shippingCity: existing.shippingCity ?? '',
          shippingState: existing.shippingState ?? '',
          shippingPincode: existing.shippingPincode ?? '',
          shippingCountry: existing.shippingCountry ?? DEFAULT_CUSTOMER_COUNTRY,
          shippingSameAsBilling: !hasCustomShippingAddress(existing),
          country: existing.country ?? DEFAULT_CUSTOMER_COUNTRY,
        }
      : {
      customerCode: '',
      customerName: '',
      customerType: 'corporate',
      addressLine1: '',
      addressLine2: '',
      shippingAddress: '',
      shippingAddressLine2: '',
      shippingCity: '',
      shippingState: '',
      shippingPincode: '',
      shippingCountry: DEFAULT_CUSTOMER_COUNTRY,
      shippingSameAsBilling: true,
      city: '',
      state: '',
      pincode: '',
      country: DEFAULT_CUSTOMER_COUNTRY,
      gstin: '',
      pan: '',
      contactPerson: '',
      contactPhone: '',
      contactEmail: '',
      creditDays: 30,
      creditLimit: 5000000,
      salesTerritory: 'West',
      isActive: true,
    },
  })
  const [formInstanceKey, setFormInstanceKey] = useState(0)

  const watched = useWatch({ control })

  const taxDone = Boolean(watched.gstin?.length === 15 && !errors.gstin)
  const addressDone = Boolean(
    watched.addressLine1?.trim()
    && watched.city?.trim()
    && watched.state?.trim()
    && watched.country?.trim(),
  )
  const shippingSameAsBilling = watched.shippingSameAsBilling ?? true
  const shippingDone = Boolean(
    shippingSameAsBilling
    || (
      watched.shippingAddress?.trim()
      && watched.shippingCity?.trim()
      && watched.shippingState?.trim()
      && watched.shippingCountry?.trim()
    ),
  )
  const contactDone = Boolean(watched.contactPerson?.trim() || watched.contactPhone?.trim())
  const hasOptionalDetailData = Boolean(
    taxDone
    || addressDone
    || contactDone
    || !shippingSameAsBilling
    || watched.pan?.trim(),
  )

  const additionalNeedsForceOpen = Boolean(
    errors.gstin
    || errors.pan
    || errors.city
    || errors.state
    || errors.country
    || errors.addressLine1
    || errors.shippingAddress
    || errors.shippingCity
    || errors.shippingState
    || errors.shippingCountry
    || errors.contactEmail
    || errors.contactPhone,
  )

  const {
    open: showAdditionalDetails,
    setOpen: setShowAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo({
    forceOpen: additionalNeedsForceOpen,
    preferOpen: isEdit && hasOptionalDetailData,
  })

  const additionalSectionItems = useMemo(() => {
    const taxStatus = taxDone ? 'Complete' : 'GSTIN pending'
    const billingStatus = addressDone ? 'Complete' : 'Incomplete'
    const shippingStatus = shippingSameAsBilling
      ? 'Same as billing'
      : shippingDone
        ? 'Complete'
        : 'Incomplete'
    const contactStatus = contactDone ? 'Added' : 'Optional'
    return [
      {
        id: 'tax',
        label: 'Tax & Credit',
        status: taxStatus,
        tone: taxDone ? ('ok' as const) : ('missing' as const),
        icon: Receipt,
      },
      {
        id: 'billing',
        label: 'Billing Address',
        status: billingStatus,
        tone: addressDone ? ('ok' as const) : ('missing' as const),
        icon: MapPin,
      },
      {
        id: 'shipping',
        label: 'Shipping Address',
        status: shippingStatus,
        tone: shippingSameAsBilling || shippingDone ? ('ok' as const) : ('missing' as const),
        icon: Truck,
      },
      {
        id: 'contact',
        label: 'Primary Contact',
        status: contactStatus,
        tone: 'neutral' as const,
        icon: User,
      },
      {
        id: 'history',
        label: 'History',
        status: effectiveCustomerId ? `${customerActivities.length} updates` : 'After save',
        tone: 'neutral' as const,
        icon: History,
      },
      {
        id: 'attachments',
        label: 'Attachments',
        status: effectiveCustomerId ? 'Manage files' : 'After save',
        tone: 'neutral' as const,
        icon: Paperclip,
      },
    ]
  }, [
    taxDone,
    addressDone,
    shippingSameAsBilling,
    shippingDone,
    contactDone,
    effectiveCustomerId,
    customerActivities.length,
  ])

  const documentStrip = [
    { label: 'Code', value: watched.customerCode?.trim() || 'Auto', highlight: Boolean(watched.customerCode?.trim()) },
    { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
    { label: 'Company', value: watched.customerName?.trim() || '—', highlight: Boolean(watched.customerName?.trim()) },
    { label: 'Type', value: watched.customerType ?? 'corporate' },
    { label: 'Territory', value: watched.salesTerritory ?? 'West' },
    { label: 'GSTIN', value: watched.gstin?.length === 15 ? watched.gstin : '—', highlight: watched.gstin?.length === 15 },
    { label: 'Location', value: watched.city && watched.state ? `${watched.city}, ${watched.state}` : '—', highlight: Boolean(watched.city && watched.state) },
    { label: 'Country', value: watched.country?.trim() || DEFAULT_CUSTOMER_COUNTRY, highlight: Boolean(watched.country?.trim()) },
    { label: 'Credit', value: watched.creditLimit ? `₹${Number(watched.creditLimit).toLocaleString('en-IN')}` : '—' },
  ]

  const recordAudit = existing ?? {}
  const composedDocumentStrip = appendAuditStripFields(documentStrip, recordAudit, { pendingUserName: session.name })

  const validationGuideItems = useMemo(
    () => Object.entries(errors).map(([key, err]) => ({
      id: key,
      label: err?.message?.toString() ?? key,
      message: err?.message?.toString(),
    })),
    [errors],
  )

  function focusFormField(fieldName?: string) {
    if (!fieldName) return
    focusAndHighlightField(fieldName, { root: formRootRef.current, delayMs: 100 })
  }

  function selectAdditionalSection(sectionId: string) {
    setActiveAdditionalSection(sectionId)
    setShowAdditionalDetails(true)
    window.setTimeout(() => {
      document.getElementById(`cust-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }, 40)
  }

  function scrollToSection(sectionId: string, focusField?: string) {
    if (sectionId === 'quick' || sectionId === 'profile') {
      document.getElementById('cust-section-quick')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      focusFormField(focusField)
      return
    }
    const additionalIds = new Set(additionalSectionItems.map((s) => s.id))
    if (additionalIds.has(sectionId)) {
      selectAdditionalSection(sectionId)
      focusFormField(focusField)
      return
    }
    document.getElementById(`cust-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    focusFormField(focusField)
  }

  function openSectionForErrors(errs: Partial<Record<keyof FormData, unknown>>) {
    if (errs.customerName || errs.customerCode || errs.customerType || errs.salesTerritory) {
      scrollToSection('quick', errs.customerName ? 'customerName' : errs.customerCode ? 'customerCode' : undefined)
      return
    }
    if (errs.gstin || errs.pan || errs.creditDays || errs.creditLimit) {
      scrollToSection('tax', errs.gstin ? 'gstin' : errs.pan ? 'pan' : undefined)
      return
    }
    if (errs.addressLine1 || errs.city || errs.state || errs.country || errs.pincode) {
      const focus = errs.addressLine1
        ? 'addressLine1'
        : errs.country
          ? 'country'
          : errs.state
            ? 'state'
            : errs.city
              ? 'city'
              : 'pincode'
      scrollToSection('billing', focus)
      return
    }
    if (errs.shippingAddress || errs.shippingCity || errs.shippingState || errs.shippingCountry) {
      scrollToSection('shipping', 'shippingAddress')
      return
    }
    if (errs.contactPerson || errs.contactPhone || errs.contactEmail) {
      scrollToSection('contact', errs.contactPerson ? 'contactPerson' : errs.contactPhone ? 'contactPhone' : 'contactEmail')
    }
  }

  function buildPayload(data: FormData) {
    const { shippingSameAsBilling, ...rest } = data
    return {
      ...rest,
      contactEmail: rest.contactEmail?.trim() ? normalizeEmail(rest.contactEmail) : '',
      gstin: rest.gstin.toUpperCase(),
      pan: rest.pan?.trim() || panFromGstin(rest.gstin) || undefined,
      addressLine2: rest.addressLine2?.trim() || undefined,
      shippingAddress: shippingSameAsBilling ? undefined : rest.shippingAddress?.trim() || undefined,
      shippingAddressLine2: shippingSameAsBilling ? undefined : rest.shippingAddressLine2?.trim() || undefined,
      shippingCity: shippingSameAsBilling ? undefined : rest.shippingCity?.trim() || undefined,
      shippingState: shippingSameAsBilling ? undefined : rest.shippingState?.trim() || undefined,
      shippingPincode: shippingSameAsBilling ? undefined : rest.shippingPincode?.trim() || undefined,
      shippingCountry: shippingSameAsBilling ? undefined : rest.shippingCountry?.trim() || undefined,
      deliveryAddress: undefined,
      deliveryAddressLine2: undefined,
      deliveryCity: undefined,
      deliveryState: undefined,
      deliveryPincode: undefined,
      deliveryCountry: undefined,
    }
  }

  function showToast(msg: string, variant: 'success' | 'error' | 'warning' = 'success') {
    if (variant === 'success') notify.success(msg)
    else if (variant === 'warning') notify.warning(msg)
    else notify.failed(msg)
  }

  function saveCompany(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.customerCode, {
        checkDuplicate: (c) => customers.some((x) => x.customerCode === c && x.id !== id),
      })
      if (validation && !validation.ok) {
        showToast(validation.message ?? 'Invalid code', 'warning')
        return
      }
      const payload = buildPayload(data)
      let customerId = id

      if (isEdit && id) {
        const r = await resolveStoreAction(
          Promise.resolve(updateCustomer(id, payload)).then((res) =>
            res && typeof res === 'object' && 'ok' in res ? res : { ok: true },
          ),
        )
        if (!r.ok) {
          showToast(r.error ?? 'Save failed', 'error')
          return
        }
        await resolveStoreAction(
          createActivity({
            type: 'note',
            subject: `${COMPANY_TERMINOLOGY.singular} record updated`,
            description: `${data.customerName} master data saved`,
            customerId: id,
            ownerId: session.id,
            ownerName: session.name,
          }),
        )
        showToast(`${COMPANY_TERMINOLOGY.singular} saved`)
      } else {
        const created = addCustomer(payload)
        const r = await resolveStoreAction(
          Promise.resolve(created).then((res) =>
            typeof res === 'string' ? { ok: true as const, customerId: res } : res,
          ),
        )
        if (!r.ok || !r.customerId) {
          showToast(r.error ?? 'Save failed', 'error')
          return
        }
        customerId = r.customerId
        await resolveStoreAction(
          createActivity({
            type: 'note',
            subject: `${COMPANY_TERMINOLOGY.singular} created`,
            description: `New ${COMPANY_TERMINOLOGY.singular.toLowerCase()} ${data.customerName} registered in master`,
            customerId,
            ownerId: session.id,
            ownerName: session.name,
          }),
        )
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.customerCode)
        showToast(
          mode === 'close'
            ? `${COMPANY_TERMINOLOGY.singular} created`
            : `${COMPANY_TERMINOLOGY.singular} created — form cleared for next entry`,
        )
      }

      if (mode === 'close') {
        navigate('/masters/companies')
        return
      }

      if (!isEdit) {
        reset({
          customerCode: '',
          customerName: '',
          customerType: 'corporate',
          addressLine1: '',
          addressLine2: '',
          shippingAddress: '',
          shippingAddressLine2: '',
          shippingCity: '',
          shippingState: '',
          shippingPincode: '',
          shippingCountry: DEFAULT_CUSTOMER_COUNTRY,
          shippingSameAsBilling: true,
          city: '',
          state: '',
          pincode: '',
          country: DEFAULT_CUSTOMER_COUNTRY,
          gstin: '',
          pan: '',
          contactPerson: '',
          contactPhone: '',
          contactEmail: '',
          creditDays: 30,
          creditLimit: 5000000,
          salesTerritory: 'West',
          isActive: true,
        })
        setFormInstanceKey((k) => k + 1)
        setActiveAdditionalSection(null)
        setShowAdditionalDetails(false)
        navigate('/masters/companies/new', { replace: true })
      }
    }, (errs) => {
      openSectionForErrors(errs)
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    saveCompany('default')
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/companies')
  }

  const recordTitle = watched.customerName?.trim() || (isEdit ? COMPANY_TERMINOLOGY.edit : COMPANY_TERMINOLOGY.new)
  const masterGroup = getMasterGroupById('customer-vendor')
  const MasterGroupIcon = masterGroup?.icon

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        {
          id: 'save',
          label: isSubmitting ? 'Saving…' : (isEdit ? 'Save' : `Create ${COMPANY_TERMINOLOGY.singular}`),
          icon: Save,
          primary: true,
          disabled: isSubmitting,
          onClick: () => saveCompany('default'),
        },
        ...(!isEdit ? [{ id: 'save-new', label: 'Save & New', icon: Plus, disabled: isSubmitting, onClick: () => saveCompany('new') }] : []),
        { id: 'save-close', label: 'Save & Close', icon: Save, disabled: isSubmitting, onClick: () => saveCompany('close') },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: cancelForm },
      ]}
      moreActions={[
        { id: 'list', label: COMPANY_TERMINOLOGY.plural, icon: Building2, onClick: () => navigate('/masters/companies') },
        ...(isEdit && id ? [{ id: '360', label: COMPANY_TERMINOLOGY.hub360, icon: Building2, onClick: () => navigate(customer360Path(id)) }] : []),
      ]}
    />
  )

  const smartOverviewInput = useMemo(() => ({
    customerName: watched.customerName ?? '',
    customerCode: watched.customerCode ?? '',
    customerType: watched.customerType ?? 'corporate',
    city: watched.city ?? '',
    state: watched.state ?? '',
    gstin: watched.gstin ?? '',
    salesTerritory: watched.salesTerritory ?? '',
    creditLimit: Number(watched.creditLimit) || 0,
    creditDays: Number(watched.creditDays) || 0,
    isActive: watched.isActive ?? true,
    hasBillingAddress: Boolean(watched.addressLine1?.trim() && watched.city?.trim() && watched.state?.trim()),
  }), [
    watched.customerName,
    watched.customerCode,
    watched.customerType,
    watched.city,
    watched.state,
    watched.gstin,
    watched.salesTerritory,
    watched.creditLimit,
    watched.creditDays,
    watched.isActive,
    watched.addressLine1,
  ])

  const factBox = (
    <CompanySmartOverviewPanel
      input={smartOverviewInput}
      onGoToSection={scrollToSection}
    />
  )

  return (
    <CrmCardFormShell
      title={isEdit ? COMPANY_TERMINOLOGY.edit : COMPANY_TERMINOLOGY.new}
      badge="CRM & Masters"
      className={cn(ENTERPRISE_FORM_CLASS, 'masters-standard-form', 'enterprise-workspace--crm-smart-overview')}
      recordNo={isEdit ? (existing?.customerCode ?? 'Edit') : 'New'}
      recordTitle={recordTitle}
      status={watched.isActive ? 'Active' : 'Inactive'}
      statusTone={watched.isActive ? 'success' : 'warning'}
      stage={watched.customerType ?? 'corporate'}
      createdDate={resolveRecordCreatedDate(recordAudit)}
      createdBy={resolveRecordCreatedBy(recordAudit, session.name)}
      modifiedDate={existing?.modifiedAt ? formatDateTime(existing.modifiedAt) : undefined}
      modifiedBy={existing?.modifiedByName ?? undefined}
      company={watched.customerName?.trim() || undefined}
      favoritePath={isEdit ? `/masters/companies/${id}/edit` : '/masters/companies/new'}
      breadcrumbs={buildMasterFormBreadcrumbs(
        'customer-vendor',
        COMPANY_TERMINOLOGY.plural,
        '/masters/companies',
        isEdit ? COMPANY_TERMINOLOGY.edit : COMPANY_TERMINOLOGY.new,
      )}
      commandBar={commandBar}
      documentStrip={composedDocumentStrip}
      validationItems={validationGuideItems.length ? validationGuideItems : undefined}
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Smart Context"
      onSubmit={submit}
      onSaveShortcut={() => saveCompany('default')}
      onSaveCloseShortcut={() => saveCompany('close')}
      onSaveAndNewShortcut={() => saveCompany('new')}
      formId="customer-master-form"
    >
      {masterGroup && MasterGroupIcon ? (
        <span className="masters-module-chip masters-module-chip-green mb-3 inline-flex">
          <MasterGroupIcon className="h-3.5 w-3.5" aria-hidden />
          {masterGroup.title}
        </span>
      ) : null}

      <div ref={formRootRef} className="erp-form-body crm-company-form-body">
        <ErpQuickEntrySection
          id="cust-section-quick"
          title="Quick Entry"
          subtitle="Code, name, type, and territory — expand additional information only when needed."
        >
          <MasterCodeField
            key={`customer-code-${formInstanceKey}`}
            entityType={codeEntityType}
            isEdit={isEdit}
            existingCode={existing?.customerCode}
            value={watched.customerCode ?? ''}
            onChange={(v) => setValue('customerCode', v, { shouldValidate: true })}
            onSeriesReady={(h) => { codeSeriesRef.current = h }}
            label={COMPANY_TERMINOLOGY.code}
            error={errors.customerCode?.message}
            required
          />
          <ErpFieldRow
            label={COMPANY_TERMINOLOGY.name}
            required
            dataField="customerName"
            fieldState={errors.customerName ? 'error' : 'idle'}
            fieldError={errors.customerName?.message}
          >
            <Input
              {...register('customerName')}
              error={!!errors.customerName}
              placeholder="e.g. UltraTech Cement Ltd."
              className="erp-input"
              autoFocus={!isEdit}
            />
          </ErpFieldRow>
          <ErpFieldRow label="Customer Type" required>
            <div id="cust-focus-customerType">
              <CustomerTypePicker
                value={watched.customerType ?? 'corporate'}
                onChange={(v) => setValue('customerType', v, { shouldDirty: true })}
              />
            </div>
          </ErpFieldRow>
          <ErpFieldRow label="Sales Territory">
            <div id="cust-focus-salesTerritory" data-field="salesTerritory">
              <TerritoryPicker
                value={watched.salesTerritory ?? 'West'}
                onChange={(v) => setValue('salesTerritory', v, { shouldDirty: true })}
              />
            </div>
          </ErpFieldRow>
          <ErpFieldRow label="Status">
            <Checkbox label="Active — available for CRM and transactions" {...register('isActive')} />
          </ErpFieldRow>
          <ErpFieldRow label="Primary Contact">
            <Input
              {...register('contactPerson')}
              placeholder="Purchase manager name"
              className="erp-input"
            />
          </ErpFieldRow>
        </ErpQuickEntrySection>

        <ErpAdditionalInfoToggle
          open={showAdditionalDetails}
          onToggle={() => {
            if (showAdditionalDetails) setActiveAdditionalSection(null)
            toggleAdditionalDetails()
          }}
          panelId={additionalPanelId}
          sectionCount={additionalSectionItems.length}
          attentionCount={additionalSectionItems.filter((s) => s.tone === 'missing').length}
        />

        <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
          <ErpAdditionalSectionNav
            sections={additionalSectionItems}
            activeId={activeAdditionalSection}
            onSelect={selectAdditionalSection}
            title=""
          />

          {activeAdditionalSection === 'tax' ? (
            <ErpCardSection
              id="cust-section-tax"
              title="Tax & Credit"
              subtitle="GST registration, PAN, credit days, and approved credit limit."
              icon={Receipt}
              accent="violet"
              columns={3}
            >
              <ErpFieldRow
                label="GSTIN"
                required
                dataField="gstin"
                fieldState={errors.gstin ? 'error' : 'idle'}
                fieldError={errors.gstin?.message}
                hint="15-character GST identification number"
              >
                <Input
                  {...register('gstin', {
                    onChange: (e) => {
                      const gst = e.target.value.toUpperCase()
                      setValue('gstin', gst, { shouldDirty: true, shouldValidate: true })
                      const pan = panFromGstin(gst)
                      if (pan) setValue('pan', pan, { shouldDirty: true })
                    },
                  })}
                  maxLength={15}
                  error={!!errors.gstin}
                  className="erp-input font-mono uppercase"
                  placeholder="27AABCU9603R1ZM"
                />
                <GstinFieldHelper gstin={watched.gstin ?? ''} />
              </ErpFieldRow>
              <ErpFieldRow label="PAN" hint="Auto-derived from GSTIN — edit if needed">
                <Input {...register('pan')} maxLength={10} className="erp-input font-mono uppercase" placeholder="AABCU9603R" />
              </ErpFieldRow>
              <ErpFieldRow label="Credit Days" hint="Standard payment terms for receivables">
                <CreditDaysPicker
                  value={Number(watched.creditDays ?? 30)}
                  onChange={(v) => setValue('creditDays', v, { shouldDirty: true, shouldValidate: true })}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Credit Limit (₹)" hint="Approved exposure limit for open orders and AR">
                <div className="flex flex-wrap items-center gap-2">
                  <CreditLimitPicker
                    value={Number(watched.creditLimit ?? 0)}
                    onChange={(v) => setValue('creditLimit', v, { shouldDirty: true })}
                  />
                  <Input type="number" {...register('creditLimit')} className="erp-input max-w-[140px]" min={0} step={100000} />
                </div>
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'billing' ? (
            <ErpCardSection
              id="cust-section-billing"
              title="Billing Address"
              subtitle="Used on quotations, tax invoices, and e-way bills."
              icon={MapPin}
              accent="teal"
              columns={3}
            >
              <ErpFieldRow label="Address Line 1" colSpan={2} dataField="addressLine1">
                <Input {...register('addressLine1')} placeholder="Plot no., industrial area, road" className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow
                label="Country"
                required
                fieldState={errors.country ? 'error' : 'idle'}
                fieldError={errors.country?.message}
              >
                <CountrySelect
                  value={watched.country ?? DEFAULT_CUSTOMER_COUNTRY}
                  onChange={(v) => setValue('country', v, { shouldDirty: true, shouldValidate: true })}
                  error={!!errors.country}
                />
              </ErpFieldRow>
              <ErpFieldRow label="Address Line 2" colSpan={2}>
                <Input {...register('addressLine2')} placeholder="Building, floor, landmark (optional)" className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Pincode">
                <Input {...register('pincode')} placeholder="411001" className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow
                label="State"
                required
                fieldState={errors.state ? 'error' : 'idle'}
                fieldError={errors.state?.message}
              >
                <StateSelect
                  value={watched.state ?? ''}
                  onChange={(v) => {
                    setValue('state', v, { shouldDirty: true, shouldValidate: true })
                    setValue('city', '', { shouldDirty: true })
                  }}
                  error={!!errors.state}
                />
              </ErpFieldRow>
              <ErpFieldRow
                label="City"
                required
                fieldState={errors.city ? 'error' : 'idle'}
                fieldError={errors.city?.message}
              >
                <CitySelect
                  stateName={watched.state ?? ''}
                  value={watched.city ?? ''}
                  onChange={(v) => setValue('city', v, { shouldDirty: true, shouldValidate: true })}
                  error={!!errors.city}
                />
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'shipping' ? (
            <ErpCardSection
              id="cust-section-shipping"
              title="Shipping Address"
              subtitle={shippingSameAsBilling ? 'Same as billing' : 'Dispatch and logistics address.'}
              icon={Truck}
              accent="amber"
              columns={3}
            >
              <div className="col-span-3">
                <Checkbox
                  label="Same as billing address"
                  checked={shippingSameAsBilling}
                  onChange={(e) => {
                    const checked = e.target.checked
                    setValue('shippingSameAsBilling', checked, { shouldDirty: true })
                    if (checked) {
                      setValue('shippingAddress', '', { shouldDirty: true })
                      setValue('shippingAddressLine2', '', { shouldDirty: true })
                      setValue('shippingCity', '', { shouldDirty: true })
                      setValue('shippingState', '', { shouldDirty: true })
                      setValue('shippingPincode', '', { shouldDirty: true })
                      setValue('shippingCountry', DEFAULT_CUSTOMER_COUNTRY, { shouldDirty: true })
                    }
                  }}
                />
              </div>
              {shippingSameAsBilling ? (
                <p className="col-span-3 rounded-lg bg-erp-surface-alt/70 px-3 py-2 text-[12px] text-erp-muted">
                  Shipping documents will use the billing address:
                  {' '}
                  <span className="font-medium text-erp-text">
                    {formatCustomerBillingAddress({
                      addressLine1: watched.addressLine1 ?? '',
                      addressLine2: watched.addressLine2 ?? '',
                      city: watched.city ?? '',
                      state: watched.state ?? '',
                      pincode: watched.pincode ?? '',
                      country: watched.country ?? DEFAULT_CUSTOMER_COUNTRY,
                    }) || '— complete billing address first'}
                  </span>
                </p>
              ) : (
                <>
                  <ErpFieldRow label="Address Line 1" colSpan={2}>
                    <Input {...register('shippingAddress')} placeholder="Plant / warehouse address for dispatch" className="erp-input" />
                  </ErpFieldRow>
                  <ErpFieldRow label="Country" required fieldState={errors.shippingCountry ? 'error' : 'idle'} fieldError={errors.shippingCountry?.message}>
                    <CountrySelect
                      value={watched.shippingCountry ?? DEFAULT_CUSTOMER_COUNTRY}
                      onChange={(v) => setValue('shippingCountry', v, { shouldDirty: true, shouldValidate: true })}
                      error={!!errors.shippingCountry}
                    />
                  </ErpFieldRow>
                  <ErpFieldRow label="Address Line 2" colSpan={2}>
                    <Input {...register('shippingAddressLine2')} placeholder="Building, gate, landmark (optional)" className="erp-input" />
                  </ErpFieldRow>
                  <ErpFieldRow label="Pincode">
                    <Input {...register('shippingPincode')} placeholder="411001" className="erp-input" />
                  </ErpFieldRow>
                  <ErpFieldRow label="State" required fieldState={errors.shippingState ? 'error' : 'idle'} fieldError={errors.shippingState?.message}>
                    <StateSelect
                      value={watched.shippingState ?? ''}
                      onChange={(v) => {
                        setValue('shippingState', v, { shouldDirty: true, shouldValidate: true })
                        setValue('shippingCity', '', { shouldDirty: true })
                      }}
                      error={!!errors.shippingState}
                    />
                  </ErpFieldRow>
                  <ErpFieldRow label="City" required fieldState={errors.shippingCity ? 'error' : 'idle'} fieldError={errors.shippingCity?.message}>
                    <CitySelect
                      stateName={watched.shippingState ?? ''}
                      value={watched.shippingCity ?? ''}
                      onChange={(v) => setValue('shippingCity', v, { shouldDirty: true, shouldValidate: true })}
                      error={!!errors.shippingCity}
                    />
                  </ErpFieldRow>
                </>
              )}
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'contact' ? (
            <ErpCardSection
              id="cust-section-contact"
              title="Primary Contact"
              subtitle="Saved as the company’s primary CRM contact (shown on Contacts and Company 360)."
              icon={User}
              accent="green"
              columns={3}
              optional
            >
              <ErpFieldRow label="Contact Person">
                <Input {...register('contactPerson')} placeholder="Purchase manager name" className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow
                label="Phone"
                dataField="contactPhone"
                fieldState={errors.contactPhone ? 'error' : 'idle'}
                fieldError={errors.contactPhone?.message}
              >
                <MobileInput {...register('contactPhone')} placeholder="10-digit mobile" className="erp-input" />
              </ErpFieldRow>
              <ErpFieldRow label="Email" fieldState={errors.contactEmail ? 'error' : 'idle'} fieldError={errors.contactEmail?.message}>
                <Input type="email" {...register('contactEmail')} error={!!errors.contactEmail} placeholder="procurement@company.com" className="erp-input" />
              </ErpFieldRow>
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'history' ? (
            <ErpCardSection
              id="cust-section-history"
              title="History"
              subtitle="CRM activity and record audit trail for this company."
              icon={History}
              accent="slate"
              columns={3}
            >
              {effectiveCustomerId ? (
                <div className="col-span-3 space-y-3">
                  <div className="rounded-lg border border-erp-border/60 bg-erp-surface-alt/40 px-3 py-2 text-[12px] text-erp-muted">
                    <span className="font-medium text-erp-text">Registered:</span>
                    {' '}
                    {existing?.createdAt ? formatDate(existing.createdAt) : '—'}
                    {existing?.createdByName ? ` · ${existing.createdByName}` : ''}
                    {existing?.modifiedAt ? (
                      <>
                        {' · '}
                        <span className="font-medium text-erp-text">Last modified:</span>
                        {' '}
                        {formatDateTime(existing.modifiedAt)}
                        {existing.modifiedByName ? ` · ${existing.modifiedByName}` : ''}
                      </>
                    ) : null}
                    {existing?.firstInvoicedAt ? (
                      <>
                        {' · '}
                        <span className="font-medium text-erp-text">First invoice:</span>
                        {' '}
                        {formatDate(existing.firstInvoicedAt)}
                      </>
                    ) : null}
                  </div>
                  <ActivityTimeline
                    activities={customerActivities}
                    emptyMessage="No CRM activities yet — updates and follow-ups will appear here."
                  />
                </div>
              ) : (
                <p className="col-span-3 rounded-lg bg-erp-surface-alt/70 px-3 py-2 text-[12px] text-erp-muted">
                  Save the company record once to view history and CRM activity timeline.
                </p>
              )}
            </ErpCardSection>
          ) : null}

          {activeAdditionalSection === 'attachments' ? (
            <ErpCardSection
              id="cust-section-attachments"
              title="Attachments"
              subtitle="Contracts, KYC, drawings, and supporting documents."
              icon={Paperclip}
              accent="slate"
              columns={3}
            >
              {effectiveCustomerId ? (
                <div className="col-span-3">
                  <EntityDocumentsPanel
                    entityType="customer"
                    entityId={effectiveCustomerId}
                    entityLabel={watched.customerName?.trim() || existing?.customerName}
                    title="Company Attachments"
                    allowUpload
                    showHubLink
                  />
                </div>
              ) : (
                <p className="col-span-3 rounded-lg bg-erp-surface-alt/70 px-3 py-2 text-[12px] text-erp-muted">
                  Save the company record once to upload and manage attachments.
                </p>
              )}
            </ErpCardSection>
          ) : null}
        </ErpAdditionalInfoPanel>
      </div>
    </CrmCardFormShell>
  )
}

export function CustomerDetailPage() {
  const { id } = useParams()
  const customer = useMasterStore((s) => (id ? s.getCustomer(id) : undefined))
  if (!customer) return <p className="text-slate-500">{COMPANY_TERMINOLOGY.notFound}</p>

  return (
    <DetailLayout backTo="/masters/companies" backLabel={`Back to ${COMPANY_TERMINOLOGY.plural}`} title={customer.customerName} subtitle={customer.customerCode} editTo={`/masters/companies/${customer.id}/edit`} badges={<><CompanyCustomerBadge company={customer} /><ActiveBadge isActive={customer.isActive} /></>}>
      <DetailSection title={COMPANY_TERMINOLOGY.profile}>
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{customer.customerCode}</span>} />
          <DetailField label="Type" value={<TypeBadge value={customer.customerType} color="blue" />} />
          <DetailField label="GSTIN" value={customer.gstin} />
          <DetailField label="PAN" value={customer.pan ?? '—'} />
          <DetailField label="Territory" value={customer.salesTerritory} />
          <DetailField label="Country" value={customer.country ?? DEFAULT_CUSTOMER_COUNTRY} />
          <DetailField label="Credit Days" value={`${customer.creditDays} days`} />
          <DetailField label="Credit Limit" value={customer.creditLimit ? `₹${customer.creditLimit.toLocaleString('en-IN')}` : '—'} />
          <DetailField label="Billing" value={formatCustomerBillingAddress(customer)} />
          <DetailField label="Shipping" value={hasCustomShippingAddress(customer) ? resolveCustomerShippingAddress(customer) : 'Same as billing'} />
          <DetailField label="Contact" value={customer.contactPerson} />
          <DetailField label="Phone" value={customer.contactPhone} />
          <DetailField label="Email" value={customer.contactEmail} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
