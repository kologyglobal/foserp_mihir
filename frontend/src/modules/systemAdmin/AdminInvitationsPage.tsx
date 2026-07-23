import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RefreshCw, UserPlus, Users } from 'lucide-react'
import {
  AdminEmptyState,
  AdminErrorState,
  AdminSkeleton,
  AdminSummaryCard,
  AdminSummaryStrip,
} from '../../components/admin'
import { FormField } from '../../components/forms/FormField'
import { Input, Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import { ErpCardSection } from '../../components/erp/card-form'
import { AdminWorkspaceShell } from './AdminWorkspaceShell'
import { Badge } from '../../components/ui/Badge'
import { isApiMode } from '../../config/apiConfig'
import {
  fetchAdminInvitationsApi,
  inviteAdminUserApi,
  resendAdminInvitationApi,
  type AdminInvitation,
} from '../../services/api/adminApi'
import { formatApiError } from '../../services/api/apiErrors'
import { useAdminStore } from '../../store/adminStore'
import { notify } from '../../store/toastStore'
import { canAdminPermission } from '../../utils/permissions'
import { appConfirm } from '../../store/confirmDialogStore'

function statusColor(status: AdminInvitation['status']): 'green' | 'yellow' | 'red' | 'gray' | 'blue' {
  if (status === 'open') return 'blue'
  if (status === 'accepted') return 'green'
  if (status === 'expired') return 'yellow'
  return 'gray'
}

export function AdminInvitationsPage() {
  const navigate = useNavigate()
  const roles = useAdminStore((s) => s.roles)
  const users = useAdminStore((s) => s.users)
  const createUser = useAdminStore((s) => s.createUser)
  const canInvite = canAdminPermission('user.create')
  const canView = canAdminPermission('user.view')

  const [rows, setRows] = useState<AdminInvitation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'open' | 'all'>('open')
  const [lastInviteToken, setLastInviteToken] = useState<string | null>(null)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    roleId: '',
  })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      if (isApiMode()) {
        setRows(await fetchAdminInvitationsApi({ status: filter === 'open' ? 'open' : 'all' }))
      } else {
        const invited = users.filter((u) => u.status === 'INVITED')
        setRows(
          invited.map((u) => ({
            id: `demo-inv-${u.id}`,
            tenantId: u.tenantId,
            userId: u.id,
            email: u.email,
            expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(),
            acceptedAt: null,
            revokedAt: null,
            invitedBy: null,
            createdAt: u.createdAt,
            status: 'open' as const,
            user: { id: u.id, firstName: u.firstName, lastName: u.lastName, status: u.status },
          })),
        )
      }
    } catch (err) {
      setError(formatApiError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (canView) void load()
    else setLoading(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when filter/users change
  }, [canView, filter, users])

  const stats = useMemo(() => {
    const open = rows.filter((r) => r.status === 'open').length
    return { total: rows.length, open }
  }, [rows])

  const onInvite = (e: FormEvent) => {
    e.preventDefault()
    if (!canInvite) return
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      notify.error('First name, last name, and email are required')
      return
    }
    setSubmitting(true)
    void (async () => {
      try {
        if (isApiMode()) {
          const res = await inviteAdminUserApi({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            roleIds: form.roleId ? [form.roleId] : undefined,
          })
          if (res.data.inviteToken) {
            setLastInviteToken(res.data.inviteToken)
            notify.success('Invitation created (dev token shown below)')
          } else {
            notify.success('Invitation created')
          }
          useAdminStore.setState((s) => ({
            users: [res.data.user, ...s.users.filter((u) => u.id !== res.data.user.id)],
          }))
        } else {
          const res = await createUser({
            firstName: form.firstName.trim(),
            lastName: form.lastName.trim(),
            email: form.email.trim(),
            password: `demo-invite-${crypto.randomUUID().slice(0, 8)}`,
            status: 'INVITED',
            roleIds: form.roleId ? [form.roleId] : undefined,
          })
          if (!res.ok) {
            notify.error(res.error ?? 'Invite failed')
            return
          }
          const token = `demo-token-${res.userId}`
          setLastInviteToken(token)
          notify.success('Demo invitation created')
        }
        setForm({ firstName: '', lastName: '', email: '', roleId: '' })
        await load()
      } catch (err) {
        notify.error(formatApiError(err))
      } finally {
        setSubmitting(false)
      }
    })()
  }

  const onResend = async (userId: string) => {
    if (!canInvite) return
    const ok = await appConfirm({
      title: 'Resend invitation?',
      description: 'The previous invite link will be revoked and a new one issued.',
    })
    if (!ok) return
    try {
      if (isApiMode()) {
        const res = await resendAdminInvitationApi(userId)
        if (res.data.inviteToken) setLastInviteToken(res.data.inviteToken)
        notify.success('Invitation resent')
      } else {
        setLastInviteToken(`demo-token-${userId}-${Date.now()}`)
        notify.success('Demo invitation resent')
      }
      await load()
    } catch (err) {
      notify.error(formatApiError(err))
    }
  }

  return (
    <AdminWorkspaceShell
      title="Invitations"
      description="Invite users to the workspace and track pending acceptances."
      workspace="people"
      favoritePath="/admin/invitations"
      pageGuide={{
        purpose: 'Create hashed invitations; invitees set a password via accept-invitation.',
        nextStep: 'After accept, assign roles on the user detail page if needed.',
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            canInvite
              ? {
                  id: 'invite',
                  label: 'Invite User',
                  icon: UserPlus,
                  onClick: () => {
                    document.getElementById('admin-invite-form')?.scrollIntoView({ behavior: 'smooth' })
                  },
                }
              : {
                  id: 'users',
                  label: 'Users',
                  icon: Users,
                  onClick: () => navigate('/admin/users'),
                }
          }
          secondaryActions={[
            {
              id: 'users',
              label: 'Users',
              icon: Users,
              onClick: () => navigate('/admin/users'),
            },
            {
              id: 'refresh',
              label: 'Refresh',
              icon: RefreshCw,
              onClick: () => void load(),
            },
          ]}
        />
      }
    >
      <div className="space-y-6">
        {!canView ? (
          <AdminEmptyState title="No access" description="You need user.view to manage invitations." />
        ) : (
          <>
            <AdminSummaryStrip>
              <AdminSummaryCard label="Shown" value={stats.total} icon={UserPlus} accent="blue" />
              <AdminSummaryCard label="Open" value={stats.open} accent="amber" />
            </AdminSummaryStrip>

            {canInvite ? (
              <form id="admin-invite-form" onSubmit={onInvite}>
                <ErpCardSection title="Invite user" columns={2}>
                  <FormField label="First name" required>
                    <Input value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
                  </FormField>
                  <FormField label="Last name" required>
                    <Input value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
                  </FormField>
                  <FormField label="Email" required>
                    <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
                  </FormField>
                  <FormField label="Initial role">
                    <Select value={form.roleId} onChange={(e) => setForm((f) => ({ ...f, roleId: e.target.value }))}>
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {roles.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <div className="md:col-span-2 flex justify-end">
                    <ErpButton type="submit" size="sm" disabled={submitting}>
                      {submitting ? 'Sending…' : 'Send invitation'}
                    </ErpButton>
                  </div>
                </ErpCardSection>
              </form>
            ) : null}

            {lastInviteToken ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm">
                <p className="font-semibold text-amber-900">Dev / demo invite link</p>
                <p className="mt-1 break-all font-mono text-xs text-amber-950">
                  /login?invite={lastInviteToken}
                </p>
                <p className="mt-1 text-xs text-amber-800">
                  Raw tokens are only returned in development/test. Production should deliver email links.
                </p>
              </div>
            ) : null}

            <div className="flex items-center gap-2">
              <Select value={filter} onChange={(e) => setFilter(e.target.value as 'open' | 'all')}>
                <option value="open">Open</option>
                <option value="all">All</option>
              </Select>
            </div>

            {loading ? (
              <AdminSkeleton rows={4} />
            ) : error ? (
              <AdminErrorState title="Could not load invitations" description={error} />
            ) : rows.length === 0 ? (
              <AdminEmptyState title="No invitations" description="Invite a colleague to get started." />
            ) : (
              <section className="overflow-hidden rounded-xl border border-erp-border bg-erp-surface shadow-sm">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-erp-surface-alt text-xs uppercase tracking-wide text-erp-muted">
                    <tr>
                      <th className="px-4 py-2 font-semibold">User</th>
                      <th className="px-4 py-2 font-semibold">Email</th>
                      <th className="px-4 py-2 font-semibold">Status</th>
                      <th className="px-4 py-2 font-semibold">Expires</th>
                      <th className="px-4 py-2 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-erp-border">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2.5">
                          <Link to={`/admin/users/${row.userId}`} className="font-medium text-erp-primary hover:underline">
                            {row.user.firstName} {row.user.lastName}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-erp-muted">{row.email}</td>
                        <td className="px-4 py-2.5">
                          <Badge color={statusColor(row.status)}>{row.status}</Badge>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-erp-muted">
                          {new Date(row.expiresAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5">
                          {row.status === 'open' && canInvite ? (
                            <button
                              type="button"
                              className="text-xs font-semibold text-erp-primary hover:underline"
                              onClick={() => void onResend(row.userId)}
                            >
                              Resend
                            </button>
                          ) : (
                            '—'
                          )}
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
