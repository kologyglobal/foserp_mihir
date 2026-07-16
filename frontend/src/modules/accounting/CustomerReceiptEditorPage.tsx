import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, Save, ShieldOff, Wand2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  AllocationStatusBadge,
  AutoAllocationPreview,
  ReceiptAllocationGrid,
  ReceiptAllocationSummary,
  ReceiptStatusBadge,
  deriveReceiptWorkspaceTabs,
  ReceiptWorkspaceTabs,
  type AllocationMap,
  type ReceiptWorkspaceId,
} from '@/components/accounting/receivables'
import {
  createCustomerReceipt,
  getCustomerReceiptById,
  getOpenInvoicesForAllocation,
  getReceivableLookups,
  getReceiptAllocationPreviewByMethod,
  updateCustomerReceipt,
  validateReceiptDraft,
  ReceivablesServiceError,
} from '@/services/accounting/receivablesService'
import type { CustomerReceipt, ReceiptDraftInput, ReceivableInvoice } from '@/types/receivables'
import {
  ELECTRONIC_PAYMENT_MODES,
  RECEIPT_PAYMENT_MODES,
  type ReceiptPaymentMode,
} from '@/types/receivables'
import { useReceivablesPermissions } from '@/utils/permissions/receivables'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

function today() {
  return new Date().toISOString().slice(0, 10)
}

type FormState = {
  receiptDate: string
  postingDate: string
  customerId: string
  customerBankReference: string
  paymentMode: ReceiptPaymentMode
  bankOrCashAccountId: string
  transactionReference: string
  chequeNumber: string
  chequeDate: string
  bankName: string
  currency: string
  exchangeRate: string
  receiptAmount: string
  tdsDeducted: string
  bankCharges: string
  narration: string
  internalRemarks: string
}

function blankForm(): FormState {
  const d = today()
  return {
    receiptDate: d,
    postingDate: d,
    customerId: '',
    customerBankReference: '',
    paymentMode: 'NEFT',
    bankOrCashAccountId: '',
    transactionReference: '',
    chequeNumber: '',
    chequeDate: '',
    bankName: '',
    currency: 'INR',
    exchangeRate: '1',
    receiptAmount: '',
    tdsDeducted: '0',
    bankCharges: '0',
    narration: '',
    internalRemarks: '',
  }
}

function fromReceipt(r: CustomerReceipt): FormState {
  return {
    receiptDate: r.receiptDate,
    postingDate: r.postingDate,
    customerId: r.customerId,
    customerBankReference: r.customerBankReference ?? '',
    paymentMode: r.paymentMode,
    bankOrCashAccountId: r.bankOrCashAccountId,
    transactionReference: r.transactionReference ?? '',
    chequeNumber: r.chequeNumber ?? '',
    chequeDate: r.chequeDate ?? '',
    bankName: r.bankName ?? '',
    currency: r.currency,
    exchangeRate: String(r.exchangeRate),
    receiptAmount: String(r.receiptAmount),
    tdsDeducted: String(r.tdsDeducted),
    bankCharges: String(r.bankCharges),
    narration: r.narration,
    internalRemarks: r.internalRemarks,
  }
}

function toInput(form: FormState, allocations: AllocationMap): ReceiptDraftInput {
  return {
    receiptDate: form.receiptDate,
    postingDate: form.postingDate,
    customerId: form.customerId,
    customerBankReference: form.customerBankReference || null,
    paymentMode: form.paymentMode,
    bankOrCashAccountId: form.bankOrCashAccountId,
    transactionReference: form.transactionReference || null,
    chequeNumber: form.chequeNumber || null,
    chequeDate: form.chequeDate || null,
    bankName: form.bankName || null,
    currency: form.currency,
    exchangeRate: Number(form.exchangeRate) || 1,
    receiptAmount: Number(form.receiptAmount) || 0,
    tdsDeducted: Number(form.tdsDeducted) || 0,
    bankCharges: Number(form.bankCharges) || 0,
    narration: form.narration,
    internalRemarks: form.internalRemarks,
    allocationLines: Object.entries(allocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, allocationAmount]) => ({ invoiceId, allocationAmount })),
  }
}

