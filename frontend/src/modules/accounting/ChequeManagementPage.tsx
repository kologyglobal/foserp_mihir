import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, RefreshCw, ScrollText, ShieldOff, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { SearchInput } from '@/components/ui/SearchInput'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EnterpriseRegisterTableShell } from '@/design-system/list-page/EnterpriseRegisterTableShell'
import { Select } from '@/components/forms/Inputs'
import type { EnterpriseKpiItem } from '@/design-system/enterprise/enterpriseKpiTypes'
import { BankCashDemoBanner, BankCashWorkspaceTabs, ChequeStatusBadge } from '@/components/accounting/bankCash'
import { getBankCashLookups, getCheques, updateChequeStatusDemo, BankCashServiceError } from '@/services/accounting/bankCashService'
import type { BankCashLookups, Cheque, ChequeDirection, ChequeStatus } from '@/types/bankCash'
import { CHEQUE_DIRECTIONS, CHEQUE_STATUSES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { BANK_CASH_BREADCRUMB } from './bankCashUi'

type LoadState = 'loading' | 'ready' | 'empty' | 'error'

const NEXT_STATUS: Partial<Record<ChequeStatus, ChequeStatus[]>> = {
  Draft: ['Issued', 'Cancelled'],
  Issued: ['Deposited', 'Cleared', 'Cancelled', 'Stopped'],
  PDC: ['Deposited', 'Cleared', 'Bounced', 'Cancelled'],
  Deposited: ['Cleared', 'Bounced'],
}

export function ChequeManagementPage() {
  const perms = useBankCashPermissions()
  const [rows, setRows] = useState<Cheque[]>([])
  const [search, setSearch] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [direction, setDirection] = useState<ChequeDirection | ''>('')
  const [status, setStatus] = useState<ChequeStatus | ''>('')
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    void getBankCashLookups().then(setLookups)
  }, [])

  const load = useCallback(async () => {
    setLoadState('loading')
    try {
      const list = await getCheques({ search, bankAccountId, chequeDirection: direction, chequeStatus: status })
      setRows(list)
      setLoadState(list.length ? 'ready' : 'empty')
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Failed to load cheques')
      setLoadState('error')
    }
  }, [search, bankAccountId, direction, status])

  useEffect(() => {
    void load()
  }, [load])

  const kpis: EnterpriseKpiItem[] = useMemo(() => {
    const pdc = rows.filter((c) => c.status === 'PDC').length
    const bounced = rows.filter((c) => c.status === 'Bounced').length
    const pendingClearance = rows.filter((c) => c.status === 'Deposited').length
    return [
      { id: 'count', label: 'Cheques', value: rows.length, accent: 'blue' },
      { id: 'pdc', label: 'PDC', value: pdc, accent: 'amber' },
      { id: 'pending', label: 'Pending clearance', value: pendingClearance, accent: 'amber' },
      { id: 'bounced', label: 'Bounced', value: bounced, accent: bounced > 0 ? 'red' : 'slate' },
    ]
  }, [rows])

  const changeStatus = async (cheque: Cheque, next: ChequeStatus) => {
    setBusyId(cheque.id)
    try {
      await updateChequeStatusDemo(cheque.id, next)
      notify.success(`Cheque ${cheque.chequeNumber} marked ${next} (demo)`)
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Update failed')
    } finally {
      setBusyId(null)
    }
  }

  if (!perms.canViewCheques) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Cheque Management"
        breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cheques' }]}
        autoBreadcrumbs={false}
      >
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing cheque view permission." />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="Cheque Management"
      description="Issued, received and post-dated cheques with clearance tracking — demo data only."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cheques' }]}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/cheques"
      kpiStrip={loadState === 'ready' || loadState === 'empty' ? kpis : undefined}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          secondaryActions={[{ id: 'refresh', label: 'Refresh', icon: RefreshCw, onClick: () => void load() }]}
        />
      )}
    >
      <BankCashWorkspaceTabs active="cheques" />
      <div className="mt-4">
        <BankCashDemoBanner />
      </div>

      <div className="mb-3 mt-3 flex flex-wrap items-center gap-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search cheque number, payee, reference…" className="min-w-[16rem] flex-1" />
        <Select wrapClassName="w-56" value={bankAccountId} onChange={(e) => setBankAccountId(e.target.value)}>
          <option value="">All bank accounts</option>
          {lookups?.bankAccounts.map((b) => (<option key={b.id} value={b.id}>{b.label}</option>))}
        </Select>
        <Select wrapClassName="w-36" value={direction} onChange={(e) => setDirection(e.target.value as ChequeDirection | '')}>
          <option value="">All directions</option>
          {CHEQUE_DIRECTIONS.map((d) => (<option key={d} value={d}>{d}</option>))}
        </Select>
        <Select wrapClassName="w-40" value={status} onChange={(e) => setStatus(e.target.value as ChequeStatus | '')}>
          <option value="">All statuses</option>
          {CHEQUE_STATUSES.map((s) => (<option key={s} value={s}>{s}</option>))}
        </Select>
      </div>

      <EnterpriseRegisterTableShell>
        {loadState === 'loading' ? (<div className="p-6"><LoadingState variant="table" rows={8} /></div>) : null}
        {loadState === 'error' ? (<div className="p-6"><EmptyState icon={ScrollText} title="Could not load cheques" description={errorMsg} /></div>) : null}
        {loadState === 'empty' ? (<div className="p-6"><EmptyState icon={ScrollText} title="No cheques match" description="Adjust your filters and try again." /></div>) : null}
        {loadState === 'ready' ? (
          <div className="overflow-x-auto">
            <table className="erp-table w-full min-w-[1100px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-[11px] uppercase tracking-wide text-erp-muted">
                  <th className="px-3 py-2 font-semibold">Cheque No</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 font-semibold">Direction</th>
                  <th className="px-3 py-2 font-semibold">Bank Account</th>
                  <th className="px-3 py-2 font-semibold">Payee</th>
                  <th className="px-3 py-2 text-right font-semibold">Amount</th>
                  <th className="px-3 py-2 font-semibold">PDC / Deposit</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-erp-border/80 hover:bg-erp-surface-alt/40">
                    <td className="px-3 py-2 font-mono">{c.chequeNumber}</td>
                    <td className="px-3 py-2 tabular-nums">{formatDate(c.chequeDate)}</td>
                    <td className="px-3 py-2">{c.direction}</td>
                    <td className="px-3 py-2">{c.bankAccountName}</td>
                    <td className="px-3 py-2">{c.payeeName}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(c.amount)}</td>
                    <td className="px-3 py-2 tabular-nums">{c.pdcDate ? formatDate(c.pdcDate) : c.depositDate ? formatDate(c.depositDate) : '—'}</td>
                    <td className="px-3 py-2"><ChequeStatusBadge status={c.status} /></td>
                    <td className="px-3 py-2">
                      {perms.canManageCheques ? (
                        <div className="flex items-center gap-1">
                          {(NEXT_STATUS[c.status] ?? []).map((next) => (
                            <button
                              key={next}
                              type="button"
                              className="rounded border border-erp-border px-1.5 py-0.5 text-[11px] font-semibold text-erp-muted hover:bg-erp-surface-alt disabled:opacity-50"
                              disabled={busyId === c.id}
                              title={next}
                              onClick={() => void changeStatus(c, next)}
                            >
                              {next === 'Cleared' || next === 'Deposited' ? <CheckCircle2 className="mr-1 inline h-3 w-3" /> : null}
                              {next === 'Bounced' || next === 'Cancelled' ? <XCircle className="mr-1 inline h-3 w-3" /> : null}
                              {next}
                            </button>
                          ))}
                        </div>
                      ) : null}
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
