import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RefreshCw, Wand2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { BankCashDemoBanner, BankCashEmptyState, BankCashSummaryCards, BankCashWorkspaceTabs, ReconciliationFlowStrip, ReconciliationStatusBadge } from '@/components/accounting/bankCash'
import { getBankCashLookups, getReconciliations } from '@/services/accounting/bankCashService'
import type { BankCashFilter, BankCashLookups, Reconciliation } from '@/types/bankCash'
import { DEFAULT_BANK_CASH_FILTER } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export function BankReconciliationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useBankCashPermissions()
  const [filter, setFilter] = useState<Partial<BankCashFilter>>({ ...DEFAULT_BANK_CASH_FILTER, bankAccountId: searchParams.get('bankAccountId') ?? '' })
  const [rows, setRows] = useState<Reconciliation[]>([])
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const [list, looks] = await Promise.all([getReconciliations(filter), lookups ? Promise.resolve(lookups) : getBankCashLookups()])
        if (signal?.cancelled) return
        setRows(list)
        setLookups(looks)
        setLoadState(list.length === 0 ? 'empty' : 'ready')
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Reconciliations could not be loaded.')
        setLoadState('error')
      }
    },
    [filter, lookups],
  )

  useEffect(() => {
    const signal = { cancelled: false }
    void load(signal)
    return () => {
      signal.cancelled = true
    }
  }, [load, refreshToken])

  const kpiItems: EnterpriseKpiItem[] = useMemo(() => {
    const open = rows.filter((r) => r.status === 'Draft' || r.status === 'In Progress')
    const completed = rows.filter((r) => r.status === 'Completed')
    const withDiff = rows.filter((r) => r.finalDifference !== 0)
    return [
      { id: 'total', label: 'Total Reconciliations', value: rows.length, accent: 'blue' },
      { id: 'open', label: 'Open', value: open.length, accent: 'amber' },
      { id: 'completed', label: 'Completed', value: completed.length, accent: 'green' },
      { id: 'diff', label: 'With Difference', value: withDiff.length, accent: withDiff.length > 0 ? 'red' : 'slate' },
    ]
  }, [rows])

  if (!perms.canView || !perms.canViewReconciliation) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank Reconciliation"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash', to: '/accounting/bank-cash' }, { label: 'Bank Reconciliation' }]}
        autoBreadcrumbs={false}
      >
        <BankCashEmptyState title="Access denied" description="You cannot view bank reconciliations." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank Reconciliation"
      description="Statement-to-book matching sessions by bank account — demo matching engine only."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash', to: '/accounting/bank-cash' }, { label: 'Bank Reconciliation' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/reconciliation"
      showDescription
      commandBar={<ErpCommandBar inline sticky={false} secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]} />}
    >
      <BankCashWorkspaceTabs active="reconciliation" />
      <div className="mt-4 space-y-3">
        <BankCashDemoBanner message="Reconciliation matching runs against frontend demo data. No live bank feed is contacted." />
        <ReconciliationFlowStrip active="manual" completedThrough="import" />
        <p className="text-[12px] text-erp-muted">
          Recommended flow: Account setup → receipts/transfers → statement import → validation → auto-match → manual reconciliation → difference review → approval → completion.
          Open a session to use the workbench (primary screen).
        </p>
      </div>

      <div className="mb-3 mt-3">
        <BankCashSummaryCards items={kpiItems} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <Select
          className="h-9 min-w-[10rem] text-[12px]"
          value={filter.bankAccountId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, bankAccountId: e.target.value }))}
        >
          <option value="">All bank accounts</option>
          {(lookups?.bankAccounts ?? []).map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </Select>
        <Select
          className="h-9 min-w-[10rem] text-[12px]"
          value={filter.reconciliationStatus ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, reconciliationStatus: e.target.value as BankCashFilter['reconciliationStatus'] }))}
        >
          <option value="">All statuses</option>
          <option value="Not Started">Not Started</option>
          <option value="Draft">Draft</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
          <option value="Reopened">Reopened</option>
        </Select>
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={8} /> : null}

      {loadState === 'error' ? (
        <BankCashEmptyState
          title="Reconciliations could not be loaded."
          description={errorMessage ?? undefined}
          actions={<button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>Retry</button>}
        />
      ) : null}

      {loadState === 'empty' ? (
        <BankCashEmptyState title="No reconciliations match the selected filters." description="Reconciliations are created from bank account or statement pages." />
      ) : null}

      {loadState === 'ready' ? (
        <EnterpriseRegisterTableShell className="border-0 shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[62rem] text-[12px]">
              <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Reconciliation No</th>
                  <th className="px-3 py-2">Bank Account</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2 text-right">Matched</th>
                  <th className="px-3 py-2 text-right">Difference</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 w-24" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2"><TableLink to={`/accounting/bank-cash/reconciliation/${r.id}`}>{r.reconciliationNumber}</TableLink></td>
                    <td className="px-3 py-2">{r.bankAccountName}</td>
                    <td className="px-3 py-2">{formatDate(r.periodFrom)} – {formatDate(r.periodTo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.matchedAmount)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.finalDifference !== 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatCurrency(r.finalDifference)}</td>
                    <td className="px-3 py-2"><ReconciliationStatusBadge status={r.status} /></td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="erp-btn erp-btn-secondary h-7 px-2 text-[11px]"
                        onClick={() => navigate(`/accounting/bank-cash/reconciliation/${r.id}`)}
                      >
                        <Wand2 className="mr-1 inline h-3 w-3" />
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-erp-border px-3 py-2 text-[12px] text-erp-muted">
            <span>{rows.length} reconciliation(s)</span>
          </div>
        </EnterpriseRegisterTableShell>
      ) : null}
    </OperationalPageShell>
  )
}
