import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RefreshCw, ScrollText, ShieldOff, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { TableLink } from '@/components/ui/AppLink'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { BankAccountStatusBadge, BankCashDemoBanner, BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { getCashAccounts } from '@/services/accounting/bankCashService'
import type { CashAccount } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export function CashAccountsPage() {
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [rows, setRows] = useState<CashAccount[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getCashAccounts({ search })
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load cash accounts')
      setLoadState('error')
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const totalBook = rows.reduce((s, c) => s + c.bookBalance, 0)
    const totalVariance = rows.reduce((s, c) => s + Math.abs(c.variance), 0)
    return [
      { id: 'count', label: 'Cash accounts', value: rows.length, accent: 'blue' },
      { id: 'balance', label: 'Total book balance', value: formatCompactCurrency(totalBook), accent: 'green' },
      { id: 'variance', label: 'Total variance', value: formatCompactCurrency(totalVariance), accent: totalVariance > 0 ? 'amber' : 'slate' },
    ]
  }, [rows])

  if (!perms.canViewCashAccount) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Cash Accounts"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Accounts' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing cash account view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Cash Accounts"
      description="Petty cash, imprest and branch cash accounts — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Accounts' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/cash-accounts"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            {
              id: 'cash-count',
              label: 'Record Cash Count',
              icon: Wallet,
              hidden: !perms.canManageCashCount,
              onClick: () => navigate('/accounting/bank-cash/cash-counts/new'),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="cash_accounts" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search cash account, location…" />
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (
          <div className="p-6">
            <LoadingState variant="table" rows={6} />
          </div>
        ) : null}
        {loadState === 'error' ? (
          <div className="p-6">
            <EmptyState icon={ScrollText} title="Could not load cash accounts" description={errorMsg} />
          </div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState icon={Wallet} title="No cash accounts found" description="Adjust your search to see other accounts." />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[980px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Account</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Location</th>
                  <th className="px-3 py-2 font-semibold">Custodian</th>
                  <th className="px-3 py-2 text-right font-semibold">Book Balance</th>
                  <th className="px-3 py-2 text-right font-semibold">Variance</th>
                  <th className="px-3 py-2 font-semibold">Last Count</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-mono">{c.code}</td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/bank-cash/cash-accounts/${c.id}`}>{c.name}</TableLink>
                    </td>
                    <td className="px-3 py-2">{c.cashAccountType}</td>
                    <td className="px-3 py-2">{c.location}</td>
                    <td className="px-3 py-2">{c.custodian}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.bookBalance)}</td>
                    <td className={cn('px-3 py-2 text-right tabular-nums', c.variance !== 0 && 'text-amber-700')}>
                      {formatCurrency(c.variance)}
                    </td>
                    <td className="px-3 py-2 tabular-nums">{c.lastCountDate ? formatDate(c.lastCountDate) : '—'}</td>
                    <td className="px-3 py-2">
                      <BankAccountStatusBadge status={c.status} />
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
