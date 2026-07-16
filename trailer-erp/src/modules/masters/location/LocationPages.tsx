import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, MapPin, User, Save, Settings2, Package, Receipt } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import {
  DocumentUsagePicker,
  LocationFormPreview,
  suggestLocationCode,
} from '../../../components/masters/LocationFormSections'
import { StateSelect, CitySelect, CountrySelect } from '../../../components/masters/GeographySelects'
import { GstinFieldHelper } from '../../../components/masters/CustomerFormSections'
import { panFromGstin } from '../../../utils/customerUtils'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox, MobileInput } from '../../../components/forms/Inputs'
import { phoneDigitsField } from '../../../utils/phoneValidationZod'
import { ErpCardSection, ErpStickySaveBar } from '../../../components/erp/card-form'
import {
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
  EnterpriseWorkspace,
} from '../../../design-system/workspace'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notify, notifyMasterSaved } from '../../../store/toastStore'
import { useActiveWarehouses } from '../../../hooks/useMasterLists'
import { formatLocationAddress } from '../../../utils/locationUtils'
import { formatDate } from '../../../utils/dates/format'
import type { Location } from '../../../types/master'
import { LOCATION_REGISTERED_TYPE_LABELS, type LocationRegisteredType } from '../../../types/master'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const schema = z.object({
  locationCode: z.string().min(1).max(10),
  locationName: z.string().min(1, 'Location name required'),
  name2: z.string().optional(),
  warehouseId: z.string().nullable(),
  address: z.string().min(1, 'Address line 1 required'),
  address2: z.string().optional(),
  city: z.string().min(1, 'City required'),
  state: z.string().min(1, 'State required'),
  postCode: z.string(),
  country: z.string().min(1, 'Country required'),
  contactName: z.string(),
  phone: phoneDigitsField,
  email: z.string(),
  pan: z.string().max(10).optional(),
  registeredType: z.enum(['regular_taxpayer', 'composition_scheme', 'sez_unit', 'unregistered', 'casual_taxable']).optional(),
  gstin: z.string().optional(),
  tin: z.string().optional(),
  useAsInTransit: z.boolean(),
  requireShipment: z.boolean(),
  requireReceive: z.boolean(),
  allowSales: z.boolean(),
  allowPurchase: z.boolean(),
  allowProduction: z.boolean(),
  isDefault: z.boolean(),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  const gst = data.gstin?.trim().toUpperCase() ?? ''
  if (gst && (gst.length !== 15 || !GSTIN_RE.test(gst))) {
    ctx.addIssue({ code: 'custom', message: 'GST number must be 15 characters in valid format', path: ['gstin'] })
  }
  const pan = data.pan?.trim().toUpperCase() ?? ''
  if (pan && (pan.length !== 10 || !PAN_RE.test(pan))) {
    ctx.addIssue({ code: 'custom', message: 'PAN must be 10 characters (e.g. AABCV1234E)', path: ['pan'] })
  }
})

type FormData = z.infer<typeof schema>

function UsageBadges({ loc }: { loc: Location }) {
  const tags: string[] = []
  if (loc.useAsInTransit) tags.push('In-Transit')
  if (loc.allowSales) tags.push('Sales')
  if (loc.allowPurchase) tags.push('Purchase')
  if (loc.allowProduction) tags.push('Production')
  if (loc.isDefault) tags.push('Default')
  if (tags.length === 0) return <span className="text-erp-muted">—</span>
  return (
    <span className="flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="rounded bg-erp-surface-alt px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-erp-muted">
          {t}
        </span>
      ))}
    </span>
  )
}

