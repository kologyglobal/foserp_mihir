import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  Pencil,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
} from 'lucide-react'
import { MasterRegisterTable } from '../../components/masters/MasterRegisterTable'
import { MasterListShell } from '../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../components/masters/MasterLayouts'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/forms/FormField'
import { Input, Textarea, Checkbox, Select } from '../../components/forms/Inputs'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminSkeleton } from '../../components/admin'
import {
  adminModuleLabel,
  adminPermissionDisplayLabel,
  isAdminSensitivePermission,
} from '../../components/admin/AdminPermissionMatrix'
import { AdminSensitivePermissionBadge } from '../../components/admin/AdminStatusBadge'
import { EnterpriseRowActionsMenu, type RowActionItem } from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { MasterLifecycleDialog } from '../../components/masters/MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import { useAdminStore } from '../../store/adminStore'
import { resolveStoreAction } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { cloneAdminRoleApi } from '../../services/api/adminApi'
import { isApiMode } from '../../config/apiConfig'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'
import { ensureViewDependencies, permissionModuleLabel } from '../../utils/permissions/moduleLabels'
import {
  ROLE_PERMISSION_PRESETS,
  resolvePresetPermissionNames,
} from '../../utils/permissions/rolePresets'
import type { AdminPermission, AdminRoleDetail, AdminRoleSummary } from '../../types/admin'
import { cn } from '../../utils/cn'

