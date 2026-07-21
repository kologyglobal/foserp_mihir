import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ErpButton } from '@/components/erp/ErpButton'
import { VendorMasterSelect } from '@/components/masters/VendorMasterSelect'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listAccounts, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { createVendorPaymentDraft, getVendorPayment, updateVendorPaymentDraft } from '@/services/bridges/payablesApiBridge'
import { useActiveVendors } from '@/hooks/useMasterLists'
import { notify } from '@/store/toastStore'
import type {
  CreateVendorPaymentInput,
  VendorPaymentAdjustmentInput,
  VendorPaymentDto,
  VendorPaymentPurpose,
} from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { VendorPaymentTotalsPanel } from '../components/VendorPaymentTotalsPanel'
import { VendorPaymentPositionPanel } from '../components/VendorPaymentPositionPanel'
import {
  VendorPaymentAdjustmentSection,
  type FormAdjustment,
} from '../components/VendorPaymentAdjustmentSection'
import { todayIsoDate } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const formSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  paymentPurpose: z.enum(['INVOICE_SETTLEMENT', 'ADVANCE', 'MIXED']),
  paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER']),
  documentDate: z.string().min(1),
  paymentDate: z.string().min(1),
  proposedPostingDate: z.string().optional(),
  valueDate: z.string().optional(),
  currencyCode: z.string().min(3).max(8),
  exchangeRate: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid exchange rate'),
  paymentAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount'),
  paymentAccountId: z.string().optional(),
  paymentReference: z.string().optional(),
  bankReference: z.string().optional(),
  chequeNumber: z.string().optional(),
  chequeDate: z.string().optional(),
  instrumentReference: z.string().optional(),
  narration: z.string().optional(),
  approvalRequiredOverride: z.boolean().optional(),
})

type FormValues = z.infer<typeof formSchema>

