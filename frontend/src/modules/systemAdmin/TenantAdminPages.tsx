import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { ShieldX, Eye, Pencil, Power, PowerOff, Trash2 } from 'lucide-react'
import { MasterRegisterTable } from '../../components/masters/MasterRegisterTable'
import { MasterListShell, STATUS_FILTER_OPTIONS } from '../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../components/masters/MasterLayouts'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/forms/FormField'
import { Input, Select } from '../../components/forms/Inputs'
import { EnterpriseRowActionsMenu, type RowActionItem } from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { MasterLifecycleDialog } from '../../components/masters/MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import { useAdminStore } from '../../store/adminStore'
import { resolveStoreAction, type MaybePromise, type StoreActionResult } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { isSuperAdminUser } from '../../utils/permissions'
import type { AdminTenantStatus } from '../../types/admin'

const STATUS_COLOR: Record<AdminTenantStatus, 'green' | 'gray' | 'yellow' | 'red'> = {
  ACTIVE: 'green',
  TRIAL: 'yellow',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
  ARCHIVED: 'gray',
}

function TenantStatusBadge({ status }: { status: AdminTenantStatus }) {
  return <Badge color={STATUS_COLOR[status]}>{status}</Badge>
}

function SuperAdminOnlyNotice() {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
      <ShieldX className="h-14 w-14 text-rose-500" />
      <h1 className="text-xl font-semibold text-slate-900">Super Admin Required</h1>
      <p className="text-sm text-slate-600">
        Tenant / workspace administration is available to platform Super Admins only. Contact your platform
        administrator if you need access.
      </p>
    </div>
  )
}

function wrapVoid(fn: (id: string) => MaybePromise<StoreActionResult>) {
  return async (id: string) => {
    const res = await resolveStoreAction(fn(id))
    if (!res.ok) throw new Error(res.error ?? 'Operation failed')
  }
}

function TenantRowActions({ tenantId, status }: { tenantId: string; status: AdminTenantStatus }) {
  const deleteTenant = useAdminStore((s) => s.deleteTenant)
  const updateTenant = useAdminStore((s) => s.updateTenant)
  const activate = (id: string) => updateTenant(id, { status: 'ACTIVE' })
  const deactivate = (id: string) => updateTenant(id, { status: 'SUSPENDED' })
  const lifecycle = useMasterLifecycle({
    delete: wrapVoid(deleteTenant),
    activate: wrapVoid(activate),
    deactivate: wrapVoid(deactivate),
  })

  const actions: RowActionItem[] = [
    { id: 'view', label: 'View', icon: Eye, to: `/admin/tenants/${tenantId}` },
    { id: 'edit', label: 'Edit', icon: Pencil, to: `/admin/tenants/${tenantId}/edit` },
  ]
  if (status === 'ACTIVE') {
    actions.push({ id: 'suspend', label: 'Suspend', icon: PowerOff, onClick: () => lifecycle.open('deactivate', tenantId, 'Tenant') })
  } else if (status !== 'ARCHIVED') {
    actions.push({ id: 'activate', label: 'Activate', icon: Power, onClick: () => lifecycle.open('activate', tenantId, 'Tenant') })
  }
  if (status !== 'ARCHIVED') {
    actions.push({ id: 'delete', label: 'Archive Tenant', icon: Trash2, danger: true, separator: true, onClick: () => lifecycle.open('delete', tenantId, 'Tenant') })
  }

  return (
    <>
      <EnterpriseRowActionsMenu actions={actions} />
      <MasterLifecycleDialog
        open={Boolean(lifecycle.dialog)}
        action={lifecycle.dialog?.action ?? 'delete'}
        recordLabel={lifecycle.dialog?.label ?? 'Tenant'}
        error={lifecycle.error}
        pending={lifecycle.pending}
        onConfirm={() => void lifecycle.confirm()}
        onCancel={lifecycle.close}
      />
    </>
  )
}

