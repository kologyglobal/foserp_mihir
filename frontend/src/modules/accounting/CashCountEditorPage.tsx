import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Save, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import {
  BankCashDemoBanner,
  BankCashEmptyState,
  CashVarianceStatusBadge,
} from '@/components/accounting/bankCash'
import { INDIAN_DENOMINATIONS } from '@/data/accounting/bankCashSeed'
import {
  createCashCount,
  getBankCashLookups,
  getCashAccountById,
  submitCashCount,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { CashCountDenomination } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { getSessionUser } from '@/utils/permissions'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { amountTone, BANK_CASH_BREADCRUMB } from './bankCashUi'
import { cn } from '@/utils/cn'

function buildDenominations(): CashCountDenomination[] {
  return INDIAN_DENOMINATIONS.map((d) => ({ denomination: d, count: 0, amount: 0 }))
}

export function CashCountEditorPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const perms = useBankCashPermissions()
  const user = getSessionUser()
  const [lookups, setLookups] = useState<Awaited<ReturnType<typeof getBankCashLookups>> | null>(null)
  const [cashAccountId, setCashAccountId] = useState(params.get('cashAccountId') ?? '')
  const [bookBalance, setBookBalance] = useState<number | null>(null)
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10))
  const [denominations, setDenominations] = useState<CashCountDenomination[]>(buildDenominations)
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void getBankCashLookups().then(setLookups)
  }, [])

  useEffect(() => {
    if (!cashAccountId) {
      setBookBalance(null)
      return
    }
    void getCashAccountById(cashAccountId).then((acc) => setBookBalance(acc?.bookBalance ?? null))
  }, [cashAccountId])

  const physicalTotal = useMemo(
    () => denominations.reduce((s, d) => s + d.amount, 0),
    [denominations],
  )

  const variance = bookBalance != null ? physicalTotal - bookBalance : 0
  const varianceStatus = variance === 0 ? 'Matched' as const : variance > 0 ? 'Excess' as const : 'Shortage' as const

  const setDenomCount = (denomination: number, count: number) => {
    setDenominations((rows) =>
      rows.map((r) =>
        r.denomination === denomination
          ? { ...r, count, amount: denomination * count }
          : r,
      ),
    )
  }

  const validate = (): string[] => {
    const errors: string[] = []
    if (!cashAccountId) errors.push('Cash account is required')
    if (!countDate) errors.push('Count date is required')
    if (physicalTotal <= 0) errors.push('Enter at least one denomination count')
    return errors
  }

  const save = async (andSubmit = false) => {
    const errors = validate()
    if (errors.length) {
      notify.error(errors[0])
      return
    }
    if (!perms.canManageCashCount) {
      notify.error('Permission denied')
      return
    }
    setBusy(true)
    try {
      const count = await createCashCount({
        countDate,
        cashAccountId,
        denominations: denominations.filter((d) => d.count > 0),
        notes: notes || null,
        countedBy: user.name,
      })
      if (andSubmit) {
        await submitCashCount(count.id)
        notify.success(`Cash count ${count.countNumber} submitted (demo).`)
      } else {
        notify.success(`Cash count ${count.countNumber} saved as draft (demo).`)
      }
      navigate('/accounting/bank-cash/cash-counts')
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (!perms.canManageCashCount) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="New Cash Count" breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Counts', to: '/accounting/bank-cash/cash-counts' }, { label: 'New' }]} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" />
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title="New Cash Count"
      description="Indian denomination breakdown — demo only, no GL posting until approved."
      breadcrumbs={[...BANK_CASH_BREADCRUMB, { label: 'Cash Counts', to: '/accounting/bank-cash/cash-counts' }, { label: 'New' }]}
      autoBreadcrumbs={false}
      showDescription
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          secondaryActions={[
            { id: 'save', label: busy ? 'Saving…' : 'Save Draft', icon: Save, disabled: busy, onClick: () => void save(false) },
            { id: 'submit', label: 'Save & Submit', icon: Send, disabled: busy, onClick: () => void save(true) },
          ]}
        />
      )}
    >
      <div className="space-y-3 p-4">
        <BankCashDemoBanner />
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-1">
            <h3 className="mb-3 text-[13px] font-semibold">Count header</h3>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cash account *</label>
                <Select value={cashAccountId} onChange={(e) => setCashAccountId(e.target.value)}>
                  <option value="">Select cash account…</option>
                  {(lookups?.cashAccounts ?? []).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Count date *</label>
                <Input type="date" value={countDate} onChange={(e) => setCountDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Notes</label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>
              <dl className="grid gap-2 text-[12px]">
                <div className="flex justify-between"><dt className="text-erp-muted">Book balance</dt><dd className="font-semibold">{bookBalance != null ? formatCurrency(bookBalance) : '—'}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Physical total</dt><dd className="font-semibold">{formatCurrency(physicalTotal)}</dd></div>
                <div className="flex justify-between"><dt className="text-erp-muted">Variance</dt><dd className={cn('font-semibold', amountTone(variance))}>{bookBalance != null ? formatCurrency(variance) : '—'}</dd></div>
                <div className="flex justify-between items-center"><dt className="text-erp-muted">Status</dt><dd>{bookBalance != null ? <CashVarianceStatusBadge status={varianceStatus} /> : '—'}</dd></div>
              </dl>
            </div>
          </section>

          <section className="rounded-md border border-erp-border bg-white p-4 lg:col-span-2">
            <h3 className="mb-3 text-[13px] font-semibold">Indian denominations (₹)</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[12px]">
                <thead className="bg-erp-surface text-[11px] uppercase text-erp-muted">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Denomination</th>
                    <th className="px-3 py-2 font-semibold">Count</th>
                    <th className="px-3 py-2 font-semibold text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {denominations.map((d) => (
                    <tr key={d.denomination} className="border-t border-erp-border/80">
                      <td className="px-3 py-2 font-medium">₹{d.denomination.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          className="h-8 w-24 rounded border border-erp-border px-2 text-right tabular-nums"
                          value={d.count || ''}
                          onChange={(e) => setDenomCount(d.denomination, Math.max(0, Number(e.target.value) || 0))}
                          aria-label={`Count for ₹${d.denomination}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(d.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-erp-border font-semibold">
                    <td className="px-3 py-2" colSpan={2}>Physical total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(physicalTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </div>
    </OperationalPageShell>
  )
}
