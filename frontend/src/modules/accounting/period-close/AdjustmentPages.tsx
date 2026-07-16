import { useCallback, useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { PeriodCloseShell, PeriodCloseStatusBadge } from '@/components/accounting/period-close'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  getAccruals,
  getFxRevaluation,
  getPrepaidExpenses,
  getTrialBalanceReview,
  loadPeriodCloseFilter,
  previewAccrualPosting,
  updatePrepaidStatus,
} from '@/services/accounting/periodCloseService'
import type { AccrualEntry, PeriodFilterState, PrepaidExpense, TrialBalanceLine } from '@/types/periodClose'
import { usePeriodClosePermissions } from '@/utils/permissions/periodClose'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

export function AccrualsPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [rows, setRows] = useState<AccrualEntry[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<'info' | 'preview'>('info')
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
      const list = await getAccruals()
      setRows(list)
      setSelectedId((prev) => prev ?? list[0]?.id ?? null)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load accruals')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load, filter.periodCode])

  const selected = rows.find((r) => r.id === selectedId) ?? null

  const onPreview = async () => {
    if (!selected) return
    if (!perms.canManageAccruals) {
      notify.error('You do not have permission to preview accruals.')
      return
    }
    try {
      await previewAccrualPosting(selected.id)
      notify.info('Accounting preview prepared in demo mode. No ledger entries were posted.')
      await load()
      setWorkspace('preview')
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Preview failed')
    }
  }

  return (
    <PeriodCloseShell
      title="Provisions & Accruals"
      description="Month-end accruals and provisions with debit/credit preview only."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error ? (
        <div className="space-y-3">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Accrual Number</th>
                  <th className="py-1.5 pr-2 font-semibold">Type</th>
                  <th className="py-1.5 pr-2 font-semibold">Account</th>
                  <th className="py-1.5 pr-2 font-semibold">Department</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Amount</th>
                  <th className="py-1.5 pr-2 font-semibold">Reversal</th>
                  <th className="py-1.5 pr-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-b border-erp-border/60',
                      selectedId === r.id ? 'bg-erp-primary/5' : '',
                    )}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="py-1.5 pr-2 font-medium text-erp-primary">{r.accrualNumber}</td>
                    <td className="py-1.5 pr-2 text-erp-text">{r.accrualType}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">
                      {r.accountCode} {r.accountName}
                    </td>
                    <td className="py-1.5 pr-2 text-erp-muted">{r.department ?? '—'}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.amount)}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{formatDate(r.reversalDate)}</td>
                    <td className="py-1.5 pr-2">
                      <PeriodCloseStatusBadge
                        status={
                          r.status === 'ready'
                            ? 'Ready for Review'
                            : r.status === 'previewed'
                              ? 'In Progress'
                              : r.status === 'draft'
                                ? 'Draft'
                                : r.status
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selected ? (
            <div className="rounded border border-erp-border">
              <div className="flex gap-1 border-b border-erp-border px-2" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspace === 'info'}
                  className={cn(
                    'border-b-2 px-3 py-2 text-[12px] font-semibold',
                    workspace === 'info'
                      ? 'border-erp-primary text-erp-primary'
                      : 'border-transparent text-erp-muted',
                  )}
                  onClick={() => setWorkspace('info')}
                >
                  Accrual Information
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={workspace === 'preview'}
                  className={cn(
                    'border-b-2 px-3 py-2 text-[12px] font-semibold',
                    workspace === 'preview'
                      ? 'border-erp-primary text-erp-primary'
                      : 'border-transparent text-erp-muted',
                  )}
                  onClick={() => setWorkspace('preview')}
                >
                  Accounting Preview
                </button>
              </div>
              <div className="p-3 text-[12px]">
                {workspace === 'info' ? (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    <div>
                      <dt className="text-erp-muted">Narration</dt>
                      <dd className="font-medium text-erp-text">{selected.narration}</dd>
                    </div>
                    <div>
                      <dt className="text-erp-muted">Source</dt>
                      <dd className="font-medium text-erp-text">{selected.source}</dd>
                    </div>
                    <div>
                      <dt className="text-erp-muted">Cost Centre</dt>
                      <dd className="font-medium text-erp-text">{selected.costCentre ?? '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-erp-muted">Start Period</dt>
                      <dd className="font-medium text-erp-text">{selected.startPeriod}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <button
                        type="button"
                        className="rounded bg-erp-primary px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                        disabled={!perms.canManageAccruals}
                        onClick={() => void onPreview()}
                      >
                        Generate Posting Preview
                      </button>
                    </div>
                  </dl>
                ) : (
                  <div className="space-y-2">
                    <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] text-amber-950">
                      Preview only — debit and credit accounts shown without creating real postings.
                    </p>
                    <table className="w-full border-collapse text-left">
                      <thead>
                        <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                          <th className="py-1 pr-2">Account</th>
                          <th className="py-1 pr-2 text-right">Debit</th>
                          <th className="py-1 text-right">Credit</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-erp-border/60">
                          <td className="py-1.5 pr-2">{selected.debitAccount}</td>
                          <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(selected.amount)}</td>
                          <td className="py-1.5 text-right">—</td>
                        </tr>
                        <tr>
                          <td className="py-1.5 pr-2">{selected.creditAccount}</td>
                          <td className="py-1.5 pr-2 text-right">—</td>
                          <td className="py-1.5 text-right tabular-nums">{formatCurrency(selected.amount)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}

export function PrepaidExpensesPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [rows, setRows] = useState<PrepaidExpense[]>([])
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
      setRows(await getPrepaidExpenses())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load prepaid')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const onStatus = async (id: string, status: PrepaidExpense['status']) => {
    if (!perms.canManagePrepaid) {
      notify.error('You do not have permission to update prepaid expenses.')
      return
    }
    try {
      await updatePrepaidStatus(id, status)
      notify.info('Prepaid status updated in demo mode. No posting was created.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Update failed')
    }
  }

  return (
    <PeriodCloseShell
      title="Prepaid Expenses"
      description="Recognition schedules for insurance, AMC, rent and subscriptions."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                <th className="py-1.5 pr-2 font-semibold">Name</th>
                <th className="py-1.5 pr-2 font-semibold">Category</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Original</th>
                <th className="py-1.5 pr-2 font-semibold">Period</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Recognized</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Remaining</th>
                <th className="py-1.5 pr-2 text-right font-semibold">Current Period</th>
                <th className="py-1.5 pr-2 font-semibold">Status</th>
                <th className="py-1.5 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-erp-border/60">
                  <td className="py-1.5 pr-2 font-medium text-erp-text">{r.name}</td>
                  <td className="py-1.5 pr-2 text-erp-muted">{r.category}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.originalAmount)}</td>
                  <td className="py-1.5 pr-2 text-erp-muted">
                    {formatDate(r.startDate)} – {formatDate(r.endDate)} ({r.numberOfPeriods})
                  </td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.amountRecognized)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.remainingBalance)}</td>
                  <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(r.currentPeriodExpense)}</td>
                  <td className="py-1.5 pr-2">
                    <PeriodCloseStatusBadge
                      status={r.status === 'active' ? 'In Progress' : r.status === 'closed' ? 'Closed' : r.status}
                    />
                  </td>
                  <td className="py-1.5">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold"
                        onClick={() =>
                          notify.info(
                            `Posting preview: Dr ${r.expenseAccount} / Cr ${r.prepaidAccount} ${formatCurrency(r.currentPeriodExpense)} — demo only.`,
                          )
                        }
                      >
                        Generate Posting Preview
                      </button>
                      <button
                        type="button"
                        className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                        disabled={!perms.canManagePrepaid || r.status === 'suspended'}
                        onClick={() => void onStatus(r.id, 'suspended')}
                      >
                        Suspend
                      </button>
                      <button
                        type="button"
                        className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold disabled:opacity-50"
                        disabled={!perms.canManagePrepaid || r.status === 'active'}
                        onClick={() => void onStatus(r.id, 'active')}
                      >
                        Resume
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}

