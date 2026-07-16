import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { MasterRegisterTable } from '../../components/masters/MasterRegisterTable'
import { MasterListShell } from '../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../components/masters/MasterLayouts'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/forms/FormField'
import { Input, Textarea, Checkbox } from '../../components/forms/Inputs'
import { ErpCardSection } from '../../components/erp/card-form'
import { EnterpriseRowActionsMenu, type RowActionItem } from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { MasterLifecycleDialog } from '../../components/masters/MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import { useAdminStore } from '../../store/adminStore'
import { resolveStoreAction } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import type { AdminPermission, AdminRoleSummary } from '../../types/admin'

function groupPermissionsByModule(catalog: AdminPermission[]): Array<{ module: string; permissions: AdminPermission[] }> {
  const groups = new Map<string, AdminPermission[]>()
  for (const perm of catalog) {
    const list = groups.get(perm.module) ?? []
    list.push(perm)
    groups.set(perm.module, list)
  }
  return [...groups.entries()]
    .map(([module, permissions]) => ({ module, permissions: permissions.slice().sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => a.module.localeCompare(b.module))
}

function moduleLabel(module: string): string {
  const labels: Record<string, string> = {
    tenant: 'Tenant Administration',
    user: 'User Administration',
    role: 'Role Administration',
    crm: 'CRM',
    master: 'Master Data',
  }
  return labels[module] ?? module.charAt(0).toUpperCase() + module.slice(1)
}

function PermissionMatrixEditor({
  catalog,
  selected,
  onToggle,
  onToggleModule,
  readOnly,
}: {
  catalog: AdminPermission[]
  selected: Set<string>
  onToggle: (name: string) => void
  onToggleModule: (names: string[], checked: boolean) => void
  readOnly?: boolean
}) {
  const groups = useMemo(() => groupPermissionsByModule(catalog), [catalog])

  if (groups.length === 0) {
    return <p className="text-sm text-erp-muted">No permissions available.</p>
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => {
        const names = group.permissions.map((p) => p.name)
        const allChecked = names.every((n) => selected.has(n))
        const someChecked = !allChecked && names.some((n) => selected.has(n))
        return (
          <ErpCardSection
            key={group.module}
            title={moduleLabel(group.module)}
            subtitle={`${names.filter((n) => selected.has(n)).length} of ${names.length} selected`}
            collapsible
            defaultOpen={group.module !== 'crm' && group.module !== 'master'}
            columns={1}
          >
            <div className="flex flex-wrap items-center gap-3">
              {!readOnly && (
                <Checkbox
                  label="Select all"
                  checked={allChecked}
                  indeterminate={someChecked}
                  onChange={(e) => onToggleModule(names, e.target.checked)}
                  className="rounded-md border border-erp-border bg-erp-surface-alt px-2.5 py-1.5 text-xs font-semibold"
                />
              )}
              {group.permissions.map((perm) => (
                <Checkbox
                  key={perm.id}
                  label={perm.name}
                  checked={selected.has(perm.name)}
                  disabled={readOnly}
                  onChange={() => onToggle(perm.name)}
                  className="rounded-md border border-erp-border px-2.5 py-1.5 text-xs font-medium"
                />
              ))}
            </div>
          </ErpCardSection>
        )
      })}
    </div>
  )
}

function RoleScopeBadge({ tenantId, isSystem }: { tenantId: string | null; isSystem: boolean }) {
  if (isSystem) return <Badge color="purple">System</Badge>
  return <Badge color={tenantId ? 'blue' : 'gray'}>{tenantId ? 'Tenant' : 'Platform'}</Badge>
}