export function VendorPaymentFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyOutPermissions()
  const vendors = useActiveVendors()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [draftReference, setDraftReference] = useState<string>()
  const [serverPayment, setServerPayment] = useState<VendorPaymentDto | null>(null)
  const [adjustments, setAdjustments] = useState<FormAdjustment[]>([])
  const [adjustmentsDirty, setAdjustmentsDirty] = useState(false)
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const initialPurpose = (searchParams.get('purpose') as VendorPaymentPurpose) || 'INVOICE_SETTLEMENT'

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: '',
      paymentPurpose: initialPurpose,
      paymentMethod: 'BANK_TRANSFER',
      documentDate: todayIsoDate(),
      paymentDate: todayIsoDate(),
      proposedPostingDate: todayIsoDate(),
      valueDate: '',
      currencyCode: 'INR',
      exchangeRate: '1',
      paymentAmount: '0',
      paymentAccountId: '',
      paymentReference: '',
      bankReference: '',
      chequeNumber: '',
      chequeDate: '',
      instrumentReference: '',
      narration: '',
      approvalRequiredOverride: false,
    },
  })

  const watched = form.watch()
  const isDirty = (form.formState.isDirty || adjustmentsDirty) && !saving
  const blocker = useBlocker(isDirty)
  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const ok = window.confirm('You have unsaved changes. Leave this page?')
    if (ok) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  useEffect(() => {
    if (!isApiMode()) return
    listAccounts(resolveLegalEntityId())
      .then((accounts) => {
        setPaymentAccounts(
          accounts
            .filter((a) => a.isActive && !a.isGroup)
            .map((a) => ({ id: a.id, code: a.accountCode, name: a.accountName })),
        )
      })
      .catch(() => {
        /* payment account resolves server-side from method/mapping when omitted */
      })
  }, [])

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === watched.vendorId),
    [vendors, watched.vendorId],
  )

  const applyServerState = useCallback((pmt: VendorPaymentDto) => {
    setUpdatedAt(pmt.updatedAt)
    setDraftReference(pmt.draftReference)
    setServerPayment(pmt)
    setAdjustments(
      (pmt.adjustmentLines ?? []).map((a) => ({
        adjustmentType: a.adjustmentType,
        accountingRole: a.accountingRole,
        description: a.description,
        amount: a.amount ?? '',
        rate: a.rate ?? '',
        calculationBaseAmount: a.calculationBaseAmount ?? '',
        sectionCode: a.sectionCode ?? '',
      })),
    )
    setAdjustmentsDirty(false)
  }, [])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const pmt = await getVendorPayment(id)
      if (!pmt.allowedActions.edit) {
        notify.error('This payment cannot be edited')
        navigate(`/accounting/money-out/vendor-payments/${id}`)
        return
      }
      form.reset({
        vendorId: pmt.vendorId,
        paymentPurpose: pmt.paymentPurpose,
        paymentMethod: pmt.paymentMethod,
        documentDate: pmt.documentDate,
        paymentDate: pmt.paymentDate,
        proposedPostingDate: pmt.proposedPostingDate ?? pmt.documentDate,
        valueDate: pmt.valueDate ?? '',
        currencyCode: pmt.currencyCode,
        exchangeRate: pmt.exchangeRate,
        paymentAmount: pmt.paymentAmount,
        paymentAccountId: pmt.paymentAccountId ?? '',
        paymentReference: pmt.paymentReference ?? '',
        bankReference: pmt.bankReference ?? '',
        chequeNumber: pmt.chequeNumber ?? '',
        chequeDate: pmt.chequeDate ?? '',
        instrumentReference: pmt.instrumentReference ?? '',
        narration: pmt.narration ?? '',
        approvalRequiredOverride: pmt.approvalRequired,
      })
      applyServerState(pmt)
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load payment')
    } finally {
      setLoading(false)
    }
  }, [applyServerState, form, id, navigate])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildAdjustments = (): VendorPaymentAdjustmentInput[] =>
    adjustments.map((a, idx) => ({
      lineNumber: idx + 1,
      adjustmentType: a.adjustmentType,
      accountingRole: a.accountingRole,
      description: a.description || a.adjustmentType,
      amount: a.amount.trim() ? a.amount.trim() : null,
      rate: a.rate.trim() ? a.rate.trim() : null,
      calculationBaseAmount: a.calculationBaseAmount.trim() ? a.calculationBaseAmount.trim() : null,
      sectionCode: a.sectionCode.trim() ? a.sectionCode.trim() : null,
    }))

  const buildPayload = (values: FormValues): CreateVendorPaymentInput => ({
    legalEntityId: resolveLegalEntityId(),
    vendorId: values.vendorId,
    paymentPurpose: values.paymentPurpose,
    paymentMethod: values.paymentMethod,
    documentDate: values.documentDate,
    paymentDate: values.paymentDate,
    proposedPostingDate: values.proposedPostingDate || values.documentDate,
    valueDate: values.valueDate || null,
    currencyCode: values.currencyCode,
    exchangeRate: values.exchangeRate,
    paymentAmount: values.paymentAmount || '0',
    paymentAccountId: values.paymentAccountId || null,
    paymentReference: values.paymentReference || null,
    bankReference: values.bankReference || null,
    chequeNumber: values.chequeNumber || null,
    chequeDate: values.chequeDate || null,
    instrumentReference: values.instrumentReference || null,
    narration: values.narration || null,
    approvalRequiredOverride: values.approvalRequiredOverride || undefined,
    adjustments: buildAdjustments(),
  })

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createVendorPaymentDraft(buildPayload(values))
        form.reset(values)
        setAdjustmentsDirty(false)
        notify.success(`Draft saved — ${created.draftReference}`)
        navigate(`/accounting/money-out/vendor-payments/${created.id}`)
      } else if (id && updatedAt) {
        const updated = await updateVendorPaymentDraft(id, { ...buildPayload(values), expectedUpdatedAt: updatedAt })
        form.reset(values)
        applyServerState(updated)
        notify.success('Draft updated — totals refreshed from server')
        navigate(`/accounting/money-out/vendor-payments/${id}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      notify.error(msg)
      if (msg.includes('changed by another user') && id) void loadExisting()
    } finally {
      setSaving(false)
    }
  })

  const canEdit = mode === 'create' ? perms.canCreatePayment : perms.canEditPayment

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Payment">
        <p className="text-[13px] text-erp-muted">Vendor payments require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!canEdit) {
    return (
      <MoneyOutWorkspaceShell title={mode === 'create' ? 'New Vendor Payment' : 'Edit Vendor Payment'}>
        <p className="text-[13px] text-erp-muted">
          You do not have permission to {mode === 'create' ? 'create' : 'edit'} vendor payments.
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyOutWorkspaceShell title="Edit Vendor Payment">
        <LoadingState variant="form" />
      </MoneyOutWorkspaceShell>
    )
  }

  const method = watched.paymentMethod

  return (
    <MoneyOutWorkspaceShell title={mode === 'create' ? 'New Vendor Payment' : 'Edit Vendor Payment'}>
      {draftReference && (
        <p className="mb-3 text-[12px] text-erp-muted">
          Draft reference: <span className="font-medium text-erp-text">{draftReference}</span>
        </p>
      )}

      <form onSubmit={onSave} className="space-y-4">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Vendor &amp; payment</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Vendor" required error={form.formState.errors.vendorId?.message}>
              <VendorMasterSelect
                value={watched.vendorId}
                onChange={(vendorId) => form.setValue('vendorId', vendorId, { shouldDirty: true, shouldValidate: true })}
                allowEmpty
              />
            </FormField>
            <FormField label="Purpose">
              <Select {...form.register('paymentPurpose')}>
                <option value="INVOICE_SETTLEMENT">Invoice settlement</option>
                <option value="ADVANCE">Advance</option>
                <option value="MIXED">Mixed</option>
              </Select>
            </FormField>
            <FormField label="Method">
              <Select {...form.register('paymentMethod')}>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="UPI">UPI</option>
                <option value="CARD">Card</option>
                <option value="OTHER">Other</option>
              </Select>
            </FormField>
            <FormField label="Cash paid (payment amount)" required error={form.formState.errors.paymentAmount?.message}>
              <Input {...form.register('paymentAmount')} inputMode="decimal" />
            </FormField>
            <FormField label="Payment date" required>
              <Input type="date" {...form.register('paymentDate')} />
            </FormField>
            <FormField label="Document date" required>
              <Input type="date" {...form.register('documentDate')} />
            </FormField>
            <FormField label="Payment account (bank / cash)">
              <Select {...form.register('paymentAccountId')}>
                <option value="">Server mapping / default</option>
                {paymentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.code} — {a.name}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Proposed posting date">
              <Input type="date" {...form.register('proposedPostingDate')} />
            </FormField>
          </div>
          {selectedVendor && (
            <dl className="mt-3 grid gap-1 text-[11px] text-erp-muted sm:grid-cols-3">
              <div>
                GSTIN: <span className="text-erp-text">{selectedVendor.gstin || '—'}</span>
              </div>
              <div>
                PAN: <span className="text-erp-text">{selectedVendor.pan || '—'}</span>
              </div>
              <div>
                State: <span className="text-erp-text">{selectedVendor.state || '—'}</span>
              </div>
            </dl>
          )}
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">References</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {method === 'CHEQUE' ? (
              <>
                <FormField label="Cheque number">
                  <Input {...form.register('chequeNumber')} autoComplete="off" />
                </FormField>
                <FormField label="Cheque date">
                  <Input type="date" {...form.register('chequeDate')} />
                </FormField>
              </>
            ) : (
              <>
                <FormField label="Payment reference (UTR / txn)">
                  <Input {...form.register('paymentReference')} autoComplete="off" />
                </FormField>
                <FormField label="Bank reference">
                  <Input {...form.register('bankReference')} autoComplete="off" />
                </FormField>
              </>
            )}
            <FormField label="Narration">
              <Input {...form.register('narration')} autoComplete="off" />
            </FormField>
          </div>
        </section>

        <VendorPaymentAdjustmentSection
          value={adjustments}
          onChange={(next) => {
            setAdjustments(next)
            setAdjustmentsDirty(true)
          }}
        />

        <details
          className="rounded border border-erp-border p-3"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-[12px] font-semibold text-erp-muted">
            Currency, value date, instrument &amp; approval (advanced)
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <FormField label="Currency">
              <Input {...form.register('currencyCode')} />
            </FormField>
            <FormField label="Exchange rate">
              <Input {...form.register('exchangeRate')} />
            </FormField>
            <FormField label="Value date">
              <Input type="date" {...form.register('valueDate')} />
            </FormField>
            <FormField label="Instrument reference">
              <Input {...form.register('instrumentReference')} />
            </FormField>
            <label className="mt-1 flex items-center gap-2 text-[12px] text-erp-text">
              <input type="checkbox" {...form.register('approvalRequiredOverride')} />
              Require approval before posting
            </label>
          </div>
        </details>

        {serverPayment && (
          <div className="grid gap-4 lg:grid-cols-2">
            <VendorPaymentPositionPanel position={serverPayment.validation?.paymentPosition} />
            <VendorPaymentTotalsPanel payment={serverPayment} />
          </div>
        )}
        <p className="text-[11px] text-erp-muted">
          Raw inputs are sent to the server. Settlement, cash outflow, TDS and account resolution are calculated by the
          API and shown after save.
        </p>

        <div className="flex flex-wrap gap-2">
          <ErpButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Draft'}
          </ErpButton>
          <ErpButton type="button" variant="secondary" onClick={() => navigate(-1)} disabled={saving}>
            Cancel
          </ErpButton>
        </div>
      </form>
    </MoneyOutWorkspaceShell>
  )
}

export function VendorPaymentNewPage() {
  return <VendorPaymentFormPage mode="create" />
}

export function VendorPaymentEditPage() {
  return <VendorPaymentFormPage mode="edit" />
}
