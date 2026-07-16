import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileUp, RefreshCw } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import { BankCashDemoBanner, BankCashEmptyState, BankCashSummaryCards, BankCashWorkspaceTabs, BankStatementStatusBadge } from '@/components/accounting/bankCash'
import { getBankCashLookups, getBankStatements } from '@/services/accounting/bankCashService'
import type { BankCashFilter, BankCashLookups, BankStatement } from '@/types/bankCash'
import { DEFAULT_BANK_CASH_FILTER } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'

type LoadState = 'loading' | 'ready' | 'error' | 'empty'

export function BankStatementsPage() {
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [filter, setFilter] = useState<Partial<BankCashFilter>>({ ...DEFAULT_BANK_CASH_FILTER })
  const [rows, setRows] = useState<BankStatement[]>([])
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)

  const load = useCallback(
    async (signal?: { cancelled: boolean }) => {
      setLoadState('loading')
      setErrorMessage(null)
      try {
        const [list, looks] = await Promise.all([getBankStatements(filter), lookups ? Promise.resolve(lookups) : getBankCashLookups()])
        if (signal?.cancelled) return
        setRows(list)
        setLookups(looks)
        setLoadState(list.length === 0 ? 'empty' : 'ready')
      } catch (err) {
        if (signal?.cancelled) return
        setErrorMessage(err instanceof Error ? err.message : 'Bank statements could not be loaded.')
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
    const withErrors = rows.filter((r) => r.status === 'With Errors')
    const unmatched = rows.reduce((s, r) => s + r.unmatchedCount, 0)
    return [
      { id: 'total', label: 'Statements Imported', value: rows.length, accent: 'blue' },
      { id: 'errors', label: 'With Errors', value: withErrors.length, accent: withErrors.length > 0 ? 'red' : 'slate' },
      { id: 'unmatched', label: 'Unmatched Lines', value: unmatched, accent: 'amber' },
      { id: 'closing', label: 'Total Closing Balance', value: formatCompactCurrency(rows.reduce((s, r) => s + r.closingBalance, 0)), accent: 'green' },
    ]
  }, [rows])

  if (!perms.canView || !perms.canViewStatement) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank Statements"
        breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash', to: '/accounting/bank-cash' }, { label: 'Bank Statements' }]}
        autoBreadcrumbs={false}
      >
        <BankCashEmptyState title="Access denied" description="You cannot view bank statements." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank Statements"
      description="Imported bank statements with validation and matching status — demo data only."
      breadcrumbs={[{ label: 'Accounting', to: '/accounting' }, { label: 'Bank & Cash', to: '/accounting/bank-cash' }, { label: 'Bank Statements' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/statements"
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canImportStatement
              ? { id: 'import', label: 'Import Statement', icon: FileUp, variant: 'primary', onClick: () => navigate('/accounting/bank-cash/statements/import') }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => setRefreshToken((n) => n + 1) }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="statements" />
      <div className="mt-4">
        <BankCashDemoBanner message="Statement import is parsed and validated in the browser only. No live bank feed is contacted." />
      </div>

      <div className="mb-3">
        <BankCashSummaryCards items={kpiItems} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-erp-border bg-erp-surface/40 px-3 py-2">
        <SearchInput
          value={filter.search ?? ''}
          onChange={(search) => setFilter((f) => ({ ...f, search }))}
          placeholder="Statement number, file name…"
          className="w-full max-w-xs"
          size="sm"
        />
        <Select
          className="h-9 min-w-[9rem] text-[12px]"
          value={filter.bankAccountId ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, bankAccountId: e.target.value }))}
        >
          <option value="">Bank account</option>
          {(lookups?.bankAccounts ?? []).map((b) => (
            <option key={b.id} value={b.id}>{b.label}</option>
          ))}
        </Select>
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={8} /> : null}

      {loadState === 'error' ? (
        <BankCashEmptyState
          title="Bank statements could not be loaded."
          description={errorMessage ?? undefined}
          actions={<button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => setRefreshToken((n) => n + 1)}>Retry</button>}
        />
      ) : null}

      {loadState === 'empty' ? (
        <BankCashEmptyState
          title="No bank statements imported yet."
          description="Import a bank statement to begin reconciliation."
          actions={
            perms.canImportStatement ? (
              <button type="button" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]" onClick={() => navigate('/accounting/bank-cash/statements/import')}>
                Import Statement
              </button>
            ) : undefined
          }
        />
      ) : null}

      {loadState === 'ready' ? (
        <EnterpriseRegisterTableShell className="border-0 shadow-none">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[64rem] text-[12px]">
              <thead className="sticky top-0 z-10 bg-erp-surface-alt text-left text-[11px] font-semibold uppercase tracking-wide text-erp-muted">
                <tr>
                  <th className="px-3 py-2">Statement No</th>
                  <th className="px-3 py-2">Bank Account</th>
                  <th className="px-3 py-2">Period</th>
                  <th className="px-3 py-2 text-right">Closing Balance</th>
                  <th className="px-3 py-2 text-right">Lines</th>
                  <th className="px-3 py-2">Imported</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-t border-erp-border hover:bg-erp-surface-alt/50">
                    <td className="px-3 py-2"><TableLink to={`/accounting/bank-cash/statements/${s.id}`}>{s.statementNumber}</TableLink></td>
                    <td className="px-3 py-2">{s.bankAccountName}</td>
                    <td className="px-3 py-2">{formatDate(s.periodFrom)} – {formatDate(s.periodTo)}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(s.closingBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{s.lineCount} <span className="text-erp-muted">({s.matchedCount} matched)</span></td>
                    <td className="px-3 py-2">{formatDateTime(s.importedAt)}</td>
                    <td className="px-3 py-2"><BankStatementStatusBadge status={s.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-erp-border px-3 py-2 text-[12px] text-erp-muted">
            <span>{rows.length} statement(s)</span>
          </div>
        </EnterpriseRegisterTableShell>
      ) : null}
    </OperationalPageShell>
  )
}
