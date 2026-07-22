import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useForm, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { ErpSmartSelect, type ErpSmartSelectOption } from '@/components/erp/ErpSmartSelect'
import { CurrencyInput, Input, Select, Textarea } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import { CustomerMasterSelect } from '@/components/masters/CustomerMasterSelect'
import {
  createSalesInvoice,
  getSalesInvoice,
  updateSalesInvoice,
} from '@/services/bridges/receivablesApiBridge'
import { resolveLegalEntityId } from '@/services/bridges/financeApiBridge'
import { listSalesOrderLookups, type AccountingSalesOrderLookup } from '@/services/api/accountingLookupsApi'
import { isApiMode } from '@/config/apiConfig'
import { useMoneyInPermissions } from '@/utils/permissions/moneyIn'
import { useMasterStore } from '@/store/masterStore'
import { useMrpStore } from '@/store/mrpStore'
import type { SalesOrder, SalesOrderStatus } from '@/types/mrp'
import type { SalesInvoiceSourceLinkInput, SalesInvoiceSourceType } from '@/types/moneyIn'
import { notify } from '@/store/toastStore'
import { PartyMasterCard } from '@/modules/accounting/shared/invoices'
import { formatCurrency } from '@/utils/formatters/currency'
import { previewInterLineTotal, previewLineTotal, moneyInPath } from '../moneyInUi'
import { TotalsPanel } from '../components/TotalsPanel'
import { MoneyInWorkspaceShell } from '../MoneyInWorkspaceShell'
import { useAccountingCustomerLookups } from '@/hooks/useAccountingLookups'
import { gstStateCodeFromGstin } from '@/utils/customerUtils'
import { cn } from '@/utils/cn'
import type { DispatchInvoicePrefillState } from './invoicePrefillState'

const STATE_NAME_TO_CODE: Record<string, string> = {
  maharashtra: '27',
  gujarat: '24',
  karnataka: '29',
  'tamil nadu': '33',
  delhi: '07',
  haryana: '06',
  rajasthan: '08',
  'uttar pradesh': '09',
  telangana: '36',
  'andhra pradesh': '37',
  'west bengal': '19',
  'madhya pradesh': '23',
  kerala: '32',
  punjab: '03',
  goa: '30',
}

function resolvePlaceOfSupplyFromCustomer(opts: {
  lookupStateCode?: string | null
  lookupGstin?: string | null
  storeGstin?: string | null
  storeState?: string | null
}): string | null {
  if (opts.lookupStateCode && /^\d{2}$/.test(opts.lookupStateCode.trim())) {
    return opts.lookupStateCode.trim()
  }
  const gstin = opts.lookupGstin || opts.storeGstin
  if (gstin && gstin.trim().length >= 2) {
    const code = gstStateCodeFromGstin(gstin)
    if (/^\d{2}$/.test(code)) return code
  }
  const stateName = opts.storeState?.trim().toLowerCase()
  if (stateName && STATE_NAME_TO_CODE[stateName]) return STATE_NAME_TO_CODE[stateName]
  return null
}

const lineSchema = z.object({
  itemId: z.string().optional(),
  description: z.string().min(1, 'Description required'),
  quantity: z.string().min(1),
  unitPrice: z.string().min(1),
  hsnCode: z.string().optional(),
  uom: z.string().optional(),
})

