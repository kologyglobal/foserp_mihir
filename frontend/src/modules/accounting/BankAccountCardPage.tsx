import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, FileUp, Landmark, Pencil, Power, RefreshCw, Wand2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { Input, Select } from '@/components/forms/Inputs'
import {
  BankAccountStatusBadge,
  BankCashDrawerShell,
  ChequeStatusBadge,
  ReconciliationStatusBadge,
} from '@/components/accounting/bankCash'
import {
  getBankAccountById,
  getBankCashAuditTrail,
  getBankCashTransactions,
  getCheques,
  getReconciliations,
  updateBankAccountDemo,
  deactivateBankAccountDemo,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { BankAccount, BankCashAuditEntry, BankCashTransaction, Cheque, Reconciliation } from '@/types/bankCash'
import { BANK_ACCOUNT_STATUSES, BANK_ACCOUNT_TYPES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate, formatDateTime } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type CardTab = 'general' | 'transactions' | 'cheques' | 'reconciliation' | 'audit'

const TABS: { id: CardTab; label: string }[] = [
  { id: 'general', label: 'General' },
  { id: 'transactions', label: 'Recent Transactions' },
  { id: 'cheques', label: 'Cheques' },
  { id: 'reconciliation', label: 'Reconciliation History' },
  { id: 'audit', label: 'Audit History' },
]

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</dt>
      <dd className="mt-0.5 text-[13px] text-erp-text">{value ?? '—'}</dd>
    </div>
  )
}

