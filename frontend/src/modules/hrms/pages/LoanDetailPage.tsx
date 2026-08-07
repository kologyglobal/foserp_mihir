import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Ban,
  Banknote,
  Check,
  Clock,
  Edit,
  FileText,
  Landmark,
  Lock,
  RefreshCw,
  Send,
  SkipForward,
  Wallet,
  X,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { TabStrip, type TabItem } from '@/components/ui/TabStrip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { appConfirm, appPromptNote } from '@/store/confirmDialogStore'
import {
  approveLoan,
  cancelLoan,
  closeLoan,
  disburseLoan,
  getLoan,
  getLoanAccounting,
  partialRecoverLoanInstallment,
  recordLoanRepayment,
  rejectLoan,
  skipLoanInstallment,
  submitLoan,
  type HrEmployeeLoan,
  type HrLoanAccounting,
  type HrLoanDisbursementMethod,
  type HrLoanRecoverySchedule,
  type HrLoanRepaymentMethod,
} from '@/services/api/hrmsApi'
import { listTreasuryAccounts } from '@/services/api/treasuryApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { HrEmptyState, HrMoneySummary, HrStatusChip, HrTimeline, type HrTimelineItem } from '@/modules/hrms/components'
import '../hrms-ui.css'
import { money } from './loanUi'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

type DetailTab = 'overview' | 'schedule' | 'payments' | 'accounting' | 'timeline'

function nextRecovery(schedules: HrLoanRecoverySchedule[] | undefined) {
  if (!schedules || schedules.length === 0) return null
  const pending = schedules
    .filter((s) => s.status === 'PENDING')
    .sort((a, b) => (a.year - b.year) || (a.month - b.month) || (a.installmentNo - b.installmentNo))
  return pending[0] ?? null
}

