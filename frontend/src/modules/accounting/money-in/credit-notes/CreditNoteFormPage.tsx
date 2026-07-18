import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input, Select, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createCustomerCreditNote,
  getCustomerCreditNote,
  listDemoCustomers,
  listSalesInvoices,
  updateCustomerCreditNote,
} from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import type { CreditNotePurpose, SalesInvoiceListItemDto } from '@/types/moneyIn'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { previewInterLineTotal, previewLineTotal } from '../moneyInUi'
import { TotalsPanel } from '../components/TotalsPanel'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

const PURPOSE_OPTIONS: Array<{ value: CreditNotePurpose; label: string }> = [
  { value: 'SALES_RETURN', label: 'Sales return' },
  { value: 'PRICE_ADJUSTMENT', label: 'Price adjustment' },
  { value: 'QUANTITY_ADJUSTMENT', label: 'Quantity adjustment' },
  { value: 'QUALITY_CLAIM', label: 'Quality claim' },
  { value: 'DISCOUNT', label: 'Discount' },
  { value: 'FREIGHT_ADJUSTMENT', label: 'Freight adjustment' },
  { value: 'TAX_CORRECTION', label: 'Tax correction' },
  { value: 'COMMERCIAL_SETTLEMENT', label: 'Commercial settlement' },
  { value: 'OTHER', label: 'Other' },
]

const lineSchema = z.object({
  description: z.string().min(1, 'Description required'),
  adjustmentMode: z.enum(['FULL_LINE', 'QUANTITY', 'VALUE', 'RATE', 'TAX_ONLY', 'FULL_INVOICE']),
  quantity: z.string().min(1),
  unitRate: z.string().min(1),
  gstRate: z.string().optional(),
})

const formSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  purpose: z.enum([
    'SALES_RETURN', 'PRICE_ADJUSTMENT', 'QUANTITY_ADJUSTMENT', 'QUALITY_CLAIM',
    'DISCOUNT', 'FREIGHT_ADJUSTMENT', 'TAX_CORRECTION', 'COMMERCIAL_SETTLEMENT', 'OTHER',
  ]),
  sourceType: z.enum(['SALES_INVOICE', 'DIRECT']),
  originalInvoiceId: z.string().optional(),
  creditNoteDate: z.string().min(1),
  postingDate: z.string().min(1),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  taxTreatment: z.enum(['REGISTERED', 'UNREGISTERED']),
  freightAmount: z.string().optional(),
  otherChargesAmount: z.string().optional(),
  approvalRequired: z.boolean().optional(),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(1),
})

