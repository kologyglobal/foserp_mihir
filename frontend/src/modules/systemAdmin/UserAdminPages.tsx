import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, Pencil, Power, PowerOff, Trash2, UserPlus, X } from 'lucide-react'
import { MasterRegisterTable } from '../../components/masters/MasterRegisterTable'
import { MasterListShell } from '../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../components/masters/MasterLayouts'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/forms/FormField'
import { Input, Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { EnterpriseRowActionsMenu, type RowActionItem } from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { MasterLifecycleDialog } from '../../components/masters/MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import { AdminEffectiveAccessPanel, AdminUserAccessPanels, AdminUserOverridesPanel, AdminUserStatusBadge } from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { isApiMode } from '../../config/apiConfig'
import { DATA_ACCESS_LEVELS } from '../../config/adminAccessWorkspace'
import {
  fetchAdminDepartmentsApi,
  fetchAdminUserSessionsApi,
  lockAdminUserApi,
  resendAdminInvitationApi,
  revokeAdminUserSessionsApi,
  unlockAdminUserApi,
  bulkAdminUsersApi,
  previewCopyAdminAccessApi,
  applyCopyAdminAccessApi,
  fetchAdminUserApprovalLimitsApi,
  patchAdminUserDataAccessLevelApi,
  type AdminDepartment,
  type AdminUserSession,
} from '../../services/api/adminApi'
import { listBranches } from '../../services/bridges/financeApiBridge'
import { useMasterStore } from '../../store/masterStore'
import { useAdminStore } from '../../store/adminStore'
import { resolveMaybeId, resolveStoreAction, type MaybePromise, type StoreActionResult } from '../../store/storeAction'
import { formatApiError } from '../../services/api/apiErrors'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'
import type { AdminUserStatus } from '../../types/admin'

function wrapVoid(fn: (id: string) => MaybePromise<StoreActionResult>) {
  return async (id: string) => {
    const res = await resolveStoreAction(fn(id))
    if (!res.ok) throw new Error(res.error ?? 'Operation failed')
  }
}

function UserRowActions({ userId, status, canEdit }: { userId: string; status: AdminUserStatus; canEdit: boolean }) {
  const deleteUser = useAdminStore((s) => s.deleteUser)
  const activateUser = useAdminStore((s) => s.activateUser)
  const deactivateUser = useAdminStore((s) => s.deactivateUser)
  const lifecycle = useMasterLifecycle({
    delete: wrapVoid(deleteUser),
    activate: wrapVoid(activateUser),
    deactivate: wrapVoid(deactivateUser),
  })

  const actions: RowActionItem[] = [{ id: 'view', label: 'View', icon: Eye, to: `/admin/users/${userId}` }]
  if (canEdit) {
    actions.push({ id: 'edit', label: 'Edit', icon: Pencil, to: `/admin/users/${userId}/edit` })
    if (status === 'ACTIVE') {
      actions.push({ id: 'deactivate', label: 'Deactivate', icon: PowerOff, onClick: () => lifecycle.open('deactivate', userId, 'User') })
    } else if (status !== 'ARCHIVED') {
      actions.push({ id: 'activate', label: 'Activate', icon: Power, onClick: () => lifecycle.open('activate', userId, 'User') })
    }
    if (status !== 'ARCHIVED') {
      actions.push({ id: 'delete', label: 'Deactivate & Archive', icon: Trash2, danger: true, separator: true, onClick: () => lifecycle.open('delete', userId, 'User') })
    }
  }

  return (
    <>
      <EnterpriseRowActionsMenu actions={actions} />
      <MasterLifecycleDialog
        open={Boolean(lifecycle.dialog)}
        action={lifecycle.dialog?.action ?? 'delete'}
        recordLabel={lifecycle.dialog?.label ?? 'User'}
        error={lifecycle.error}
        pending={lifecycle.pending}
        onConfirm={() => void lifecycle.confirm()}
        onCancel={lifecycle.close}
      />
    </>
  )
}

export function UserAdminListPage() {
  const users = useAdminStore((s) => s.users)
  const roles = useAdminStore((s) => s.roles)
  const canCreate = canAdminPermission('user.create')
  const canEdit = canAdminPermission('user.update')
  const canAssign = canAdminPermission('user.assign_role')
  const canScope = canAdminPermission('scope.manage') || canEdit
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [roleFilter, setRoleFilter] = useState('all')
  const [noRolesOnly, setNoRolesOnly] = useState(false)
  const [sensitiveOnly, setSensitiveOnly] = useState(false)
  const [hasOverridesOnly, setHasOverridesOnly] = useState(false)
  const [scopeFilter, setScopeFilter] = useState('all')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkRoleId, setBulkRoleId] = useState('')
  const [bulkScope, setBulkScope] = useState('')
  const [bulkBranchId, setBulkBranchId] = useState('')
  const [bulkWarehouseId, setBulkWarehouseId] = useState('')
  const [bulkBusy, setBulkBusy] = useState(false)
  const [branchOptions, setBranchOptions] = useState<Array<{ id: string; label: string }>>([])
  const allWarehouses = useMasterStore((s) => s.warehouses)
  const warehouses = useMemo(() => allWarehouses.filter((w) => w.isActive), [allWarehouses])

  useEffect(() => {
    void listBranches()
      .then((rows) =>
        setBranchOptions(rows.map((b) => ({ id: b.id, label: `${b.code} — ${b.name}` }))),
      )
      .catch(() => setBranchOptions([]))
  }, [])

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const s = search.toLowerCase()
        const statusOk =
          status === 'all' ||
          (status === 'active' && u.status === 'ACTIVE') ||
          (status === 'inactive' && u.status === 'INACTIVE') ||
          (status === 'invited' && u.status === 'INVITED') ||
          (status === 'blocked' && u.status === 'BLOCKED')
        const name = `${u.firstName} ${u.lastName}`.toLowerCase()
        const roleOk =
          roleFilter === 'all' || u.roles.some((r) => r.id === roleFilter || r.name === roleFilter)
        const noRolesOk = !noRolesOnly || u.roles.length === 0
        const sensitiveOk = !sensitiveOnly || Boolean(u.sensitiveAccess)
        const overridesOk = !hasOverridesOnly || (u.overrideCount ?? 0) > 0
        const scopeOk =
          scopeFilter === 'all' ||
          (u.dataAccessLevel ?? 'ALL') === scopeFilter
        return (
          statusOk &&
          roleOk &&
          noRolesOk &&
          sensitiveOk &&
          overridesOk &&
          scopeOk &&
          (name.includes(s) || u.email.toLowerCase().includes(s) || (u.designation ?? '').toLowerCase().includes(s))
        )
      }),
    [users, search, status, roleFilter, noRolesOnly, sensitiveOnly, hasOverridesOnly, scopeFilter],
  )

  function toggleAll(checked: boolean) {
    setSelected(checked ? new Set(filtered.map((u) => u.id)) : new Set())
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  async function runBulk(action: string) {
    if (!selected.size) {
      notify.error('Select at least one user')
      return
    }
    setBulkBusy(true)
    try {
      if (isApiMode()) {
        await bulkAdminUsersApi({
          userIds: [...selected],
          action,
          roleId: bulkRoleId || undefined,
          branchId: bulkBranchId || undefined,
          warehouseId: bulkWarehouseId || undefined,
          dataAccessLevel: bulkScope || undefined,
        })
        notify.success(`Bulk ${action} applied to ${selected.size} user(s)`)
      } else {
        for (const id of selected) {
          if (action === 'activate') await resolveStoreAction(useAdminStore.getState().activateUser(id))
          if (action === 'deactivate') await resolveStoreAction(useAdminStore.getState().deactivateUser(id))
          if (action === 'assign_role' && bulkRoleId) {
            await resolveStoreAction(useAdminStore.getState().assignUserRole(id, bulkRoleId))
          }
          if (action === 'remove_role' && bulkRoleId) {
            await resolveStoreAction(useAdminStore.getState().removeUserRole(id, bulkRoleId))
          }
          if (action === 'set_data_access_level' && bulkScope) {
            // Demo: no field on store model yet — noop success
          }
        }
        notify.success(`Demo bulk ${action} complete`)
      }
      setSelected(new Set())
    } catch (e) {
      notify.error(formatApiError(e))
    } finally {
      setBulkBusy(false)
    }
  }

  const columns: ColumnDef<(typeof users)[number], unknown>[] = [
    {
      id: 'select',
      header: () => (
        <input
          type="checkbox"
          checked={filtered.length > 0 && selected.size === filtered.length}
          onChange={(e) => toggleAll(e.target.checked)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          checked={selected.has(row.original.id)}
          onChange={(e) => toggleOne(row.original.id, e.target.checked)}
          aria-label={`Select ${row.original.email}`}
        />
      ),
    },
    {
      id: 'user',
      header: 'User',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-erp-text">
            {row.original.firstName} {row.original.lastName}
          </div>
          <div className="text-xs text-erp-muted">{row.original.email}</div>
        </div>
      ),
    },
    {
      id: 'primaryRole',
      header: 'Primary Role',
      cell: ({ row }) =>
        row.original.roles[0] ? (
          <Badge color="blue">{row.original.roles[0].name}</Badge>
        ) : (
          <span className="text-xs text-amber-700">No roles</span>
        ),
    },
    {
      id: 'branch',
      header: 'Branch',
      cell: ({ row }) => (
        <span className="text-xs">
          {row.original.primaryBranchName || row.original.department || '-'}
        </span>
      ),
    },
    {
      id: 'scope',
      header: 'Scope',
      cell: ({ row }) => (
        <Badge color="gray">{row.original.dataAccessLevel ?? 'ALL'}</Badge>
      ),
    },
    {
      id: 'sensitive',
      header: 'Sensitive',
      cell: ({ row }) =>
        row.original.sensitiveAccess ? (
          <Badge color="red">Yes</Badge>
        ) : (
          <span className="text-xs text-erp-muted">-</span>
        ),
    },
    {
      id: 'overrides',
      header: 'Overrides',
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.overrideCount ?? 0}</span>
      ),
    },
    {
      id: 'sessions',
      header: 'Sessions',
      cell: ({ row }) => (
        <span className="text-xs tabular-nums">{row.original.activeSessionCount ?? '-'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => <AdminUserStatusBadge status={row.original.status} />,
    },
    {
      id: 'lastLogin',
      header: 'Last Login',
      cell: ({ row }) => (
        <span className="text-xs text-erp-muted">
          {row.original.lastLoginAt ? new Date(row.original.lastLoginAt).toLocaleString() : 'Never'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => <UserRowActions userId={row.original.id} status={row.original.status} canEdit={canEdit} />,
    },
  ]

  return (
    <MasterListShell
      title="Users"
      badge="Admin"
      description="Manage 30–100 users: roles, bulk assign, scopes, lifecycle"
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Users' }]}
      favoritePath="/admin/users"
      createLabel="Invite User"
      createTo={canCreate ? '/admin/users/new' : '#'}
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={[
        { value: 'all', label: 'All statuses' },
        { value: 'active', label: 'Active' },
        { value: 'invited', label: 'Invited' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'blocked', label: 'Blocked' },
      ]}
      resultCount={filtered.length}
      stats={[
        { label: 'Users', value: users.length },
        { label: 'Active', value: users.filter((u) => u.status === 'ACTIVE').length, accent: 'green' },
        { label: 'No roles', value: users.filter((u) => u.roles.length === 0).length, accent: 'amber' },
        { label: 'Selected', value: selected.size },
      ]}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-white px-3 py-2">
        <label className="text-xs">
          Role filter
          <Select className="ml-1" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value="all">All roles</option>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
        </label>
        <label className="text-xs">
          Scope
          <Select className="ml-1" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
            <option value="all">All scopes</option>
            {DATA_ACCESS_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={noRolesOnly} onChange={(e) => setNoRolesOnly(e.target.checked)} />
          No roles
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={sensitiveOnly} onChange={(e) => setSensitiveOnly(e.target.checked)} />
          Sensitive access
        </label>
        <label className="flex items-center gap-1 text-xs">
          <input type="checkbox" checked={hasOverridesOnly} onChange={(e) => setHasOverridesOnly(e.target.checked)} />
          Has overrides
        </label>
        <span className="text-erp-muted">|</span>
        <Select value={bulkRoleId} onChange={(e) => setBulkRoleId(e.target.value)} className="text-xs">
          <option value="">{SELECT_PLACEHOLDER} role for bulk</option>
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </Select>
        <ErpButton size="sm" type="button" disabled={!canAssign || bulkBusy} onClick={() => void runBulk('assign_role')}>
          Assign Role
        </ErpButton>
        <ErpButton size="sm" type="button" variant="secondary" disabled={!canAssign || bulkBusy} onClick={() => void runBulk('remove_role')}>
          Remove Role
        </ErpButton>
        <Select value={bulkScope} onChange={(e) => setBulkScope(e.target.value)} className="text-xs">
          <option value="">{SELECT_PLACEHOLDER} scope</option>
          {DATA_ACCESS_LEVELS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </Select>
        <ErpButton
          size="sm"
          type="button"
          variant="secondary"
          disabled={!canScope || bulkBusy || !bulkScope}
          onClick={() => void runBulk('set_data_access_level')}
        >
          Change Scope
        </ErpButton>
        <Select value={bulkBranchId} onChange={(e) => setBulkBranchId(e.target.value)} className="text-xs">
          <option value="">{SELECT_PLACEHOLDER} branch</option>
          {branchOptions.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </Select>
        <ErpButton
          size="sm"
          type="button"
          variant="secondary"
          disabled={!canScope || bulkBusy || !bulkBranchId}
          onClick={() => void runBulk('assign_branch')}
        >
          Assign Branch
        </ErpButton>
        <Select value={bulkWarehouseId} onChange={(e) => setBulkWarehouseId(e.target.value)} className="text-xs">
          <option value="">{SELECT_PLACEHOLDER} warehouse</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.warehouseCode} — {w.warehouseName}
            </option>
          ))}
        </Select>
        <ErpButton
          size="sm"
          type="button"
          variant="secondary"
          disabled={!canScope || bulkBusy || !bulkWarehouseId}
          onClick={() => void runBulk('assign_warehouse')}
        >
          Assign Warehouse
        </ErpButton>
        <ErpButton size="sm" type="button" variant="secondary" disabled={!canEdit || bulkBusy} onClick={() => void runBulk('activate')}>
          Activate
        </ErpButton>
        <ErpButton size="sm" type="button" variant="secondary" disabled={!canEdit || bulkBusy} onClick={() => void runBulk('deactivate')}>
          Deactivate
        </ErpButton>
        <ErpButton size="sm" type="button" variant="secondary" disabled={!canEdit || bulkBusy} onClick={() => void runBulk('revoke_sessions')}>
          Revoke Sessions
        </ErpButton>
      </div>
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

const createSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  mobile: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
})

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Valid email is required'),
  mobile: z.string().optional(),
  designation: z.string().optional(),
  departmentId: z.string().optional(),
  status: z.enum(['INVITED', 'ACTIVE', 'INACTIVE', 'BLOCKED', 'ARCHIVED']),
})

