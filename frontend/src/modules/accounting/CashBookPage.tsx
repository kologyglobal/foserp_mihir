import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Select } from '@/components/forms/Inputs'
import { BankCashDemoBanner, BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import { getBankCashLookups, getCashBook } from '@/services/accounting/bankCashService'
import type { BankCashLookups, CashBookEntry } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

export function CashBookPage() {
  const perms = useBankCashPermissions()
  const [searchParams, setSearchParams] = useSearchParams()
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [cashAccountId, setCashAccountId] = useState(searchParams.get('cashAccountId') ?? '')
  const [entries, setEntries] = useState<CashBookEntry[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    void getBankCashLookups().then((l) => {
      setLookups(l)
      setCashAccountId((current) => current || l.cashAccounts[0]?.id || '')
    })
  }, [])

  const load = useCallback(async () => {
    if (!cashAccountId) {
      setLoadState('empty')
      return
    }
    setLoadState('loading')
    try {
      const list = await getCashBook(cashAccountId)
      setEntries(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load cash book')
      setLoadState('error')
    }
  }, [cashAccountId])

  useEffect(() => {
    void load()
  }, [load])

  const changeAccount = (id: string) => {
    setCashAccountId(id)
    setSearchParams(id ? { cashAccountId: id } : {})
  }

  if (!perms.canViewCashBook) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Cash Book"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Book' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing cash book view permission." />
      </OperationalPageShell>
    )
  }

  const accountLabel = lookups?.cashAccounts.find((c) => c.id === cashAccountId)?.label ?? ''

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Cash Book"
      description="Chronological cash receipts and payments with running balance — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Book' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/cash-book"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="cash_book" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3 max-w-xs">
        <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cash account</label>
        <Select value={cashAccountId} onChange={(e) => changeAccount(e.target.value)}>
          <option value="">Select cash account</option>
          {lookups?.cashAccounts.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
        </Select>
      </div>

      {loadState === 'loading' ? <LoadingState variant="table" rows={8} /> : null}
      {loadState === 'error' ? <EmptyState icon={ScrollText} title="Could not load cash book" description={errorMsg} /> : null}
      {loadState === 'empty' ? (
        <EmptyState icon={BookOpen} title="No cash book entries" description={cashAccountId ? `No entries found for ${accountLabel}.` : 'Select a cash account to view its cash book.'} />
      ) : null}
      {loadState === 'ready' ? (
        <div className="overflow-x-auto rounded-lg border border-erp-border bg-white">
          <table className="w-full min-w-[900px] text-left text-[13px]">
            <thead>
              <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                <th className="px-3 py-2 font-semibold">Date</th>
                <th className="px-3 py-2 font-semibold">Voucher</th>
                <th className="px-3 py-2 font-semibold">Type</th>
                <th className="px-3 py-2 font-semibold">Narration</th>
                <th className="px-3 py-2 font-semibold">Received From / Paid To</th>
                <th className="px-3 py-2 text-right font-semibold">Debit</th>
                <th className="px-3 py-2 text-right font-semibold">Credit</th>
                <th className="px-3 py-2 text-right font-semibold">Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-erp-border/80">
                  <td className="px-3 py-2 tabular-nums">{formatDate(e.entryDate)}</td>
                  <td className="px-3 py-2 font-mono">{e.voucherNumber ?? '—'}</td>
                  <td className="px-3 py-2">{e.transactionType}</td>
                  <td className="px-3 py-2">{e.narration}</td>
                  <td className="px-3 py-2">{e.receivedFrom ?? e.paidTo ?? '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.debitAmount > 0 ? formatCurrency(e.debitAmount) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{e.creditAmount > 0 ? formatCurrency(e.creditAmount) : '—'}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(e.runningBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </OperationalPageShell>
  )
}
