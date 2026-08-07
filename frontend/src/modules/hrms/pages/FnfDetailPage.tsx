import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, Banknote, Calculator, Check, Landmark, Printer, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import { appConfirm } from '@/store/confirmDialogStore'
import {
  approveFnf,
  calculateFnf,
  getExit,
  getFnfSettlement,
  payFnf,
  postFnf,
  reviewFnf,
  type HrEmployeeExit,
  type HrFnfPaymentMethod,
  type HrFullFinalSettlement,
} from '@/services/api/hrmsApi'
import { listTreasuryAccounts } from '@/services/api/treasuryApi'
import { notify } from '@/store/toastStore'
import { useHrmsPermissions } from '@/utils/permissions/hrms'
import { EXIT_TYPE_LABELS, money } from './exitUi'
import { HrEmptyState, HrMoneySummary, HrStatusChip } from '@/modules/hrms/components'
import '../hrms-ui.css'

export function FnfDetailPage() {
  const { id } = useParams<{ id: string }>()
  const perms = useHrmsPermissions()

  const [exit, setExit] = useState<HrEmployeeExit | null>(null)
  const [settlement, setSettlement] = useState<HrFullFinalSettlement | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  const [treasuryAccounts, setTreasuryAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])

  const [showPay, setShowPay] = useState(false)
  const [payTreasuryAccountId, setPayTreasuryAccountId] = useState('')
  const [payMethod, setPayMethod] = useState<HrFnfPaymentMethod>('BANK')
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10))
  const [payReference, setPayReference] = useState('')

  const load = async () => {
    if (!id) return
    setLoading(true)
    try {
      const exitRes = await getExit(id)
      setExit(exitRes.data ?? null)
      try {
        const settlementRes = await getFnfSettlement(id)
        setSettlement(settlementRes.data ?? null)
      } catch {
        setSettlement(null)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load exit')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  useEffect(() => {
    if (!settlement?.legalEntityId) return
    void listTreasuryAccounts({ legalEntityId: settlement.legalEntityId, status: 'ACTIVE', limit: 100 })
      .then((res) => setTreasuryAccounts(res.items.map((a) => ({ id: a.id, code: a.code, name: a.name }))))
      .catch(() => undefined)
  }, [settlement?.legalEntityId])

  const doCalculate = async () => {
    if (!id || !perms.canCalculateFnf) return
    setBusy(true)
    try {
      const res = await calculateFnf(id)
      setSettlement(res.data ?? null)
      notify.success('Settlement calculated')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Calculate failed')
    } finally {
      setBusy(false)
    }
  }

  const doReview = async () => {
    if (!id || !perms.canApproveFnf) return
    setBusy(true)
    try {
      const res = await reviewFnf(id)
      setSettlement(res.data ?? null)
      notify.success('Marked reviewed')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Review failed')
    } finally {
      setBusy(false)
    }
  }

  const doApprove = async () => {
    if (!id || !perms.canApproveFnf) return
    const ok = await appConfirm({
      title: 'Approve full & final settlement',
      description: 'This locks the settlement — recalculation will no longer be possible.',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await approveFnf(id)
      setSettlement(res.data ?? null)
      notify.success('Settlement approved')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setBusy(false)
    }
  }

  const doPost = async () => {
    if (!id || !perms.canPostFnf) return
    const ok = await appConfirm({
      title: 'Post full & final settlement',
      description: 'This will create the accounting journal entry for this settlement.',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await postFnf(id)
      setSettlement(res.data ?? null)
      notify.success('Settlement posted')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Post failed')
    } finally {
      setBusy(false)
    }
  }

  const openPay = () => {
    setPayTreasuryAccountId('')
    setPayMethod('BANK')
    setPayDate(new Date().toISOString().slice(0, 10))
    setPayReference('')
    setShowPay(true)
  }

  const doPay = async () => {
    if (!id || !perms.canPayFnf) return
    if (!payTreasuryAccountId || !payDate) {
      notify.error('Select a treasury account and payment date')
      return
    }
    setBusy(true)
    try {
      const res = await payFnf(id, {
        treasuryAccountId: payTreasuryAccountId,
        method: payMethod,
        paymentDate: payDate,
        reference: payReference.trim() || undefined,
      })
      setSettlement(res.data ?? null)
      notify.success('Settlement paid')
      setShowPay(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Payment failed')
    } finally {
      setBusy(false)
    }
  }

  const doPrint = () => window.print()

  if (loading || !exit) {
    return (
      <OperationalPageShell title="Full & Final Settlement" breadcrumbs={[{ label: 'HRMS' }, { label: 'Full & Final' }]}>
        <LoadingState />
      </OperationalPageShell>
    )
  }

  const blockers = settlement?.exceptions.filter((e) => e.severity === 'BLOCKER') ?? []
  const warnings = settlement?.exceptions.filter((e) => e.severity === 'WARNING') ?? []
  const isNegative = (settlement?.netSettlement ?? 0) < 0

  return (
    <OperationalPageShell
      title={`${settlement?.code ?? exit.code} — ${exit.employee?.displayName ?? exit.employeeId}`}
      description={`${EXIT_TYPE_LABELS[exit.exitType] ?? exit.exitType} · ${exit.employee?.employeeCode ?? ''}${settlement ? ` · ${settlement.status}` : ''}`}
      breadcrumbs={[
        { label: 'HRMS', to: '/hrms' },
        { label: 'Full & Final', to: '/hrms/fnf' },
        { label: settlement?.code ?? exit.code },
      ]}
    >
      <ErpCommandBar
        primaryAction={
          (!settlement || ['DRAFT', 'CALCULATED'].includes(settlement.status)) && perms.canCalculateFnf && exit.approvedLastWorkingDate
            ? {
                id: 'calculate',
                label: settlement ? 'Recalculate' : 'Calculate',
                icon: Calculator,
                onClick: () => void doCalculate(),
                disabled: busy,
              }
            : settlement?.status === 'CALCULATED' && perms.canApproveFnf
              ? { id: 'review', label: 'Review', icon: Send, onClick: () => void doReview(), disabled: busy }
              : settlement && ['CALCULATED', 'REVIEWED'].includes(settlement.status) && perms.canApproveFnf
                ? {
                    id: 'approve',
                    label: 'Approve',
                    icon: Check,
                    onClick: () => void doApprove(),
                    disabled: busy || blockers.length > 0,
                    disabledReason: blockers.length > 0 ? 'Resolve blocking exceptions before approving' : undefined,
                  }
                : settlement?.status === 'APPROVED' && perms.canPostFnf
                  ? { id: 'post', label: 'Post', icon: Landmark, onClick: () => void doPost(), disabled: busy }
                  : settlement?.status === 'POSTED' && !isNegative && perms.canPayFnf
                    ? { id: 'pay', label: 'Pay', icon: Banknote, onClick: openPay, disabled: busy }
                    : undefined
        }
        secondaryActions={settlement ? [{ id: 'print', label: 'Print', icon: Printer, onClick: doPrint }] : []}
      />

      <div className="mb-4 grid gap-3 rounded border border-erp-border bg-white p-4 text-sm md:grid-cols-4">
        <div>
          <div className="text-xs uppercase text-erp-muted">Last working date</div>
          <div className="text-lg font-semibold">{settlement?.lastWorkingDate ?? exit.approvedLastWorkingDate ?? exit.requestedLastWorkingDate}</div>
        </div>
        <div>
          <div className="text-xs uppercase text-erp-muted">Status</div>
          <div>
            {settlement ? <HrStatusChip status={settlement.status} domain="fnf" /> : <span className="text-erp-muted">Not calculated</span>}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-erp-muted">Exit</div>
          <div>
            <Link className="text-erp-primary" to={`/hrms/exits/${exit.id}`}>
              {exit.code}
            </Link>
          </div>
        </div>
        <div>
          <div className="text-xs uppercase text-erp-muted">Employee</div>
          <div>{exit.employee?.displayName}</div>
        </div>
      </div>

      {!settlement ? (
        <HrEmptyState
          icon={Calculator}
          title="No settlement calculated"
          description={
            exit.approvedLastWorkingDate
              ? 'Calculate the full & final settlement to see earnings, deductions, and the net amount.'
              : 'The exit must be approved (last working date locked) before a settlement can be calculated.'
          }
          primaryAction={
            exit.approvedLastWorkingDate && perms.canCalculateFnf
              ? { label: 'Calculate Settlement', onClick: () => void doCalculate() }
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          <HrMoneySummary
            items={[
              { label: 'Earnings', value: money(settlement.earningsTotal), tone: 'positive' },
              { label: 'Deductions', value: money(settlement.deductionsTotal), tone: 'negative' },
            ]}
            total={{
              label: 'Net Settlement',
              value: money(settlement.netSettlement),
              tone: isNegative ? 'negative' : 'default',
            }}
          />

          {isNegative ? (
            <div className="flex items-start gap-2 rounded border border-erp-danger-solid/30 bg-erp-danger-solid/5 p-3 text-sm text-erp-danger-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-medium">Amount recoverable from employee</div>
                <div>
                  The net settlement is negative — {money(Math.abs(settlement.netSettlement))} is owed by the employee, not payable to
                  them. No payment step applies.
                </div>
              </div>
            </div>
          ) : null}

          {blockers.length > 0 ? (
            <div className="space-y-1 rounded border border-erp-danger-solid/30 bg-erp-danger-solid/5 p-3 text-sm text-erp-danger-fg">
              <div className="font-medium">{blockers.length} blocking exception(s) — must be resolved before approval</div>
              <ul className="list-inside list-disc">
                {blockers.map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="space-y-1 rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              <div className="font-medium">{warnings.length} warning(s)</div>
              <ul className="list-inside list-disc">
                {warnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded border border-erp-border bg-white p-4 text-sm">
              <h3 className="mb-3 font-semibold">Earnings</h3>
              {settlement.components.filter((c) => c.kind === 'EARNING').length === 0 ? (
                <p className="text-erp-muted">No earning components.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <tbody>
                    {settlement.components
                      .filter((c) => c.kind === 'EARNING')
                      .map((c) => (
                        <tr key={c.id} className="border-t border-erp-border first:border-t-0">
                          <td className="py-1.5 pr-2">
                            <div>{c.name}</div>
                            {c.calculationBasis ? <div className="text-xs text-erp-muted">{c.calculationBasis}</div> : null}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{money(c.amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              <div className="mt-2 flex justify-between border-t border-erp-border pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(settlement.earningsTotal)}</span>
              </div>
            </div>

            <div className="rounded border border-erp-border bg-white p-4 text-sm">
              <h3 className="mb-3 font-semibold">Deductions</h3>
              {settlement.components.filter((c) => c.kind === 'DEDUCTION').length === 0 ? (
                <p className="text-erp-muted">No deduction components.</p>
              ) : (
                <table className="min-w-full text-sm">
                  <tbody>
                    {settlement.components
                      .filter((c) => c.kind === 'DEDUCTION')
                      .map((c) => (
                        <tr key={c.id} className="border-t border-erp-border first:border-t-0">
                          <td className="py-1.5 pr-2">
                            <div>{c.name}</div>
                            {c.calculationBasis ? <div className="text-xs text-erp-muted">{c.calculationBasis}</div> : null}
                          </td>
                          <td className="py-1.5 text-right tabular-nums">{money(c.amount)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
              <div className="mt-2 flex justify-between border-t border-erp-border pt-2 font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{money(settlement.deductionsTotal)}</span>
              </div>
            </div>
          </div>

          <div className="rounded border border-erp-border bg-white p-4 text-sm">
            <h3 className="mb-3 font-semibold">Payment &amp; Posting</h3>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              <div>
                <div className="text-xs text-erp-muted">Posted voucher</div>
                <div>
                  {settlement.accountingVoucherId ? (
                    <Link className="text-erp-primary" to={`/accounting/ledger-entries/voucher/${settlement.accountingVoucherId}`}>
                      View
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Posted at</div>
                <div>{settlement.postedAt ? new Date(settlement.postedAt).toLocaleString() : '-'}</div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Payment voucher</div>
                <div>
                  {settlement.paymentVoucherId ? (
                    <Link className="text-erp-primary" to={`/accounting/ledger-entries/voucher/${settlement.paymentVoucherId}`}>
                      View
                    </Link>
                  ) : (
                    '-'
                  )}
                </div>
              </div>
              <div>
                <div className="text-xs text-erp-muted">Paid at</div>
                <div>{settlement.paidAt ? new Date(settlement.paidAt).toLocaleString() : '-'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPay ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={() => setShowPay(false)}>
          <div className="flex h-full w-full max-w-md flex-col border-l border-erp-border bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-erp-border px-4 py-3">
              <div className="font-medium">Pay Settlement</div>
              <div className="text-sm text-erp-muted">
                {exit.employee?.displayName} · {money(settlement?.netSettlement)}
              </div>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
              <FormField label="Treasury account" required>
                <Select value={payTreasuryAccountId} onChange={(e) => setPayTreasuryAccountId(e.target.value)} required>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {treasuryAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Method" required>
                <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value as HrFnfPaymentMethod)} required>
                  <option value="BANK">Bank</option>
                  <option value="CASH">Cash</option>
                </Select>
              </FormField>
              <FormField label="Payment date" required>
                <Input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} required />
              </FormField>
              <FormField label="Reference">
                <Input value={payReference} onChange={(e) => setPayReference(e.target.value)} />
              </FormField>
            </div>
            <div className="flex gap-2 border-t border-erp-border p-4">
              <button type="button" className="btn btn--primary" disabled={busy} onClick={() => void doPay()}>
                Pay
              </button>
              <button type="button" className="btn btn--ghost" onClick={() => setShowPay(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