export function LocationListPage() {
  const locations = useMasterStore((s) => s.locations)
  const deleteLocation = useMasterStore((s) => s.deleteLocation)
  const activateLocation = useMasterStore((s) => s.activateLocation)
  const deactivateLocation = useMasterStore((s) => s.deactivateLocation)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [usageFilter, setUsageFilter] = useState('all')

  const filtered = useMemo(
    () =>
      locations.filter((loc) => {
        const s = search.toLowerCase()
        const usageMatch =
          usageFilter === 'all' ||
          (usageFilter === 'purchase' && loc.allowPurchase) ||
          (usageFilter === 'sales' && loc.allowSales) ||
          (usageFilter === 'production' && loc.allowProduction) ||
          (usageFilter === 'transit' && loc.useAsInTransit)
        return (
          matchesStatusFilter(loc.isActive, status) &&
          usageMatch &&
          (loc.locationCode.toLowerCase().includes(s) ||
            loc.locationName.toLowerCase().includes(s) ||
            loc.city.toLowerCase().includes(s))
        )
      }),
    [locations, search, status, usageFilter],
  )

  const columns: ColumnDef<Location, unknown>[] = [
    { accessorKey: 'locationCode', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.locationCode}</span> },
    { accessorKey: 'locationName', header: 'Name' },
    { accessorKey: 'state', header: 'State' },
    { accessorKey: 'city', header: 'City' },
    { id: 'usage', header: 'Usage', cell: ({ row }) => <UsageBadges loc={row.original} /> },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <CoreMasterRowActions
          viewTo={`/masters/locations/${row.original.id}`}
          editTo={`/masters/locations/${row.original.id}/edit`}
          recordId={row.original.id}
          recordLabel={`${row.original.locationCode} — ${row.original.locationName}`}
          isActive={row.original.isActive}
          deleteRecord={deleteLocation}
          activateRecord={activateLocation}
          deactivateRecord={deactivateLocation}
        />
      ),
    },
  ]

  return (
    <MasterListShell
      title="Location Master"
      description="Business Central–style inventory locations used on sales, purchase, production, and stock documents"
      masterGroupId="inventory"
      createLabel="New Location"
      createTo="/masters/locations/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={
        <Select value={usageFilter} onChange={(e) => setUsageFilter(e.target.value)} className="w-40">
          <option value="all">All Usage</option>
          <option value="purchase">Purchase</option>
          <option value="sales">Sales</option>
          <option value="production">Production</option>
          <option value="transit">In-Transit</option>
        </Select>
      }
      stats={[
        { label: 'Locations', value: locations.length },
        { label: 'Purchase', value: locations.filter((l) => l.allowPurchase && l.isActive).length },
        { label: 'Default', value: locations.filter((l) => l.isDefault && l.isActive).length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function LocationFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const locations = useMasterStore((s) => s.locations)
  const existing = useMasterStore((s) => (id ? s.getLocation(id) : undefined))
  const addLocation = useMasterStore((s) => s.addLocation)
  const updateLocation = useMasterStore((s) => s.updateLocation)
  const getWarehouseName = useMasterStore((s) => s.getWarehouseName)
  const warehouses = useActiveWarehouses()
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('profile')

  const suggestedCode = useMemo(() => suggestLocationCode(locations), [locations])

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          ...existing,
          address2: existing.address2 ?? '',
          name2: existing.name2 ?? '',
          country: existing.country ?? DEFAULT_CUSTOMER_COUNTRY,
          pan: existing.pan ?? '',
          registeredType: existing.registeredType ?? 'regular_taxpayer',
          gstin: existing.gstin ?? '',
          tin: existing.tin ?? '',
        }
      : {
          locationCode: suggestedCode,
          locationName: '',
          name2: '',
          warehouseId: warehouses[0]?.id ?? null,
          address: '',
          address2: '',
          city: '',
          state: '',
          postCode: '',
          country: DEFAULT_CUSTOMER_COUNTRY,
          contactName: '',
          phone: '',
          email: '',
          pan: '',
          registeredType: 'regular_taxpayer' as LocationRegisteredType,
          gstin: '',
          tin: '',
          useAsInTransit: false,
          requireShipment: false,
          requireReceive: true,
          allowSales: true,
          allowPurchase: true,
          allowProduction: true,
          isDefault: false,
          isActive: true,
        },
  })

  const watched = useWatch({ control })

  const profileDone = Boolean(watched.locationCode?.trim() && watched.locationName?.trim())
  const addressDone = Boolean(watched.address?.trim() && watched.city?.trim() && watched.state?.trim() && watched.country?.trim())
  const usageDone = Boolean(watched.allowSales || watched.allowPurchase || watched.allowProduction || watched.useAsInTransit)
  const contactDone = Boolean(watched.contactName?.trim() || watched.phone?.trim() || watched.email?.trim())

  const taxDone = Boolean(
    (watched.registeredType === 'unregistered' || watched.gstin?.trim()) &&
    !errors.gstin &&
    !errors.pan,
  )

  const completionItems = useMemo(
    () => [
      { id: 'profile', label: 'Profile', done: profileDone },
      { id: 'address', label: 'Address', done: addressDone },
      { id: 'tax', label: 'Tax Registration', done: taxDone },
      { id: 'usage', label: 'Usage', done: usageDone },
      { id: 'contact', label: 'Contact', done: contactDone },
    ],
    [profileDone, addressDone, taxDone, usageDone, contactDone],
  )

  const requiredComplete = [profileDone, addressDone, usageDone].filter(Boolean).length
  const completionPercent = Math.round((requiredComplete / 3) * 100)

  const sectionNavItems = useMemo(
    () => [
      { id: 'profile', label: 'Profile', icon: MapPin, done: profileDone },
      { id: 'address', label: 'Address', icon: Building2, done: addressDone },
      { id: 'tax', label: 'Tax Registration', icon: Receipt, done: taxDone },
      { id: 'usage', label: 'Document Usage', icon: Settings2, done: usageDone },
      { id: 'contact', label: 'Contact', icon: User, done: contactDone },
    ],
    [profileDone, addressDone, taxDone, usageDone, contactDone],
  )

  const warehouseLabel = watched.useAsInTransit
    ? 'In-Transit'
    : watched.warehouseId
      ? getWarehouseName(watched.warehouseId)
      : '—'

  const formMetrics = useMemo(
    () => [
      { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${requiredComplete} of 3 required sections` },
      { label: 'Warehouse', value: warehouseLabel, accent: 'violet' as const, hint: 'Stock posting register' },
      { label: 'Usage', value: [watched.allowPurchase && 'Purchase', watched.allowSales && 'Sales', watched.allowProduction && 'Production'].filter(Boolean).join(' · ') || 'None', accent: 'amber' as const },
      { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive', accent: watched.isActive ? ('green' as const) : ('amber' as const), hint: watched.isDefault ? 'Default location' : 'Standard' },
    ],
    [completionPercent, requiredComplete, warehouseLabel, watched.allowPurchase, watched.allowSales, watched.allowProduction, watched.isActive, watched.isDefault],
  )

  const documentStrip = [
    { label: 'Code', value: watched.locationCode?.trim() || 'Auto', highlight: Boolean(watched.locationCode?.trim()) },
    { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
    { label: 'Name', value: watched.locationName?.trim() || '—', highlight: Boolean(watched.locationName?.trim()) },
    { label: 'Warehouse', value: warehouseLabel },
    { label: 'City', value: watched.city?.trim() || '—', highlight: Boolean(watched.city?.trim()) },
    { label: 'State', value: watched.state?.trim() || '—' },
    { label: 'Country', value: watched.country?.trim() || DEFAULT_CUSTOMER_COUNTRY },
    { label: 'Default', value: watched.isDefault ? 'Yes' : 'No' },
  ]

  const validationGuideItems = useMemo(
    () => Object.entries(errors).map(([key, err]) => ({
      id: key,
      label: err?.message?.toString() ?? key,
      message: err?.message?.toString(),
    })),
    [errors],
  )

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`loc-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function buildPayload(data: FormData) {
    const gstin = data.gstin?.trim().toUpperCase() || undefined
    const pan = data.pan?.trim().toUpperCase() || (gstin ? panFromGstin(gstin) : undefined)
    return {
      ...data,
      warehouseId: data.useAsInTransit ? null : data.warehouseId || null,
      address2: data.address2?.trim() || undefined,
      name2: data.name2?.trim() || undefined,
      gstin,
      pan,
      tin: data.tin?.trim() || undefined,
      registeredType: data.registeredType,
    }
  }

  function showToast(msg: string, variant: 'success' | 'error' = 'success') {
    if (variant === 'success') notify.success(msg)
    else notify.error(msg)
  }

  function saveLocation(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const payload = buildPayload(data)
      try {
        let locationId = id
        if (isEdit && id) {
          await resolveMaybeVoid(updateLocation(id, payload))
          notifyMasterSaved('Location', false)
        } else {
          locationId = await resolveMaybeId(addLocation(payload))
          notifyMasterSaved('Location', true)
        }
        if (mode === 'new') {
          navigate('/masters/locations/new')
          return
        }
        if (mode === 'close') {
          navigate('/masters/locations')
          return
        }
        if (!isEdit && locationId) {
          navigate(`/masters/locations/${locationId}/edit`, { replace: true })
        }
      } catch (err) {
        showToast(formatApiError(err), 'error')
      }
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    saveLocation('default')
  }

  const recordTitle = watched.locationName?.trim() || (isEdit ? 'Edit Location' : 'New Location')

  const factBox = (
    <EnterpriseBusinessFactBox
      completion={{ percent: completionPercent, items: completionItems }}
      aiInsights={[
        {
          id: 'ready',
          label: 'Readiness',
          value: completionPercent >= 100 ? 'Ready to save' : 'Incomplete',
          tone: completionPercent >= 100 ? 'success' as const : 'warning' as const,
        },
        {
          id: 'next',
          label: 'Suggested Next',
          value: !profileDone ? 'Enter location code and name' : !addressDone ? 'Complete address' : !usageDone ? 'Enable document usage' : 'Review contact details',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormContextPanel
        summaryTitle="Location Summary"
        actionsTitle="Quick Actions"
        summary={[
          { label: 'Code', value: watched.locationCode || '—' },
          { label: 'Warehouse', value: warehouseLabel },
          { label: 'City', value: watched.city && watched.state ? `${watched.city}, ${watched.state}` : '—' },
          { label: 'Country', value: watched.country ?? DEFAULT_CUSTOMER_COUNTRY },
          { label: 'GSTIN', value: watched.gstin?.length === 15 ? watched.gstin : '—' },
          { label: 'Registered Type', value: watched.registeredType ? LOCATION_REGISTERED_TYPE_LABELS[watched.registeredType] : '—' },
          { label: 'Usage', value: [watched.allowPurchase && 'Purchase', watched.allowSales && 'Sales', watched.allowProduction && 'Production'].filter(Boolean).join(' · ') || '—' },
          { label: 'Default', value: watched.isDefault ? 'Yes' : 'No', highlight: watched.isDefault },
        ]}
        actions={[
          {
            id: 'save',
            label: isEdit ? 'Save Changes' : 'Create Location',
            icon: Save,
            primary: true,
            onClick: () => saveLocation('default'),
            disabled: isSubmitting,
          },
          { id: 'save-close', label: 'Save & Close', icon: Save, onClick: () => saveLocation('close') },
          { id: 'save-new', label: 'Save & New', icon: Save, onClick: () => saveLocation('new') },
          { id: 'list', label: 'Locations', icon: MapPin, onClick: () => navigate('/masters/locations') },
        ]}
      />
      <div className="mt-3">
        <LocationFormPreview
          isEdit={isEdit}
          warehouseLabel={warehouseLabel}
          values={{
            locationCode: watched.locationCode ?? '',
            locationName: watched.locationName ?? '',
            name2: watched.name2,
            city: watched.city ?? '',
            state: watched.state ?? '',
            country: watched.country ?? DEFAULT_CUSTOMER_COUNTRY,
            address: watched.address ?? '',
            address2: watched.address2,
            postCode: watched.postCode ?? '',
            contactName: watched.contactName ?? '',
            phone: watched.phone ?? '',
            email: watched.email ?? '',
            pan: watched.pan,
            registeredType: watched.registeredType,
            gstin: watched.gstin,
            tin: watched.tin,
            allowSales: watched.allowSales ?? true,
            allowPurchase: watched.allowPurchase ?? true,
            allowProduction: watched.allowProduction ?? true,
            useAsInTransit: watched.useAsInTransit ?? false,
            isDefault: watched.isDefault ?? false,
            isActive: watched.isActive ?? true,
          }}
        />
      </div>
    </EnterpriseBusinessFactBox>
  )

  return (
    <>
      <EnterpriseWorkspace
        title={isEdit ? 'Edit Location' : 'New Location'}
        badge="Masters"
        className="enterprise-workspace--dynamics-form"
        recordNo={isEdit ? (existing?.locationCode ?? 'Edit') : 'New'}
        recordTitle={recordTitle}
        status={watched.isActive ? 'Active' : 'Inactive'}
        statusTone={watched.isActive ? 'success' : 'warning'}
        stage={watched.isDefault ? 'Default' : 'Standard'}
        createdDate={existing?.createdAt ? formatDate(existing.createdAt) : formatDate(new Date().toISOString().slice(0, 10))}
        company={watched.locationName?.trim() || undefined}
        favoritePath={isEdit ? `/masters/locations/${id}/edit` : '/masters/locations/new'}
        breadcrumbs={[
          { label: 'Home', to: '/home' },
          { label: 'Masters', to: '/masters' },
          { label: 'Locations', to: '/masters/locations' },
          { label: isEdit ? 'Edit Location' : 'New Location' },
        ]}
        documentStrip={documentStrip}
        validationItems={validationGuideItems.length ? validationGuideItems : undefined}
        factBox={factBox}
        onSubmit={submit}
        onSaveShortcut={() => saveLocation('default')}
        onSaveCloseShortcut={() => saveLocation('close')}
        onSaveAndNewShortcut={() => saveLocation('new')}
        formId="location-master-form"
        footer={(
          <ErpStickySaveBar
            isSubmitting={isSubmitting}
            submitLabel={isEdit ? 'Save' : 'Create Location'}
            cancelTo="/masters/locations"
            onSave={() => saveLocation('default')}
            onSaveAndNew={() => saveLocation('new')}
            onSaveAndClose={() => saveLocation('close')}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete · {requiredComplete}/3 required sections
                {Object.keys(errors).length > 0 ? ' · Fix highlighted fields' : ''}
              </span>
            )}
          />
        )}
      >
        <EnterpriseFormSectionNav sections={sectionNavItems} activeId={activeSection} onSelect={scrollToSection} />
        <EnterpriseFormMetrics metrics={formMetrics} />

        <ErpCardSection
          id="loc-section-profile"
          title="Location Profile"
          subtitle="Code, name, warehouse posting, and status — same structure as Company Master."
          icon={MapPin}
          accent="teal"
          collapsible
          defaultOpen
        >
          <FormField label="Location Code" required error={errors.locationCode?.message} hint={isEdit ? 'Code cannot be changed after creation' : 'Short code used on all entry forms'}>
            <Input {...register('locationCode')} disabled={isEdit} error={!!errors.locationCode} className="font-mono uppercase" placeholder="e.g. PUNE" />
          </FormField>
          <FormField label="Location Name" required error={errors.locationName?.message}>
            <Input {...register('locationName')} error={!!errors.locationName} placeholder="e.g. Pune Plant" />
          </FormField>
          <FormField label="Name 2" hint="Optional description">
            <Input {...register('name2')} placeholder="Secondary name or description" />
          </FormField>
          {!watched.useAsInTransit ? (
            <FormField label="Warehouse (Posting)" hint="Stock ledger warehouse for this location">
              <Select {...register('warehouseId')}>
                <option value="">— Select warehouse —</option>
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>{w.warehouseCode} — {w.warehouseName}</option>
                ))}
              </Select>
            </FormField>
          ) : (
            <FormField label="Warehouse (Posting)">
              <Input value="Not applicable — In-Transit location" disabled />
            </FormField>
          )}
          <div className="col-span-2 flex flex-wrap gap-6">
            <Checkbox label="Default location for new documents" {...register('isDefault')} />
            <Checkbox label="Active" {...register('isActive')} />
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="loc-section-address"
          title="Address"
          subtitle="Physical address — fields aligned with Company Master billing address."
          icon={Building2}
          accent="blue"
          collapsible
          defaultOpen
        >
          <FormField label="Address Line 1" required error={errors.address?.message} className="md:col-span-2">
            <Input {...register('address')} error={!!errors.address} placeholder="Street / plot / MIDC" />
          </FormField>
          <FormField label="Address Line 2" className="md:col-span-2">
            <Input {...register('address2')} placeholder="Building, floor, landmark" />
          </FormField>
          <FormField label="Country" required error={errors.country?.message}>
            <CountrySelect
              value={watched.country ?? DEFAULT_CUSTOMER_COUNTRY}
              onChange={(v) => setValue('country', v, { shouldDirty: true, shouldValidate: true })}
            />
          </FormField>
          <FormField label="State" required error={errors.state?.message}>
            <StateSelect
              value={watched.state ?? ''}
              onChange={(v) => setValue('state', v, { shouldDirty: true, shouldValidate: true })}
            />
          </FormField>
          <FormField label="City" required error={errors.city?.message}>
            <CitySelect
              stateName={watched.state ?? ''}
              value={watched.city ?? ''}
              onChange={(v) => setValue('city', v, { shouldDirty: true, shouldValidate: true })}
            />
          </FormField>
          <FormField label="Pincode" error={errors.postCode?.message}>
            <Input {...register('postCode')} placeholder="6-digit PIN" />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="loc-section-tax"
          title="Tax Registration"
          subtitle="PAN, GST registration type, GST number, and legacy TIN for this location."
          icon={Receipt}
          accent="violet"
          collapsible
          defaultOpen
        >
          <FormField label="Registered Type" hint="GST registration category for this location">
            <Select {...register('registeredType')}>
              {(Object.entries(LOCATION_REGISTERED_TYPE_LABELS) as [LocationRegisteredType, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </FormField>
          <FormField label="GST Number" error={errors.gstin?.message} hint="15-character GSTIN — optional for in-transit locations">
            <Input
              {...register('gstin', {
                onChange: (e) => {
                  const gst = e.target.value.toUpperCase().replace(/\s/g, '')
                  setValue('gstin', gst, { shouldDirty: true, shouldValidate: true })
                  const pan = panFromGstin(gst)
                  if (pan) setValue('pan', pan, { shouldDirty: true, shouldValidate: true })
                },
              })}
              maxLength={15}
              className="font-mono uppercase"
              placeholder="27AABCV1234E1Z9"
              error={!!errors.gstin}
            />
            <GstinFieldHelper gstin={watched.gstin ?? ''} />
          </FormField>
          <FormField label="PAN Number" error={errors.pan?.message} hint="10-character permanent account number">
            <Input
              {...register('pan')}
              maxLength={10}
              className="font-mono uppercase"
              placeholder="AABCV1234E"
              error={!!errors.pan}
            />
          </FormField>
          <FormField label="TIN Number" hint="Legacy VAT / TIN registration — pre-GST reference">
            <Input {...register('tin')} className="font-mono" placeholder="e.g. 27123456789" />
          </FormField>
        </ErpCardSection>

        <ErpCardSection
          id="loc-section-usage"
          title="Document Usage"
          subtitle="Control which business documents can use this location code."
          icon={Package}
          accent="amber"
          collapsible
          defaultOpen
        >
          <div className="col-span-2">
            <DocumentUsagePicker
              values={{
                allowSales: watched.allowSales ?? true,
                allowPurchase: watched.allowPurchase ?? true,
                allowProduction: watched.allowProduction ?? true,
                useAsInTransit: watched.useAsInTransit ?? false,
              }}
              onChange={(patch) => {
                Object.entries(patch).forEach(([k, v]) => setValue(k as keyof FormData, v as never, { shouldDirty: true }))
              }}
            />
          </div>
          <div className="col-span-2 flex flex-wrap gap-6 border-t border-erp-border pt-4">
            <Checkbox label="Require Shipment" {...register('requireShipment')} />
            <Checkbox label="Require Receive" {...register('requireReceive')} />
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="loc-section-contact"
          title="Contact"
          subtitle="Stores incharge or location contact — same fields as Company Master."
          icon={User}
          accent="green"
          collapsible
          defaultOpen
        >
          <FormField label="Contact Person">
            <Input {...register('contactName')} placeholder="Stores incharge / supervisor" />
          </FormField>
          <FormField label="Phone">
            <MobileInput {...register('phone')} placeholder="Digits only" />
          </FormField>
          <FormField label="Email" className="md:col-span-2">
            <Input {...register('email')} type="email" placeholder="name@company.in" />
          </FormField>
        </ErpCardSection>
      </EnterpriseWorkspace>
    </>
  )
}

export function LocationDetailPage() {
  const { id } = useParams()
  const location = useMasterStore((s) => (id ? s.getLocation(id) : undefined))
  const getWarehouseName = useMasterStore((s) => s.getWarehouseName)

  if (!location) return <MasterNotFound message="Location not found." />

  return (
    <DetailLayout
      backTo="/masters/locations"
      backLabel="Back to Locations"
      masterGroupId="inventory"
      title={location.locationName}
      subtitle={location.locationCode}
      editTo={`/masters/locations/${location.id}/edit`}
      badges={
        <>
          {location.isDefault ? <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">Default</span> : null}
          {location.useAsInTransit ? <span className="rounded bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">In-Transit</span> : null}
          <ActiveBadge isActive={location.isActive} />
        </>
      }
    >
      <div className="space-y-6">
        <DetailSection title="General">
          <DetailGrid>
            <DetailField label="Code" value={<span className="font-mono">{location.locationCode}</span>} />
            <DetailField label="Name 2" value={location.name2 || '—'} />
            <DetailField label="Warehouse" value={location.warehouseId ? getWarehouseName(location.warehouseId) : '—'} />
            <DetailField label="Usage" value={<UsageBadges loc={location} />} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Address">
          <DetailGrid>
            <DetailField label="Address" value={<span className="whitespace-pre-line">{formatLocationAddress(location) || '—'}</span>} />
            <DetailField label="Pincode" value={location.postCode || '—'} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Tax Registration">
          <DetailGrid>
            <DetailField label="Registered Type" value={location.registeredType ? LOCATION_REGISTERED_TYPE_LABELS[location.registeredType] : '—'} />
            <DetailField label="GST Number" value={location.gstin || '—'} />
            <DetailField label="PAN Number" value={location.pan || '—'} />
            <DetailField label="TIN Number" value={location.tin || '—'} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Contact">
          <DetailGrid>
            <DetailField label="Contact Person" value={location.contactName || '—'} />
            <DetailField label="Phone" value={location.phone || '—'} />
            <DetailField label="Email" value={location.email || '—'} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Document Rules">
          <DetailGrid>
            <DetailField label="Require Shipment" value={location.requireShipment ? 'Yes' : 'No'} />
            <DetailField label="Require Receive" value={location.requireReceive ? 'Yes' : 'No'} />
            <DetailField label="Allow Sales" value={location.allowSales ? 'Yes' : 'No'} />
            <DetailField label="Allow Purchase" value={location.allowPurchase ? 'Yes' : 'No'} />
            <DetailField label="Allow Production" value={location.allowProduction ? 'Yes' : 'No'} />
          </DetailGrid>
        </DetailSection>
      </div>
    </DetailLayout>
  )
}
