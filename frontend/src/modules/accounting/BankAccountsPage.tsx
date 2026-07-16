import { useCallback, useEffect, useMemo, useState } from 'react'
import { Landmark, Plus, RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Input, Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import {
  BankAccountStatusBadge,
  BankCashDemoBanner,
  BankCashDrawerShell,
  BankCashWorkspaceTabs,
  ReconciliationStatusBadge,
} from '@/components/accounting/bankCash'
import {
  createBankAccountDemo,
  getBankAccounts,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { BankAccount } from '@/types/bankCash'
import { BANK_ACCOUNT_TYPES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCompactCurrency, formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

function blankForm() {
  return {
    name: '',
    bankName: '',
    branch: '',
    ifsc: '',
    accountNumberLast4: '',
    accountType: 'Current Account' as BankAccount['accountType'],
    currency: 'INR',
    bookBalance: '0',
    location: 'Head Office — Pune',
    purpose: '',
  }
}

export function BankAccountsPage() {
  const perms = useBankCashPermissions()
  const [rows, setRows] = useState<BankAccount[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getBankAccounts({ search })
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load bank accounts')
      setLoadState('error')
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const totalBook = rows.reduce((s, b) => s + (b.currency === 'INR' ? b.bookBalance : b.bookBalance * 83.25), 0)
    const totalUnreconciled = rows.reduce((s, b) => s + Math.abs(b.unreconciledAmount), 0)
    const active = rows.filter((b) => b.status === 'Active').length
    return [
      { id: 'count', label: 'Bank accounts', value: rows.length, accent: 'blue' },
      { id: 'active', label: 'Active', value: active, accent: 'green' },
      { id: 'balance', label: 'Total book balance', value: formatCompactCurrency(totalBook), accent: 'blue' },
      { id: 'unreconciled', label: 'Unreconciled', value: formatCompactCurrency(totalUnreconciled), accent: 'amber' },
    ]
  }, [rows])

  const createAccount = async () => {
    if (!form.name.trim() || !form.bankName.trim()) {
      notify.error('Account name and bank name are required')
      return
    }
    setBusy(true)
    try {
      const created = await createBankAccountDemo({
        name: form.name.trim(),
        bankName: form.bankName.trim(),
        branch: form.branch.trim(),
        ifsc: form.ifsc.trim(),
        accountNumberLast4: form.accountNumberLast4.trim() || undefined,
        accountType: form.accountType,
        currency: form.currency,
        bookBalance: Number(form.bookBalance) || 0,
        statementBalance: Number(form.bookBalance) || 0,
        availableBalance: Number(form.bookBalance) || 0,
        location: form.location,
        purpose: form.purpose,
      })
      notify.success(`Created ${created.code} (demo — not connected to a live bank feed)`)
      setCreateOpen(false)
      setForm(blankForm())
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Failed to create bank account')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewBankAccount) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank Accounts"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Bank Accounts' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing bank account view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank Accounts"
      description="Bank accounts, balances and reconciliation status — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Bank Accounts' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/bank-accounts"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageBankAccount
              ? { id: 'new', label: 'New Bank Account', icon: Plus, onClick: () => setCreateOpen(true) }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="bank_accounts" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search account, bank, IFSC…" />
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (
          <div className="p-6">
            <LoadingState variant="table" rows={6} />
          </div>
        ) : null}
        {loadState === 'error' ? (
          <div className="p-6">
            <EmptyState icon={ScrollText} title="Could not load bank accounts" description={errorMsg} />
          </div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState icon={Landmark} title="No bank accounts found" description="Adjust your search or add a new bank account." />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1100px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Code</th>
                  <th className="px-3 py-2 font-semibold">Account</th>
                  <th className="px-3 py-2 font-semibold">Number</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 text-right font-semibold">Book Balance</th>
                  <th className="px-3 py-2 text-right font-semibold">Available</th>
                  <th className="px-3 py-2 text-right font-semibold">Unreconciled</th>
                  <th className="px-3 py-2 font-semibold">Recon.</th>
                  <th className="px-3 py-2 font-semibold">Last Reconciled</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-mono">{b.code}</td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/bank-cash/bank-accounts/${b.id}`}>{b.name}</TableLink>
                      <p className="text-[11px] text-erp-muted">{b.bankName} · {b.branch}</p>
                    </td>
                    <td className="px-3 py-2 font-mono text-[12px]">{b.accountNumberMasked}</td>
                    <td className="px-3 py-2">{b.accountType}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(b.bookBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(b.availableBalance)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(b.unreconciledAmount)}</td>
                    <td className="px-3 py-2">
                      <ReconciliationStatusBadge status={b.reconciliationStatus} />
                    </td>
                    <td className="px-3 py-2 tabular-nums">{b.lastReconciledDate ? formatDate(b.lastReconciledDate) : '—'}</td>
                    <td className="px-3 py-2">
                      <BankAccountStatusBadge status={b.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </EnterpriseRegisterTableShell>

      <BankCashDrawerShell
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New Bank Account"
        subtitle="Demo record — not connected to a live bank feed"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="erp-btn erp-btn-primary h-9 px-3 text-[13px]"
              disabled={busy}
              onClick={() => void createAccount()}
            >
              {busy ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Account name *</label>
            <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank name *</label>
            <Input value={form.bankName} onChange={(e) => setForm((f) => ({ ...f, bankName: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Branch</label>
              <Input value={form.branch} onChange={(e) => setForm((f) => ({ ...f, branch: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">IFSC</label>
              <Input value={form.ifsc} onChange={(e) => setForm((f) => ({ ...f, ifsc: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Account last 4 digits</label>
              <Input maxLength={4} value={form.accountNumberLast4} onChange={(e) => setForm((f) => ({ ...f, accountNumberLast4: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Account type</label>
              <Select value={form.accountType} onChange={(e) => setForm((f) => ({ ...f, accountType: e.target.value as BankAccount['accountType'] }))}>
                {BANK_ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Currency</label>
              <Select value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                <option value="INR">INR</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Opening book balance</label>
              <Input type="number" step="0.01" value={form.bookBalance} onChange={(e) => setForm((f) => ({ ...f, bookBalance: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Location</label>
            <Input value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Purpose</label>
            <Input value={form.purpose} onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))} />
          </div>
        </div>
      </BankCashDrawerShell>
    </OperationalPageShell>
  )
}