function RoleRowActions({ role, canEdit, canDelete }: { role: AdminRoleSummary; canEdit: boolean; canDelete: boolean }) {
  const deleteRole = useAdminStore((s) => s.deleteRole)
  const lifecycle = useMasterLifecycle({
    delete: async (id: string) => {
      const res = await resolveStoreAction(deleteRole(id))
      if (!res.ok) throw new Error(res.error ?? 'Delete failed')
    },
    activate: async () => {},
    deactivate: async () => {},
  })

  const actions: RowActionItem[] = [{ id: 'view', label: 'View', icon: Eye, to: `/admin/roles/${role.id}` }]
  if (canEdit && !role.isSystem) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, to: `/admin/roles/${role.id}/edit` })
  }
  if (canDelete && !role.isSystem) {
    actions.push({
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      danger: true,
      separator: true,
      onClick: () => lifecycle.open('delete', role.id, role.name),
    })
  }

  return (
    <>
      <EnterpriseRowActionsMenu actions={actions} />
      <MasterLifecycleDialog
        open={Boolean(lifecycle.dialog)}
        action={lifecycle.dialog?.action ?? 'delete'}
        recordLabel={lifecycle.dialog?.label ?? role.name}
        error={lifecycle.error}
        pending={lifecycle.pending}
        onConfirm={() => void lifecycle.confirm()}
        onCancel={lifecycle.close}
      />
    </>
  )
}

