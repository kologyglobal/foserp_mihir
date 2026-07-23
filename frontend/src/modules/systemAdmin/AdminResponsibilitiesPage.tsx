import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
} from '../../components/admin'
import { FormField } from '../../components/forms/FormField'
import { Input, Select, Textarea } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { Badge } from '../../components/ui/Badge'
import { isApiMode } from '../../config/apiConfig'
import {
  createAdminResponsibilityApi,
  deleteAdminResponsibilityApi,
  fetchAdminResponsibilitiesApi,
  updateAdminResponsibilityApi,
  type AdminResponsibility,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'

const DEMO_KEY = 'fos-admin-responsibilities-demo'

const SYSTEM_SEED: AdminResponsibility[] = [
  {
    id: 'demo-resp-purchase',
    tenantId: null,
    code: 'PURCHASE_APPROVER',
    name: 'Purchase Approver',
    module: 'purchase',
    description: 'Named purchase approval owner',
    isSystem: true,
    isActive: true,
    assignmentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'demo-resp-finance',
    tenantId: null,
    code: 'FINANCE_POSTER',
    name: 'Finance Poster',
    module: 'finance',
    description: 'Named finance posting owner',
    isSystem: true,
    isActive: true,
    assignmentCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

function loadDemo(): AdminResponsibility[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) {
      localStorage.setItem(DEMO_KEY, JSON.stringify(SYSTEM_SEED))
      return SYSTEM_SEED
    }
    return JSON.parse(raw) as AdminResponsibility[]
  } catch {
    return SYSTEM_SEED
  }
}

function saveDemo(rows: AdminResponsibility[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(rows))
}

export function AdminResponsibilitiesPage() {
  const canView = canAdminPermission('responsibility.view') || canAdminPermission('user.view')
  const canCreate = canAdminPermission('responsibility.create')
  const canUpdate = canAdminPermission('responsibility.update')
  const canDelete = canAdminPermission('responsibility.delete')

  const [rows, setRows] = useState<AdminResponsibility[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [module, setModule] = useState('purchase')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isApiMode()) setRows(await fetchAdminResponsibilitiesApi({ active: 'all' }))
      else setRows(loadDemo())
    } catch (err) {
      const msg = formatApiError(err)
      setError(msg)
      notify.error(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const stats = useMemo(() => {
    const system = rows.filter((r) => r.isSystem).length
    const tenant = rows.filter((r) => !r.isSystem).length
    const active = rows.filter((r) => r.isActive).length
    return { system, tenant, active, total: rows.length }
  }, [rows])

  async function onCreate(e: FormEvent) {
    e.preventDefault()
    if (!canCreate) return
    setSaving(true)
    try {
      if (isApiMode()) {
        await createAdminResponsibilityApi({
          code,
          name,
          module,
          description: description || undefined,
        })
      } else {
        const next: AdminResponsibility = {
          id: `demo-resp-${crypto.randomUUID().slice(0, 8)}`,
          tenantId: 'demo-tenant',
          code: code.toUpperCase(),
          name,
          module,
          description: description || null,
          isSystem: false,
          isActive: true,
          assignmentCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        const merged = [...loadDemo(), next]
        saveDemo(merged)
        setRows(merged)
      }
      notify.success('Responsibility created')
      setCode('')
      setName('')
      setDescription('')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(row: AdminResponsibility) {
    if (!canUpdate || row.isSystem) return
    try {
      if (isApiMode()) {
        await updateAdminResponsibilityApi(row.id, { isActive: !row.isActive })
      } else {
        const merged = loadDemo().map((r) =>
          r.id === row.id ? { ...r, isActive: !r.isActive, updatedAt: new Date().toISOString() } : r,
        )
        saveDemo(merged)
        setRows(merged)
      }
      notify.success(row.isActive ? 'Deactivated' : 'Activated')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  async function onDelete(row: AdminResponsibility) {
    if (!canDelete || row.isSystem) return
    const ok = await appConfirm({
      title: 'Delete responsibility?',
      description: `Soft-delete ${row.name}. Assignments will be cleared.`,
      tone: 'danger',
    })
    if (!ok) return
    try {
      if (isApiMode()) await deleteAdminResponsibilityApi(row.id)
      else {
        const merged = loadDemo().filter((r) => r.id !== row.id)
        saveDemo(merged)
        setRows(merged)
      }
      notify.success('Responsibility deleted')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  return (
    <AdminWorkspaceShell
      title="Responsibilities"
      description="Cross-module ownership labels. Does not replace purchase/finance approval engines — use Assign on Users to map owners."
      workspace="people"
      favoritePath="/admin/responsibilities"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'refresh',
            label: 'Refresh',
            icon: RefreshCw,
            onClick: () => void load(),
          }}
        />
      }
    >
      {!canView ? (
        <AdminEmptyState title="No access" description="You need responsibility.view to manage responsibilities." />
      ) : loading ? (
        <AdminSkeleton rows={4} />
      ) : error ? (
        <AdminErrorState message={error} onRetry={() => void load()} />
      ) : (
        <div className="space-y-4">
          <AdminSummaryStrip>
            <AdminSummaryCard label="Total" value={stats.total} />
            <AdminSummaryCard label="System" value={stats.system} />
            <AdminSummaryCard label="Tenant" value={stats.tenant} />
            <AdminSummaryCard label="Active" value={stats.active} accent="green" />
          </AdminSummaryStrip>

          {canCreate ? (
            <ErpCardSection title="New responsibility">
              <form className="grid gap-3 md:grid-cols-2" onSubmit={(e) => void onCreate(e)}>
                <FormField label="Code" required>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. PLANT_LEAD" required />
                </FormField>
                <FormField label="Name" required>
                  <Input value={name} onChange={(e) => setName(e.target.value)} required />
                </FormField>
                <FormField label="Module" required>
                  <Select value={module} onChange={(e) => setModule(e.target.value)}>
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {['purchase', 'finance', 'crm', 'inventory', 'manufacturing', 'quality', 'dispatch', 'admin'].map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Description">
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                </FormField>
                <div className="md:col-span-2">
                  <ErpButton type="submit" disabled={saving || !code.trim() || !name.trim() || !module}>
                    {saving ? 'Saving…' : 'Create'}
                  </ErpButton>
                </div>
              </form>
            </ErpCardSection>
          ) : null}

          <ErpCardSection title="Catalog">
            {rows.length === 0 ? (
              <AdminEmptyState title="No responsibilities" description="Create a tenant responsibility or wait for system seed." />
            ) : (
              <div className="divide-y divide-erp-border">
                {rows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-erp-text">{row.name}</span>
                        <Badge color={row.isSystem ? 'blue' : 'gray'}>{row.isSystem ? 'System' : 'Tenant'}</Badge>
                        <Badge color={row.isActive ? 'green' : 'gray'}>{row.isActive ? 'Active' : 'Inactive'}</Badge>
                        <span className="text-xs text-erp-muted">{row.module}</span>
                      </div>
                      <p className="text-xs text-erp-muted">{row.code} · {row.assignmentCount} assignment(s)</p>
                      {row.description ? <p className="mt-1 text-sm text-erp-muted">{row.description}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      {canUpdate && !row.isSystem ? (
                        <ErpButton size="sm" variant="secondary" type="button" onClick={() => void toggleActive(row)}>
                          {row.isActive ? 'Deactivate' : 'Activate'}
                        </ErpButton>
                      ) : null}
                      {canDelete && !row.isSystem ? (
                        <ErpButton size="sm" variant="secondary" type="button" onClick={() => void onDelete(row)}>
                          Delete
                        </ErpButton>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ErpCardSection>
        </div>
      )}
    </AdminWorkspaceShell>
  )
}