type CreateFormData = z.infer<typeof createSchema>
type EditFormData = z.infer<typeof editSchema>

const DEMO_DEPT_KEY = 'fos-admin-departments-demo'

function useDepartmentOptions() {
  const [options, setOptions] = useState<AdminDepartment[]>([])
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        if (isApiMode()) {
          const rows = await fetchAdminDepartmentsApi({ active: 'true' })
          if (!cancelled) setOptions(rows)
          return
        }
        const raw = localStorage.getItem(DEMO_DEPT_KEY)
        const rows = raw ? (JSON.parse(raw) as AdminDepartment[]) : []
        if (!cancelled) setOptions(rows.filter((d) => d.isActive))
      } catch {
        if (!cancelled) setOptions([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])
  return options
}

export function UserAdminFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useAdminStore((s) => (id ? s.getUser(id) : undefined))
  const roles = useAdminStore((s) => s.roles)
  const createUser = useAdminStore((s) => s.createUser)
  const updateUser = useAdminStore((s) => s.updateUser)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>(existing?.roles.map((r) => r.id) ?? [])

  if (id && !existing) return <MasterNotFound message="User not found." />

  if (isEdit) {
    return (
      <UserEditForm
        existing={existing!}
        updateUser={updateUser}
        saveError={saveError}
        setSaveError={setSaveError}
        navigate={navigate}
      />
    )
  }

  return (
    <CreateUserForm
      roles={roles}
      selectedRoleIds={selectedRoleIds}
      setSelectedRoleIds={setSelectedRoleIds}
      createUser={createUser}
      saveError={saveError}
      setSaveError={setSaveError}
      navigate={navigate}
    />
  )
}

