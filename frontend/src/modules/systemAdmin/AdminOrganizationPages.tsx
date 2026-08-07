import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Building2, GitBranch, Users, ExternalLink, Info } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { DetailSection, DetailGrid, DetailField, FormSection } from '@/components/masters/MasterLayouts'
import { Badge } from '@/components/ui/Badge'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { ErpButton } from '@/components/erp/ErpButton'
import { useAdminStore } from '@/store/adminStore'
import { isApiMode } from '@/config/apiConfig'
import { getStoredSession } from '@/services/api/client'
import { syncCurrentTenantProfile } from '@/services/bridges/adminApiBridge'
import { listBranches, listLegalEntities } from '@/services/bridges/financeApiBridge'
import { formatApiError } from '@/services/api/apiErrors'
import { notify } from '@/store/toastStore'
import { resolveStoreAction } from '@/store/storeAction'
import { canAdminPermission } from '@/utils/permissions'
import { PermissionDeniedPage } from '@/components/auth/ProtectedRoute'
import type { AdminTenant, AdminTenantStatus } from '@/types/admin'

const DEMO_TENANT_ID = 'demo-tenant'

const STATUS_COLOR: Record<AdminTenantStatus, 'green' | 'gray' | 'yellow' | 'red'> = {
  ACTIVE: 'green',
  TRIAL: 'yellow',
  INACTIVE: 'gray',
  SUSPENDED: 'red',
  ARCHIVED: 'gray',
}

function resolveCurrentTenantId(): string | null {
  if (isApiMode()) return getStoredSession()?.tenantId ?? null
  return DEMO_TENANT_ID
}

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return '-'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