const formSchema = z.object({
  customerId: z.string().min(1, 'Customer required'),
  invoiceDate: z.string().min(1),
  postingDate: z.string().min(1),
  dueDate: z.string().optional(),
  customerPoNumber: z.string().optional(),
  projectRef: z.string().optional(),
  projectNameSnapshot: z.string().optional(),
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

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  if (Number.isNaN(d.getTime())) return isoDate
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Demo-mode SO whitelist. API mode uses `/accounting/lookups/sales-orders`
 * with `eligibleOnly=true` (server-side status whitelist + tenant scope).
 */
const INVOICEABLE_SO_STATUSES: SalesOrderStatus[] = ['confirmed', 'in_production', 'ready_dispatch', 'dispatched']

const EMPTY_LINE = { itemId: '', description: '', quantity: '1', unitPrice: '0', hsnCode: '', uom: '' }

/** Card section — professional document form chrome shared by all sections on this page. */
function FormSection({
  title,
  subtitle,
  actions,
  children,
  className,
}: {
  title: string
  subtitle?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-md border border-erp-border bg-white', className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-erp-border bg-erp-surface-alt/60 px-4 py-2">
        <div>
          <h3 className="text-[12px] font-semibold uppercase tracking-wide text-erp-text">{title}</h3>
          {subtitle && <p className="text-[11px] text-erp-muted">{subtitle}</p>}
        </div>
        {actions}
      </header>
      <div className="p-4">{children}</div>
    </section>
  )
}

/** Read-only master-derived value shown as a form field for layout parity. */
function ReadonlyField({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <FormField label={label} hint={hint}>
      <div className="erp-input flex min-h-[34px] items-center bg-erp-surface-alt/70 text-erp-text">
        {value || '—'}
      </div>
    </FormField>
  )
}

const LINE_GRID = 'md:grid-cols-[minmax(0,2.4fr)_minmax(0,2.6fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,0.5fr)]'

export function InvoiceFormPage({ mode }: { mode: 'create' | 'edit' }) {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const perms = useMoneyInPermissions()
  const dispatchPrefill = (location.state as DispatchInvoicePrefillState | null)?.dispatchPrefill
  const [loading, setLoading] = useState(mode === 'edit')
  const [saving, setSaving] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<string>()
  const [wasReady, setWasReady] = useState(false)
  const [sourceMode, setSourceMode] = useState<SalesInvoiceSourceType>(() =>
    dispatchPrefill ? 'OUTBOUND_DISPATCH' : 'DIRECT',
  )
  const [salesOrderId, setSalesOrderId] = useState(dispatchPrefill?.salesOrderId ?? '')
  const [dispatchSourceDocumentId, setDispatchSourceDocumentId] = useState<string | null>(
    dispatchPrefill?.sourceDocumentId ?? null,
  )
  const [dispatchSourceLinks, setDispatchSourceLinks] = useState<SalesInvoiceSourceLinkInput[]>(
    dispatchPrefill?.sourceLinks ?? [],
  )
  const [soLookups, setSoLookups] = useState<AccountingSalesOrderLookup[] | null>(null)

  const salesOrders = useMrpStore((s) => s.salesOrders)
  const items = useMasterStore((s) => s.items)
  const uoms = useMasterStore((s) => s.uoms)
  const customers = useMasterStore((s) => s.customers)
  const accountingCustomers = useAccountingCustomerLookups(true)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      customerId: '',
      invoiceDate: today(),
      postingDate: today(),
      supplyType: 'INTRA_STATE',
      taxTreatment: 'REGISTERED',
      freightAmount: '0',
      otherChargesAmount: '0',
      lines: [{ ...EMPTY_LINE }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' })
  const watched = form.watch()

  const invoiceableOrders = useMemo(
    () => salesOrders.filter((so) => INVOICEABLE_SO_STATUSES.includes(so.status)),
    [salesOrders],
  )

  /** Auto-fill tax treatment + due date from the Customer Master on pick. */
  const applyCustomerDefaults = useCallback(
    (customerId: string) => {
      form.setValue('customerId', customerId, { shouldDirty: true, shouldValidate: true })
      if (!customerId) return
      const lookup = accountingCustomers?.find((c) => c.id === customerId)
      const store = customers.find((c) => c.id === customerId)
      const gstin = lookup?.gstin || store?.gstin
      form.setValue('taxTreatment', gstin ? 'REGISTERED' : 'UNREGISTERED', { shouldDirty: true })
      const creditDays = lookup?.creditDays ?? store?.creditDays
      if (creditDays && creditDays > 0) {
        const base = form.getValues('invoiceDate') || today()
        form.setValue('dueDate', addDays(base, creditDays), { shouldDirty: true })
      }
    },
    [accountingCustomers, customers, form],
  )

  useEffect(() => {
    if (mode !== 'create' || !dispatchPrefill) return
    applyCustomerDefaults(dispatchPrefill.customerId)
    if (dispatchPrefill.customerPoNumber) {
      form.setValue('customerPoNumber', dispatchPrefill.customerPoNumber, { shouldDirty: true })
    }
    if (dispatchPrefill.projectRef) {
      form.setValue('projectRef', dispatchPrefill.projectRef, { shouldDirty: true })
    }
    if (dispatchPrefill.projectNameSnapshot) {
      form.setValue('projectNameSnapshot', dispatchPrefill.projectNameSnapshot, { shouldDirty: true })
    }
    if (dispatchPrefill.paymentTermsDays && dispatchPrefill.paymentTermsDays > 0) {
      const base = form.getValues('invoiceDate') || today()
      form.setValue('dueDate', addDays(base, dispatchPrefill.paymentTermsDays), { shouldDirty: true })
    }
    form.setValue(
      'lines',
      dispatchPrefill.lines.map((l) => ({
        itemId: l.itemId,
        description: l.description,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        hsnCode: l.hsnCode ?? '',
        uom: l.uom ?? '',
      })),
      { shouldDirty: true },
    )
    setDispatchSourceDocumentId(dispatchPrefill.sourceDocumentId)
    setDispatchSourceLinks(dispatchPrefill.sourceLinks)
    setSourceMode('OUTBOUND_DISPATCH')
    if (dispatchPrefill.salesOrderId) setSalesOrderId(dispatchPrefill.salesOrderId)
  }, [applyCustomerDefaults, dispatchPrefill, form, mode])

  // API mode: invoice-eligible SOs from the accounting lookup endpoint.
  useEffect(() => {
    if (mode !== 'create' || sourceMode !== 'SALES_ORDER' || !isApiMode()) return
    let cancelled = false
    listSalesOrderLookups({ eligibleOnly: true, limit: 100 })
      .then((res) => {
        if (!cancelled) setSoLookups(res.data ?? [])
      })
      .catch((e) => {
        if (!cancelled) {
          setSoLookups(null)
          notify.error(
            e instanceof Error ? e.message : 'Sales order lookup is unavailable — retry or create a direct invoice.',
          )
        }
      })
    return () => {
      cancelled = true
    }
  }, [mode, sourceMode])

  const soOptions: ErpSmartSelectOption<string>[] = useMemo(() => {
    if (isApiMode()) {
      return (soLookups ?? []).map((so) => ({
        value: so.id,
        label: so.orderNumber,
        subtitle:
          [so.status.replace(/_/g, ' '), so.customerPoNumber ? `PO ${so.customerPoNumber}` : null]
            .filter(Boolean)
            .join(' · ') || undefined,
        searchText: `${so.orderNumber} ${so.customerPoNumber ?? ''}`.toLowerCase(),
      }))
    }
    return invoiceableOrders.map((so) => ({
      value: so.id,
      label: so.salesOrderNo,
      subtitle: [so.customerCode, so.status.replace(/_/g, ' ')].filter(Boolean).join(' · ') || undefined,
      searchText: `${so.salesOrderNo} ${so.customerCode ?? ''} ${so.customerPoNumber ?? ''}`.toLowerCase(),
    }))
  }, [invoiceableOrders, soLookups])

  const itemOptions: ErpSmartSelectOption<string>[] = useMemo(
    () =>
      items
        .filter((i) => i.isActive)
        .map((i) => ({
          value: i.id,
          label: `${i.itemCode} — ${i.itemName}`,
          subtitle: i.hsnCode ? `HSN ${i.hsnCode}` : undefined,
          searchText: `${i.itemCode} ${i.itemName} ${i.hsnCode ?? ''}`.toLowerCase(),
        })),
    [items],
  )

  // ── Master-derived customer context (lookup preferred, store fallback) ─────
  const customerLookup = useMemo(
    () => accountingCustomers?.find((c) => c.id === watched.customerId),
    [accountingCustomers, watched.customerId],
  )
  const customerStore = useMemo(
    () => customers.find((c) => c.id === watched.customerId),
    [customers, watched.customerId],
  )
  const customerPlaceOfSupply = useMemo(
    () =>
      resolvePlaceOfSupplyFromCustomer({
        lookupStateCode: customerLookup?.stateCode,
        lookupGstin: customerLookup?.gstin,
        storeGstin: customerStore?.gstin,
        storeState: customerStore?.state,
      }),
    [customerLookup, customerStore],
  )
  const customerCreditDays = customerLookup?.creditDays ?? customerStore?.creditDays ?? null

  const applySalesOrder = useCallback(
    (so: SalesOrder) => {
      applyCustomerDefaults(so.customerId)
      if (so.customerPoNumber) form.setValue('customerPoNumber', so.customerPoNumber, { shouldDirty: true })
      const soLines = so.lines ?? []
      if (soLines.length > 0) {
        form.setValue(
          'lines',
          soLines.map((l) => ({
            itemId: l.productId ?? '',
            description: l.description || l.productOrItem,
            quantity: String(l.qty),
            unitPrice: String(l.unitPrice),
            hsnCode: '',
            uom: l.uom ?? '',
          })),
          { shouldDirty: true },
        )
      } else {
        form.setValue(
          'lines',
          [
            {
              itemId: so.productId ?? '',
              description: so.remarks || `As per sales order ${so.salesOrderNo}`,
              quantity: String(so.qty || 1),
              unitPrice: String(so.unitPrice ?? 0),
              hsnCode: '',
              uom: '',
            },
          ],
          { shouldDirty: true },
        )
      }
    },
    [applyCustomerDefaults, form],
  )

  const onPickSalesOrder = (soId: string) => {
    setSalesOrderId(soId)
    const so = salesOrders.find((o) => o.id === soId)
    if (so) {
      // Store row (hydrated from the API in API mode) carries lines for prefill.
      applySalesOrder(so)
      return
    }
    const lookup = soLookups?.find((o) => o.id === soId)
    if (lookup) {
      applyCustomerDefaults(lookup.customerId)
      if (lookup.customerPoNumber) {
        form.setValue('customerPoNumber', lookup.customerPoNumber, { shouldDirty: true })
      }
    }
  }

  const onPickLineItem = (index: number, itemId: string) => {
    form.setValue(`lines.${index}.itemId`, itemId, { shouldDirty: true })
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    form.setValue(`lines.${index}.description`, item.itemName, { shouldDirty: true })
    if (item.hsnCode) form.setValue(`lines.${index}.hsnCode`, item.hsnCode, { shouldDirty: true })
    const uom = uoms.find((u) => u.id === item.baseUomId)
    if (uom) form.setValue(`lines.${index}.uom`, uom.uomCode, { shouldDirty: true })
    const currentRate = Number(form.getValues(`lines.${index}.unitPrice`) || 0)
    if (!currentRate && item.standardRate) {
      form.setValue(`lines.${index}.unitPrice`, String(item.standardRate), { shouldDirty: true })
    }
  }

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
      setSourceMode(inv.sourceType ?? 'DIRECT')
      setSalesOrderId(inv.sourceDocumentId ?? '')
      setDispatchSourceDocumentId(inv.sourceType === 'OUTBOUND_DISPATCH' ? inv.sourceDocumentId : null)
      setDispatchSourceLinks(
        inv.sourceLinks?.map((l) => ({
          sourceType: l.sourceType,
          sourceDocumentId: l.sourceDocumentId,
          sourceLineId: l.sourceLineId,
          salesOrderId: l.salesOrderId,
          salesOrderLineId: l.salesOrderLineId,
          deliveryChallanId: l.deliveryChallanId,
          deliveryChallanLineId: l.deliveryChallanLineId,
          quantity: l.quantity,
          itemId: l.itemId,
        })) ?? [],
      )
      form.reset({
        customerId: inv.customerId,
        invoiceDate: inv.invoiceDate,
        postingDate: inv.postingDate ?? inv.invoiceDate,
        dueDate: inv.dueDate ?? undefined,
        customerPoNumber: inv.customerPoNumber ?? '',
        projectRef: inv.projectRef ?? '',
        projectNameSnapshot: inv.projectNameSnapshot ?? '',
        supplyType: inv.supplyType === 'INTER_STATE' ? 'INTER_STATE' : 'INTRA_STATE',
        taxTreatment: inv.taxTreatment === 'UNREGISTERED' ? 'UNREGISTERED' : 'REGISTERED',
        freightAmount: inv.freightAmount,
        otherChargesAmount: inv.otherChargesAmount,
        narration: inv.narration ?? '',
        lines: (inv.lines ?? []).map((l) => ({
          itemId: l.itemId ?? '',
          description: l.description ?? l.itemNameSnapshot ?? '',
          quantity: l.quantity,
          unitPrice: l.unitRate,
          hsnCode: l.hsnCodeSnapshot ?? '',
          uom: l.uomSnapshot ?? '',
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

  const buildPayload = (values: FormValues) => {
    const fromSo = sourceMode === 'SALES_ORDER' && salesOrderId
    const fromDispatch = sourceMode === 'OUTBOUND_DISPATCH' && dispatchSourceDocumentId
    const linkedItem = (itemId?: string) => (itemId ? items.find((i) => i.id === itemId) : undefined)
    const lookup = accountingCustomers?.find((c) => c.id === values.customerId)
    const storeCustomer = customers.find((c) => c.id === values.customerId)
    const placeOfSupply = resolvePlaceOfSupplyFromCustomer({
      lookupStateCode: lookup?.stateCode,
      lookupGstin: lookup?.gstin,
      storeGstin: storeCustomer?.gstin,
      storeState: storeCustomer?.state,
    })
    const prefillLineByIndex = dispatchPrefill?.lines ?? []
    return {
      legalEntityId: resolveLegalEntityId(),
      customerId: values.customerId,
      // Source is chosen at creation; edits never change the source document.
      ...(mode === 'create'
        ? fromDispatch
          ? {
              sourceType: 'OUTBOUND_DISPATCH' as SalesInvoiceSourceType,
              sourceDocumentId: dispatchSourceDocumentId,
              sourceLinks: dispatchSourceLinks,
              projectRef: values.projectRef?.trim() || null,
              projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
            }
          : {
              sourceType: (fromSo ? 'SALES_ORDER' : 'DIRECT') as SalesInvoiceSourceType,
              sourceDocumentId: fromSo ? salesOrderId : null,
              projectRef: values.projectRef?.trim() || null,
              projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
            }
        : {
            projectRef: values.projectRef?.trim() || null,
            projectNameSnapshot: values.projectNameSnapshot?.trim() || null,
          }),
      invoiceDate: values.invoiceDate,
      postingDate: values.postingDate,
      dueDate: values.dueDate || null,
      customerPoNumber: values.customerPoNumber || null,
      placeOfSupply,
      supplyType: values.supplyType,
      taxTreatment: values.taxTreatment,
      freightAmount: values.freightAmount ?? '0',
      otherChargesAmount: values.otherChargesAmount ?? '0',
      narration: values.narration || null,
      lines: values.lines.map((l, idx) => {
        const item = linkedItem(l.itemId)
        const prefillLine = prefillLineByIndex[idx]
        return {
          lineNumber: idx + 1,
          itemId: l.itemId || null,
          itemCode: item?.itemCode ?? prefillLine?.itemCode ?? null,
          itemName: item?.itemName ?? prefillLine?.itemName ?? null,
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          hsnCode: l.hsnCode || null,
          uom: l.uom || null,
          sourceLineId: prefillLine?.sourceLineId ?? null,
        }
      }),
      ...(mode === 'edit' && updatedAt ? { updatedAt } : {}),
    }
  }

  const onSave = form.handleSubmit(async (values) => {
    setSaving(true)
    try {
      if (mode === 'create') {
        const created = await createSalesInvoice(buildPayload(values))
        notify.success('Draft saved')
        navigate(moneyInPath(`invoices/${created.id}`))
      } else if (id) {
        const updated = await updateSalesInvoice(id, buildPayload(values) as Parameters<typeof updateSalesInvoice>[1])
        setUpdatedAt(updated.updatedAt)
        notify.success(wasReady ? 'Saved — invoice returned to Draft' : 'Draft updated')
        navigate(moneyInPath(`invoices/${id}`))
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

  const selectedSoStore = salesOrderId ? salesOrders.find((o) => o.id === salesOrderId) : undefined
  const selectedSoLookup = salesOrderId ? soLookups?.find((o) => o.id === salesOrderId) : undefined
  const selectedSo = selectedSoStore
    ? {
        number: selectedSoStore.salesOrderNo,
        status: selectedSoStore.status,
        customerPoNumber: selectedSoStore.customerPoNumber ?? null,
      }
    : selectedSoLookup
      ? {
          number: selectedSoLookup.orderNumber,
          status: selectedSoLookup.status,
          customerPoNumber: selectedSoLookup.customerPoNumber,
        }
      : undefined

  const lineErrors = form.formState.errors.lines

  return (
    <MoneyInWorkspaceShell title={mode === 'create' ? 'New Invoice' : 'Edit Invoice'}>
      {wasReady && (
        <div className="mb-3 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
          Editing a Ready to Post invoice returns it to Draft — mark ready again before posting.
        </div>
      )}

      {sourceMode === 'OUTBOUND_DISPATCH' && dispatchSourceDocumentId && (
        <div className="mb-3 rounded border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-900">
          Sourced from outbound dispatch — {dispatchSourceLinks.length} line
          {dispatchSourceLinks.length === 1 ? '' : 's'} linked. Quantities are capped by invoice-ready dispatch qty on save.
        </div>
      )}

      <form onSubmit={onSave} className="space-y-3">
        {/* ── Customer & source ──────────────────────────────────────────── */}
        <FormSection
          title="Customer & Source"
          subtitle="Party, source document, and GST classification — defaults pulled from the Customer Master."
          actions={
            mode === 'create' && sourceMode !== 'OUTBOUND_DISPATCH' ? (
              <div className="inline-flex overflow-hidden rounded border border-erp-border" role="group" aria-label="Invoice source">
                <button
                  type="button"
                  className={cn(
                    'px-3 py-1 text-[12px] font-medium transition-colors',
                    sourceMode === 'DIRECT' ? 'bg-erp-accent text-white' : 'bg-white text-erp-muted hover:bg-erp-surface-alt',
                  )}
                  onClick={() => {
                    setSourceMode('DIRECT')
                    setSalesOrderId('')
                  }}
                >
                  Direct invoice
                </button>
                <button
                  type="button"
                  className={cn(
                    'border-l border-erp-border px-3 py-1 text-[12px] font-medium transition-colors',
                    sourceMode === 'SALES_ORDER' ? 'bg-erp-accent text-white' : 'bg-white text-erp-muted hover:bg-erp-surface-alt',
                  )}
                  onClick={() => setSourceMode('SALES_ORDER')}
                >
                  From Sales Order
                </button>
              </div>
            ) : undefined
          }
        >
          {sourceMode === 'OUTBOUND_DISPATCH' && (
            <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ReadonlyField
                label="Outbound dispatch"
                value={dispatchSourceDocumentId ?? '—'}
                hint="Primary dispatch document for this invoice"
              />
              <ReadonlyField label="Linked lines" value={String(dispatchSourceLinks.length)} />
              {salesOrderId && selectedSo && (
                <>
                  <ReadonlyField label="Sales order" value={selectedSo.number} />
                  <ReadonlyField label="SO status" value={selectedSo.status.replace(/_/g, ' ')} />
                </>
              )}
            </div>
          )}

          {sourceMode === 'SALES_ORDER' && (
            <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <FormField
                label="Sales order"
                className="sm:col-span-2"
                hint={mode === 'edit' ? 'Source document is fixed after creation.' : undefined}
              >
                {mode === 'create' ? (
                  <ErpSmartSelect
                    options={soOptions}
                    value={salesOrderId}
                    onChange={onPickSalesOrder}
                    placeholder="Select sales order…"
                    emptyMessage="No invoiceable sales orders (confirmed → dispatched)"
                    allowEmpty
                  />
                ) : (
                  <Input value={selectedSo?.number ?? salesOrderId} readOnly disabled />
                )}
              </FormField>
              {selectedSo && (
                <>
                  <ReadonlyField label="SO status" value={selectedSo.status.replace(/_/g, ' ')} />
                  <ReadonlyField label="SO customer PO" value={selectedSo.customerPoNumber ?? '—'} />
                </>
              )}
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Customer" required error={form.formState.errors.customerId?.message} className="sm:col-span-2">
              <CustomerMasterSelect
                value={watched.customerId}
                onChange={applyCustomerDefaults}
                disabled={
                  (sourceMode === 'SALES_ORDER' && Boolean(salesOrderId)) ||
                  (sourceMode === 'OUTBOUND_DISPATCH' && Boolean(watched.customerId))
                }
                allowEmpty
                source="accounting"
              />
            </FormField>
            <FormField label="Customer PO No.">
              <Input placeholder="e.g. PO-2026-0148" {...form.register('customerPoNumber')} />
            </FormField>
            <ReadonlyField
              label="Payment terms"
              value={customerCreditDays ? `${customerCreditDays} days credit` : '—'}
              hint="From Customer Master"
            />
            <FormField label="Supply type">
              <Select {...form.register('supplyType')}>
                <option value="INTRA_STATE">Intra-state (CGST + SGST)</option>
                <option value="INTER_STATE">Inter-state (IGST)</option>
              </Select>
            </FormField>
            <FormField label="Tax treatment">
              <Select {...form.register('taxTreatment')}>
                <option value="REGISTERED">Registered</option>
                <option value="UNREGISTERED">Unregistered</option>
              </Select>
            </FormField>
            <ReadonlyField
              label="Place of supply"
              value={customerPlaceOfSupply ? `State code ${customerPlaceOfSupply}` : '—'}
              hint="Resolved from GSTIN / state"
            />
            <ReadonlyField
              label="GSTIN"
              value={customerLookup?.gstin ?? customerStore?.gstin ?? '—'}
              hint="From Customer Master"
            />
          </div>

          <PartyMasterCard variant="crm" partyId={watched.customerId} showQuickCreate />
        </FormSection>

        {/* ── Invoice details ────────────────────────────────────────────── */}
        <FormSection title="Invoice Details" subtitle="Document, posting, and payment dates.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Invoice date" required error={form.formState.errors.invoiceDate?.message}>
              <Input type="date" {...form.register('invoiceDate')} />
            </FormField>
            <FormField label="Posting date" required error={form.formState.errors.postingDate?.message}>
              <Input type="date" {...form.register('postingDate')} />
            </FormField>
            <FormField label="Due date" hint={customerCreditDays ? `Auto-set from ${customerCreditDays}-day credit terms` : undefined}>
              <Input type="date" {...form.register('dueDate')} />
            </FormField>
            <FormField label="Project ref" hint="Optional project / job reference">
              <Input placeholder="e.g. PRJ-2026-014" {...form.register('projectRef')} />
            </FormField>
            <FormField label="Project name" hint="Snapshot label printed on the invoice">
              <Input placeholder="e.g. Trailer build — ACME" {...form.register('projectNameSnapshot')} />
            </FormField>
            <ReadonlyField label="Currency" value="INR — Indian Rupee" />
          </div>
        </FormSection>

        {/* ── Lines ──────────────────────────────────────────────────────── */}
        <FormSection
          title="Invoice Lines"
          subtitle="Picking an item fills description, HSN, UOM, and standard rate from the Item Master."
          actions={
            <ErpButton type="button" variant="secondary" size="sm" icon={Plus} onClick={() => append({ ...EMPTY_LINE })}>
              Add line
            </ErpButton>
          }
        >
          {/* Column headers (md+) */}
          <div className={cn('mb-1 hidden gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-erp-muted md:grid', LINE_GRID)}>
            <span>Item</span>
            <span>Description *</span>
            <span>HSN</span>
            <span>UOM</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Rate (₹)</span>
            <span className="text-right">Amount</span>
            <span />
          </div>

          <div className="space-y-2">
            {fields.map((field, index) => {
              const line = watched.lines?.[index]
              const amount = Number(line?.quantity || 0) * Number(line?.unitPrice || 0)
              return (
                <div
                  key={field.id}
                  className={cn('grid items-start gap-2 rounded border border-erp-border bg-erp-surface-alt/30 p-2 md:border-transparent md:bg-transparent md:p-1', LINE_GRID)}
                >
                  <ErpSmartSelect
                    options={itemOptions}
                    value={line?.itemId ?? ''}
                    onChange={(itemId) => onPickLineItem(index, itemId)}
                    placeholder="Select item…"
                    allowEmpty
                  />
                  <div>
                    <Input
                      placeholder="Description"
                      error={Boolean(lineErrors?.[index]?.description)}
                      {...form.register(`lines.${index}.description`)}
                    />
                    {lineErrors?.[index]?.description && (
                      <p className="mt-0.5 text-[11px] font-medium text-erp-danger-fg">{lineErrors[index]?.description?.message}</p>
                    )}
                  </div>
                  <Input placeholder="HSN" {...form.register(`lines.${index}.hsnCode`)} />
                  <Input placeholder="UOM" {...form.register(`lines.${index}.uom`)} />
                  <Input
                    placeholder="0"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    {...form.register(`lines.${index}.quantity`)}
                  />
                  <Input
                    placeholder="0.00"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    {...form.register(`lines.${index}.unitPrice`)}
                  />
                  <div className="flex min-h-[34px] items-center justify-end pr-1 text-[13px] font-medium tabular-nums text-erp-text">
                    {formatCurrency(Number.isFinite(amount) ? amount : 0)}
                  </div>
                  <div className="flex min-h-[34px] items-center justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        className="rounded p-1.5 text-erp-muted transition-colors hover:bg-rose-50 hover:text-rose-600"
                        title="Remove line"
                        onClick={() => remove(index)}
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-2 text-[11px] text-erp-muted">
            Line amounts are gross previews (qty × rate). GST and final totals are calculated by the server on save.
          </p>
        </FormSection>

        {/* ── Charges & narration ────────────────────────────────────────── */}
        <FormSection title="Charges & Narration" subtitle="Header-level charges added on top of line totals.">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FormField label="Freight">
              <CurrencyInput {...form.register('freightAmount')} />
            </FormField>
            <FormField label="Other charges">
              <CurrencyInput {...form.register('otherChargesAmount')} />
            </FormField>
            <ReadonlyField label="Round off" value="Calculated on server" />
            <ReadonlyField label="TCS / TDS" value="Applied per Finance Settings" />
            <FormField label="Narration" className="sm:col-span-2 xl:col-span-4">
              <Textarea rows={2} placeholder="Internal narration printed on the voucher…" {...form.register('narration')} />
            </FormField>
          </div>
        </FormSection>

        {/* ── Totals & accounting ────────────────────────────────────────── */}
        <div className="grid gap-3 lg:grid-cols-2">
          <TotalsPanel {...previewTotals} preview />
          <details className="rounded-md border border-erp-border bg-white p-3">
            <summary className="cursor-pointer text-[12px] font-semibold text-erp-muted">Accounting (collapsed)</summary>
            <p className="mt-2 text-[12px] text-erp-muted">
              Revenue and receivable accounts resolve from default mappings on save/post (server).
            </p>
          </details>
        </div>

        {/* ── Actions ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-end gap-2 rounded-md border border-erp-border bg-erp-surface-alt/60 px-4 py-3">
          <ErpButton type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </ErpButton>
          <ErpButton type="submit" variant="primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Draft'}
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
