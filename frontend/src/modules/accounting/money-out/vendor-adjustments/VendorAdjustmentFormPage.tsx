import { useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ErpButton } from '@/components/erp/ErpButton'
import { VendorMasterSelect } from '@/components/masters/VendorMasterSelect'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import {
  createVendorAdjustmentDraft,
  getVendorAdjustment,
  updateVendorAdjustmentDraft,
} from '@/services/bridges/payablesApiBridge'
import { useActiveVendors } from '@/hooks/useMasterLists'
import { notify } from '@/store/toastStore'
import type { CreateVendorAdjustmentInput, VendorAdjustmentType } from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { VendorInvoiceTotalsPanel } from '../components/VendorInvoiceTotalsPanel'
import { ADJUSTMENT_REASON_LABELS, ADJUSTMENT_TYPE_LABELS, todayIsoDate } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const lineSchema = z.object({
  lineType: z.enum(['ITEM', 'SERVICE', 'EXPENSE', 'ASSET', 'FREIGHT', 'OTHER_CHARGE', 'TAX_CORRECTION', 'OTHER']),
  description: z.string().min(1, 'Description required'),
  hsnSacCode: z.string().optional(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid quantity'),
  unitPrice: z.string().regex(/^-?\d+(\.\d+)?$/, 'Invalid rate'),
  gstRate: z.string().optional(),
  offsetAccountId: z.string().optional(),
})

const formSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  adjustmentType: z.enum(['VENDOR_DEBIT_NOTE', 'VENDOR_CREDIT_ADJUSTMENT']),
  reason: z.enum([
    'PURCHASE_RETURN',
    'RATE_DIFFERENCE',
    'SHORT_SUPPLY',
    'QUALITY_CLAIM',
    'DAMAGE_CLAIM',
    'COMMERCIAL_DISCOUNT',
    'FREIGHT_RECOVERY',
    'TAX_CORRECTION',
    'TDS_CORRECTION',
    'ROUND_OFF',
    'OPENING_CORRECTION',
    'OTHER',
  ]),
  supplierReferenceNumber: z.string().min(1, 'Supplier reference required'),
  supplierReferenceDate: z.string().min(1),
  documentDate: z.string().min(1),
  dueDate: z.string().optional(),
  currencyCode: z.string().min(3).max(8),
  exchangeRate: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid exchange rate'),
  purchaseTaxTreatment: z.enum([
    'REGULAR',
    'REVERSE_CHARGE',
    'IMPORT_GOODS',
    'IMPORT_SERVICE',
    'SEZ',
    'NON_GST',
    'EXEMPT',
    'NIL_RATED',
  ]),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  freightAmount: z.string().optional(),
  otherChargeAmount: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line required'),
})

type FormValues = z.infer<typeof formSchema>

function emptyLine(): FormValues['lines'][number] {
  return {
    lineType: 'EXPENSE',
    description: 'Adjustment line',
    hsnSacCode: '',
    quantity: '1',
    unitPrice: '0',
    gstRate: '18',
    offsetAccountId: '',
  }
}