export function FxRevaluationPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [data, setData] = useState<Awaited<ReturnType<typeof getFxRevaluation>> | null>(null)
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
      setData(await getFxRevaluation())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load FX')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <PeriodCloseShell
      title="Foreign Exchange Revaluation"
      description="Unrealized gain/loss preview using configured demo closing rates."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
            {
              id: 'preview',
              label: 'Accounting Preview',
              disabled: !perms.canFxPreview,
              onClick: () =>
                notify.info(
                  'FX revaluation preview prepared in demo mode. No unrealized gain/loss was posted to the ledger.',
                ),
            },
          ]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {data ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-[12px]">
            <div className="rounded border border-erp-border p-2">
              <div className="text-[10px] font-bold uppercase text-erp-muted">Unrealized Gain</div>
              <div className="font-semibold tabular-nums text-emerald-800">{formatCurrency(data.totalGain)}</div>
            </div>
            <div className="rounded border border-erp-border p-2">
              <div className="text-[10px] font-bold uppercase text-erp-muted">Unrealized Loss</div>
              <div className="font-semibold tabular-nums text-rose-800">{formatCurrency(data.totalLoss)}</div>
            </div>
            <div className="rounded border border-erp-border p-2">
              <div className="text-[10px] font-bold uppercase text-erp-muted">Gain Account</div>
              <div className="font-medium text-erp-text">{data.exchangeGainAccount}</div>
            </div>
            <div className="rounded border border-erp-border p-2">
              <div className="text-[10px] font-bold uppercase text-erp-muted">Reversal Period</div>
              <div className="font-medium text-erp-text">{data.reversalPeriod}</div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Account / Party</th>
                  <th className="py-1.5 pr-2 font-semibold">Currency</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Foreign Amt</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Original Rate</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Closing Rate</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Book Value</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Revalued</th>
                  <th className="py-1.5 text-right font-semibold">Gain / Loss</th>
                </tr>
              </thead>
              <tbody>
                {data.lines.map((l) => (
                  <tr key={l.id} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">{l.accountOrParty}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{l.currency}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{l.foreignAmount.toLocaleString('en-IN')}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{l.originalRate.toFixed(2)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{l.closingRate.toFixed(2)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(l.bookValueInr)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{formatCurrency(l.revaluedValueInr)}</td>
                    <td className="py-1.5 text-right tabular-nums font-semibold">{formatCurrency(l.gainLoss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}

export function TrialBalanceReviewPage() {
  const perms = usePeriodClosePermissions()
  const [filter, setFilter] = useState<PeriodFilterState>(() => loadPeriodCloseFilter())
  const [rows, setRows] = useState<TrialBalanceLine[]>([])
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
      setRows(await getTrialBalanceReview())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load trial balance')
    } finally {
      setLoading(false)
    }
  }, [perms.canView])

  useEffect(() => {
    void load()
  }, [load])

  const totalDebit = rows.reduce((s, r) => s + r.debit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.credit, 0)
  const exceptions = rows.filter((r) => r.exception)

  return (
    <PeriodCloseShell
      title="Trial Balance Review"
      description="Read-only trial balance preview with close-gate exceptions."
      periodFilter={filter}
      onPeriodChange={setFilter}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <p className="text-[13px] text-rose-700">{error}</p> : null}
      {!loading && !error ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-3 text-[12px]">
            <span>
              Total Debit: <strong className="tabular-nums">{formatCurrency(totalDebit)}</strong>
            </span>
            <span>
              Total Credit: <strong className="tabular-nums">{formatCurrency(totalCredit)}</strong>
            </span>
            <span>
              Difference:{' '}
              <strong className="tabular-nums">{formatCurrency(totalDebit - totalCredit)}</strong>
            </span>
            <PeriodCloseStatusBadge status={exceptions.length ? 'Blocked' : 'Ready for Review'} />
          </div>
          {exceptions.length ? (
            <ul className="rounded border border-rose-200 bg-rose-50 p-2 text-[12px] text-rose-900">
              {exceptions.map((e) => (
                <li key={e.accountCode}>
                  {e.accountCode} {e.accountName}: {e.exception}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-[10px] uppercase text-erp-muted">
                  <th className="py-1.5 pr-2 font-semibold">Code</th>
                  <th className="py-1.5 pr-2 font-semibold">Account</th>
                  <th className="py-1.5 pr-2 text-right font-semibold">Debit</th>
                  <th className="py-1.5 text-right font-semibold">Credit</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.accountCode} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium text-erp-text">{r.accountCode}</td>
                    <td className="py-1.5 pr-2 text-erp-text">
                      {r.accountName}
                      {r.exception ? (
                        <span className="ml-2 text-[11px] text-rose-700">{r.exception}</span>
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">
                      {r.debit ? formatCurrency(r.debit) : '—'}
                    </td>
                    <td className="py-1.5 text-right tabular-nums">
                      {r.credit ? formatCurrency(r.credit) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </PeriodCloseShell>
  )
}
