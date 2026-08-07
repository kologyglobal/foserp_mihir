import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  AlertTriangle,
  Calculator,
  Check,
  CheckCircle,
  ClipboardCheck,
  CreditCard,
  Download,
  Eye,
  FileText,
  Landmark,
  Lock,
  RefreshCw,
  Send,
  Sparkles,
  X,
} from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { TabStrip, type TabItem } from '@/components/ui/TabStrip'
import { LoadingState } from '@/design-system/components/LoadingState'
import { appConfirm } from '@/store/confirmDialogStore'
import {
  approvePaymentBatch,
  calculatePayrollRun,
  cancelPaymentBatch,
  confirmPaymentBatch,
  createPaymentBatch,
  exportPaymentBatchCsv,
  finalizePayrollRun,
  generatePayslipsForRun,
  getPayrollAccounting,
  getPayrollEmployeeResult,
  getPayrollRun,
  getPayslip,
  listPayrollEmployeeResults,
  listPayrollExceptions,
  listPaymentBatches,
  listPayslips,
  markPaymentBatchReady,
  postPayrollAccounting,
  reviewPayrollRun,
  type HrPayrollAccounting,
  type HrPayrollEmployeeResult,
  type HrPayrollException,
  type HrPayrollRun,
  type HrPayslip,
  type HrPayslipDetail,
  type HrSalaryPaymentBatch,
} from '@/services/api/hrmsApi'
import { listTreasuryAccounts } from '@/services/api/treasuryApi'
import { downloadPayslipPdf } from '@/modules/hrms/payslipPdf'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import {
  HrApprovalDrawer,
  HrEmployeeCell,
  HrKpiStrip,
  HrMoneySummary,
  HrPayslipDocument,
  HrStatusChip,
  HrStepIndicator,
  type HrStep,
} from '@/modules/hrms/components'
import { DynamicsStatusChip } from '@/components/dynamics/DynamicsStatusChip'
import '../hrms-ui.css'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function money(n: number) {
  return `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`
}

type DetailTab = 'calculation' | 'payslips' | 'accounting' | 'payments'

/** Inputs → Calculate → Review → Finalize → Payslips → Accounting → Payment, mapped from real run fields. */
function payrollRunSteps(run: HrPayrollRun): HrStep[] {
  const calculated = ['CALCULATED', 'REVIEWED', 'FINALIZED'].includes(run.status)
  const reviewed = ['REVIEWED', 'FINALIZED'].includes(run.status)
  const finalized = run.status === 'FINALIZED'
  const payslipsDone = Boolean(run.payslipGeneratedAt)
  const accountingDone = run.accountingStatus === 'POSTED'
  const paymentDone = run.paymentStatus === 'PAID'

  return [
    { id: 'inputs', label: 'Inputs', done: true },
    { id: 'calculate', label: 'Calculate', done: calculated, current: run.status === 'DRAFT' },
    { id: 'review', label: 'Review', done: reviewed, current: run.status === 'CALCULATED' },
    { id: 'finalize', label: 'Finalize', done: finalized, current: run.status === 'REVIEWED' },
    { id: 'payslips', label: 'Payslips', done: payslipsDone, current: finalized && !payslipsDone },
    {
      id: 'accounting',
      label: 'Accounting',
      done: accountingDone,
      current: finalized && payslipsDone && !accountingDone,
      note: run.accountingStatus === 'FAILED' ? 'Posting failed' : undefined,
    },
    {
      id: 'payment',
      label: 'Payment',
      done: paymentDone,
      current: run.paymentStatus === 'IN_PROGRESS' || run.paymentStatus === 'PARTIALLY_PAID',
    },
  ]
}

