import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, Check, Plus, RefreshCw, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  adjustLeaveBalance,
  approveLeaveRequest,
  cancelLeaveRequest,
  createLeaveRequest,
  createLeaveType,
  listLeaveBalances,
  listLeaveRequests,
  listLeaveTypes,
  previewLeave,
  rejectLeaveRequest,
  submitLeaveRequest,
  type HrLeaveBalance,
  type HrLeavePreview,
  type HrLeaveRequest,
  type HrLeaveType,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  HrApprovalDrawer,
  HrEmployeeCell,
  HrEmptyState,
  HrRegisterShell,
  HrStatusChip,
  hrStatusLabel,
} from '../components'
import '../hrms-ui.css'

const CURRENT_YEAR = new Date().getFullYear()

/* ── Shared: balance chips + balances table (reused by hub + standalone page) ── */

function BalanceChips({ rows }: { rows: HrLeaveBalance[] }) {
  if (rows.length === 0) return null
  return (
    <div className="hr-balance-chips">
      {rows.map((b) => (
        <div key={b.id} className="hr-balance-chip">
          <span className="hr-balance-chip__code">{b.leaveType?.code ?? '-'}</span>
          <span className={`hr-balance-chip__value ${b.available <= 0 ? 'hr-balance-chip__value--low' : ''}`}>
            {b.available}
          </span>
        </div>
      ))}
    </div>
  )
}

