import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, RefreshCw, ShieldOff, Wallet } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { TableLink } from '@/components/ui/AppLink'
import { BankCashDrawerShell, BankCashWorkspaceTabs } from '@/components/accounting/bankCash'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { listAccounts, listBranches, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import * as treasuryApi from '@/services/api/treasuryApi'
import type { Account, Branch } from '@/types/financeSetup'
import type { CreateCashTreasuryAccountInput, TreasuryAccountDto } from './treasury-account.types'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from '../../bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

function blankForm() {
  return {
    code: '',
    name: '',
    branchId: '',
    glAccountId: '',
    currencyCode: 'INR',
    description: '',
    custodianName: '',
    locationDescription: '',
    imprestLimit: '',
  }
}

function StatusChip({ status }: { status: TreasuryAccountDto['status'] }) {
  const cls =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700'
      : status === 'CLOSED'
        ? 'bg-slate-100 text-slate-600'
        : 'bg-amber-50 text-amber-700'
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{status}</span>
}

export function ApiCashAccountsPage() {
  const perms = useBankCashPermissions()
  const legalEntityId = useMemo(() => {
    try {
      return resolveLegalEntityId()
    } catch {
      return ''
    }
  }, [])
  const [rows, setRows] = useState<TreasuryAccountDto[]>([])
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState(blankForm())
  const [branches, setBranches] = useState<Branch[]>([])
  const [glAccounts, setGlAccounts] = useState<Account[]>([])
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!legalEntityId) {
      setError('Select a legal entity before opening the cash account register.')
      setLoadState('error')
      return
    }
    setLoadState('loading')
    setError('')
    try {
      const result = await treasuryApi.listTreasuryAccounts({
        legalEntityId,
        accountType: 'CASH',
        status: status ? (status as TreasuryAccountDto['status']) : undefined,
        limit: 100,
      })
      const term = search.trim().toLowerCase()
      const filtered = term
        ? result.items.filter((row) =>
            [row.code, row.name, row.cashProfile?.custodianName, row.cashProfile?.locationDescription]
              .filter(Boolean)
              .some((value) => String(value).toLowerCase().includes(term)),
          )
        : result.items
      setRows(filtered)
      setLoadState(filtered.length ? 'ready' : 'empty')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load live treasury cash accounts.')
      setLoadState('error')
    }
  }, [legalEntityId, search, status])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!createOpen || !legalEntityId) return
    void Promise.all([listBranches(legalEntityId), listAccounts(legalEntityId)])
      .then(([branchRows, accountRows]) => {
        setBranches(branchRows.filter((row) => row.isActive))
        setGlAccounts(
          accountRows.filter(
            (row) =>
              row.isActive &&
              !row.isGroup &&
              row.accountType === 'CASH' &&
              row.category === 'ASSET',
          ),
        )
      })
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load account setup.'))
  }, [createOpen, legalEntityId])

  const kpis: EnterpriseKpiItem[] = useMemo(
    () => [
      { id: 'count', label: 'Cash accounts', value: rows.length, accent: 'blue' },
      { id: 'active', label: 'Active', value: rows.filter((row) => row.status === 'ACTIVE').length, accent: 'green' },
      { id: 'inactive', label: 'Inactive', value: rows.filter((row) => row.status === 'INACTIVE').length, accent: 'amber' },
      { id: 'custodians', label: 'Custodians', value: rows.filter((row) => row.cashProfile?.custodianName).length, accent: 'blue' },
    ],
    [rows],
  )

  const createAccount = async () => {
    if (!legalEntityId || !form.code.trim() || !form.name.trim() || !form.glAccountId) {
      notify.error('Code, account name and GL cash account are required.')
      return
    }
    const payload: CreateCashTreasuryAccountInput = {
      legalEntityId,
      branchId: form.branchId || null,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
      accountType: 'CASH',
      glAccountId: form.glAccountId,
      currencyCode: form.currencyCode.trim().toUpperCase(),
      description: form.description.trim() || undefined,
      cashProfile: {
        custodianName: form.custodianName.trim() || undefined,
        locationDescription: form.locationDescription.trim() || undefined,
        imprestLimit: form.imprestLimit ? Number(form.imprestLimit) : undefined,
      },
    }
    setBusy(true)
    try {
      const response = await treasuryApi.createTreasuryAccount(payload)
      notify.success(`Cash account ${response.data.code} created.`)
      setCreateOpen(false)
      setForm(blankForm())
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to create cash account.')
    } finally {
      setBusy(false)
    }
  }

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
      description="Live treasury cash, petty-cash and imprest account setup."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Accounts' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/cash-accounts"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            perms.canManageCashAccount
              ? { id: 'new', label: 'New Cash Account', icon: Plus, onClick: () => setCreateOpen(true) }
              : undefined
          }
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      }
    >
      <BankCashWorkspaceTabs active="cash_accounts" />

      <div className="mb-3 mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="min-w-0 flex-1">
          <SearchInput value={search} onChange={setSearch} placeholder="Search account, custodian or location…" />
        </div>
        <Select className="w-full sm:w-44" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="CLOSED">Closed</option>
        </Select>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? <div className="p-6"><LoadingState variant="table" rows={6} /></div> : null}
        {loadState === 'error' ? (
          <div className="p-6"><EmptyState icon={Wallet} title="Could not load cash accounts" description={error} /></div>
        ) : null}
        {loadState === 'empty' ? (
          <div className="p-6">
            <EmptyState icon={Wallet} title="No live cash accounts found" description="Create a treasury cash account or adjust the filters." />
          </div>
        ) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[850px] text-left text-[13px]">
              <thead>
                <tr>
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Account</th>
                  <th className="px-3 py-2">Location</th>
                  <th className="px-3 py-2">Custodian</th>
                  <th className="px-3 py-2">Imprest Limit</th>
                  <th className="px-3 py-2">Currency</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 font-mono text-[12px]">{row.code}</td>
                    <td className="px-3 py-2">
                      <TableLink to={`/accounting/bank-cash/cash-accounts/${row.id}`}>{row.name}</TableLink>
                      <p className="text-[11px] text-erp-muted">{row.description || 'Treasury cash account'}</p>
                    </td>
                    <td className="px-3 py-2">{row.cashProfile?.locationDescription || '—'}</td>
                    <td className="px-3 py-2">{row.cashProfile?.custodianName || '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{row.cashProfile?.imprestLimit || '—'}</td>
                    <td className="px-3 py-2">{row.currencyCode}</td>
                    <td className="px-3 py-2"><StatusChip status={row.status} /></td>
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
        title="New Cash Account"
        subtitle="Creates a live TreasuryAccount with a cash profile"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setCreateOpen(false)}>Cancel</button>
            <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void createAccount()}>
              {busy ? 'Creating…' : 'Create Account'}
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Account code" required>
              <Input value={form.code} onChange={(e) => setForm((v) => ({ ...v, code: e.target.value }))} />
            </FormField>
            <FormField label="Account name" required>
              <Input value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="GL cash account" required hint="Only active Asset/Cash posting accounts are shown.">
            <Select value={form.glAccountId} onChange={(e) => setForm((v) => ({ ...v, glAccountId: e.target.value }))}>
              <option value="">— Select —</option>
              {glAccounts.map((row) => <option key={row.id} value={row.id}>{row.accountCode} — {row.accountName}</option>)}
            </Select>
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Organization branch">
              <Select value={form.branchId} onChange={(e) => setForm((v) => ({ ...v, branchId: e.target.value }))}>
                <option value="">— Select —</option>
                {branches.map((row) => <option key={row.id} value={row.id}>{row.code} — {row.name}</option>)}
              </Select>
            </FormField>
            <FormField label="Currency" required>
              <Input maxLength={8} value={form.currencyCode} onChange={(e) => setForm((v) => ({ ...v, currencyCode: e.target.value }))} />
            </FormField>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Custodian">
              <Input value={form.custodianName} onChange={(e) => setForm((v) => ({ ...v, custodianName: e.target.value }))} />
            </FormField>
            <FormField label="Imprest limit">
              <Input type="number" min="0" step="0.01" value={form.imprestLimit} onChange={(e) => setForm((v) => ({ ...v, imprestLimit: e.target.value }))} />
            </FormField>
          </div>
          <FormField label="Cash location">
            <Input value={form.locationDescription} onChange={(e) => setForm((v) => ({ ...v, locationDescription: e.target.value }))} />
          </FormField>
          <FormField label="Description">
            <Input value={form.description} onChange={(e) => setForm((v) => ({ ...v, description: e.target.value }))} />
          </FormField>
        </div>
      </BankCashDrawerShell>
    </OperationalPageShell>
  )
}
