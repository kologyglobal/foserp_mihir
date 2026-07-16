import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight, FileText, ListTree, Save, ShieldOff, Wand2 } from 'lucide-react'
import { OperationalPageShell } from '@/components/design-system/OperationalPageShell'
import { ErpCommandBar } from '@/components/erp/ErpCommandBar'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SearchInput } from '@/components/ui/SearchInput'
import { LoadingState } from '@/design-system/components/LoadingState'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  AutoAllocationPreviewModal,
  PaymentAllocationGrid,
  PaymentAllocationSummary,
  PaymentAllocationStatusBadge,
  VendorPaymentStatusBadge,
  type PaymentAllocationMap,
} from '@/components/accounting/payables'
import {
  PurchaseDocumentWorkspaceTabs,
  type DocumentWorkspaceTabModel,
  type DocumentWorkspaceTabStatus,
} from '@/components/purchase/PurchaseDocumentWorkspaceTabs'
import {
  createVendorPayment,
  getPayableInvoices,
  getPayableLookups,
  getVendorPaymentById,
  updateVendorPayment,
  PayablesServiceError,
} from '@/services/accounting/payablesService'
import type { PayableInvoice, VendorPayment, VendorPaymentDraftInput, VendorPaymentMode } from '@/types/payables'
import { ELECTRONIC_VENDOR_PAYMENT_MODES, VENDOR_PAYMENT_MODES } from '@/types/payables'
import { usePayablesPermissions } from '@/utils/permissions/payables'
import { formatCurrency } from '@/utils/formatters/currency'
import { notify } from '@/store/toastStore'

type PaymentWorkspaceId = 'information' | 'allocation'

function today() {
  return new Date().toISOString().slice(0, 10)
}

type FormState = {
  paymentDate: string
  postingDate: string
  vendorId: string
  paymentMode: VendorPaymentMode
  bankAccountId: string
  transactionReference: string
  chequeNumber: string
  chequeDate: string
  amount: string
  tdsDeducted: string
  otherDeductions: string
  bankCharges: string
  currency: string
  exchangeRate: string
  tdsSection: string
  tdsRate: string
  tdsBaseAmount: string
  narration: string
  internalRemarks: string
}

function blankForm(): FormState {
  const d = today()
  return {
    paymentDate: d,
    postingDate: d,
    vendorId: '',
    paymentMode: 'NEFT',
    bankAccountId: '',
    transactionReference: '',
    chequeNumber: '',
    chequeDate: '',
    amount: '',
    tdsDeducted: '0',
    otherDeductions: '0',
    bankCharges: '0',
    currency: 'INR',
    exchangeRate: '1',
    tdsSection: '',
    tdsRate: '',
    tdsBaseAmount: '',
    narration: '',
    internalRemarks: '',
  }
}

function fromPayment(p: VendorPayment): FormState {
  return {
    paymentDate: p.paymentDate,
    postingDate: p.postingDate,
    vendorId: p.vendorId,
    paymentMode: p.paymentMode,
    bankAccountId: p.bankAccountId,
    transactionReference: p.transactionReference ?? '',
    chequeNumber: p.chequeNumber ?? '',
    chequeDate: p.chequeDate ?? '',
    amount: String(p.amount),
    tdsDeducted: String(p.tdsDeducted),
    otherDeductions: String(p.otherDeductions),
    bankCharges: String(p.bankCharges),
    currency: p.currency,
    exchangeRate: String(p.exchangeRate),
    tdsSection: p.tdsSection ?? '',
    tdsRate: p.tdsRate != null ? String(p.tdsRate) : '',
    tdsBaseAmount: p.tdsBaseAmount != null ? String(p.tdsBaseAmount) : '',
    narration: p.narration,
    internalRemarks: p.internalRemarks,
  }
}

function toInput(form: FormState, allocations: PaymentAllocationMap): VendorPaymentDraftInput {
  return {
    paymentDate: form.paymentDate,
    postingDate: form.postingDate,
    vendorId: form.vendorId,
    paymentMode: form.paymentMode,
    bankAccountId: form.bankAccountId,
    transactionReference: form.transactionReference || null,
    chequeNumber: form.chequeNumber || null,
    chequeDate: form.chequeDate || null,
    amount: Number(form.amount) || 0,
    tdsDeducted: Number(form.tdsDeducted) || 0,
    otherDeductions: Number(form.otherDeductions) || 0,
    bankCharges: Number(form.bankCharges) || 0,
    currency: form.currency,
    exchangeRate: Number(form.exchangeRate) || 1,
    tdsSection: form.tdsSection || null,
    tdsRate: form.tdsRate ? Number(form.tdsRate) : null,
    tdsBaseAmount: form.tdsBaseAmount ? Number(form.tdsBaseAmount) : null,
    narration: form.narration,
    internalRemarks: form.internalRemarks,
    allocationLines: Object.entries(allocations)
      .filter(([, amt]) => amt > 0)
      .map(([invoiceId, allocationAmount]) => ({ invoiceId, allocationAmount })),
  }
}

