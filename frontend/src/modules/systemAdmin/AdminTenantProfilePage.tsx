import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminTenantStatusBadge,
} from '../../components/admin'
import { FormField } from '../../components/forms/FormField'
import { Input, Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { isApiMode } from '../../config/apiConfig'
import { getStoredSession } from '../../services/api/client'
import { fetchAdminTenantApi, updateAdminTenantApi } from '../../services/api/adminApi'
import { useAdminStore } from '../../store/adminStore'
import { resolveStoreAction } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import type { AdminTenant } from '../../types/admin'

type ProfileForm = {
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

function emptyForm(): ProfileForm {
  return {
    name: '',
    legalName: '',
    email: '',
    phone: '',
    country: 'India',
    state: '',
    city: '',
    timezone: 'Asia/Kolkata',
    currency: 'INR',
  }
}

function formFromTenant(t: AdminTenant): ProfileForm {
  return {
    name: t.name,
    legalName: t.legalName ?? '',
    email: t.email,
    phone: t.phone ?? '',
    country: t.country ?? 'India',
    state: t.state ?? '',
    city: t.city ?? '',
    timezone: t.timezone || 'Asia/Kolkata',
    currency: t.currency || 'INR',
  }
}

function resolveWorkspaceTenantId(seedTenants: AdminTenant[]): string | null {
  if (isApiMode()) return getStoredSession()?.tenantId ?? null
  return seedTenants[0]?.id ?? 'demo-tenant'
}

/**
 * Workspace tenant profile (current tenant) — reuses Tenant model + GET/PATCH /tenants/:id.
 * Platform subscription/status editing stays on Super Admin → Tenants.
 */
export function AdminTenantProfilePage() {
  const navigate = useNavigate()
  const seedTenants = useAdminStore((s) => s.tenants)
  const updateTenant = useAdminStore((s) => s.updateTenant)
  const getTenant = useAdminStore((s) => s.getTenant)
  const canView = canAdminPermission('tenant.view') || canAdminPermission('settings.view')
  const canUpdate = canAdminPermission('tenant.update')

  const tenantId = useMemo(() => resolveWorkspaceTenantId(seedTenants), [seedTenants])
  const [tenant, setTenant] = useState<AdminTenant | null>(null)
  const [form, setForm] = useState<ProfileForm>(emptyForm)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!canView || !tenantId) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    void (async () => {
      try {
        if (isApiMode()) {
          const res = await fetchAdminTenantApi(tenantId)
          if (cancelled) return
          setTenant(res.data)
          setForm(formFromTenant(res.data))
        } else {
          const row = getTenant(tenantId) ?? seedTenants[0] ?? null
          if (cancelled) return
          if (!row) {
            setError('Workspace tenant not found in demo data.')
            return
          }
          setTenant(row)
          setForm(formFromTenant(row))
        }
      } catch (err) {
        if (!cancelled) setError(formatApiError(err))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [canView, tenantId, getTenant, seedTenants])

  function setField<K extends keyof ProfileForm>(key: K, value: ProfileForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!tenantId || !canUpdate) return
    if (!form.name.trim() || !form.email.trim()) {
      notify.error('Name and email are required')
      return
    }
    setSaving(true)
    void (async () => {
      try {
        const payload = {
          name: form.name.trim(),
          legalName: form.legalName.trim() || null,
          email: form.email.trim(),
          phone: form.phone.trim() || null,
          country: form.country.trim() || null,
          state: form.state.trim() || null,
          city: form.city.trim() || null,
          timezone: form.timezone.trim() || 'Asia/Kolkata',
          currency: form.currency.trim() || 'INR',
        }
        if (isApiMode()) {
          const res = await updateAdminTenantApi(tenantId, payload)
          setTenant(res.data)
          setForm(formFromTenant(res.data))
        } else {
          const res = await resolveStoreAction(updateTenant(tenantId, payload))
          if (!res.ok) {
            notify.error(res.error ?? 'Failed to save profile')
            return
          }
          const updated = getTenant(tenantId)
          if (updated) {
            setTenant(updated)
            setForm(formFromTenant(updated))
          }
        }
        notify.success('Tenant profile saved')
      } catch (err) {
        notify.error(formatApiError(err))
      } finally {
        setSaving(false)
      }
    })()
  }

  return (
    <AdminWorkspaceShell
      title="Tenant Profile"
      description="Workspace identity, locale defaults, and contact — not legal entity books."
      workspace="organization"
      favoritePath="/admin/tenant-profile"
      pageGuide={{
        purpose: 'Edit the current workspace Tenant profile (name, contact, timezone, currency).',
        nextStep: 'Legal entities and GST live under Companies / Organisation Setup.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'companies',
            label: 'Companies',
            icon: Building2,
            onClick: () => navigate('/admin/companies'),
          }}
          secondaryActions={[
            {
              id: 'org-setup',
              label: 'Organisation Setup',
              icon: Building2,
              onClick: () => navigate('/settings/organisation/legal-entity'),
            },
          ]}
        />
      }
    >
      <div className="space-y-6">
        {!canView ? (
          <AdminEmptyState
            title="No access"
            description="You need tenant.view or settings.view to open the workspace profile."
          />
        ) : loading ? (
          <AdminSkeleton rows={4} />
        ) : error ? (
          <AdminErrorState title="Could not load profile" description={error} />
        ) : !tenant ? (
          <AdminEmptyState title="Tenant not found" description="Could not resolve the current workspace tenant." />
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm text-erp-muted">
              <span>
                Slug <span className="font-mono text-erp-text">{tenant.slug}</span>
              </span>
              <AdminTenantStatusBadge status={tenant.status} />
              <span className="text-xs">Status and subscription are managed by platform Super Admins.</span>
            </div>

            <ErpCardSection title="Identity" columns={2}>
              <FormField label="Workspace name" required>
                <Input
                  value={form.name}
                  disabled={!canUpdate}
                  onChange={(e) => setField('name', e.target.value)}
                />
              </FormField>
              <FormField label="Legal name">
                <Input
                  value={form.legalName}
                  disabled={!canUpdate}
                  onChange={(e) => setField('legalName', e.target.value)}
                />
              </FormField>
              <FormField label="Email" required>
                <Input
                  type="email"
                  value={form.email}
                  disabled={!canUpdate}
                  onChange={(e) => setField('email', e.target.value)}
                />
              </FormField>
              <FormField label="Phone">
                <Input
                  value={form.phone}
                  disabled={!canUpdate}
                  onChange={(e) => setField('phone', e.target.value)}
                />
              </FormField>
            </ErpCardSection>

            <ErpCardSection title="Location & defaults" columns={2}>
              <FormField label="Country">
                <Input
                  value={form.country}
                  disabled={!canUpdate}
                  onChange={(e) => setField('country', e.target.value)}
                />
              </FormField>
              <FormField label="State">
                <Input
                  value={form.state}
                  disabled={!canUpdate}
                  onChange={(e) => setField('state', e.target.value)}
                />
              </FormField>
              <FormField label="City">
                <Input
                  value={form.city}
                  disabled={!canUpdate}
                  onChange={(e) => setField('city', e.target.value)}
                />
              </FormField>
              <FormField label="Timezone">
                <Select
                  value={form.timezone}
                  disabled={!canUpdate}
                  onChange={(e) => setField('timezone', e.target.value)}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="UTC">UTC</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </Select>
              </FormField>
              <FormField label="Currency">
                <Select
                  value={form.currency}
                  disabled={!canUpdate}
                  onChange={(e) => setField('currency', e.target.value)}
                >
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="AED">AED</option>
                </Select>
              </FormField>
            </ErpCardSection>

            {canUpdate ? (
              <div className="flex justify-end gap-2">
                <ErpButton type="submit" size="sm" disabled={saving}>
                  {saving ? 'Saving…' : 'Save profile'}
                </ErpButton>
              </div>
            ) : (
              <p className="text-sm text-erp-muted">You can view this profile but need tenant.update to edit.</p>
            )}
          </form>
        )}
      </div>
    </AdminWorkspaceShell>
  )
}
