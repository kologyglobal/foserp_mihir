import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreditCard, Landmark, Settings2 } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import {
  PAYMENT_BAL_ACCOUNT_TYPE_LABELS,
  type PaymentBalanceAccountType,
  type PaymentMethod,
} from '../../../types/paymentMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const schema = z.object({
  code: z.string().min(1, 'Code required').max(10),
  description: z.string().min(1, 'Description required'),
  balAccountType: z.enum(['gl_account', 'bank_account']),
  balAccountNo: z.string().min(1, 'Bal. Account No. required'),
  directDebit: z.boolean(),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function PaymentMethodListPage() {
  const paymentMethods = useMasterStore((s) => s.paymentMethods)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      paymentMethods.filter(
        (p) =>
          matchesStatusFilter(p.isActive, status) &&
          (p.code.toLowerCase().includes(search.toLowerCase()) ||
            p.description.toLowerCase().includes(search.toLowerCase()) ||
            p.balAccountNo.toLowerCase().includes(search.toLowerCase())),
      ),
    [paymentMethods, search, status],
  )

  const columns: ColumnDef<PaymentMethod, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span> },
    { accessorKey: 'description', header: 'Description' },
    { id: 'balType', header: 'Bal. Account Type', cell: ({ row }) => PAYMENT_BAL_ACCOUNT_TYPE_LABELS[row.original.balAccountType] },
    { accessorKey: 'balAccountNo', header: 'Bal. Account No.', cell: ({ row }) => <span className="font-mono text-xs">{row.original.balAccountNo}</span> },
    { id: 'directDebit', header: 'Direct Debit', cell: ({ row }) => (row.original.directDebit ? 'Yes' : 'No') },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={`/masters/payment-methods/${row.original.id}`} editTo={`/masters/payment-methods/${row.original.id}/edit`} /> },
  ]

  return (
    <MasterListShell
      title="Payment Method"
      description="Business Central payment methods for vendors, purchase, and payments"
      masterGroupId="procurement"
      createLabel="New Payment Method"
      createTo="/masters/payment-methods/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Methods', value: paymentMethods.length },
        { label: 'Direct Debit', value: paymentMethods.filter((p) => p.directDebit).length },
        { label: 'Active', value: paymentMethods.filter((p) => p.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function PaymentMethodFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getPaymentMethod(id) : undefined))
  const addPaymentMethod = useMasterStore((s) => s.addPaymentMethod)
  const updatePaymentMethod = useMasterStore((s) => s.updatePaymentMethod)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing ?? {
      code: '',
      description: '',
      balAccountType: 'bank_account' as PaymentBalanceAccountType,
      balAccountNo: 'BANK-MAIN',
      directDebit: false,
      isActive: true,
    },
  })

  const watched = useWatch({ control })

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit((data) => {
      const payload = {
        ...data,
        code: data.code.trim().toUpperCase(),
        description: data.description.trim(),
        balAccountNo: data.balAccountNo.trim().toUpperCase(),
      }
      let recordId = id
      if (isEdit && id) updatePaymentMethod(id, payload)
      else recordId = addPaymentMethod(payload)
      if (mode === 'new') { navigate('/masters/payment-methods/new'); return }
      if (mode === 'close') { navigate('/masters/payment-methods'); return }
      if (!isEdit && recordId) navigate(`/masters/payment-methods/${recordId}/edit`, { replace: true })
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    save('default')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.code : 'New Payment Method'}
      subtitle={existing?.description ?? 'Payment method card — Business Central'}
      breadcrumbs={buildMasterBreadcrumbs('procurement', isEdit ? 'Edit Payment Method' : 'New Payment Method')}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—', highlight: Boolean(watched.code?.trim()) },
        { label: 'Description', value: watched.description?.trim() || '—' },
        { label: 'Bal. Account Type', value: watched.balAccountType ? PAYMENT_BAL_ACCOUNT_TYPE_LABELS[watched.balAccountType] : '—' },
        { label: 'Bal. Account No.', value: watched.balAccountNo?.trim() || '—' },
        { label: 'Direct Debit', value: watched.directDebit ? 'Yes' : 'No' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterForm
          listPath="/masters/payment-methods"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/payment-methods')}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: CreditCard, done: Boolean(watched.code?.trim() && watched.description?.trim()) },
        { id: 'posting', label: 'Posting', icon: Landmark, done: Boolean(watched.balAccountNo?.trim()) },
        { id: 'setup', label: 'Setup', icon: Settings2, done: true },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Account Type', value: watched.balAccountType ? PAYMENT_BAL_ACCOUNT_TYPE_LABELS[watched.balAccountType] : '—', accent: 'blue' as const },
        { label: 'Account No.', value: watched.balAccountNo ?? '—', accent: 'violet' as const },
        { label: 'Direct Debit', value: watched.directDebit ? 'Yes' : 'No', accent: 'amber' as const },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive', accent: watched.isActive ? ('green' as const) : ('amber' as const) },
      ]}
      factBoxTitle="Payment method"
      factBoxSummary={[
        { label: 'Used on', value: 'Vendor, Purchase Invoice, Payments' },
        { label: 'Code', value: watched.code || '—' },
        { label: 'Posting', value: watched.balAccountType && watched.balAccountNo ? `${PAYMENT_BAL_ACCOUNT_TYPE_LABELS[watched.balAccountType]} · ${watched.balAccountNo}` : '—' },
        { label: 'Modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/payment-methods')}
        />
      )}
    >
      <form id="payment-method-form" onSubmit={submit}>
        <ErpCardSection id="pay-section-general" title="General" subtitle="Code and description." icon={CreditCard} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Code" required error={errors.code?.message} hint="Max 10 characters — e.g. NEFT, CHEQUE">
              <Input {...register('code')} disabled={isEdit} className="font-mono uppercase" maxLength={10} placeholder="NEFT" />
            </FormField>
            <FormField label="Description" required error={errors.description?.message}>
              <Input {...register('description')} placeholder="NEFT Bank Transfer" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="pay-section-posting" title="Posting" subtitle="Balance account type and number for payment posting." icon={Landmark} accent="violet" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Bal. Account Type" required>
              <Select {...register('balAccountType')}>
                {(Object.entries(PAYMENT_BAL_ACCOUNT_TYPE_LABELS) as [PaymentBalanceAccountType, string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Bal. Account No." required error={errors.balAccountNo?.message}>
              <Input {...register('balAccountNo')} className="font-mono uppercase" placeholder="BANK-MAIN" />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="pay-section-setup" title="Setup" subtitle="Direct debit and status." icon={Settings2} accent="slate" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Direct Debit">
              <Checkbox {...register('directDebit')} label="Direct Debit payment method" />
            </FormField>
            <FormField label="Active">
              <Checkbox {...register('isActive')} label="Active — available on vendor and purchase documents" />
            </FormField>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function PaymentMethodDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getPaymentMethod(id) : undefined))
  if (!record) return <MasterNotFound message="Payment method not found." />

  return (
    <DetailLayout
      backTo="/masters/payment-methods"
      backLabel="Payment Methods"
      masterGroupId="procurement"
      title={record.description}
      subtitle={record.code}
      editTo={`/masters/payment-methods/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{record.code}</span>} />
          <DetailField label="Description" value={record.description} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Posting">
        <DetailGrid>
          <DetailField label="Bal. Account Type" value={PAYMENT_BAL_ACCOUNT_TYPE_LABELS[record.balAccountType]} />
          <DetailField label="Bal. Account No." value={<span className="font-mono">{record.balAccountNo}</span>} />
          <DetailField label="Direct Debit" value={record.directDebit ? 'Yes' : 'No'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