function validatePaymentDraft(input: VendorPaymentDraftInput): { infoErrors: string[]; allocationErrors: string[] } {
  const infoErrors: string[] = []
  const allocationErrors: string[] = []
  if (!input.vendorId) infoErrors.push('Vendor is required')
  if (!input.paymentDate) infoErrors.push('Payment date is required')
  if (!input.postingDate) infoErrors.push('Posting date is required')
  if (!input.paymentMode) infoErrors.push('Payment mode is required')
  if (!input.bankAccountId) infoErrors.push('Bank account is required')
  if (!(input.amount > 0)) infoErrors.push('Payment amount must be greater than zero')
  if (ELECTRONIC_VENDOR_PAYMENT_MODES.includes(input.paymentMode) && !input.transactionReference?.trim()) {
    infoErrors.push('Transaction reference is required for electronic payment modes')
  }
  if (input.paymentMode === 'Cheque') {
    if (!input.chequeNumber?.trim()) infoErrors.push('Cheque number is required')
    if (!input.chequeDate) infoErrors.push('Cheque date is required')
  }
  const allocated = (input.allocationLines ?? []).reduce((s, l) => s + l.allocationAmount, 0)
  if (allocated > input.amount + 0.01) {
    allocationErrors.push('Total allocation exceeds payment amount')
  }
  return { infoErrors, allocationErrors }
}

function derivePaymentWorkspaceTabs(opts: {
  infoStatus: DocumentWorkspaceTabStatus
  infoDetail: string
  allocationStatus: DocumentWorkspaceTabStatus
  allocationDetail: string
}): DocumentWorkspaceTabModel<PaymentWorkspaceId>[] {
  return [
    {
      id: 'information',
      label: 'Payment Information',
      icon: FileText as LucideIcon,
      status: opts.infoStatus,
      statusDetail: opts.infoDetail,
    },
    {
      id: 'allocation',
      label: 'Invoice Allocation',
      icon: ListTree as LucideIcon,
      status: opts.allocationStatus,
      statusDetail: opts.allocationDetail,
    },
  ]
}

