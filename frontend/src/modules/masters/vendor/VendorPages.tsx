import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Building2,
  CreditCard,
  Landmark,
  MapPin,
  Receipt,
  User,
} from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { MasterBatchImportDialog } from '../../../components/masters/MasterBatchImportDialog'
import { isApiMode } from '../../../config/apiConfig'
import { downloadMasterExport } from '../../../services/api/masterBatchApi'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { GstinFieldHelper } from '../../../components/masters/CustomerFormSections'
import { PaymentMethodSelect } from '../../../components/masters/PaymentMethodSelect'
import { StateSelect, CitySelect, CountrySelect } from '../../../components/masters/GeographySelects'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox, Textarea, MobileInput } from '../../../components/forms/Inputs'
import { phoneDigitsField } from '../../../utils/phoneValidationZod'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import { useActiveBanks } from '../../../hooks/useMasterLists'
import { panFromGstin } from '../../../utils/customerUtils'
import { getSessionUser } from '../../../utils/permissions'
import { enrichVendorWithDefaults } from '../../../utils/vendorDefaults'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'
import {
  GST_VENDOR_TYPE_LABELS,
  PAN_STATUS_LABELS,
  type GstVendorType,
  type PanStatus,
  type Vendor,
} from '../../../types/master'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/

const schema = z.object({
  vendorCode: z.string().min(1).max(20),
  vendorName: z.string().min(1, 'Vendor name required'),
  searchName: z.string().max(50),
  isBlocked: z.boolean(),
  address: z.string(),
  address2: z.string().optional(),
  contactPhone: phoneDigitsField,
  email: z.string().email('Invalid email').or(z.literal('')),
  pincode: z.string(),
  state: z.string(),
  city: z.string(),
  country: z.string(),
  paymentMethod: z.string(),
  bankDetails: z.string(),
  pan: z.string().max(10).optional(),
  panStatus: z.enum(['pan_applied', 'pan_not_available']),
  gstin: z.string(),
  gstVendorType: z.enum(['registered', 'composite', 'unregistered', 'import', 'exempted', 'sez']),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  const gst = data.gstin.trim().toUpperCase()
  if (gst && (gst.length !== 15 || !GSTIN_RE.test(gst))) {
    ctx.addIssue({ code: 'custom', message: 'GST registration no. must be 15 characters', path: ['gstin'] })
  }
  const pan = data.pan?.trim().toUpperCase() ?? ''
  if (pan && (pan.length !== 10 || !PAN_RE.test(pan))) {
    ctx.addIssue({ code: 'custom', message: 'PAN must be 10 characters', path: ['pan'] })
  }
})

type FormData = z.infer<typeof schema>

