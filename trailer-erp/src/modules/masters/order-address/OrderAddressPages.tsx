import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MapPin, Phone, Receipt, User } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { GstinFieldHelper } from '../../../components/masters/CustomerFormSections'
import { VendorMasterSelect } from '../../../components/masters/VendorMasterSelect'
import { StateSelect, CitySelect, CountrySelect } from '../../../components/masters/GeographySelects'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Checkbox, MobileInput } from '../../../components/forms/Inputs'
import { phoneDigitsField } from '../../../utils/phoneValidationZod'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useActiveVendors } from '../../../hooks/useMasterLists'
import { useMasterStore } from '../../../store/masterStore'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import type { VendorOrderAddress } from '../../../types/orderAddressMaster'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

const schema = z.object({
  vendorId: z.string().min(1, 'Vendor code required'),
  code: z.string().min(1, 'Code required').max(10),
  name: z.string().min(1, 'Name required'),
  address: z.string().min(1, 'Address required'),
  address2: z.string().optional(),
  state: z.string().min(1, 'State required'),
  city: z.string().min(1, 'City required'),
  postCode: z.string(),
  country: z.string().min(1, 'Country required'),
  gstin: z.string(),
  phone: phoneDigitsField,
  email: z.string().email('Invalid email').or(z.literal('')),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  const gst = data.gstin.trim().toUpperCase()
  if (gst && (gst.length !== 15 || !GSTIN_RE.test(gst))) {
    ctx.addIssue({ code: 'custom', message: 'GST registration no. must be 15 characters', path: ['gstin'] })
  }
})

type FormData = z.infer<typeof schema>

