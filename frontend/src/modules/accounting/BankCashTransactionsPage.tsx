import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { BankCashDemoBanner, BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import {
  DEFAULT_BANK_CASH_FILTER,
  exportBankCashData,
  getBankCashLookups,
  getBankCashTransactions,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { BankCashFilter, BankCashLookups, BankCashTransaction } from '@/types/bankCash'
import { BANK_CASH_TRANSACTION_TYPES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export function BankCashTransactionsPage() {
  const perms = useBankCashPermissions()
  const [filter, setFilter] = useState<Partial<BankCashFilter>>({ ...DEFAULT_BANK_CASH_FILTER })
  const [rows, setRows] = useState<BankCashTransaction[]>([])
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    void getBankCashLookups().then(setLookups)
  }, [])

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getBankCashTransactions(filter)
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load transactions')
      setLoadState('error')
    }
  }, [filter])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const debit = rows.reduce((s, r) => s + r.debitAmount, 0)
    const credit = rows.reduce((s, r) => s + r.creditAmount, 0)
    const unreconciled = rows.filter((r) => !r.isReconciled).length
    return [
      { id: 'count', label: 'Transactions', value: rows.length, accent: 'blue' },
      { id: 'debit', label: 'Total debit', value: formatCompactCurrency(debit), accent: 'amber' },
      { id: 'credit', label: 'Total credit', value: formatCompactCurrency(credit), accent: 'green' },
      { id: 'unreconciled', label: 'Unreconciled', value: unreconciled, accent: unreconciled > 0 ? 'amber' : 'slate' },
    ]
  }, [rows])

  const handleExport = async () => {
    if (!perms.canExport) return notify.error('Missing export permission')
    try {
      const result = await exportBankCashData({ reportName: 'bank_cash_transactions', format: 'csv', filter, includeAudit: false })
      notify.success(`Exported ${result.rowCount} row(s) as ${result.fileName} (demo — no file written)`)
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Export failed')
    }
  }

  if (!perms.canViewTransactions) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank & Cash Transactions"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Transactions' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing transaction view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank & Cash Transactions"
      description="Unified register of bank and cash movements — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Transactions' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/transactions"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'export', label: 'Export', icon: Download, disabled: !perms.canExport, onClick: () => void handleExport() },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="transactions" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3 flex flex-wrap items-center gap-2">
        <SearchInput
          value={filter.search ?? ''}
          onChange={(v) => setFilter((f) => ({ ...f, search: v }))}
          placeholder="Search number, account, counterparty, reference…"
          className="min-w-[16rem] flex-1"
        />
        <Select wrapClassName="w-40" value={filter.accountKind ?? 'all'} onChange={(e) => setFilter((f) => ({ ...f, accountKind: e.target.value as BankCashFilter['accountKind'] }))}>
          <option value="all">All accounts</option>
          <option value="bank">Bank only</option>
          <option value="cash">Cash only</option>
        </Select>
        <Select wrapClassName="w-48" value={filter.transactionType ?? ''} onChange={(e) => setFilter((f) => ({ ...f, transactionType: e.target.value as BankCashFilter['transactionType'] }))}>
          <option value="">All types</option>
          {BANK_CASH_TRANSACTION_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
        </Select>
        <Select wrapClassName="w-44" value={filter.bankAccountId ?? ''} onChange={(e) => setFilter((f) => ({ ...f, bankAccountId: e.target.value, cashAccountId: '' }))}>
          <option value="">All bank accounts</option>
          {lookups?.bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
        </Select>
        <Select wrapClassName="w-44" value={filter.cashAccountId ?? ''} onChange={(e) => setFilter((f) => ({ ...f, cashAccountId: e.target.value, bankAccountId: '' }))}>
          <option value="">All cash accounts</option>
          {lookups?.cashAccounts.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </Select>
        <Select wrapClassName="w-36" value={filter.isReconciled ?? 'all'} onChange={(e) => setFilter((f) => ({ ...f, isReconciled: e.target.value as BankCashFilter['isReconciled'] }))}>
          <option value="all">Reconciled: All</option>
          <option value="yes">Reconciled</option>
          <option value="no">Unreconciled</option>
        </Select>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (
          <div className="p-6"><LoadingState variant="table" rows={8} /></div>
        ) : null}
        {loadState === 'error' ? (
          <div className="p-6"><EmptyState icon={ScrollText} title="Could not load transactions" description={errorMsg} /></div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6"><EmptyState icon={ScrollText} title="No transactions match" description="Adjust your filters and try again." /></div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1100px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Number</th>
                  <th className="px-3 py-2 font-semibold">Account</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Counterparty</th>
                  <th className="px-3 py-2 font-semibold">Reference</th>
                  <th className="px-3 py-2 text-right font-semibold">Debit</th>
                  <th className="px-3 py-2 text-right font-semibold">Credit</th>
                  <th className="px-3 py-2 font-semibold">Reconciled</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t) => (
                  <tr key={t.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 tabular-nums">{formatDate(t.transactionDate)}</td>
                    <td className="px-3 py-2 font-mono">{t.transactionNumber}</td>
                    <td className="px-3 py-2">{t.accountName}</td>
                    <td className="px-3 py-2">{t.transactionType}</td>
                    <td className="px-3 py-2">{t.counterpartyName ?? '—'}</td>
                    <td className="px-3 py-2 font-mono text-[12px]">{t.reference}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.debitAmount > 0 ? formatCurrency(t.debitAmount) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{t.creditAmount > 0 ? formatCurrency(t.creditAmount) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={t.isReconciled ? 'text-emerald-700' : 'text-amber-700'}>{t.isReconciled ? 'Yes' : 'No'}</span>
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