export function RoleAdminListPage() {
  const roles = useAdminStore((s) => s.roles)
  const canCreate = canAdminPermission('role.create')
  const canEdit = canAdminPermission('role.update')
  const canDelete = canAdminPermission('role.delete')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const s = search.toLowerCase()
    return roles.filter((r) => r.name.toLowerCase().includes(s) || (r.description ?? '').toLowerCase().includes(s))
  }, [roles, search])

  const columns: ColumnDef<typeof roles[number], unknown>[] = [
    {
      id: 'name',
      header: 'Role',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-erp-text">{row.original.name}</div>
          {row.original.description && <div className="text-xs text-erp-muted">{row.original.description}</div>}
        </div>
      ),
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: ({ row }) => <RoleScopeBadge tenantId={row.original.tenantId} isSystem={row.original.isSystem} />,
    },
    { id: 'permissionCount', header: 'Permissions', accessorKey: 'permissionCount' },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => <RoleRowActions role={row.original} canEdit={canEdit} canDelete={canDelete} />,
    },
  ]

  return (
    <MasterListShell
      title="Roles"
      description="Manage tenant roles and permission grants"
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Roles' }]}
      favoritePath="/admin/roles"
      createLabel="New Role"
      createTo={canCreate ? '/admin/roles/new' : '#'}
      search={search}
      onSearchChange={setSearch}
      resultCount={filtered.length}
      stats={[
        { label: 'Roles', value: roles.length },
        { label: 'System', value: roles.filter((r) => r.isSystem).length, accent: 'purple' },
        { label: 'Custom', value: roles.filter((r) => !r.isSystem).length, accent: 'blue' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function RoleAdminFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const detail = useAdminStore((s) => (id ? s.getRoleDetail(id) : undefined))
  const loadRoleDetail = useAdminStore((s) => s.loadRoleDetail)
  const permissionCatalog = useAdminStore((s) => s.permissionCatalog)
  const createRole = useAdminStore((s) => s.createRole)
  const updateRole = useAdminStore((s) => s.updateRole)
  const isEdit = Boolean(id)

  const [name, setName] = useState(detail?.name ?? '')
  const [description, setDescription] = useState(detail?.description ?? '')
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(new Set(detail?.permissions ?? []))
  const [saveError, setSaveError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [attempted, setAttempted] = useState(!isEdit)

  useEffect(() => {
    if (!id) return
    void loadRoleDetail(id).finally(() => setAttempted(true))
  }, [id, loadRoleDetail])

  useEffect(() => {
    if (!detail) return
    setName(detail.name)
    setDescription(detail.description ?? '')
    setSelectedPermissions(new Set(detail.permissions))
  }, [detail])

  if (isEdit && !attempted) {
    return <p className="p-6 text-sm text-erp-muted">Loading role…</p>
  }
  if (isEdit && !detail) {
    return <MasterNotFound message="Role not found." />
  }
  if (isEdit && detail?.isSystem) {
    return (
      <MasterNotFound message="System roles cannot be edited. View the role to see its permissions." />
    )
  }

  function togglePermission(nameToToggle: string) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      if (next.has(nameToToggle)) next.delete(nameToToggle)
      else next.add(nameToToggle)
      return next
    })
  }

  function toggleModule(names: string[], checked: boolean) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      for (const n of names) {
        if (checked) next.add(n)
        else next.delete(n)
      }
      return next
    })
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setSaveError('Role name is required')
      return
    }
    setSubmitting(true)
    setSaveError(null)
    void (async () => {
      try {
        if (isEdit && id) {
          const res = await resolveStoreAction(
            updateRole(id, { name, description: description || null, permissionNames: [...selectedPermissions] }),
          )
          if (!res.ok) {
            setSaveError(res.error ?? 'Failed to save role')
            return
          }
          notify.success('Role saved')
          navigate(`/admin/roles/${id}`)
        } else {
          const res = await resolveStoreAction(
            createRole({ name, description: description || undefined, permissionNames: [...selectedPermissions] }),
          )
          if (!res.ok) {
            setSaveError(res.error ?? 'Failed to create role')
            return
          }
          notify.success('Role created')
          navigate(`/admin/roles/${res.roleId}`)
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
      backTo="/admin/roles"
      backLabel="Back to Roles"
      title={isEdit ? 'Edit Role' : 'New Role'}
      isEdit={isEdit}
      breadcrumbs={[
        { label: 'Administration', to: '/admin' },
        { label: 'Roles', to: '/admin/roles' },
        { label: isEdit ? (detail?.name ?? 'Edit') : 'New' },
      ]}
      onSubmit={onSubmit}
      isSubmitting={submitting}
      validationErrors={validationErrors}
      onCancel={() => navigate(isEdit ? `/admin/roles/${id}` : '/admin/roles')}
    >
      <FormSection title="Role Details">
        <FormField label="Role Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </FormField>
        <FormField label="Description" className="md:col-span-2">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </FormField>
      </FormSection>
      <FormSection title="Permissions" className="md:col-span-2">
        <div className="md:col-span-2">
          <PermissionMatrixEditor
            catalog={permissionCatalog}
            selected={selectedPermissions}
            onToggle={togglePermission}
            onToggleModule={toggleModule}
          />
        </div>
      </FormSection>
    </FormLayout>
  )
}

export function RoleAdminDetailPage() {
  const { id } = useParams()
  const detail = useAdminStore((s) => (id ? s.getRoleDetail(id) : undefined))
  const loadRoleDetail = useAdminStore((s) => s.loadRoleDetail)
  const permissionCatalog = useAdminStore((s) => s.permissionCatalog)
  const canEdit = canAdminPermission('role.update')
  const [attempted, setAttempted] = useState(false)

  useEffect(() => {
    if (!id) return
    void loadRoleDetail(id).finally(() => setAttempted(true))
  }, [id, loadRoleDetail])

  if (!attempted && !detail) {
    return <p className="p-6 text-sm text-erp-muted">Loading role…</p>
  }
  if (!detail) return <MasterNotFound message="Role not found." />

  const selected = new Set(detail.permissions)

  return (
    <DetailLayout
      backTo="/admin/roles"
      backLabel="Back to Roles"
      title={detail.name}
      subtitle={detail.description ?? undefined}
      editTo={canEdit && !detail.isSystem ? `/admin/roles/${detail.id}/edit` : undefined}
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Roles', to: '/admin/roles' }, { label: detail.name }]}
      badges={<RoleScopeBadge tenantId={detail.tenantId} isSystem={detail.isSystem} />}
    >
      <div className="space-y-6">
        <DetailSection title="Role Details">
          <DetailGrid>
            <DetailField label="Users Assigned" value={detail.userCount} />
            <DetailField label="Permission Count" value={detail.permissions.length} />
            <DetailField label="Scope" value={detail.isSystem ? 'System (built-in)' : detail.tenantId ? 'Tenant' : 'Platform'} />
          </DetailGrid>
        </DetailSection>

        <DetailSection title="Permissions">
          <div className="flex items-center gap-2 pb-2 text-xs text-erp-muted">
            <ShieldCheck className="h-3.5 w-3.5" /> {detail.permissions.length} permissions granted
          </div>
          <PermissionMatrixEditor
            catalog={permissionCatalog}
            selected={selected}
            onToggle={() => {}}
            onToggleModule={() => {}}
            readOnly
          />
        </DetailSection>
      </div>
    </DetailLayout>
  )
}
