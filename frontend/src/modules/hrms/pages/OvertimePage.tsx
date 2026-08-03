import { useEffect, useMemo, useState } from 'react'
import { Check, Clock, RefreshCw, X } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  approveOvertime,
  bulkApproveOvertime,
  bulkRejectOvertime,
  listOvertime,
  rejectOvertime,
  type HrOvertimeRecord,
} from '@/services/api/hrmsApi'
import { notify } from '@/store/toastStore'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  HrApprovalDrawer,
  HrEmployeeCell,
  HrEmptyState,
  HrKpiStrip,
  HrRegisterShell,
  HrStatusChip,
  formatHrMinutes,
  formatHrTime,
} from '../components'
import '../hrms-ui.css'

const DASH = '—'

function monthStartIso(): string {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10)
}

type Tab = 'pending' | 'approved' | 'rejected' | 'exceptions' | 'all' | 'team'

export function OvertimePage() {
  const perms = useHrmsPermissions()
  const [tab, setTab] = useState<Tab>('pending')
  const [rows, setRows] = useState<HrOvertimeRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [drawer, setDrawer] = useState<HrOvertimeRecord | null>(null)
  const [approveMins, setApproveMins] = useState('')
  const [busy, setBusy] = useState(false)

  const [pendingCount, setPendingCount] = useState<number | null>(null)
  const [approvedThisMonth, setApprovedThisMonth] = useState<number | null>(null)
  const [otHoursThisMonth, setOtHoursThisMonth] = useState<number | null>(null)
  const [exceptionCount, setExceptionCount] = useState<number | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await listOvertime({
        limit: 100,
        from: from || undefined,
        to: to || undefined,
        status:
          tab === 'pending' || tab === 'exceptions'
            ? 'PENDING'
            : tab === 'approved'
              ? 'APPROVED'
              : tab === 'rejected'
                ? 'REJECTED'
                : undefined,
        pendingTeam: tab === 'team' ? true : undefined,
      })
      const items = res.data ?? []
      setRows(
        tab === 'exceptions' ? items.filter((r) => (r.exceptionFlags?.length ?? 0) > 0) : items,
      )
      setSelected(new Set())
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load overtime')
    } finally {
      setLoading(false)
    }
  }

  const loadKpis = async () => {
    const monthStart = monthStartIso()
    const today = new Date().toISOString().slice(0, 10)
    try {
      const pendingRes = await listOvertime({ status: 'PENDING', limit: 1 })
      setPendingCount(pendingRes.meta?.total ?? pendingRes.data?.length ?? 0)
    } catch {
      setPendingCount(null)
    }
    try {
      const approvedRes = await listOvertime({ status: 'APPROVED', from: monthStart, to: today, limit: 200 })
      const approvedRows = approvedRes.data ?? []
      setApprovedThisMonth(approvedRes.meta?.total ?? approvedRows.length)
      const totalMinutes = approvedRows.reduce((sum, r) => sum + (r.approvedMinutes ?? 0), 0)
      setOtHoursThisMonth(Math.round((totalMinutes / 60) * 10) / 10)
    } catch {
      setApprovedThisMonth(null)
      setOtHoursThisMonth(null)
    }
    try {
      const excRes = await listOvertime({ from: monthStart, to: today, limit: 200 })
      const excRows = (excRes.data ?? []).filter((r) => (r.exceptionFlags?.length ?? 0) > 0)
      setExceptionCount(excRows.length)
    } catch {
      setExceptionCount(null)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load on tab/date filter change only
  }, [tab, from, to])

  useEffect(() => {
    void loadKpis()
  }, [])

  const refreshAll = async () => {
    await Promise.all([load(), loadKpis()])
  }

  const kpiItems: EnterpriseKpiItem[] = useMemo(
    () => [
      { id: 'pending', label: 'Pending Approval', value: pendingCount ?? DASH, icon: Clock, accent: 'amber' },
      { id: 'approved-month', label: 'Approved This Month', value: approvedThisMonth ?? DASH, icon: Check, accent: 'green' },
      { id: 'ot-hours', label: 'OT Hours (Month)', value: otHoursThisMonth != null ? `${otHoursThisMonth}h` : DASH, icon: Clock, accent: 'blue' },
      { id: 'exceptions', label: 'Exceptions', value: exceptionCount ?? DASH, icon: Clock, accent: 'red' },
    ],
    [pendingCount, approvedThisMonth, otHoursThisMonth, exceptionCount],
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const openDrawer = (row: HrOvertimeRecord) => {
    setDrawer(row)
    setApproveMins(String(row.eligibleMinutes))
  }

  const submitApprove = async () => {
    if (!drawer) return
    const mins = Number(approveMins)
    if (!Number.isFinite(mins) || mins < 0) {
      notify.error('Enter valid approved minutes')
      return
    }
    setBusy(true)
    try {
      await approveOvertime(drawer.id, { approvedMinutes: mins })
      notify.success('OT approved')
      setDrawer(null)
      await refreshAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const onReject = async (id: string) => {
    const reason = await appPromptNote({
      title: 'Reject overtime',
      description: 'Provide a rejection reason.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    setBusy(true)
    try {
      await rejectOvertime(id, reason)
      notify.success('Rejected')
      setDrawer(null)
      await refreshAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  const onBulkApprove = async () => {
    if (selected.size === 0) return
    const ok = await appConfirm({
      title: 'Bulk approve OT?',
      description: `Approve eligible minutes for ${selected.size} row(s).`,
    })
    if (!ok) return
    try {
      const res = await bulkApproveOvertime([...selected])
      notify.success(`Approved ${res.data?.approved ?? 0}`)
      await refreshAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Bulk approve failed')
    }
  }

  const onBulkReject = async () => {
    if (selected.size === 0) return
    const reason = await appPromptNote({
      title: 'Bulk reject',
      description: 'Reason applies to all selected rows.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    try {
      await bulkRejectOvertime([...selected], reason)
      notify.success('Bulk reject submitted')
      await refreshAll()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Bulk reject failed')
    }
  }

  if (!perms.canViewOvertime) {
    return (
      <OperationalPageShell title="Overtime" breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Overtime' }]}>
        <HrEmptyState icon={Clock} title="No access" description="Requires overtime view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Overtime"
      description="Review OT candidates from attendance. Payroll consumes approved minutes only."
      breadcrumbs={[{ label: 'HRMS', to: '/hrms' }, { label: 'Overtime' }]}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void refreshAll() },
            ...(perms.canApproveOvertime && selected.size > 0
              ? [
                  {
                    id: 'bulk-approve',
                    label: `Approve (${selected.size})`,
                    icon: Check,
                    onClick: () => void onBulkApprove(),
                  },
                  {
                    id: 'bulk-reject',
                    label: 'Reject',
                    icon: X,
                    onClick: () => void onBulkReject(),
                  },
                ]
              : []),
          ]}
        />
      }
    >
      <div className="mb-4">
        <HrKpiStrip items={kpiItems} />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-2">
        <div className="hr-tab-strip">
          {(
            [
              ['pending', 'Pending'],
              ['team', 'My Team'],
              ['approved', 'Approved'],
              ['rejected', 'Rejected'],
              ['exceptions', 'Exceptions'],
              ['all', 'All'],
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
        <FormField label="From" className="ml-auto">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </FormField>
        <FormField label="To">
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </FormField>
      </div>

      <HrRegisterShell>
        {loading ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <HrEmptyState icon={Clock} title="No overtime rows" description="Finalize attendance with punches beyond shift to generate candidates." />
        ) : (
          <table className="hr-table">
            <thead>
              <tr>
                <th />
                <th>Employee</th>
                <th>Date</th>
                <th>Shift</th>
                <th>Worked</th>
                <th>Detected</th>
                <th>Eligible</th>
                <th>Approved</th>
                <th>Status</th>
                <th>Flags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} onClick={() => openDrawer(r)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    {r.status === 'PENDING' ? (
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    ) : null}
                  </td>
                  <td>
                    <HrEmployeeCell name={r.employee?.displayName ?? DASH} code={r.employee?.employeeCode} size="sm" />
                  </td>
                  <td className="tabular-nums">{r.attendanceDate}</td>
                  <td>{r.shift?.code ?? DASH}</td>
                  <td className="tabular-nums">{formatHrMinutes(r.workedMinutes)}</td>
                  <td className="tabular-nums">{formatHrMinutes(r.detectedMinutes)}</td>
                  <td className="tabular-nums">{formatHrMinutes(r.eligibleMinutes)}</td>
                  <td className="tabular-nums">{formatHrMinutes(r.approvedMinutes)}</td>
                  <td>
                    <HrStatusChip status={r.status} domain="overtime" />
                  </td>
                  <td className="max-w-[160px] truncate text-xs text-amber-800">{(r.exceptionFlags ?? []).join(', ') || DASH}</td>
                  <td className="text-right" onClick={(e) => e.stopPropagation()}>
                    {r.status === 'PENDING' && perms.canApproveOvertime ? (
                      <div className="flex justify-end gap-1">
                        <button type="button" className="btn btn--primary btn--sm" onClick={() => openDrawer(r)}>
                          Review
                        </button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </HrRegisterShell>

      <HrApprovalDrawer
        open={!!drawer}
        onClose={() => setDrawer(null)}
        title={drawer?.employee?.displayName ?? 'Overtime'}
        subtitle={drawer ? `${drawer.employee?.employeeCode ?? ''} · ${drawer.attendanceDate}` : undefined}
        busy={busy}
        onApprove={drawer?.status === 'PENDING' && perms.canApproveOvertime ? submitApprove : undefined}
        onReject={drawer?.status === 'PENDING' && perms.canApproveOvertime ? () => onReject(drawer.id) : undefined}
        approveLabel="Approve OT"
        fields={
          drawer
            ? [
                { label: 'Shift', value: drawer.shift?.code ?? DASH },
                { label: 'In', value: formatHrTime(drawer.firstInAt) },
                { label: 'Out', value: formatHrTime(drawer.lastOutAt) },
                { label: 'Worked', value: formatHrMinutes(drawer.workedMinutes) },
                { label: 'Detected OT', value: formatHrMinutes(drawer.detectedMinutes) },
                { label: 'Eligible OT', value: formatHrMinutes(drawer.eligibleMinutes) },
                { label: 'Status', value: <HrStatusChip status={drawer.status} domain="overtime" /> },
              ]
            : []
        }
      >
        {drawer?.status === 'PENDING' && perms.canApproveOvertime ? (
          <FormField label="Approved minutes" required>
            <Input
              type="number"
              min={0}
              max={perms.canOverrideOtLimit ? undefined : drawer.eligibleMinutes}
              value={approveMins}
              onChange={(e) => setApproveMins(e.target.value)}
            />
          </FormField>
        ) : null}
        {drawer?.status === 'PENDING' && !perms.canOverrideOtLimit ? (
          <p className="text-xs text-erp-muted">Cannot exceed eligible ({drawer.eligibleMinutes} min) without override permission.</p>
        ) : null}
        {drawer && (drawer.exceptionFlags?.length ?? 0) > 0 ? (
          <div>
            <div className="hr-info-section__label mb-1">Exception flags</div>
            <p className="text-xs text-amber-800">{drawer.exceptionFlags?.join(', ')}</p>
          </div>
        ) : null}
        {drawer?.reason ? (
          <div>
            <div className="hr-info-section__label mb-1">Notes</div>
            <p className="text-sm">{drawer.reason}</p>
          </div>
        ) : null}
      </HrApprovalDrawer>
    </OperationalPageShell>
  )
}
