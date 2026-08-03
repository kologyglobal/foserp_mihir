import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Input, Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import * as treasuryApi from '@/services/api/treasuryApi'
import { useTreasuryAccountOptions } from '../transfers/hooks/useTreasuryAccountOptions'
import type {
  TreasuryTransactionDto,
  TreasuryTransactionReconciliationStatus,
} from './treasury-transaction.types'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from '../../bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

function firstOfMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

export function ApiTreasuryTransactionsPage() {
  const perms = useBankCashPermissions()
  const legalEntityId = useMemo(() => {
    try {
      return resolveLegalEntityId()
    } catch {
      return ''
    }
  }, [])
  const { accounts } = useTreasuryAccountOptions(legalEntityId || undefined)
  const [rows, setRows] = useState<TreasuryTransactionDto[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [accountType, setAccountType] = useState('')
  const [treasuryAccountId, setTreasuryAccountId] = useState('')
  const [dateFrom, setDateFrom] = useState(firstOfMonth())
  const [dateTo, setDateTo] = useState(today())
  const [reconciliationStatus, setReconciliationStatus] = useState('')
  const limit = 50

  const filteredAccounts = useMemo(
    () => accounts.filter((account) => !accountType || account.accountType === accountType),
    [accounts, accountType],
  )

  const load = useCallback(async () => {
    if (!legalEntityId) {
      setError('Select a legal entity before opening the transaction register.')
      setLoadState('error')
      return
    }
    setLoadState('loading')
    setError('')
    try {
      const result = await treasuryApi.listTreasuryTransactions({
        legalEntityId,
        treasuryAccountId: treasuryAccountId || undefined,
        accountType: accountType ? (accountType as 'BANK' | 'CASH') : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        reconciliationStatus: reconciliationStatus
          ? (reconciliationStatus as TreasuryTransactionReconciliationStatus)
          : undefined,
        search: search.trim() || undefined,
        page,
        limit,
      })
      setRows(result.items)
      setTotal(result.total)
      setLoadState(result.items.length ? 'ready' : 'empty')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load treasury transactions.')
      setLoadState('error')
    }
  }, [
    accountType,
    dateFrom,
    dateTo,
    legalEntityId,
    page,
    reconciliationStatus,
    search,
    treasuryAccountId,
  ])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    setPage(1)
  }, [accountType, dateFrom, dateTo, reconciliationStatus, search, treasuryAccountId])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const unreconciled = rows.filter((row) => row.reconciliationStatus === 'UNRECONCILED').length
    return [
      { id: 'count', label: 'Matching entries', value: total, accent: 'blue' },
      { id: 'bank', label: 'Bank entries on page', value: rows.filter((row) => row.treasuryAccountType === 'BANK').length, accent: 'blue' },
      { id: 'cash', label: 'Cash entries on page', value: rows.filter((row) => row.treasuryAccountType === 'CASH').length, accent: 'green' },
      { id: 'unreconciled', label: 'Page unreconciled', value: unreconciled, accent: unreconciled ? 'amber' : 'slate' },
    ]
  }, [rows, total])

  const exportCsv = () => {
    if (!rows.length) return
    const header = ['Date', 'Voucher', 'Account', 'Kind', 'Party', 'Reference', 'Debit', 'Credit', 'Currency', 'Reconciliation']
    const content = [
      header,
      ...rows.map((row) => [
        row.postingDate,
        row.voucherNumber,
        `${row.treasuryAccountCode} - ${row.treasuryAccountName}`,
        row.treasuryAccountType,
        row.partyName,
        row.reference,
        row.debitAmount,
        row.creditAmount,
        row.currencyCode,
        row.reconciliationStatus,
      ]),
    ]
      .map((line) => line.map(csvCell).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `treasury-transactions-${dateFrom || 'all'}-${dateTo || 'all'}-page-${page}.csv`
    link.click()
    URL.revokeObjectURL(url)
    notify.success(`Exported ${rows.length} transaction rows.`)
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
      description="Live unified register of posted GL movements mapped to treasury bank and cash accounts."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Transactions' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/transactions"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[
            { id: 'export', label: 'Export Page', icon: Download, disabled: !rows.length || !perms.canExport, onClick: exportCsv },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      }
    >
      <BankCashWorkspaceTabs active="transactions" />

      <div className="mb-3 mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-7">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Voucher, party, reference or narration…"
          className="xl:col-span-2"
        />
        <Select value={accountType} onChange={(e) => { setAccountType(e.target.value); setTreasuryAccountId('') }}>
          <option value="">All accounts</option>
          <option value="BANK">Bank only</option>
          <option value="CASH">Cash only</option>
        </Select>
        <Select value={treasuryAccountId} onChange={(e) => setTreasuryAccountId(e.target.value)}>
          <option value="">All treasury accounts</option>
          {filteredAccounts
            .filter((account) => account.accountType === 'BANK' || account.accountType === 'CASH')
            .map((account) => <option key={account.id} value={account.id}>{account.code} — {account.name}</option>)}
        </Select>
        <Input type="date" aria-label="From date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <Input type="date" aria-label="To date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <Select value={reconciliationStatus} onChange={(e) => setReconciliationStatus(e.target.value)}>
          <option value="">All reconciliation</option>
          <option value="UNRECONCILED">Unreconciled</option>
          <option value="PARTIALLY_RECONCILED">Partially reconciled</option>
          <option value="FULLY_RECONCILED">Fully reconciled</option>
        </Select>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={8} /></div> : null}
        {loadState === 'error' ? (
          <div className="p-6"><EmptyState icon={ScrollText} title="Could not load transactions" description={error} /></div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6"><EmptyState icon={ScrollText} title="No posted transactions match" description="Adjust the account, date, or reconciliation filters." /></div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1150px] text-left text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Voucher</th>
                  <th className="px-3 py-2">Treasury Account</th>
                  <th className="px-3 py-2">Kind</th>
                  <th className="px-3 py-2">Party / Narration</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2 text-right">Debit</th>
                  <th className="px-3 py-2 text-right">Credit</th>
                  <th className="px-3 py-2">Reconciliation</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 tabular-nums">{formatDate(row.postingDate)}</td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/ledger-entries/voucher/${row.voucherId}`}>{row.voucherNumber}</TableLink>
                      {row.isReversal ? <p className="text-[11px] text-amber-700">Reversal</p> : null}
                    </td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/bank-cash/${row.treasuryAccountType === 'BANK' ? 'bank' : 'cash'}-accounts/${row.treasuryAccountId}`}>
                        {row.treasuryAccountCode} — {row.treasuryAccountName}
                      </TableLink>
                    </td>
                    <td className="px-3 py-2">{row.treasuryAccountType}</td>
                    <td className="px-3 py-2">
                      {row.partyName || '—'}
                      <p className="max-w-[260px] truncate text-[11px] text-erp-muted">{row.narration || row.sourceDocumentType || '—'}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">{row.reference || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(row.debitAmount) ? `${formatCurrency(Number(row.debitAmount))} ${row.currencyCode}` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{Number(row.creditAmount) ? `${formatCurrency(Number(row.creditAmount))} ${row.currencyCode}` : '—'}</td>
                    <td className="px-3 py-2">
                      {row.reconciliationStatus ? row.reconciliationStatus.replaceAll('_', ' ') : row.treasuryAccountType === 'CASH' ? 'Not applicable' : 'Not positioned'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      {total > limit ? (
        <div className="mt-3 flex items-center justify-end gap-3 text-[12px]">
          <span className="text-erp-muted">Page {page} of {Math.ceil(total / limit)}</span>
          <button type="button" className="erp-btn erp-btn-ghost h-8 px-3" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
          <button type="button" className="erp-btn erp-btn-ghost h-8 px-3" disabled={page >= Math.ceil(total / limit)} onClick={() => setPage((value) => value + 1)}>Next</button>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