type FormValues = z.infer<typeof formSchema>

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function CreditNoteFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const customers = listDemoCustomers()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [wasReady, setWasReady] = useState(false)
  const [postedInvoices, setPostedInvoices] = useState<SalesInvoiceListItemDto[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: customers[0]?.id ?? '',
      purpose: 'SALES_RETURN',
      sourceType: 'DIRECT',
      originalInvoiceId: '',
      creditNoteDate: today(),
      postingDate: today(),
      supplyType: 'INTRA_STATE',
      taxTreatment: 'REGISTERED',
      freightAmount: '0',
      otherChargesAmount: '0',
      approvalRequired: false,
      lines: [{ description: 'Sales return / adjustment', adjustmentMode: 'FULL_LINE', quantity: '1', unitRate: '10000', gstRate: '18' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()

  useEffect(() => {
    if (watched.sourceType !== 'SALES_INVOICE') return
    listSalesInvoices({ legalEntityId: resolveLegalEntityId(), status: 'POSTED' })
      .then(setPostedInvoices)
      .catch(() => notify.error('Failed to load posted invoices'))
  }, [watched.sourceType])

  const previewTotals = useMemo(() => {
    const inter = watched.supplyType === 'INTER_STATE'
    let taxable = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    for (const line of watched.lines ?? []) {
      const gstRate = Number(line.gstRate || 18)
      const calc = inter
        ? previewInterLineTotal(Number(line.quantity), Number(line.unitRate), gstRate)
        : previewLineTotal(Number(line.quantity), Number(line.unitRate), gstRate)
      taxable += calc.taxableAmount
      cgst += calc.cgstAmount
      sgst += calc.sgstAmount
      igst += calc.igstAmount
    }
    const freight = Number(watched.freightAmount || 0)
    const other = Number(watched.otherChargesAmount || 0)
    const total = taxable + cgst + sgst + igst + freight + other
    return {
      taxable: taxable.toFixed(2),
      cgst: cgst.toFixed(2),
      sgst: sgst.toFixed(2),
      igst: igst.toFixed(2),
      freight: freight.toFixed(2),
      other: other.toFixed(2),
      roundOff: '0.00',
      total: total.toFixed(2),
    }
  }, [watched])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const note = await getCustomerCreditNote(id)
      setUpdatedAt(note.updatedAt)
      setWasReady(note.status === 'READY_TO_POST')
      form.reset({
        customerId: note.customerId,
        purpose: note.purpose,
        sourceType: note.sourceType,
        originalInvoiceId: note.originalInvoiceId ?? '',
        creditNoteDate: note.creditNoteDate,
        postingDate: note.postingDate ?? note.creditNoteDate,
        supplyType: note.supplyType === 'INTER_STATE' ? 'INTER_STATE' : 'INTRA_STATE',
        taxTreatment: note.taxTreatment === 'UNREGISTERED' ? 'UNREGISTERED' : 'REGISTERED',
        freightAmount: note.freightAmount,
        otherChargesAmount: note.otherChargesAmount,
        approvalRequired: note.approvalRequired,
        lines: (note.lines ?? []).map((l) => ({
          description: l.description ?? l.itemNameSnapshot ?? '',
          adjustmentMode: l.adjustmentMode,
          quantity: l.quantity,
          unitRate: l.unitRate,
          gstRate: l.cgstRate && l.sgstRate ? String(Number(l.cgstRate) + Number(l.sgstRate)) : l.igstRate || '18',
        })),
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load credit note')
    } finally {
      setLoading(false)
    }
  }, [form, id])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildPayload = (values: FormValues) => ({
    legalEntityId: resolveLegalEntityId(),
    purpose: values.purpose,
    sourceType: values.sourceType,
    originalInvoiceId: values.sourceType === 'SALES_INVOICE' ? values.originalInvoiceId || null : null,
    customerId: values.customerId,
    creditNoteDate: values.creditNoteDate,
    postingDate: values.postingDate,
    supplyType: values.supplyType,
    taxTreatment: values.taxTreatment,
    freightAmount: values.freightAmount ?? '0',
    otherChargesAmount: values.otherChargesAmount ?? '0',
    approvalRequired: values.approvalRequired ?? false,
    lines: values.lines.map((l, idx) => ({
      lineNumber: idx + 1,
      adjustmentMode: l.adjustmentMode,
      description: l.description,
      quantity: l.quantity,
      unitRate: l.unitRate,
      gstRate: l.gstRate || '18',
    })),
    ...(mode === 'edit' && updatedAt ? { updatedAt } : {}),
  })

  const onSave = form.handleSubmit(async (values) => {
    if (values.sourceType === 'SALES_INVOICE' && !values.originalInvoiceId) {
      notify.error('Select the original invoice for an invoice-linked credit note')
      return
    }
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createCustomerCreditNote(buildPayload(values))
        notify.success('Draft saved')
        navigate(`/accounting/money-in/credit-notes/${created.id}`)
      } else if (id) {
        const updated = await updateCustomerCreditNote(id, buildPayload(values) as Parameters<typeof updateCustomerCreditNote>[1])
        setUpdatedAt(updated.updatedAt)
        notify.success(wasReady ? 'Saved — credit note returned to Draft' : 'Draft updated')
        navigate(`/accounting/money-in/credit-notes/${id}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      notify.error(msg)
      if (msg.includes('changed by another user') && id) void loadExisting()
    } finally {
      setSaving(false)
    }
  })

  const canEdit = mode === 'create' ? perms.canCreateCreditNote : perms.canEditCreditNote

  if (!canEdit) {
    return (
      <MoneyInWorkspaceShell title={mode === 'create' ? 'New Credit Note' : 'Edit Credit Note'}>
        <p className="text-[13px] text-erp-muted">You do not have permission to {mode === 'create' ? 'create' : 'edit'} credit notes.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyInWorkspaceShell title="Edit Credit Note">
        <LoadingState variant="form" />
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell title={mode === 'create' ? 'New Credit Note' : 'Edit Credit Note'}>
      {wasReady && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Editing a Ready to Post credit note returns it to Draft — mark ready again before posting.
        </div>
      )}

      <form onSubmit={onSave} className="space-y-4">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Customer &amp; source</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Customer" error={form.formState.errors.customerId?.message}>
              <Select {...form.register('customerId')}>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Purpose">
              <Select {...form.register('purpose')}>
                {PURPOSE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Source">
              <Select {...form.register('sourceType')}>
                <option value="DIRECT">Direct (no invoice link)</option>
                <option value="SALES_INVOICE">Against a posted invoice</option>
              </Select>
            </FormField>
            {watched.sourceType === 'SALES_INVOICE' && (
              <FormField label="Original invoice">
                <Select {...form.register('originalInvoiceId')}>
                  <option value="">Select invoice…</option>
                  {postedInvoices.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoiceNumber ?? inv.draftReference} — {inv.customerNameSnapshot}
                    </option>
                  ))}
                </Select>
              </FormField>
            )}
            <FormField label="Supply type">
              <Select {...form.register('supplyType')}>
                <option value="INTRA_STATE">Intra-state</option>
                <option value="INTER_STATE">Inter-state</option>
              </Select>
            </FormField>
            <FormField label="Tax treatment">
              <Select {...form.register('taxTreatment')}>
                <option value="REGISTERED">Registered</option>
                <option value="UNREGISTERED">Unregistered</option>
              </Select>
            </FormField>
          </div>
          <label className="mt-3 flex items-center gap-2 text-[12px] text-erp-muted">
            <input type="checkbox" className="h-4 w-4 rounded border-erp-border" {...form.register('approvalRequired')} />
            Requires approval before posting (routes through Submit / Approve instead of Mark Ready)
          </label>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Dates</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Credit note date" error={form.formState.errors.creditNoteDate?.message}>
              <Input type="date" {...form.register('creditNoteDate')} />
            </FormField>
            <FormField label="Posting date">
              <Input type="date" {...form.register('postingDate')} />
            </FormField>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Lines</h3>
            <ErpButton
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ description: '', adjustmentMode: 'FULL_LINE', quantity: '1', unitRate: '0', gstRate: '18' })}
            >
              Add line
            </ErpButton>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded border border-erp-border p-2 md:grid-cols-12">
                <div className="md:col-span-3">
                  <Input placeholder="Description" {...form.register(`lines.${index}.description`)} />
                </div>
                <div className="md:col-span-2">
                  <Select {...form.register(`lines.${index}.adjustmentMode`)}>
                    <option value="FULL_LINE">Full line</option>
                    <option value="QUANTITY">Quantity</option>
                    <option value="VALUE">Value</option>
                    <option value="RATE">Rate</option>
                    <option value="TAX_ONLY">Tax only</option>
                    <option value="FULL_INVOICE">Full invoice</option>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Input placeholder="Qty" {...form.register(`lines.${index}.quantity`)} />
                </div>
                <div className="md:col-span-2">
                  <Input placeholder="Rate" {...form.register(`lines.${index}.unitRate`)} />
                </div>
                <div className="md:col-span-1">
                  <Input placeholder="GST %" {...form.register(`lines.${index}.gstRate`)} />
                </div>
                <div className="md:col-span-2 flex items-center">
                  {fields.length > 1 && (
                    <ErpButton type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      Remove
                    </ErpButton>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Freight / other charges</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Freight">
              <Input {...form.register('freightAmount')} />
            </FormField>
            <FormField label="Other charges">
              <Input {...form.register('otherChargesAmount')} />
            </FormField>
          </div>
        </section>

        <FormField label="Narration">
          <Textarea rows={2} {...form.register('narration')} />
        </FormField>

        <div className="grid gap-4 lg:grid-cols-2">
          <TotalsPanel {...previewTotals} preview />
          <details className="rounded border border-erp-border p-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-erp-muted">Accounting (collapsed)</summary>
            <p className="mt-2 text-[12px] text-erp-muted">
              Revenue reversal and receivable accounts resolve from default mappings on save/post (server).
            </p>
          </details>
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

export function CreditNoteNewPage() {
  return <CreditNoteFormPage mode="create" />
}

export function CreditNoteEditPage() {
  return <CreditNoteFormPage mode="edit" />
}