export function VendorPaymentEditorPage({ mode }: { mode: 'new' | 'edit' }) {
  const { paymentId } = useParams<{ paymentId: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = usePayablesPermissions()
  const [workspace, setWorkspace] = useState<PaymentWorkspaceId>(() =>
    searchParams.get('workspace') === 'allocation' ? 'allocation' : 'information',
  )
  const [form, setForm] = useState<FormState>(() => blankForm())
  const [existing, setExisting] = useState<VendorPayment | null>(null)
  const [lookups, setLookups] = useState<Awaited<ReturnType<typeof getPayableLookups>> | null>(null)
  const [invoices, setInvoices] = useState<PayableInvoice[]>([])
  const [allocations, setAllocations] = useState<PaymentAllocationMap>({})
  const [allocSearch, setAllocSearch] = useState('')
  const [loading, setLoading] = useState(mode === 'edit')
  const [busy, setBusy] = useState(false)
  const [autoOpen, setAutoOpen] = useState(false)
  const [infoErrors, setInfoErrors] = useState<string[]>([])
  const [allocationErrors, setAllocationErrors] = useState<string[]>([])
  const firstErrorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void getPayableLookups().then(setLookups)
  }, [])

  const loadPayment = useCallback(async () => {
    if (mode !== 'edit' || !paymentId) return
    setLoading(true)
    try {
      const p = await getVendorPaymentById(paymentId)
      if (p.status !== 'Draft') {
        notify.error('Only draft payments can be edited')
        navigate(`/accounting/payables/payments/${paymentId}`)
        return
      }
      setExisting(p)
      setForm(fromPayment(p))
      const map: PaymentAllocationMap = {}
      for (const l of p.allocationLines) map[l.invoiceId] = l.allocationAmount
      setAllocations(map)
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Payment not found')
      navigate('/accounting/payables/payments')
    } finally {
      setLoading(false)
    }
  }, [mode, paymentId, navigate])

  useEffect(() => {
    void loadPayment()
  }, [loadPayment])

  useEffect(() => {
    if (!form.vendorId) {
      setInvoices([])
      return
    }
    void getPayableInvoices({ vendorId: form.vendorId }).then((list) =>
      setInvoices(list.filter((i) => i.outstandingBalance > 0 && i.status !== 'Cancelled')),
    )
  }, [form.vendorId])

  const paymentAmount = Number(form.amount) || 0
  const tds = Number(form.tdsDeducted) || 0
  const allocatedTotal = Object.values(allocations).reduce((s, v) => s + (v || 0), 0)
  const unallocated = Math.max(0, paymentAmount - allocatedTotal)
  const allocationStatus =
    allocatedTotal <= 0 ? 'Unallocated' : unallocated <= 0.01 ? 'Fully Allocated' : 'Partially Allocated'

  const vendorName = lookups?.vendors.find((v) => v.id === form.vendorId)?.name ?? existing?.vendorName ?? '—'

  const workspaceTabs = useMemo(
    () =>
      derivePaymentWorkspaceTabs({
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
    const { infoErrors: ie, allocationErrors: ae } = validatePaymentDraft(toInput(form, allocations))
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
        const created = await createVendorPayment(input)
        notify.success(`Draft saved — ${created.paymentNumber}`)
        navigate(`/accounting/payables/payments/${created.id}/edit`)
      } else if (paymentId) {
        await updateVendorPayment(paymentId, input)
        notify.success('Payment draft updated')
        await loadPayment()
      }
    } catch (e) {
      notify.error(e instanceof PayablesServiceError ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  const breadcrumbs = [
    { label: 'Accounting', to: '/accounting' },
    { label: 'Payables', to: '/accounting/payables' },
    { label: 'Payments', to: '/accounting/payables/payments' },
    { label: mode === 'new' ? 'New payment' : existing?.paymentNumber ?? 'Edit' },
  ]

  if (!perms.canCreatePayment && mode === 'new') {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="New payment" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <EmptyState icon={ShieldOff} title="Access denied" description="Missing create payment permission." />
      </OperationalPageShell>
    )
  }

  if (loading) {
    return (
      <OperationalPageShell variant="dynamics" layout="enterprise" badge="Accounting" title="Payment" breadcrumbs={breadcrumbs} autoBreadcrumbs={false}>
        <LoadingState variant="form" rows={8} />
      </OperationalPageShell>
    )
  }

  const isCheque = form.paymentMode === 'Cheque'
  const isElectronic = ELECTRONIC_VENDOR_PAYMENT_MODES.includes(form.paymentMode)
  const isForeign = form.currency !== 'INR'
  const showTds = perms.canViewTds

  return (
    <OperationalPageShell
      variant="dynamics"
      layout="enterprise"
      badge="Accounting"
      title={mode === 'new' ? 'Record vendor payment' : `Edit ${existing?.paymentNumber ?? 'payment'}`}
      description="Capture disbursement details and allocate to open invoices — demo only. No bank payment is triggered."
      breadcrumbs={breadcrumbs}
      autoBreadcrumbs={false}
      favoritePath="/accounting/payables/payments"
      commandBar={
        <ErpCommandBar
          inline
          sticky
          primaryAction={{ id: 'save', label: busy ? 'Saving…' : 'Save draft', icon: Save, onClick: () => void save() }}
          secondaryActions={[
            {
              id: 'cancel',
              label: 'Cancel',
              onClick: () =>
                navigate(mode === 'edit' && paymentId ? `/accounting/payables/payments/${paymentId}` : '/accounting/payables/payments'),
            },
          ]}
        />
      }
    >
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-erp-border bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Payment</span>
            <p className="font-semibold">{existing?.paymentNumber ?? 'Auto-generated after save'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Vendor</span>
            <p className="font-medium">{vendorName}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Payment date</span>
            <p className="tabular-nums">{form.paymentDate}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Amount</span>
            <p className="font-semibold tabular-nums">{paymentAmount > 0 ? formatCurrency(paymentAmount) : '—'}</p>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Allocation</span>
            <div className="mt-0.5">
              <PaymentAllocationStatusBadge status={allocationStatus} />
            </div>
          </div>
          <div>
            <span className="text-[11px] font-semibold uppercase text-erp-muted">Status</span>
            <div className="mt-0.5">
              <VendorPaymentStatusBadge status={existing?.status ?? 'Draft'} />
            </div>
          </div>
        </div>
      </div>

      <PurchaseDocumentWorkspaceTabs
        active={workspace}
        onChange={setWorkspace}
        tabs={workspaceTabs}
        ariaLabel="Payment workspaces"
        idPrefix="vendor-payment"
      />

      {(infoErrors.length > 0 || allocationErrors.length > 0) && (
        <div ref={firstErrorRef} className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-[13px] text-rose-900">
          <p className="font-semibold">Please fix the following before saving:</p>
          {infoErrors.length > 0 ? (
            <div className="mt-2">
              <p className="text-[11px] font-semibold uppercase">Payment Information</p>
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
            <h3 className="mb-3 text-[13px] font-semibold">Payment details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Vendor *</label>
                <Select value={form.vendorId} onChange={(e) => setField('vendorId', e.target.value)}>
                  <option value="">Select vendor</option>
                  {lookups?.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.code} — {v.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Payment date *</label>
                <Input type="date" value={form.paymentDate} onChange={(e) => setField('paymentDate', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Posting date *</label>
                <Input type="date" value={form.postingDate} onChange={(e) => setField('postingDate', e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Payment mode *</label>
                <Select value={form.paymentMode} onChange={(e) => setField('paymentMode', e.target.value as VendorPaymentMode)}>
                  {VENDOR_PAYMENT_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank account *</label>
                <Select value={form.bankAccountId} onChange={(e) => setField('bankAccountId', e.target.value)}>
                  <option value="">Select account</option>
                  {lookups?.bankAccounts.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Payment amount *</label>
                <Input type="number" min={0} step="0.01" value={form.amount} onChange={(e) => setField('amount', e.target.value)} />
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
            </div>
          </section>

          <section className="rounded-lg border border-erp-border p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Reference & deductions</h3>
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
                </>
              ) : null}
              {showTds ? (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">TDS deducted</label>
                      <Input type="number" min={0} step="0.01" value={form.tdsDeducted} onChange={(e) => setField('tdsDeducted', e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">TDS section</label>
                      <Select value={form.tdsSection} onChange={(e) => setField('tdsSection', e.target.value)}>
                        <option value="">—</option>
                        {lookups?.tdsSections.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">TDS rate %</label>
                      <Input type="number" min={0} step="0.01" value={form.tdsRate} onChange={(e) => setField('tdsRate', e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">TDS base amount</label>
                      <Input type="number" min={0} step="0.01" value={form.tdsBaseAmount} onChange={(e) => setField('tdsBaseAmount', e.target.value)} />
                    </div>
                  </div>
                </>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Other deductions</label>
                  <Input type="number" min={0} step="0.01" value={form.otherDeductions} onChange={(e) => setField('otherDeductions', e.target.value)} />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase text-erp-muted">Bank charges</label>
                  <Input type="number" min={0} step="0.01" value={form.bankCharges} onChange={(e) => setField('bankCharges', e.target.value)} />
                </div>
              </div>
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
          {!form.vendorId ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
              Select a vendor on Payment Information before allocating invoices.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-[13px] font-semibold">{vendorName}</h3>
                  <p className="text-[12px] text-erp-muted">{invoices.length} open invoice(s)</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="erp-btn erp-btn-secondary h-8 px-3 text-[12px]"
                    disabled={paymentAmount <= 0}
                    onClick={() => setAutoOpen(true)}
                  >
                    <Wand2 className="mr-1 inline h-3.5 w-3.5" />
                    Auto allocate
                  </button>
                  <button type="button" className="erp-btn erp-btn-ghost h-8 px-3 text-[12px]" onClick={() => setAllocations({})}>
                    Clear
                  </button>
                </div>
              </div>
              <SearchInput value={allocSearch} onChange={setAllocSearch} placeholder="Search invoices…" />
              <PaymentAllocationSummary
                paymentAmount={paymentAmount}
                tdsDeducted={tds}
                availableAmount={paymentAmount}
                allocatedAmount={allocatedTotal}
                unallocatedAmount={unallocated}
                allocationStatus={allocationStatus}
              />
              <PaymentAllocationGrid
                invoices={invoices}
                allocations={allocations}
                availableAmount={paymentAmount}
                search={allocSearch}
                onChange={(id, amt) => setAllocations((m) => ({ ...m, [id]: amt }))}
              />
            </>
          )}
          <button type="button" className="erp-btn erp-btn-ghost h-9 px-3 text-[13px]" onClick={() => setWorkspace('information')}>
            <ArrowRight className="mr-1 inline h-4 w-4 rotate-180" />
            Back to payment information
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

      <AutoAllocationPreviewModal
        open={autoOpen}
        onClose={() => setAutoOpen(false)}
        invoices={invoices}
        availableAmount={paymentAmount}
        onApply={(lines) => {
          const map: PaymentAllocationMap = {}
          for (const l of lines) map[l.invoiceId] = l.allocationAmount
          setAllocations(map)
          notify.success('Allocation applied from preview')
        }}
      />
    </OperationalPageShell>
  )
}

export function VendorPaymentNewPage() {
  return <VendorPaymentEditorPage mode="new" />
}

export function VendorPaymentEditPage() {
  return <VendorPaymentEditorPage mode="edit" />
}
