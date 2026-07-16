import { useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Building2, Landmark, Settings2 } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Checkbox } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import type { Bank } from '../../../types/bankMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'

const schema = z.object({
  code: z.string().min(1, 'Code required').max(10),
  name: z.string().min(1, 'Name required'),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function BankListPage() {
  const banks = useMasterStore((s) => s.banks)
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const accountCountByBank = useMemo(() => {
    const map = new Map<string, number>()
    for (const a of bankAccounts) {
      map.set(a.bankId, (map.get(a.bankId) ?? 0) + 1)
    }
    return map
  }, [bankAccounts])

  const filtered = useMemo(
    () =>
      banks.filter(
        (b) =>
          matchesStatusFilter(b.isActive, status) &&
          (b.code.toLowerCase().includes(search.toLowerCase()) ||
            b.name.toLowerCase().includes(search.toLowerCase())),
      ),
    [banks, search, status],
  )

  const columns: ColumnDef<Bank, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.code}</span> },
    { accessorKey: 'name', header: 'Name' },
    {
      id: 'accounts',
      header: 'Bank Accounts',
      cell: ({ row }) => {
        const count = accountCountByBank.get(row.original.id) ?? 0
        return count > 0 ? (
          <Link to={`/masters/bank-accounts?bankId=${row.original.id}`} className="text-erp-primary hover:underline">
            {count} account{count === 1 ? '' : 's'}
          </Link>
        ) : (
          <span className="text-erp-muted">—</span>
        )
      },
    },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={`/masters/banks/${row.original.id}`} editTo={`/masters/banks/${row.original.id}/edit`} /> },
  ]

  return (
    <MasterListShell
      title="Bank Master"
      description="Business Central bank register — lookup for bank account cards"
      masterGroupId="procurement"
      createLabel="New Bank"
      createTo="/masters/banks/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Banks', value: banks.length },
        { label: 'With Accounts', value: banks.filter((b) => (accountCountByBank.get(b.id) ?? 0) > 0).length },
        { label: 'Active', value: banks.filter((b) => b.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function BankFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getBank(id) : undefined))
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  const addBank = useMasterStore((s) => s.addBank)
  const updateBank = useMasterStore((s) => s.updateBank)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')

  const linkedAccounts = useMemo(
    () => (id ? bankAccounts.filter((a) => a.bankId === id) : []),
    [bankAccounts, id],
  )

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing ?? {
      code: '',
      name: '',
      isActive: true,
    },
  })

  const watched = useWatch({ control })

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit((data) => {
      const payload = {
        ...data,
        code: data.code.trim().toUpperCase(),
        name: data.name.trim(),
      }
      let recordId = id
      if (isEdit && id) updateBank(id, payload)
      else recordId = addBank(payload)
      if (mode === 'new') { navigate('/masters/banks/new'); return }
      if (mode === 'close') { navigate('/masters/banks'); return }
      if (!isEdit && recordId) navigate(`/masters/banks/${recordId}/edit`, { replace: true })
    })()
  }

  const submit = (e?: FormEvent) => {
    e?.preventDefault()
    save('default')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.code : 'New Bank'}
      subtitle={watched.name?.trim() || 'Bank master card — Business Central'}
      breadcrumbs={buildMasterBreadcrumbs('procurement', isEdit ? 'Edit Bank' : 'New Bank')}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—', highlight: Boolean(watched.code?.trim()) },
        { label: 'Name', value: watched.name?.trim() || '—' },
        { label: 'Accounts', value: linkedAccounts.length > 0 ? String(linkedAccounts.length) : '—' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={(
        <MasterForm
          listPath="/masters/banks"
          isEdit={isEdit}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/banks')}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: Building2, done: Boolean(watched.code?.trim() && watched.name?.trim()) },
        { id: 'related', label: 'Related', icon: Landmark, done: linkedAccounts.length > 0 },
        { id: 'setup', label: 'Setup', icon: Settings2, done: true },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Code', value: watched.code || '—', accent: 'blue' as const },
        { label: 'Accounts', value: linkedAccounts.length > 0 ? String(linkedAccounts.length) : '—', accent: 'violet' as const },
        { label: 'Active', value: watched.isActive ? 'Yes' : 'No', accent: watched.isActive ? ('green' as const) : ('amber' as const) },
      ]}
      factBoxTitle="Bank"
      factBoxSummary={[
        { label: 'Used on', value: 'Bank Account, Vendor, Payments' },
        { label: 'Code', value: watched.code || '—' },
        { label: 'Name', value: watched.name || '—' },
        { label: 'Modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={() => navigate('/masters/banks')}
        />
      )}
    >
      <form id="bank-form" onSubmit={submit}>
        <ErpCardSection id="bank-section-general" title="General" subtitle="Bank code and name." icon={Building2} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Code" required error={errors.code?.message} hint="Max 10 characters — e.g. HDFC, ICICI">
              <Input {...register('code')} disabled={isEdit} className="font-mono uppercase" maxLength={10} placeholder="HDFC" />
            </FormField>
            <FormField label="Name" required error={errors.name?.message} className="md:col-span-2">
              <Input {...register('name')} placeholder="HDFC Bank Ltd." />
            </FormField>
          </div>
        </ErpCardSection>

        <ErpCardSection id="bank-section-related" title="Related Records" subtitle="Bank accounts linked to this bank." icon={Landmark} accent="violet" collapsible defaultOpen>
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
                  <td className="font-medium">Bank Account</td>
                  <td>
                    {linkedAccounts.length > 0 ? (
                      <span className="flex flex-wrap items-center gap-2">
                        {linkedAccounts.map((a) => (
                          <a key={a.id} href={`/masters/bank-accounts/${a.id}`} className="font-mono text-erp-primary hover:underline">
                            {a.code}
                          </a>
                        ))}
                        {id ? (
                          <a href={`/masters/bank-accounts/new?bankId=${id}`} className="text-xs text-erp-primary hover:underline">
                            + Add
                          </a>
                        ) : null}
                      </span>
                    ) : id ? (
                      <a href={`/masters/bank-accounts/new?bankId=${id}`} className="text-erp-primary hover:underline">
                        Add bank account
                      </a>
                    ) : (
                      <span className="text-erp-muted">Save bank first to link accounts</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </ErpCardSection>

        <ErpCardSection id="bank-section-setup" title="Setup" subtitle="Active status." icon={Settings2} accent="slate" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Active">
              <Checkbox {...register('isActive')} label="Active — available on bank account cards" />
            </FormField>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function BankDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getBank(id) : undefined))
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  if (!record) return <MasterNotFound message="Bank not found." />

  const linkedAccounts = bankAccounts.filter((a) => a.bankId === record.id)

  return (
    <DetailLayout
      backTo="/masters/banks"
      backLabel="Bank Master"
      masterGroupId="procurement"
      title={record.name}
      subtitle={record.code}
      editTo={`/masters/banks/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
    >
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={<span className="font-mono">{record.code}</span>} />
          <DetailField label="Name" value={record.name} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Related Records">
        <DetailGrid>
          <DetailField
            label="Bank Accounts"
            value={
              linkedAccounts.length > 0 ? (
                <span className="flex flex-wrap gap-2">
                  {linkedAccounts.map((a) => (
                    <Link key={a.id} to={`/masters/bank-accounts/${a.id}`} className="font-mono text-erp-primary hover:underline">
                      {a.code}
                    </Link>
                  ))}
                </span>
              ) : (
                '—'
              )
            }
          />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