export function LoanDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const perms = useHrmsPermissions()

  const [tab, setTab] = useState<DetailTab>('overview')
  const [loan, setLoan] = useState<HrEmployeeLoan | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [accounting, setAccounting] = useState<HrLoanAccounting | null>(null)
  const [accountingLoading, setAccountingLoading] = useState(false)

  const [treasuryAccounts, setTreasuryAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])

  const [showApprove, setShowApprove] = useState(false)
  const [approvedAmount, setApprovedAmount] = useState('')
  const [installmentAmount, setInstallmentAmount] = useState('')
  const [installmentCount, setInstallmentCount] = useState('')
  const [recoveryStartYear, setRecoveryStartYear] = useState(String(new Date().getFullYear()))
  const [recoveryStartMonth, setRecoveryStartMonth] = useState(String(new Date().getMonth() + 1))

  const [showDisburse, setShowDisburse] = useState(false)
  const [disburseTreasuryAccountId, setDisburseTreasuryAccountId] = useState('')
  const [disburseMethod, setDisburseMethod] = useState<HrLoanDisbursementMethod>('BANK')
  const [disbursePaymentDate, setDisbursePaymentDate] = useState(new Date().toISOString().slice(0, 10))
  const [disburseReference, setDisburseReference] = useState('')

  const [showRepayment, setShowRepayment] = useState(false)
  const [repayAmount, setRepayAmount] = useState('')
  const [repayDate, setRepayDate] = useState(new Date().toISOString().slice(0, 10))
  const [repayMethod, setRepayMethod] = useState<HrLoanRepaymentMethod>('BANK')
  const [repayTreasuryAccountId, setRepayTreasuryAccountId] = useState('')
  const [repayReference, setRepayReference] = useState('')
  const [repayReason, setRepayReason] = useState('')

  const [scheduleDrawer, setScheduleDrawer] = useState<{ schedule: HrLoanRecoverySchedule; mode: 'skip' | 'partial' } | null>(null)
  const [scheduleAmount, setScheduleAmount] = useState('')
  const [scheduleReason, setScheduleReason] = useState('')

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const res = await getLoan(id)
      setLoan(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load loan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadAccounting = async () => {
    if (!id) return
    setAccountingLoading(true)
    try {
      const res = await getLoanAccounting(id)
      setAccounting(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load accounting')
    } finally {
      setAccountingLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'accounting') void loadAccounting()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id])

  useEffect(() => {
    if (!loan?.legalEntityId) return
    void listTreasuryAccounts({ legalEntityId: loan.legalEntityId, status: 'ACTIVE', limit: 100 })
      .then((res) => setTreasuryAccounts(res.items.map((a) => ({ id: a.id, code: a.code, name: a.name }))))
      .catch(() => undefined)
  }, [loan?.legalEntityId])

  const next = useMemo(() => nextRecovery(loan?.schedules), [loan?.schedules])

  const scheduleTimelineItems = useMemo<HrTimelineItem[]>(() => {
    const schedules = loan?.schedules
    if (!schedules || schedules.length === 0) return []
    return [...schedules]
      .sort((a, b) => a.year - b.year || a.month - b.month || a.installmentNo - b.installmentNo)
      .map((s) => {
        const period = `${MONTHS[s.month - 1]} ${s.year}`
        if (s.status === 'RECOVERED') {
          return {
            id: s.id,
            label: `${period} — ${money(s.recoveredAmount)} Recovered`,
            description: s.recoveredAt ? new Date(s.recoveredAt).toLocaleDateString('en-IN') : null,
            tone: 'success',
          }
        }
        if (s.status === 'PARTIAL') {
          return {
            id: s.id,
            label: `${period} — ${money(s.recoveredAmount)} of ${money(s.dueAmount)} Recovered`,
            description: 'Partially recovered',
            tone: 'warning',
          }
        }
        if (s.status === 'SKIPPED') {
          return {
            id: s.id,
            label: `${period} — Skipped`,
            description: s.skipReason ?? s.notes ?? null,
            tone: 'neutral',
          }
        }
        return {
          id: s.id,
          label: `${period} — ${money(s.dueAmount)} Due`,
          description: 'Pending recovery',
          tone: 'info',
        }
      })
  }, [loan?.schedules])

  const doSubmit = async () => {
    if (!id || !perms.canCreateLoan) return
    setBusy(true)
    try {
      await submitLoan(id)
      notify.success('Submitted for approval')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const openApprove = () => {
    if (!loan) return
    setApprovedAmount(loan.approvedAmount != null ? String(loan.approvedAmount) : String(loan.requestedAmount))
    setInstallmentAmount(loan.installmentAmount != null ? String(loan.installmentAmount) : '')
    setInstallmentCount(loan.installmentCount != null ? String(loan.installmentCount) : '')
    setRecoveryStartYear(String(loan.recoveryStartYear ?? new Date().getFullYear()))
    setRecoveryStartMonth(String(loan.recoveryStartMonth ?? new Date().getMonth() + 1))
    setShowApprove(true)
  }

  const doApprove = async () => {
    if (!id || !perms.canApproveLoan) return
    if (!installmentAmount && !installmentCount) {
      notify.error('Enter installment amount or installment count')
      return
    }
    setBusy(true)
    try {
      await approveLoan(id, {
        approvedAmount: approvedAmount ? Number(approvedAmount) : undefined,
        installmentAmount: installmentAmount ? Number(installmentAmount) : undefined,
        installmentCount: installmentCount ? Number(installmentCount) : undefined,
        recoveryStartYear: Number(recoveryStartYear),
        recoveryStartMonth: Number(recoveryStartMonth),
      })
      notify.success('Approved')
      setShowApprove(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const doReject = async () => {
    if (!id || !perms.canApproveLoan) return
    const reason = await appPromptNote({
      title: 'Reject loan / advance',
      description: 'Provide a rejection reason.',
      note: { required: true, label: 'Reason' },
    })
    if (reason == null) return
    try {
      await rejectLoan(id, reason)
      notify.success('Rejected')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reject failed')
    }
  }

  const doCancel = async () => {
    if (!id) return
    const ok = await appConfirm({
      title: 'Cancel loan / advance',
      description: 'This request will no longer be actionable. This cannot be undone.',
    })
    if (!ok) return
    try {
      await cancelLoan(id)
      notify.success('Cancelled')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  const openDisburse = () => {
    setDisburseTreasuryAccountId('')
    setDisburseMethod('BANK')
    setDisbursePaymentDate(new Date().toISOString().slice(0, 10))
    setDisburseReference('')
    setShowDisburse(true)
  }

  const doDisburse = async () => {
    if (!id || !perms.canDisburseLoan) return
    if (!disburseTreasuryAccountId || !disbursePaymentDate) {
      notify.error('Select a treasury account and payment date')
      return
    }
    setBusy(true)
    try {
      await disburseLoan(id, {
        treasuryAccountId: disburseTreasuryAccountId,
        method: disburseMethod,
        paymentDate: disbursePaymentDate,
        reference: disburseReference.trim() || undefined,
      })
      notify.success('Disbursed')
      setShowDisburse(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Disburse failed')
    } finally {
      setBusy(false)
    }
  }

  const doClose = async () => {
    if (!id || !perms.canManageLoan) return
    const ok = await appConfirm({ title: 'Close loan / advance', description: 'All recoveries must be complete.' })
    if (!ok) return
    try {
      await closeLoan(id)
      notify.success('Closed')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Close failed')
    }
  }

  const openRepayment = () => {
    setRepayAmount('')
    setRepayDate(new Date().toISOString().slice(0, 10))
    setRepayMethod('BANK')
    setRepayTreasuryAccountId('')
    setRepayReference('')
    setRepayReason('')
    setShowRepayment(true)
  }

  const doRepayment = async () => {
    if (!id || !perms.canRecordLoanRepayment) return
    const amount = Number(repayAmount)
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.error('Enter a valid repayment amount')
      return
    }
    if (!repayTreasuryAccountId) {
      notify.error('Select a treasury account to post this repayment')
      return
    }
    setBusy(true)
    try {
      await recordLoanRepayment(id, {
        amount,
        date: repayDate,
        method: repayMethod,
        treasuryAccountId: repayTreasuryAccountId,
        reference: repayReference.trim() || undefined,
        reason: repayReason.trim() || undefined,
      })
      notify.success('Repayment recorded')
      setShowRepayment(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Repayment failed')
    } finally {
      setBusy(false)
    }
  }

  const openScheduleAction = (schedule: HrLoanRecoverySchedule, mode: 'skip' | 'partial') => {
    setScheduleAmount(String(schedule.dueAmount))
    setScheduleReason('')
    setScheduleDrawer({ schedule, mode })
  }

  const doScheduleAction = async () => {
    if (!id || !scheduleDrawer || !perms.canManageLoan) return
    if (!scheduleReason.trim()) {
      notify.error('Reason is required')
      return
    }
    setBusy(true)
    try {
      if (scheduleDrawer.mode === 'skip') {
        await skipLoanInstallment(id, scheduleDrawer.schedule.id, scheduleReason.trim())
        notify.success('Installment skipped')
      } else {
        const amount = Number(scheduleAmount)
        if (!Number.isFinite(amount) || amount <= 0) {
          notify.error('Enter a valid amount')
          setBusy(false)
          return
        }
        await partialRecoverLoanInstallment(id, scheduleDrawer.schedule.id, { amount, reason: scheduleReason.trim() })
        notify.success('Installment recovered')
      }
      setScheduleDrawer(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !loan) {
    return (
      <OperationalPageShell title="Loan / Advance" breadcrumbs={[{ label: 'HRMS' }, { label: 'Loans & Advances' }]}>
        <LoadingState />
      </OperationalPageShell>
    )
  }

  const tabs: TabItem<DetailTab>[] = [
    { id: 'overview', label: 'Overview', icon: FileText },
    { id: 'schedule', label: 'Recovery Schedule', icon: Clock, count: loan.schedules?.length || undefined },
    { id: 'payments', label: 'Payments', icon: Banknote, count: loan.repayments?.length || undefined },
    { id: 'accounting', label: 'Accounting', icon: Landmark },
    { id: 'timeline', label: 'Timeline', icon: Clock },
  ]

  return (
    <OperationalPageShell
      title={`${loan.code} — ${loan.employee?.displayName ?? loan.employeeId}`}
      description={`${loan.type === 'LOAN' ? 'Loan' : 'Salary Advance'} · ${loan.employee?.employeeCode ?? ''} · ${loan.status}`}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Loans & Advances', to: '/hrms/loans' },
        { label: loan.code },
      ]}
    >
      <ErpCommandBar
        primaryAction={
          loan.status === 'DRAFT' && perms.canCreateLoan
            ? { id: 'submit', label: 'Submit', icon: Send, onClick: () => void doSubmit(), disabled: busy }
            : loan.status === 'SUBMITTED' && perms.canApproveLoan
              ? { id: 'approve', label: 'Approve', icon: Check, onClick: openApprove, disabled: busy }
              : loan.status === 'APPROVED' && perms.canDisburseLoan
                ? { id: 'disburse', label: 'Disburse', icon: Banknote, onClick: openDisburse, disabled: busy }
                : (loan.status === 'DISBURSED' || loan.status === 'RECOVERING') && perms.canRecordLoanRepayment
                  ? { id: 'repay', label: 'Record Repayment', icon: Wallet, onClick: openRepayment, disabled: busy }
                  : undefined
        }
        secondaryActions={[
          ...(loan.status === 'DRAFT' && perms.canCreateLoan
            ? [{ id: 'edit', label: 'Edit', icon: Edit, onClick: () => navigate(`/hrms/loans/${loan.id}/edit`) }]
            : []),
          ...(loan.status === 'SUBMITTED' && perms.canApproveLoan
            ? [{ id: 'reject', label: 'Reject', icon: X, onClick: () => void doReject() }]
            : []),
          ...((loan.status === 'DISBURSED' || loan.status === 'RECOVERING') && perms.canManageLoan
            ? [
                {
                  id: 'close',
                  label: 'Close',
                  icon: Lock,
                  onClick: () => void doClose(),
                  disabled: loan.outstandingAmount > 0,
                  disabledReason: loan.outstandingAmount > 0 ? 'Outstanding balance must be zero' : undefined,
                },
              ]
            : []),
          { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
        ]}
        destructiveActions={
          ['DRAFT', 'SUBMITTED', 'APPROVED'].includes(loan.status) && perms.canCreateLoan
            ? [{ id: 'cancel', label: 'Cancel', icon: Ban, onClick: () => void doCancel() }]
            : []
        }
      />

      <div className="mb-3 flex items-center justify-between">
        <HrStatusChip status={loan.status} domain="loan" />
        {loan.installmentAmount ? (
          <span className="text-xs text-erp-muted">
            Installment {money(loan.installmentAmount)}
            {loan.installmentCount ? ` × ${loan.installmentCount}` : ''}
            {next ? ` · Next recovery ${MONTHS[next.month - 1]} ${next.year}` : ''}
          </span>
        ) : null}
      </div>

      <HrMoneySummary
        className="mb-4"
        items={[
          { label: 'Original', value: money(loan.approvedAmount ?? loan.requestedAmount) },
          { label: 'Recovered', value: money(loan.recoveredAmount), tone: 'positive' },
        ]}
        total={{
          label: 'Outstanding',
          value: money(loan.outstandingAmount),
          tone: loan.outstandingAmount > 0 ? 'negative' : 'muted',
        }}
      />

      <TabStrip tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'overview' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded border border-erp-border bg-white p-4 text-sm">
            <h3 className="mb-3 font-semibold">Request</h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs text-erp-muted">Employee</div>
                <div>{loan.employee?.displayName}</div>
                <div className="text-xs text-erp-muted">{loan.employee?.employeeCode}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Type</div>
                <div>{loan.type === 'LOAN' ? 'Loan' : 'Salary Advance'}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Request date</div>
                <div>{loan.requestDate}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Requested amount</div>
                <div>{money(loan.requestedAmount)}</div>
              </div>
              {loan.reason ? (
                <div className="col-span-2">
                  <div className="text-xs text-erp-muted">Reason</div>
                  <div>{loan.reason}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded border border-erp-border bg-white p-4 text-sm">
            <h3 className="mb-3 font-semibold">Approval &amp; Recovery Terms</h3>
            {loan.status === 'DRAFT' ? (
              <p className="text-erp-muted">Approval terms are set when the request is approved.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <div className="text-xs text-erp-muted">Approved amount</div>
                  <div>{money(loan.approvedAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-erp-muted">Recovery start</div>
                  <div>
                    {loan.recoveryStartYear && loan.recoveryStartMonth
                      ? `${MONTHS[loan.recoveryStartMonth - 1]} ${loan.recoveryStartYear}`
                      : '-'}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-erp-muted">Installment amount</div>
                  <div>{money(loan.installmentAmount)}</div>
                </div>
                <div>
                  <div className="text-xs text-erp-muted">Installment count</div>
                  <div>{loan.installmentCount ?? '-'}</div>
                </div>
                {loan.rejectionReason ? (
                  <div className="col-span-2">
                    <div className="text-xs text-erp-muted">Rejection / cancellation reason</div>
                    <div>{loan.rejectionReason}</div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="rounded border border-erp-border bg-white p-4 text-sm lg:col-span-2">
            <h3 className="mb-3 font-semibold">Recovery Schedule</h3>
            <HrTimeline items={scheduleTimelineItems} emptyLabel="No recovery schedule yet — generated on disbursement." />
          </div>
        </div>
      ) : null}

      {tab === 'schedule' ? (
        <div className="overflow-x-auto rounded border border-erp-border bg-white">
          {!loan.schedules || loan.schedules.length === 0 ? (
            <p className="p-4 text-sm text-erp-muted">No recovery schedule yet — generated on disbursement.</p>
          ) : (
            <table className="hr-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Period</th>
                  <th>Due</th>
                  <th>Recovered</th>
                  <th>Status</th>
                  <th>Notes</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loan.schedules.map((s) => (
                  <tr key={s.id}>
                    <td className="tabular-nums">{s.installmentNo}</td>
                    <td>
                      {MONTHS[s.month - 1]} {s.year}
                    </td>
                    <td className="tabular-nums">{money(s.dueAmount)}</td>
                    <td className="tabular-nums">{money(s.recoveredAmount)}</td>
                    <td>
                      <HrStatusChip status={s.status} domain="loanSchedule" />
                    </td>
                    <td className="max-w-[200px] truncate text-xs text-erp-muted">
                      {s.skipReason || s.notes || '-'}
                    </td>
                    <td className="text-right">
                      {s.status === 'PENDING' && perms.canManageLoan ? (
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn--secondary btn--sm"
                            onClick={() => openScheduleAction(s, 'partial')}
                          >
                            Recover
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => openScheduleAction(s, 'skip')}
                            title="Skip installment"
                          >
                            <SkipForward className="h-4 w-4" />
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div className="space-y-3">
          {!loan.repayments || loan.repayments.length === 0 ? (
            <HrEmptyState icon={Banknote} title="No repayments" description="Lump-sum repayments recorded against this loan will appear here." />
          ) : (
            <div className="overflow-x-auto rounded border border-erp-border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Method</th>
                    <th className="px-3 py-2">Reference</th>
                    <th className="px-3 py-2">Reason</th>
                    <th className="px-3 py-2">Voucher</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.repayments.map((r) => (
                    <tr key={r.id} className="border-t border-erp-border">
                      <td className="px-3 py-2 tabular-nums">{r.repaymentDate}</td>
                      <td className="px-3 py-2 font-medium tabular-nums">{money(r.amount)}</td>
                      <td className="px-3 py-2">{r.method}</td>
                      <td className="px-3 py-2">{r.reference ?? '-'}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-xs text-erp-muted">{r.reason ?? '-'}</td>
                      <td className="px-3 py-2">
                        {r.accountingVoucherId ? (
                          <Link className="text-erp-primary" to={`/accounting/ledger-entries/voucher/${r.accountingVoucherId}`}>
                            View
                          </Link>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'accounting' ? (
        <div className="space-y-3">
          {accountingLoading || !accounting ? (
            <LoadingState />
          ) : (
            <div className="rounded border border-erp-border bg-white p-4 text-sm">
              <div className="mb-3 grid gap-2 md:grid-cols-2">
                <div>
                  <div className="text-xs uppercase text-erp-muted">Disbursement voucher</div>
                  <div>
                    {accounting.disbursementVoucherId ? (
                      <Link className="text-erp-primary" to={`/accounting/ledger-entries/voucher/${accounting.disbursementVoucherId}`}>
                        View voucher
                      </Link>
                    ) : (
                      '— not yet disbursed —'
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-xs uppercase text-erp-muted">Disbursed amount</div>
                  <div className="font-medium">{money(accounting.disbursedAmount)}</div>
                </div>
              </div>
              <div className="border-t border-erp-border pt-3">
                <div className="mb-2 text-xs font-semibold uppercase text-erp-muted">Repayment postings</div>
                {accounting.repayments.length === 0 ? (
                  <p className="text-xs text-erp-muted">No repayments posted yet.</p>
                ) : (
                  <ul className="space-y-1 text-xs">
                    {accounting.repayments.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-2">
                        <span>
                          {r.repaymentDate} · {money(r.amount)}
                        </span>
                        {r.accountingVoucherId ? (
                          <Link className="text-erp-primary" to={`/accounting/ledger-entries/voucher/${r.accountingVoucherId}`}>
                            View
                          </Link>
                        ) : (
                          <span className="text-erp-muted">Pending</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}

      {tab === 'timeline' ? (
        <div className="rounded border border-erp-border bg-white p-4 text-sm">
          <ul className="space-y-3 border-l border-erp-border pl-4">
            <li>
              <div className="font-medium">Created</div>
              <div className="text-xs text-erp-muted">{new Date(loan.createdAt).toLocaleString()}</div>
            </li>
            {loan.approvedAt ? (
              <li>
                <div className="font-medium">Approved</div>
                <div className="text-xs text-erp-muted">{new Date(loan.approvedAt).toLocaleString()}</div>
              </li>
            ) : null}
            {loan.rejectedAt ? (
              <li>
                <div className="font-medium">Rejected</div>
                <div className="text-xs text-erp-muted">{new Date(loan.rejectedAt).toLocaleString()}</div>
                {loan.rejectionReason ? <div className="text-xs">{loan.rejectionReason}</div> : null}
              </li>
            ) : null}
            {loan.disbursedAt ? (
              <li>
                <div className="font-medium">Disbursed</div>
                <div className="text-xs text-erp-muted">{new Date(loan.disbursedAt).toLocaleString()}</div>
                {loan.disbursementReference ? <div className="text-xs">Ref: {loan.disbursementReference}</div> : null}
                {loan.disbursementVoucherId ? (
                  <Link className="text-xs text-erp-primary" to={`/accounting/ledger-entries/voucher/${loan.disbursementVoucherId}`}>
                    View voucher
                  </Link>
                ) : null}
              </li>
            ) : null}
            {loan.closedAt ? (
              <li>
                <div className="font-medium">Closed</div>
                <div className="text-xs text-erp-muted">{new Date(loan.closedAt).toLocaleString()}</div>
              </li>
            ) : null}
            {loan.status === 'CANCELLED' ? (
              <li>
                <div className="font-medium">Cancelled</div>
                <div className="text-xs text-erp-muted">{new Date(loan.updatedAt).toLocaleString()}</div>
                {loan.rejectionReason ? <div className="text-xs">{loan.rejectionReason}</div> : null}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {showApprove ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowApprove(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">Approve {loan.type === 'LOAN' ? 'Loan' : 'Salary Advance'}</div>
              <div className="text-sm text-erp-muted">{loan.employee?.displayName}</div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <FormField label="Approved amount" hint={`Requested: ${money(loan.requestedAmount)}`}>
                <Input type="number" min={0} step="0.01" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
              </FormField>
              <FormField label="Installment amount" hint="Provide either installment amount or count">
                <Input type="number" min={0} step="0.01" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} />
              </FormField>
              <FormField label="Installment count">
                <Input type="number" min={1} value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} />
              </FormField>
              <div className="grid grid-cols-2 gap-2">
                <FormField label="Recovery start year" required>
                  <Input type="number" value={recoveryStartYear} onChange={(e) => setRecoveryStartYear(e.target.value)} required />
                </FormField>
                <FormField label="Recovery start month" required>
                  <Select value={recoveryStartMonth} onChange={(e) => setRecoveryStartMonth(e.target.value)} required>
                    {MONTHS.map((m, i) => (
                      <option key={m} value={String(i + 1)}>
                        {m}
                      </option>
                    ))}
                  </Select>
                </FormField>
              </div>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doApprove()}>
                Approve
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowApprove(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDisburse ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowDisburse(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">Disburse {loan.type === 'LOAN' ? 'Loan' : 'Salary Advance'}</div>
              <div className="text-sm text-erp-muted">
                {loan.employee?.displayName} · {money(loan.approvedAmount)}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <FormField label="Treasury account" required>
                <Select value={disburseTreasuryAccountId} onChange={(e) => setDisburseTreasuryAccountId(e.target.value)} required>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Method" required>
                <Select value={disburseMethod} onChange={(e) => setDisburseMethod(e.target.value as HrLoanDisbursementMethod)} required>
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                </Select>
              </FormField>
              <FormField label="Payment date" required>
                <Input type="date" value={disbursePaymentDate} onChange={(e) => setDisbursePaymentDate(e.target.value)} required />
              </FormField>
              <FormField label="Reference">
                <Input value={disburseReference} onChange={(e) => setDisburseReference(e.target.value)} />
              </FormField>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doDisburse()}>
                Disburse
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowDisburse(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showRepayment ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowRepayment(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">Record Repayment</div>
              <div className="text-sm text-erp-muted">
                {loan.employee?.displayName} · Outstanding {money(loan.outstandingAmount)}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <FormField label="Amount" required>
                <Input type="number" min={0} step="0.01" value={repayAmount} onChange={(e) => setRepayAmount(e.target.value)} required />
              </FormField>
              <FormField label="Date" required>
                <Input type="date" value={repayDate} onChange={(e) => setRepayDate(e.target.value)} required />
              </FormField>
              <FormField label="Method" required>
                <Select value={repayMethod} onChange={(e) => setRepayMethod(e.target.value as HrLoanRepaymentMethod)} required>
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                  <option value="OTHER">Other</option>
                </Select>
              </FormField>
              <FormField label="Treasury account" required hint="Required to post the repayment to accounting">
                <Select value={repayTreasuryAccountId} onChange={(e) => setRepayTreasuryAccountId(e.target.value)} required>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Reference">
                <Input value={repayReference} onChange={(e) => setRepayReference(e.target.value)} />
              </FormField>
              <FormField label="Reason">
                <Textarea value={repayReason} onChange={(e) => setRepayReason(e.target.value)} rows={2} />
              </FormField>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doRepayment()}>
                Record Repayment
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowRepayment(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleDrawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setScheduleDrawer(null)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">
                {scheduleDrawer.mode === 'skip' ? 'Skip Installment' : 'Recover Installment'} #{scheduleDrawer.schedule.installmentNo}
              </div>
              <div className="text-sm text-erp-muted">
                {MONTHS[scheduleDrawer.schedule.month - 1]} {scheduleDrawer.schedule.year} · Due {money(scheduleDrawer.schedule.dueAmount)}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              {scheduleDrawer.mode === 'partial' ? (
                <FormField label="Amount" required>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    max={scheduleDrawer.schedule.dueAmount}
                    value={scheduleAmount}
                    onChange={(e) => setScheduleAmount(e.target.value)}
                    required
                  />
                </FormField>
              ) : null}
              <FormField label="Reason" required>
                <Textarea value={scheduleReason} onChange={(e) => setScheduleReason(e.target.value)} rows={3} required />
              </FormField>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doScheduleAction()}>
                {scheduleDrawer.mode === 'skip' ? 'Skip' : 'Recover'}
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setScheduleDrawer(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