export function VendorListPage() {
  const vendors = useMasterStore((s) => s.vendors)
  const deleteVendor = useMasterStore((s) => s.deleteVendor)
  const activateVendor = useMasterStore((s) => s.activateVendor)
  const deactivateVendor = useMasterStore((s) => s.deactivateVendor)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [importOpen, setImportOpen] = useState(false)

  const rows = useMemo(() => vendors.map(enrichVendorWithDefaults), [vendors])

  const filtered = useMemo(
    () =>
      rows.filter(
        (v) =>
          matchesStatusFilter(v.isActive, status) &&
          (v.vendorCode.toLowerCase().includes(search.toLowerCase()) ||
            v.vendorName.toLowerCase().includes(search.toLowerCase()) ||
            v.searchName?.toLowerCase().includes(search.toLowerCase()) ||
            v.gstin.toLowerCase().includes(search.toLowerCase())),
      ),
    [rows, search, status],
  )

  const columns: ColumnDef<Vendor, unknown>[] = [
    { accessorKey: 'vendorCode', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.vendorCode}</span> },
    { accessorKey: 'vendorName', header: 'Vendor Name' },
    { accessorKey: 'searchName', header: 'Search Name', cell: ({ row }) => row.original.searchName ?? '—' },
    { accessorKey: 'city', header: 'City' },
    { id: 'gstType', header: 'GST Vendor Type', cell: ({ row }) => (row.original.gstVendorType ? GST_VENDOR_TYPE_LABELS[row.original.gstVendorType] : '—') },
    { accessorKey: 'gstin', header: 'GST Reg. No.', cell: ({ row }) => row.original.gstin || '—' },
    {
      id: 'blocked',
      header: 'Blocked',
      cell: ({ row }) => (row.original.isBlocked ? <span className="text-xs font-medium text-erp-danger">Yes</span> : <span className="text-xs text-erp-muted">No</span>),
    },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/vendors/${row.original.id}`}
        editTo={`/masters/vendors/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={`${row.original.vendorCode} — ${row.original.vendorName}`}
        isActive={row.original.isActive}
        deleteRecord={deleteVendor}
        activateRecord={activateVendor}
        deactivateRecord={deactivateVendor}
      />
    ) },
  ]

  async function handleExport() {
    if (!isApiMode()) {
      window.alert('Export downloads the current register from the tenant database in API mode.')
      return
    }
    try {
      await downloadMasterExport('vendors', {
        search: search || undefined,
        status: status === 'all' ? undefined : status === 'active' ? 'ACTIVE' : 'INACTIVE',
      })
    } catch (err) {
      window.alert(formatApiError(err))
    }
  }

  return (
    <>
    <MasterListShell
      title="Vendor Master"
      description="Suppliers — Business Central vendor card layout"
      masterGroupId="procurement"
      createLabel="New Vendor"
      createTo="/masters/vendors/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      onImport={() => setImportOpen(true)}
      onExport={() => void handleExport()}
      stats={[
        { label: 'Vendors', value: rows.length },
        { label: 'Registered GST', value: rows.filter((v) => v.gstVendorType === 'registered').length },
        { label: 'Blocked', value: rows.filter((v) => v.isBlocked).length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
    <MasterBatchImportDialog open={importOpen} onClose={() => setImportOpen(false)} resource="vendors" />
    </>
  )
}

export function VendorFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const vendors = useMasterStore((s) => s.vendors)
  const rawExisting = useMasterStore((s) => (id ? s.getVendor(id) : undefined))
  const existing = rawExisting ? enrichVendorWithDefaults(rawExisting) : undefined
  const addVendor = useMasterStore((s) => s.addVendor)
  const updateVendor = useMasterStore((s) => s.updateVendor)
  const vendorOrderAddresses = useMasterStore((s) => s.vendorOrderAddresses)
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  const geoCountries = useMasterStore((s) => s.geoCountries)
  const geoStates = useMasterStore((s) => s.geoStates)
  const geoCities = useMasterStore((s) => s.geoCities)
  const activeBanks = useActiveBanks()
  const isEdit = Boolean(id && existing)

  const linkedOrderAddresses = useMemo(
    () => (id ? vendorOrderAddresses.filter((a) => a.vendorId === id) : []),
    [vendorOrderAddresses, id],
  )
  const session = getSessionUser()
  const [activeSection, setActiveSection] = useState('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          vendorCode: existing.vendorCode,
          vendorName: existing.vendorName,
          searchName: existing.searchName ?? '',
          isBlocked: existing.isBlocked ?? false,
          address: existing.address ?? '',
          address2: existing.address2 ?? '',
          contactPhone: existing.contactPhone ?? '',
          email: existing.email ?? '',
          pincode: existing.pincode ?? '',
          state: existing.state ?? '',
          city: existing.city ?? '',
          country: existing.country ?? DEFAULT_CUSTOMER_COUNTRY,
          paymentMethod: existing.paymentMethod ?? 'NEFT',
          bankDetails: existing.bankDetails ?? '',
          pan: existing.pan ?? '',
          panStatus: existing.panStatus ?? 'pan_applied',
          gstin: existing.gstin ?? '',
          gstVendorType: existing.gstVendorType ?? 'registered',
          isActive: existing.isActive,
        }
      : {
          vendorCode: '',
          vendorName: '',
          searchName: '',
          isBlocked: false,
          address: '',
          address2: '',
          contactPhone: '',
          email: '',
          pincode: '',
          state: '',
          city: '',
          country: DEFAULT_CUSTOMER_COUNTRY,
          paymentMethod: 'NEFT',
          bankDetails: '',
          pan: '',
          panStatus: 'pan_applied' as PanStatus,
          gstin: '',
          gstVendorType: 'registered' as GstVendorType,
          isActive: true,
        },
  })

  const watched = useWatch({ control })

  const generalDone = Boolean(watched.vendorCode?.trim() && watched.vendorName?.trim())
  const addressDone = Boolean(watched.city?.trim() && watched.state?.trim())
  const paymentDone = Boolean(watched.paymentMethod?.trim())
  const taxDone = Boolean(watched.gstVendorType && !errors.gstin && !errors.pan)

  function buildPayload(data: FormData) {
    const gstin = data.gstin.trim().toUpperCase()
    const pan = data.pan?.trim().toUpperCase() || (gstin ? panFromGstin(gstin) : '')
    const searchName = data.searchName?.trim() || data.vendorName.toUpperCase().slice(0, 20)
    const country = geoCountries.find((c) => c.countryName === data.country.trim())
    const state = geoStates.find((s) => s.stateName === data.state.trim())
    const city = geoCities.find(
      (c) => c.cityName === data.city.trim() && (!state || c.stateId === state.id),
    )
    return {
      vendorCode: data.vendorCode.trim().toUpperCase(),
      vendorName: data.vendorName.trim(),
      searchName,
      isBlocked: data.isBlocked,
      address: data.address.trim(),
      address2: data.address2?.trim() || undefined,
      city: data.city.trim(),
      state: data.state.trim(),
      pincode: data.pincode.trim(),
      country: data.country.trim(),
      countryId: country?.id ?? existing?.countryId,
      stateId: state?.id ?? existing?.stateId,
      cityId: city?.id ?? existing?.cityId,
      email: data.email.trim(),
      contactPhone: data.contactPhone.trim(),
      contactPerson: existing?.contactPerson ?? data.vendorName.trim(),
      paymentMethod: data.paymentMethod,
      bankDetails: data.bankDetails.trim(),
      pan: pan || undefined,
      panStatus: data.panStatus,
      gstin,
      gstVendorType: data.gstVendorType,
      isActive: data.isActive,
      vendorType: existing?.vendorType ?? 'manufacturer',
      paymentTermsDays: existing?.paymentTermsDays ?? 30,
      defaultLeadTimeDays: existing?.defaultLeadTimeDays ?? 7,
      suppliedCategories: existing?.suppliedCategories ?? [],
      rating: existing?.rating ?? 4,
    }
  }

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.vendorCode, {
        checkDuplicate: (c) => vendors.some((v) => v.vendorCode === c.toUpperCase() && v.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      const payload = buildPayload(data)
      try {
        let recordId = id
        if (isEdit && id) await resolveMaybeVoid(updateVendor(id, payload))
        else recordId = await resolveMaybeId(addVendor(payload))
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.vendorCode)
        notifyMasterSaved('Vendor', !isEdit)
        if (mode === 'new') { navigate('/masters/vendors/new'); return }
        if (mode === 'close') { navigate('/masters/vendors'); return }
        if (!isEdit && recordId) navigate(`/masters/vendors/${recordId}/edit`, { replace: true })
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/vendors')
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    save('default')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.vendorCode : 'New Vendor'}
      subtitle={existing?.vendorName ?? 'Vendor card — Business Central layout'}
      breadcrumbs={buildMasterBreadcrumbs('procurement', isEdit ? 'Edit Vendor' : 'New Vendor')}
      recordAudit={existing}
      pendingAuditUserName={session.name}
      validationErrors={validationErrors}
      documentStrip={[
        { label: 'Code', value: watched.vendorCode?.trim() || '—', highlight: Boolean(watched.vendorCode?.trim()) },
        { label: 'Vendor Name', value: watched.vendorName?.trim() || '—', highlight: Boolean(watched.vendorName?.trim()) },
        { label: 'Search Name', value: watched.searchName?.trim() || '—' },
        { label: 'Blocked', value: watched.isBlocked ? 'Yes' : 'No' },
        { label: 'GST Type', value: watched.gstVendorType ? GST_VENDOR_TYPE_LABELS[watched.gstVendorType] : '—' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterForm
          listPath="/masters/vendors"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={cancelForm}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: User, done: generalDone },
        { id: 'address', label: 'Address & Contact', icon: MapPin, done: addressDone },
        { id: 'payments', label: 'Payments', icon: CreditCard, done: paymentDone },
        { id: 'tax', label: 'Tax Information', icon: Receipt, done: taxDone },
        { id: 'related', label: 'Related', icon: Landmark, done: false },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'GST Type', value: watched.gstVendorType ? GST_VENDOR_TYPE_LABELS[watched.gstVendorType] : '—', accent: 'blue' as const },
        { label: 'Payment', value: watched.paymentMethod ?? '—', accent: 'violet' as const },
        { label: 'PAN Status', value: watched.panStatus ? PAN_STATUS_LABELS[watched.panStatus] : '—', accent: 'amber' as const },
        { label: 'Blocked', value: watched.isBlocked ? 'Yes' : 'No', accent: watched.isBlocked ? ('amber' as const) : ('green' as const) },
      ]}
      factBoxTitle="Vendor summary"
      factBoxSummary={[
        { label: 'Used in', value: 'Purchase, GRN, Payments' },
        { label: 'Location', value: watched.city && watched.state ? `${watched.city}, ${watched.state}` : '—' },
        { label: 'GSTIN', value: watched.gstin?.length === 15 ? watched.gstin : '—' },
        { label: 'PAN', value: watched.pan || '—' },
        { label: 'Email', value: watched.email || '—' },
        { label: 'Mobile', value: watched.contactPhone || '—' },
      ]}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={cancelForm}
        />
      )}
    >
      <form id="vendor-master-form" onSubmit={submit}>
        <ErpCardSection
          id="vendor-section-general"
          title="General"
          subtitle="Code, name, blocked status, and search name."
          icon={User}
          accent="blue"
          collapsible
          defaultOpen
        >
          <div className="grid gap-4 md:grid-cols-2">
            <MasterCodeField
              entityType="vendor"
              isEdit={isEdit}
              existingCode={existing?.vendorCode}
              value={watched.vendorCode ?? ''}
              onChange={(v) => setValue('vendorCode', v, { shouldValidate: true })}
              onSeriesReady={(h) => { codeSeriesRef.current = h }}
              error={errors.vendorCode?.message}
              required
            />
            <FormField label="Vendor Name" required error={errors.vendorName?.message}>
              <Input
                {...register('vendorName', {
                  onChange: (e) => {
                    if (!watched.searchName?.trim()) {
                      setValue('searchName', e.target.value.toUpperCase().slice(0, 20), { shouldDirty: true })
                    }
                  },
                })}
                placeholder="Precision Axle Works Pvt Ltd"
              />
            </FormField>
            <FormField label="Search Name" hint="Uppercase lookup name on purchase documents">
              <Input {...register('searchName')} className="font-mono uppercase" placeholder="PRECISION AXLE" />
            </FormField>
            <FormField label="Blocked">
              <Checkbox {...register('isBlocked')} label="Blocked — cannot post purchase documents" />
            </FormField>
            <FormField label="Active">
              <Checkbox {...register('isActive')} label="Active vendor" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="vendor-section-address"
          title="Address & Contact"
          subtitle="Postal address, mobile, email, and geography."
          icon={MapPin}
          accent="teal"
          collapsible
          defaultOpen
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Address" className="md:col-span-2">
              <Input {...register('address')} placeholder="Street / plot / MIDC" />
            </FormField>
            <FormField label="Address 2" className="md:col-span-2">
              <Input {...register('address2')} placeholder="Building, floor, landmark" />
            </FormField>
            <FormField label="Mobile No">
              <MobileInput {...register('contactPhone')} placeholder="10-digit mobile" />
            </FormField>
            <FormField label="Email id" error={errors.email?.message}>
              <Input type="email" {...register('email')} placeholder="accounts@vendor.in" />
            </FormField>
            <FormField label="Country">
              <CountrySelect
                value={watched.country ?? DEFAULT_CUSTOMER_COUNTRY}
                onChange={(v) => setValue('country', v, { shouldDirty: true })}
              />
            </FormField>
            <FormField label="State">
              <StateSelect
                value={watched.state ?? ''}
                onChange={(v) => {
                  setValue('state', v, { shouldDirty: true })
                  setValue('city', '', { shouldDirty: true })
                }}
              />
            </FormField>
            <FormField label="City">
              <CitySelect
                stateName={watched.state ?? ''}
                value={watched.city ?? ''}
                onChange={(v) => setValue('city', v, { shouldDirty: true })}
              />
            </FormField>
            <FormField label="Pin code">
              <Input {...register('pincode')} placeholder="6-digit PIN" maxLength={6} />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="vendor-section-payments"
          title="Payments"
          subtitle="Payment method and vendor bank details."
          icon={CreditCard}
          accent="violet"
          collapsible
          defaultOpen
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Payment Method">
              <PaymentMethodSelect
                value={watched.paymentMethod ?? ''}
                onChange={(code) => setValue('paymentMethod', code, { shouldDirty: true })}
              />
            </FormField>
            <FormField label="Vendor Bank Details" className="md:col-span-2">
              <Textarea rows={3} {...register('bankDetails')} placeholder="Bank name, account no., IFSC, branch…" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="vendor-section-tax"
          title="Tax Information"
          subtitle="PAN, GST registration, and vendor GST type."
          icon={Receipt}
          accent="green"
          collapsible
          defaultOpen
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="P.A.N. No" error={errors.pan?.message}>
              <Input {...register('pan')} maxLength={10} className="font-mono uppercase" placeholder="AABCV1234E" />
            </FormField>
            <FormField label="P.A.N. Status">
              <Select {...register('panStatus')}>
                {(Object.entries(PAN_STATUS_LABELS) as [PanStatus, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="GST Registration No." error={errors.gstin?.message}>
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
              />
              <GstinFieldHelper gstin={watched.gstin ?? ''} />
            </FormField>
            <FormField label="GST Vendor Type">
              <Select {...register('gstVendorType')}>
                {(Object.entries(GST_VENDOR_TYPE_LABELS) as [GstVendorType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="vendor-section-related"
          title="Related Records"
          subtitle="Payment method, order address, and bank registers — BC factbox tabs."
          icon={Building2}
          accent="slate"
          collapsible
          defaultOpen
        >
          <div className="col-span-2 overflow-hidden rounded-md border border-erp-border">
            <table className="erp-table w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left">Register</th>
                  <th className="text-left">Value / Status</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="font-medium">Payment Method</td>
                  <td>
                    {watched.paymentMethod ? (
                      <a href="/masters/payment-methods" className="text-erp-primary hover:underline">{watched.paymentMethod}</a>
                    ) : '—'}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">Order Address Code</td>
                  <td>
                    {linkedOrderAddresses.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {linkedOrderAddresses.map((a) => (
                          <a key={a.id} href={`/masters/order-addresses/${a.id}`} className="font-mono text-erp-primary hover:underline">
                            {a.code}
                          </a>
                        ))}
                        <a href={`/masters/order-addresses?vendorId=${id}`} className="text-xs text-erp-muted hover:text-erp-primary">
                          View all
                        </a>
                        <a href={`/masters/order-addresses/new?vendorId=${id}`} className="text-xs text-erp-primary hover:underline">
                          + Add
                        </a>
                      </span>
                    ) : (
                      <a href={id ? `/masters/order-addresses/new?vendorId=${id}` : '/masters/order-addresses'} className="text-erp-primary hover:underline">
                        Add order address
                      </a>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">Bank Account</td>
                  <td>
                    {bankAccounts.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {bankAccounts.slice(0, 3).map((a) => (
                          <a key={a.id} href={`/masters/bank-accounts/${a.id}`} className="font-mono text-erp-primary hover:underline">
                            {a.code}
                          </a>
                        ))}
                        <a href="/masters/bank-accounts" className="text-xs text-erp-muted hover:text-erp-primary">
                          View all ({bankAccounts.length})
                        </a>
                        <a href="/masters/bank-accounts/new" className="text-xs text-erp-primary hover:underline">
                          + Add
                        </a>
                      </span>
                    ) : (
                      <a href="/masters/bank-accounts/new" className="text-erp-primary hover:underline">
                        Add bank account
                      </a>
                    )}
                    {watched.bankDetails?.trim() ? (
                      <p className="mt-1 text-xs text-erp-muted whitespace-pre-wrap">Vendor notes: {watched.bankDetails}</p>
                    ) : null}
                  </td>
                </tr>
                <tr>
                  <td className="font-medium">Bank Master</td>
                  <td>
                    {activeBanks.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {activeBanks.slice(0, 4).map((b) => (
                          <a key={b.id} href={`/masters/banks/${b.id}`} className="font-mono text-erp-primary hover:underline">
                            {b.code}
                          </a>
                        ))}
                        <a href="/masters/banks" className="text-xs text-erp-muted hover:text-erp-primary">
                          View all ({activeBanks.length})
                        </a>
                        <a href="/masters/banks/new" className="text-xs text-erp-primary hover:underline">
                          + Add
                        </a>
                      </span>
                    ) : (
                      <a href="/masters/banks/new" className="text-erp-primary hover:underline">
                        Add bank
                      </a>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function VendorDetailPage() {
  const { id } = useParams()
  const raw = useMasterStore((s) => (id ? s.getVendor(id) : undefined))
  const vendor = raw ? enrichVendorWithDefaults(raw) : undefined
  const allMaps = useMasterStore((s) => s.itemVendorMaps)
  const itemVendorMaps = useMemo(() => allMaps.filter((m) => m.vendorId === id), [allMaps, id])
  const getItem = useMasterStore((s) => s.getItem)

  if (!vendor) return <MasterNotFound message="Vendor not found." />

  const addressLines = [vendor.address, vendor.address2, vendor.city, vendor.state, vendor.pincode, vendor.country].filter(Boolean)

  return (
    <DetailLayout
      backTo="/masters/vendors"
      backLabel="Vendor Master"
      masterGroupId="procurement"
      title={vendor.vendorName}
      subtitle={vendor.vendorCode}
      editTo={`/masters/vendors/${vendor.id}/edit`}
      badges={
        <>
          {vendor.isBlocked ? <span className="rounded bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Blocked</span> : null}
          <ActiveBadge isActive={vendor.isActive} />
        </>
      }
    >
      <div className="space-y-6">
        <DetailSection title="General">
          <DetailGrid>
            <DetailField label="Code" value={<span className="font-mono">{vendor.vendorCode}</span>} />
            <DetailField label="Search Name" value={vendor.searchName ?? '—'} />
            <DetailField label="Blocked" value={vendor.isBlocked ? 'Yes' : 'No'} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Address & Contact">
          <DetailGrid>
            <DetailField label="Address" value={<span className="whitespace-pre-line">{addressLines.join('\n') || '—'}</span>} />
            <DetailField label="Mobile No" value={vendor.contactPhone || '—'} />
            <DetailField label="Email id" value={vendor.email || '—'} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Payments">
          <DetailGrid>
            <DetailField label="Payment Method" value={vendor.paymentMethod ?? '—'} />
            <DetailField label="Vendor Bank Details" value={vendor.bankDetails || '—'} />
          </DetailGrid>
        </DetailSection>
        <DetailSection title="Tax Information">
          <DetailGrid>
            <DetailField label="P.A.N. No" value={vendor.pan || '—'} />
            <DetailField label="P.A.N. Status" value={vendor.panStatus ? PAN_STATUS_LABELS[vendor.panStatus] : '—'} />
            <DetailField label="GST Registration No." value={vendor.gstin || '—'} />
            <DetailField label="GST Vendor Type" value={vendor.gstVendorType ? GST_VENDOR_TYPE_LABELS[vendor.gstVendorType] : '—'} />
          </DetailGrid>
        </DetailSection>
        {itemVendorMaps.length > 0 ? (
          <DetailSection title="Supplied Items">
            <table className="erp-table">
              <thead><tr><th>Item Code</th><th>Item Name</th><th>Lead Days</th><th>Last Rate</th></tr></thead>
              <tbody>
                {itemVendorMaps.map((m) => {
                  const item = getItem(m.itemId)
                  return (
                    <tr key={m.id}>
                      <td className="font-mono text-xs">{item?.itemCode}</td>
                      <td>{item?.itemName}</td>
                      <td>{m.leadTimeDays} days</td>
                      <td>₹{m.lastRate.toLocaleString('en-IN')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DetailSection>
        ) : null}
      </div>
    </DetailLayout>
  )
}
