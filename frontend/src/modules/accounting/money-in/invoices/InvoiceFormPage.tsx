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
  createSalesInvoice,
  getSalesInvoice,
  listDemoCustomers,
  updateSalesInvoice,
} from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { notify } from '@/store/toastStore'
import { previewInterLineTotal, previewLineTotal } from '../moneyInUi'
import { TotalsPanel } from '../components/TotalsPanel'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'

const lineSchema = z.object({
  description: z.string().min(1, 'Description required'),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  hsnCode: z.string().optional(),
})

const formSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  invoiceDate: z.string().min(1),
  postingDate: z.string().min(1),
  dueDate: z.string().optional(),
  customerPoNumber: z.string().optional(),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  taxTreatment: z.enum(['REGISTERED', 'UNREGISTERED']),
  freightAmount: z.string().optional(),
  otherChargesAmount: z.string().optional(),
  narration: z.string().optional(),
  lines: z.array(lineSchema).min(1),
})

type FormValues = z.infer<typeof formSchema>

function today() {
  return new Date().toISOString().slice(0, 10)
}

export function InvoiceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const customers = listDemoCustomers()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [wasReady, setWasReady] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: customers[0]?.id ?? '',
      invoiceDate: today(),
      postingDate: today(),
      supplyType: 'INTRA_STATE',
      taxTreatment: 'REGISTERED',
      freightAmount: '0',
      otherChargesAmount: '0',
      lines: [{ description: 'Trailer component / service', quantity: '1', unitPrice: '100000', hsnCode: '8716' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()

  const previewTotals = useMemo(() => {
    const inter = watched.supplyType === 'INTER_STATE'
    let subtotal = 0
    let discount = 0
    let taxable = 0
    let cgst = 0
    let sgst = 0
    let igst = 0
    for (const line of watched.lines ?? []) {
      const calc = inter
        ? previewInterLineTotal(Number(line.quantity), Number(line.unitPrice))
        : previewLineTotal(Number(line.quantity), Number(line.unitPrice))
      subtotal += calc.grossAmount
      discount += calc.discountAmount
      taxable += calc.taxableAmount
      cgst += calc.cgstAmount
      sgst += calc.sgstAmount
      igst += calc.igstAmount
    }
    const freight = Number(watched.freightAmount || 0)
    const other = Number(watched.otherChargesAmount || 0)
    const total = taxable + cgst + sgst + igst + freight + other
    return {
      subtotal: subtotal.toFixed(2),
      discount: discount.toFixed(2),
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
      const inv = await getSalesInvoice(id)
      setUpdatedAt(inv.updatedAt)
      setWasReady(inv.status === 'READY_TO_POST')
      form.reset({
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate,
        postingDate: inv.postingDate ?? inv.invoiceDate,
        dueDate: inv.dueDate ?? undefined,
        customerPoNumber: inv.customerPoNumber ?? '',
        supplyType: inv.supplyType === 'INTER_STATE' ? 'INTER_STATE' : 'INTRA_STATE',
        taxTreatment: inv.taxTreatment === 'UNREGISTERED' ? 'UNREGISTERED' : 'REGISTERED',
        freightAmount: inv.freightAmount,
        otherChargesAmount: inv.otherChargesAmount,
        narration: inv.narration ?? '',
        lines: (inv.lines ?? []).map((l) => ({
          description: l.description ?? l.itemNameSnapshot ?? '',
          quantity: l.quantity,
          unitPrice: l.unitRate,
          hsnCode: l.hsnCodeSnapshot ?? '',
        })),
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice')
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
    invoiceDate: values.invoiceDate,
    postingDate: values.postingDate,
    dueDate: values.dueDate || null,
    customerPoNumber: values.customerPoNumber || null,
    supplyType: values.supplyType,
    taxTreatment: values.taxTreatment,
    freightAmount: values.freightAmount ?? '0',
    otherChargesAmount: values.otherChargesAmount ?? '0',
    narration: values.narration || null,
    lines: values.lines.map((l, idx) => ({
      lineNumber: idx + 1,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      hsnCode: l.hsnCode || null,
    })),
    ...(mode === 'edit' && updatedAt ? { updatedAt } : {}),
  })

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createSalesInvoice(buildPayload(values))
        notify.success('Draft saved')
        navigate(`/accounting/money-in/invoices/${created.id}`)
      } else if (id) {
        const updated = await updateSalesInvoice(id, buildPayload(values) as Parameters<typeof updateSalesInvoice>[1])
        setUpdatedAt(updated.updatedAt)
        notify.success(wasReady ? 'Saved — invoice returned to Draft' : 'Draft updated')
        navigate(`/accounting/money-in/invoices/${id}`)
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Save failed'
      notify.error(msg)
      if (msg.includes('changed by another user') && id) void loadExisting()
    } finally {
      setSaving(false)
    }
  })

  const canEdit = mode === 'create' ? perms.canCreateInvoice : perms.canEditInvoice

  if (!canEdit) {
    return (
      <MoneyInWorkspaceShell title={mode === 'create' ? 'New Invoice' : 'Edit Invoice'}>
        <p className="text-[13px] text-erp-muted">You do not have permission to {mode === 'create' ? 'create' : 'edit'} invoices.</p>
      </MoneyInWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyInWorkspaceShell title="Edit Invoice">
        <LoadingState variant="form" />
      </MoneyInWorkspaceShell>
    )
  }

  return (
    <MoneyInWorkspaceShell title={mode === 'create' ? 'New Invoice' : 'Edit Invoice'}>
      {wasReady && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Editing a Ready to Post invoice returns it to Draft — mark ready again before posting.
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
            <FormField label="Customer PO">
              <Input {...form.register('customerPoNumber')} />
            </FormField>
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
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Dates</h3>
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Invoice date" error={form.formState.errors.invoiceDate?.message}>
              <Input type="date" {...form.register('invoiceDate')} />
            </FormField>
            <FormField label="Posting date">
              <Input type="date" {...form.register('postingDate')} />
            </FormField>
            <FormField label="Due date">
              <Input type="date" {...form.register('dueDate')} />
            </FormField>
          </div>
        </section>

        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Lines</h3>
            <ErpButton type="button" variant="secondary" size="sm" onClick={() => append({ description: '', quantity: '1', unitPrice: '0', hsnCode: '8716' })}>
              Add line
            </ErpButton>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded border border-erp-border p-2 md:grid-cols-12">
                <div className="md:col-span-4">
                  <Input placeholder="Description" {...form.register(`lines.${index}.description`)} />
                </div>
                <div className="md:col-span-2">
                  <Input placeholder="Qty" {...form.register(`lines.${index}.quantity`)} />
                </div>
                <div className="md:col-span-2">
                  <Input placeholder="Rate" {...form.register(`lines.${index}.unitPrice`)} />
                </div>
                <div className="md:col-span-2">
                  <Input placeholder="HSN" {...form.register(`lines.${index}.hsnCode`)} />
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
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Discounts / freight</h3>
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
            <p className="mt-2 text-[12px] text-erp-muted">Revenue and receivable accounts resolve from default mappings on save/post (server).</p>
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

export function InvoiceNewPage() {
  return <InvoiceFormPage mode="create" />
}

export function InvoiceEditPage() {
  return <InvoiceFormPage mode="edit" />
}