export function BankAccountCardPage() {
  const { bankAccountId = '' } = useParams()
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [account, setAccount] = useState<BankAccount | null>(null)
  const [transactions, setTransactions] = useState<BankCashTransaction[]>([])
  const [cheques, setCheques] = useState<Cheque[]>([])
  const [reconciliations, setReconciliations] = useState<Reconciliation[]>([])
  const [audit, setAudit] = useState<BankCashAuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<CardTab>('general')
  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<Partial<BankAccount>>({})
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const acc = await getBankAccountById(bankAccountId)
      if (!acc) {
        setAccount(null)
        setError('Bank account not found')
        setLoading(false)
        return
      }
      setAccount(acc)
      setEditForm(acc)
      const [txns, chqs, recons, auditRows] = await Promise.all([
        getBankCashTransactions({ bankAccountId }),
        getCheques({ bankAccountId }),
        getReconciliations({ bankAccountId }),
        getBankCashAuditTrail('BankAccount', bankAccountId),
      ])
      setTransactions(txns.slice(0, 15))
      setCheques(chqs)
      setReconciliations(recons)
      setAudit(auditRows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load bank account')
    } finally {
      setLoading(false)
    }
  }, [bankAccountId])

  useEffect(() => {
    void load()
  }, [load])

  const breadcrumbs = [...BANK_CASH_BREADCRUMB, { label: 'Bank Accounts', to: '/accounting/bank-cash/bank-accounts' }, { label: account?.code ?? 'Account' }]

  const saveEdit = async () => {
    setBusy(true)
    try {
      await updateBankAccountDemo(bankAccountId, editForm)
      notify.success('Bank account updated (demo)')
      setEditOpen(false)
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async () => {
    if (!account) return
    setBusy(true)
    try {
      if (account.status === 'Active') {
        await deactivateBankAccountDemo(account.id)
        notify.success('Bank account deactivated (demo)')
      } else {
        await updateBankAccountDemo(account.id, { status: 'Active' })
        notify.success('Bank account activated (demo)')
      }
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Bank Account" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  if (!account || error) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Not found" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState
          icon={Landmark}
          title="Bank account not found"
          description={error ?? undefined}
          action={<Link to="/accounting/bank-cash/bank-accounts" className="erp-btn erp-btn-primary h-9 px-4 text-[13px]">Back to Bank Accounts</Link>}
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
      description="Bank account card — demo balances only, not connected to a live bank feed."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath={`/accounting/bank-cash/bank-accounts/${account.id}`}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canManageBankAccount ? { id: 'edit', label: 'Edit', icon: Pencil, onClick: () => setEditOpen(true) } : undefined}
          secondaryActions={[
            { id: 'back', label: 'Back', icon: ArrowLeft, onClick: () => navigate('/accounting/bank-cash/bank-accounts') },
            {
              id: 'reconcile',
              label: 'Reconcile',
              icon: Wand2,
              hidden: !perms.canManageReconciliation,
              onClick: () => navigate('/accounting/bank-cash/reconciliation'),
            },
            {
              id: 'import',
              label: 'Import Statement',
              icon: FileUp,
              hidden: !perms.canImportStatement,
              onClick: () => navigate(`/accounting/bank-cash/statements/import?bankAccountId=${account.id}`),
            },
            { id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() },
          ]}
          moreActions={[
            {
              id: 'toggle',
              label: account.status === 'Active' ? 'Deactivate' : 'Activate',
              icon: Power,
              hidden: !perms.canManageBankAccount,
              onClick: () => void toggleActive(),
            },
          ]}
        />
      )}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-erp-border bg-white px-4 py-3">
        <BankAccountStatusBadge status={account.status} />
        <ReconciliationStatusBadge status={account.reconciliationStatus} />
        <span className="text-[12px] text-erp-muted">{account.accountType} · {account.currency}</span>
        <span className="font-mono text-[12px] text-erp-muted">{account.accountNumberMasked}</span>
        <span className="ml-auto text-[13px] font-semibold tabular-nums text-erp-text">
          {formatCurrency(account.bookBalance)}
          <span className="ml-1 text-[11px] font-normal text-erp-muted">(demo book balance)</span>
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
            <Field label="Bank" value={account.bankName} />
            <Field label="Branch" value={account.branch} />
            <Field label="IFSC" value={account.ifsc} />
            <Field label="SWIFT" value={account.swiftCode} />
            <Field label="Account Number" value={account.accountNumberMasked} />
            <Field label="Account Type" value={account.accountType} />
            <Field label="Currency" value={account.currency} />
            <Field label="Book Balance" value={formatCurrency(account.bookBalance)} />
            <Field label="Statement Balance" value={formatCurrency(account.statementBalance)} />
            <Field label="Available Balance" value={formatCurrency(account.availableBalance)} />
            <Field label="Unreconciled Amount" value={formatCurrency(account.unreconciledAmount)} />
            <Field label="Payments in Transit" value={formatCurrency(account.paymentsInTransit)} />
            <Field label="Deposits in Transit" value={formatCurrency(account.depositsInTransit)} />
            <Field label="Overdraft Limit" value={account.overdraftLimit != null ? formatCurrency(account.overdraftLimit) : '—'} />
            <Field label="Minimum Balance" value={account.minimumBalance != null ? formatCurrency(account.minimumBalance) : '—'} />
            <Field label="Reconciliation Frequency" value={account.reconciliationFrequency} />
            <Field label="Last Reconciled" value={account.lastReconciledDate ? formatDate(account.lastReconciledDate) : '—'} />
            <Field label="Last Statement" value={account.lastStatementDate ? formatDate(account.lastStatementDate) : '—'} />
            <Field label="Custodian" value={account.custodian} />
            <Field label="Location" value={account.location} />
            <Field label="Payment Account" value={account.isPaymentAccount ? 'Yes' : 'No'} />
            <Field label="Collection Account" value={account.isCollectionAccount ? 'Yes' : 'No'} />
            <Field label="Purpose" value={account.purpose} />
          </dl>
        ) : null}

        {tab === 'transactions' ? (
          transactions.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No transactions recorded for this account.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="w-full min-w-[720px] text-[12px]">
                <thead className="bg-erp-surface text-left text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Number</th>
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Counterparty</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                    <th className="px-3 py-2">Reconciled</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((t) => (
                    <tr key={t.id} className="border-t border-erp-border">
                      <td className="px-3 py-2">{formatDate(t.transactionDate)}</td>
                      <td className="px-3 py-2 font-mono">{t.transactionNumber}</td>
                      <td className="px-3 py-2">{t.transactionType}</td>
                      <td className="px-3 py-2">{t.counterpartyName ?? '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.debitAmount > 0 ? formatCurrency(t.debitAmount) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{t.creditAmount > 0 ? formatCurrency(t.creditAmount) : '—'}</td>
                      <td className="px-3 py-2">{t.isReconciled ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === 'cheques' ? (
          cheques.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No cheques recorded for this account.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="w-full min-w-[640px] text-[12px]">
                <thead className="bg-erp-surface text-left text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2">Cheque #</th>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Direction</th>
                    <th className="px-3 py-2">Payee</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cheques.map((c) => (
                    <tr key={c.id} className="border-t border-erp-border">
                      <td className="px-3 py-2 font-mono">{c.chequeNumber}</td>
                      <td className="px-3 py-2">{formatDate(c.chequeDate)}</td>
                      <td className="px-3 py-2">{c.direction}</td>
                      <td className="px-3 py-2">{c.payeeName}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.amount)}</td>
                      <td className="px-3 py-2"><ChequeStatusBadge status={c.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : null}

        {tab === 'reconciliation' ? (
          reconciliations.length === 0 ? (
            <p className="text-[13px] text-erp-muted">No reconciliation sessions for this account yet.</p>
          ) : (
            <ul className="space-y-2">
              {reconciliations.map((r) => (
                <li key={r.id}>
                  <Link
                    to={`/accounting/bank-cash/reconciliation/${r.id}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-erp-border px-3 py-2 text-[13px] hover:bg-erp-surface-alt"
                  >
                    <span>
                      <span className="font-mono font-semibold">{r.reconciliationNumber}</span>{' '}
                      <span className="text-erp-muted">{formatDate(r.periodFrom)} – {formatDate(r.periodTo)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="tabular-nums">{formatCurrency(r.finalDifference)}</span>
                      <ReconciliationStatusBadge status={r.status} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : null}

        {tab === 'audit' ? (
          perms.canViewAudit ? (
            <ul className="space-y-2">
              {audit.map((a) => (
                <li key={a.id} className="rounded-md border border-erp-border px-3 py-2 text-[13px]">
                  <span className="font-medium">{a.action}</span>
                  <span className="text-erp-muted"> — {a.details}</span>
                  <p className="text-[11px] text-erp-muted">{a.performedBy} · {formatDateTime(a.performedAt)}{a.isDemo ? ' · Demo' : ''}</p>
                </li>
              ))}
              {audit.length === 0 ? <p className="text-[13px] text-erp-muted">No audit entries.</p> : null}
            </ul>
          ) : (
            <p className="text-[13px] text-erp-muted">Audit information is not permitted for your role.</p>
          )
        ) : null}
      </div>

      <BankCashDrawerShell
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Bank Account"
        subtitle="Demo record — not connected to a live bank feed"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setEditOpen(false)}>Cancel</button>
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void saveEdit()}>
              {busy ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Account name</label>
            <Input value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Account type</label>
              <Select value={editForm.accountType ?? account.accountType} onChange={(e) => setEditForm((f) => ({ ...f, accountType: e.target.value as BankAccount['accountType'] }))}>
                {BANK_ACCOUNT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Status</label>
              <Select value={editForm.status ?? account.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as BankAccount['status'] }))}>
                {BANK_ACCOUNT_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Reconciliation frequency</label>
            <Select value={editForm.reconciliationFrequency ?? account.reconciliationFrequency} onChange={(e) => setEditForm((f) => ({ ...f, reconciliationFrequency: e.target.value as BankAccount['reconciliationFrequency'] }))}>
              <option value="Daily">Daily</option>
              <option value="Weekly">Weekly</option>
              <option value="Monthly">Monthly</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Purpose</label>
            <Input value={editForm.purpose ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, purpose: e.target.value }))} />
          </div>
        </div>
      </BankCashDrawerShell>
    </OperationalPageShell>
  )
}
