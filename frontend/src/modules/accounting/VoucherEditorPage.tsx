import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, FileText, Save, Send } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  deriveVoucherWorkspaceTabs,
  VoucherAccountPickerModal,
  VoucherEntriesGrid,
  VoucherPartyPickerModal,
  VoucherStatusBadge,
  VoucherWorkflowStrip,
  VoucherWorkspaceTabs,
  canEditVoucher,
} from '@/components/accounting/vouchers'
import {
  createVoucher,
  getCostCentreOptions,
  getPartyOptions,
  getVoucherById,
  submitVoucher,
  updateVoucher,
  validateVoucherInput,
  VouchersServiceError,
} from '@/services/accounting/vouchersService'
import type {
  AccountingVoucher,
  AccountingVoucherLine,
  VoucherCostCentreOption,
  VoucherDocumentType,
  VoucherFormInput,
  VoucherPartyOption,
  VoucherPaymentMode,
  VoucherWorkspaceId,
} from '@/types/vouchers'
import {
  emptyVoucherLine,
  MANUAL_VOUCHER_TYPES,
  SOURCE_INVOICE_NOTE,
  sumVoucherDebitCredit,
  VOUCHER_DOCUMENT_TYPE_LABELS,
  VOUCHER_PAYMENT_MODE_LABELS,
} from '@/types/vouchers'
import { useVoucherPermissions } from '@/utils/permissions/vouchers'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'
import { cn } from '@/utils/cn'

