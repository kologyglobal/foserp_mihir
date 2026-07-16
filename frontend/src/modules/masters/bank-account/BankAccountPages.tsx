import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Banknote, Landmark, MapPin, Phone } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { BankMasterSelect } from '../../../components/masters/BankMasterSelect'
import { CurrencyCodeSelect } from '../../../components/masters/CurrencyCodeSelect'
import { StateSelect, CitySelect, CountrySelect } from '../../../components/masters/GeographySelects'
import { DEFAULT_CUSTOMER_COUNTRY } from '../../../config/countries'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Checkbox, MobileInput } from '../../../components/forms/Inputs'
import { phoneDigitsField } from '../../../utils/phoneValidationZod'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useActiveBanks } from '../../../hooks/useMasterLists'
import { useMasterStore } from '../../../store/masterStore'
import type { BankAccount } from '../../../types/bankMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const IFSC_RE = /^[A-Z]{4}0[A-Z0-9]{6}$/

const schema = z.object({
  code: z.string().min(1, 'Code required').max(20),
  bankId: z.string().min(1, 'Bank name required'),
  address: z.string().min(1, 'Address required'),
  address2: z.string(),
  postCode: z.string(),
  city: z.string().min(1, 'City required'),
  state: z.string().min(1, 'State required'),
  country: z.string().min(1, 'Country required'),
  phone: phoneDigitsField,
  email: z.string().email('Valid email required').or(z.literal('')),
  currencyCode: z.string().min(1, 'Currency code required'),
  bankAccountName: z.string().min(1, 'Bank account name required'),
  bankAccountNo: z.string().min(1, 'Bank account no. required'),
  bankBranchCode: z.string(),
  ifscCode: z.string(),
  isActive: z.boolean(),
}).superRefine((data, ctx) => {
  const ifsc = data.ifscCode.trim().toUpperCase()
  if (ifsc && (ifsc.length !== 11 || !IFSC_RE.test(ifsc))) {
    ctx.addIssue({ code: 'custom', message: 'IFSC must be 11 characters (e.g. HDFC0001234)', path: ['ifscCode'] })
  }
})

type FormData = z.infer<typeof schema>