function BalancesTable({
  rows,
  canAdjust,
  onAdjust,
}: {
  rows: HrLeaveBalance[]
  canAdjust: boolean
  onAdjust?: (row: HrLeaveBalance) => void
}) {
  if (rows.length === 0) {
    return <HrEmptyState icon={CalendarDays} title="No balances" description="Initialize balances via API or HR adjust." />
  }
  return (
    <table className="hr-table">
      <thead>
        <tr>
          <th>Employee</th>
          <th>Type</th>
          <th>Opening</th>
          <th>Accrued</th>
          <th>Pending</th>
          <th>Used</th>
          <th>Adjusted</th>
          <th>Available</th>
          {canAdjust ? <th /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((b) => (
          <tr key={b.id}>
            <td>
              <HrEmployeeCell name={b.employee?.displayName ?? '-'} code={b.employee?.employeeCode} size="sm" />
            </td>
            <td>{b.leaveType?.code}</td>
            <td className="tabular-nums">{b.opening}</td>
            <td className="tabular-nums">{b.accrued}</td>
            <td className="tabular-nums">{b.pending}</td>
            <td className="tabular-nums">{b.used}</td>
            <td className="tabular-nums">{b.adjusted}</td>
            <td className="font-medium tabular-nums">{b.available}</td>
            {canAdjust ? (
              <td className="text-right">
                <button type="button" className="btn btn--ghost btn--sm" onClick={() => onAdjust?.(b)}>
                  Adjust
                </button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* ── Hub ──────────────────────────────────────────────────────────────────── */

type HubTab = 'mine' | 'approvals' | 'balances'

export function LeaveHubPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [tab, setTab] = useState<HubTab>(perms.canApproveLeave ? 'approvals' : 'mine')
  const [myBalances, setMyBalances] = useState<HrLeaveBalance[]>([])
  const [myRequests, setMyRequests] = useState<HrLeaveRequest[]>([])
  const [approvals, setApprovals] = useState<HrLeaveRequest[]>([])
  const [teamBalances, setTeamBalances] = useState<HrLeaveBalance[]>([])
  const [approvalBalanceCache, setApprovalBalanceCache] = useState<Map<string, HrLeaveBalance[]>>(new Map())
  const [loading, setLoading] = useState(true)
  const [drawerRequest, setDrawerRequest] = useState<HrLeaveRequest | null>(null)
  const [busy, setBusy] = useState(false)

  const loadMine = async () => {
    const tasks: Array<Promise<void>> = []
    if (perms.canViewLeaveBalance) {
      tasks.push(
        listLeaveBalances({ mine: true, year: CURRENT_YEAR, limit: 50 })
          .then((res) => setMyBalances(res.data ?? []))
          .catch(() => setMyBalances([])),
      )
    }
    tasks.push(
      listLeaveRequests({ mine: true, limit: 50 })
        .then((res) => setMyRequests(res.data ?? []))
        .catch(() => setMyRequests([])),
    )
    if (perms.canApproveLeave) {
      tasks.push(
        listLeaveRequests({ pendingApprovals: true, limit: 100 })
          .then(async (res) => {
            const rows = res.data ?? []
            setApprovals(rows)
            const uniqueEmployeeIds = [...new Set(rows.map((r) => r.employeeId))]
            const entries = await Promise.all(
              uniqueEmployeeIds.map(async (employeeId) => {
                try {
                  const balRes = await listLeaveBalances({ employeeId, year: CURRENT_YEAR, limit: 50 })
                  return [employeeId, balRes.data ?? []] as [string, HrLeaveBalance[]]
                } catch {
                  return [employeeId, []] as [string, HrLeaveBalance[]]
                }
              }),
            )
            setApprovalBalanceCache(new Map(entries))
          })
          .catch(() => setApprovals([])),
      )
    }
    if (perms.canViewLeaveBalance) {
      tasks.push(
        listLeaveBalances({ year: CURRENT_YEAR, limit: 100 })
          .then((res) => setTeamBalances(res.data ?? []))
          .catch(() => setTeamBalances([])),
      )
    }
    await Promise.all(tasks)
  }

  const load = async () => {
    setLoading(true)
    try {
      await loadMine()
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- perms are stable per session
  }, [])

  const balanceForDrawer = useMemo(() => {
    if (!drawerRequest) return null
    const list = approvalBalanceCache.get(drawerRequest.employeeId) ?? []
    return list.find((b) => b.leaveTypeId === drawerRequest.leaveTypeId) ?? null
  }, [drawerRequest, approvalBalanceCache])

  const onSubmit = async (id: string) => {
    try {
      await submitLeaveRequest(id)
      notify.success('Submitted')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  const onCancel = async (id: string) => {
    const ok = await appConfirm({ title: 'Cancel leave?', description: 'Restores pending/used balance when applicable.' })
    if (!ok) return
    try {
      await cancelLeaveRequest(id)
      notify.success('Cancelled')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  const onApprove = async () => {
    if (!drawerRequest) return
    setBusy(true)
    try {
      await approveLeaveRequest(drawerRequest.id)
      notify.success('Leave approved')
      setDrawerRequest(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const onReject = async () => {
    if (!drawerRequest) return
    const reason = await appPromptNote({
      title: 'Reject leave',
      description: 'Provide a rejection reason.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    setBusy(true)
    try {
      await rejectLeaveRequest(drawerRequest.id, reason)
      notify.success('Rejected')
      setDrawerRequest(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OperationalPageShell
      title="Leave"
      description="Apply, approve, and track leave balances."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Leave' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canApplyLeave
            ? { id: 'apply', label: 'Apply Leave', icon: Plus, onClick: () => navigate('/hrms/leave/apply') }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />

      {perms.canViewLeaveBalance && myBalances.length > 0 ? (
        <div className="mb-4">
          <h2 className="mb-2 text-[13px] font-semibold text-erp-text">Your Leave Balance ({CURRENT_YEAR})</h2>
          <BalanceChips rows={myBalances} />
        </div>
      ) : null}

      <div className="hr-tab-strip mb-3">
        <button type="button" className={`hr-tab-strip__btn ${tab === 'mine' ? 'hr-tab-strip__btn--active' : ''}`} onClick={() => setTab('mine')}>
          My Requests {myRequests.length > 0 ? `(${myRequests.length})` : ''}
        </button>
        {perms.canApproveLeave ? (
          <button
            type="button"
            className={`hr-tab-strip__btn ${tab === 'approvals' ? 'hr-tab-strip__btn--active' : ''}`}
            onClick={() => setTab('approvals')}
          >
            Team Approvals {approvals.length > 0 ? `(${approvals.length})` : ''}
          </button>
        ) : null}
        {perms.canViewLeaveBalance ? (
          <button
            type="button"
            className={`hr-tab-strip__btn ${tab === 'balances' ? 'hr-tab-strip__btn--active' : ''}`}
            onClick={() => setTab('balances')}
          >
            Balances
          </button>
        ) : null}
      </div>

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : tab === 'mine' ? (
          myRequests.length === 0 ? (
            <HrEmptyState
              icon={CalendarDays}
              title="No leave requests yet"
              description="Apply for leave to see it here."
              primaryAction={perms.canApplyLeave ? { label: 'Apply Leave', onClick: () => navigate('/hrms/leave/apply') } : undefined}
            />
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {myRequests.map((r) => (
                  <tr key={r.id}>
                    <td>{r.leaveType?.code}</td>
                    <td className="tabular-nums">{r.fromDate}</td>
                    <td className="tabular-nums">{r.toDate}</td>
                    <td className="tabular-nums">{r.requestedDays}</td>
                    <td className="max-w-[220px] truncate">{r.reason}</td>
                    <td>
                      <HrStatusChip status={r.status} domain="leave" />
                    </td>
                    <td className="text-right">
                      <div className="flex justify-end gap-1">
                        {r.status === 'DRAFT' ? (
                          <button type="button" className="btn btn--secondary btn--sm" onClick={() => void onSubmit(r.id)}>
                            Submit
                          </button>
                        ) : null}
                        {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(r.status) ? (
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onCancel(r.id)}>
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : tab === 'approvals' ? (
          approvals.length === 0 ? (
            <HrEmptyState icon={CalendarDays} title="Nothing pending" description="No leave requests await your approval." />
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Leave</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {approvals.map((r) => {
                  const bal = (approvalBalanceCache.get(r.employeeId) ?? []).find((b) => b.leaveTypeId === r.leaveTypeId)
                  return (
                    <tr key={r.id} onClick={() => setDrawerRequest(r)}>
                      <td>
                        <HrEmployeeCell name={r.employee?.displayName ?? '-'} code={r.employee?.employeeCode} size="sm" />
                      </td>
                      <td>{r.leaveType?.code}</td>
                      <td className="tabular-nums">
                        {r.fromDate} → {r.toDate}
                      </td>
                      <td className="tabular-nums">{r.requestedDays}</td>
                      <td className="max-w-[200px] truncate">{r.reason}</td>
                      <td className="tabular-nums">{bal ? bal.available : '-'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : (
          <BalancesTable rows={teamBalances} canAdjust={false} />
        )}
      </HrRegisterShell>

      <HrApprovalDrawer
        open={!!drawerRequest}
        onClose={() => setDrawerRequest(null)}
        title={drawerRequest?.employee?.displayName ?? 'Leave request'}
        subtitle={drawerRequest ? `${drawerRequest.employee?.employeeCode ?? ''} · ${drawerRequest.leaveType?.name ?? ''}` : undefined}
        busy={busy}
        onApprove={onApprove}
        onReject={onReject}
        fields={
          drawerRequest
            ? [
                { label: 'Leave type', value: drawerRequest.leaveType?.name },
                { label: 'Dates', value: `${drawerRequest.fromDate} → ${drawerRequest.toDate}` },
                { label: 'Days requested', value: drawerRequest.requestedDays },
                { label: 'Duration', value: drawerRequest.durationType.replace('_', ' ') },
                { label: 'Available balance', value: balanceForDrawer ? balanceForDrawer.available : '-' },
                {
                  label: 'Balance after approval',
                  value: balanceForDrawer ? balanceForDrawer.available - drawerRequest.requestedDays : '-',
                },
              ]
            : []
        }
      >
        {drawerRequest ? (
          <div className="hr-info-section" style={{ padding: '0.6rem 0.75rem' }}>
            <div className="hr-info-section__label">Reason</div>
            <div className="hr-info-section__value">{drawerRequest.reason}</div>
          </div>
        ) : null}
      </HrApprovalDrawer>
    </OperationalPageShell>
  )
}

/* ── Leave Types (setup) ──────────────────────────────────────────────────── */

export function LeaveTypesPage() {
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrLeaveType[]>([])
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await listLeaveTypes({ limit: 100 })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load leave types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canManageLeaveType) return
    try {
      await createLeaveType({ code: code.trim().toUpperCase(), name: name.trim() })
      setCode('')
      setName('')
      notify.success('Leave type created')
      await load()
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Create failed')
    }
  }

  return (
    <OperationalPageShell
      title="Leave Types"
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Leave', to: '/hrms/leave' }, { label: 'Types' }]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      {perms.canManageLeaveType ? (
        <form onSubmit={create} className="mb-4 flex flex-wrap items-end gap-2 rounded border border-erp-border bg-white p-3">
          <FormField label="Code" required>
            <Input value={code} onChange={(e) => setCode(e.target.value)} required />
          </FormField>
          <FormField label="Name" required>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <button type="submit" className="btn btn--primary btn--sm">
            <Plus className="mr-1 h-4 w-4" />
            Add
          </button>
        </form>
      ) : null}
      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={CalendarDays} title="No leave types" />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Half day</th>
                <th>Paid</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.code}</td>
                  <td>{t.name}</td>
                  <td>{t.allowHalfDay ? 'Yes' : 'No'}</td>
                  <td>{t.paid ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}

/* ── Balances (standalone register) ──────────────────────────────────────── */

export function LeaveBalancesPage() {
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrLeaveBalance[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listLeaveBalances({ limit: 200, year: CURRENT_YEAR })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load balances')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const onAdjust = async (row: HrLeaveBalance) => {
    if (!perms.canManageLeaveBalance) return
    const amountRaw = await appPromptNote({
      title: 'Adjust balance',
      description: `${row.employee?.displayName ?? 'Employee'} · ${row.leaveType?.code ?? 'Type'} — enter signed amount (e.g. 1 or -0.5).`,
      note: { required: true, label: 'Amount' },
    })
    if (amountRaw == null) return
    const amount = Number(amountRaw)
    if (!Number.isFinite(amount) || amount === 0) {
      notify.error('Enter a non-zero numeric amount')
      return
    }
    const reason = await appPromptNote({
      title: 'Adjustment reason',
      description: 'Required for audit.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    try {
      await adjustLeaveBalance({
        employeeId: row.employeeId,
        leaveTypeId: row.leaveTypeId,
        year: row.year,
        amount,
        reason,
        effectiveDate: new Date().toISOString().slice(0, 10),
      })
      notify.success('Balance adjusted')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Adjustment failed')
    }
  }

  return (
    <OperationalPageShell
      title="Leave Balances"
      description={`Year ${CURRENT_YEAR}`}
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Leave', to: '/hrms/leave' }, { label: 'Balances' }]}
    >
      <ErpCommandBar
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      {!perms.canViewLeaveBalance ? (
        <HrEmptyState icon={CalendarDays} title="No access" description="Requires leave balance view permission." />
      ) : (
        <HrRegisterShell>
          {loading ? <LoadingState /> : <BalancesTable rows={rows} canAdjust={perms.canManageLeaveBalance} onAdjust={(r) => void onAdjust(r)} />}
        </HrRegisterShell>
      )}
    </OperationalPageShell>
  )
}

/* ── Requests register (full list — filters + status) ────────────────────── */

export function LeaveRequestsPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [rows, setRows] = useState<HrLeaveRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'all' | 'mine' | 'pending'>('all')
  const [statusFilter, setStatusFilter] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await listLeaveRequests({
        limit: 100,
        mine: tab === 'mine' ? true : undefined,
        pendingApprovals: tab === 'pending' ? true : undefined,
        status: statusFilter || undefined,
      })
      setRows(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [tab, statusFilter])

  const onApprove = async (id: string) => {
    try {
      await approveLeaveRequest(id)
      notify.success('Approved')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    }
  }

  const onReject = async (id: string) => {
    const reason = await appPromptNote({
      title: 'Reject leave',
      description: 'Provide a rejection reason.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    try {
      await rejectLeaveRequest(id, reason)
      notify.success('Rejected')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    }
  }

  const onSubmit = async (id: string) => {
    try {
      await submitLeaveRequest(id)
      notify.success('Submitted')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  const onCancel = async (id: string) => {
    const ok = await appConfirm({ title: 'Cancel leave?', description: 'Restores pending/used balance when applicable.' })
    if (!ok) return
    try {
      await cancelLeaveRequest(id)
      notify.success('Cancelled')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  return (
    <OperationalPageShell
      title="Leave Requests"
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Leave', to: '/hrms/leave' }, { label: 'Requests' }]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canApplyLeave
            ? { id: 'apply', label: 'Apply Leave', icon: Plus, onClick: () => navigate('/hrms/leave/apply') }
            : undefined
        }
        secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
      />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="hr-tab-strip">
          {(
            [
              ['all', 'All'],
              ['mine', 'My Requests'],
              ['pending', 'Pending Approvals'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              className={`hr-tab-strip__btn ${tab === k ? 'hr-tab-strip__btn--active' : ''}`}
              onClick={() => setTab(k)}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="ml-auto max-w-[160px]">
          <option value="">All statuses</option>
          <option value="DRAFT">{hrStatusLabel('DRAFT', 'leave')}</option>
          <option value="SUBMITTED">{hrStatusLabel('SUBMITTED', 'leave')}</option>
          <option value="APPROVED">{hrStatusLabel('APPROVED', 'leave')}</option>
          <option value="REJECTED">{hrStatusLabel('REJECTED', 'leave')}</option>
          <option value="CANCELLED">{hrStatusLabel('CANCELLED', 'leave')}</option>
        </Select>
      </div>
      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={CalendarDays} title="No requests" />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Type</th>
                <th>From</th>
                <th>To</th>
                <th>Days</th>
                <th>Status</th>
                <th>Approver</th>
                <th>Reason</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <HrEmployeeCell name={r.employee?.displayName ?? '-'} code={r.employee?.employeeCode} size="sm" />
                  </td>
                  <td>{r.leaveType?.code}</td>
                  <td className="tabular-nums">{r.fromDate}</td>
                  <td className="tabular-nums">{r.toDate}</td>
                  <td className="tabular-nums">{r.requestedDays}</td>
                  <td>
                    <HrStatusChip status={r.status} domain="leave" />
                  </td>
                  <td>{r.employee?.reportingManager?.displayName ?? '-'}</td>
                  <td className="max-w-[200px] truncate">{r.reason}</td>
                  <td className="text-right">
                    <div className="flex justify-end gap-1">
                      {r.status === 'DRAFT' && perms.canApplyLeave ? (
                        <button type="button" className="btn btn--secondary btn--sm" onClick={() => void onSubmit(r.id)}>
                          Submit
                        </button>
                      ) : null}
                      {r.status === 'SUBMITTED' && perms.canApproveLeave ? (
                        <>
                          <button type="button" className="btn btn--primary btn--sm" onClick={() => void onApprove(r.id)}>
                            <Check className="h-3 w-3" />
                          </button>
                          <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onReject(r.id)}>
                            <X className="h-3 w-3" />
                          </button>
                        </>
                      ) : null}
                      {['DRAFT', 'SUBMITTED', 'APPROVED'].includes(r.status) && perms.canApplyLeave ? (
                        <button type="button" className="btn btn--ghost btn--sm" onClick={() => void onCancel(r.id)}>
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>
    </OperationalPageShell>
  )
}

/* ── Apply ────────────────────────────────────────────────────────────────── */

export function LeaveApplyPage() {
  const navigate = useNavigate()
  const perms = useHrmsPermissions()
  const [types, setTypes] = useState<HrLeaveType[]>([])
  const [leaveTypeId, setLeaveTypeId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [durationType, setDurationType] = useState<'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'>('FULL_DAY')
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<HrLeavePreview | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await listLeaveTypes({ limit: 100, isActive: true })
        setTypes(res.data ?? [])
      } catch {
        /* ignore */
      }
    })()
  }, [])

  useEffect(() => {
    if (!leaveTypeId || !fromDate || !toDate) {
      setPreview(null)
      return
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const res = await previewLeave({ leaveTypeId, fromDate, toDate, durationType })
          setPreview(res.data)
        } catch (e) {
          setPreview(null)
          notify.error(e instanceof Error ? e.message : 'Preview failed')
        }
      })()
    }, 300)
    return () => window.clearTimeout(t)
  }, [leaveTypeId, fromDate, toDate, durationType])

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!perms.canApplyLeave) return
    setBusy(true)
    try {
      const created = await createLeaveRequest({ leaveTypeId, fromDate, toDate, durationType, reason })
      await submitLeaveRequest(created.data.id)
      notify.success('Leave submitted')
      navigate('/hrms/leave')
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Apply failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <OperationalPageShell
      title="Apply Leave"
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Leave', to: '/hrms/leave' }, { label: 'Apply' }]}
      backLink={{ to: '/hrms/leave', label: 'Back to Leave' }}
    >
      <form onSubmit={onSubmit} className="hr-form-section max-w-xl space-y-4">
        <FormField label="Leave Type" required>
          <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)} required>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </Select>
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="From" required>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} required />
          </FormField>
          <FormField label="To" required>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} required />
          </FormField>
        </div>
        <FormField label="Duration">
          <Select value={durationType} onChange={(e) => setDurationType(e.target.value as typeof durationType)}>
            <option value="FULL_DAY">Full day</option>
            <option value="FIRST_HALF">First half</option>
            <option value="SECOND_HALF">Second half</option>
          </Select>
        </FormField>
        <FormField label="Reason" required>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} required rows={3} />
        </FormField>

        {preview ? (
          <div className="rounded border border-erp-border bg-erp-surface p-3 text-sm">
            <div className="grid grid-cols-3 gap-2">
              <div>
                <div className="text-xs text-erp-muted">Available</div>
                <div className="font-medium tabular-nums">{preview.availableBalance}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Requested</div>
                <div className="font-medium tabular-nums">{preview.requestedDays}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">After approval</div>
                <div className="font-medium tabular-nums">{preview.balanceAfterApproval}</div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="hr-form-sticky-footer" style={{ position: 'static', boxShadow: 'none', border: 'none', padding: 0 }}>
          <button type="submit" className="btn btn--primary" disabled={busy || !perms.canApplyLeave}>
            {busy ? 'Submitting…' : 'Submit Leave'}
          </button>
        </div>
      </form>
    </OperationalPageShell>
  )
}
