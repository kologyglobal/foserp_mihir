import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  PeriodCloseShell,
  LockStatusBadge,
  ReopenStatusBadge,
  PeriodCloseStatusBadge,
} from '@/components/accounting/period-close'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Modal } from '@/design-system/components/Modal'
import { Button } from '@/design-system/components/Button'
import { FormField } from '@/components/forms/FormField'
import { Input } from '@/components/forms/Inputs'
import { isApiMode } from '@/config/apiConfig'
import {
  closeAccountingPeriod,
  getModuleLocks,
  getPeriodCloseReadiness,
  getReopenRequests,
  getYearEndPreview,
  listPeriodClosePeriods,
  loadPeriodCloseFilter,
  markAccountingPeriodUnderReview,
  reopenAccountingPeriod,
  savePeriodCloseFilter,
  submitReopenRequest,
  updateModuleLock,
  updateReopenStatus,
} from '@/services/accounting/periodCloseService'
import type { AccountingPeriod } from '@/types/financeSetup'
import type {
  ModuleLockStatus,
  ModulePeriodLock,
  PeriodCloseReadiness,
  PeriodFilterState,
  ReopenRequest,
  YearEndPreview,
  YearEndWizardStep,
} from '@/types/periodClose'
import { YEAR_END_STEPS } from '@/types/periodClose'
import { usePeriodClosePermissions } from '@/utils/permissions/periodClose'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { getSessionUser } from '@/utils/permissions'
import { cn } from '@/utils/cn'
import { appConfirm } from '@/store/confirmDialogStore'

