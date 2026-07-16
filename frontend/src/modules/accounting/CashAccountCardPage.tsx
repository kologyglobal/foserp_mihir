import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, BookOpen, RefreshCw, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { BankAccountStatusBadge, CashCountStatusBadge, CashVarianceStatusBadge } from '@/components/accounting/bankCash'
import { getCashAccountById, getCashBook, getCashCounts } from '@/services/accounting/bankCashService'
import type { CashAccount, CashBookEntry, CashCount } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { cn } from '@/utils/cn'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type CardTab = 'general' | 'cash_book' | 'counts'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'cash_book', label: 'Recent Cash Book' },
  { id: 'counts', label: 'Cash Count History' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function CashAccountCardPage() {
  const { cashAccountId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [account, setAccount] = useState<CashAccount | null>(null)
  const [entries, setEntries] = useState<CashBookEntry[]>([])
  const [counts, setCounts] = useState<CashCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CardTab>('general')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const acc = await getCashAccountById(cashAccountId)
      if (!acc) {
        setAccount(null)
        setError('Cash account not found')
        setLoading(false)
        return
      }
      setAccount(acc)
      const [book, cnts] = await Promise.all([
        getCashBook(cashAccountId),
        getCashCounts({ cashAccountId }),
      ])
      setEntries(book.slice(-15).reverse())
      setCounts(cnts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cash account')
    } finally {
      setLoading(false)
    }
  }, [cashAccountId])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbs = [...BANK_CASH_BREADCRUMB, { label: 'Cash Accounts', to: '/accounting/bank-cash/cash-accounts' }, { label: account?.code ?? 'Account' }]

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Cash Account" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!account || error) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={Wallet}
          title="Cash account not found"
          description={error ?? undefined}
          action={<Link to="/accounting/bank-cash/cash-accounts" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back to Cash Accounts</Link>}
        />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={`${account.code} — ${account.name}`}
      description="Cash account card — demo balances only."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/bank-cash/cash-accounts/${account.id}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageCashCount
              ? { id: 'count', label: 'Record Cash Count', icon: Wallet, onClick: () => navigate(`/accounting/bank-cash/cash-counts/new?cashAccountId=${account.id}`) }
              : undefined
          }
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/bank-cash/cash-accounts') },
            {
              id: 'cash-book',
              label: 'Open Cash Book',
              icon: BookOpen,
              hidden: !perms.canViewCashBook,
              onClick: () => navigate(`/accounting/bank-cash/cash-book?cashAccountId=${account.id}`),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
        />
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-erp-border bg-white px-4 py-3">
        <BankAccountStatusBadge status={account.status} />
        <span className="text-[12px] text-erp-muted">{account.cashAccountType} · {account.currency}</span>
        <span className="ml-auto flex items-center gap-3 text-[13px] font-semibold tabular-nums text-erp-text">
          {formatCurrency(account.bookBalance)}
          <span className={cn('text-[11px] font-normal', account.variance !== 0 ? 'text-amber-700' : 'text-erp-muted')}>
            variance {formatCurrency(account.variance)}
          </span>
        </span>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-erp-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              tab === t.id ? 'border border-b-white border-erp-border bg-white text-erp-primary' : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-b-lg border border-t-0 border-erp-border bg-white p-4">
        {tab === 'general' ? (
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Type" value={account.cashAccountType} />
            <Field label="Currency" value={account.currency} />
            <Field label="Book Balance" value={formatCurrency(account.bookBalance)} />
            <Field label="Physical Balance" value={formatCurrency(account.physicalBalance)} />
            <Field label="Variance" value={formatCurrency(account.variance)} />
            <Field label="Variance Tolerance" value={formatCurrency(account.varianceTolerance)} />
            <Field label="Cash Limit" value={account.cashLimit != null ? formatCurrency(account.cashLimit) : '—'} />
            <Field label="Imprest Limit" value={account.imprestLimit != null ? formatCurrency(account.imprestLimit) : '—'} />
            <Field label="Count Frequency" value={account.countFrequency} />
            <Field label="Last Count Date" value={account.lastCountDate ? formatDate(account.lastCountDate) : '—'} />
            <Field label="Custodian" value={account.custodian} />
            <Field label="Location" value={account.location} />
            <Field label="Plant" value={account.plant ?? '—'} />
            <Field label="Department" value={account.department ?? '—'} />
            <Field label="Purpose" value={account.purpose} />
          </dl>
        ) : null}

        {tab === 'cash_book' ? (
          entries.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No cash book entries yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead className="bg-erp-surface text-left text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Narration</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2 text-right">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t border-erp-border">
                      <td className="px-3 py-2">{formatDate(e.entryDate)}</td>
                      <td className="px-3 py-2">{e.transactionType}</td>
                      <td className="px-3 py-2">{e.narration}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.debitAmount > 0 ? formatCurrency(e.debitAmount) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{e.creditAmount > 0 ? formatCurrency(e.creditAmount) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(e.runningBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === 'counts' ? (
          counts.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No cash counts recorded for this account.</p>
          ) : (
            <ul className="space-y-2">
              {counts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-erp-border px-3 py-2 text-[13px]">
                  <span>
                    <span className="font-mono font-semibold">{c.countNumber}</span>{' '}
                    <span className="text-erp-muted">{formatDate(c.countDate)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="tabular-nums">{formatCurrency(c.varianceAmount)}</span>
                    <CashVarianceStatusBadge status={c.varianceStatus} />
                    <CashCountStatusBadge status={c.status} />
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </div>
    </OperationalPageShell>
  )
}