export function PayrollRunDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useHrmsPermissions()
  const [tab, setTab] = useState<DetailTab>('calculation')
  const [run, setRun] = useState<HrPayrollRun | null>(null)
  const [employees, setEmployees] = useState<HrPayrollEmployeeResult[]>([])
  const [exceptions, setExceptions] = useState<HrPayrollException[]>([])
  const [selected, setSelected] = useState<HrPayrollEmployeeResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Payslips tab
  const [payslips, setPayslips] = useState<HrPayslip[]>([])
  const [payslipsLoading, setPayslipsLoading] = useState(false)
  const [payslipBusyId, setPayslipBusyId] = useState<string | null>(null)
  const [payslipPreview, setPayslipPreview] = useState<HrPayslipDetail | null>(null)

  // Accounting tab
  const [accounting, setAccounting] = useState<HrPayrollAccounting | null>(null)
  const [accountingLoading, setAccountingLoading] = useState(false)
  const [accountingBusy, setAccountingBusy] = useState(false)

  // Payments tab
  const [batches, setBatches] = useState<HrSalaryPaymentBatch[]>([])
  const [batchesLoading, setBatchesLoading] = useState(false)
  const [treasuryAccounts, setTreasuryAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [showCreateBatch, setShowCreateBatch] = useState(false)
  const [treasuryAccountId, setTreasuryAccountId] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [reference, setReference] = useState('')
  const [batchBusyId, setBatchBusyId] = useState<string | null>(null)
  const [batchDrawer, setBatchDrawer] = useState<HrSalaryPaymentBatch | null>(null)
  const [failedLines, setFailedLines] = useState<Record<string, string>>({})

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [r, e, x] = await Promise.all([
        getPayrollRun(id),
        listPayrollEmployeeResults(id, { limit: 500 }),
        listPayrollExceptions(id, { limit: 200 }),
      ])
      setRun(r.data ?? null)
      setEmployees(e.data ?? [])
      setExceptions(x.data ?? [])
    } catch (err) {
      notify.error(err instanceof Error ? err.message : 'Failed to load run')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [id])

  const loadPayslips = async () => {
    if (!id) return
    setPayslipsLoading(true)
    try {
      const res = await listPayslips({ payrollRunId: id, limit: 500 })
      setPayslips(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payslips')
    } finally {
      setPayslipsLoading(false)
    }
  }

  const loadAccounting = async () => {
    if (!id) return
    setAccountingLoading(true)
    try {
      const res = await getPayrollAccounting(id)
      setAccounting(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load accounting status')
    } finally {
      setAccountingLoading(false)
    }
  }

  const loadPayments = async () => {
    if (!id) return
    setBatchesLoading(true)
    try {
      const res = await listPaymentBatches({ payrollRunId: id, limit: 100 })
      setBatches(res.data ?? [])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payment batches')
    } finally {
      setBatchesLoading(false)
    }
  }

  useEffect(() => {
    if (tab === 'payslips') void loadPayslips()
    if (tab === 'accounting') void loadAccounting()
    if (tab === 'payments') void loadPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, id])

  useEffect(() => {
    if (!run?.legalEntityId) return
    void listTreasuryAccounts({ legalEntityId: run.legalEntityId, status: 'ACTIVE', limit: 100 })
      .then((res) => setTreasuryAccounts(res.items.map((a) => ({ id: a.id, code: a.code, name: a.name }))))
      .catch(() => undefined)
  }, [run?.legalEntityId])

  const openEmployee = async (row: HrPayrollEmployeeResult) => {
    if (!id) return
    try {
      const res = await getPayrollEmployeeResult(id, row.id)
      setSelected(res.data ?? row)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load employee result')
    }
  }

  const doCalculate = async () => {
    if (!id || !perms.canCalculatePayroll) return
    setBusy(true)
    try {
      await calculatePayrollRun(id)
      notify.success('Payroll calculated')
      setSelected(null)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Calculate failed')
    } finally {
      setBusy(false)
    }
  }

  const doReview = async () => {
    if (!id || !perms.canReviewPayroll) return
    setBusy(true)
    try {
      await reviewPayrollRun(id)
      notify.success('Marked as reviewed')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setBusy(false)
    }
  }

  const doFinalize = async () => {
    if (!id || !perms.canFinalizePayroll) return
    const ok = await appConfirm({
      title: 'Finalize payroll',
      description: 'Finalized results become immutable. Payslips, GL posting, and payments can then be actioned.',
    })
    if (!ok) return
    setBusy(true)
    try {
      await finalizePayrollRun(id)
      notify.success('Payroll finalized')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Finalize failed')
    } finally {
      setBusy(false)
    }
  }

  const doGeneratePayslips = async () => {
    if (!id || !perms.canGeneratePayslip) return
    setPayslipBusyId('generate')
    try {
      const res = await generatePayslipsForRun(id)
      notify.success(`Generated ${res.data?.generatedCount ?? 0} payslip(s)`)
      await Promise.all([loadPayslips(), load()])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Generate failed')
    } finally {
      setPayslipBusyId(null)
    }
  }

  const onPreviewPayslip = async (row: HrPayslip) => {
    try {
      const res = await getPayslip(row.id)
      setPayslipPreview(res.data ?? null)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payslip')
    }
  }

  const onDownloadPayslip = async (row: HrPayslip) => {
    setPayslipBusyId(row.id)
    try {
      const result = await downloadPayslipPdf(row.id, `Payslip-${row.payslipNumber}`)
      if (!result.ok) notify.error(result.error)
    } finally {
      setPayslipBusyId(null)
    }
  }

  const doPostAccounting = async () => {
    if (!id || !perms.canPostPayrollAccounting) return
    const ok = await appConfirm({
      title: 'Post payroll accounting',
      description:
        'Posts a balanced accrual journal (Dr salary/employer expense, Cr salary/statutory payable) to the general ledger. This cannot be undone.',
    })
    if (!ok) return
    setAccountingBusy(true)
    try {
      await postPayrollAccounting(id)
      notify.success('Payroll accounting posted')
      await Promise.all([loadAccounting(), load()])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post accounting failed')
    } finally {
      setAccountingBusy(false)
    }
  }

  const doCreateBatch = async () => {
    if (!id || !perms.canCreateSalaryPayment) return
    if (!treasuryAccountId || !paymentDate) {
      notify.error('Select a treasury account and payment date')
      return
    }
    setBatchBusyId('create')
    try {
      await createPaymentBatch({
        payrollRunId: id,
        treasuryAccountId,
        paymentDate,
        reference: reference.trim() || undefined,
        skipInvalidEmployees: true,
      })
      notify.success('Payment batch created')
      setShowCreateBatch(false)
      setTreasuryAccountId('')
      setPaymentDate('')
      setReference('')
      await Promise.all([loadPayments(), load()])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Create batch failed')
    } finally {
      setBatchBusyId(null)
    }
  }

  const doReady = async (batchId: string) => {
    setBatchBusyId(batchId)
    try {
      await markPaymentBatchReady(batchId)
      notify.success('Batch marked ready')
      await loadPayments()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Mark ready failed')
    } finally {
      setBatchBusyId(null)
    }
  }

  const doApprove = async (batchId: string) => {
    setBatchBusyId(batchId)
    try {
      await approvePaymentBatch(batchId)
      notify.success('Batch approved')
      await loadPayments()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setBatchBusyId(null)
    }
  }

  const doCancelBatch = async (batchId: string) => {
    const ok = await appConfirm({ title: 'Cancel payment batch', description: 'Pending lines will be skipped.' })
    if (!ok) return
    setBatchBusyId(batchId)
    try {
      await cancelPaymentBatch(batchId)
      notify.success('Batch cancelled')
      await loadPayments()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Cancel failed')
    } finally {
      setBatchBusyId(null)
    }
  }

  const doExportBatch = async (batchId: string, code: string) => {
    setBatchBusyId(batchId)
    try {
      const { blob, filename } = await exportPaymentBatchCsv(batchId)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename ?? `${code}-bank-export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBatchBusyId(null)
    }
  }

  const openBatchDrawer = (batch: HrSalaryPaymentBatch) => {
    setBatchDrawer(batch)
    setFailedLines({})
  }

  const doConfirmBatch = async () => {
    if (!batchDrawer) return
    setBatchBusyId(batchDrawer.id)
    try {
      const failedLineIds = Object.entries(failedLines)
        .filter(([, reason]) => reason.trim().length > 0)
        .map(([lineId, reason]) => ({ id: lineId, reason: reason.trim() }))
      await confirmPaymentBatch(batchDrawer.id, { failedLineIds })
      notify.success('Payment batch confirmed')
      setBatchDrawer(null)
      await Promise.all([loadPayments(), load()])
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Confirm payment failed')
    } finally {
      setBatchBusyId(null)
    }
  }

  if (loading || !run) {
    return (
      <OperationalPageShell title="Payroll Run" breadcrumbs={[{ label: 'HRMS' }, { label: 'Payroll' }]}>
        <LoadingState />
      </OperationalPageShell>
    )
  }

  const title = run.period != null ? `${MONTHS[run.period.month - 1]} ${run.period.year} Payroll` : run.code
  const canRecalc = ['DRAFT', 'CALCULATED', 'REVIEWED'].includes(run.status)
  const blockers = run.exceptionSummary?.blockers ?? exceptions.filter((x) => x.severity === 'BLOCKER').length
  const warnings = run.exceptionSummary?.warnings ?? exceptions.filter((x) => x.severity === 'WARNING').length
  const errorRows = employees.filter((e) => e.errorMessage)

  const needsAttention: string[] = [
    ...(blockers > 0 ? [`${blockers} blocking exception(s) must be resolved before finalizing.`] : []),
    ...(errorRows.length > 0 ? [`${errorRows.length} employee(s) failed calculation — open their row for details.`] : []),
    ...(run.accountingStatus === 'FAILED'
      ? [`Payroll accounting posting failed${run.accountingError ? `: ${run.accountingError}` : '.'}`]
      : []),
    ...(warnings > 0 && blockers === 0 && errorRows.length === 0
      ? [`${warnings} warning(s) on this run — review before finalizing.`]
      : []),
  ]

  const tabs: TabItem<DetailTab>[] = [
    { id: 'calculation', label: 'Calculation', icon: Calculator },
    { id: 'payslips', label: 'Payslips', icon: FileText, count: payslips.length || undefined },
    { id: 'accounting', label: 'Accounting', icon: Landmark },
    { id: 'payments', label: 'Payments', icon: CreditCard, count: batches.length || undefined },
  ]

  return (
    <OperationalPageShell
      title={title}
      description={`${run.code} · ${run.legalEntity?.displayName ?? run.legalEntityId} · ${run.status}`}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Payroll Runs', to: '/hrms/payroll/runs' },
        { label: run.code },
      ]}
    >
      <ErpCommandBar
        primaryAction={
          perms.canCalculatePayroll && canRecalc
            ? {
                id: 'calc',
                label: run.status === 'DRAFT' ? 'Calculate Payroll' : 'Recalculate',
                icon: Calculator,
                onClick: () => void doCalculate(),
                disabled: busy,
              }
            : undefined
        }
        secondaryActions={[
          ...(perms.canReviewPayroll && run.status === 'CALCULATED'
            ? [{ id: 'review', label: 'Mark Reviewed', icon: ClipboardCheck, onClick: () => void doReview() }]
            : []),
          ...(perms.canFinalizePayroll && run.status === 'REVIEWED'
            ? [{ id: 'finalize', label: 'Finalize Payroll', icon: Lock, onClick: () => void doFinalize() }]
            : []),
          { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
        ]}
      />

      <HrStepIndicator steps={payrollRunSteps(run)} />

      <HrKpiStrip
        items={[
          { id: 'employees', label: 'Employees', value: run.employeeCount },
          { id: 'gross', label: 'Gross', value: money(run.grossAmount) },
          { id: 'deductions', label: 'Deductions', value: money(run.deductionAmount) },
          { id: 'net', label: 'Net Pay', value: money(run.netAmount) },
        ]}
      />

      {needsAttention.length > 0 ? (
        <div className={`hr-needs-attention ${blockers > 0 || errorRows.length > 0 ? 'hr-needs-attention--critical' : ''} mt-3`}>
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="mb-0.5 font-semibold">Needs attention</div>
            <ul className="list-inside list-disc space-y-0.5">
              {needsAttention.map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {run.status === 'FINALIZED' ? (
        <p className="mb-1 mt-3 flex items-center gap-2 text-sm text-erp-muted">
          <CheckCircle className="h-4 w-4 text-green-700" />
          Finalized {run.finalizedAt ? new Date(run.finalizedAt).toLocaleString() : ''} — recalculation blocked.
        </p>
      ) : null}

      <TabStrip tabs={tabs} active={tab} onChange={setTab} className="mb-4" />

      {tab === 'calculation' ? (
        <div className="space-y-4">
          <div className="overflow-x-auto rounded border border-erp-border bg-white">
            <table className="hr-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Paid Days</th>
                  <th>LOP</th>
                  <th>OT</th>
                  <th>Gross</th>
                  <th>Deductions</th>
                  <th>Net</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((row) => (
                  <tr key={row.id} onClick={() => void openEmployee(row)}>
                    <td>
                      <HrEmployeeCell name={row.employee?.displayName ?? row.employeeId} code={row.employee?.employeeCode} />
                    </td>
                    <td>{row.payableDays}</td>
                    <td>{row.lopDays}</td>
                    <td>{row.approvedOtMinutes ? `${(row.approvedOtMinutes / 60).toFixed(1)}h` : '-'}</td>
                    <td>{money(row.grossAmount)}</td>
                    <td>{money(row.deductionAmount)}</td>
                    <td className="font-medium">{money(row.netAmount)}</td>
                    <td>
                      {row.errorMessage ? (
                        <DynamicsStatusChip label="Error" tone="critical" />
                      ) : (
                        <DynamicsStatusChip label={row.status} tone="success" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {employees.length === 0 ? (
              <p className="p-4 text-sm text-erp-muted">No employee results yet. Run Calculate Payroll.</p>
            ) : null}
          </div>

          {exceptions.length > 0 ? (
            <div className="rounded border border-erp-border bg-white p-3 text-sm">
              <h3 className="mb-2 font-semibold">Run exceptions</h3>
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {exceptions.map((x) => (
                  <li key={x.id} className="text-xs">
                    <span className={x.severity === 'BLOCKER' ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>
                      {x.severity}
                    </span>{' '}
                    {x.code}: {x.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-erp-muted">
            Setup:{' '}
            <Link className="text-erp-primary" to="/hrms/payroll/setup/structures">
              Salary structures
            </Link>
            .
          </p>
        </div>
      ) : null}

      <HrApprovalDrawer
        open={selected != null}
        onClose={() => setSelected(null)}
        title={selected?.employee?.displayName ?? ''}
        subtitle={selected?.employee?.employeeCode}
      >
        {selected ? (
          <div className="space-y-4">
            <HrMoneySummary
              items={[
                { label: 'Gross', value: money(selected.grossAmount) },
                { label: 'Deductions', value: money(selected.deductionAmount) },
              ]}
              total={{ label: 'Net Pay', value: money(selected.netAmount) }}
            />

            {selected.errorMessage ? (
              <p className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                {selected.errorCode}: {selected.errorMessage}
              </p>
            ) : null}

            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-erp-muted">Attendance</div>
              <div className="grid grid-cols-2 gap-1 text-xs">
                <div>Paid days: {selected.payableDays}</div>
                <div>LOP: {selected.lopDays}</div>
                <div>Present: {selected.presentDays ?? '-'}</div>
                <div>Paid leave: {selected.paidLeaveDays ?? '-'}</div>
                <div>Weekly offs: {selected.weeklyOffDays ?? '-'}</div>
                <div>Holidays: {selected.holidayDays ?? '-'}</div>
                <div>Approved OT: {(selected.approvedOtMinutes / 60).toFixed(1)}h</div>
                <div>Basis days: {selected.basisDays ?? '-'}</div>
              </div>
            </div>

            <div className="border-t border-erp-border pt-3">
              <div className="mb-1 text-xs font-semibold uppercase text-erp-muted">Statutory</div>
              {(() => {
                const comps = selected.components ?? []
                const amt = (code: string) => comps.find((c) => c.componentCode === code)?.amount
                const rows = [
                  ['PF Wage', comps.find((c) => c.componentCode === 'PF_EMPLOYEE')?.calculationBasis],
                  ['Employee PF', amt('PF_EMPLOYEE')],
                  ['Employer PF', amt('PF_EMPLOYER')],
                  ['Employee ESIC', amt('ESIC_EMPLOYEE')],
                  ['Employer ESIC', amt('ESIC_EMPLOYER')],
                  ['PT', amt('PT')],
                  ['TDS', amt('TDS')],
                  ['LWF Emp', amt('LWF_EMPLOYEE')],
                  ['LWF Er', amt('LWF_EMPLOYER')],
                ] as Array<[string, number | string | null | undefined]>
                const any = rows.some(([, v]) => typeof v === 'number' || (typeof v === 'string' && v))
                if (!any) return <p className="text-xs text-erp-muted">No statutory lines on this result.</p>
                return (
                  <ul className="space-y-1 text-xs">
                    {rows.map(([label, v]) =>
                      v == null || v === '' ? null : (
                        <li key={label} className="flex justify-between gap-2">
                          <span>{label}</span>
                          <span>{typeof v === 'number' ? money(v) : v}</span>
                        </li>
                      ),
                    )}
                  </ul>
                )
              })()}
            </div>

            <div className="border-t border-erp-border pt-3">
              <div className="mb-1 text-xs font-semibold uppercase text-erp-muted">Loans &amp; Advances</div>
              {(() => {
                const loanComps = (selected.components ?? []).filter(
                  (c) => c.componentCode === 'LOAN_RECOVERY' || c.componentCode === 'ADVANCE_RECOVERY',
                )
                if (loanComps.length === 0) {
                  return <p className="text-xs text-erp-muted">No loan/advance recovery this period.</p>
                }
                return (
                  <ul className="space-y-1 text-xs">
                    {loanComps.map((c) => {
                      const basisMatch = c.calculationBasis ? /loan:([^|]+)/.exec(c.calculationBasis) : null
                      const notesMatch = c.notes ? /Source\s+(\S+)/.exec(c.notes) : null
                      const source = basisMatch?.[1] ?? notesMatch?.[1] ?? '-'
                      return (
                        <li key={c.id} className="flex justify-between gap-2">
                          <span>
                            {c.componentName}
                            <span className="ml-1 text-erp-muted">({source})</span>
                          </span>
                          <span>{money(c.amount)}</span>
                        </li>
                      )
                    })}
                  </ul>
                )
              })()}
            </div>

            <div className="border-t border-erp-border pt-3">
              <div className="mb-1 text-xs font-semibold uppercase text-erp-muted">All Components</div>
              <ul className="space-y-1 text-xs">
                {(selected.components ?? []).map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span>
                      {c.componentName}
                      <span className="ml-1 text-erp-muted">({c.type})</span>
                    </span>
                    <span>{money(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </HrApprovalDrawer>

      {tab === 'payslips' ? (
        <div className="space-y-3">
          {perms.canGeneratePayslip ? (
            <div className="flex items-center gap-2 rounded border border-erp-border bg-white p-3">
              <button
                type="button"
                className="btn btn--primary btn--sm"
                disabled={run.status !== 'FINALIZED' || payslipBusyId === 'generate'}
                onClick={() => void doGeneratePayslips()}
                title={run.status !== 'FINALIZED' ? 'Run must be FINALIZED first' : undefined}
              >
                <Sparkles className="mr-1 h-4 w-4" />
                Generate Payslips
              </button>
              {run.payslipGeneratedAt ? (
                <span className="text-xs text-erp-muted">
                  Last generated {new Date(run.payslipGeneratedAt).toLocaleString()}
                </span>
              ) : null}
              <Link className="ml-auto text-sm text-erp-primary" to="/hrms/payroll/payslips">
                Payslip register →
              </Link>
            </div>
          ) : null}

          {payslipsLoading ? (
            <LoadingState />
          ) : payslips.length === 0 ? (
            <p className="rounded border border-erp-border bg-white p-4 text-sm text-erp-muted">
              No payslips generated for this run yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-erp-border bg-white">
              <table className="hr-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Payslip No.</th>
                    <th>Gross</th>
                    <th>Deduction</th>
                    <th>Net</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {payslips.map((p) => (
                    <tr key={p.id} onClick={() => void onPreviewPayslip(p)}>
                      <td>
                        <HrEmployeeCell name={p.employee?.displayName ?? p.employeeId} code={p.employee?.employeeCode} />
                      </td>
                      <td>{p.payslipNumber}</td>
                      <td>{money(p.grossAmount)}</td>
                      <td>{money(p.deductionAmount)}</td>
                      <td className="font-medium">{money(p.netAmount)}</td>
                      <td>
                        <HrStatusChip status={p.status} domain="payslip" />
                      </td>
                      <td>
                        <HrStatusChip status={p.paymentStatus} domain="paymentStatus" />
                      </td>
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-1">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => void onPreviewPayslip(p)}
                            title="Preview"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            disabled={payslipBusyId === p.id}
                            onClick={() => void onDownloadPayslip(p)}
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        </div>
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
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase text-erp-muted">Accounting status</div>
                  <div
                    className={`text-lg font-semibold ${
                      accounting.accountingStatus === 'POSTED'
                        ? 'text-green-700'
                        : accounting.accountingStatus === 'FAILED'
                          ? 'text-red-700'
                          : 'text-erp-text'
                    }`}
                  >
                    {accounting.accountingStatus}
                  </div>
                </div>
                {perms.canPostPayrollAccounting && run.status === 'FINALIZED' && accounting.accountingStatus !== 'POSTED' ? (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={accountingBusy}
                    onClick={() => void doPostAccounting()}
                  >
                    <Send className="mr-1 h-4 w-4" />
                    Post Payroll
                  </button>
                ) : null}
              </div>

              {accounting.accountingStatus === 'FAILED' && accounting.accountingError ? (
                <p className="mb-3 rounded bg-red-50 p-2 text-xs text-red-800">{accounting.accountingError}</p>
              ) : null}

              {accounting.accountingStatus === 'POSTED' ? (
                <div className="grid gap-2 text-xs md:grid-cols-2">
                  <div>
                    <span className="text-erp-muted">Voucher: </span>
                    {accounting.accountingVoucherId ? (
                      <Link
                        className="text-erp-primary"
                        to={`/accounting/ledger-entries/voucher/${accounting.accountingVoucherId}`}
                      >
                        {accounting.voucherNumber ?? accounting.accountingVoucherId}
                      </Link>
                    ) : (
                      '-'
                    )}
                  </div>
                  <div>
                    <span className="text-erp-muted">Posted at: </span>
                    {accounting.accountingPostedAt ? new Date(accounting.accountingPostedAt).toLocaleString() : '-'}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-erp-muted">
                  {run.status !== 'FINALIZED'
                    ? 'Payroll must be FINALIZED before posting to accounting.'
                    : 'Post the payroll accrual journal to enable salary payment batches.'}
                </p>
              )}
            </div>
          )}
        </div>
      ) : null}

      {tab === 'payments' ? (
        <div className="space-y-3">
          {run.accountingStatus !== 'POSTED' ? (
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              Payroll accounting must be POSTED before creating a payment batch.
            </p>
          ) : null}

          {perms.canCreateSalaryPayment && run.accountingStatus === 'POSTED' ? (
            <div className="rounded border border-erp-border bg-white p-3">
              {!showCreateBatch ? (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => setShowCreateBatch(true)}>
                  <CreditCard className="mr-1 h-4 w-4" />
                  Create Payment Batch
                </button>
              ) : (
                <div className="grid gap-2 md:grid-cols-4 md:items-end">
                  <FormField label="Treasury account" required>
                    <Select value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)}>
                      <option value="">{SELECT_PLACEHOLDER}</option>
                      {treasuryAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} — {a.name}
                        </option>
                      ))}
                    </Select>
                  </FormField>
                  <FormField label="Payment date" required>
                    <Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
                  </FormField>
                  <FormField label="Reference">
                    <Input value={reference} onChange={(e) => setReference(e.target.value)} />
                  </FormField>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn btn--primary btn--sm"
                      disabled={batchBusyId === 'create'}
                      onClick={() => void doCreateBatch()}
                    >
                      Create
                    </button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => setShowCreateBatch(false)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {batchesLoading ? (
            <LoadingState />
          ) : batches.length === 0 ? (
            <p className="rounded border border-erp-border bg-white p-4 text-sm text-erp-muted">
              No payment batches for this run yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded border border-erp-border bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Code</th>
                    <th className="px-3 py-2">Payment Date</th>
                    <th className="px-3 py-2">Employees</th>
                    <th className="px-3 py-2">Total</th>
                    <th className="px-3 py-2">Paid</th>
                    <th className="px-3 py-2">Pending</th>
                    <th className="px-3 py-2">Status</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-t border-erp-border">
                      <td className="px-3 py-2 font-medium">
                        <button type="button" className="text-erp-primary" onClick={() => openBatchDrawer(b)}>
                          {b.code}
                        </button>
                      </td>
                      <td className="px-3 py-2">{b.paymentDate}</td>
                      <td className="px-3 py-2">{b.employeeCount}</td>
                      <td className="px-3 py-2">{money(b.totalAmount)}</td>
                      <td className="px-3 py-2">{money(b.paidAmount)}</td>
                      <td className="px-3 py-2">{money(b.pendingAmount)}</td>
                      <td className="px-3 py-2">
                        <HrStatusChip status={b.status} domain="salaryPaymentBatch" />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {b.status === 'DRAFT' && perms.canCreateSalaryPayment ? (
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              disabled={batchBusyId === b.id}
                              onClick={() => void doReady(b.id)}
                            >
                              Mark Ready
                            </button>
                          ) : null}
                          {b.status === 'READY' && perms.canApproveSalaryPayment ? (
                            <button
                              type="button"
                              className="btn btn--secondary btn--sm"
                              disabled={batchBusyId === b.id}
                              onClick={() => void doApprove(b.id)}
                            >
                              Approve
                            </button>
                          ) : null}
                          {b.status === 'APPROVED' && perms.canConfirmSalaryPayment ? (
                            <button
                              type="button"
                              className="btn btn--primary btn--sm"
                              onClick={() => openBatchDrawer(b)}
                            >
                              Confirm Payment
                            </button>
                          ) : null}
                          {(b.status === 'READY' || b.status === 'APPROVED' || b.status === 'PAID') &&
                          perms.canExportSalaryPayment ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={batchBusyId === b.id}
                              onClick={() => void doExportBatch(b.id, b.code)}
                              title="Export bank CSV"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          ) : null}
                          {b.status !== 'PAID' && b.status !== 'CANCELLED' && perms.canCreateSalaryPayment ? (
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={batchBusyId === b.id}
                              onClick={() => void doCancelBatch(b.id)}
                              title="Cancel batch"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      <HrApprovalDrawer
        open={payslipPreview != null}
        onClose={() => setPayslipPreview(null)}
        title={payslipPreview?.payslipNumber ?? ''}
        subtitle={payslipPreview?.employee?.displayName}
        footer={
          payslipPreview ? (
            <>
              <button type="button" className="btn btn--primary" onClick={() => void onDownloadPayslip(payslipPreview)}>
                <Download className="mr-1 h-4 w-4" />
                Download PDF
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setPayslipPreview(null)}>
                Close
              </button>
            </>
          ) : undefined
        }
      >
        {payslipPreview ? <HrPayslipDocument payslip={payslipPreview} /> : null}
      </HrApprovalDrawer>

      {batchDrawer ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setBatchDrawer(null)}>
          <div
            className="flex h-full w-full max-w-2xl flex-col border-l border-erp-border bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">{batchDrawer.code}</div>
              <div className="text-sm text-erp-muted">
                {batchDrawer.status} · {batchDrawer.employeeCount} employee(s) · {money(batchDrawer.totalAmount)}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-erp-surface text-left text-xs uppercase text-erp-muted">
                  <tr>
                    <th className="px-2 py-2">Employee</th>
                    <th className="px-2 py-2">Bank</th>
                    <th className="px-2 py-2">Amount</th>
                    <th className="px-2 py-2">Status</th>
                    {batchDrawer.status === 'APPROVED' ? <th className="px-2 py-2">Mark failed (reason)</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {(batchDrawer.lines ?? []).map((l) => (
                    <tr key={l.id} className="border-t border-erp-border">
                      <td className="px-2 py-2 font-medium">
                        {l.employee?.displayName ?? l.employeeId}
                        <div className="text-xs text-erp-muted">{l.employee?.employeeCode}</div>
                      </td>
                      <td className="px-2 py-2 text-xs">
                        {l.bankName ?? '-'}
                        <div className="text-erp-muted">
                          {l.accountNumberMasked} · {l.ifsc}
                        </div>
                      </td>
                      <td className="px-2 py-2">{money(l.netPay)}</td>
                      <td className="px-2 py-2">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{l.paymentStatus}</span>
                      </td>
                      {batchDrawer.status === 'APPROVED' ? (
                        <td className="px-2 py-2">
                          <Input
                            placeholder="Leave blank to mark paid"
                            value={failedLines[l.id] ?? ''}
                            onChange={(e) => setFailedLines((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          />
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              {batchDrawer.status === 'APPROVED' && perms.canConfirmSalaryPayment ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={batchBusyId === batchDrawer.id}
                  onClick={() => void doConfirmBatch()}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Confirm Payment
                </button>
              ) : null}
              <button type="button" className="btn btn--ghost" onClick={() => setBatchDrawer(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