export function OrderAddressListPage() {
  const [searchParams] = useSearchParams()
  const presetVendorId = searchParams.get('vendorId') ?? 'all'
  const orderAddresses = useMasterStore((s) => s.vendorOrderAddresses)
  const getVendor = useMasterStore((s) => s.getVendor)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [vendorFilter, setVendorFilter] = useState(presetVendorId)

  const filtered = useMemo(
    () =>
      orderAddresses.filter((a) => {
        const vendor = getVendor(a.vendorId)
        const q = search.toLowerCase()
        return (
          matchesStatusFilter(a.isActive, status) &&
          (vendorFilter === 'all' || a.vendorId === vendorFilter) &&
          (a.code.toLowerCase().includes(q) ||
            a.name.toLowerCase().includes(q) ||
            vendor?.vendorCode.toLowerCase().includes(q) ||
            vendor?.vendorName.toLowerCase().includes(q) ||
            a.gstin.toLowerCase().includes(q))
        )
      }),
    [orderAddresses, search, status, vendorFilter, getVendor],
  )

  const columns: ColumnDef<VendorOrderAddress, unknown>[] = [
    { id: 'vendor', header: 'Vendor Code', cell: ({ row }) => <span className="font-mono text-xs">{getVendor(row.original.vendorId)?.vendorCode ?? '—'}</span> },
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span> },
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'city', header: 'City' },
    { accessorKey: 'state', header: 'State' },
    { accessorKey: 'gstin', header: 'GST Reg. No.' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={`/masters/order-addresses/${row.original.id}`} editTo={`/masters/order-addresses/${row.original.id}/edit`} /> },
  ]

  const vendors = useActiveVendors()

  return (
    <MasterListShell
      title="Order Address Code"
      description="Alternate vendor order / ship-to addresses — Business Central layout"
      masterGroupId="procurement"
      createLabel="New Order Address"
      createTo="/masters/order-addresses/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={(
        <select
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="erp-input w-44 text-sm"
        >
          <option value="all">All Vendors</option>
          {vendors.map((v) => (
            <option key={v.id} value={v.id}>{v.vendorCode}</option>
          ))}
        </select>
      )}
      stats={[
        { label: 'Addresses', value: orderAddresses.length },
        { label: 'Vendors', value: new Set(orderAddresses.map((a) => a.vendorId)).size },
        { label: 'Active', value: orderAddresses.filter((a) => a.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function OrderAddressFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetVendorId = searchParams.get('vendorId') ?? ''
  const existing = useMasterStore((s) => (id ? s.getVendorOrderAddress(id) : undefined))
  const getVendor = useMasterStore((s) => s.getVendor)
  const addVendorOrderAddress = useMasterStore((s) => s.addVendorOrderAddress)
  const updateVendorOrderAddress = useMasterStore((s) => s.updateVendorOrderAddress)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          ...existing,
          address2: existing.address2 ?? '',
          country: existing.country ?? DEFAULT_CUSTOMER_COUNTRY,
        }
      : {
          vendorId: presetVendorId,
          code: '',
          name: '',
          address: '',
          address2: '',
          state: '',
          city: '',
          postCode: '',
          country: DEFAULT_CUSTOMER_COUNTRY,
          gstin: '',
          phone: '',
          email: '',
          isActive: true,
        },
  })

  const watched = useWatch({ control })
  const vendor = watched.vendorId ? getVendor(watched.vendorId) : undefined

  function prefillFromVendor(vendorId: string) {
    const v = getVendor(vendorId)
    if (!v) return
    if (!watched.name?.trim()) setValue('name', v.vendorName, { shouldDirty: true })
    if (!watched.address?.trim() && v.address) setValue('address', v.address, { shouldDirty: true })
    if (!watched.address2?.trim() && v.address2) setValue('address2', v.address2, { shouldDirty: true })
    if (!watched.state?.trim()) setValue('state', v.state, { shouldDirty: true })
    if (!watched.city?.trim()) setValue('city', v.city, { shouldDirty: true })
    if (!watched.postCode?.trim() && v.pincode) setValue('postCode', v.pincode, { shouldDirty: true })
    if (!watched.gstin?.trim() && v.gstin) setValue('gstin', v.gstin, { shouldDirty: true })
    if (!watched.phone?.trim()) setValue('phone', v.contactPhone, { shouldDirty: true })
    if (!watched.email?.trim() && v.email) setValue('email', v.email, { shouldDirty: true })
  }

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit((data) => {
      const payload = {
        ...data,
        code: data.code.trim().toUpperCase(),
        gstin: data.gstin.trim().toUpperCase(),
        address2: data.address2?.trim() || undefined,
        email: data.email.trim(),
      }
      let recordId = id
      if (isEdit && id) updateVendorOrderAddress(id, payload)
      else recordId = addVendorOrderAddress(payload)
      if (mode === 'new') { navigate('/masters/order-addresses/new'); return }
      if (mode === 'close') { navigate('/masters/order-addresses'); return }
      if (!isEdit && recordId) navigate(`/masters/order-addresses/${recordId}/edit`, { replace: true })
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    save('default')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? `${existing!.code}` : 'New Order Address'}
      subtitle={vendor ? `${vendor.vendorCode} — ${watched.name || 'Order address'}` : 'Order address code card'}
      breadcrumbs={buildMasterBreadcrumbs('procurement', isEdit ? 'Edit Order Address' : 'New Order Address')}
      documentStrip={[
        { label: 'Vendor Code', value: vendor?.vendorCode ?? '—', highlight: Boolean(vendor) },
        { label: 'Code', value: watched.code?.trim() || '—' },
        { label: 'Name', value: watched.name?.trim() || '—' },
        { label: 'City', value: watched.city?.trim() || '—' },
        { label: 'GSTIN', value: watched.gstin?.length === 15 ? watched.gstin : '—' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterForm
          listPath="/masters/order-addresses"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/order-addresses')}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: User, done: Boolean(watched.vendorId && watched.code?.trim() && watched.name?.trim()) },
        { id: 'address', label: 'Address', icon: MapPin, done: Boolean(watched.address?.trim() && watched.city?.trim() && watched.state?.trim()) },
        { id: 'contact', label: 'Contact & Tax', icon: Receipt, done: Boolean(watched.phone?.trim() || watched.gstin?.trim()) },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Vendor', value: vendor?.vendorCode ?? '—', accent: 'blue' as const },
        { label: 'Location', value: watched.city && watched.state ? `${watched.city}, ${watched.state}` : '—', accent: 'violet' as const },
        { label: 'Post Code', value: watched.postCode || '—', accent: 'amber' as const },
        { label: 'Active', value: watched.isActive ? 'Yes' : 'No', accent: watched.isActive ? ('green' as const) : ('amber' as const) },
      ]}
      factBoxTitle="Order address"
      factBoxSummary={[
        { label: 'Used on', value: 'Purchase Order, Vendor' },
        { label: 'Vendor', value: vendor?.vendorName ?? '—' },
        { label: 'GSTIN', value: watched.gstin || '—' },
        { label: 'Phone', value: watched.phone || '—' },
        { label: 'Modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/order-addresses')}
        />
      )}
    >
      <form id="order-address-form" onSubmit={submit}>
        <ErpCardSection id="oaddr-section-general" title="General" subtitle="Vendor code, address code, and name." icon={User} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Vendor Code" required error={errors.vendorId?.message}>
              <VendorMasterSelect
                value={watched.vendorId ?? ''}
                onChange={(v) => {
                  setValue('vendorId', v, { shouldValidate: true, shouldDirty: true })
                  prefillFromVendor(v)
                }}
                disabled={isEdit}
              />
            </FormField>
            <FormField label="Code" required error={errors.code?.message} hint="Max 10 characters">
              <Input {...register('code')} className="font-mono uppercase" maxLength={10} placeholder="MAIN" />
            </FormField>
            <FormField label="Name" required error={errors.name?.message} className="md:col-span-2">
              <Input {...register('name')} placeholder="Vendor plant / dispatch point name" />
            </FormField>
            <FormField label="Active" className="md:col-span-2">
              <Checkbox {...register('isActive')} label="Active order address" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="oaddr-section-address" title="Address" subtitle="Street, state, city, post code, and country." icon={MapPin} accent="teal" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Address" required error={errors.address?.message} className="md:col-span-2">
              <Input {...register('address')} placeholder="Street / plot / MIDC" />
            </FormField>
            <FormField label="Address 2" className="md:col-span-2">
              <Input {...register('address2')} placeholder="Building, floor, landmark" />
            </FormField>
            <FormField label="Country" required error={errors.country?.message}>
              <CountrySelect value={watched.country ?? DEFAULT_CUSTOMER_COUNTRY} onChange={(v) => setValue('country', v, { shouldDirty: true, shouldValidate: true })} />
            </FormField>
            <FormField label="State code" required error={errors.state?.message}>
              <StateSelect
                value={watched.state ?? ''}
                onChange={(v) => {
                  setValue('state', v, { shouldDirty: true, shouldValidate: true })
                  setValue('city', '', { shouldDirty: true })
                }}
              />
            </FormField>
            <FormField label="City" required error={errors.city?.message}>
              <CitySelect stateName={watched.state ?? ''} value={watched.city ?? ''} onChange={(v) => setValue('city', v, { shouldDirty: true, shouldValidate: true })} />
            </FormField>
            <FormField label="Post code">
              <Input {...register('postCode')} placeholder="6-digit PIN" maxLength={6} />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="oaddr-section-contact" title="Contact & Tax" subtitle="GST registration, phone, and email." icon={Phone} accent="green" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="GST Registration No." error={errors.gstin?.message} className="md:col-span-2">
              <Input
                {...register('gstin', {
                  onChange: (e) => setValue('gstin', e.target.value.toUpperCase().replace(/\s/g, ''), { shouldDirty: true, shouldValidate: true }),
                })}
                maxLength={15}
                className="font-mono uppercase"
                placeholder="27AABCV1234E1Z9"
              />
              <GstinFieldHelper gstin={watched.gstin ?? ''} />
            </FormField>
            <FormField label="Phone no">
              <MobileInput {...register('phone')} placeholder="Digits only" />
            </FormField>
            <FormField label="Email id" error={errors.email?.message}>
              <Input type="email" {...register('email')} placeholder="name@vendor.in" />
            </FormField>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function OrderAddressDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getVendorOrderAddress(id) : undefined))
  const getVendor = useMasterStore((s) => s.getVendor)
  if (!record) return <MasterNotFound message="Order address not found." />

  const vendor = getVendor(record.vendorId)
  const addressLines = [record.address, record.address2, record.city, record.state, record.postCode, record.country].filter(Boolean)

  return (
    <DetailLayout
      backTo="/masters/order-addresses"
      backLabel="Order Address Codes"
      masterGroupId="procurement"
      title={`${record.code} — ${record.name}`}
      subtitle={vendor ? `${vendor.vendorCode} · ${vendor.vendorName}` : '—'}
      editTo={`/masters/order-addresses/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Vendor Code" value={vendor ? <Link to={`/masters/vendors/${vendor.id}`} className="font-mono text-erp-primary hover:underline">{vendor.vendorCode}</Link> : '—'} />
          <DetailField label="Code" value={<span className="font-mono">{record.code}</span>} />
          <DetailField label="Name" value={record.name} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Address">
        <DetailGrid>
          <DetailField label="Address" value={<span className="whitespace-pre-line">{addressLines.join('\n')}</span>} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Contact & Tax">
        <DetailGrid>
          <DetailField label="GST Registration No." value={record.gstin || '—'} />
          <DetailField label="Phone no" value={record.phone || '—'} />
          <DetailField label="Email id" value={record.email || '—'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
