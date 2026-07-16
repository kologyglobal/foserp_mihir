import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeftRight, Ban, Check, Save, Send, XCircle } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { BankCashConfirmModal, BankCashEmptyState, FundTransferStatusBadge } from '@/components/accounting/bankCash'
import {
  approveFundTransfer,
  completeFundTransferDemo,
  createFundTransfer,
  getBankCashLookups,
  getFundTransferById,
  rejectFundTransfer,
  reverseFundTransferDemo,
  submitFundTransfer,
  updateFundTransfer,
  BankCashServiceError,
} from '@/services/accounting/bankCashService'
import type { BankCashLookups, FundTransfer, FundTransferInput, FundTransferType, TransferMode } from '@/types/bankCash'
import { FUND_TRANSFER_TYPES, TRANSFER_MODES } from '@/types/bankCash'
import { useBankCashPermissions } from '@/utils/permissions/bankCash'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type Workspace = 'information' | 'preview'
type AccountKind = 'bank' | 'cash'

type FormState = {
  transferDate: string
  valueDate: string
  transferType: FundTransferType
  transferMode: TransferMode
  fromAccountKind: AccountKind
  fromAccountId: string
  toAccountKind: AccountKind
  toAccountId: string
  amount: string
  currency: string
  charges: string
  narration: string
  reference: string
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function blankForm(defaults: Partial<FormState> = {}): FormState {
  const d = today()
  return {
    transferDate: d,
    valueDate: d,
    transferType: 'Bank to Bank',
    transferMode: 'Internal Transfer',
    fromAccountKind: 'bank',
    fromAccountId: '',
    toAccountKind: 'bank',
    toAccountId: '',
    amount: '',
    currency: 'INR',
    charges: '0',
    narration: '',
    reference: '',
    ...defaults,
  }
}

function fromTransfer(t: FundTransfer): FormState {
  return {
    transferDate: t.transferDate,
    valueDate: t.valueDate,
    transferType: t.transferType,
    transferMode: t.transferMode,
    fromAccountKind: t.fromAccountKind,
    fromAccountId: t.fromBankAccountId ?? t.fromCashAccountId ?? '',
    toAccountKind: t.toAccountKind,
    toAccountId: t.toBankAccountId ?? t.toCashAccountId ?? '',
    amount: String(t.amount),
    currency: t.currency,
    charges: String(t.charges),
    narration: t.narration,
    reference: t.reference,
  }
}

function toInput(form: FormState): FundTransferInput {
  return {
    transferDate: form.transferDate,
    valueDate: form.valueDate,
    transferType: form.transferType,
    transferMode: form.transferMode,
    fromAccountKind: form.fromAccountKind,
    fromBankAccountId: form.fromAccountKind === 'bank' ? form.fromAccountId || null : null,
    fromCashAccountId: form.fromAccountKind === 'cash' ? form.fromAccountId || null : null,
    toAccountKind: form.toAccountKind,
    toBankAccountId: form.toAccountKind === 'bank' ? form.toAccountId || null : null,
    toCashAccountId: form.toAccountKind === 'cash' ? form.toAccountId || null : null,
    amount: Number(form.amount) || 0,
    currency: form.currency,
    charges: Number(form.charges) || 0,
    narration: form.narration,
    reference: form.reference,
  }
}

function validate(form: FormState): string[] {
  const errors: string[] = []
  if (!form.transferDate) errors.push('Transfer date is required.')
  if (!form.valueDate) errors.push('Value date is required.')
  if (!form.fromAccountId) errors.push('From account is required.')
  if (!form.toAccountId) errors.push('To account is required.')
  if (form.fromAccountKind === form.toAccountKind && form.fromAccountId && form.fromAccountId === form.toAccountId) {
    errors.push('From and To accounts cannot be the same.')
  }
  const amount = Number(form.amount)
  if (!amount || amount <= 0) errors.push('Amount must be greater than zero.')
  const basicCombo: Record<string, [AccountKind, AccountKind]> = {
    'Bank to Bank': ['bank', 'bank'],
    'Bank to Cash': ['bank', 'cash'],
    'Cash to Bank': ['cash', 'bank'],
    'Cash to Cash': ['cash', 'cash'],
  }
  const combo = basicCombo[form.transferType]
  if (combo && (combo[0] !== form.fromAccountKind || combo[1] !== form.toAccountKind)) {
    errors.push(`Transfer type "${form.transferType}" requires From/To account kinds to match.`)
  }
  if (!form.narration.trim()) errors.push('Narration is required.')
  const charges = Number(form.charges)
  if (Number.isNaN(charges) || charges < 0) errors.push('Charges cannot be negative.')
  return errors
}

export function FundTransferEditorPage({ mode }: { mode: 'new' | 'detail' }) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const perms = useBankCashPermissions()
  const [workspace, setWorkspace] = useState<Workspace>('information')
  const [form, setForm] = useState<FormState>(() => blankForm())
  const [existing, setExisting] = useState<FundTransfer | null>(null)
  const [lookups, setLookups] = useState<BankCashLookups | null>(null)
  const [loading, setLoading] = useState(mode === 'detail')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [rejectOpen, setRejectOpen] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const firstErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getBankCashLookups().then(setLookups)
  }, [])

  const load = useCallback(async () => {
    if (mode !== 'detail' || !id) return
    setLoading(true)
    try {
      const t = await getFundTransferById(id)
      if (!t) {
        notify.error('Fund transfer not found')
        navigate('/accounting/bank-cash/transfers')
        return
      }
      setExisting(t)
      setForm(fromTransfer(t))
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Failed to load transfer')
      navigate('/accounting/bank-cash/transfers')
    } finally {
      setLoading(false)
    }
  }, [mode, id, navigate])

  useEffect(() => {
    void load()
  }, [load])

  const isDraft = mode === 'new' || existing?.status === 'Draft'
  const readOnly = mode === 'detail' && existing?.status !== 'Draft'

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const fromLabel = form.fromAccountKind === 'bank'
    ? lookups?.bankAccounts.find((b) => b.id === form.fromAccountId)?.label
    : lookups?.cashAccounts.find((c) => c.id === form.fromAccountId)?.label
  const toLabel = form.toAccountKind === 'bank'
    ? lookups?.bankAccounts.find((b) => b.id === form.toAccountId)?.label
    : lookups?.cashAccounts.find((c) => c.id === form.toAccountId)?.label

  const amount = Number(form.amount) || 0
  const charges = Number(form.charges) || 0

  const previewLines = useMemo(
    () => [
      { account: toLabel ?? existing?.toAccountName ?? '—', debit: amount, credit: 0 },
      { account: fromLabel ?? existing?.fromAccountName ?? '—', debit: 0, credit: amount },
      ...(charges > 0
        ? [
            { account: 'Bank Charges (expense)', debit: charges, credit: 0 },
            { account: fromLabel ?? existing?.fromAccountName ?? '—', debit: 0, credit: charges },
          ]
        : []),
    ],
    [toLabel, fromLabel, existing, amount, charges],
  )

  const validateAndFocus = () => {
    const errs = validate(form)
    setErrors(errs)
    if (errs.length) {
      setWorkspace('information')
      setTimeout(() => firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return false
    }
    return true
  }

  const save = async () => {
    if (!validateAndFocus()) return
    setBusy(true)
    try {
      const input = toInput(form)
      if (mode === 'new') {
        const created = await createFundTransfer(input)
        notify.success(`Draft saved — ${created.transferNumber}`)
        navigate(`/accounting/bank-cash/transfers/${created.id}`)
      } else if (id) {
        await updateFundTransfer(id, input)
        notify.success('Transfer draft updated')
        await load()
      }
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const doAction = async (action: () => Promise<FundTransfer>, message: string) => {
    setBusy(true)
    try {
      await action()
      notify.success(message)
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const confirmReject = async () => {
    if (!existing || !rejectReason.trim()) return
    setBusy(true)
    try {
      await rejectFundTransfer(existing.id, rejectReason.trim())
      notify.success(`${existing.transferNumber} rejected`)
      setRejectOpen(false)
      setRejectReason('')
      await load()
    } catch (e) {
      notify.error(e instanceof BankCashServiceError ? e.message : 'Reject failed')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Bank & Cash', to: '/accounting/bank-cash' },
    { label: 'Fund Transfers', to: '/accounting/bank-cash/transfers' },
    { label: mode === 'new' ? 'New transfer' : existing?.transferNumber ?? 'Transfer' },
  ]

  if (mode === 'new' && !perms.canCreateFundTransfer) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="New Fund Transfer" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" description="Missing create fund transfer permission." />
      </OperationalPageShell>
    )
  }

  if (!perms.canViewFundTransfer) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Fund Transfer" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <BankCashEmptyState title="Access denied" description="You cannot view fund transfers." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Fund Transfer" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  const accountOptions = (kind: AccountKind) => (kind === 'bank' ? lookups?.bankAccounts ?? [] : lookups?.cashAccounts ?? [])

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={mode === 'new' ? 'New fund transfer' : `Fund transfer ${existing?.transferNumber ?? ''}`}
      description="Move funds between bank and cash accounts — demo only, no live payment rail is contacted."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath="/accounting/bank-cash/transfers"
      commandBar={(
        <ErpCommandBar
          inline
          sticky
          primaryAction={isDraft && !readOnly ? { id: 'save', label: busy ? 'Saving…' : 'Save draft', icon: Save, onClick: () => void save() } : undefined}
          secondaryActions={[
            { id: 'cancel', label: 'Back', icon: ArrowLeftRight, onClick: () => navigate(mode === 'detail' && id ? `/accounting/bank-cash/transfers/${id}` : '/accounting/bank-cash/transfers') },
            ...(mode === 'detail' && existing?.status === 'Draft' && perms.canSubmitFundTransfer
              ? [{ id: 'submit', label: 'Submit', icon: Send, onClick: () => void doAction(() => submitFundTransfer(existing.id), `${existing.transferNumber} submitted for approval`) }]
              : []),
            ...(mode === 'detail' && existing?.status === 'Pending Approval' && perms.canApproveFundTransfer
              ? [
                  { id: 'approve', label: 'Approve', icon: Check, onClick: () => void doAction(() => approveFundTransfer(existing.id), `${existing.transferNumber} approved`) },
                  { id: 'reject', label: 'Reject', icon: XCircle, onClick: () => setRejectOpen(true) },
                ]
              : []),
            ...(mode === 'detail' && (existing?.status === 'Approved' || existing?.status === 'In Process') && perms.canCompleteFundTransfer
              ? [{ id: 'complete', label: 'Complete', icon: Check, onClick: () => void doAction(() => completeFundTransferDemo(existing.id), `${existing.transferNumber} completed (demo — not posted to a live bank feed).`) }]
              : []),
            ...(mode === 'detail' && existing?.status === 'Completed' && perms.canReverseFundTransfer
              ? [{ id: 'reverse', label: 'Reverse', icon: Ban, onClick: () => void doAction(() => reverseFundTransferDemo(existing.id), `${existing.transferNumber} reversed`) }]
              : []),
          ]}
        />
      )}
    >
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-erp-border bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Transfer No</span>
            <p className="font-semibold">{existing?.transferNumber ?? 'Auto-generated after save'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Amount</span>
            <p className="font-semibold tabular-nums">{amount > 0 ? formatCurrency(amount) : '—'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">From → To</span>
            <p className="font-medium">{(fromLabel ?? existing?.fromAccountName ?? '—')} → {(toLabel ?? existing?.toAccountName ?? '—')}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Status</span>
            <div className="mt-0.5"><FundTransferStatusBadge status={existing?.status ?? 'Draft'} /></div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-erp-border" role="tablist">
        {([
          { id: 'information' as const, label: 'Transfer Information' },
          { id: 'preview' as const, label: 'Accounting Preview' },
        ]).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={workspace === t.id}
            className={cn(
              'rounded-t-md px-3 py-2 text-[12px] font-semibold',
              workspace === t.id ? 'border border-b-white border-erp-border bg-white text-erp-primary' : 'text-erp-muted hover:text-erp-text',
            )}
            onClick={() => setWorkspace(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {errors.length > 0 ? (
        <div ref={firstErrorRef} className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-900">
          <p className="font-semibold">Please fix the following before saving:</p>
          <ul className="mt-1 list-inside list-disc">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded-b-lg border border-t-0 border-erp-border bg-white p-4">
        {workspace === 'information' ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-lg border border-erp-border p-4">
              <h3 className="mb-3 text-[13px] font-semibold">Transfer details</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Transfer date *</label>
                  <Input type="date" disabled={readOnly} value={form.transferDate} onChange={(e) => setField('transferDate', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Value date *</label>
                  <Input type="date" disabled={readOnly} value={form.valueDate} onChange={(e) => setField('valueDate', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Transfer type *</label>
                  <Select disabled={readOnly} value={form.transferType} onChange={(e) => setField('transferType', e.target.value as FundTransferType)}>
                    {FUND_TRANSFER_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Transfer mode *</label>
                  <Select disabled={readOnly} value={form.transferMode} onChange={(e) => setField('transferMode', e.target.value as TransferMode)}>
                    {TRANSFER_MODES.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Amount *</label>
                  <Input type="number" min={0} step="0.01" disabled={readOnly} value={form.amount} onChange={(e) => setField('amount', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Charges</label>
                  <Input type="number" min={0} step="0.01" disabled={readOnly} value={form.charges} onChange={(e) => setField('charges', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Currency</label>
                  <Select disabled={readOnly} value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                    <option value="INR">INR</option>
                    <option value="USD">USD</option>
                    <option value="EUR">EUR</option>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Reference</label>
                  <Input disabled={readOnly} value={form.reference} onChange={(e) => setField('reference', e.target.value)} />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-erp-border p-4">
              <h3 className="mb-3 text-[13px] font-semibold">From / To accounts</h3>
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">From account kind *</label>
                    <Select disabled={readOnly} value={form.fromAccountKind} onChange={(e) => setField('fromAccountKind', e.target.value as AccountKind)}>
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">From account *</label>
                    <Select disabled={readOnly} value={form.fromAccountId} onChange={(e) => setField('fromAccountId', e.target.value)}>
                      <option value="">Select account</option>
                      {accountOptions(form.fromAccountKind).map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">To account kind *</label>
                    <Select disabled={readOnly} value={form.toAccountKind} onChange={(e) => setField('toAccountKind', e.target.value as AccountKind)}>
                      <option value="bank">Bank</option>
                      <option value="cash">Cash</option>
                    </Select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">To account *</label>
                    <Select disabled={readOnly} value={form.toAccountId} onChange={(e) => setField('toAccountId', e.target.value)}>
                      <option value="">Select account</option>
                      {accountOptions(form.toAccountKind).map((a) => (
                        <option key={a.id} value={a.id}>{a.label}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Narration *</label>
                  <Textarea rows={3} disabled={readOnly} value={form.narration} onChange={(e) => setField('narration', e.target.value)} />
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {workspace === 'preview' ? (
          <div className="space-y-3">
            <p className="text-[12px] text-erp-muted">
              Simulated accounting preview — this fund transfer does not post to a live general ledger.
            </p>
            <div className="overflow-x-auto rounded-lg border border-erp-border">
              <table className="erp-table w-full text-[13px]">
                <thead>
                  <tr className="border-b bg-erp-surface-alt/60 text-[11px] uppercase text-erp-muted">
                    <th className="px-3 py-2 text-left">Account</th>
                    <th className="px-3 py-2 text-right">Debit</th>
                    <th className="px-3 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLines.map((line, i) => (
                    <tr key={i} className="border-b border-erp-border/70">
                      <td className="px-3 py-2">{line.account}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.debit > 0 ? formatCurrency(line.debit) : '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{line.credit > 0 ? formatCurrency(line.credit) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-erp-border font-semibold">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(previewLines.reduce((s, l) => s + l.debit, 0))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(previewLines.reduce((s, l) => s + l.credit, 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </div>

      <BankCashConfirmModal
        open={rejectOpen}
        onClose={() => {
          setRejectOpen(false)
          setRejectReason('')
        }}
        title="Reject fund transfer"
        description={`Reject ${existing?.transferNumber}? This cannot be undone.`}
        confirmLabel={busy ? 'Rejecting…' : 'Confirm reject'}
        onConfirm={() => void confirmReject()}
      >
        <textarea
          className="erp-input mt-3 w-full text-[13px]"
          rows={3}
          placeholder="Rejection reason (required)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </BankCashConfirmModal>
    </OperationalPageShell>
  )
}

export function FundTransferNewPage() {
  return <FundTransferEditorPage mode="new" />
}

export function FundTransferDetailPage() {
  return <FundTransferEditorPage mode="detail" />
}