export function CustomerReceiptEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { receiptId } = useParams<{ receiptId: string }>()
  const navigate = useNavigate()
  const perms = useReceivablesPermissions()
  const [workspace, setWorkspace] = useState<ReceiptWorkspaceId>('information')
  const [form, setForm] = useState<FormState>(() => blankForm())
  const [existing, setExisting] = useState<CustomerReceipt | null>(null)
  const [lookups, setLookups] = useState<Awaited<ReturnType<typeof getReceivableLookups>> | null>(null)
  const [invoices, setInvoices] = useState<ReceivableInvoice[]>([])
  const [allocations, setAllocations] = useState<AllocationMap>({})
  const [allocSearch, setAllocSearch] = useState('')
  const [loading, setLoading] = useState(mode === 'edit')
  const [busy, setBusy] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const [infoErrors, setInfoErrors] = useState<string[]>([])
  const [allocationErrors, setAllocationErrors] = useState<string[]>([])
  const firstErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getReceivableLookups().then(setLookups)
  }, [])

  const loadReceipt = useCallback(async () => {
    if (mode !== 'edit' || !receiptId) return
    setLoading(true)
    try {
      const r = await getCustomerReceiptById(receiptId)
      if (r.voucherStatus !== 'Draft') {
        notify.error('Only draft receipts can be edited')
        navigate(`/accounting/receivables/receipts/${receiptId}`)
        return
      }
      setExisting(r)
      setForm(fromReceipt(r))
      const map: AllocationMap = {}
      for (const l of r.allocationLines) map[l.invoiceId] = l.allocationAmount
      setAllocations(map)
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Receipt not found')
      navigate('/accounting/receivables/receipts')
    } finally {
      setLoading(false)
    }
  }, [mode, receiptId, navigate])

  useEffect(() => {
    void loadReceipt()
  }, [loadReceipt])

  useEffect(() => {
    if (!form.customerId) {
      setInvoices([])
      return
    }
    void getOpenInvoicesForAllocation(form.customerId).then(setInvoices)
  }, [form.customerId])

  const receiptAmount = Number(form.receiptAmount) || 0
  const tds = Number(form.tdsDeducted) || 0
  const charges = Number(form.bankCharges) || 0
  const available = Math.max(0, receiptAmount - tds - charges)
  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (v || 0), 0)
  const unallocated = Math.max(0, available - allocatedTotal)
  const allocationStatus =
    allocatedTotal <= 0 ? 'Unallocated' : unallocated <= 0.01 ? 'Fully Allocated' : 'Partially Allocated'

  const customerName = lookups?.customers.find((c) => c.id === form.customerId)?.name ?? existing?.customerName ?? '—'

  const workspaceTabs = useMemo(
    () =>
      deriveReceiptWorkspaceTabs({
        infoStatus: infoErrors.length ? 'validation_error' : 'complete',
        infoDetail: infoErrors.length ? `${infoErrors.length} issue(s)` : 'Ready',
        allocationStatus: allocationErrors.length ? 'validation_error' : allocatedTotal > 0 ? 'complete' : 'fields_pending',
        allocationDetail:
          allocationErrors.length > 0
            ? `${allocationErrors.length} issue(s)`
            : allocatedTotal > 0
              ? formatCurrency(allocatedTotal)
              : 'Not allocated',
      }),
    [infoErrors.length, allocationErrors.length, allocatedTotal],
  )

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
  }

  const validateAndFocus = () => {
    const { infoErrors: ie, allocationErrors: ae } = validateReceiptDraft(toInput(form, allocations))
    setInfoErrors(ie)
    setAllocationErrors(ae)
    if (ie.length) {
      setWorkspace('information')
      setTimeout(() => firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return false
    }
    if (ae.length) {
      setWorkspace('allocation')
      setTimeout(() => firstErrorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
      return false
    }
    return true
  }

  const save = async () => {
    if (!validateAndFocus()) return
    setBusy(true)
    try {
      const input = toInput(form, allocations)
      if (mode === 'new') {
        const created = await createCustomerReceipt(input)
        notify.success(`Draft saved — ${created.receiptNumber}`)
        navigate(`/accounting/receivables/receipts/${created.id}/edit`)
      } else if (receiptId) {
        await updateCustomerReceipt(receiptId, input)
        notify.success('Receipt draft updated')
        await loadReceipt()
      }
    } catch (e) {
      notify.error(e instanceof ReceivablesServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const allocateOldest = async () => {
    if (!form.customerId || available <= 0) return
    const preview = await getReceiptAllocationPreviewByMethod(form.customerId, available, 'Oldest Due First')
    const map: AllocationMap = {}
    for (const l of preview.proposedLines) map[l.invoiceId] = l.allocationAmount
    setAllocations(map)
    notify.success('Allocated to oldest due invoices')
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Receivables', to: '/accounting/receivables' },
    { label: 'Receipts', to: '/accounting/receivables/receipts' },
    { label: mode === 'new' ? 'New receipt' : existing?.receiptNumber ?? 'Edit' },
  ]

  if (!perms.canCreateReceipt && mode === 'new') {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="New receipt" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing create receipt permission." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Receipt" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  const isCheque = form.paymentMode === 'Cheque'
  const isElectronic = ELECTRONIC_PAYMENT_MODES.includes(form.paymentMode)
  const isForeign = form.currency !== 'INR'

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={mode === 'new' ? 'Record customer receipt' : `Edit ${existing?.receiptNumber ?? 'receipt'}`}
      description="Capture payment details and allocate to open invoices — demo only."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath="/accounting/receivables/receipts"
      commandBar={
        <ErpCommandBar
          inline
          sticky
          primaryAction={{ id: 'save', label: busy ? 'Saving…' : 'Save draft', icon: Save, onClick: () => void save() }}
          secondaryActions={[
            {
              id: 'cancel',
              label: 'Cancel',
              onClick: () => navigate(mode === 'edit' && receiptId ? `/accounting/receivables/receipts/${receiptId}` : '/accounting/receivables/receipts'),
            },
          ]}
        />
      }
    >
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-erp-border bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Receipt</span>
            <p className="font-semibold">{existing?.receiptNumber ?? 'Auto-generated after save'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Customer</span>
            <p className="font-medium">{customerName}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Receipt date</span>
            <p className="tabular-nums">{form.receiptDate}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Amount</span>
            <p className="font-semibold tabular-nums">{receiptAmount > 0 ? formatCurrency(receiptAmount) : '—'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Allocation</span>
            <div className="mt-0.5">
              <AllocationStatusBadge status={allocationStatus} />
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Voucher</span>
            <div className="mt-0.5">
              <ReceiptStatusBadge status={existing?.voucherStatus ?? 'Draft'} />
            </div>
          </div>
        </div>
      </div>

      <ReceiptWorkspaceTabs active={workspace} onChange={setWorkspace} tabs={workspaceTabs} />

      {(infoErrors.length > 0 || allocationErrors.length > 0) && (
        <div ref={firstErrorRef} className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-900">
          <p className="font-semibold">Please fix the following before saving:</p>
          {infoErrors.length > 0 ? (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase">Receipt Information</p>
              <ul className="mt-1 list-inside list-disc">
                {infoErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {allocationErrors.length > 0 ? (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase">Invoice Allocation</p>
              <ul className="mt-1 list-inside list-disc">
                {allocationErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}

      {workspace === 'information' ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="rounded-lg border border-erp-border p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Receipt details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Customer *</label>
                <Select value={form.customerId} onChange={(e) => setField('customerId', e.target.value)}>
                  <option value="">Select customer</option>
                  {lookups?.customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code} — {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Receipt date *</label>
                <Input type="date" value={form.receiptDate} onChange={(e) => setField('receiptDate', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Posting date *</label>
                <Input type="date" value={form.postingDate} onChange={(e) => setField('postingDate', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Payment mode *</label>
                <Select value={form.paymentMode} onChange={(e) => setField('paymentMode', e.target.value as ReceiptPaymentMode)}>
                  {RECEIPT_PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank / Cash account *</label>
                <Select value={form.bankOrCashAccountId} onChange={(e) => setField('bankOrCashAccountId', e.target.value)}>
                  <option value="">Select account</option>
                  {lookups?.bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Receipt amount *</label>
                <Input type="number" min={0} step="0.01" value={form.receiptAmount} onChange={(e) => setField('receiptAmount', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">TDS deducted</label>
                <Input type="number" min={0} step="0.01" value={form.tdsDeducted} onChange={(e) => setField('tdsDeducted', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank charges</label>
                <Input type="number" min={0} step="0.01" value={form.bankCharges} onChange={(e) => setField('bankCharges', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Currency</label>
                <Select value={form.currency} onChange={(e) => setField('currency', e.target.value)}>
                  <option value="INR">INR</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </Select>
              </div>
              {isForeign ? (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Exchange rate *</label>
                  <Input type="number" min={0} step="0.0001" value={form.exchangeRate} onChange={(e) => setField('exchangeRate', e.target.value)} />
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Customer bank reference</label>
                <Input value={form.customerBankReference} onChange={(e) => setField('customerBankReference', e.target.value)} />
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-erp-border p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Payment reference</h3>
            <div className="grid gap-3">
              {isElectronic ? (
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Transaction reference *</label>
                  <Input value={form.transactionReference} onChange={(e) => setField('transactionReference', e.target.value)} />
                </div>
              ) : null}
              {isCheque ? (
                <>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cheque number *</label>
                    <Input value={form.chequeNumber} onChange={(e) => setField('chequeNumber', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Cheque date *</label>
                    <Input type="date" value={form.chequeDate} onChange={(e) => setField('chequeDate', e.target.value)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank name *</label>
                    <Input value={form.bankName} onChange={(e) => setField('bankName', e.target.value)} />
                  </div>
                </>
              ) : null}
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Narration</label>
                <Textarea rows={3} value={form.narration} onChange={(e) => setField('narration', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Internal remarks</label>
                <Textarea rows={2} value={form.internalRemarks} onChange={(e) => setField('internalRemarks', e.target.value)} />
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {workspace === 'allocation' ? (
        <div className="mt-4 space-y-4">
          {!form.customerId ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              Select a customer on Receipt Information before allocating invoices.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold">{customerName}</h3>
                  <p className="text-[12px] text-erp-muted">{invoices.length} open invoice(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
                    disabled={available <= 0}
                    onClick={() => setAutoOpen(true)}
                  >
                    <Wand2 className="mr-1 inline h-3.5 w-3.5" />
                    Auto allocate
                  </button>
                  <button
                    type="button"
                    className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
                    disabled={available <= 0}
                    onClick={() => void allocateOldest()}
                  >
                    Allocate oldest first
                  </button>
                  <button type="button" className="erp-btn erp-btn-ghost h-8 px-3 text-[12px]" onClick={() => setAllocations({})}>
                    Clear
                  </button>
                </div>
              </div>
              <SearchInput value={allocSearch} onChange={setAllocSearch} placeholder="Search invoices…" />
              <ReceiptAllocationSummary
                receiptAmount={receiptAmount}
                tdsDeducted={tds}
                bankCharges={charges}
                availableAmount={available}
                allocatedAmount={allocatedTotal}
                unallocatedAmount={unallocated}
                allocationStatus={allocationStatus}
              />
              <ReceiptAllocationGrid
                invoices={invoices}
                allocations={allocations}
                availableAmount={available}
                search={allocSearch}
                onChange={(id, amt) => setAllocations((m) => ({ ...m, [id]: amt }))}
              />
            </>
          )}
          <button
            type="button"
            className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]"
            onClick={() => setWorkspace('information')}
          >
            <ArrowRight className="mr-1 inline h-4 w-4 rotate-180" />
            Back to receipt information
          </button>
        </div>
      ) : null}

      {workspace === 'information' ? (
        <div className="mt-4 flex justify-end">
          <button type="button" className="erp-btn erp-btn-secondary h-9 px-3 text-[13px]" onClick={() => setWorkspace('allocation')}>
            Continue to allocation
            <ArrowRight className="ml-1 inline h-4 w-4" />
          </button>
        </div>
      ) : null}

      <AutoAllocationPreview
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        customerId={form.customerId}
        availableAmount={available}
        onApply={(lines) => {
          const map: AllocationMap = {}
          for (const l of lines) map[l.invoiceId] = l.allocationAmount
          setAllocations(map)
        }}
      />
    </OperationalPageShell>
  )
}

export function CustomerReceiptNewPage() {
  return <CustomerReceiptEditorPage mode="new" />
}

export function CustomerReceiptEditPage() {
  return <CustomerReceiptEditorPage mode="edit" />
}