export function PeriodLockingPage() {
  const perms = usePeriodClosePermissions()
  const api = isApiMode()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [rows, setRows] = useState<ModulePeriodLock[]>([])
  const [periods, setPeriods] = useState<AccountingPeriod[]>([])
  const [readiness, setReadiness] = useState<PeriodCloseReadiness | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [reopenTarget, setReopenTarget] = useState<AccountingPeriod | null>(null)
  const [reopenReason, setReopenReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      if (api) {
        savePeriodCloseFilter(filter)
        const [periodRows, ready] = await Promise.all([
          listPeriodClosePeriods(),
          getPeriodCloseReadiness(filter).catch(() => null),
        ])
        setPeriods(periodRows)
        setReadiness(ready)
        setRows([])
      } else {
        setRows(await getModuleLocks())
        setPeriods([])
        setReadiness(null)
      }
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load locks')
    } finally {
      setLoading(false)
    }
  }, [perms.canView, api, filter.fiscalYearId, filter.periodId])

  useEffect(() => {
    void load()
  }, [load])

  const onPeriodChange = (next: PeriodFilterState) => {
    setFilter(next)
    savePeriodCloseFilter(next)
  }
  const onLock = async (id: string, status: ModuleLockStatus) => {
    if (!perms.canLock) {
      notify.error('You do not have permission to change period locks.')
      return
    }
    if (status === 'soft_locked' && !overrideReason.trim()) {
      notify.error('Soft lock requires an override / reason note in demo mode.')
      return
    }
    try {
      await updateModuleLock(id, status, getSessionUser().name || 'User', overrideReason.trim() || undefined)
      notify.info('Period lock updated in demo mode. No modules were actually locked.')
      setOverrideReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Lock update failed')
    }
  }

  const onClose = async (p: AccountingPeriod) => {
    if (!perms.canClosePeriod) {
      notify.error('Missing finance.period.close permission.')
      return
    }
    if (readiness?.hardBlockEnabled && readiness.blockingCount > 0 && readiness.periodId === p.id) {
      notify.error('Hard-block close is enabled. Clear readiness blockers before closing this period.')
      return
    }
    const ok = await appConfirm({
      title: 'Close period?',
      description: `Close ${p.name}? Journal posting into this period will be blocked.`,
      confirmLabel: 'Close period',
    })
    if (!ok) return
    try {
      await closeAccountingPeriod(p.id)
      notify.success(`${p.name} closed. Posting into this period is now blocked.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Close failed')
    }
  }

  const onUnderReview = async (p: AccountingPeriod) => {
    if (!perms.canMarkUnderReview) {
      notify.error('Missing finance.period.manage permission.')
      return
    }
    try {
      await markAccountingPeriodUnderReview(p.id)
      notify.success(`${p.name} marked under review.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Under review failed')
    }
  }

  const onReopen = async () => {
    if (!reopenTarget || !reopenReason.trim()) return
    if (!perms.canReopenPeriod) {
      notify.error('Missing finance.period.reopen permission.')
      return
    }
    try {
      await reopenAccountingPeriod(reopenTarget.id, reopenReason.trim())
      notify.success(`${reopenTarget.name} reopened.`)
      setReopenTarget(null)
      setReopenReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Reopen failed')
    }
  }

  return (
    <PeriodCloseShell
      title="Period Locking"
      description={
        api
          ? 'Close, mark under review, or reopen accounting periods. Closed periods block journal posting (finance.period.*).'
          : 'Module-wise soft and hard locks. Hard lock requires an approved reopen request before posting.'
      }
      periodFilter={filter}
      onPeriodChange={onPeriodChange}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {!api ? (
        <label className="mb-3 flex max-w-md flex-col gap-1 text-[11px] font-semibold text-erp-muted">
          Soft lock / override reason
          <input
            className="h-8 rounded border border-erp-border px-2 text-[12px] text-erp-text"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="Required for soft lock actions"
            aria-label="Override reason"
          />
        </label>
      ) : (
        <div className="mb-3 space-y-2">
          <p className="text-[12px] text-erp-muted">
            {readiness?.hardBlockEnabled
              ? 'Hard-block close is ON (Finance Settings → periodCloseHardBlock). Close is rejected when readiness has BLOCK checks.'
              : 'Hard-block close is OFF. Readiness blockers below are advisory — backend still allows close unless you enable periodCloseHardBlock.'}
          </p>
          {readiness && readiness.blockingCount > 0 ? (
            <div className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-950">
              <div className="font-semibold">
                {readiness.blockingCount} blocker(s) for {readiness.periodLabel}
              </div>
              <ul className="mt-1 list-disc pl-4">
                {(readiness.blockers ?? readiness.checks.filter((c) => c.severity === 'blocking')).map((b) => (
                  <li key={b.code}>{b.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error && api ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                <th className="py-1.5 pr-2 font-semibold">#</th>
                <th className="py-1.5 pr-2 font-semibold">Period</th>
                <th className="py-1.5 pr-2 font-semibold">Start</th>
                <th className="py-1.5 pr-2 font-semibold">End</th>
                <th className="py-1.5 pr-2 font-semibold">Status</th>
                <th className="py-1.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {periods.map((p) => (
                <tr key={p.id} className="border-b border-erp-border/60">
                  <td className="py-1.5 pr-2 text-erp-muted">{p.periodNumber}</td>
                  <td className="py-1.5 pr-2 font-medium text-erp-text">{p.name}</td>
                  <td className="py-1.5 pr-2 text-erp-muted">{formatDate(p.startDate)}</td>
                  <td className="py-1.5 pr-2 text-erp-muted">{formatDate(p.endDate)}</td>
                  <td className="py-1.5 pr-2">
                    <LockStatusBadge
                      status={
                        p.status === 'CLOSED'
                          ? 'hard_locked'
                          : p.status === 'UNDER_REVIEW'
                            ? 'soft_locked'
                            : p.status === 'REOPENED'
                              ? 'reopened_temporarily'
                              : 'open'
                      }
                    />
                    <span className="ml-1 text-[11px] text-erp-muted">{p.status}</span>
                  </td>
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {p.status !== 'CLOSED' && p.status !== 'UNDER_REVIEW' ? (
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                          disabled={!perms.canMarkUnderReview}
                          onClick={() => void onUnderReview(p)}
                        >
                          Under Review
                        </button>
                      ) : null}
                      {p.status !== 'CLOSED' ? (
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                          disabled={
                            !perms.canClosePeriod ||
                            Boolean(
                              readiness?.hardBlockEnabled &&
                                readiness.blockingCount > 0 &&
                                readiness.periodId === p.id,
                            )
                          }
                          title={
                            readiness?.hardBlockEnabled && readiness.blockingCount > 0 && readiness.periodId === p.id
                              ? 'Clear readiness blockers first'
                              : undefined
                          }
                          onClick={() => void onClose(p)}
                        >
                          Close
                        </button>
                      ) : null}
                      {p.status === 'CLOSED' || p.status === 'UNDER_REVIEW' ? (
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                          disabled={!perms.canReopenPeriod}
                          onClick={() => setReopenTarget(p)}
                        >
                          Reopen
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      {!loading && !error && !api ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                <th className="py-1.5 pr-2 font-semibold">Module</th>
                <th className="py-1.5 pr-2 font-semibold">Lock Through Date</th>
                <th className="py-1.5 pr-2 font-semibold">Status</th>
                <th className="py-1.5 pr-2 font-semibold">Locked By</th>
                <th className="py-1.5 pr-2 font-semibold">Locked Date</th>
                <th className="py-1.5 pr-2 font-semibold">Reopen Allowed</th>
                <th className="py-1.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-erp-border/60">
                  <td className="py-1.5 pr-2 font-medium text-erp-text">{r.module}</td>
                  <td className="py-1.5 pr-2 text-erp-muted">{formatDate(r.lockThroughDate)}</td>
                  <td className="py-1.5 pr-2">
                    <LockStatusBadge status={r.status} />
                  </td>
                  <td className="py-1.5 pr-2 text-erp-muted">{r.lockedBy ?? '—'}</td>
                  <td className="py-1.5 pr-2 text-erp-muted">
                    {r.lockedDate ? formatDate(r.lockedDate) : '—'}
                  </td>
                  <td className="py-1.5 pr-2 text-erp-muted">{r.reopenAllowed ? 'Yes' : 'No'}</td>
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                        disabled={!perms.canLock}
                        onClick={() => void onLock(r.id, 'soft_locked')}
                      >
                        Soft Lock
                      </button>
                      <button
                        type="button"
                        className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                        disabled={!perms.canLock}
                        onClick={() => void onLock(r.id, 'hard_locked')}
                      >
                        Hard Lock
                      </button>
                      <button
                        type="button"
                        className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                        disabled={!perms.canLock || !r.reopenAllowed}
                        onClick={() => void onLock(r.id, 'open')}
                      >
                        Open
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Modal
        open={Boolean(reopenTarget)}
        onClose={() => setReopenTarget(null)}
        title="Reopen period"
        description={`Provide a reason to reopen ${reopenTarget?.name ?? 'period'}.`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReopenTarget(null)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={() => void onReopen()} disabled={!reopenReason.trim()}>
              Reopen
            </Button>
          </div>
        }
      >
        <FormField label="Reason" required>
          <Input
            value={reopenReason}
            onChange={(e) => setReopenReason(e.target.value)}
            placeholder="e.g. Correction for accrual entry"
          />
        </FormField>
      </Modal>
    </PeriodCloseShell>
  )
}

export function ReopenRequestsPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [rows, setRows] = useState<ReopenRequest[]>([])
  const [selected, setSelected] = useState<ReopenRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    periodCode: filter.periodCode,
    module: 'Inventory',
    reason: 'Incorrect Amount',
    documentRef: '',
    requestedUntil: '',
    riskExplanation: '',
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!perms.canView) {
      setError('You do not have permission to view period close.')
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      setRows(await getReopenRequests())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load reopen requests')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const onSubmit = async () => {
    if (!perms.canReopenRequest) {
      notify.error('You do not have permission to submit reopen requests.')
      return
    }
    if (!form.riskExplanation.trim() || !form.requestedUntil) {
      notify.error('Requested until and risk explanation are required.')
      return
    }
    try {
      await submitReopenRequest({
        periodCode: form.periodCode,
        module: form.module,
        reason: form.reason,
        documentRef: form.documentRef || undefined,
        requestedBy: getSessionUser().name || 'User',
        requestedUntil: form.requestedUntil,
        riskExplanation: form.riskExplanation,
        approver: 'Rajesh Patel',
      })
      notify.success('Reopen request submitted in demo mode.')
      setShowForm(false)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Submit failed')
    }
  }

  const onDecision = async (id: string, status: 'approved' | 'rejected') => {
    if (!perms.canApproveReopen) {
      notify.error('You do not have permission to approve reopen requests.')
      return
    }
    try {
      await updateReopenStatus(id, status, getSessionUser().name || 'Approver')
      notify.info(`Reopen request ${status} in demo mode.`)
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <PeriodCloseShell
      title="Reopen Requests"
      description="Controlled temporary reopen of locked periods with full audit history."
      periodFilter={filter}
      onPeriodChange={(n) => {
        setFilter(n)
        setForm((f) => ({ ...f, periodCode: n.periodCode }))
      }}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{
            id: 'new',
            label: 'New Reopen Request',
            disabled: !perms.canReopenRequest,
            onClick: () => setShowForm(true),
          }}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {showForm ? (
        <div className="mb-3 grid gap-2 rounded border border-erp-border p-3 sm:grid-cols-2">
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
            Period
            <input
              className="h-8 rounded border border-erp-border px-2 text-[12px]"
              value={form.periodCode}
              onChange={(e) => setForm({ ...form, periodCode: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
            Module
            <input
              className="h-8 rounded border border-erp-border px-2 text-[12px]"
              value={form.module}
              onChange={(e) => setForm({ ...form, module: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
            Reason
            <select
              className="h-8 rounded border border-erp-border px-2 text-[12px]"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            >
              {[
                'Incorrect Account',
                'Incorrect Amount',
                'Duplicate Entry',
                'Wrong Party',
                'Wrong Posting Date',
                'Cancelled Transaction',
                'Other',
              ].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
            Document requiring correction
            <input
              className="h-8 rounded border border-erp-border px-2 text-[12px]"
              value={form.documentRef}
              onChange={(e) => setForm({ ...form, documentRef: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
            Requested Until
            <input
              type="date"
              className="h-8 rounded border border-erp-border px-2 text-[12px]"
              value={form.requestedUntil}
              onChange={(e) => setForm({ ...form, requestedUntil: e.target.value })}
            />
          </label>
          <label className="sm:col-span-2 flex flex-col gap-0.5 text-[11px] font-semibold text-erp-muted">
            Risk explanation
            <textarea
              className="min-h-[64px] rounded border border-erp-border px-2 py-1.5 text-[12px]"
              value={form.riskExplanation}
              onChange={(e) => setForm({ ...form, riskExplanation: e.target.value })}
            />
          </label>
          <div className="sm:col-span-2 flex gap-2">
            <button
              type="button"
              className="rounded bg-erp-primary px-3 py-1.5 text-[12px] font-semibold text-white"
              onClick={() => void onSubmit()}
            >
              Submit
            </button>
            <button
              type="button"
              className="rounded border border-erp-border px-3 py-1.5 text-[12px] font-semibold"
              onClick={() => setShowForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {!loading && !error ? (
        <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Period</th>
                  <th className="py-1.5 pr-2 font-semibold">Module</th>
                  <th className="py-1.5 pr-2 font-semibold">Reason</th>
                  <th className="py-1.5 pr-2 font-semibold">Requested By</th>
                  <th className="py-1.5 pr-2 font-semibold">Until</th>
                  <th className="py-1.5 pr-2 font-semibold">Status</th>
                  <th className="py-1.5 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">{r.periodCode}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{r.module}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{r.reason}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{r.requestedBy}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{formatDate(r.requestedUntil)}</td>
                    <td className="py-1.5 pr-2">
                      <ReopenStatusBadge status={r.status} />
                    </td>
                    <td className="py-1.5">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold"
                          onClick={() => setSelected(r)}
                        >
                          Audit
                        </button>
                        {r.status === 'pending_approval' ? (
                          <>
                            <button
                              type="button"
                              className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                              disabled={!perms.canApproveReopen}
                              onClick={() => void onDecision(r.id, 'approved')}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                              disabled={!perms.canApproveReopen}
                              onClick={() => void onDecision(r.id, 'rejected')}
                            >
                              Reject
                            </button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected ? (
            <aside className="rounded border border-erp-border p-3 text-[12px]">
              <h2 className="font-semibold text-erp-text">Audit history</h2>
              <p className="mt-1 text-erp-muted">{selected.riskExplanation}</p>
              <ul className="mt-2 space-y-2">
                {selected.audit.map((a, i) => (
                  <li key={`${a.at}-${i}`}>
                    <div className="font-medium text-erp-text">{a.action}</div>
                    <div className="text-erp-muted">
                      {a.by} · {formatDate(a.at)}
                    </div>
                    {a.note ? <div className="text-erp-muted">{a.note}</div> : null}
                  </li>
                ))}
              </ul>
            </aside>
          ) : null}
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}

export function YearEndClosingPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [step, setStep] = useState<YearEndWizardStep>('select_fy')
  const [preview, setPreview] = useState<YearEndPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stepMeta = YEAR_END_STEPS.find((s) => s.id === step) ?? YEAR_END_STEPS[0]
  const stepIndex = YEAR_END_STEPS.findIndex((s) => s.id === step)

  const loadPreview = useCallback(async () => {
    if (!perms.canYearEndPreview) {
      setError('You do not have permission to preview year-end closing.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      setPreview(await getYearEndPreview(filter.fiscalYear))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load year-end preview')
    } finally {
      setLoading(false)
    }
  }, [filter.fiscalYear, perms.canYearEndPreview])

  useEffect(() => {
    if (stepIndex >= 3) void loadPreview()
  }, [stepIndex, loadPreview])

  const goNext = () => {
    const next = YEAR_END_STEPS[stepIndex + 1]
    if (next) setStep(next.id)
  }
  const goPrev = () => {
    const prev = YEAR_END_STEPS[stepIndex - 1]
    if (prev) setStep(prev.id)
  }

  const onFinal = () => {
    if (!perms.canApproveYearEnd) {
      notify.error('You do not have permission to approve year-end closing.')
      return
    }
    notify.info(
      'Year-end closing preview prepared in demo mode. No ledger balances were updated.',
    )
  }

  return (
    <PeriodCloseShell
      title="Year-End Closing"
      description="Controlled year-end wizard — preview only; no real closing entries."
      periodFilter={filter}
      onPeriodChange={setFilter}
    >
      <ol className="mb-3 flex flex-wrap gap-1" aria-label="Year-end steps">
        {YEAR_END_STEPS.map((s, i) => (
          <li key={s.id}>
            <button
              type="button"
              className={cn(
                'rounded border px-2 py-1 text-[10px] font-semibold',
                i === stepIndex
                  ? 'border-erp-primary bg-erp-primary/10 text-erp-primary'
                  : i < stepIndex
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-erp-border text-erp-muted',
              )}
              onClick={() => setStep(s.id)}
            >
              {s.step}. {s.label}
            </button>
          </li>
        ))}
      </ol>

      <section className="rounded border border-erp-border p-3">
        <h2 className="text-[14px] font-semibold text-erp-text">
          Step {stepMeta.step}: {stepMeta.label}
        </h2>
        {loading ? <LoadingState /> : null}
        {error ? <p className="mt-2 text-[13px] text-rose-700">{error}</p> : null}

        {step === 'select_fy' ? (
          <p className="mt-2 text-[12px] text-erp-muted">
            Selected financial year: <strong className="text-erp-text">{filter.fiscalYear}</strong> (change via period
            bar).
          </p>
        ) : null}

        {step === 'validate_open_periods' ? (
          <p className="mt-2 text-[12px] text-erp-muted">
            Demo validation: June 2026 hard-locked; July 2026 open for close preparation. Resolve open periods before
            year-end.
          </p>
        ) : null}

        {step === 'validate_reconciliations' ? (
          <p className="mt-2 text-[12px] text-erp-muted">
            Subledger differences remain on AR, Inventory and Bank. Year-end should not proceed until reconciliations
            are reviewed.
          </p>
        ) : null}

        {preview && stepIndex >= 3 ? (
          <div className="mt-3 space-y-2 text-[12px]">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded border border-erp-border p-2">
                <div className="text-[10px] font-bold uppercase text-erp-muted">Revenue to Close</div>
                <div className="font-semibold tabular-nums">{formatCurrency(preview.revenueToClose)}</div>
              </div>
              <div className="rounded border border-erp-border p-2">
                <div className="text-[10px] font-bold uppercase text-erp-muted">Expense to Close</div>
                <div className="font-semibold tabular-nums">{formatCurrency(preview.expenseToClose)}</div>
              </div>
              <div className="rounded border border-erp-border p-2">
                <div className="text-[10px] font-bold uppercase text-erp-muted">Profit / Loss</div>
                <div className="font-semibold tabular-nums">{formatCurrency(preview.profitOrLoss)}</div>
              </div>
              <div className="rounded border border-erp-border p-2">
                <div className="text-[10px] font-bold uppercase text-erp-muted">Retained Earnings</div>
                <div className="font-medium">{preview.retainedEarningsAccount}</div>
              </div>
            </div>
            {preview.exceptions.length ? (
              <ul className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-950">
                {preview.exceptions.map((ex) => (
                  <li key={ex}>{ex}</li>
                ))}
              </ul>
            ) : null}
            <PeriodCloseStatusBadge
              status={preview.unresolvedDifferences ? 'Blocked' : 'Ready for Review'}
            />
          </div>
        ) : null}

        {step === 'lock_financial_year' ? (
          <div className="mt-3 space-y-2">
            <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[12px] text-amber-950">
              Year-end closing preview prepared in demo mode. No ledger balances were updated.
            </p>
            <button
              type="button"
              className="rounded bg-erp-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
              disabled={!perms.canApproveYearEnd}
              onClick={onFinal}
            >
              Confirm Year-End Preview
            </button>
          </div>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded border border-erp-border px-3 py-1.5 text-[12px] font-semibold disabled:opacity-50"
            disabled={stepIndex === 0}
            onClick={goPrev}
          >
            Back
          </button>
          <button
            type="button"
            className="rounded bg-erp-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            disabled={stepIndex >= YEAR_END_STEPS.length - 1}
            onClick={goNext}
          >
            Continue
          </button>
        </div>
      </section>
    </PeriodCloseShell>
  )
}
