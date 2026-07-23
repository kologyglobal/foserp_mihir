import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Network, Plus, RefreshCw } from 'lucide-react'
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
  createAdminDepartmentApi,
  deleteAdminDepartmentApi,
  fetchAdminDepartmentsApi,
  updateAdminDepartmentApi,
  type AdminDepartment,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'

const DEMO_KEY = 'fos-admin-departments-demo'

function loadDemo(): AdminDepartment[] {
  try {
    const raw = localStorage.getItem(DEMO_KEY)
    if (!raw) {
      const seed: AdminDepartment[] = [
        {
          id: 'demo-dept-prod',
          tenantId: 'demo-tenant',
          code: 'PROD',
          name: 'Production',
          description: 'Shop floor & planning',
          isActive: true,
          userCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'demo-dept-purchase',
          tenantId: 'demo-tenant',
          code: 'PUR',
          name: 'Purchase',
          description: null,
          isActive: true,
          userCount: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]
      localStorage.setItem(DEMO_KEY, JSON.stringify(seed))
      return seed
    }
    return JSON.parse(raw) as AdminDepartment[]
  } catch {
    return []
  }
}

function saveDemo(rows: AdminDepartment[]) {
  localStorage.setItem(DEMO_KEY, JSON.stringify(rows))
}

export function AdminDepartmentsPage() {
  const canView = canAdminPermission('department.view') || canAdminPermission('user.view')
  const canCreate = canAdminPermission('department.create') || canAdminPermission('user.create')
  const canUpdate = canAdminPermission('department.update') || canAdminPermission('user.update')
  const canDelete = canAdminPermission('department.delete') || canAdminPermission('user.delete')

  const [rows, setRows] = useState<AdminDepartment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AdminDepartment | null>(null)
  const [form, setForm] = useState({ code: '', name: '', description: '', isActive: true })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      if (isApiMode()) {
        setRows(await fetchAdminDepartmentsApi({ active: 'all' }))
      } else {
        setRows(loadDemo())
      }
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
  }, [canView, load])

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.isActive).length
    return { total: rows.length, active }
  }, [rows])

  function openCreate() {
    setEditing(null)
    setForm({ code: '', name: '', description: '', isActive: true })
  }

  function openEdit(row: AdminDepartment) {
    setEditing(row)
    setForm({
      code: row.code,
      name: row.name,
      description: row.description ?? '',
      isActive: row.isActive,
    })
  }

  const onSave = (e: FormEvent) => {
    e.preventDefault()
    if (!form.code.trim() || !form.name.trim()) {
      notify.error('Code and name are required')
      return
    }
    setSaving(true)
    void (async () => {
      try {
        if (isApiMode()) {
          if (editing) {
            await updateAdminDepartmentApi(editing.id, {
              code: form.code.trim(),
              name: form.name.trim(),
              description: form.description.trim() || null,
              isActive: form.isActive,
            })
            notify.success('Department updated')
          } else {
            await createAdminDepartmentApi({
              code: form.code.trim(),
              name: form.name.trim(),
              description: form.description.trim() || undefined,
              isActive: form.isActive,
            })
            notify.success('Department created')
          }
        } else {
          const next = [...loadDemo()]
          if (editing) {
            const idx = next.findIndex((r) => r.id === editing.id)
            if (idx >= 0) {
              next[idx] = {
                ...next[idx],
                code: form.code.trim().toUpperCase(),
                name: form.name.trim(),
                description: form.description.trim() || null,
                isActive: form.isActive,
                updatedAt: new Date().toISOString(),
              }
            }
          } else {
            next.unshift({
              id: `demo-dept-${crypto.randomUUID().slice(0, 8)}`,
              tenantId: 'demo-tenant',
              code: form.code.trim().toUpperCase(),
              name: form.name.trim(),
              description: form.description.trim() || null,
              isActive: form.isActive,
              userCount: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            })
          }
          saveDemo(next)
          notify.success(editing ? 'Department updated' : 'Department created')
        }
        setEditing(null)
        setForm({ code: '', name: '', description: '', isActive: true })
        await load()
      } catch (err) {
        notify.error(formatApiError(err))
      } finally {
        setSaving(false)
      }
    })()
  }

  const onDelete = async (row: AdminDepartment) => {
    if (!canDelete) return
    const ok = await appConfirm({
      title: 'Delete department?',
      description: `${row.name} will be soft-deleted. Users keep a free-text department label but lose the link.`,
      tone: 'danger',
    })
    if (!ok) return
    try {
      if (isApiMode()) {
        await deleteAdminDepartmentApi(row.id)
      } else {
        saveDemo(loadDemo().filter((r) => r.id !== row.id))
      }
      notify.success('Department deleted')
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  return (
    <AdminWorkspaceShell
      title="Departments"
      description="Organisation units for people administration. IAM department master (not CRM)."
      workspace="organization"
      favoritePath="/admin/departments"
      pageGuide={{
        purpose: 'Maintain department codes used when assigning users.',
        nextStep: 'Create departments, then pick them on user invite/edit forms.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canCreate
              ? {
                  id: 'new-department',
                  label: 'New department',
                  icon: Plus,
                  onClick: openCreate,
                }
              : {
                  id: 'refresh',
                  label: 'Refresh',
                  icon: RefreshCw,
                  onClick: () => void load(),
                }
          }
          secondaryActions={
            canCreate
              ? [
                  {
                    id: 'refresh',
                    label: 'Refresh',
                    icon: RefreshCw,
                    onClick: () => void load(),
                  },
                ]
              : undefined
          }
        />
      }
    >
      <div className="space-y-6">
        {!canView ? (
          <AdminEmptyState title="No access" description="You need department.view to manage departments." />
        ) : loading ? (
          <AdminSkeleton rows={4} />
        ) : error ? (
          <AdminErrorState title="Could not load departments" description={error} />
        ) : (
          <>
            <AdminSummaryStrip>
              <AdminSummaryCard label="Departments" value={stats.total} icon={Network} accent="blue" />
              <AdminSummaryCard label="Active" value={stats.active} accent="green" />
            </AdminSummaryStrip>

            {(canCreate || editing) && (
              <form onSubmit={onSave}>
                <ErpCardSection title={editing ? `Edit ${editing.code}` : 'New department'} columns={2}>
                  <FormField label="Code" required>
                    <Input
                      value={form.code}
                      disabled={Boolean(editing) && !canUpdate}
                      onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Name" required>
                    <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                  </FormField>
                  <FormField label="Description" className="md:col-span-2">
                    <Textarea
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    />
                  </FormField>
                  <FormField label="Status">
                    <Select
                      value={form.isActive ? 'active' : 'inactive'}
                      onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.value === 'active' }))}
                    >
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </Select>
                  </FormField>
                  <div className="md:col-span-2 flex justify-end gap-2">
                    {editing ? (
                      <ErpButton type="button" size="sm" variant="secondary" onClick={openCreate}>
                        Cancel edit
                      </ErpButton>
                    ) : null}
                    <ErpButton type="submit" size="sm" disabled={saving || (!canCreate && !canUpdate)}>
                      {saving ? 'Saving…' : editing ? 'Save' : 'Create'}
                    </ErpButton>
                  </div>
                </ErpCardSection>
              </form>
            )}

            {rows.length === 0 ? (
              <AdminEmptyState title="No departments" description="Create Production, Purchase, Quality, and other org units." />
            ) : (
              <section className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-erp-surface-alt text-xs uppercase tracking-wide text-erp-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Code</th>
                      <th className="px-4 py-2 font-semibold">Name</th>
                      <th className="px-4 py-2 font-semibold">Users</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-erp-border">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2.5 font-mono text-xs">{row.code}</td>
                        <td className="px-4 py-2.5">
                          <div className="font-medium text-erp-text">{row.name}</div>
                          {row.description ? <div className="text-xs text-erp-muted">{row.description}</div> : null}
                        </td>
                        <td className="px-4 py-2.5">{row.userCount}</td>
                        <td className="px-4 py-2.5">
                          <Badge color={row.isActive ? 'green' : 'gray'}>{row.isActive ? 'ACTIVE' : 'INACTIVE'}</Badge>
                        </td>
                        <td className="px-4 py-2.5 space-x-2">
                          {canUpdate ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-erp-primary hover:underline"
                              onClick={() => openEdit(row)}
                            >
                              Edit
                            </button>
                          ) : null}
                          {canDelete ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-erp-danger-fg hover:underline"
                              onClick={() => void onDelete(row)}
                            >
                              Delete
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </>
        )}
      </div>
    </AdminWorkspaceShell>
  )
}