/** Organization hub — Legal Entity / Branch links (Company = Legal Entity). */
export function AdminOrganizationPage() {
  const [leCount, setLeCount] = useState<number | null>(null)
  const [branchCount, setBranchCount] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const entities = await listLegalEntities()
        if (cancelled) return
        setLeCount(entities.length)
        let branches = 0
        for (const le of entities) {
          try {
            const rows = await listBranches(le.id)
            branches += rows.length
          } catch {
            // ignore per-entity failures
          }
        }
        if (!cancelled) setBranchCount(branches)
      } catch {
        if (!cancelled) {
          setLeCount(null)
          setBranchCount(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Administration"
      title="Organization"
      description="Tenant structure uses Legal Entity and Branch masters — there is no separate Company model."
      showDescription
      favoritePath="/admin/organization"
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Organization' }]}
      autoBreadcrumbs={false}
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-950">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Company = Legal Entity</p>
            <p className="mt-1 text-sky-900/90">
              Manage company identity (PAN, GSTIN, fiscal year) under Accounting → Legal Entities. Branches nest under a
              Legal Entity. User ↔ branch assignment is planned for Admin Users (A3) — not configured here.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Link
            to="/admin/organization/tenant"
            className="flex flex-col gap-2 rounded-lg border border-erp-border bg-white p-4 transition hover:border-erp-primary/40"
          >
            <span className="flex items-center gap-2 text-sm font-semibold text-erp-text">
              <Building2 className="h-4 w-4 text-erp-primary" /> Tenant Profile
            </span>
            <span className="text-xs text-erp-muted">Name, slug, status, and basic workspace settings</span>
          </Link>

          <Link
            to="/accounting/settings/legal-entities"
            className="flex flex-col gap-2 rounded-lg border border-erp-border bg-white p-4 transition hover:border-erp-primary/40"
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-erp-text">
              <span className="inline-flex items-center gap-2">
                <Building2 className="h-4 w-4 text-erp-primary" /> Legal Entities
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-erp-muted" />
            </span>
            <span className="text-xs text-erp-muted">
              {leCount == null ? 'Open Accounting Setup' : `${leCount} legal entit${leCount === 1 ? 'y' : 'ies'}`}
            </span>
          </Link>

          <Link
            to="/accounting/settings/branches"
            className="flex flex-col gap-2 rounded-lg border border-erp-border bg-white p-4 transition hover:border-erp-primary/40"
          >
            <span className="flex items-center justify-between gap-2 text-sm font-semibold text-erp-text">
              <span className="inline-flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-erp-primary" /> Branches
              </span>
              <ExternalLink className="h-3.5 w-3.5 text-erp-muted" />
            </span>
            <span className="text-xs text-erp-muted">
              {branchCount == null ? 'Open Accounting Setup' : `${branchCount} branch${branchCount === 1 ? '' : 'es'}`}
            </span>
          </Link>
        </div>

        <section className="rounded-lg border border-dashed border-erp-border bg-slate-50/80 p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-4 w-4 text-erp-muted" />
            <div>
              <h2 className="text-sm font-semibold text-erp-text">User ↔ branch assignment</h2>
              <p className="mt-1 text-xs text-erp-muted">
                Branch membership for people and data scope is not on this page. Manage users under{' '}
                <Link to="/admin/users" className="font-semibold text-erp-primary hover:underline">
                  People &amp; Access → Users
                </Link>{' '}
                (branch assignment coming in A3).
              </p>
            </div>
          </div>
        </section>
      </div>
    </OperationalPageShell>
  )
}

interface TenantProfileFormState {
  name: string
  legalName: string
  email: string
  phone: string
  country: string
  state: string
  city: string
  timezone: string
  currency: string
}

function toForm(tenant: AdminTenant): TenantProfileFormState {
  return {
    name: tenant.name,
    legalName: tenant.legalName ?? '',
    email: tenant.email,
    phone: tenant.phone ?? '',
    country: tenant.country ?? '',
    state: tenant.state ?? '',
    city: tenant.city ?? '',
    timezone: tenant.timezone,
    currency: tenant.currency,
  }
}

/** Current-tenant profile (not platform Tenants CRUD). */
export function AdminTenantProfilePage() {
  const tenants = useAdminStore((s) => s.tenants)
  const getTenant = useAdminStore((s) => s.getTenant)
  const updateTenant = useAdminStore((s) => s.updateTenant)
  const canView = canAdminPermission('tenant.view') || canAdminPermission('user.view') || canAdminPermission('role.view')
  const canEdit = canAdminPermission('tenant.update')
  const tenantId = resolveCurrentTenantId()

  const [tenant, setTenant] = useState<AdminTenant | undefined>()
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<TenantProfileFormState | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      if (!tenantId) {
        if (!cancelled) {
          setTenant(undefined)
          setLoading(false)
        }
        return
      }
      const cached =
        getTenant(tenantId) ??
        tenants.find((t) => t.id === tenantId || t.slug === getStoredSession()?.tenantSlug)
      if (cached && !cancelled) {
        setTenant(cached)
        setForm(toForm(cached))
      }
      if (isApiMode()) {
        const fresh = await syncCurrentTenantProfile()
        if (!cancelled) {
          setTenant(fresh ?? cached)
          if (fresh) setForm(toForm(fresh))
        }
      } else if (!cancelled && !cached) {
        setTenant(undefined)
      }
      if (!cancelled) setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [tenantId, getTenant, tenants])

  const readOnlyReason = useMemo(() => {
    if (canEdit) return null
    return 'Tenant profile updates require tenant.update. Contact a Tenant Admin or Super Admin to change these fields.'
  }, [canEdit])

  if (!canView) {
    return <PermissionDeniedPage requiredPermission="tenant.view" />
  }

  async function onSave(e: FormEvent) {
    e.preventDefault()
    if (!tenant || !form || !canEdit) return
    setSaving(true)
    const res = await resolveStoreAction(
      updateTenant(tenant.id, {
        name: form.name.trim(),
        legalName: form.legalName.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        country: form.country.trim() || null,
        state: form.state.trim() || null,
        city: form.city.trim() || null,
        timezone: form.timezone.trim() || 'Asia/Kolkata',
        currency: form.currency.trim() || 'INR',
      }),
    )
    setSaving(false)
    if (!res.ok) {
      notify.error(res.error ?? formatApiError(new Error('Update failed')))
      return
    }
    notify.success('Tenant profile updated')
    setEditing(false)
    const refreshed = getTenant(tenant.id)
    if (refreshed) {
      setTenant(refreshed)
      setForm(toForm(refreshed))
    }
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Administration"
      title="Tenant Profile"
      description="Current workspace identity — not the platform Tenants register."
      showDescription
      favoritePath="/admin/organization/tenant"
      breadcrumbs={[
        { label: 'Administration', to: '/admin' },
        { label: 'Organization', to: '/admin/organization' },
        { label: 'Tenant Profile' },
      ]}
      autoBreadcrumbs={false}
      actions={
        tenant && canEdit && !editing ? (
          <ErpButton type="button" variant="primary" onClick={() => setEditing(true)}>
            Edit profile
          </ErpButton>
        ) : undefined
      }
    >
      {loading ? (
        <p className="text-sm text-erp-muted">Loading tenant profile…</p>
      ) : !tenant ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          Could not load the current tenant. In API mode this uses{' '}
          <code className="text-xs">GET /tenants/:tenantId</code> with your session tenant (requires{' '}
          <code className="text-xs">tenant.view</code>).
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge color={STATUS_COLOR[tenant.status]}>{tenant.status}</Badge>
            <span className="text-xs text-erp-muted">Slug is immutable after create · Status / subscription are platform-managed</span>
          </div>

          {readOnlyReason && !editing ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-erp-muted">
              {readOnlyReason}
            </div>
          ) : null}

          {editing && form ? (
            <form onSubmit={(e) => void onSave(e)} className="flex flex-col gap-4">
              <FormSection title="Identity">
                <FormField label="Name" required>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Slug">
                  <Input value={tenant.slug} disabled />
                </FormField>
                <FormField label="Legal name">
                  <Input
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                  />
                </FormField>
                <FormField label="Email" required>
                  <Input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </FormField>
                <FormField label="Phone">
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </FormField>
              </FormSection>
              <FormSection title="Location & locale">
                <FormField label="Country">
                  <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
                </FormField>
                <FormField label="State">
                  <Input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                </FormField>
                <FormField label="City">
                  <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                </FormField>
                <FormField label="Timezone">
                  <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
                </FormField>
                <FormField label="Currency">
                  <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
                </FormField>
              </FormSection>
              <div className="flex flex-wrap gap-2">
                <ErpButton type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </ErpButton>
                <ErpButton
                  type="button"
                  variant="secondary"
                  disabled={saving}
                  onClick={() => {
                    setForm(toForm(tenant))
                    setEditing(false)
                  }}
                >
                  Cancel
                </ErpButton>
              </div>
            </form>
          ) : (
            <>
              <DetailSection title="Identity">
                <DetailGrid>
                  <DetailField label="Name" value={tenant.name} />
                  <DetailField label="Slug" value={tenant.slug} />
                  <DetailField label="Legal name" value={tenant.legalName ?? '-'} />
                  <DetailField label="Email" value={tenant.email} />
                  <DetailField label="Phone" value={tenant.phone ?? '-'} />
                  <DetailField label="Status" value={tenant.status} />
                </DetailGrid>
              </DetailSection>
              <DetailSection title="Location & locale">
                <DetailGrid>
                  <DetailField label="Country" value={tenant.country ?? '-'} />
                  <DetailField label="State" value={tenant.state ?? '-'} />
                  <DetailField label="City" value={tenant.city ?? '-'} />
                  <DetailField label="Timezone" value={tenant.timezone} />
                  <DetailField label="Currency" value={tenant.currency} />
                </DetailGrid>
              </DetailSection>
              <DetailSection title="Subscription (read-only)">
                <DetailGrid>
                  <DetailField label="Plan" value={tenant.subscriptionPlan ?? '-'} />
                  <DetailField label="Subscription status" value={tenant.subscriptionStatus ?? '-'} />
                  <DetailField label="Created" value={formatWhen(tenant.createdAt)} />
                  <DetailField label="Updated" value={formatWhen(tenant.updatedAt)} />
                </DetailGrid>
              </DetailSection>
            </>
          )}
        </div>
      )}
    </OperationalPageShell>
  )
}