function groupPermissionsByModule(catalog: AdminPermission[]): Array<{ module: string; permissions: AdminPermission[] }> {
  const groups = new Map<string, AdminPermission[]>()
  for (const perm of catalog) {
    const list = groups.get(perm.module) ?? []
    list.push(perm)
    groups.set(perm.module, list)
  }
  return [...groups.entries()]
    .map(([module, permissions]) => ({ module, permissions: permissions.slice().sort((a, b) => a.name.localeCompare(b.name)) }))
    .sort((a, b) => permissionModuleLabel(a.module).localeCompare(permissionModuleLabel(b.module)))
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
            title={permissionModuleLabel(group.module)}
            subtitle={`${names.filter((n) => selected.has(n)).length} of ${names.length} selected`}
            collapsible
            defaultOpen={group.module === 'tenant' || group.module === 'user' || group.module === 'role'}
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

function RoleRowActions({ role, canEdit, canDelete, canCreate }: { role: AdminRoleSummary; canEdit: boolean; canDelete: boolean; canCreate: boolean }) {
  const navigate = useNavigate()
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
  if (canCreate) {
    actions.push({
      id: 'clone',
      label: 'Clone role',
      icon: Copy,
      onClick: () => {
        void (async () => {
          const ok = await appConfirm({
            title: `Clone “${role.name}”?`,
            description: 'Creates a new custom role with the same permission set.',
            confirmLabel: 'Clone',
          })
          if (!ok) return
          try {
            if (isApiMode()) {
              const res = await cloneAdminRoleApi(role.id)
              notify.success(`Cloned as ${res.data.name}`)
              navigate(`/admin/roles/${res.data.id}/edit`)
            } else {
              const res = await resolveStoreAction(
                useAdminStore.getState().createRole({
                  name: `${role.name} (copy)`,
                  description: role.description ?? undefined,
                  permissionNames: useAdminStore.getState().getRoleDetail(role.id)?.permissions ?? [],
                }),
              )
              if (!res.ok) {
                notify.error(res.error ?? 'Clone failed')
                return
              }
              // load detail for permissions first if missing
              await useAdminStore.getState().loadRoleDetail(role.id)
              const perms = useAdminStore.getState().getRoleDetail(role.id)?.permissions ?? []
              if (perms.length && res.roleId) {
                await resolveStoreAction(
                  useAdminStore.getState().updateRole(res.roleId, {
                    name: `${role.name} (copy)`,
                    description: role.description,
                    permissionNames: perms,
                  }),
                )
              }
              notify.success('Role cloned (demo)')
              if (res.roleId) navigate(`/admin/roles/${res.roleId}/edit`)
            }
          } catch (err) {
            notify.error(formatApiError(err))
          }
        })()
      },
    })
  }
  if (canDelete && !role.isSystem) {
    actions.push({
      id: 'delete',
      label: role.isSystem ? 'Deactivate' : 'Delete / Deactivate',
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
      cell: ({ row }) => <RoleRowActions role={row.original} canEdit={canEdit} canDelete={canDelete} canCreate={canCreate} />,
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

  const catalogNameSet = useMemo(
    () => new Set(permissionCatalog.map((p) => p.name)),
    [permissionCatalog],
  )

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
      if (next.has(nameToToggle)) {
        next.delete(nameToToggle)
        return next
      }
      next.add(nameToToggle)
      return ensureViewDependencies(next, catalogNameSet)
    })
  }

  function toggleModule(names: string[], checked: boolean) {
    setSelectedPermissions((prev) => {
      const next = new Set(prev)
      for (const n of names) {
        if (checked) next.add(n)
        else next.delete(n)
      }
      return checked ? ensureViewDependencies(next, catalogNameSet) : next
    })
  }

  function applyPreset(presetId: string) {
    const preset = ROLE_PERMISSION_PRESETS.find((p) => p.id === presetId)
    if (!preset) return
    const names = resolvePresetPermissionNames(
      preset,
      permissionCatalog.map((p) => p.name),
    )
    setSelectedPermissions(ensureViewDependencies(names, catalogNameSet))
    notify.info(`Applied “${preset.label}” preset (${names.length} permissions)`)
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
        const permissionNames = [...ensureViewDependencies(selectedPermissions, catalogNameSet)]
        if (isEdit && id) {
          const res = await resolveStoreAction(
            updateRole(id, { name, description: description || null, permissionNames }),
          )
          if (!res.ok) {
            setSaveError(res.error ?? 'Failed to save role')
            return
          }
          notify.success('Role saved')
          navigate(`/admin/roles/${id}`)
        } else {
          const res = await resolveStoreAction(
            createRole({ name, description: description || undefined, permissionNames }),
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
        <div className="md:col-span-2 space-y-3">
          <div className="rounded-md border border-erp-border bg-erp-surface-alt px-3 py-2.5">
            <p className="text-xs font-semibold text-erp-text">Quick-apply presets</p>
            <p className="mt-0.5 text-xs text-erp-muted">
              Selecting a mutate permission auto-includes its matching <code className="text-[11px]">.view</code> grant.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ROLE_PERMISSION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  title={preset.description}
                  onClick={() => applyPreset(preset.id)}
                  className="erp-btn-secondary rounded-md px-2.5 py-1.5 text-xs font-semibold"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedPermissions(new Set())}
                className="rounded-md border border-erp-border px-2.5 py-1.5 text-xs font-semibold text-erp-muted hover:text-erp-text"
              >
                Clear all
              </button>
            </div>
          </div>
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
  const navigate = useNavigate()
  const detail = useAdminStore((s) => (id ? s.getRoleDetail(id) : undefined))
  const loadRoleDetail = useAdminStore((s) => s.loadRoleDetail)
  const permissionCatalog = useAdminStore((s) => s.permissionCatalog)
  const canEdit = canAdminPermission('role.update')
  const canCreate = canAdminPermission('role.create')
  const [attempted, setAttempted] = useState(false)
  const [search, setSearch] = useState('')
  const [showAllCatalog, setShowAllCatalog] = useState(false)
  const [openModules, setOpenModules] = useState<Set<string>>(new Set())
  const [compareRoleId, setCompareRoleId] = useState('')
  const roles = useAdminStore((s) => s.roles)
  const compareDetail = useAdminStore((s) => (compareRoleId ? s.getRoleDetail(compareRoleId) : undefined))
  const loadRoleDetailStore = useAdminStore((s) => s.loadRoleDetail)

  useEffect(() => {
    if (!id) return
    void loadRoleDetail(id).finally(() => setAttempted(true))
  }, [id, loadRoleDetail])

  const granted = useMemo(() => new Set(detail?.permissions ?? []), [detail?.permissions])

  const moduleGroups = useMemo(() => {
    if (!detail) return []
    return buildRolePermissionModules(detail, permissionCatalog, {
      search,
      showAllCatalog,
    })
  }, [detail, permissionCatalog, search, showAllCatalog])

  useEffect(() => {
    if (!detail) return
    const defaults = buildRolePermissionModules(detail, permissionCatalog, {
      search: '',
      showAllCatalog: false,
    })
      .filter((g) => g.grantedCount > 0)
      .map((g) => g.module)
      .slice(0, 6)
    setOpenModules(new Set(defaults))
    setSearch('')
    setShowAllCatalog(false)
  }, [detail?.id, detail, permissionCatalog])

  if (!attempted && !detail) {
    return (
      <div className="p-6">
        <AdminSkeleton rows={6} />
      </div>
    )
  }
  if (!detail) return <MasterNotFound message="Role not found." />

  const sensitiveGranted = detail.permissions.filter(isAdminSensitivePermission)
  const modulesWithAccess = moduleGroups.filter((g) => g.grantedCount > 0).length
  const canEditRole = canEdit && !detail.isSystem
  const scopeLabel = detail.isSystem
    ? 'System (built-in)'
    : detail.tenantId
      ? 'Tenant custom role'
      : 'Platform role'

  const toggleModuleOpen = (module: string) => {
    setOpenModules((prev) => {
      const next = new Set(prev)
      if (next.has(module)) next.delete(module)
      else next.add(module)
      return next
    })
  }

  const expandAll = () => setOpenModules(new Set(moduleGroups.map((g) => g.module)))
  const collapseAll = () => setOpenModules(new Set())

  return (
    <DetailLayout
      backTo="/admin/roles"
      backLabel="Back to Roles"
      title={detail.name}
      subtitle={detail.description?.trim() || 'Role permissions control what users can see and do in FOS ERP.'}
      editTo={canEditRole ? `/admin/roles/${detail.id}/edit` : undefined}
      favoritePath={`/admin/roles/${detail.id}`}
      breadcrumbs={[
        { label: 'Administration', to: '/admin' },
        { label: 'Roles', to: '/admin/roles' },
        { label: detail.name },
      ]}
      badges={
        <div className="flex flex-wrap items-center gap-2">
          <RoleScopeBadge tenantId={detail.tenantId} isSystem={detail.isSystem} />
          {sensitiveGranted.length > 0 ? <AdminSensitivePermissionBadge /> : null}
        </div>
      }
      documentStrip={[
        { label: 'Role', value: detail.name, highlight: true },
        { label: 'Scope', value: detail.isSystem ? 'System' : detail.tenantId ? 'Tenant' : 'Platform' },
        { label: 'Users', value: String(detail.userCount) },
        { label: 'Permissions', value: String(detail.permissions.length) },
      ]}
      formMetrics={[
        { label: 'Users assigned', value: String(detail.userCount), accent: 'blue' },
        { label: 'Permissions', value: String(detail.permissions.length), accent: 'green' },
        { label: 'Modules with access', value: String(modulesWithAccess) },
        {
          label: 'Sensitive',
          value: String(sensitiveGranted.length),
          accent: sensitiveGranted.length > 0 ? 'amber' : 'slate',
        },
      ]}
      factBoxTitle="At a glance"
      factBoxSummary={[
        { label: 'Type', value: scopeLabel },
        { label: 'Users', value: `${detail.userCount}` },
        { label: 'Access', value: `${detail.permissions.length} permissions` },
        {
          label: 'Updated',
          value: detail.updatedAt ? new Date(detail.updatedAt).toLocaleDateString() : '—',
        },
      ]}
      sectionNavItems={[
        { id: 'overview', label: 'Overview' },
        { id: 'permissions', label: 'Permissions' },
      ]}
      extraCommandActions={
        canEditRole
          ? [
              {
                id: 'edit-perms',
                label: 'Edit permissions',
                icon: Pencil,
                onClick: () => navigate(`/admin/roles/${detail.id}/edit`),
              },
            ]
          : undefined
      }
    >
      <div className="space-y-6">
        {detail.isSystem ? (
          <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-700" />
            <div>
              <p className="text-sm font-semibold text-violet-900">Built-in system role</p>
              <p className="mt-0.5 text-sm text-violet-800/90">
                Permissions are managed by the product. You can review them here, but you cannot edit or delete this
                role. Assign it to users from the Users page.
              </p>
            </div>
          </div>
        ) : null}

        {sensitiveGranted.length > 0 ? (
          <div className="flex gap-3 rounded-xl border border-red-200 bg-red-50/80 px-4 py-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-700" />
            <div>
              <p className="text-sm font-semibold text-red-900">
                Includes {sensitiveGranted.length} sensitive permission
                {sensitiveGranted.length === 1 ? '' : 's'}
              </p>
              <p className="mt-0.5 text-sm text-red-800/90">
                This role can change security, posting, or platform settings. Only assign it to trusted administrators.
              </p>
            </div>
          </div>
        ) : null}

        <DetailSection
          title="Overview"
          subtitle="What this role is for, and who it affects."
          sectionId="overview"
        >
          <DetailGrid>
            <DetailField label="Role name" value={detail.name} />
            <DetailField label="Scope" value={scopeLabel} />
            <DetailField
              label="Users with this role"
              value={
                <Link
                  to="/admin/users"
                  className="inline-flex items-center gap-1.5 text-erp-primary hover:underline"
                >
                  <Users className="h-3.5 w-3.5" />
                  {detail.userCount} user{detail.userCount === 1 ? '' : 's'}
                </Link>
              }
            />
            <DetailField label="Permissions granted" value={detail.permissions.length} />
            <DetailField label="Modules with access" value={modulesWithAccess} />
            <DetailField
              label="Last updated"
              value={detail.updatedAt ? new Date(detail.updatedAt).toLocaleString() : '—'}
            />
          </DetailGrid>

          <div className="mt-4 rounded-lg border border-erp-border bg-erp-surface-alt/50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-erp-muted">Description</p>
            <p className="mt-1 text-sm text-erp-text">
              {detail.description?.trim() ||
                'No description yet. Add one when you edit the role so other admins know when to use it.'}
            </p>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {canEditRole ? (
              <ErpButton
                size="sm"
                icon={Pencil}
                onClick={() => navigate(`/admin/roles/${detail.id}/edit`)}
              >
                Edit role &amp; permissions
              </ErpButton>
            ) : null}
            {canCreate ? (
              <ErpButton
                size="sm"
                variant="secondary"
                icon={Copy}
                onClick={() => {
                  void (async () => {
                    const ok = await appConfirm({
                      title: `Clone “${detail.name}”?`,
                      description: 'Creates a custom role with the same permissions (system roles become tenant custom).',
                      confirmLabel: 'Clone',
                    })
                    if (!ok) return
                    try {
                      if (isApiMode()) {
                        const res = await cloneAdminRoleApi(detail.id)
                        notify.success(`Cloned as ${res.data.name}`)
                        navigate(`/admin/roles/${res.data.id}/edit`)
                      } else {
                        const res = await resolveStoreAction(
                          useAdminStore.getState().createRole({
                            name: `${detail.name} (copy)`,
                            description: detail.description ?? undefined,
                            permissionNames: detail.permissions,
                          }),
                        )
                        if (!res.ok) {
                          notify.error(res.error ?? 'Clone failed')
                          return
                        }
                        notify.success('Role cloned (demo)')
                        if (res.roleId) navigate(`/admin/roles/${res.roleId}/edit`)
                      }
                    } catch (err) {
                      notify.error(formatApiError(err))
                    }
                  })()
                }}
              >
                Clone role
              </ErpButton>
            ) : null}
            <ErpButton size="sm" variant="secondary" onClick={() => navigate('/admin/users')}>
              Manage user assignments
            </ErpButton>
            <ErpButton size="sm" variant="ghost" onClick={() => navigate('/admin/roles')}>
              Back to roles list
            </ErpButton>
          </div>

          <div className="mt-4 rounded-lg border border-erp-border p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-erp-muted">Compare with another role</p>
            <div className="flex flex-wrap items-end gap-2">
              <Select
                value={compareRoleId}
                onChange={(e) => {
                  const v = e.target.value
                  setCompareRoleId(v)
                  if (v) void loadRoleDetailStore(v)
                }}
                className="min-w-[200px]"
              >
                <option value="">— Select —</option>
                {roles
                  .filter((r) => r.id !== detail.id)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
              </Select>
            </div>
            {compareDetail ? (
              <p className="mt-2 text-xs text-erp-muted">
                Only in {detail.name}:{' '}
                {detail.permissions.filter((p) => !compareDetail.permissions.includes(p)).length} · Only in{' '}
                {compareDetail.name}:{' '}
                {compareDetail.permissions.filter((p) => !detail.permissions.includes(p)).length} · Shared:{' '}
                {detail.permissions.filter((p) => compareDetail.permissions.includes(p)).length}
              </p>
            ) : null}
          </div>
        </DetailSection>

        <DetailSection
          title="Permissions"
          subtitle="Grouped by area of the product. Plain labels first; technical keys underneath."
          sectionId="permissions"
        >
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-medium text-erp-muted">Search permissions</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-erp-muted" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="e.g. create lead, invoice, security…"
                  className="pl-8"
                  aria-label="Search permissions"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <ErpButton
                size="sm"
                variant={showAllCatalog ? 'secondary' : 'primary'}
                type="button"
                onClick={() => setShowAllCatalog(false)}
              >
                Granted only
              </ErpButton>
              <ErpButton
                size="sm"
                variant={showAllCatalog ? 'primary' : 'secondary'}
                type="button"
                onClick={() => setShowAllCatalog(true)}
              >
                Full catalog
              </ErpButton>
              <ErpButton size="sm" variant="ghost" type="button" onClick={expandAll}>
                Expand all
              </ErpButton>
              <ErpButton size="sm" variant="ghost" type="button" onClick={collapseAll}>
                Collapse all
              </ErpButton>
            </div>
          </div>

          <p className="mb-3 text-xs text-erp-muted">
            {showAllCatalog
              ? 'Showing all permissions in the catalog. Green rows are granted to this role.'
              : `Showing ${detail.permissions.length} granted permission${detail.permissions.length === 1 ? '' : 's'} across ${modulesWithAccess} module${modulesWithAccess === 1 ? '' : 's'}.`}
          </p>

          {moduleGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-erp-border px-4 py-10 text-center text-sm text-erp-muted">
              {search.trim()
                ? 'No permissions match your search.'
                : showAllCatalog
                  ? 'Permission catalog is empty. Hydrate Admin roles/permissions and try again.'
                  : 'This role has no permissions granted yet.'}
            </div>
          ) : (
            <div className="space-y-2">
              {moduleGroups.map((group) => {
                const open = openModules.has(group.module)
                return (
                  <div
                    key={group.module}
                    className="overflow-hidden rounded-xl border border-erp-border bg-white"
                  >
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-erp-surface-alt/60"
                      onClick={() => toggleModuleOpen(group.module)}
                      aria-expanded={open}
                    >
                      {open ? (
                        <ChevronDown className="h-4 w-4 shrink-0 text-erp-muted" />
                      ) : (
                        <ChevronRight className="h-4 w-4 shrink-0 text-erp-muted" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-erp-text">{group.label}</span>
                          <Badge color={group.grantedCount > 0 ? 'green' : 'gray'}>
                            {group.grantedCount} granted
                          </Badge>
                          {group.sensitiveCount > 0 ? (
                            <Badge color="red">{group.sensitiveCount} sensitive</Badge>
                          ) : null}
                          {showAllCatalog ? (
                            <span className="text-xs text-erp-muted">
                              of {group.totalCount} in catalog
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                    {open ? (
                      <ul className="divide-y divide-erp-border border-t border-erp-border">
                        {group.permissions.map((perm) => {
                          const isGranted = granted.has(perm.name)
                          if (!showAllCatalog && !isGranted) return null
                          const sensitive = isAdminSensitivePermission(perm.name)
                          return (
                            <li
                              key={perm.id || perm.name}
                              className={cn(
                                'flex items-start gap-3 px-4 py-2.5',
                                isGranted ? 'bg-emerald-50/40' : 'bg-white',
                              )}
                            >
                              <span
                                className={cn(
                                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                                  isGranted ? 'bg-emerald-500' : 'bg-erp-border',
                                )}
                                aria-hidden
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-sm font-medium text-erp-text">
                                    {adminPermissionDisplayLabel(perm.name, perm.description)}
                                  </span>
                                  {isGranted ? <Badge color="green">Granted</Badge> : <Badge color="gray">Not granted</Badge>}
                                  {sensitive ? <AdminSensitivePermissionBadge /> : null}
                                </div>
                                {perm.description?.trim() ? (
                                  <p className="mt-0.5 text-xs text-erp-muted">{perm.description}</p>
                                ) : null}
                                <p className="mt-0.5 font-mono text-[11px] text-erp-muted">{perm.name}</p>
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    ) : null}
                  </div>
                )
              })}
            </div>
          )}
        </DetailSection>
      </div>
    </DetailLayout>
  )
}

type RolePermissionModuleGroup = {
  module: string
  label: string
  permissions: AdminPermission[]
  grantedCount: number
  sensitiveCount: number
  totalCount: number
}

function buildRolePermissionModules(
  detail: AdminRoleDetail,
  catalog: AdminPermission[],
  opts: { search: string; showAllCatalog: boolean },
): RolePermissionModuleGroup[] {
  const granted = new Set(detail.permissions)
  const byName = new Map(catalog.map((p) => [p.name, p]))

  // Ensure granted permissions appear even if catalog hydration lagged
  for (const name of detail.permissions) {
    if (!byName.has(name)) {
      const module = name.split('.')[0] || 'other'
      byName.set(name, {
        id: name,
        name,
        module,
        description: null,
      })
    }
  }

  const source = opts.showAllCatalog
    ? [...byName.values()]
    : detail.permissions
        .map((name) => byName.get(name))
        .filter((p): p is AdminPermission => Boolean(p))

  const q = opts.search.trim().toLowerCase()
  const filtered = q
    ? source.filter((p) => {
        const label = adminPermissionDisplayLabel(p.name, p.description).toLowerCase()
        const moduleLabel = adminModuleLabel(p.module).toLowerCase()
        return (
          p.name.toLowerCase().includes(q) ||
          label.includes(q) ||
          moduleLabel.includes(q) ||
          (p.description ?? '').toLowerCase().includes(q)
        )
      })
    : source

  const groups = new Map<string, AdminPermission[]>()
  for (const perm of filtered) {
    const list = groups.get(perm.module) ?? []
    list.push(perm)
    groups.set(perm.module, list)
  }

  return [...groups.entries()]
    .map(([module, permissions]) => {
      const sorted = permissions.slice().sort((a, b) => a.name.localeCompare(b.name))
      const grantedCount = sorted.filter((p) => granted.has(p.name)).length
      return {
        module,
        label: adminModuleLabel(module),
        permissions: sorted,
        grantedCount,
        sensitiveCount: sorted.filter((p) => granted.has(p.name) && isAdminSensitivePermission(p.name)).length,
        totalCount: sorted.length,
      }
    })
    .filter((g) => (opts.showAllCatalog ? true : g.grantedCount > 0))
    .sort((a, b) => a.label.localeCompare(b.label))
}
