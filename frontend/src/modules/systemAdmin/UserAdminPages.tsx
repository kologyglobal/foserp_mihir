import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, Pencil, Power, PowerOff, Trash2, UserPlus, X } from 'lucide-react'
import { MasterRegisterTable } from '../../components/masters/MasterRegisterTable'
import { MasterListShell, STATUS_FILTER_OPTIONS } from '../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection, MasterNotFound } from '../../components/masters/MasterLayouts'
import { Badge } from '../../components/ui/Badge'
import { FormField } from '../../components/forms/FormField'
import { Input, Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { EnterpriseRowActionsMenu, type RowActionItem } from '../../design-system/enterprise/EnterpriseTablePrimitives'
import { MasterLifecycleDialog } from '../../components/masters/MasterLifecycleDialog'
import { useMasterLifecycle } from '../../hooks/useMasterLifecycle'
import { AdminEffectiveAccessPanel, AdminUserAccessPanels, AdminUserStatusBadge } from '../../components/admin'
import { ErpButton } from '../../components/erp/ErpButton'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminDepartmentsApi,
  fetchAdminUserSessionsApi,
  lockAdminUserApi,
  resendAdminInvitationApi,
  revokeAdminUserSessionsApi,
  unlockAdminUserApi,
  type AdminDepartment,
  type AdminUserSession,
} from '../../services/api/adminApi'
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
  const canCreate = canAdminPermission('user.create')
  const canEdit = canAdminPermission('user.update')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      users.filter((u) => {
        const s = search.toLowerCase()
        const statusOk =
          status === 'all' ||
          (status === 'active' && u.status === 'ACTIVE') ||
          (status === 'inactive' && u.status !== 'ACTIVE')
        const name = `${u.firstName} ${u.lastName}`.toLowerCase()
        return statusOk && (name.includes(s) || u.email.toLowerCase().includes(s))
      }),
    [users, search, status],
  )

  const columns: ColumnDef<typeof users[number], unknown>[] = [
    {
      id: 'name',
      header: 'Name',
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-erp-text">{row.original.firstName} {row.original.lastName}</div>
          <div className="text-xs text-erp-muted">{row.original.email}</div>
        </div>
      ),
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.length ? row.original.roles.map((r) => <Badge key={r.id} color="blue">{r.name}</Badge>) : <span className="text-xs text-erp-muted">No roles</span>}
        </div>
      ),
    },
    { accessorKey: 'designation', header: 'Designation' },
    { id: 'status', header: 'Status', cell: ({ row }) => <AdminUserStatusBadge status={row.original.status} /> },
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
      description="Manage tenant users, invitations, and role assignments"
      breadcrumbs={[{ label: 'Administration', to: '/admin' }, { label: 'Users' }]}
      favoritePath="/admin/users"
      createLabel="Invite User"
      createTo={canCreate ? '/admin/users/new' : '#'}
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Users', value: users.length },
        { label: 'Active', value: users.filter((u) => u.status === 'ACTIVE').length, accent: 'green' },
        { label: 'Invited', value: users.filter((u) => u.status === 'INVITED').length, accent: 'amber' },
      ]}
    >
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema) as Resolver<CreateFormData>,
    defaultValues: { firstName: '', lastName: '', email: '', password: '', mobile: '', designation: '', departmentId: '' },
  })
  const departments = useDepartmentOptions()

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
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
    >
      <FormSection title="User Details">
        <FormField label="First Name" required error={errors.firstName?.message}><Input {...register('firstName')} error={!!errors.firstName} /></FormField>
        <FormField label="Last Name" required error={errors.lastName?.message}><Input {...register('lastName')} error={!!errors.lastName} /></FormField>
        <FormField label="Email" required error={errors.email?.message}><Input type="email" {...register('email')} error={!!errors.email} /></FormField>
        <FormField label="Temporary Password" required hint="User can change this after first login" error={errors.password?.message}><Input type="password" {...register('password')} error={!!errors.password} /></FormField>
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
      </FormSection>
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
  const assignUserRole = useAdminStore((s) => s.assignUserRole)
  const removeUserRole = useAdminStore((s) => s.removeUserRole)
  const canAssign = canAdminPermission('user.assign_role')
  const canEdit = canAdminPermission('user.update')
  const canInvite = canAdminPermission('user.create')
  const canSecurity = canAdminPermission('security.manage')
  const updateUser = useAdminStore((s) => s.updateUser)
  const [pendingRoleId, setPendingRoleId] = useState('')
  const [roleError, setRoleError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sessions, setSessions] = useState<AdminUserSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)

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

  if (!user) return <MasterNotFound message="User not found." />

  const availableRoles = roles.filter((r) => !user.roles.some((ur) => ur.id === r.id))

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
        <DetailSection title="User Details">
          <DetailGrid>
            <DetailField label="Email" value={user.email} />
            <DetailField label="Mobile" value={user.mobile} />
            <DetailField label="Designation" value={user.designation} />
            <DetailField label="Department" value={user.department} />
            <DetailField label="Email Verified" value={user.emailVerified ? 'Yes' : 'No'} />
            <DetailField label="Last Login" value={user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'} />
          </DetailGrid>
          {user.status === 'INVITED' && canInvite ? (
            <div className="mt-3">
              <ErpButton size="sm" type="button" variant="secondary" disabled={busy} onClick={() => void handleResendInvite()}>
                Resend invitation
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
                  {canAssign && !role.isSystem && (
                    <button type="button" onClick={() => void handleRemove(role.id)} disabled={busy} className="text-erp-muted hover:text-erp-danger-fg">
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
            {canAssign && (
              <div className="flex items-end gap-2">
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
          </div>
        </DetailSection>

        <DetailSection title="Active sessions">
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
                      {s.ipAddress ?? '—'} · started {new Date(s.createdAt).toLocaleString()} · expires{' '}
                      {new Date(s.expiresAt).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DetailSection>

        <DetailSection title="Data scopes & responsibilities">
          <AdminUserAccessPanels userId={user.id} />
        </DetailSection>

        <DetailSection title="Effective Access">
          <AdminEffectiveAccessPanel userId={user.id} userName={`${user.firstName} ${user.lastName}`} />
        </DetailSection>
      </div>
    </DetailLayout>
  )
}

export { resolveMaybeId }
