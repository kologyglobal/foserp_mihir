import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, ClipboardCheck, Plus, RefreshCw, ScrollText, ShieldOff, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { BankCashDemoBanner, BankCashWorkspaceTabs, CashCountStatusBadge, CashVarianceStatusBadge } from '@/components/accounting/bankCash'
import { approveCashVarianceDemo, getCashCounts, postCashAdjustmentDemo, submitCashCount, BankCashServiceError } from '@/services/accounting/bankCashService'
import type { CashCount, CashCountStatus } from '@/types/bankCash'
import { CASH_COUNT_STATUSES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export function CashCountsPage() {
  const perms = useBankCashPermissions()
  const navigate = useNavigate()
  const [rows, setRows] = useState<CashCount[]>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<CashCountStatus | ''>('')
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getCashCounts({ search, cashCountStatus: status })
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load cash counts')
      setLoadState('error')
    }
  }, [search, status])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = [
    { id: 'count', label: 'Cash counts', value: rows.length, accent: 'blue' },
    { id: 'pending', label: 'Pending review', value: rows.filter((r) => r.status === 'Submitted').length, accent: 'amber' },
    { id: 'variance', label: 'With variance', value: rows.filter((r) => r.varianceStatus !== 'Matched').length, accent: rows.some((r) => r.varianceStatus !== 'Matched') ? 'red' : 'slate' },
  ]

  const approve = async (row: CashCount) => {
    setBusyId(row.id)
    try {
      await approveCashVarianceDemo(row.id)
      notify.success(`${row.countNumber} approved (demo)`)
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Approval failed')
    } finally {
      setBusyId(null)
    }
  }

  const postAdjustment = async (row: CashCount) => {
    setBusyId(row.id)
    try {
      await postCashAdjustmentDemo(row.id)
      notify.success(`Adjustment for ${row.countNumber} posted (demo — no GL posting)`)
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Post adjustment failed')
    } finally {
      setBusyId(null)
    }
  }

  const submit = async (row: CashCount) => {
    setBusyId(row.id)
    try {
      await submitCashCount(row.id)
      notify.success(`${row.countNumber} submitted for review`)
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Submit failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!perms.canViewCashCount) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Cash Counts"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Counts' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing cash count view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Cash Counts"
      description="Physical cash verification with denomination-wise counting and variance approval — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Counts' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/cash-counts"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canManageCashCount ? { id: 'new', label: 'New Cash Count', icon: Plus, onClick: () => navigate('/accounting/bank-cash/cash-counts/new') } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="cash_counts" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search count number, cash account…" className="min-w-[16rem] flex-1" />
        <Select wrapClassName="w-44" value={status} onChange={(e) => setStatus(e.target.value as CashCountStatus | '')}>
          <option value="">All statuses</option>
          {CASH_COUNT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </Select>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (<div className="p-6"><LoadingState variant="table" rows={6} /></div>) : null}
        {loadState === 'error' ? (<div className="p-6"><EmptyState icon={ScrollText} title="Could not load cash counts" description={errorMsg} /></div>) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState
              icon={Wallet}
              title="No cash counts found"
              action={perms.canManageCashCount ? (
                <Link to="/accounting/bank-cash/cash-counts/new" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">New Cash Count</Link>
              ) : null}
            />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Count No</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Cash Account</th>
                  <th className="px-3 py-2 text-right font-semibold">Book</th>
                  <th className="px-3 py-2 text-right font-semibold">Physical</th>
                  <th className="px-3 py-2 text-right font-semibold">Variance</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-mono">{c.countNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(c.countDate)}</td>
                    <td className="px-3 py-2">{c.cashAccountName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.bookBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.physicalTotal)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      <span className="inline-flex items-center gap-1.5">
                        {formatCurrency(c.varianceAmount)}
                        <CashVarianceStatusBadge status={c.varianceStatus} />
                      </span>
                    </td>
                    <td className="px-3 py-2"><CashCountStatusBadge status={c.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        {c.status === 'Draft' && perms.canManageCashCount ? (
                          <button type="button" className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold text-erp-muted hover:bg-erp-surface-alt disabled:opacity-50" disabled={busyId === c.id} onClick={() => void submit(c)}>
                            Submit
                          </button>
                        ) : null}
                        {c.status === 'Submitted' && perms.canApproveCashVariance ? (
                          <button type="button" className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50" disabled={busyId === c.id} onClick={() => void approve(c)}>
                            <CheckCircle2 className="mr-1 inline h-3 w-3" /> Approve
                          </button>
                        ) : null}
                        {c.status === 'Approved' && !c.adjustmentPosted && perms.canPostCashAdjustment ? (
                          <button type="button" className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50" disabled={busyId === c.id} onClick={() => void postAdjustment(c)}>
                            <ClipboardCheck className="mr-1 inline h-3 w-3" /> Post Adjustment
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
      </EnterpriseRegisterTableShell>
    </OperationalPageShell>
  )
}