function CreateUserForm({
  roles,
  selectedRoleIds,
  setSelectedRoleIds,
  createUser,
  saveError,
  setSaveError,
  navigate,
}: {
  roles: ReturnType<typeof useAdminStore.getState>['roles']
  selectedRoleIds: string[]
  setSelectedRoleIds: (ids: string[]) => void
  createUser: ReturnType<typeof useAdminStore.getState>['createUser']
  saveError: string | null
  setSaveError: (v: string | null) => void
  navigate: (path: string) => void
}) {
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema) as Resolver<CreateFormData>,
    defaultValues: { firstName: '', lastName: '', email: '', password: '', mobile: '', designation: '', departmentId: '' },
  })
  const departments = useDepartmentOptions()
  const [step, setStep] = useState(0)
  const [dataAccessLevel, setDataAccessLevel] = useState('ALL')
  const values = watch()

  const steps = ['Details', 'Role', 'Org', 'Scope', 'Preview', 'Invite'] as const

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (step < steps.length - 1) {
      // advance after light validation on early steps
      if (step === 0) {
        void handleSubmit(async () => setStep(1))()
        return
      }
      if (step === 1 && selectedRoleIds.length === 0) {
        setSaveError('Select at least one role (or continue and assign later from user detail).')
      }
      setSaveError(null)
      setStep((s) => Math.min(s + 1, steps.length - 1))
      return
    }
    void handleSubmit(async (data) => {
      setSaveError(null)
      try {
        const dept = departments.find((d) => d.id === data.departmentId)
        const res = await resolveStoreAction(
          createUser({
            ...data,
            departmentId: data.departmentId || null,
            department: dept?.name,
            roleIds: selectedRoleIds,
          }),
        )
        if (!res.ok) {
          setSaveError(res.error ?? 'Failed to create user')
          return
        }
        if (isApiMode() && dataAccessLevel && dataAccessLevel !== 'ALL' && res.userId) {
          try {
            await patchAdminUserDataAccessLevelApi(res.userId, dataAccessLevel)
          } catch {
            /* non-blocking */
          }
        }
        notify.success('User invited')
        navigate(`/admin/users/${res.userId}`)
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  function toggleRole(roleId: string) {
    setSelectedRoleIds(selectedRoleIds.includes(roleId) ? selectedRoleIds.filter((r) => r !== roleId) : [...selectedRoleIds, roleId])
  }

  const selectedRoleNames = roles.filter((r) => selectedRoleIds.includes(r.id)).map((r) => r.name)
  const deptName = departments.find((d) => d.id === values.departmentId)?.name

  return (
    <FormLayout
      backTo="/admin/users"
      backLabel="Back to Users"
      title="Invite User"
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: 'Invite' }]}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={validationErrors}
      onCancel={() => navigate('/admin/users')}
      submitLabel={step === steps.length - 1 ? 'Invite' : 'Continue'}
    >
      <div className="md:col-span-2 mb-2 flex flex-wrap gap-2">
        {steps.map((label, i) => (
          <button
            key={label}
            type="button"
            onClick={() => setStep(i)}
            className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
              i === step ? 'bg-erp-primary text-white' : i < step ? 'bg-emerald-50 text-emerald-800' : 'bg-erp-surface-alt text-erp-muted'
            }`}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {step === 0 ? (
        <FormSection title="User Details">
          <FormField label="First Name" required error={errors.firstName?.message}><Input {...register('firstName')} error={!!errors.firstName} /></FormField>
          <FormField label="Last Name" required error={errors.lastName?.message}><Input {...register('lastName')} error={!!errors.lastName} /></FormField>
          <FormField label="Email" required error={errors.email?.message}><Input type="email" {...register('email')} error={!!errors.email} /></FormField>
          <FormField label="Temporary Password" required hint="User can change this after first login" error={errors.password?.message}><Input type="password" {...register('password')} error={!!errors.password} /></FormField>
          <FormField label="Mobile"><Input {...register('mobile')} /></FormField>
          <FormField label="Designation"><Input {...register('designation')} /></FormField>
        </FormSection>
      ) : null}

      {step === 1 ? (
        <FormSection title="Roles" className="md:col-span-2">
          <div className="md:col-span-2 flex flex-wrap gap-2">
            {roles.length === 0 && <p className="text-sm text-erp-muted">No roles available.</p>}
            {roles.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => toggleRole(role.id)}
                className={selectedRoleIds.includes(role.id) ? 'erp-badge-soft-info rounded-md px-2.5 py-1 text-xs font-semibold' : 'erp-badge-soft-neutral rounded-md px-2.5 py-1 text-xs font-semibold'}
              >
                {role.name}
              </button>
            ))}
          </div>
        </FormSection>
      ) : null}

      {step === 2 ? (
        <FormSection title="Organization">
          <FormField label="Department">
            <Select {...register('departmentId')}>
              <option value="">{SELECT_PLACEHOLDER}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </Select>
          </FormField>
          <p className="md:col-span-2 text-xs text-erp-muted">
            Branch and warehouse grants can be set after invite on the user detail Data Scope panel, or via bulk assign on the register.
          </p>
        </FormSection>
      ) : null}

      {step === 3 ? (
        <FormSection title="Data access level" className="md:col-span-2">
          <FormField label="Default visibility tier">
            <Select value={dataAccessLevel} onChange={(e) => setDataAccessLevel(e.target.value)}>
              {DATA_ACCESS_LEVELS.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label} — {l.description}
                </option>
              ))}
            </Select>
          </FormField>
        </FormSection>
      ) : null}

      {step === 4 || step === 5 ? (
        <FormSection title={step === 4 ? 'Effective preview' : 'Confirm invite'} className="md:col-span-2">
          <div className="md:col-span-2 space-y-2 rounded-lg border border-erp-border bg-erp-surface-alt/40 p-4 text-sm">
            <p><span className="text-erp-muted">Name:</span> {values.firstName} {values.lastName}</p>
            <p><span className="text-erp-muted">Email:</span> {values.email}</p>
            <p><span className="text-erp-muted">Roles:</span> {selectedRoleNames.join(', ') || 'None'}</p>
            <p><span className="text-erp-muted">Department:</span> {deptName || '-'}</p>
            <p><span className="text-erp-muted">Data scope level:</span> {dataAccessLevel}</p>
            <p className="text-xs text-erp-muted">
              Full effective permission list is available after invite on the user detail Effective Access panel
              {isApiMode() ? ' (API).' : ' (API mode).'}
            </p>
          </div>
          {step === 5 ? (
            <p className="md:col-span-2 text-sm text-erp-muted">Click Invite to create the user with the temporary password.</p>
          ) : null}
          {step > 0 ? (
            <div className="md:col-span-2">
              <ErpButton type="button" size="sm" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </ErpButton>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      {step > 0 && step < 4 ? (
        <div className="md:col-span-2">
          <ErpButton type="button" size="sm" variant="secondary" onClick={() => setStep((s) => Math.max(0, s - 1))}>
            Back
          </ErpButton>
        </div>
      ) : null}
    </FormLayout>
  )
}

function UserEditForm({
  existing,
  updateUser,
  saveError,
  setSaveError,
  navigate,
}: {
  existing: NonNullable<ReturnType<typeof useAdminStore.getState>['getUser']> extends never ? never : ReturnType<ReturnType<typeof useAdminStore.getState>['getUser']> extends undefined ? never : ReturnType<typeof useAdminStore.getState>['users'][number]
  updateUser: ReturnType<typeof useAdminStore.getState>['updateUser']
  saveError: string | null
  setSaveError: (v: string | null) => void
  navigate: (path: string) => void
}) {
  const departments = useDepartmentOptions()
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema) as Resolver<EditFormData>,
    defaultValues: {
      firstName: existing.firstName,
      lastName: existing.lastName,
      email: existing.email,
      mobile: existing.mobile ?? '',
      designation: existing.designation ?? '',
      departmentId: existing.departmentId ?? '',
      status: existing.status,
    },
  })

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    void handleSubmit(async (data) => {
      setSaveError(null)
      try {
        const dept = departments.find((d) => d.id === data.departmentId)
        const res = await resolveStoreAction(
          updateUser(existing.id, {
            ...data,
            departmentId: data.departmentId || null,
            department: dept?.name ?? null,
          }),
        )
        if (!res.ok) {
          setSaveError(res.error ?? 'Failed to save user')
          return
        }
        notify.success('User saved')
        navigate(`/admin/users/${existing.id}`)
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  return (
    <FormLayout
      backTo="/admin/users"
      backLabel="Back to Users"
      title="Edit User"
      isEdit
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: `${existing.firstName} ${existing.lastName}` }]}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={validationErrors}
      onCancel={() => navigate(`/admin/users/${existing.id}`)}
    >
      <FormSection title="User Details">
        <FormField label="First Name" required error={errors.firstName?.message}><Input {...register('firstName')} error={!!errors.firstName} /></FormField>
        <FormField label="Last Name" required error={errors.lastName?.message}><Input {...register('lastName')} error={!!errors.lastName} /></FormField>
        <FormField label="Email" required error={errors.email?.message}><Input type="email" {...register('email')} error={!!errors.email} /></FormField>
        <FormField label="Mobile"><Input {...register('mobile')} /></FormField>
        <FormField label="Designation"><Input {...register('designation')} /></FormField>
        <FormField label="Department">
          <Select {...register('departmentId')}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Status" required>
          <Select {...register('status')}>
            <option value="INVITED">Invited</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="BLOCKED">Blocked</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </FormField>
      </FormSection>
    </FormLayout>
  )
}

export function UserAdminDetailPage() {
  const { id } = useParams()
  const user = useAdminStore((s) => (id ? s.getUser(id) : undefined))
  const roles = useAdminStore((s) => s.roles)
  const allUsers = useAdminStore((s) => s.users)
  const assignUserRole = useAdminStore((s) => s.assignUserRole)
  const removeUserRole = useAdminStore((s) => s.removeUserRole)
  const canAssign = canAdminPermission('user.assign_role')
  const canEdit = canAdminPermission('user.update')
  const canInvite = canAdminPermission('user.create')
  const canSecurity = canAdminPermission('security.manage')
  const canScope = canAdminPermission('scope.manage') || canEdit
  const updateUser = useAdminStore((s) => s.updateUser)
  const [pendingRoleId, setPendingRoleId] = useState('')
  const [roleError, setRoleError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessions, setSessions] = useState<AdminUserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [copyFromUserId, setCopyFromUserId] = useState('')
  const [copyPreview, setCopyPreview] = useState<{
    from: {
      name: string
      email: string
      roles: { name: string }[]
      overrides: { permissionName: string; effect: string }[]
      branchIds: string[]
      warehouseIds: string[]
      dataAccessLevel?: string
    }
  } | null>(null)
  const [approvalRules, setApprovalRules] = useState<Array<Record<string, unknown>>>([])
  const [dataAccessLevel, setDataAccessLevel] = useState(user?.dataAccessLevel ?? 'ALL')

  useEffect(() => {
    if (!id || !isApiMode()) {
      setSessions([])
      return
    }
    let cancelled = false
    setSessionsLoading(true)
    void fetchAdminUserSessionsApi(id)
      .then((res) => {
        if (!cancelled) setSessions(res.data)
      })
      .catch(() => {
        if (!cancelled) setSessions([])
      })
      .finally(() => {
        if (!cancelled) setSessionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!id || !isApiMode()) {
      setApprovalRules([])
      return
    }
    void fetchAdminUserApprovalLimitsApi(id)
      .then((res) => setApprovalRules(res.data))
      .catch(() => setApprovalRules([]))
  }, [id])

  useEffect(() => {
    if (user?.dataAccessLevel) setDataAccessLevel(user.dataAccessLevel)
  }, [user?.dataAccessLevel])

  if (!user) return <MasterNotFound message="User not found." />

  const availableRoles = roles.filter((r) => !user.roles.some((ur) => ur.id === r.id))
  const copyCandidates = allUsers.filter((u) => u.id !== user.id)

  async function handleAssign() {
    if (!user || !pendingRoleId) return
    setBusy(true)
    setRoleError(null)
    try {
      const res = await resolveStoreAction(assignUserRole(user.id, pendingRoleId))
      if (!res.ok) setRoleError(res.error ?? 'Failed to assign role')
      else { notify.success('Role assigned'); setPendingRoleId('') }
    } catch (err) {
      setRoleError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(roleId: string) {
    if (!user) return
    setBusy(true)
    setRoleError(null)
    try {
      const res = await resolveStoreAction(removeUserRole(user.id, roleId))
      if (!res.ok) setRoleError(res.error ?? 'Failed to remove role')
      else notify.success('Role removed')
    } catch (err) {
      setRoleError(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleResendInvite() {
    if (!user) return
    const ok = await appConfirm({
      title: 'Resend invitation?',
      description: 'Issues a new invite link and revokes the previous one.',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (isApiMode()) {
        const res = await resendAdminInvitationApi(user.id)
        notify.success(
          res.data.inviteToken
            ? `Invitation resent. Dev token: ${res.data.inviteToken}`
            : 'Invitation resent',
        )
      } else {
        notify.success('Demo invitation resent')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleRevokeSessions() {
    if (!user) return
    const ok = await appConfirm({
      title: 'Revoke all sessions?',
      description: 'Signs the user out of every active device. They must sign in again.',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (isApiMode()) {
        const res = await revokeAdminUserSessionsApi(user.id)
        notify.success(`Revoked ${res.data.revokedSessions} session(s)`)
        setSessions([])
      } else {
        notify.success('Demo sessions revoked')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleLock() {
    if (!user) return
    const ok = await appConfirm({
      title: 'Lock account?',
      description: 'Sets status to BLOCKED and revokes all sessions.',
      tone: 'danger',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (isApiMode()) {
        const res = await lockAdminUserApi(user.id)
        notify.success(`Locked · revoked ${res.data.revokedSessions} session(s)`)
        await resolveStoreAction(updateUser(user.id, { status: 'BLOCKED' }))
        setSessions([])
      } else {
        await resolveStoreAction(updateUser(user.id, { status: 'BLOCKED' }))
        notify.success('Demo account locked')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function handleUnlock() {
    if (!user) return
    const ok = await appConfirm({
      title: 'Unlock account?',
      description: 'Sets status to ACTIVE and clears failed-login counter.',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (isApiMode()) {
        await unlockAdminUserApi(user.id)
        notify.success('Account unlocked')
        await resolveStoreAction(updateUser(user.id, { status: 'ACTIVE' }))
      } else {
        await resolveStoreAction(updateUser(user.id, { status: 'ACTIVE' }))
        notify.success('Demo account unlocked')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  async function loadCopyPreview(fromId: string) {
    setCopyFromUserId(fromId)
    setCopyPreview(null)
    if (!fromId || !user) return
    if (!isApiMode()) {
      const from = allUsers.find((u) => u.id === fromId)
      if (!from) return
      setCopyPreview({
        from: {
          name: `${from.firstName} ${from.lastName}`,
          email: from.email,
          roles: from.roles.map((r) => ({ name: r.name })),
          overrides: [],
          branchIds: [],
          warehouseIds: [],
          dataAccessLevel: from.dataAccessLevel,
        },
      })
      return
    }
    try {
      const preview = await previewCopyAdminAccessApi(user.id, fromId)
      setCopyPreview(preview.data as typeof copyPreview)
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  async function applyCopy() {
    if (!user || !copyFromUserId) return
    const ok = await appConfirm({
      title: 'Copy access?',
      description: copyPreview
        ? `From ${copyPreview.from.name}: roles ${copyPreview.from.roles.map((r) => r.name).join(', ') || 'none'}; ${copyPreview.from.overrides.length} override(s); scope ${copyPreview.from.dataAccessLevel ?? 'ALL'}.`
        : 'Applies roles, scopes, overrides, and data access level.',
      confirmLabel: 'Copy access',
    })
    if (!ok) return
    setBusy(true)
    try {
      if (isApiMode()) {
        await applyCopyAdminAccessApi(user.id, {
          fromUserId: copyFromUserId,
          includeRoles: true,
          includeScopes: true,
          includeOverrides: true,
          includeDataAccessLevel: true,
        })
        notify.success('Access copied — reopen user detail to refresh roles')
      } else {
        for (const role of allUsers.find((u) => u.id === copyFromUserId)?.roles ?? []) {
          await resolveStoreAction(assignUserRole(user.id, role.id))
        }
        notify.success('Demo roles copied')
      }
    } catch (err) {
      notify.error(formatApiError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <DetailLayout
      backTo="/admin/users"
      backLabel="Back to Users"
      title={`${user.firstName} ${user.lastName}`}
      subtitle={user.email}
      editTo={canEdit ? `/admin/users/${user.id}/edit` : undefined}
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Users', to: '/admin/users' }, { label: `${user.firstName} ${user.lastName}` }]}
      badges={<AdminUserStatusBadge status={user.status} />}
    >
      <div className="space-y-6">
        <DetailSection title="Profile">
          <DetailGrid>
            <DetailField label="Email" value={user.email} />
            <DetailField label="Mobile" value={user.mobile} />
            <DetailField label="Designation" value={user.designation} />
            <DetailField label="Department" value={user.department} />
            <DetailField label="Branch" value={user.primaryBranchName ?? '-'} />
            <DetailField label="Data access level" value={user.dataAccessLevel ?? dataAccessLevel} />
            <DetailField label="Email Verified" value={user.emailVerified ? 'Yes' : 'No'} />
            <DetailField label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'} />
            <DetailField label="Overrides" value={String(user.overrideCount ?? '-')} />
            <DetailField label="Active sessions" value={String(user.activeSessionCount ?? sessions.length)} />
          </DetailGrid>
          {user.status === 'INVITED' && canInvite ? (
            <div className="mt-3">
              <ErpButton size="sm" type="button" variant="secondary" disabled={busy} onClick={() => void handleResendInvite()}>
                Resend invitation
              </ErpButton>
            </div>
          ) : null}
          {canScope ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="w-48">
                <Select value={dataAccessLevel} onChange={(e) => setDataAccessLevel(e.target.value)}>
                  {DATA_ACCESS_LEVELS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </Select>
              </div>
              <ErpButton
                size="sm"
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true)
                    try {
                      if (isApiMode()) {
                        await patchAdminUserDataAccessLevelApi(user.id, dataAccessLevel)
                      }
                      notify.success('Data access level saved')
                    } catch (err) {
                      notify.error(formatApiError(err))
                    } finally {
                      setBusy(false)
                    }
                  })()
                }}
              >
                Save scope level
              </ErpButton>
            </div>
          ) : null}
        </DetailSection>

        <DetailSection title="Roles">
          <div className="space-y-3">
            {roleError && <p className="text-sm font-medium text-erp-danger-fg">{roleError}</p>}
            <div className="flex flex-wrap gap-2">
              {user.roles.length === 0 && <p className="text-sm text-erp-muted">No roles assigned.</p>}
              {user.roles.map((role) => (
                <span key={role.id} className="inline-flex items-center gap-1.5 rounded-md bg-erp-badge-soft-info px-2.5 py-1 text-xs font-semibold erp-badge-soft-info">
                  {role.name}
                  {canAssign && (
                    <button type="button" onClick={() => void handleRemove(role.id)} disabled={busy} className="text-erp-muted hover:text-erp-danger-fg" title="Remove role">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canAssign && (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-56">
                  <Select value={pendingRoleId} onChange={(e) => setPendingRoleId(e.target.value)}>
                    <option value="">{SELECT_PLACEHOLDER}</option>
                    {availableRoles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAssign()}
                  disabled={!pendingRoleId || busy}
                  className="erp-btn-secondary inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  <UserPlus className="h-4 w-4" /> Assign Role
                </button>
              </div>
            )}
            {canAssign ? (
              <div className="rounded-lg border border-erp-border bg-erp-surface-alt/30 p-3 space-y-2">
                <p className="text-xs font-semibold text-erp-text">Copy access from user</p>
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] flex-1">
                    <Select value={copyFromUserId} onChange={(e) => void loadCopyPreview(e.target.value)}>
                      <option value="">{SELECT_PLACEHOLDER} source user</option>
                      {copyCandidates.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.firstName} {u.lastName} ({u.email})
                        </option>
                      ))}
                    </Select>
                  </div>
                  <ErpButton size="sm" type="button" disabled={busy || !copyFromUserId} onClick={() => void applyCopy()}>
                    Apply copy
                  </ErpButton>
                </div>
                {copyPreview ? (
                  <p className="text-xs text-erp-muted">
                    Preview: {copyPreview.from.roles.map((r) => r.name).join(', ') || 'no roles'} ·{' '}
                    {copyPreview.from.overrides.length} override(s) · branches {copyPreview.from.branchIds.length} ·
                    warehouses {copyPreview.from.warehouseIds.length} · level{' '}
                    {copyPreview.from.dataAccessLevel ?? 'ALL'}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </DetailSection>

        <DetailSection title="Permission overrides (INHERIT / ALLOW / DENY)">
          <AdminUserOverridesPanel userId={user.id} />
        </DetailSection>

        <DetailSection title="Module Access & Effective Permissions">
          <AdminEffectiveAccessPanel userId={user.id} userName={`${user.firstName} ${user.lastName}`} />
        </DetailSection>

        <DetailSection title="Data Scope · Branches · Legal Entities · Warehouses">
          <AdminUserAccessPanels userId={user.id} />
          <p className="mt-2 text-xs text-erp-muted">
            Tenant-wide bands on{' '}
            <a className="font-semibold text-erp-primary" href="/admin/approval-authority">
              Approval Authority
            </a>
            .
          </p>
        </DetailSection>

        <DetailSection title="Approval limits (user + role bands)">
          {!isApiMode() ? (
            <p className="text-sm text-erp-muted">Approval limit lookup requires API mode.</p>
          ) : approvalRules.length === 0 ? (
            <p className="text-sm text-erp-muted">No active approval authority rules for this user or their roles.</p>
          ) : (
            <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
              {approvalRules.map((r) => (
                <li key={String(r.id)} className="px-3 py-2 text-sm">
                  <span className="font-medium">{String(r.documentType)}</span>
                  <span className="text-erp-muted">
                    {' '}
                    · {String(r.amountFrom)} – {r.amountTo != null ? String(r.amountTo) : '∞'}
                    {r.userId ? ' · user rule' : ' · via role'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </DetailSection>

        <DetailSection title="Sessions">
          <div className="space-y-3">
            <p className="text-xs text-erp-muted">
              Sessions are backed by refresh tokens. Revoking signs the user out everywhere.
            </p>
            <div className="flex flex-wrap gap-2">
              {canEdit ? (
                <ErpButton size="sm" type="button" variant="secondary" disabled={busy} onClick={() => void handleRevokeSessions()}>
                  Revoke all sessions
                </ErpButton>
              ) : null}
              {canSecurity && user.status !== 'BLOCKED' && user.status !== 'ARCHIVED' ? (
                <ErpButton size="sm" type="button" variant="secondary" disabled={busy} onClick={() => void handleLock()}>
                  Lock account
                </ErpButton>
              ) : null}
              {canSecurity && user.status === 'BLOCKED' ? (
                <ErpButton size="sm" type="button" disabled={busy} onClick={() => void handleUnlock()}>
                  Unlock account
                </ErpButton>
              ) : null}
            </div>
            {!isApiMode() ? (
              <p className="text-sm text-erp-muted">Session list is available in API mode.</p>
            ) : sessionsLoading ? (
              <p className="text-sm text-erp-muted">Loading sessions…</p>
            ) : sessions.length === 0 ? (
              <p className="text-sm text-erp-muted">No active sessions.</p>
            ) : (
              <ul className="divide-y divide-erp-border rounded-lg border border-erp-border">
                {sessions.map((s) => (
                  <li key={s.id} className="px-3 py-2 text-sm">
                    <p className="font-medium text-erp-text">{s.userAgent ?? 'Unknown device'}</p>
                    <p className="text-xs text-erp-muted">
                      {s.ipAddress ?? '-'} · started {new Date(s.createdAt).toLocaleString()} · expires{' '}
                      {new Date(s.expiresAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DetailSection>

        <DetailSection title="Audit">
          <p className="text-sm text-erp-muted">
            Lifecycle and override changes write to Admin Audit (
            <a className="font-semibold text-erp-primary" href="/admin/security/audit">
              /admin/security/audit
            </a>
            ).
          </p>
        </DetailSection>
      </div>
    </DetailLayout>
  )
}

export { resolveMaybeId }