export function BankAccountListPage() {
  const [searchParams] = useSearchParams()
  const presetBankId = searchParams.get('bankId') ?? 'all'
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  const getBank = useMasterStore((s) => s.getBank)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [bankFilter, setBankFilter] = useState(presetBankId)

  const filtered = useMemo(
    () =>
      bankAccounts.filter((a) => {
        const bank = getBank(a.bankId)
        const q = search.toLowerCase()
        return (
          matchesStatusFilter(a.isActive, status) &&
          (bankFilter === 'all' || a.bankId === bankFilter) &&
          (a.code.toLowerCase().includes(q) ||
            a.bankAccountName.toLowerCase().includes(q) ||
            a.bankAccountNo.toLowerCase().includes(q) ||
            a.ifscCode.toLowerCase().includes(q) ||
            bank?.name.toLowerCase().includes(q) ||
            bank?.code.toLowerCase().includes(q))
        )
      }),
    [bankAccounts, search, status, bankFilter, getBank],
  )

  const banks = useActiveBanks()

  const columns: ColumnDef<BankAccount, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span> },
    { id: 'bank', header: 'Bank Name', cell: ({ row }) => getBank(row.original.bankId)?.name ?? '—' },
    { accessorKey: 'bankAccountName', header: 'Bank Account Name' },
    { accessorKey: 'bankAccountNo', header: 'Account No.', cell: ({ row }) => <span className="font-mono text-xs">{row.original.bankAccountNo}</span> },
    { accessorKey: 'ifscCode', header: 'IFSC', cell: ({ row }) => <span className="font-mono text-xs">{row.original.ifscCode || '—'}</span> },
    { accessorKey: 'currencyCode', header: 'Currency' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={`/masters/bank-accounts/${row.original.id}`} editTo={`/masters/bank-accounts/${row.original.id}/edit`} /> },
  ]

  return (
    <MasterListShell
      title="Bank Account"
      description="Business Central bank account card — treasury and payment posting accounts"
      masterGroupId="procurement"
      createLabel="New Bank Account"
      createTo="/masters/bank-accounts/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={(
        <select
          value={bankFilter}
          onChange={(e) => setBankFilter(e.target.value)}
          className="erp-input w-44 text-sm"
        >
          <option value="all">All Banks</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>{b.code}</option>
          ))}
        </select>
      )}
      stats={[
        { label: 'Accounts', value: bankAccounts.length },
        { label: 'INR', value: bankAccounts.filter((a) => a.currencyCode === 'INR').length },
        { label: 'Active', value: bankAccounts.filter((a) => a.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function BankAccountFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetBankId = searchParams.get('bankId') ?? ''
  const existing = useMasterStore((s) => (id ? s.getBankAccount(id) : undefined))
  const getBank = useMasterStore((s) => s.getBank)
  const addBankAccount = useMasterStore((s) => s.addBankAccount)
  const updateBankAccount = useMasterStore((s) => s.updateBankAccount)
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
          code: '',
          bankId: presetBankId,
          address: '',
          address2: '',
          postCode: '',
          city: '',
          state: '',
          country: DEFAULT_CUSTOMER_COUNTRY,
          phone: '',
          email: '',
          currencyCode: 'INR',
          bankAccountName: '',
          bankAccountNo: '',
          bankBranchCode: '',
          ifscCode: '',
          isActive: true,
        },
  })

  const watched = useWatch({ control })
  const bank = watched.bankId ? getBank(watched.bankId) : undefined

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit((data) => {
      const payload = {
        ...data,
        code: data.code.trim().toUpperCase(),
        ifscCode: data.ifscCode.trim().toUpperCase(),
        address2: data.address2?.trim() || undefined,
        email: data.email.trim(),
      }
      let recordId = id
      if (isEdit && id) updateBankAccount(id, payload)
      else recordId = addBankAccount(payload)
      if (mode === 'new') { navigate('/masters/bank-accounts/new'); return }
      if (mode === 'close') { navigate('/masters/bank-accounts'); return }
      if (!isEdit && recordId) navigate(`/masters/bank-accounts/${recordId}/edit`, { replace: true })
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    save('default')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? `${existing!.code}` : 'New Bank Account'}
      subtitle={bank ? `${bank.code} — ${watched.bankAccountName || 'Bank account'}` : 'Bank account card'}
      breadcrumbs={buildMasterBreadcrumbs('procurement', isEdit ? 'Edit Bank Account' : 'New Bank Account')}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—' },
        { label: 'Bank', value: bank?.code ?? '—', highlight: Boolean(bank) },
        { label: 'Account Name', value: watched.bankAccountName?.trim() || '—' },
        { label: 'Account No.', value: watched.bankAccountNo?.trim() || '—' },
        { label: 'IFSC', value: watched.ifscCode?.trim() || '—' },
        { label: 'Currency', value: watched.currencyCode || '—' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterForm
          listPath="/masters/bank-accounts"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/bank-accounts')}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: Landmark, done: Boolean(watched.code?.trim() && watched.bankId && watched.bankAccountName?.trim()) },
        { id: 'address', label: 'Address', icon: MapPin, done: Boolean(watched.address?.trim() && watched.city?.trim() && watched.state?.trim()) },
        { id: 'banking', label: 'Banking', icon: Banknote, done: Boolean(watched.bankAccountNo?.trim() && watched.currencyCode) },
        { id: 'contact', label: 'Contact', icon: Phone, done: Boolean(watched.phone?.trim() || watched.email?.trim()) },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Bank', value: bank?.code ?? '—', accent: 'blue' as const },
        { label: 'Currency', value: watched.currencyCode || '—', accent: 'violet' as const },
        { label: 'IFSC', value: watched.ifscCode || '—', accent: 'amber' as const },
        { label: 'Active', value: watched.isActive ? 'Yes' : 'No', accent: watched.isActive ? ('green' as const) : ('amber' as const) },
      ]}
      factBoxTitle="Bank account"
      factBoxSummary={[
        { label: 'Used on', value: 'Payment Method, Vendor, Treasury' },
        { label: 'Bank', value: bank?.name ?? '—' },
        { label: 'Branch', value: watched.bankBranchCode || '—' },
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
          onCancel={() => navigate('/masters/bank-accounts')}
        />
      )}
    >
      <form id="bank-account-form" onSubmit={submit}>
        <ErpCardSection id="ba-section-general" title="General" subtitle="Code, bank name, currency, and account name." icon={Landmark} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Code" required error={errors.code?.message} hint="Max 20 characters">
              <Input {...register('code')} className="font-mono uppercase" maxLength={20} placeholder="BANK-MAIN" />
            </FormField>
            <FormField label="Bank Name" required error={errors.bankId?.message}>
              <BankMasterSelect
                value={watched.bankId ?? ''}
                onChange={(v) => setValue('bankId', v, { shouldValidate: true, shouldDirty: true })}
              />
            </FormField>
            <FormField label="Currency code" required error={errors.currencyCode?.message}>
              <CurrencyCodeSelect
                value={watched.currencyCode ?? 'INR'}
                onChange={(v) => setValue('currencyCode', v, { shouldValidate: true, shouldDirty: true })}
              />
            </FormField>
            <FormField label="Bank Account Name" required error={errors.bankAccountName?.message}>
              <Input {...register('bankAccountName')} placeholder="Account holder / company name" />
            </FormField>
            <FormField label="Active" className="md:col-span-2">
              <Checkbox {...register('isActive')} label="Active bank account" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="ba-section-address" title="Address" subtitle="Bank branch address — street, city, state, post code, country." icon={MapPin} accent="teal" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Address" required error={errors.address?.message} className="md:col-span-2">
              <Input {...register('address')} placeholder="Street / branch address" />
            </FormField>
            <FormField label="Address 2" className="md:col-span-2">
              <Input {...register('address2')} placeholder="Building, floor, landmark" />
            </FormField>
            <FormField label="Post code">
              <Input {...register('postCode')} placeholder="6-digit PIN" maxLength={6} />
            </FormField>
            <FormField label="Country" required error={errors.country?.message}>
              <CountrySelect value={watched.country ?? DEFAULT_CUSTOMER_COUNTRY} onChange={(v) => setValue('country', v, { shouldDirty: true, shouldValidate: true })} />
            </FormField>
            <FormField label="State" required error={errors.state?.message}>
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
          </div>
        </ErpCardSection>

        <ErpCardSection id="ba-section-contact" title="Contact" subtitle="Phone and email for the bank branch." icon={Phone} accent="green" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Phone no">
              <MobileInput {...register('phone')} placeholder="Digits only" />
            </FormField>
            <FormField label="Email id" error={errors.email?.message}>
              <Input type="email" {...register('email')} placeholder="branch@bank.in" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="ba-section-banking" title="Banking Details" subtitle="Account number, branch code, and IFSC." icon={Banknote} accent="violet" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Bank Account No" required error={errors.bankAccountNo?.message}>
              <Input {...register('bankAccountNo')} className="font-mono" placeholder="Account number" />
            </FormField>
            <FormField label="Bank Branch code">
              <Input {...register('bankBranchCode')} className="font-mono" placeholder="Branch code" />
            </FormField>
            <FormField label="Bank IFSC code" error={errors.ifscCode?.message} className="md:col-span-2">
              <Input
                {...register('ifscCode', {
                  onChange: (e) => setValue('ifscCode', e.target.value.toUpperCase().replace(/\s/g, ''), { shouldDirty: true, shouldValidate: true }),
                })}
                maxLength={11}
                className="font-mono uppercase"
                placeholder="HDFC0001234"
              />
            </FormField>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function BankAccountDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getBankAccount(id) : undefined))
  const getBank = useMasterStore((s) => s.getBank)
  if (!record) return <MasterNotFound message="Bank account not found." />

  const bank = getBank(record.bankId)
  const addressLines = [record.address, record.address2, record.city, record.state, record.postCode, record.country].filter(Boolean)

  return (
    <DetailLayout
      backTo="/masters/bank-accounts"
      backLabel="Bank Accounts"
      masterGroupId="procurement"
      title={`${record.code} — ${record.bankAccountName}`}
      subtitle={bank ? `${bank.code} · ${bank.name}` : '—'}
      editTo={`/masters/bank-accounts/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{record.code}</span>} />
          <DetailField label="Bank Name" value={bank ? <Link to={`/masters/banks/${bank.id}`} className="text-erp-primary hover:underline">{bank.name}</Link> : '—'} />
          <DetailField label="Currency code" value={record.currencyCode} />
          <DetailField label="Bank Account Name" value={record.bankAccountName} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Address">
        <DetailGrid>
          <DetailField label="Address" value={<span className="whitespace-pre-line">{addressLines.join('\n')}</span>} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Contact">
        <DetailGrid>
          <DetailField label="Phone no" value={record.phone || '—'} />
          <DetailField label="Email id" value={record.email || '—'} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Banking Details">
        <DetailGrid>
          <DetailField label="Bank Account No" value={<span className="font-mono">{record.bankAccountNo}</span>} />
          <DetailField label="Bank Branch code" value={record.bankBranchCode || '—'} />
          <DetailField label="Bank IFSC code" value={record.ifscCode || '—'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
