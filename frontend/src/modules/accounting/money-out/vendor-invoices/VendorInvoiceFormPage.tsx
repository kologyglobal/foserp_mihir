import { useCallback, useEffect, useMemo, useState } from 'react'
import { useBlocker, useNavigate, useParams } from 'react-router-dom'
import { useFieldArray, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpSmartSelect, type ErpSmartSelectOption } from '@/components/erp/ErpSmartSelect'
import { VendorMasterSelect } from '@/components/masters/VendorMasterSelect'
import { FormField } from '@/components/forms/FormField'
import { Input, Select } from '@/components/forms/Inputs'
import { LoadingState } from '@/design-system/components/LoadingState'
import { isApiMode } from '@/config/apiConfig'
import { listAccounts, resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import {
  createVendorInvoiceDraft,
  getVendorInvoice,
  updateVendorInvoiceDraft,
} from '@/services/bridges/payablesApiBridge'
import {
  listGrnLookups,
  listPurchaseOrderLookups,
  type AccountingGrnLookup,
  type AccountingPurchaseOrderLookup,
} from '@/services/api/accountingLookupsApi'
import { useActiveVendors } from '@/hooks/useMasterLists'
import { useMasterStore } from '@/store/masterStore'
import { notify } from '@/store/toastStore'
import { PartyMasterCard } from '@/modules/accounting/shared/invoices'
import type {
  CreateVendorInvoiceInput,
  VendorInvoiceLineType,
  VendorInvoiceSourceLinkInput,
  VendorInvoiceType,
} from '@/types/moneyOut'
import { useMoneyOutPermissions } from '@/utils/permissions/moneyOut'
import { VendorInvoiceTotalsPanel } from '../components/VendorInvoiceTotalsPanel'
import { addDaysIso, todayIsoDate } from '../moneyOutUi'
import { MoneyOutWorkspaceShell } from '../MoneyOutWorkspaceShell'

const lineSchema = z.object({
  lineType: z.enum(['ITEM', 'SERVICE', 'EXPENSE', 'ASSET', 'FREIGHT', 'OTHER_CHARGE']),
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  hsnSacCode: z.string().optional(),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid quantity'),
  unitPrice: z.string().regex(/^-?\d+(\.\d+)?$/, 'Invalid rate'),
  gstRate: z.string().optional(),
  debitAccountId: z.string().optional(),
  costCentreId: z.string().optional(),
  projectReference: z.string().optional(),
})

const formSchema = z.object({
  vendorId: z.string().min(1, 'Vendor required'),
  invoiceType: z.enum(['GOODS', 'SERVICE', 'EXPENSE', 'ASSET', 'MIXED']),
  supplierInvoiceNumber: z.string().min(1, 'Supplier invoice number required'),
  supplierInvoiceDate: z.string().min(1),
  documentDate: z.string().min(1),
  postingDate: z.string().optional(),
  dueDate: z.string().optional(),
  currencyCode: z.string().min(3).max(8),
  exchangeRate: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid exchange rate'),
  taxTreatment: z.enum([
    'REGULAR',
    'REVERSE_CHARGE',
    'IMPORT_GOODS',
    'IMPORT_SERVICE',
    'SEZ',
    'NON_GST',
    'EXEMPT',
    'NIL_RATED',
  ]),
  itcEligibility: z.enum(['PENDING_REVIEW', 'ELIGIBLE', 'PARTIALLY_ELIGIBLE', 'INELIGIBLE']),
  itcEligiblePercent: z.string().optional(),
  tdsRecognitionMode: z.enum(['NOT_APPLICABLE', 'AT_INVOICE', 'AT_PAYMENT']),
  tdsSectionCode: z.string().optional(),
  tdsRate: z.string().optional(),
  supplyType: z.enum(['INTRA_STATE', 'INTER_STATE']),
  freightAmount: z.string().optional(),
  otherChargeAmount: z.string().optional(),
  paymentTermsDays: z.string().optional(),
  lines: z.array(lineSchema).min(1, 'At least one line required'),
})

type FormValues = z.infer<typeof formSchema>

function defaultLineType(invoiceType: VendorInvoiceType): VendorInvoiceLineType {
  switch (invoiceType) {
    case 'SERVICE':
      return 'SERVICE'
    case 'EXPENSE':
      return 'EXPENSE'
    case 'ASSET':
      return 'ASSET'
    case 'GOODS':
    case 'MIXED':
    default:
      return 'ITEM'
  }
}

function emptyLine(invoiceType: VendorInvoiceType): FormValues['lines'][number] {
  return {
    lineType: defaultLineType(invoiceType),
    itemId: '',
    description: invoiceType === 'EXPENSE' ? 'Expense' : '',
    hsnSacCode: '',
    quantity: '1',
    unitPrice: '0',
    gstRate: '18',
    debitAccountId: '',
    costCentreId: '',
    projectReference: '',
  }
}

/** VI create source mode (Wave 3) — Direct entry, or sourced from a real PO / GRN. */
type VendorInvoiceCreateSource = 'DIRECT' | 'PURCHASE_ORDER' | 'GOODS_RECEIPT'

export function VendorInvoiceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
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
    cess: string
    nonRecoverable: string
    freight: string
    other: string
    roundOff: string
    grandTotal: string
    tds: string
    vendorPayable: string
  } | null>(null)
  const [expenseAccounts, setExpenseAccounts] = useState<Array<{ id: string; code: string; name: string }>>([])
  const [quickMode, setQuickMode] = useState(mode === 'create')
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [createSource, setCreateSource] = useState<VendorInvoiceCreateSource>('DIRECT')
  const [selectedPoId, setSelectedPoId] = useState('')
  const [selectedGrnId, setSelectedGrnId] = useState('')
  const [purchaseOrders, setPurchaseOrders] = useState<AccountingPurchaseOrderLookup[]>([])
  const [goodsReceipts, setGoodsReceipts] = useState<AccountingGrnLookup[]>([])
  const [sourcesLoading, setSourcesLoading] = useState(false)
  /** Existing source links loaded on edit — resent unchanged (never re-fabricated). */
  const [existingSourceLinks, setExistingSourceLinks] = useState<VendorInvoiceSourceLinkInput[]>([])
  const items = useMasterStore((s) => s.items)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      vendorId: '',
      invoiceType: 'EXPENSE',
      supplierInvoiceNumber: '',
      supplierInvoiceDate: todayIsoDate(),
      documentDate: todayIsoDate(),
      postingDate: todayIsoDate(),
      dueDate: '',
      currencyCode: 'INR',
      exchangeRate: '1',
      taxTreatment: 'REGULAR',
      itcEligibility: 'PENDING_REVIEW',
      itcEligiblePercent: '100',
      tdsRecognitionMode: 'NOT_APPLICABLE',
      tdsSectionCode: '',
      tdsRate: '0',
      supplyType: 'INTRA_STATE',
      freightAmount: '0',
      otherChargeAmount: '0',
      paymentTermsDays: '',
      lines: [emptyLine('EXPENSE')],
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
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirty && !saving) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty, saving])

  useEffect(() => {
    if (!isApiMode()) return
    listAccounts(resolveLegalEntityId())
      .then((accounts) => {
        const filtered = accounts
          .filter((a) => a.isActive && !a.isGroup)
          .map((a) => ({ id: a.id, code: a.accountCode, name: a.accountName }))
        setExpenseAccounts(filtered)
      })
      .catch(() => {
        /* account picker optional for draft if mappings resolve server-side */
      })
  }, [])

  const selectedVendor = useMemo(
    () => vendors.find((v) => v.id === watched.vendorId),
    [vendors, watched.vendorId],
  )

  // Invoice-eligible PO / GRN candidates from the accounting lookup endpoints
  // (server-side eligibility whitelist + tenant scope — no frontend status filter).
  useEffect(() => {
    if (mode !== 'create' || !isApiMode() || createSource === 'DIRECT') return
    let cancelled = false
    setSourcesLoading(true)
    const load = async () => {
      try {
        if (createSource === 'PURCHASE_ORDER') {
          const res = await listPurchaseOrderLookups({ eligibleOnly: true, limit: 100 })
          if (!cancelled) setPurchaseOrders(res.data ?? [])
        } else {
          const res = await listGrnLookups({ eligibleOnly: true, limit: 100 })
          if (!cancelled) setGoodsReceipts(res.data ?? [])
        }
      } catch (e) {
        if (!cancelled) {
          notify.error(e instanceof Error ? e.message : 'Failed to load purchase documents')
        }
      } finally {
        if (!cancelled) setSourcesLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [createSource, mode])

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vendors) map.set(v.id, v.vendorName)
    return map
  }, [vendors])

  const poOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      purchaseOrders.map((po) => {
        const vendorName = vendorNameById.get(po.vendorId)
        return {
          value: po.id,
          label: po.orderNumber,
          subtitle: [vendorName, String(po.status).replace(/_/g, ' ')].filter(Boolean).join(' · ') || undefined,
          searchText: `${po.orderNumber} ${vendorName ?? ''}`.toLowerCase(),
        }
      }),
    [purchaseOrders, vendorNameById],
  )

  const grnOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      goodsReceipts.map((g) => {
        const vendorName = vendorNameById.get(g.vendorId)
        return {
          value: g.id,
          label: g.grnNumber,
          subtitle: [vendorName, g.purchaseOrderNumber].filter(Boolean).join(' · ') || undefined,
          searchText: `${g.grnNumber} ${vendorName ?? ''} ${g.purchaseOrderNumber ?? ''}`.toLowerCase(),
        }
      }),
    [goodsReceipts, vendorNameById],
  )

  const itemOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      items
        .filter((i) => i.isActive && i.isPurchasable)
        .map((i) => ({
          value: i.id,
          label: `${i.itemCode} — ${i.itemName}`,
          searchText: `${i.itemCode} ${i.itemName} ${i.hsnCode ?? ''}`.toLowerCase(),
        })),
    [items],
  )

  const onPickPurchaseOrder = (poId: string) => {
    setSelectedPoId(poId)
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po) return
    form.setValue('vendorId', po.vendorId, { shouldDirty: true, shouldValidate: true })
    form.setValue('invoiceType', 'GOODS', { shouldDirty: true })
    if (po.currencyCode) form.setValue('currencyCode', po.currencyCode, { shouldDirty: true })
    setQuickMode(false)
  }

  const onPickGoodsReceipt = (grnId: string) => {
    setSelectedGrnId(grnId)
    const grn = goodsReceipts.find((g) => g.id === grnId)
    if (!grn) return
    form.setValue('vendorId', grn.vendorId, { shouldDirty: true, shouldValidate: true })
    form.setValue('invoiceType', 'GOODS', { shouldDirty: true })
    setQuickMode(false)
  }

  const onPickLineItem = (index: number, itemId: string) => {
    form.setValue(`lines.${index}.itemId`, itemId, { shouldDirty: true })
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    form.setValue(`lines.${index}.description`, item.itemName, { shouldDirty: true })
    if (item.hsnCode) form.setValue(`lines.${index}.hsnSacCode`, item.hsnCode, { shouldDirty: true })
  }

  useEffect(() => {
    if (!selectedVendor || mode !== 'create') return
    const days = selectedVendor.paymentTermsDays ?? 0
    const base = watched.supplierInvoiceDate || todayIsoDate()
    if (!form.getValues('dueDate')) {
      form.setValue('dueDate', addDaysIso(base, days))
    }
    form.setValue('paymentTermsDays', String(days))
  }, [selectedVendor, form, mode, watched.supplierInvoiceDate])

  useEffect(() => {
    const invType = watched.invoiceType
    if (mode !== 'create' || !quickMode) return
    const lines = form.getValues('lines')
    if (lines.length === 1) {
      form.setValue('lines.0.lineType', defaultLineType(invType))
    }
  }, [watched.invoiceType, form, mode, quickMode])

  const loadExisting = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const inv = await getVendorInvoice(id)
      if (!inv.allowedActions.edit) {
        notify.error('This invoice cannot be edited')
        navigate(`/accounting/money-out/vendor-invoices/${id}`)
        return
      }
      setUpdatedAt(inv.updatedAt)
      setDraftReference(inv.draftReference)
      setQuickMode(false)
      setServerTotals({
        taxable: inv.taxableAmount,
        cgst: inv.inputCgstAmount,
        sgst: inv.inputSgstAmount,
        igst: inv.inputIgstAmount,
        cess: inv.inputCessAmount,
        nonRecoverable: inv.nonRecoverableTaxAmount,
        freight: inv.freightAmount,
        other: inv.otherChargeAmount,
        roundOff: inv.roundOffAmount,
        grandTotal: inv.invoiceGrandTotal,
        tds: inv.tdsAmount,
        vendorPayable: inv.vendorPayableAmount,
      })
      setExistingSourceLinks(
        (inv.sourceLinks ?? []).map((s) => ({
          sourceType: s.sourceType,
          sourceDocumentId: s.sourceDocumentId,
          sourceDocumentNumberSnapshot: s.sourceDocumentNumberSnapshot ?? null,
          sourceDocumentDateSnapshot: s.sourceDocumentDateSnapshot ?? null,
        })),
      )
      form.reset({
        vendorId: inv.vendorId,
        invoiceType: inv.invoiceType,
        supplierInvoiceNumber: inv.supplierInvoiceNumber,
        supplierInvoiceDate: inv.supplierInvoiceDate,
        documentDate: inv.documentDate,
        postingDate: inv.postingDate ?? inv.documentDate,
        dueDate: inv.dueDate ?? '',
        currencyCode: inv.currencyCode,
        exchangeRate: inv.exchangeRate,
        taxTreatment: inv.taxTreatment,
        itcEligibility: inv.itcEligibility,
        itcEligiblePercent: '100',
        tdsRecognitionMode: inv.tdsRecognitionMode,
        tdsSectionCode: inv.tdsSectionCode ?? '',
        tdsRate: inv.tdsRate,
        supplyType: 'INTRA_STATE',
        freightAmount: inv.freightAmount,
        otherChargeAmount: inv.otherChargeAmount,
        paymentTermsDays: '',
        lines: (inv.lines ?? []).map((l) => ({
          lineType: l.lineType,
          itemId: l.itemId ?? '',
          description: l.description,
          hsnSacCode: l.hsnSacCode ?? '',
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          gstRate: l.igstRate !== '0' ? l.igstRate : String(Number(l.cgstRate) + Number(l.sgstRate) || 18),
          debitAccountId: l.debitAccountId ?? '',
          costCentreId: l.costCentreId ?? '',
          projectReference: l.projectReference ?? '',
        })),
      })
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load invoice')
    } finally {
      setLoading(false)
    }
  }, [form, id, navigate])

  useEffect(() => {
    if (mode === 'edit') void loadExisting()
  }, [loadExisting, mode])

  const buildPayload = (values: FormValues): CreateVendorInvoiceInput => {
    // Real source documents only — fabricated UUIDs are gone (Wave 3).
    // Backend Wave 2 validates PO/GRN existence + vendor match on these ids.
    let sourceLinks: VendorInvoiceSourceLinkInput[] = []
    if (mode === 'edit') {
      sourceLinks = existingSourceLinks
    } else if (createSource === 'PURCHASE_ORDER' && selectedPoId) {
      const po = purchaseOrders.find((p) => p.id === selectedPoId)
      sourceLinks = [
        {
          sourceType: 'PURCHASE_ORDER',
          sourceDocumentId: selectedPoId,
          sourceDocumentNumberSnapshot: po?.orderNumber ?? null,
          sourceDocumentDateSnapshot: po?.orderDate ?? null,
        },
      ]
    } else if (createSource === 'GOODS_RECEIPT' && selectedGrnId) {
      const grn = goodsReceipts.find((g) => g.id === selectedGrnId)
      sourceLinks = [
        {
          sourceType: 'GOODS_RECEIPT',
          sourceDocumentId: selectedGrnId,
          sourceDocumentNumberSnapshot: grn?.grnNumber ?? null,
          sourceDocumentDateSnapshot: grn?.receiptDate ?? null,
        },
      ]
      if (grn?.purchaseOrderId) {
        sourceLinks.push({
          sourceType: 'PURCHASE_ORDER',
          sourceDocumentId: grn.purchaseOrderId,
          sourceDocumentNumberSnapshot: grn.purchaseOrderNumber ?? null,
          sourceDocumentDateSnapshot: null,
        })
      }
    }

    const linkedItem = (itemId?: string) => (itemId ? items.find((i) => i.id === itemId) : undefined)

    return {
      legalEntityId: resolveLegalEntityId(),
      vendorId: values.vendorId,
      invoiceType: values.invoiceType,
      supplierInvoiceNumber: values.supplierInvoiceNumber,
      supplierInvoiceDate: values.supplierInvoiceDate,
      documentDate: values.documentDate,
      dueDate: values.dueDate || null,
      postingDate: values.postingDate || values.documentDate,
      currencyCode: values.currencyCode,
      exchangeRate: values.exchangeRate,
      taxTreatment: values.taxTreatment,
      itcEligibility: values.itcEligibility,
      itcEligiblePercent:
        values.itcEligibility === 'PARTIALLY_ELIGIBLE' ? values.itcEligiblePercent || '0' : undefined,
      tdsRecognitionMode: values.tdsRecognitionMode,
      tdsSectionCode: values.tdsSectionCode || null,
      tdsRate: values.tdsRate || '0',
      supplyType: values.supplyType,
      freightAmount: values.freightAmount || '0',
      otherChargeAmount: values.otherChargeAmount || '0',
      paymentTermsDays: values.paymentTermsDays ? Number(values.paymentTermsDays) : null,
      lines: values.lines.map((l, idx) => {
        const item = linkedItem(l.itemId)
        return {
          lineNumber: idx + 1,
          lineType: l.lineType,
          itemId: l.itemId || null,
          itemCodeSnapshot: item?.itemCode ?? null,
          itemNameSnapshot: item?.itemName ?? null,
          description: l.description,
          hsnSacCode: l.hsnSacCode || null,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          gstRate: l.gstRate || '0',
          debitAccountId: l.debitAccountId || null,
          costCentreId: l.costCentreId || null,
          projectReference: l.projectReference || null,
        }
      }),
      sourceLinks,
    }
  }

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createVendorInvoiceDraft(buildPayload(values))
        form.reset(values)
        notify.success(`Draft saved — ${created.draftReference}`)
        navigate(`/accounting/money-out/vendor-invoices/${created.id}`)
      } else if (id && updatedAt) {
        const updated = await updateVendorInvoiceDraft(id, {
          ...buildPayload(values),
          expectedUpdatedAt: updatedAt,
        })
        setUpdatedAt(updated.updatedAt)
        setServerTotals({
          taxable: updated.taxableAmount,
          cgst: updated.inputCgstAmount,
          sgst: updated.inputSgstAmount,
          igst: updated.inputIgstAmount,
          cess: updated.inputCessAmount,
          nonRecoverable: updated.nonRecoverableTaxAmount,
          freight: updated.freightAmount,
          other: updated.otherChargeAmount,
          roundOff: updated.roundOffAmount,
          grandTotal: updated.invoiceGrandTotal,
          tds: updated.tdsAmount,
          vendorPayable: updated.vendorPayableAmount,
        })
        form.reset(values)
        notify.success('Draft updated — totals refreshed from server')
        navigate(`/accounting/money-out/vendor-invoices/${id}`)
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

  if (!isApiMode()) {
    return (
      <MoneyOutWorkspaceShell title="Vendor Invoice">
        <p className="text-[13px] text-erp-muted">Vendor invoices require API mode.</p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (!canEdit) {
    return (
      <MoneyOutWorkspaceShell title={mode === 'create' ? 'New Vendor Invoice' : 'Edit Vendor Invoice'}>
        <p className="text-[13px] text-erp-muted">
          You do not have permission to {mode === 'create' ? 'create' : 'edit'} vendor invoices.
        </p>
      </MoneyOutWorkspaceShell>
    )
  }

  if (loading) {
    return (
      <MoneyOutWorkspaceShell title="Edit Vendor Invoice">
        <LoadingState variant="form" />
      </MoneyOutWorkspaceShell>
    )
  }

  return (
    <MoneyOutWorkspaceShell title={mode === 'create' ? 'New Vendor Invoice' : 'Edit Vendor Invoice'}>
      {draftReference && (
        <p className="mb-3 text-[12px] text-erp-muted">
          Draft reference: <span className="font-medium text-erp-text">{draftReference}</span>
        </p>
      )}

      {mode === 'create' && (
        <>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Source</span>
            <ErpButton
              type="button"
              variant={createSource === 'DIRECT' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setCreateSource('DIRECT')
                setSelectedPoId('')
                setSelectedGrnId('')
              }}
            >
              Direct
            </ErpButton>
            <ErpButton
              type="button"
              variant={createSource === 'PURCHASE_ORDER' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setCreateSource('PURCHASE_ORDER')
                setSelectedGrnId('')
              }}
            >
              From Purchase Order
            </ErpButton>
            <ErpButton
              type="button"
              variant={createSource === 'GOODS_RECEIPT' ? 'primary' : 'secondary'}
              size="sm"
              onClick={() => {
                setCreateSource('GOODS_RECEIPT')
                setSelectedPoId('')
              }}
            >
              From GRN
            </ErpButton>
          </div>
          {createSource !== 'DIRECT' && (
            <div className="mb-3 max-w-md">
              <FormField label={createSource === 'PURCHASE_ORDER' ? 'Purchase order' : 'Goods receipt (GRN)'}>
                <ErpSmartSelect
                  options={createSource === 'PURCHASE_ORDER' ? poOptions : grnOptions}
                  value={createSource === 'PURCHASE_ORDER' ? selectedPoId : selectedGrnId}
                  onChange={createSource === 'PURCHASE_ORDER' ? onPickPurchaseOrder : onPickGoodsReceipt}
                  placeholder={createSource === 'PURCHASE_ORDER' ? 'Select purchase order…' : 'Select GRN…'}
                  emptyMessage={
                    sourcesLoading
                      ? 'Loading…'
                      : createSource === 'PURCHASE_ORDER'
                        ? 'No invoiceable purchase orders found'
                        : 'No invoiceable goods receipts found'
                  }
                  allowEmpty
                />
              </FormField>
              <p className="mt-1 text-[11px] text-erp-muted">
                Picking a document locks the vendor and records a real source link for Purchase matching.
              </p>
            </div>
          )}
          <div className="mb-3 flex flex-wrap gap-2">
            <ErpButton type="button" variant={quickMode ? 'primary' : 'secondary'} size="sm" onClick={() => setQuickMode(true)}>
              Quick expense
            </ErpButton>
            <ErpButton type="button" variant={!quickMode ? 'primary' : 'secondary'} size="sm" onClick={() => setQuickMode(false)}>
              Full invoice
            </ErpButton>
          </div>
        </>
      )}

      <form onSubmit={onSave} className="space-y-4">
        <section>
          <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-erp-muted">
            Vendor &amp; invoice
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <FormField
              label="Vendor"
              required
              error={form.formState.errors.vendorId?.message}
              hint={
                mode === 'create' && createSource !== 'DIRECT' && (selectedPoId || selectedGrnId)
                  ? 'Vendor comes from the selected source document.'
                  : undefined
              }
            >
              <VendorMasterSelect
                value={watched.vendorId}
                onChange={(vendorId) => form.setValue('vendorId', vendorId, { shouldDirty: true, shouldValidate: true })}
                disabled={mode === 'create' && createSource !== 'DIRECT' && Boolean(selectedPoId || selectedGrnId)}
                source="accounting"
                allowEmpty
              />
            </FormField>
            <FormField label="Supplier invoice number" required error={form.formState.errors.supplierInvoiceNumber?.message}>
              <Input {...form.register('supplierInvoiceNumber')} autoComplete="off" />
            </FormField>
            <FormField label="Invoice type">
              <Select {...form.register('invoiceType')}>
                <option value="EXPENSE">Expense</option>
                <option value="SERVICE">Service</option>
                <option value="GOODS">Goods</option>
                <option value="ASSET">Asset</option>
                <option value="MIXED">Mixed</option>
              </Select>
            </FormField>
            <FormField label="Supplier invoice date" required>
              <Input type="date" {...form.register('supplierInvoiceDate')} />
            </FormField>
            <FormField label="Document date" required>
              <Input type="date" {...form.register('documentDate')} />
            </FormField>
            <FormField label="Proposed posting date">
              <Input type="date" {...form.register('postingDate')} />
            </FormField>
            <FormField label="Due date">
              <Input type="date" {...form.register('dueDate')} />
            </FormField>
            {!quickMode && (
              <>
                <FormField label="Currency">
                  <Input {...form.register('currencyCode')} />
                </FormField>
                <FormField label="Exchange rate">
                  <Input {...form.register('exchangeRate')} />
                </FormField>
              </>
            )}
          </div>
          <PartyMasterCard variant="purchase" partyId={watched.vendorId} showQuickCreate />
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-muted">Invoice lines</h3>
            {!quickMode && (
              <ErpButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => append(emptyLine(watched.invoiceType))}
              >
                Add line
              </ErpButton>
            )}
          </div>

          {/* Mobile card layout */}
          <div className="space-y-2 md:hidden">
            {fields.map((field, index) => (
              <div key={field.id} className="rounded border border-erp-border p-3">
                <FormField label="Description">
                  <Input {...form.register(`lines.${index}.description`)} />
                </FormField>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <FormField label="Qty">
                    <Input {...form.register(`lines.${index}.quantity`)} />
                  </FormField>
                  <FormField label="Rate">
                    <Input {...form.register(`lines.${index}.unitPrice`)} />
                  </FormField>
                </div>
                <FormField label="GST %">
                  <Input {...form.register(`lines.${index}.gstRate`)} />
                </FormField>
                <FormField label="Expense / debit account">
                  <Select {...form.register(`lines.${index}.debitAccountId`)}>
                    <option value="">Server mapping / default</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                {fields.length > 1 && (
                  <ErpButton type="button" variant="ghost" size="sm" className="mt-2" onClick={() => remove(index)}>
                    Remove
                  </ErpButton>
                )}
              </div>
            ))}
          </div>

          {/* Desktop grid */}
          <div className="hidden space-y-2 md:block">
            {fields.map((field, index) => (
              <div key={field.id} className="grid gap-2 rounded border border-erp-border p-2 lg:grid-cols-12">
                {!quickMode && (
                  <div className="lg:col-span-2">
                    <Select {...form.register(`lines.${index}.lineType`)} aria-label={`Line ${index + 1} type`}>
                      <option value="ITEM">Item</option>
                      <option value="SERVICE">Service</option>
                      <option value="EXPENSE">Expense</option>
                      <option value="ASSET">Asset</option>
                      <option value="FREIGHT">Freight</option>
                      <option value="OTHER_CHARGE">Other charge</option>
                    </Select>
                  </div>
                )}
                <div className={quickMode ? 'lg:col-span-4' : 'lg:col-span-3'}>
                  {!quickMode && watched.lines?.[index]?.lineType === 'ITEM' && (
                    <div className="mb-1">
                      <ErpSmartSelect
                        options={itemOptions}
                        value={watched.lines?.[index]?.itemId ?? ''}
                        onChange={(itemId) => onPickLineItem(index, itemId)}
                        placeholder="Item master (optional)…"
                        allowEmpty
                      />
                    </div>
                  )}
                  <Input placeholder="Description" {...form.register(`lines.${index}.description`)} />
                </div>
                <div className="lg:col-span-1">
                  <Input placeholder="Qty" {...form.register(`lines.${index}.quantity`)} />
                </div>
                <div className="lg:col-span-2">
                  <Input placeholder="Rate" {...form.register(`lines.${index}.unitPrice`)} />
                </div>
                <div className="lg:col-span-1">
                  <Input placeholder="GST %" {...form.register(`lines.${index}.gstRate`)} />
                </div>
                {!quickMode && (
                  <div className="lg:col-span-1">
                    <Input placeholder="HSN/SAC" {...form.register(`lines.${index}.hsnSacCode`)} />
                  </div>
                )}
                <div className={quickMode ? 'lg:col-span-4' : 'lg:col-span-2'}>
                  <Select {...form.register(`lines.${index}.debitAccountId`)} aria-label={`Line ${index + 1} account`}>
                    <option value="">Account (optional)</option>
                    {expenseAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                {!quickMode && fields.length > 1 && (
                  <div className="flex items-center lg:col-span-1">
                    <ErpButton type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                      Remove
                    </ErpButton>
                  </div>
                )}
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-erp-muted">
            Raw line inputs are sent to the server. Calculated taxable, GST, TDS and payable amounts come back from the API.
          </p>
        </section>

        <details
          className="rounded border border-erp-border p-3"
          open={advancedOpen}
          onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        >
          <summary className="cursor-pointer text-[12px] font-semibold text-erp-muted">
            Tax, TDS, currency, freight &amp; purchase references (advanced)
          </summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <FormField label="Tax treatment">
              <Select {...form.register('taxTreatment')}>
                <option value="REGULAR">Regular</option>
                <option value="REVERSE_CHARGE">Reverse charge</option>
                <option value="NON_GST">Non-GST</option>
                <option value="EXEMPT">Exempt</option>
                <option value="NIL_RATED">Nil rated</option>
                <option value="IMPORT_GOODS">Import goods</option>
                <option value="IMPORT_SERVICE">Import service</option>
                <option value="SEZ">SEZ</option>
              </Select>
            </FormField>
            <FormField label="Supply type">
              <Select {...form.register('supplyType')}>
                <option value="INTRA_STATE">Intra-state</option>
                <option value="INTER_STATE">Inter-state</option>
              </Select>
            </FormField>
            <FormField label="ITC eligibility">
              <Select {...form.register('itcEligibility')}>
                <option value="PENDING_REVIEW">Pending review</option>
                <option value="ELIGIBLE">Eligible</option>
                <option value="PARTIALLY_ELIGIBLE">Partially eligible</option>
                <option value="INELIGIBLE">Ineligible</option>
              </Select>
            </FormField>
            {watched.itcEligibility === 'PARTIALLY_ELIGIBLE' && (
              <FormField label="Eligible ITC %">
                <Input {...form.register('itcEligiblePercent')} />
              </FormField>
            )}
            <FormField label="TDS recognition">
              <Select {...form.register('tdsRecognitionMode')}>
                <option value="NOT_APPLICABLE">Not applicable</option>
                <option value="AT_INVOICE">At invoice</option>
                <option value="AT_PAYMENT">At payment</option>
              </Select>
            </FormField>
            <FormField label="TDS section">
              <Input {...form.register('tdsSectionCode')} placeholder="e.g. 194C" />
            </FormField>
            <FormField label="TDS rate %">
              <Input {...form.register('tdsRate')} />
            </FormField>
            <FormField label="Freight amount">
              <Input {...form.register('freightAmount')} />
            </FormField>
            <FormField label="Other charges">
              <Input {...form.register('otherChargeAmount')} />
            </FormField>
          </div>
          <div className="mt-3">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Purchase references</h4>
            {mode === 'edit' && existingSourceLinks.length > 0 ? (
              <ul className="mt-1 space-y-1 text-[11px] text-erp-muted">
                {existingSourceLinks.map((s, i) => (
                  <li key={`${s.sourceType}-${i}`}>
                    {s.sourceType.replace(/_/g, ' ')} — {s.sourceDocumentNumberSnapshot ?? s.sourceDocumentId}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-[11px] text-erp-muted">
                {mode === 'create'
                  ? 'Source documents are linked from the “From Purchase Order” / “From GRN” create modes above.'
                  : 'This invoice was entered directly without a Purchase reference.'}
              </p>
            )}
          </div>
          <p className="mt-2 text-[11px] text-erp-muted">
            Direct invoices require no Purchase link. ITC classification controls accounting treatment — it does not
            file GST returns.
          </p>
          {watched.tdsRecognitionMode === 'AT_INVOICE' && (
            <p className="mt-1 text-[11px] text-erp-muted">
              TDS liability is recognised when the vendor invoice is posted.
            </p>
          )}
          {watched.tdsRecognitionMode === 'AT_PAYMENT' && (
            <p className="mt-1 text-[11px] text-erp-muted">
              TDS is handled during vendor payment. The invoice posts the full vendor liability.
            </p>
          )}
        </details>

        {serverTotals && (
          <VendorInvoiceTotalsPanel
            taxable={serverTotals.taxable}
            cgst={serverTotals.cgst}
            sgst={serverTotals.sgst}
            igst={serverTotals.igst}
            cess={serverTotals.cess}
            nonRecoverable={serverTotals.nonRecoverable}
            freight={serverTotals.freight}
            other={serverTotals.other}
            roundOff={serverTotals.roundOff}
            grandTotal={serverTotals.grandTotal}
            tds={serverTotals.tds}
            vendorPayable={serverTotals.vendorPayable}
          />
        )}

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

export function VendorInvoiceNewPage() {
  return <VendorInvoiceFormPage mode="create" />
}

export function VendorInvoiceEditPage() {
  return <VendorInvoiceFormPage mode="edit" />
}
