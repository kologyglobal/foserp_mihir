import { useCallback, useEffect, useState } from 'react'
import { Plus, RefreshCw, ScrollText, ShieldOff } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Input, Select } from '@/components/forms/Inputs'
import { BankCashDemoBanner, BankCashDrawerShell, BankCashWorkspaceTabs, BankDepositStatusBadge } from '@/components/accounting/bankCash'
import { createBankDepositDemo, getBankCashLookups, getBankDeposits, BankCashServiceError } from '@/services/accounting/bankCashService'
import type { BankCashLookups, BankDeposit, BankDepositInput, DepositType } from '@/types/bankCash'
import { DEPOSIT_TYPES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

function today() {
  return new Date().toISOString().slice(0, 10)
}

function blankForm() {
  return {
    depositDate: today(),
    depositType: 'Cash Deposit' as DepositType,
    bankAccountId: '',
    cashAccountId: '',
    totalAmount: '',
    cashAmount: '',
    chequeAmount: '',
    chequeCount: '0',
    narration: '',
  }
}

export function BankDepositsPage() {
  const perms = useBankCashPermissions()
  const [rows, setRows] = useState<BankDeposit[]>([])
  const [search, setSearch] = useState('')
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getBankCashLookups().then(setLookups)
  }, [])

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getBankDeposits({ search })
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load deposits')
      setLoadState('error')
    }
  }, [search])

  useEffect(() => {
    void load()
  }, [load])

  const createDeposit = async () => {
    if (!form.bankAccountId || !(Number(form.totalAmount) > 0)) {
      notify.error('Bank account and a positive total amount are required')
      return
    }
    setBusy(true)
    try {
      const input: BankDepositInput = {
        depositDate: form.depositDate,
        depositType: form.depositType,
        bankAccountId: form.bankAccountId,
        cashAccountId: form.cashAccountId || null,
        totalAmount: Number(form.totalAmount) || 0,
        cashAmount: Number(form.cashAmount) || 0,
        chequeAmount: Number(form.chequeAmount) || 0,
        chequeCount: Number(form.chequeCount) || 0,
        narration: form.narration,
      }
      const created = await createBankDepositDemo(input)
      notify.success(`Created ${created.depositNumber} (demo)`)
      setCreateOpen(false)
      setForm(blankForm())
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Failed to create deposit')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canViewDeposits) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Bank Deposits"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Deposits' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing deposit view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Bank Deposits"
      description="Cash and cheque deposit slips to bank accounts — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Deposits' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/deposits"
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={perms.canCreateDeposit ? { id: 'new', label: 'New Deposit', icon: Plus, onClick: () => setCreateOpen(true) } : undefined}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="deposits" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3">
        <SearchInput value={search} onChange={setSearch} placeholder="Search deposit number, narration…" />
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (<div className="p-6"><LoadingState variant="table" rows={6} /></div>) : null}
        {loadState === 'error' ? (<div className="p-6"><EmptyState icon={ScrollText} title="Could not load deposits" description={errorMsg} /></div>) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState
              icon={ScrollText}
              title="No bank deposits found"
              action={perms.canCreateDeposit ? (
                <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" onClick={() => setCreateOpen(true)}>New Deposit</button>
              ) : null}
            />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1000px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Deposit No</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Bank Account</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 text-right font-semibold">Cash</th>
                  <th className="px-3 py-2 text-right font-semibold">Cheque</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => (
                  <tr key={d.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-mono">{d.depositNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(d.depositDate)}</td>
                    <td className="px-3 py-2">{d.bankAccountName}</td>
                    <td className="px-3 py-2">{d.depositType}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.cashAmount > 0 ? formatCurrency(d.cashAmount) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{d.chequeAmount > 0 ? `${formatCurrency(d.chequeAmount)} (${d.chequeCount})` : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatCurrency(d.totalAmount)}</td>
                    <td className="px-3 py-2"><BankDepositStatusBadge status={d.status} /></td>
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
        title="New Bank Deposit"
        subtitle="Demo record — not connected to a live bank feed"
        footer={(
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void createDeposit()}>
              {busy ? 'Creating…' : 'Create Deposit'}
            </button>
          </div>
        )}
      >
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank account *</label>
            <Select value={form.bankAccountId} onChange={(e) => setForm((f) => ({ ...f, bankAccountId: e.target.value }))}>
              <option value="">Select bank account</option>
              {lookups?.bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Deposit date *</label>
              <Input type="date" value={form.depositDate} onChange={(e) => setForm((f) => ({ ...f, depositDate: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Deposit type</label>
              <Select value={form.depositType} onChange={(e) => setForm((f) => ({ ...f, depositType: e.target.value as DepositType }))}>
                {DEPOSIT_TYPES.map((t) => (<option key={t} value={t}>{t}</option>))}
              </Select>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Source cash account (optional)</label>
            <Select value={form.cashAccountId} onChange={(e) => setForm((f) => ({ ...f, cashAccountId: e.target.value }))}>
              <option value="">None</option>
              {lookups?.cashAccounts.map((c) => (<option key={c.id} value={c.id}>{c.label}</option>))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cash amount</label>
              <Input type="number" min={0} step="0.01" value={form.cashAmount} onChange={(e) => setForm((f) => ({ ...f, cashAmount: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cheque amount</label>
              <Input type="number" min={0} step="0.01" value={form.chequeAmount} onChange={(e) => setForm((f) => ({ ...f, chequeAmount: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cheque count</label>
              <Input type="number" min={0} value={form.chequeCount} onChange={(e) => setForm((f) => ({ ...f, chequeCount: e.target.value }))} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Total amount *</label>
              <Input type="number" min={0} step="0.01" value={form.totalAmount} onChange={(e) => setForm((f) => ({ ...f, totalAmount: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Narration</label>
            <Input value={form.narration} onChange={(e) => setForm((f) => ({ ...f, narration: e.target.value }))} />
          </div>
        </div>
      </BankCashDrawerShell>
    </OperationalPageShell>
  )
}
