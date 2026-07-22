import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createCustomerReceipt,
  getCustomerReceipt,
  updateCustomerReceipt,
} from '@/services/bridges/receivablesApiBridge'
import { CustomerMasterSelect } from '@/components/masters/CustomerMasterSelect'
import { PartyMasterCard } from '@/modules/accounting/shared/invoices'
import { listAccounts, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { Account } from '@/types/financeSetup'
import type { CustomerReceiptPaymentMethod, CustomerTdsMode } from '@/types/moneyIn'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { formatCurrency } from '@/utils/formatters/currency'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

const PAYMENT_METHOD_OPTIONS: Array<{ value: CustomerReceiptPaymentMethod; label: string }> = [
  { value: 'BANK_TRANSFER', label: 'Bank transfer' },
  { value: 'CASH', label: 'Cash' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'UPI', label: 'UPI' },
  { value: 'CARD', label: 'Card' },
  { value: 'OTHER', label: 'Other' },
]

const TDS_MODE_OPTIONS: Array<{ value: CustomerTdsMode; label: string }> = [
  { value: 'NONE', label: 'No TDS' },
  { value: 'AMOUNT', label: 'Fixed amount' },
  { value: 'PERCENTAGE', label: 'Percentage' },
]

const formSchema = z
  .object({
    customerId: z.string().min(1, 'Customer required'),
    receiptDate: z.string().min(1),
    postingDate: z.string().min(1),
    paymentMethod: z.enum(['BANK_TRANSFER', 'CASH', 'CHEQUE', 'UPI', 'CARD', 'OTHER']),
    bankCashAmount: z.string().min(1, 'Amount required'),
    bankCashAccountId: z.string().min(1, 'Bank/cash account required'),
    instrumentNumber: z.string().optional(),
    instrumentDate: z.string().optional(),
    bankReference: z.string().optional(),
    transactionReference: z.string().optional(),
    tdsMode: z.enum(['NONE', 'AMOUNT', 'PERCENTAGE']),
    tdsValue: z.string().optional(),
    bankChargeDescription: z.string().optional(),
    bankChargeAmount: z.string().optional(),
    narration: z.string().optional(),
  })
  .refine((v) => v.paymentMethod !== 'CHEQUE' || (v.instrumentNumber && v.instrumentNumber.trim()), {
    message: 'Cheque number is required for cheque payments',
    path: ['instrumentNumber'],
  })
  .refine((v) => v.paymentMethod !== 'CHEQUE' || (v.instrumentDate && v.instrumentDate.trim()), {
    message: 'Cheque date is required for cheque payments',
    path: ['instrumentDate'],
  })

type FormValues = z.infer<typeof formSchema>

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function ReceiptFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [wasReady, setWasReady] = useState(false)
  const [bankCashAccounts, setBankCashAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: '',
      receiptDate: today(),
      postingDate: today(),
      paymentMethod: 'BANK_TRANSFER',
      bankCashAmount: '',
      bankCashAccountId: '',
      instrumentNumber: '',
      instrumentDate: '',
      bankReference: '',
      transactionReference: '',
      tdsMode: 'NONE',
      tdsValue: '',
      bankChargeDescription: '',
      bankChargeAmount: '',
      narration: '',
    },
  })

  const watched = form.watch()

  useEffect(() => {
    listAccounts(resolveLegalEntityId())
      .then((accounts) => {
        const filtered = accounts.filter((a) => a.accountType === 'BANK' || a.accountType === 'CASH')
        setBankCashAccounts(filtered)
        if (filtered.length > 0 && !form.getValues('bankCashAccountId')) {
          form.setValue('bankCashAccountId', filtered[0].id)
        }
      })
      .catch(() => setAccountsError(true))
  }, [form])

  const previewGross = useMemo(() => {
    const bankCash = Number(watched.bankCashAmount || 0)
    const tdsValue = Number(watched.tdsValue || 0)
    const tds =
      watched.tdsMode === 'AMOUNT' ? tdsValue : watched.tdsMode === 'PERCENTAGE' ? bankCash * (tdsValue / 100) : 0
    const bankCharge = Number(watched.bankChargeAmount || 0)
    return bankCash + tds + bankCharge
  }, [watched.bankCashAmount, watched.tdsMode, watched.tdsValue, watched.bankChargeAmount])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const receipt = await getCustomerReceipt(id)
      setUpdatedAt(receipt.updatedAt)
      setWasReady(receipt.status === 'READY_TO_POST')
      form.reset({
        customerId: receipt.customerId,
        receiptDate: receipt.receiptDate,
        postingDate: receipt.postingDate ?? receipt.receiptDate,
        paymentMethod: receipt.paymentMethod,
        bankCashAmount: receipt.bankCashAmount,
        bankCashAccountId: receipt.bankCashAccountId ?? '',
        instrumentNumber: receipt.chequeNumber ?? '',
        instrumentDate: receipt.chequeDate ?? '',
        bankReference: receipt.customerBankReference ?? '',
        transactionReference: receipt.transactionReference ?? '',
        tdsMode: receipt.customerTds?.mode ?? 'NONE',
        tdsValue: receipt.customerTds?.value ?? '',
        bankChargeDescription: receipt.bankCharges?.[0]?.description ?? '',
        bankChargeAmount: receipt.bankCharges?.[0]?.amount ?? '',
        narration: receipt.narration ?? '',
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load receipt')
    } finally {
      setLoading(false)
    }
  }, [form, id])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildPayload = (values: FormValues) => ({
    legalEntityId: resolveLegalEntityId(),
    customerId: values.customerId,
    sourceType: 'DIRECT' as const,
    receiptDate: values.receiptDate,
    postingDate: values.postingDate,
    paymentMethod: values.paymentMethod,
    bankCashAmount: values.bankCashAmount,
    bankCashAccountId: values.bankCashAccountId,
    instrumentNumber: values.paymentMethod === 'CHEQUE' ? values.instrumentNumber || null : null,
    instrumentDate: values.paymentMethod === 'CHEQUE' ? values.instrumentDate || null : null,
    bankReference: values.bankReference || null,
    transactionReference: values.transactionReference || null,
    customerTds:
      values.tdsMode === 'NONE'
        ? null
        : {
            mode: values.tdsMode,
            value: values.tdsValue || '0',
          },
    bankCharges:
      values.bankChargeDescription && values.bankChargeAmount
        ? [{ description: values.bankChargeDescription, amount: values.bankChargeAmount }]
        : [],
    narration: values.narration || null,
    ...(mode === 'edit' && updatedAt ? { updatedAt } : {}),
  })

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createCustomerReceipt(buildPayload(values))
        notify.success('Draft saved')
        navigate(`/accounting/money-in/receipts/${created.id}`)
      } else if (id) {
        const updated = await updateCustomerReceipt(id, buildPayload(values) as Parameters<typeof updateCustomerReceipt>[1])
        setUpdatedAt(updated.updatedAt)
        notify.success(wasReady ? 'Saved — receipt returned to Draft' : 'Draft updated')
        navigate(`/accounting/money-in/receipts/${id}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      notify.error(msg)
      if (msg.includes('changed by another user') && id) void loadExisting()
    } finally {
      setSaving(false)
    }
  })

  const canEdit = mode === 'create' ? perms.canCreateReceipt : perms.canEditReceipt

  if (!canEdit) {
    return (
      <MoneyInWorkspaceShell title={mode === 'create' ? 'New Receipt' : 'Edit Receipt'}>
        <p className="text-[13px] text-erp-muted">You do not have permission to {mode === 'create' ? 'create' : 'edit'} customer receipts.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyInWorkspaceShell title="Edit Receipt">
        <LoadingState variant="form" />
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell title={mode === 'create' ? 'New Receipt' : 'Edit Receipt'}>
      {wasReady && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Editing a Ready to Post receipt returns it to Draft — mark ready again before posting.
        </div>
      )}

      <form onSubmit={onSave} className="space-y-4">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Customer &amp; payment</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Customer" error={form.formState.errors.customerId?.message}>
              <CustomerMasterSelect
                value={watched.customerId}
                onChange={(customerId) => form.setValue('customerId', customerId, { shouldDirty: true, shouldValidate: true })}
                allowEmpty
              />
            </FormField>
            <FormField label="Payment method">
              <Select {...form.register('paymentMethod')}>
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Bank/cash amount" error={form.formState.errors.bankCashAmount?.message}>
              <Input placeholder="0.00" {...form.register('bankCashAmount')} />
            </FormField>
            <FormField
              label="Bank/cash account"
              error={form.formState.errors.bankCashAccountId?.message}
              hint={
                bankCashAccounts.length > 0 && !accountsError
                  ? undefined
                  : 'Could not load the chart of accounts — enter the BANK/CASH account UUID directly.'
              }
            >
              {bankCashAccounts.length > 0 && !accountsError ? (
                <Select {...form.register('bankCashAccountId')}>
                  <option value="">Select account…</option>
                  {bankCashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} — {a.accountName} ({a.accountType})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input placeholder="Bank/cash account ID (UUID)" {...form.register('bankCashAccountId')} />
              )}
            </FormField>
          </div>
          <PartyMasterCard variant="crm" partyId={watched.customerId} showQuickCreate />
        </section>

        {watched.paymentMethod === 'CHEQUE' && (
          <section>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Cheque details</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <FormField label="Cheque number" error={form.formState.errors.instrumentNumber?.message}>
                <Input {...form.register('instrumentNumber')} />
              </FormField>
              <FormField label="Cheque date" error={form.formState.errors.instrumentDate?.message}>
                <Input type="date" {...form.register('instrumentDate')} />
              </FormField>
            </div>
          </section>
        )}

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Dates &amp; references</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Receipt date" error={form.formState.errors.receiptDate?.message}>
              <Input type="date" {...form.register('receiptDate')} />
            </FormField>
            <FormField label="Posting date">
              <Input type="date" {...form.register('postingDate')} />
            </FormField>
            <FormField label="Transaction reference">
              <Input {...form.register('transactionReference')} />
            </FormField>
            <FormField label="Bank reference">
              <Input {...form.register('bankReference')} />
            </FormField>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Customer TDS (optional)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="TDS mode">
              <Select {...form.register('tdsMode')}>
                {TDS_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            {watched.tdsMode !== 'NONE' && (
              <FormField label={watched.tdsMode === 'PERCENTAGE' ? 'TDS %' : 'TDS amount'}>
                <Input {...form.register('tdsValue')} />
              </FormField>
            )}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Bank charge (optional)</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Description">
              <Input placeholder="e.g. NEFT / RTGS charge" {...form.register('bankChargeDescription')} />
            </FormField>
            <FormField label="Amount">
              <Input placeholder="0.00" {...form.register('bankChargeAmount')} />
            </FormField>
          </div>
        </section>

        <FormField label="Narration">
          <Textarea rows={2} {...form.register('narration')} />
        </FormField>

        <div className="rounded border border-erp-border bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Gross receipt (preview)</h3>
            <span className="text-[11px] text-amber-700">Client preview — server recalculates on save</span>
          </div>
          <p className="mt-2 text-[15px] font-semibold tabular-nums text-erp-text">{formatCurrency(previewGross)}</p>
        </div>

        <div className="flex gap-2">
          <ErpButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Draft'}
          </ErpButton>
          <ErpButton type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </ErpButton>
        </div>
      </form>
    </MoneyInWorkspaceShell>
  )
}

export function ReceiptNewPage() {
  return <ReceiptFormPage mode="create" />
}

export function ReceiptEditPage() {
  return <ReceiptFormPage mode="edit" />
}