export function TenantAdminListPage() {
  const tenants = useAdminStore((s) => s.tenants)
  const isSuperAdmin = isSuperAdminUser()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      tenants.filter((t) => {
        const s = search.toLowerCase()
        const statusOk =
          status === 'all' ||
          (status === 'active' && t.status === 'ACTIVE') ||
          (status === 'inactive' && t.status !== 'ACTIVE')
        return statusOk && (t.name.toLowerCase().includes(s) || t.slug.toLowerCase().includes(s) || t.email.toLowerCase().includes(s))
      }),
    [tenants, search, status],
  )

  if (!isSuperAdmin) return <SuperAdminOnlyNotice />

  const columns: ColumnDef<typeof tenants[number], unknown>[] = [
    {
      id: 'name',
      header: 'Tenant',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-erp-text">{row.original.name}</div>
          <div className="text-xs text-erp-muted">{row.original.slug}</div>
        </div>
      ),
    },
    { accessorKey: 'email', header: 'Admin Email' },
    { id: 'plan', header: 'Plan', accessorKey: 'subscriptionPlan' },
    { id: 'status', header: 'Status', cell: ({ row }) => <TenantStatusBadge status={row.original.status} /> },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => <TenantRowActions tenantId={row.original.id} status={row.original.status} />,
    },
  ]

  return (
    <MasterListShell
      title="Tenants"
      description="Manage platform tenant workspaces and subscriptions"
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Tenants' }]}
      favoritePath="/admin/tenants"
      createLabel="New Tenant"
      createTo="/admin/tenants/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Tenants', value: tenants.length },
        { label: 'Active', value: tenants.filter((t) => t.status === 'ACTIVE').length, accent: 'green' },
        { label: 'Trial', value: tenants.filter((t) => t.status === 'TRIAL').length, accent: 'amber' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

interface TenantFormState {
  name: string
  slug: string
  legalName: string
  email: string
  phone: string
  country: string
  state: string
  city: string
  timezone: string
  currency: string
  status: AdminTenantStatus
  subscriptionPlan: string
  adminFirstName: string
  adminLastName: string
  adminEmail: string
  adminPassword: string
  adminMobile: string
}

const EMPTY_FORM: TenantFormState = {
  name: '',
  slug: '',
  legalName: '',
  email: '',
  phone: '',
  country: 'India',
  state: '',
  city: '',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  status: 'TRIAL',
  subscriptionPlan: '',
  adminFirstName: '',
  adminLastName: '',
  adminEmail: '',
  adminPassword: '',
  adminMobile: '',
}

export function TenantAdminFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useAdminStore((s) => (id ? s.getTenant(id) : undefined))
  const createTenant = useAdminStore((s) => s.createTenant)
  const updateTenant = useAdminStore((s) => s.updateTenant)
  const isEdit = Boolean(id)
  const isSuperAdmin = isSuperAdminUser()

  const [form, setForm] = useState<TenantFormState>(() =>
    existing
      ? {
          ...EMPTY_FORM,
          name: existing.name,
          slug: existing.slug,
          legalName: existing.legalName ?? '',
          email: existing.email,
          phone: existing.phone ?? '',
          country: existing.country ?? '',
          state: existing.state ?? '',
          city: existing.city ?? '',
          timezone: existing.timezone,
          currency: existing.currency,
          status: existing.status,
          subscriptionPlan: existing.subscriptionPlan ?? '',
        }
      : EMPTY_FORM,
  )
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!isSuperAdmin) return <SuperAdminOnlyNotice />
  if (isEdit && !existing) return <MasterNotFound message="Tenant not found." />

  function setField<K extends keyof TenantFormState>(key: K, value: TenantFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim()) {
      setSaveError('Name and email are required')
      return
    }
    if (!isEdit && (!form.slug.trim() || !form.adminFirstName.trim() || !form.adminLastName.trim() || !form.adminEmail.trim() || form.adminPassword.length < 8)) {
      setSaveError('Slug and admin user details (with an 8+ character password) are required')
      return
    }
    setSubmitting(true)
    setSaveError(null)
    void (async () => {
      try {
        if (isEdit && existing) {
          const res = await resolveStoreAction(
            updateTenant(existing.id, {
              name: form.name,
              legalName: form.legalName || null,
              email: form.email,
              phone: form.phone || null,
              country: form.country || null,
              state: form.state || null,
              city: form.city || null,
              timezone: form.timezone,
              currency: form.currency,
              status: form.status,
              subscriptionPlan: form.subscriptionPlan || null,
            }),
          )
          if (!res.ok) {
            setSaveError(res.error ?? 'Failed to save tenant')
            return
          }
          notify.success('Tenant saved')
          navigate(`/admin/tenants/${existing.id}`)
        } else {
          const res = await resolveStoreAction(
            createTenant({
              name: form.name,
              slug: form.slug,
              legalName: form.legalName || undefined,
              email: form.email,
              phone: form.phone || undefined,
              country: form.country || undefined,
              state: form.state || undefined,
              city: form.city || undefined,
              timezone: form.timezone,
              currency: form.currency,
              status: form.status,
              subscriptionPlan: form.subscriptionPlan || undefined,
              adminUser: {
                firstName: form.adminFirstName,
                lastName: form.adminLastName,
                email: form.adminEmail,
                password: form.adminPassword,
                mobile: form.adminMobile || undefined,
              },
            }),
          )
          if (!res.ok) {
            setSaveError(res.error ?? 'Failed to create tenant')
            return
          }
          notify.success('Tenant created')
          navigate(`/admin/tenants/${res.tenantId}`)
        }
      } catch (err) {
        setSaveError(formatApiError(err))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const validationErrors = saveError ? [saveError] : []

  return (
    <FormLayout
      backTo="/admin/tenants"
      backLabel="Back to Tenants"
      title={isEdit ? 'Edit Tenant' : 'New Tenant'}
      isEdit={isEdit}
      breadcrumbs={[
        { label: 'Administration', to: '/admin' },
        { label: 'Tenants', to: '/admin/tenants' },
        { label: isEdit ? (existing?.name ?? 'Edit') : 'New' },
      ]}
      onSubmit={onSubmit}
      isSubmitting={submitting}
      validationErrors={validationErrors}
      onCancel={() => navigate(isEdit && existing ? `/admin/tenants/${existing.id}` : '/admin/tenants')}
    >
      <FormSection title="Tenant Details">
        <FormField label="Company Name" required><Input value={form.name} onChange={(e) => setField('name', e.target.value)} /></FormField>
        <FormField label="Slug" required hint="Used in login and URLs — lowercase, hyphenated">
          <Input value={form.slug} onChange={(e) => setField('slug', e.target.value)} disabled={isEdit} />
        </FormField>
        <FormField label="Legal Name"><Input value={form.legalName} onChange={(e) => setField('legalName', e.target.value)} /></FormField>
        <FormField label="Email" required><Input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} /></FormField>
        <FormField label="Phone"><Input value={form.phone} onChange={(e) => setField('phone', e.target.value)} /></FormField>
        <FormField label="Country"><Input value={form.country} onChange={(e) => setField('country', e.target.value)} /></FormField>
        <FormField label="State"><Input value={form.state} onChange={(e) => setField('state', e.target.value)} /></FormField>
        <FormField label="City"><Input value={form.city} onChange={(e) => setField('city', e.target.value)} /></FormField>
        <FormField label="Timezone"><Input value={form.timezone} onChange={(e) => setField('timezone', e.target.value)} /></FormField>
        <FormField label="Currency"><Input value={form.currency} onChange={(e) => setField('currency', e.target.value)} /></FormField>
        <FormField label="Subscription Plan"><Input value={form.subscriptionPlan} onChange={(e) => setField('subscriptionPlan', e.target.value)} /></FormField>
        <FormField label="Status" required>
          <Select value={form.status} onChange={(e) => setField('status', e.target.value as AdminTenantStatus)}>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </FormField>
      </FormSection>
      {!isEdit && (
        <FormSection title="Tenant Admin User" subtitle="First user for this tenant — will receive Tenant Admin role">
          <FormField label="First Name" required><Input value={form.adminFirstName} onChange={(e) => setField('adminFirstName', e.target.value)} /></FormField>
          <FormField label="Last Name" required><Input value={form.adminLastName} onChange={(e) => setField('adminLastName', e.target.value)} /></FormField>
          <FormField label="Email" required><Input type="email" value={form.adminEmail} onChange={(e) => setField('adminEmail', e.target.value)} /></FormField>
          <FormField label="Temporary Password" required hint="Minimum 8 characters">
            <Input type="password" value={form.adminPassword} onChange={(e) => setField('adminPassword', e.target.value)} />
          </FormField>
          <FormField label="Mobile"><Input value={form.adminMobile} onChange={(e) => setField('adminMobile', e.target.value)} /></FormField>
        </FormSection>
      )}
    </FormLayout>
  )
}

export function TenantAdminDetailPage() {
  const { id } = useParams()
  const tenant = useAdminStore((s) => (id ? s.getTenant(id) : undefined))
  const isSuperAdmin = isSuperAdminUser()

  if (!isSuperAdmin) return <SuperAdminOnlyNotice />
  if (!tenant) return <MasterNotFound message="Tenant not found." />

  return (
    <DetailLayout
      backTo="/admin/tenants"
      backLabel="Back to Tenants"
      title={tenant.name}
      subtitle={tenant.slug}
      editTo={`/admin/tenants/${tenant.id}/edit`}
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Tenants', to: '/admin/tenants' }, { label: tenant.name }]}
      badges={<TenantStatusBadge status={tenant.status} />}
    >
      <div className="space-y-6">
        <DetailSection title="Company Details">
          <DetailGrid>
            <DetailField label="Legal Name" value={tenant.legalName} />
            <DetailField label="Email" value={tenant.email} />
            <DetailField label="Phone" value={tenant.phone} />
            <DetailField label="Country" value={tenant.country} />
            <DetailField label="State" value={tenant.state} />
            <DetailField label="City" value={tenant.city} />
            <DetailField label="Timezone" value={tenant.timezone} />
            <DetailField label="Currency" value={tenant.currency} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Subscription">
          <DetailGrid>
            <DetailField label="Plan" value={tenant.subscriptionPlan} />
            <DetailField label="Subscription Status" value={tenant.subscriptionStatus} />
            <DetailField label="Trial Ends" value={tenant.trialEndsAt ? new Date(tenant.trialEndsAt).toLocaleDateString() : null} />
            <DetailField label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
          </DetailGrid>
        </DetailSection>
      </div>
    </DetailLayout>
  )
}
