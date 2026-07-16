import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Ban, Check, Eye, Pencil, Plus, RefreshCw, RotateCcw, Send, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import {
  BankCashConfirmModal,
  BankCashDemoBanner,
  BankCashEmptyState,
  BankCashSummaryCards,
  BankCashWorkspaceTabs,
  FundTransferStatusBadge,
} from '@/components/accounting/bankCash'
import {
  approveFundTransfer,
  completeFundTransferDemo,
  getFundTransfers,
  rejectFundTransfer,
  reverseFundTransferDemo,
  submitFundTransfer,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { FundTransfer, FundTransferStatus } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { cn } from '@/utils/cn'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'
type StatusTab = 'all' | FundTransferStatus

const TABS: { id: StatusTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'Draft', label: 'Draft' },
  { id: 'Pending Approval', label: 'Pending Approval' },
  { id: 'Approved', label: 'Approved' },
  { id: 'In Process', label: 'In Process' },
  { id: 'Completed', label: 'Completed' },
  { id: 'Rejected', label: 'Rejected' },
  { id: 'Reversed', label: 'Reversed' },
  { id: 'Cancelled', label: 'Cancelled' },
]

export function FundTransfersPage() {
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [tab, setTab] = useState<StatusTab>('all')
  const [search, setSearch] = useState('')
  const [allRows, setAllRows] = useState<FundTransfer[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  const [busy, setBusy] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<FundTransfer | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const list = await getFundTransfers({ search })
        if (signal?.cancelled) return
        setAllRows(list)
        setLoadState('ready')
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Fund transfers could not be loaded.')
        setLoadState('error')
      }
    },
    [search],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const rows = useMemo(() => (tab === 'all' ? allRows : allRows.filter((r) => r.status === tab)), [allRows, tab])
  const tabCount = useCallback((id: StatusTab) => (id === 'all' ? allRows.length : allRows.filter((r) => r.status === id).length), [allRows])

  const effectiveLoadState = loadState === 'ready' && rows.length === 0 ? 'empty' : loadState

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    const pending = allRows.filter((r) => r.status === 'Pending Approval')
    const completed = allRows.filter((r) => r.status === 'Completed')
    return [
      { id: 'total', label: 'Total Transfers', value: allRows.length, accent: 'blue' },
      { id: 'pending', label: 'Pending Approval', value: pending.length, helper: formatCompactCurrency(pending.reduce((s, r) => s + r.amount, 0)), accent: 'amber' },
      { id: 'completed', label: 'Completed Value', value: formatCompactCurrency(completed.reduce((s, r) => s + r.amount, 0)), accent: 'green' },
      { id: 'rejected', label: 'Rejected', value: allRows.filter((r) => r.status === 'Rejected').length, accent: 'red' },
    ]
  }, [allRows])

  const doAction = async (action: () => Promise<FundTransfer>, successMessage: string) => {
    setBusy(true)
    try {
      await action()
      notify.success(successMessage)
      setRefreshToken((n) => n + 1)
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmReject = async () => {
    if (!rejectTarget || !rejectReason.trim()) return
    setBusy(true)
    try {
      await rejectFundTransfer(rejectTarget.id, rejectReason.trim())
      notify.success(`${rejectTarget.transferNumber} rejected`)
      setRejectTarget(null)
      setRejectReason('')
      setRefreshToken((n) => n + 1)
    } catch (err) {
      notify.error(err instanceof BankCashServiceError ? err.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canView || !perms.canViewFundTransfer) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Fund Transfers"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash', to: '/accounting/bank-cash' }, { label: 'Fund Transfers' }]}
        autoBreadcrumbs={false}
      >
        <BankCashEmptyState title="Access denied" description="You cannot view fund transfers." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Fund Transfers"
      description="Internal transfers between bank and cash accounts — approval workflow simulated in demo mode."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash', to: '/accounting/bank-cash' }, { label: 'Fund Transfers' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/transfers"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canCreateFundTransfer
              ? { id: 'new', label: 'New Fund Transfer', icon: Plus, variant: 'primary', onClick: () => navigate('/accounting/bank-cash/transfers/new') }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="fund_transfers" />
      <div className="mt-4">
        <BankCashDemoBanner message="Fund transfers are simulated with frontend demo data. No live payment rail is contacted." />
      </div>

      <div className="mb-3">
        <BankCashSummaryCards items={kpiItems} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Transfer no, account, reference…" className="w-full max-w-xs" size="sm" />
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" aria-label="Transfer status tabs">
        {TABS.map((t) => {
          const selected = tab === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium ring-1 ring-inset',
                selected ? 'bg-sky-50 text-sky-900 ring-sky-300' : 'bg-white text-erp-muted ring-erp-border hover:bg-erp-surface-alt',
              )}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              <span className="tabular-nums text-[11px] opacity-80">{tabCount(t.id)}</span>
            </button>
          )
        })}
      </div>

      {effectiveLoadState === 'loading' ? <LoadingState variant="table" rows={10} /> : null}

      {effectiveLoadState === 'error' ? (
        <BankCashEmptyState
          title="Fund transfers could not be loaded."
          description={errorMessage ?? undefined}
          actions={<button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>Retry</button>}
        />
      ) : null}

      {effectiveLoadState === 'empty' ? (
        <BankCashEmptyState
          title="No fund transfers match the selected filters."
          description="Create a new fund transfer to move funds between accounts."
          actions={
            perms.canCreateFundTransfer ? (
              <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => navigate('/accounting/bank-cash/transfers/new')}>
                New Fund Transfer
              </button>
            ) : undefined
          }
        />
      ) : null}

      {effectiveLoadState === 'ready' ? (
        <EnterpriseRegisterTableShell className="border-0 shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-[12px]">
              <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Transfer No</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">From</th>
                  <th className="px-3 py-2">To</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 w-40">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2"><TableLink to={`/accounting/bank-cash/transfers/${t.id}`}>{t.transferNumber}</TableLink></td>
                    <td className="px-3 py-2">{formatDate(t.transferDate)}</td>
                    <td className="px-3 py-2">{t.fromAccountName}</td>
                    <td className="px-3 py-2">{t.toAccountName}</td>
                    <td className="px-3 py-2">{t.transferMode}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(t.amount)}</td>
                    <td className="px-3 py-2"><FundTransferStatusBadge status={t.status} /></td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button type="button" className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" title="View" onClick={() => navigate(`/accounting/bank-cash/transfers/${t.id}`)}>
                          <Eye className="h-4 w-4" />
                        </button>
                        {perms.canEditFundTransfer && t.status === 'Draft' ? (
                          <button type="button" className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" title="Edit" onClick={() => navigate(`/accounting/bank-cash/transfers/${t.id}?edit=1`)}>
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canSubmitFundTransfer && t.status === 'Draft' ? (
                          <button type="button" className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" title="Submit" disabled={busy} onClick={() => void doAction(() => submitFundTransfer(t.id), `${t.transferNumber} submitted for approval`)}>
                            <Send className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canApproveFundTransfer && t.status === 'Pending Approval' ? (
                          <>
                            <button type="button" className="rounded p-1 text-emerald-700 hover:bg-erp-surface-alt" title="Approve" disabled={busy} onClick={() => void doAction(() => approveFundTransfer(t.id), `${t.transferNumber} approved`)}>
                              <Check className="h-4 w-4" />
                            </button>
                            <button type="button" className="rounded p-1 text-rose-700 hover:bg-erp-surface-alt" title="Reject" onClick={() => setRejectTarget(t)}>
                              <XCircle className="h-4 w-4" />
                            </button>
                          </>
                        ) : null}
                        {perms.canCompleteFundTransfer && (t.status === 'Approved' || t.status === 'In Process') ? (
                          <button type="button" className="rounded p-1 text-emerald-700 hover:bg-erp-surface-alt" title="Complete" disabled={busy} onClick={() => void doAction(() => completeFundTransferDemo(t.id), `${t.transferNumber} completed (demo — not posted to a live bank feed)`)}>
                            <Check className="h-4 w-4" />
                          </button>
                        ) : null}
                        {perms.canReverseFundTransfer && t.status === 'Completed' ? (
                          <button type="button" className="rounded p-1 text-erp-muted hover:bg-erp-surface-alt" title="Reverse" disabled={busy} onClick={() => void doAction(() => reverseFundTransferDemo(t.id), `${t.transferNumber} reversed`)}>
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        ) : null}
                        {t.status === 'Rejected' ? <Ban className="h-4 w-4 text-rose-400" aria-label="Rejected" /> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-erp-border px-3 py-2 text-[12px] text-erp-muted">
            <span>{rows.length} fund transfer(s)</span>
          </div>
        </EnterpriseRegisterTableShell>
      ) : null}

      <BankCashConfirmModal
        open={Boolean(rejectTarget)}
        onClose={() => {
          setRejectTarget(null)
          setRejectReason('')
        }}
        title="Reject fund transfer"
        description={`Reject ${rejectTarget?.transferNumber}? This cannot be undone.`}
        confirmLabel={busy ? 'Rejecting…' : 'Confirm reject'}
        onConfirm={() => void confirmReject()}
      >
        <textarea
          className="erp-input mt-3 w-full text-[13px]"
          rows={3}
          placeholder="Rejection reason (required)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </BankCashConfirmModal>
    </OperationalPageShell>
  )
}
