import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '@/components/forms/selectStandards'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createCustomerReceipt,
  getCustomerReceipt,
  updateCustomerReceipt,
} from '@/services/bridges/receivablesApiBridge'
import { CustomerMasterSelect } from '@/components/masters/CustomerMasterSelect'
import { partyMasterCreateRoute, partyMasterRoute } from '@/modules/accounting/shared/invoices'
import { listAccounts, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { Account } from '@/types/financeSetup'
import type { CustomerReceiptPaymentMethod, CustomerTdsMode } from '@/types/moneyIn'
import { useMasterStore } from '@/store/masterStore'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { canQuickCreateEntity } from '@/utils/quickCreatePermissions'
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

function customerInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase()
}

export function ReceiptFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const perms = useMoneyInPermissions()
  const customers = useMasterStore((s) => s.customers)
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [wasReady, setWasReady] = useState(false)
  const [bankCashAccounts, setBankCashAccounts] = useState<Account[]>([])
  const [accountsError, setAccountsError] = useState(false)

  const prefillCustomerId = mode === 'create' ? searchParams.get('customerId') ?? '' : ''
  const crmPaymentReceiptId = mode === 'create' ? searchParams.get('crmPaymentReceiptId') : null
  const salesInvoiceId = mode === 'create' ? searchParams.get('salesInvoiceId') : null

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: prefillCustomerId,
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
  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === watched.customerId),
    [customers, watched.customerId],
  )
  const customerDisplayName = selectedCustomer?.customerName ?? (watched.customerId ? 'Selected customer' : '')
  const canQuickCreate = canQuickCreateEntity('customer')

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
  const errors = form.formState.errors

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
    <MoneyInWorkspaceShell
      title={mode === 'create' ? 'New Receipt' : 'Edit Receipt'}
      description={
        mode === 'create'
          ? 'Record a customer remittance — allocate to open invoices after posting.'
          : 'Update draft receipt details before mark-ready / post.'
      }
    >
      {wasReady && (
        <div className="mi-receipt-banner mi-receipt-banner--warn" role="status">
          Editing a Ready to Post receipt returns it to Draft — mark ready again before posting.
        </div>
      )}

      <form onSubmit={onSave} className="mi-receipt">
        {(crmPaymentReceiptId || salesInvoiceId) && (
          <div className="mi-receipt-source-chips" aria-label="Source context">
            {crmPaymentReceiptId ? (
              <span className="mi-receipt-chip">
                <span className="mi-receipt-chip__label">CRM receipt</span>
                Linked for migration
              </span>
            ) : null}
            {salesInvoiceId ? (
              <span className="mi-receipt-chip">
                <span className="mi-receipt-chip__label">Invoice</span>
                Prefill from tax invoice — allocate after post
              </span>
            ) : null}
          </div>
        )}

        {watched.customerId ? (
          <aside className="mi-receipt-context" aria-label="Receipt customer context">
            <div className="mi-receipt-context__avatar" aria-hidden>
              {customerInitials(customerDisplayName)}
            </div>
            <div className="mi-receipt-context__main">
              <div className="mi-receipt-context__title-row">
                <h3 className="mi-receipt-context__name">
                  {selectedCustomer?.customerCode ? `${selectedCustomer.customerCode} — ` : ''}
                  {customerDisplayName}
                </h3>
                <Link to={partyMasterRoute('crm', watched.customerId)} className="mi-receipt-context__360">
                  Customer 360
                </Link>
              </div>
              <div className="mi-receipt-context__chips">
                <span className="mi-receipt-chip">
                  <span className="mi-receipt-chip__label">GSTIN</span>
                  {selectedCustomer?.gstin || '-'}
                </span>
                {selectedCustomer?.creditDays ? (
                  <span className="mi-receipt-chip">
                    <span className="mi-receipt-chip__label">Credit</span>
                    {selectedCustomer.creditDays} days
                  </span>
                ) : null}
                <span className="mi-receipt-chip mi-receipt-chip--balance">
                  <span className="mi-receipt-chip__label">Gross preview</span>
                  {formatCurrency(previewGross)}
                </span>
              </div>
            </div>
          </aside>
        ) : null}

        <section className="mi-receipt-group" aria-labelledby="mi-receipt-identity">
          <h4 id="mi-receipt-identity" className="mi-receipt-group__title">
            Receipt identity
          </h4>
          <div className="mi-receipt-grid">
            <label className="mi-receipt-field mi-receipt-field--wide">
              <span className="mi-receipt-field__label">
                Customer <span className="mi-receipt-field__req" aria-hidden>*</span>
              </span>
              <CustomerMasterSelect
                value={watched.customerId}
                onChange={(customerId) => form.setValue('customerId', customerId, { shouldDirty: true, shouldValidate: true })}
                allowEmpty
                source="accounting"
              />
              {errors.customerId?.message ? (
                <span className="mi-receipt-field__error">{errors.customerId.message}</span>
              ) : null}
              {!watched.customerId && canQuickCreate ? (
                <Link to={partyMasterCreateRoute('crm')} className="mi-receipt-field__hint-link">
                  Create customer…
                </Link>
              ) : null}
            </label>
            <div className="mi-receipt-field mi-receipt-field--readonly">
              <span className="mi-receipt-field__label">Receipt number</span>
              <span className="mi-receipt-field__value">
                {mode === 'create' ? 'Auto-generated on save' : 'From existing draft'}
              </span>
            </div>
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">
                Receipt date <span className="mi-receipt-field__req" aria-hidden>*</span>
              </span>
              <Input type="date" {...form.register('receiptDate')} />
              {errors.receiptDate?.message ? (
                <span className="mi-receipt-field__error">{errors.receiptDate.message}</span>
              ) : null}
            </label>
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">
                Posting date <span className="mi-receipt-field__req" aria-hidden>*</span>
              </span>
              <Input type="date" {...form.register('postingDate')} />
            </label>
          </div>
        </section>

        <section className="mi-receipt-group" aria-labelledby="mi-receipt-payment">
          <h4 id="mi-receipt-payment" className="mi-receipt-group__title">
            Payment details
          </h4>
          <div className="mi-receipt-grid">
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">
                Payment method <span className="mi-receipt-field__req" aria-hidden>*</span>
              </span>
              <Select {...form.register('paymentMethod')}>
                {PAYMENT_METHOD_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">
                Bank/cash amount <span className="mi-receipt-field__req" aria-hidden>*</span>
              </span>
              <Input placeholder="0.00" {...form.register('bankCashAmount')} />
              {errors.bankCashAmount?.message ? (
                <span className="mi-receipt-field__error">{errors.bankCashAmount.message}</span>
              ) : null}
            </label>
            <label className="mi-receipt-field mi-receipt-field--wide">
              <span className="mi-receipt-field__label">
                Bank/cash account <span className="mi-receipt-field__req" aria-hidden>*</span>
              </span>
              {bankCashAccounts.length > 0 && !accountsError ? (
                <Select {...form.register('bankCashAccountId')}>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {bankCashAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.accountCode} — {a.accountName} ({a.accountType})
                    </option>
                  ))}
                </Select>
              ) : (
                <Input placeholder="Bank/cash account ID (UUID)" {...form.register('bankCashAccountId')} />
              )}
              {errors.bankCashAccountId?.message ? (
                <span className="mi-receipt-field__error">{errors.bankCashAccountId.message}</span>
              ) : null}
              {bankCashAccounts.length === 0 || accountsError ? (
                <span className="mi-receipt-field__hint">
                  Could not load the chart of accounts — enter the BANK/CASH account UUID directly.
                </span>
              ) : null}
            </label>
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">Transaction reference</span>
              <Input placeholder="UTR / NEFT / UPI ref" {...form.register('transactionReference')} />
            </label>
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">Bank reference</span>
              <Input {...form.register('bankReference')} />
            </label>
            {watched.paymentMethod === 'CHEQUE' ? (
              <>
                <label className="mi-receipt-field">
                  <span className="mi-receipt-field__label">
                    Cheque number <span className="mi-receipt-field__req" aria-hidden>*</span>
                  </span>
                  <Input {...form.register('instrumentNumber')} />
                  {errors.instrumentNumber?.message ? (
                    <span className="mi-receipt-field__error">{errors.instrumentNumber.message}</span>
                  ) : null}
                </label>
                <label className="mi-receipt-field">
                  <span className="mi-receipt-field__label">
                    Cheque date <span className="mi-receipt-field__req" aria-hidden>*</span>
                  </span>
                  <Input type="date" {...form.register('instrumentDate')} />
                  {errors.instrumentDate?.message ? (
                    <span className="mi-receipt-field__error">{errors.instrumentDate.message}</span>
                  ) : null}
                </label>
              </>
            ) : null}
          </div>
        </section>

        <section className="mi-receipt-group" aria-labelledby="mi-receipt-adjustments">
          <h4 id="mi-receipt-adjustments" className="mi-receipt-group__title">
            TDS &amp; bank charges
          </h4>
          <div className="mi-receipt-grid">
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">TDS mode</span>
              <Select {...form.register('tdsMode')}>
                {TDS_MODE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </label>
            {watched.tdsMode !== 'NONE' ? (
              <label className="mi-receipt-field">
                <span className="mi-receipt-field__label">
                  {watched.tdsMode === 'PERCENTAGE' ? 'TDS %' : 'TDS amount'}
                </span>
                <Input {...form.register('tdsValue')} />
              </label>
            ) : (
              <div className="mi-receipt-field mi-receipt-field--readonly">
                <span className="mi-receipt-field__label">TDS</span>
                <span className="mi-receipt-field__value">Not applied</span>
              </div>
            )}
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">Bank charge description</span>
              <Input placeholder="e.g. NEFT / RTGS charge" {...form.register('bankChargeDescription')} />
            </label>
            <label className="mi-receipt-field">
              <span className="mi-receipt-field__label">Bank charge amount</span>
              <Input placeholder="0.00" {...form.register('bankChargeAmount')} />
            </label>
          </div>
        </section>

        <section className="mi-receipt-group" aria-labelledby="mi-receipt-notes">
          <h4 id="mi-receipt-notes" className="mi-receipt-group__title">
            Notes
          </h4>
          <div className="mi-receipt-grid">
            <label className="mi-receipt-field mi-receipt-field--wide">
              <span className="mi-receipt-field__label">Narration</span>
              <Textarea rows={3} {...form.register('narration')} />
            </label>
          </div>
          {watched.customerId ? (
            <p className="mi-receipt-allocate-hint">
              After posting, allocate this receipt to open invoices from the receipt detail page.
            </p>
          ) : null}
        </section>

        <div className="mi-receipt-totals" aria-label="Gross receipt preview">
          <div className="mi-receipt-totals__item mi-receipt-totals__item--primary">
            <span className="mi-receipt-totals__label">Gross receipt</span>
            <span className="mi-receipt-totals__value tabular-nums">{formatCurrency(previewGross)}</span>
          </div>
          <p className="mi-receipt-totals__hint">Client preview — server recalculates on save</p>
        </div>

        <div className="mi-receipt-actions">
          <ErpButton type="submit" variant="primary" disabled={saving} className="mi-receipt-actions__primary">
            {saving ? 'Saving…' : 'Save Draft'}
          </ErpButton>
          <button type="button" className="mi-receipt-actions__back" onClick={() => navigate(-1)}>
            Cancel
          </button>
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
