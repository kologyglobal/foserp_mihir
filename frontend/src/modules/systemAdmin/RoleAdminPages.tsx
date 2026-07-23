import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Eye, Pencil, ShieldCheck, Trash2 } from 'lucide-react'
import { MasterRegisterTable } from '../../components/masters/MasterRegisterTable'
import { MasterListShell } from '../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../components/masters/MasterLayouts'
import { Badge } from '../../components/ui/Badge'
import { EnterpriseRowActionsMenu, type RowActionItem } from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { MasterLifecycleDialog } from '../../components/masters/MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import {
  AdminPermissionMatrix,
  AdminRoleBuilderWizard,
  AdminRoleTypeBadge,
  type AdminPermissionPreset,
} from '../../components/admin'
import { useAdminStore } from '../../store/adminStore'
import { resolveStoreAction } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import type { AdminRoleSummary } from '../../types/admin'

function RoleScopeBadge({ tenantId, isSystem }: { tenantId: string | null; isSystem: boolean }) {
  if (isSystem) return <AdminRoleTypeBadge isSystem />
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
      badge="Admin"
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

  function applyPreset(_module: string, names: string[], preset: AdminPermissionPreset) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      for (const n of names) next.delete(n)
      if (preset === 'view') {
        for (const n of names) {
          if (n.endsWith('.view') || n.includes('.view.') || n.endsWith('.read')) next.add(n)
        }
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
    <div className="mx-auto max-w-5xl space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <button
            type="button"
            className="text-sm font-medium text-erp-primary hover:underline"
            onClick={() => navigate('/admin/roles')}
          >
            ← Back to Roles
          </button>
          <h1 className="mt-2 text-xl font-semibold text-erp-text">{isEdit ? 'Edit Role' : 'New Role'}</h1>
          <p className="text-sm text-erp-muted">Guided Role Builder — identity, modules, sensitive review, save.</p>
        </div>
      </div>
      {validationErrors.length > 0 ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {validationErrors.join(' · ')}
        </div>
      ) : null}
      <AdminRoleBuilderWizard
        catalog={permissionCatalog}
        name={name}
        description={description}
        onNameChange={setName}
        onDescriptionChange={setDescription}
        selected={selectedPermissions}
        onToggle={togglePermission}
        onToggleModule={toggleModule}
        onApplyPreset={applyPreset}
        onSubmit={onSubmit}
        onCancel={() => navigate(isEdit ? `/admin/roles/${id}` : '/admin/roles')}
        submitting={submitting}
        isEdit={isEdit}
      />
    </div>
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
          <AdminPermissionMatrix
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