type FormState = {
  voucherType: VoucherDocumentType
  voucherDate: string
  postingDate: string
  fiscalPeriod: string
  narration: string
  referenceNo: string
  partyType: AccountingVoucher['partyType']
  partyId: string | null
  partyName: string | null
  partyGstin: string | null
  paymentMode: VoucherPaymentMode | null
  bankAccountId: string | null
  bankAccountName: string | null
  chequeNo: string
  chequeDate: string
  transactionRef: string
  fromAccountId: string | null
  fromAccountName: string | null
  toAccountId: string | null
  toAccountName: string | null
  originalInvoiceNo: string
  originalInvoiceDate: string
  reasonCode: string
  openingBalanceAsOf: string
  lines: AccountingVoucherLine[]
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function blankForm(type: VoucherDocumentType = 'journal'): FormState {
  const d = today()
  const lines = [1, 2].map((n) => ({
    ...emptyVoucherLine(),
    id: `tmp-${n}`,
    lineNo: n,
  }))
  return {
    voucherType: type,
    voucherDate: d,
    postingDate: d,
    fiscalPeriod: d.slice(0, 7),
    narration: '',
    referenceNo: '',
    partyType: null,
    partyId: null,
    partyName: null,
    partyGstin: null,
    paymentMode: null,
    bankAccountId: null,
    bankAccountName: null,
    chequeNo: '',
    chequeDate: '',
    transactionRef: '',
    fromAccountId: null,
    fromAccountName: null,
    toAccountId: null,
    toAccountName: null,
    originalInvoiceNo: '',
    originalInvoiceDate: '',
    reasonCode: '',
    openingBalanceAsOf: d,
    lines,
  }
}

function toInput(form: FormState): VoucherFormInput {
  return {
    voucherType: form.voucherType,
    voucherDate: form.voucherDate,
    postingDate: form.postingDate,
    fiscalPeriod: form.fiscalPeriod || form.voucherDate.slice(0, 7),
    narration: form.narration,
    referenceNo: form.referenceNo || undefined,
    partyType: form.partyType,
    partyId: form.partyId,
    partyName: form.partyName,
    partyGstin: form.partyGstin,
    paymentMode: form.paymentMode,
    bankAccountId: form.bankAccountId,
    bankAccountName: form.bankAccountName,
    chequeNo: form.chequeNo,
    chequeDate: form.chequeDate || null,
    transactionRef: form.transactionRef,
    fromAccountId: form.fromAccountId,
    fromAccountName: form.fromAccountName,
    toAccountId: form.toAccountId,
    toAccountName: form.toAccountName,
    originalInvoiceNo: form.originalInvoiceNo,
    originalInvoiceDate: form.originalInvoiceDate || null,
    reasonCode: form.reasonCode,
    openingBalanceAsOf: form.openingBalanceAsOf || null,
    lines: form.lines.map(({ id: _i, lineNo: _n, ...rest }) => rest),
  }
}

function fromVoucher(v: AccountingVoucher): FormState {
  return {
    voucherType: v.voucherType,
    voucherDate: v.voucherDate,
    postingDate: v.postingDate,
    fiscalPeriod: v.fiscalPeriod,
    narration: v.narration,
    referenceNo: v.referenceNo ?? '',
    partyType: v.partyType ?? null,
    partyId: v.partyId ?? null,
    partyName: v.partyName ?? null,
    partyGstin: v.partyGstin ?? null,
    paymentMode: v.paymentMode ?? null,
    bankAccountId: v.bankAccountId ?? null,
    bankAccountName: v.bankAccountName ?? null,
    chequeNo: v.chequeNo ?? '',
    chequeDate: v.chequeDate ?? '',
    transactionRef: v.transactionRef ?? '',
    fromAccountId: v.fromAccountId ?? null,
    fromAccountName: v.fromAccountName ?? null,
    toAccountId: v.toAccountId ?? null,
    toAccountName: v.toAccountName ?? null,
    originalInvoiceNo: v.originalInvoiceNo ?? '',
    originalInvoiceDate: v.originalInvoiceDate ?? '',
    reasonCode: v.reasonCode ?? '',
    openingBalanceAsOf: v.openingBalanceAsOf ?? '',
    lines: v.lines.map((l) => ({ ...l })),
  }
}

export function VoucherEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { voucherId } = useParams<{ voucherId: string }>()
  const navigate = useNavigate()
  const perms = useVoucherPermissions()
  const [workspace, setWorkspace] = useState<VoucherWorkspaceId>('information')
  const [form, setForm] = useState<FormState>(() => blankForm())
  const [existing, setExisting] = useState<AccountingVoucher | null>(null)
  const [loading, setLoading] = useState(mode === 'edit')
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [parties, setParties] = useState<VoucherPartyOption[]>([])
  const [costCentres, setCostCentres] = useState<VoucherCostCentreOption[]>([])
  const [partyPicker, setPartyPicker] = useState(false)
  const [bankPicker, setBankPicker] = useState<'bank' | 'from' | 'to' | null>(null)
  const firstErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void Promise.all([getPartyOptions(), getCostCentreOptions()]).then(([p, c]) => {
      setParties(p)
      setCostCentres(c)
    })
  }, [])

  useEffect(() => {
    if (mode !== 'edit' || !voucherId) return
    setLoading(true)
    void getVoucherById(voucherId)
      .then((v) => {
        if (!v) {
          setExisting(null)
          return
        }
        setExisting(v)
        setForm(fromVoucher(v))
      })
      .finally(() => setLoading(false))
  }, [mode, voucherId])

  const sums = useMemo(() => sumVoucherDebitCredit(form.lines), [form.lines])
  const readOnly = mode === 'edit' && existing ? !canEditVoucher(existing.status) : false

  const infoPending = !form.voucherDate || !form.narration.trim()
  const entryIssues =
    form.lines.length < 2 ||
    form.lines.some((l) => !l.accountId || ((l.debit || 0) <= 0 && (l.credit || 0) <= 0))

  const tabs = deriveVoucherWorkspaceTabs({
    infoStatus: errors.some((e) => /date|narration|party|payment|contra|invoice|opening/i.test(e))
      ? 'validation_error'
      : infoPending
        ? 'fields_pending'
        : 'complete',
    infoDetail: infoPending ? 'Required fields pending' : 'Ready',
    entriesStatus: errors.some((e) => /line|balance|account|debit|credit/i.test(e))
      ? 'validation_error'
      : entryIssues
        ? 'incomplete_lines'
        : sums.isBalanced
          ? 'complete'
          : 'fields_pending',
    entriesDetail: sums.isBalanced ? `${form.lines.length} lines` : `Diff ${formatCurrency(sums.difference)}`,
  })

  const patch = useCallback((p: Partial<FormState>) => setForm((f) => ({ ...f, ...p })), [])

  const focusValidation = (errs: string[]) => {
    setErrors(errs)
    const entryErr = errs.some((e) => /line|balance|account|debit|credit/i.test(e))
    setWorkspace(entryErr ? 'entries' : 'information')
    requestAnimationFrame(() => {
      firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      const el = document.getElementById('voucher-narration') as HTMLTextAreaElement | null
      if (!entryErr) el?.focus()
    })
  }

  const save = async (andSubmit: boolean) => {
    if (mode === 'new' && !perms.canCreate) return notify.error('Missing create permission')
    if (mode === 'edit' && !perms.canEdit) return notify.error('Missing edit permission')
    if (readOnly) return notify.error('This voucher cannot be edited')

    const input = toInput(form)
    const errs = validateVoucherInput(input, { requireBalanced: andSubmit })
    if (errs.length) {
      focusValidation(errs)
      notify.error(errs[0])
      return
    }
    setBusy(true)
    try {
      let id = existing?.id
      if (mode === 'new') {
        const created = await createVoucher(input)
        id = created.id
        notify.success(`Draft ${created.voucherNumber} saved`)
      } else if (id) {
        const updated = await updateVoucher(id, input)
        notify.success(`${updated.voucherNumber} saved`)
      }
      if (andSubmit && id) {
        if (!perms.canSubmit) {
          notify.warning('Saved, but missing submit permission')
          navigate(`/accounting/vouchers/${id}`)
          return
        }
        await submitVoucher(id)
        notify.success('Submitted for approval')
      }
      if (id) navigate(`/accounting/vouchers/${id}`)
    } catch (e) {
      notify.error(e instanceof VouchersServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs =
    mode === 'new'
      ? [
          { label: 'Accounting', to: '/accounting' },
          { label: 'Vouchers', to: '/accounting/vouchers' },
          { label: 'New' },
        ]
      : [
          { label: 'Accounting', to: '/accounting' },
          { label: 'Vouchers', to: '/accounting/vouchers' },
          { label: existing?.voucherNumber ?? 'Edit' },
        ]

  if (loading) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Voucher"
        breadcrumbs={breadcrumbs}
        autoBreadcrumbs={false}
        favoritePath="/accounting/vouchers"
      >
        <LoadingState variant="form" rows={6} />
      </OperationalPageShell>
    )
  }

  if (mode === 'edit' && !existing) {
    return (
      <OperationalPageShell
        variant="dynamics"
        layout="enterprise"
        badge="Accounting"
        title="Voucher not found"
        breadcrumbs={breadcrumbs}
        autoBreadcrumbs={false}
        favoritePath="/accounting/vouchers"
      >
        <EmptyState
          icon={FileText}
          title="Voucher not found"
          description="It may have been deleted in this demo session."
          action={
            <Link to="/accounting/vouchers" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]">
              Back to register
            </Link>
          }
        />
      </OperationalPageShell>
    )
  }

  const showPayment = form.voucherType === 'payment' || form.voucherType === 'receipt'
  const showContra = form.voucherType === 'contra'
  const showNote = form.voucherType === 'debit_note' || form.voucherType === 'credit_note'
  const showOpening = form.voucherType === 'opening_balance'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={mode === 'new' ? 'New Voucher' : existing?.voucherNumber ?? 'Edit Voucher'}
      description={VOUCHER_DOCUMENT_TYPE_LABELS[form.voucherType]}
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath="/accounting/vouchers"
      commandBar={
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={
            !readOnly
              ? {
                  id: 'save',
                  label: busy ? 'Saving…' : 'Save Draft',
                  icon: Save,
                  onClick: () => void save(false),
                  disabled: busy,
                }
              : undefined
          }
          secondaryActions={[
            ...(!readOnly && perms.canSubmit
              ? [
                  {
                    id: 'submit',
                    label: 'Save & Submit',
                    icon: Send,
                    onClick: () => void save(true),
                    disabled: busy,
                  },
                ]
              : []),
            ...(existing
              ? [
                  {
                    id: 'view',
                    label: 'View',
                    onClick: () => navigate(`/accounting/vouchers/${existing.id}`),
                  },
                ]
              : []),
            {
              id: 'cancel',
              label: 'Cancel',
              onClick: () => navigate(existing ? `/accounting/vouchers/${existing.id}` : '/accounting/vouchers'),
            },
          ]}
        />
      }
    >
      <div className="sticky top-0 z-20 -mx-1 mb-3 space-y-2 border-b border-erp-border bg-erp-canvas/95 px-1 py-2 backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          {existing ? <VoucherStatusBadge status={existing.status} /> : <VoucherStatusBadge status="draft" />}
          <span className="text-[12px] text-erp-muted">
            {sums.isBalanced ? 'Balanced' : `Out of balance ${formatCurrency(sums.difference)}`}
          </span>
          <span className="ml-auto text-[12px] tabular-nums text-erp-muted">
            Dr {formatCurrency(sums.totalDebit)} · Cr {formatCurrency(sums.totalCredit)}
          </span>
        </div>
        <VoucherWorkflowStrip status={existing?.status ?? 'draft'} />
      </div>

      {errors.length ? (
        <div
          ref={firstErrorRef}
          className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800"
          role="alert"
        >
          <p className="font-semibold">Fix the following:</p>
          <ul className="mt-1 list-disc pl-5">
            {errors.slice(0, 6).map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <VoucherWorkspaceTabs active={workspace} onChange={setWorkspace} tabs={tabs} />

      <div
        role="tabpanel"
        id={`voucher-workspace-panel-${workspace}`}
        className="rounded-md border border-erp-border bg-erp-surface p-4 shadow-[var(--erp-shadow-card)]"
      >
        {workspace === 'information' ? (
          <div className="space-y-4">
            <p className="rounded-md bg-sky-50 px-3 py-2 text-[12px] text-sky-900 ring-1 ring-sky-200">{SOURCE_INVOICE_NOTE}</p>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <label className="block text-[12px] font-medium">
                Voucher type <span className="text-red-600">*</span>
                <Select
                  className="mt-1"
                  disabled={mode === 'edit' || readOnly}
                  value={form.voucherType}
                  onChange={(e) => patch({ voucherType: e.target.value as VoucherDocumentType })}
                >
                  {MANUAL_VOUCHER_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {VOUCHER_DOCUMENT_TYPE_LABELS[t]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-[12px] font-medium">
                Voucher date <span className="text-red-600">*</span>
                <Input
                  type="date"
                  className="mt-1"
                  disabled={readOnly}
                  value={form.voucherDate}
                  onChange={(e) =>
                    patch({
                      voucherDate: e.target.value,
                      fiscalPeriod: e.target.value.slice(0, 7),
                      postingDate: form.postingDate || e.target.value,
                    })
                  }
                />
              </label>
              <label className="block text-[12px] font-medium">
                Posting date <span className="text-red-600">*</span>
                <Input
                  type="date"
                  className="mt-1"
                  disabled={readOnly}
                  value={form.postingDate}
                  onChange={(e) => patch({ postingDate: e.target.value })}
                />
              </label>
              <label className="block text-[12px] font-medium">
                Fiscal period
                <Input className="mt-1" disabled={readOnly} value={form.fiscalPeriod} onChange={(e) => patch({ fiscalPeriod: e.target.value })} />
              </label>
              <label className="block text-[12px] font-medium sm:col-span-2">
                Reference no
                <Input className="mt-1" disabled={readOnly} value={form.referenceNo} onChange={(e) => patch({ referenceNo: e.target.value })} />
              </label>
            </div>

            <label className="block text-[12px] font-medium">
              Narration <span className="text-red-600">*</span>
              <Textarea
                id="voucher-narration"
                className="mt-1"
                rows={3}
                disabled={readOnly}
                value={form.narration}
                onChange={(e) => patch({ narration: e.target.value })}
              />
            </label>

            {showPayment ? (
              <fieldset className="rounded border border-erp-border p-3">
                <legend className="px-1 text-[12px] font-semibold">Payment details</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-medium">Party *</p>
                    <button
                      type="button"
                      disabled={readOnly}
                      className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-left text-[13px] hover:bg-erp-surface-alt"
                      onClick={() => setPartyPicker(true)}
                    >
                      {form.partyName ?? 'Select party…'}
                    </button>
                  </div>
                  <label className="text-[12px] font-medium">
                    Payment mode *
                    <Select
                      className="mt-1"
                      disabled={readOnly}
                      value={form.paymentMode ?? ''}
                      onChange={(e) => patch({ paymentMode: (e.target.value || null) as VoucherPaymentMode | null })}
                    >
                      <option value="">Select…</option>
                      {Object.entries(VOUCHER_PAYMENT_MODE_LABELS).map(([k, label]) => (
                        <option key={k} value={k}>
                          {label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <div>
                    <p className="text-[12px] font-medium">Bank / cash account</p>
                    <button
                      type="button"
                      disabled={readOnly}
                      className="mt-1 w-full rounded-md border border-erp-border px-3 py-2 text-left text-[13px] hover:bg-erp-surface-alt"
                      onClick={() => setBankPicker('bank')}
                    >
                      {form.bankAccountName ?? 'Select account…'}
                    </button>
                  </div>
                  <label className="text-[12px] font-medium">
                    Transaction ref
                    <Input className="mt-1" disabled={readOnly} value={form.transactionRef} onChange={(e) => patch({ transactionRef: e.target.value })} />
                  </label>
                  {form.paymentMode === 'cheque' ? (
                    <>
                      <label className="text-[12px] font-medium">
                        Cheque no *
                        <Input className="mt-1" disabled={readOnly} value={form.chequeNo} onChange={(e) => patch({ chequeNo: e.target.value })} />
                      </label>
                      <label className="text-[12px] font-medium">
                        Cheque date
                        <Input type="date" className="mt-1" disabled={readOnly} value={form.chequeDate} onChange={(e) => patch({ chequeDate: e.target.value })} />
                      </label>
                    </>
                  ) : null}
                </div>
              </fieldset>
            ) : null}

            {showContra ? (
              <fieldset className="rounded border border-erp-border p-3">
                <legend className="px-1 text-[12px] font-semibold">Contra transfer</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-medium">From account *</p>
                    <button type="button" disabled={readOnly} className="mt-1 w-full rounded-md border px-3 py-2 text-left text-[13px]" onClick={() => setBankPicker('from')}>
                      {form.fromAccountName ?? 'Select…'}
                    </button>
                  </div>
                  <div>
                    <p className="text-[12px] font-medium">To account *</p>
                    <button type="button" disabled={readOnly} className="mt-1 w-full rounded-md border px-3 py-2 text-left text-[13px]" onClick={() => setBankPicker('to')}>
                      {form.toAccountName ?? 'Select…'}
                    </button>
                  </div>
                </div>
              </fieldset>
            ) : null}

            {showNote ? (
              <fieldset className="rounded border border-erp-border p-3">
                <legend className="px-1 text-[12px] font-semibold">Note details</legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-[12px] font-medium">Party *</p>
                    <button type="button" disabled={readOnly} className="mt-1 w-full rounded-md border px-3 py-2 text-left text-[13px]" onClick={() => setPartyPicker(true)}>
                      {form.partyName ?? 'Select party…'}
                    </button>
                  </div>
                  <label className="text-[12px] font-medium">
                    Original invoice *
                    <Input className="mt-1" disabled={readOnly} value={form.originalInvoiceNo} onChange={(e) => patch({ originalInvoiceNo: e.target.value })} />
                  </label>
                  <label className="text-[12px] font-medium">
                    Invoice date
                    <Input type="date" className="mt-1" disabled={readOnly} value={form.originalInvoiceDate} onChange={(e) => patch({ originalInvoiceDate: e.target.value })} />
                  </label>
                  <label className="text-[12px] font-medium">
                    Reason
                    <Input className="mt-1" disabled={readOnly} value={form.reasonCode} onChange={(e) => patch({ reasonCode: e.target.value })} />
                  </label>
                </div>
              </fieldset>
            ) : null}

            {showOpening ? (
              <label className="block text-[12px] font-medium">
                Opening balance as of *
                <Input type="date" className="mt-1" disabled={readOnly} value={form.openingBalanceAsOf} onChange={(e) => patch({ openingBalanceAsOf: e.target.value })} />
              </label>
            ) : null}

            {!readOnly ? (
              <div className="flex justify-end">
                <button
                  type="button"
                  className="erp-btn erp-btn-primary inline-flex h-9 items-center gap-1 px-3 text-[13px]"
                  onClick={() => setWorkspace('entries')}
                >
                  Continue to entries
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <VoucherEntriesGrid
            lines={form.lines}
            onChange={(lines) => patch({ lines })}
            readOnly={readOnly}
            costCentres={costCentres}
          />
        )}
      </div>

      <div
        className={cn(
          'sticky bottom-0 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-erp-border bg-erp-surface px-3 py-2 shadow-[var(--erp-shadow-card)]',
        )}
      >
        <span className="text-[12px] tabular-nums text-erp-muted">
          Dr {formatCurrency(sums.totalDebit)} · Cr {formatCurrency(sums.totalCredit)} · Diff {formatCurrency(sums.difference)}
        </span>
        {!readOnly ? (
          <div className="flex gap-2">
            <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" disabled={busy} onClick={() => void save(false)}>
              Save Draft
            </button>
            {perms.canSubmit ? (
              <button type="button" className="erp-btn erp-btn-primary h-9 px-3 text-[13px]" disabled={busy} onClick={() => void save(true)}>
                Save & Submit
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <VoucherPartyPickerModal
        open={partyPicker}
        onClose={() => setPartyPicker(false)}
        parties={parties}
        onSelect={(p) =>
          patch({
            partyId: p.id,
            partyName: p.name,
            partyType: p.type,
            partyGstin: p.gstin ?? null,
          })
        }
      />
      <VoucherAccountPickerModal
        open={bankPicker != null}
        onClose={() => setBankPicker(null)}
        onSelect={(a) => {
          if (bankPicker === 'bank') patch({ bankAccountId: a.id, bankAccountName: a.name })
          if (bankPicker === 'from') patch({ fromAccountId: a.id, fromAccountName: a.name })
          if (bankPicker === 'to') patch({ toAccountId: a.id, toAccountName: a.name })
        }}
      />
    </OperationalPageShell>
  )
}

export function VoucherNewPage() {
  return <VoucherEditorPage mode="new" />
}

export function VoucherEditPage() {
  return <VoucherEditorPage mode="edit" />
}