export function VendorAdjustmentFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const perms = useMoneyOutPermissions()
  const vendors = useActiveVendors()
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [draftReference, setDraftReference] = useState<string>()
  const [serverTotals, setServerTotals] = useState<{
    taxable: string
    cgst: string
    sgst: string
    igst: string
    grandTotal: string
    tds: string
    vendorPayable: string
  } | null>(null)

  const defaultType = (searchParams.get('type') as VendorAdjustmentType) || 'VENDOR_DEBIT_NOTE'

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: '',
      adjustmentType: defaultType === 'VENDOR_CREDIT_ADJUSTMENT' ? 'VENDOR_CREDIT_ADJUSTMENT' : 'VENDOR_DEBIT_NOTE',
      reason: 'OTHER',
      supplierReferenceNumber: '',
      supplierReferenceDate: todayIsoDate(),
      documentDate: todayIsoDate(),
      dueDate: '',
      currencyCode: 'INR',
      exchangeRate: '1',
      purchaseTaxTreatment: 'REGULAR',
      supplyType: 'INTRA_STATE',
      freightAmount: '0',
      otherChargeAmount: '0',
      lines: [emptyLine()],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()
  const isDirty = form.formState.isDirty
  const blocker = useBlocker(isDirty && !saving)

  useEffect(() => {
    if (blocker.state !== 'blocked') return
    const ok = window.confirm('You have unsaved changes. Leave this page?')
    if (ok) blocker.proceed()
    else blocker.reset()
  }, [blocker])

  useEffect(() => {
    if (mode !== 'edit' || !id || !isApiMode()) return
    setLoading(true)
    getVendorAdjustment(id)
      .then((adj) => {
        setUpdatedAt(adj.updatedAt)
        setDraftReference(adj.draftReference)
        setServerTotals({
          taxable: adj.taxableAmount,
          cgst: adj.inputCgstAmount,
          sgst: adj.inputSgstAmount,
          igst: adj.inputIgstAmount,
          grandTotal: adj.adjustmentGrandTotal,
          tds: adj.tdsAmount,
          vendorPayable: adj.vendorPayableAmount,
        })
        form.reset({
          vendorId: adj.vendorId,
          adjustmentType: adj.adjustmentType,
          reason: adj.reason,
          supplierReferenceNumber: adj.supplierReferenceNumber,
          supplierReferenceDate: adj.supplierReferenceDate,
          documentDate: adj.documentDate,
          dueDate: adj.dueDate ?? '',
          currencyCode: adj.currencyCode,
          exchangeRate: adj.exchangeRate,
          purchaseTaxTreatment: adj.purchaseTaxTreatment,
          supplyType: 'INTRA_STATE',
          freightAmount: adj.freightAmount,
          otherChargeAmount: adj.otherChargeAmount,
          lines: adj.lines.map((l) => ({
            lineType: l.lineType,
            description: l.description,
            hsnSacCode: l.hsnSacCode ?? '',
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            gstRate: l.igstRate !== '0' ? l.igstRate : l.cgstRate !== '0' ? String(Number(l.cgstRate) * 2) : '0',
            offsetAccountId: l.offsetAccountId ?? '',
          })),
        })
      })
      .catch((e) => notify.error(e instanceof Error ? e.message : 'Failed to load adjustment'))
      .finally(() => setLoading(false))
  }, [form, id, mode])

  const selectedVendor = useMemo(() => vendors.find((v) => v.id === watched.vendorId), [vendors, watched.vendorId])

  const buildPayload = (values: FormValues): CreateVendorAdjustmentInput => ({
    legalEntityId: resolveLegalEntityId(),
    vendorId: values.vendorId,
    adjustmentType: values.adjustmentType,
    reason: values.reason,
    supplierReferenceNumber: values.supplierReferenceNumber.trim(),
    supplierReferenceDate: values.supplierReferenceDate,
    documentDate: values.documentDate,
    dueDate: values.dueDate || null,
    currencyCode: values.currencyCode,
    exchangeRate: values.exchangeRate,
    purchaseTaxTreatment: values.purchaseTaxTreatment,
    supplyType: values.supplyType,
    freightAmount: values.freightAmount || '0',
    otherChargeAmount: values.otherChargeAmount || '0',
    lines: values.lines.map((line, idx) => {
      const gst = Number(line.gstRate || '0')
      const isInter = values.supplyType === 'INTER_STATE'
      return {
        lineNumber: idx + 1,
        lineType: line.lineType,
        description: line.description,
        hsnSacCode: line.hsnSacCode || null,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        cgstRate: isInter ? '0' : String(gst / 2),
        sgstRate: isInter ? '0' : String(gst / 2),
        igstRate: isInter ? String(gst) : '0',
        offsetAccountId: line.offsetAccountId || null,
      }
    }),
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createVendorAdjustmentDraft(buildPayload(values))
        notify.success('Draft vendor adjustment created')
        navigate(`/accounting/money-out/vendor-adjustments/${created.id}`)
      } else if (id && updatedAt) {
        const { legalEntityId: _le, ...rest } = buildPayload(values)
        const updated = await updateVendorAdjustmentDraft(id, { ...rest, expectedUpdatedAt: updatedAt })
        notify.success('Draft saved')
        setUpdatedAt(updated.updatedAt)
        setServerTotals({
          taxable: updated.taxableAmount,
          cgst: updated.inputCgstAmount,
          sgst: updated.inputSgstAmount,
          igst: updated.inputIgstAmount,
          grandTotal: updated.adjustmentGrandTotal,
          tds: updated.tdsAmount,
          vendorPayable: updated.vendorPayableAmount,
        })
        form.reset(values)
      }
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  })

  if (!perms.canViewAdjustment) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustment">
        <p className="text-[13px] text-erp-muted">You do not have permission to view vendor adjustments.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustment">
        <p className="text-[13px] text-erp-muted">Vendor adjustments require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Adjustment">
        <LoadingState variant="card" />
      </MoneyOutWorkspaceShell>
    )
  }

  const canSave = mode === 'create' ? perms.canCreateAdjustment : perms.canEditAdjustment

  return (
    <MoneyOutWorkspaceShell
      title={mode === 'create' ? 'New Vendor Adjustment' : `Edit ${draftReference ?? 'Adjustment'}`}
      actions={
        <div className="flex gap-2">
          <ErpButton variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </ErpButton>
          {canSave && (
            <ErpButton variant="primary" onClick={() => void onSubmit()} disabled={saving}>
              {saving ? 'Saving…' : 'Save Draft'}
            </ErpButton>
          )}
        </div>
      }
    >
      <form className="grid gap-4 lg:grid-cols-[1fr_280px]" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Vendor" error={form.formState.errors.vendorId?.message}>
              <VendorMasterSelect value={watched.vendorId} onChange={(v) => form.setValue('vendorId', v, { shouldDirty: true })} />
            </FormField>
            <FormField label="Adjustment type">
              <Select {...form.register('adjustmentType')}>
                <option value="VENDOR_DEBIT_NOTE">{ADJUSTMENT_TYPE_LABELS.VENDOR_DEBIT_NOTE}</option>
                <option value="VENDOR_CREDIT_ADJUSTMENT">{ADJUSTMENT_TYPE_LABELS.VENDOR_CREDIT_ADJUSTMENT}</option>
              </Select>
            </FormField>
            <FormField label="Reason">
              <Select {...form.register('reason')}>
                {Object.entries(ADJUSTMENT_REASON_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </Select>
            </FormField>
            <FormField label="Supplier reference" error={form.formState.errors.supplierReferenceNumber?.message}>
              <Input {...form.register('supplierReferenceNumber')} />
            </FormField>
            <FormField label="Supplier reference date">
              <Input type="date" {...form.register('supplierReferenceDate')} />
            </FormField>
            <FormField label="Document date">
              <Input type="date" {...form.register('documentDate')} />
            </FormField>
            <FormField label="Due date">
              <Input type="date" {...form.register('dueDate')} />
            </FormField>
            <FormField label="Supply type">
              <Select {...form.register('supplyType')}>
                <option value="INTRA_STATE">Intra-state</option>
                <option value="INTER_STATE">Inter-state</option>
              </Select>
            </FormField>
          </div>

          {selectedVendor && (
            <p className="text-[12px] text-erp-muted">
              Vendor: {selectedVendor.vendorName} ({selectedVendor.vendorCode})
            </p>
          )}

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Lines</h3>
              <ErpButton type="button" variant="secondary" onClick={() => append(emptyLine())}>
                Add line
              </ErpButton>
            </div>
            <div className="space-y-3">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded border border-erp-border p-3">
                  <div className="mb-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <Select {...form.register(`lines.${index}.lineType`)}>
                      <option value="EXPENSE">Expense</option>
                      <option value="ITEM">Item</option>
                      <option value="SERVICE">Service</option>
                      <option value="TAX_CORRECTION">Tax correction</option>
                      <option value="OTHER">Other</option>
                    </Select>
                    <Input placeholder="Description" {...form.register(`lines.${index}.description`)} />
                    <Input placeholder="Qty" {...form.register(`lines.${index}.quantity`)} />
                    <Input placeholder="Unit price" {...form.register(`lines.${index}.unitPrice`)} />
                    <Input placeholder="GST %" {...form.register(`lines.${index}.gstRate`)} />
                    <Input placeholder="HSN/SAC" {...form.register(`lines.${index}.hsnSacCode`)} />
                  </div>
                  {fields.length > 1 && (
                    <ErpButton type="button" variant="ghost" onClick={() => remove(index)}>
                      Remove line
                    </ErpButton>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {serverTotals && (
          <VendorInvoiceTotalsPanel
            taxable={serverTotals.taxable}
            cgst={serverTotals.cgst}
            sgst={serverTotals.sgst}
            igst={serverTotals.igst}
            grandTotal={serverTotals.grandTotal}
            tds={serverTotals.tds}
            vendorPayable={serverTotals.vendorPayable}
          />
        )}
      </form>
    </MoneyOutWorkspaceShell>
  )
}

export function VendorAdjustmentNewPage() {
  return <VendorAdjustmentFormPage mode="create" />
}

export function VendorAdjustmentEditPage() {
  return <VendorAdjustmentFormPage mode="edit" />
}
