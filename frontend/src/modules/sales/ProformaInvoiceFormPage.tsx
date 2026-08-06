import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  Check,
  ClipboardList,
  FileText,
  PenLine,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar } from '../../components/erp/card-form'
import { ErpSegmentedControl } from '../../components/erp/ErpSegmentedControl'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { Input, Textarea } from '../../components/forms/Inputs'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import {
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
} from '../../design-system/workspace'
import { cn } from '../../utils/cn'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { useActiveCustomers, useSellableItems } from '../../hooks/useMasterLists'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { computeProformaLineTotals } from '../../utils/proformaInvoiceLines'
import { resolveSalesOrderProformaPrefill, ensureSalesOrderProformaPrefill, type ProformaSalesOrderPrefill } from '../../utils/proformaInvoicePrefill'
import type { ProformaInvoiceLine } from '../../types/proformaInvoice'
import { computeGst, gstSchemeLabel } from '../../utils/gstEngine'
import { canUseItemInSales } from '../../utils/opportunityItemOptions'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { SalesCardFormShell } from './SalesCardFormShell'
import { salesChildBreadcrumbs } from '../../utils/salesNavigation'
import { isApiMode } from '../../config/apiConfig'
import { apiCreateProforma } from '../../services/bridges/crmCommercialApiBridge'
import { useTenantProfileStore } from '../../store/tenantProfileStore'
import { calcProductPricingSummary } from '../../utils/opportunityLineCalc'
import { CommercialOrderAdjustmentsBlock } from '../../components/erp/CommercialOrderAdjustmentsBlock'
import {
  chargesToAdjustments,
  emptySoOrderCharges,
  type SoOrderCharges,
} from '../../components/sales/SalesOrderLinesEditor'
import {
  CommercialGstSupplyPanel,
  type CommercialGstSupplyValue,
} from '../../components/sales/CommercialGstSupplyPanel'
import { loadSellerStateCode } from '../../utils/sellerGstState'
import { resolveGstStateCode } from '../../utils/gstStateCode'
import { notify } from '../../store/toastStore'

type PiCreateMode = 'direct' | 'sales_order'

type PiLineRow = {
  key: string
  itemId: string
  qty: string
  unitPrice: string
  discountPct: string
  taxPct: string
  hsnCode?: string
}

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const
const DEFAULT_VALIDITY_DAYS = 30

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate.slice(0, 10))
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function toLineRows(lines: ProformaInvoiceLine[]): PiLineRow[] {
  return lines.map((l) => ({
    key: l.id,
    itemId: l.itemId ?? '',
    qty: String(l.qty),
    unitPrice: String(l.unitPrice),
    discountPct: String(l.discountPct),
    taxPct: String(l.taxPct),
    hsnCode: l.hsnCode ?? '',
  }))
}

function buildLinesFromRows(rows: PiLineRow[], items: ReturnType<typeof useMasterStore.getState>['items']): ProformaInvoiceLine[] {
  return rows
    .filter((r) => r.itemId && Number(r.qty) > 0)
    .map((row, idx) => {
      const item = items.find((i) => i.id === row.itemId)
      const qty = Number(row.qty) || 0
      const unitPrice = Number(row.unitPrice) || 0
      const discountPct = Number(row.discountPct) || 0
      const taxPct = Number(row.taxPct)
      if (!Number.isFinite(taxPct)) {
        // Unset — treat as 0; UI should have resolved from masters
      }
      const safeTax = Number.isFinite(taxPct) ? taxPct : 0
      const totals = computeProformaLineTotals({ qty, unitPrice, discountPct, taxPct: safeTax })
      return {
        id: row.key,
        lineNo: idx + 1,
        itemId: row.itemId,
        itemCode: item?.itemCode ?? '',
        description: item?.itemName ?? '',
        hsnCode: (row.hsnCode ?? '').trim() || item?.hsnCode || '',
        qty,
        uom: 'Nos',
        unitPrice,
        discountPct,
        taxPct: safeTax,
        ...totals,
      }
    })
}

export function ProformaInvoiceFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialSoId = searchParams.get('salesOrderId') ?? ''

  const salesOrders = useMrpStore((s) => s.salesOrders)
  const createDirect = useProformaInvoiceStore((s) => s.createDirect)
  const createFromSalesOrder = useProformaInvoiceStore((s) => s.createFromSalesOrder)
  const customers = useActiveCustomers()
  const items = useSellableItems()
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getItem = useMasterStore((s) => s.getItem)

  const today = new Date().toISOString().slice(0, 10)
  const [mode, setMode] = useState<PiCreateMode>(initialSoId ? 'sales_order' : 'direct')
  const [salesOrderId, setSalesOrderId] = useState(initialSoId)
  const [customerId, setCustomerId] = useState('')
  const [proformaDate, setProformaDate] = useState(today)
  const [validUntil, setValidUntil] = useState(() => addDays(today, DEFAULT_VALIDITY_DAYS))
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [billingAddress, setBillingAddress] = useState<string | null>(null)
  const [shippingAddress, setShippingAddress] = useState<string | null>(null)
  const [remarks, setRemarks] = useState('')
  const [charges, setCharges] = useState<SoOrderCharges>(() => emptySoOrderCharges())
  const { locationId, setLocationId } = useDocumentLocation('sales', null)
  const showLocationField = !useTenantProfileStore((s) => s.isServices())
  const isServices = useTenantProfileStore((s) => s.isServices())
  const showFreight = !isServices
  const [gstSupply, setGstSupply] = useState<CommercialGstSupplyValue>(() => ({
    placeOfSupply: '',
    placeOfSupplyOverride: false,
    placeOfSupplyOverrideReason: '',
    supplierStateCode: '',
  }))

  useEffect(() => {
    let cancelled = false
    void loadSellerStateCode().then((code) => {
      if (cancelled || !code) return
      setGstSupply((prev) =>
        prev.supplierStateCode === code ? prev : { ...prev, supplierStateCode: code },
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  const [lineRows, setLineRows] = useState<PiLineRow[]>(() => [{
    key: crypto.randomUUID(),
    itemId: '',
    qty: '1',
    unitPrice: '0',
    discountPct: '0',
    taxPct: '0',
  }])
  const [toast, setToast] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(Boolean(initialSoId))
  const [linkedSoMeta, setLinkedSoMeta] = useState<{ salesOrderId: string; salesOrderNo: string } | null>(
    () => {
      if (!initialSoId) return null
      const prefill = resolveSalesOrderProformaPrefill(initialSoId)
      return prefill ? { salesOrderId: prefill.salesOrderId, salesOrderNo: prefill.salesOrderNo } : null
    },
  )

  const linkedSo = useMemo(() => {
    if (linkedSoMeta && linkedSoMeta.salesOrderId === salesOrderId) return linkedSoMeta
    const fromStore = salesOrderId ? resolveSalesOrderProformaPrefill(salesOrderId) : null
    return fromStore
      ? { salesOrderId: fromStore.salesOrderId, salesOrderNo: fromStore.salesOrderNo }
      : null
  }, [salesOrderId, linkedSoMeta, salesOrders])

  function applyPrefillData(prefill: ProformaSalesOrderPrefill) {
    setMode('sales_order')
    setSalesOrderId(prefill.salesOrderId)
    setCustomerId(prefill.customerId)
    setPaymentTerms(prefill.paymentTerms)
    setDeliveryTerms(prefill.deliveryTerms)
    setCustomerPoNumber(prefill.customerPoNumber ?? '')
    setBillingAddress(prefill.billingAddress)
    setShippingAddress(prefill.shippingAddress)
    setRemarks(prefill.remarks)
    if (prefill.locationId) setLocationId(prefill.locationId)
    // Carry SO place of supply only. Supplier state always stays Legal Entity (LE seed).
    setGstSupply((prev) => ({
      ...prev,
      placeOfSupply:
        prefill.so.placeOfSupplyStateCode?.trim() ||
        prefill.placeOfSupplyStateCode?.trim() ||
        resolveGstStateCode(prefill.so.placeOfSupply) ||
        resolveGstStateCode(prefill.placeOfSupply) ||
        prev.placeOfSupply,
    }))
    // Prefer empty adjustments — SO commercial charge JSON is not always on prefill.
    setCharges(emptySoOrderCharges())
    setLineRows(
      prefill.lines.length
        ? toLineRows(prefill.lines)
        : [{
            key: crypto.randomUUID(),
            itemId: '',
            qty: '1',
            unitPrice: '0',
            discountPct: '0',
            taxPct: '0',
          }],
    )
    setLinkedSoMeta({ salesOrderId: prefill.salesOrderId, salesOrderNo: prefill.salesOrderNo })
  }

  async function loadSoPrefill(soId: string, opts?: { announceSuccess?: boolean }) {
    if (!soId) {
      setPrefillLoading(false)
      return
    }
    setPrefillLoading(true)
    setErrors([])
    try {
      const result = await ensureSalesOrderProformaPrefill(soId)
      if (!result.ok) {
        setLinkedSoMeta(null)
        notify.error(result.error)
        show(result.error)
        return
      }
      applyPrefillData(result.data)
      if (opts?.announceSuccess) {
        notify.success(`Filled from sales order ${result.data.salesOrderNo}`)
      }
    } finally {
      setPrefillLoading(false)
    }
  }

  useEffect(() => {
    if (!initialSoId) return
    void loadSoPrefill(initialSoId)
    // Deep-link SO prefill once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSoId])

  const eligibleSalesOrders = useMemo(
    () => salesOrders.filter((so) => !['closed', 'cancelled'].includes(so.status)),
    [salesOrders],
  )

  const soOptions = useMemo(
    () => eligibleSalesOrders.map((so) => ({
      value: so.id,
      label: `${so.salesOrderNo} — ${getCustomer(so.customerId)?.customerName ?? so.customerId}`,
      searchText: `${so.salesOrderNo} ${so.customerPoNumber ?? ''}`.toLowerCase(),
    })),
    [eligibleSalesOrders, getCustomer],
  )

  const customerOptions = useMemo(
    () => customers.map((c) => ({
      value: c.id,
      label: `${c.customerCode} · ${c.customerName}`,
      searchText: `${c.customerCode} ${c.customerName}`.toLowerCase(),
    })),
    [customers],
  )

  const itemOptions = useMemo(
    () => items.map((i) => ({
      value: i.id,
      label: `${i.itemCode} · ${i.itemName}`,
      searchText: `${i.itemCode} ${i.itemName}`.toLowerCase(),
    })),
    [items],
  )

  const customer = customerId ? getCustomer(customerId) : undefined
  const lines = useMemo(() => buildLinesFromRows(lineRows, items), [lineRows, items])

  const pricingSummary = useMemo(() => {
    const asOppLines = lines.map((line) => ({
      id: line.id,
      lineNo: line.lineNo,
      productId: null as string | null,
      itemId: line.itemId || null,
      itemCode: line.itemCode,
      productOrItem: line.description,
      description: line.description,
      productFamily: '',
      itemType: '',
      qty: line.qty,
      uom: line.uom,
      unitPrice: line.unitPrice,
      discountPct: line.discountPct,
      discountAmount: 0,
      taxableValue: line.taxableValue,
      taxPct: line.taxPct,
      gstAmount: line.gstAmount,
      lineTotal: line.lineTotal,
      expectedDeliveryDate: null as string | null,
      remarks: '',
    }))
    return calcProductPricingSummary(asOppLines, chargesToAdjustments(charges, showFreight))
  }, [lines, charges, showFreight])

  const gstPreview = useMemo(
    () =>
      customer
        ? computeGst(
            pricingSummary.taxableAfterOverallDiscount,
            customer.state,
            undefined,
            gstSupply.supplierStateCode || null,
          )
        : null,
    [pricingSummary.taxableAfterOverallDiscount, customer, gstSupply.supplierStateCode],
  )

  const gstExtras = useMemo(
    () =>
      gstPreview
        ? {
            schemeLabel: gstSchemeLabel(gstPreview.scheme),
            cgstAmount: gstPreview.cgstAmount,
            sgstAmount: gstPreview.sgstAmount,
            igstAmount: gstPreview.igstAmount,
          }
        : null,
    [gstPreview],
  )

  const hasValidLines = lines.length > 0 && lines.every((l) => l.itemId && l.qty > 0 && l.unitPrice > 0)

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function applySoPrefill(soId: string) {
    void loadSoPrefill(soId, { announceSuccess: true })
  }

  function switchCreateMode(next: PiCreateMode) {
    setMode(next)
    if (next === 'direct') {
      setSalesOrderId('')
      setLinkedSoMeta(null)
      setBillingAddress(null)
      setShippingAddress(null)
    }
  }

  function patchLine(key: string, patch: Partial<PiLineRow>) {
    setLineRows((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)))
  }

  function addLine() {
    setLineRows([
      ...lineRows,
      {
        key: crypto.randomUUID(),
        itemId: '',
        qty: '1',
        unitPrice: '0',
        discountPct: '0',
        taxPct: '0',
      },
    ])
  }

  function removeLine(key: string) {
    if (lineRows.length <= 1) return
    setLineRows(lineRows.filter((r) => r.key !== key))
  }

  function validate(): string[] {
    const errs: string[] = []
    if (mode === 'sales_order' && !salesOrderId) errs.push('Select a sales order.')
    if (!customerId) errs.push('Select a customer.')
    if (lines.length === 0) errs.push('Add at least one line with product and quantity.')
    return errs
  }

  async function saveProforma() {
    if (prefillLoading) return
    const errs = validate()
    setErrors(errs)
    if (errs.length) return

    setIsSubmitting(true)
    const payload = {
      customerId,
      proformaDate,
      validUntil,
      paymentTerms,
      deliveryTerms,
      customerPoNumber: customerPoNumber || null,
      billingAddress,
      shippingAddress,
      remarks,
      locationId: locationId || null,
      placeOfSupply: gstSupply.placeOfSupply || null,
      placeOfSupplyStateCode: gstSupply.placeOfSupply || null,
      supplierStateCode: gstSupply.supplierStateCode || null,
      lines,
    }

    const linkedSoNo =
      linkedSoMeta?.salesOrderId === salesOrderId
        ? linkedSoMeta.salesOrderNo
        : salesOrders.find((s) => s.id === salesOrderId)?.salesOrderNo
    let r: { ok: boolean; error?: string; id?: string }
    if (isApiMode()) {
      r = await apiCreateProforma({
        ...payload,
        salesOrderId: mode === 'sales_order' ? salesOrderId || null : null,
        salesOrderNo: linkedSoNo ?? null,
        source: mode === 'sales_order' ? 'sales_order' : 'direct',
      })
    } else {
      r = await Promise.resolve(
        mode === 'sales_order' && salesOrderId
          ? createFromSalesOrder(salesOrderId, payload)
          : createDirect({ ...payload, salesOrderId: mode === 'sales_order' ? salesOrderId : null }),
      )
    }

    setIsSubmitting(false)
    if (r.ok && r.id) navigate(`/sales/proforma-invoices/${r.id}`)
    else show(r.error ?? 'Failed to create proforma invoice')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveProforma()
  }

  function scrollToSection(sectionId: string) {
    document.getElementById(`pi-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const completionItems = useMemo(() => [
    { id: 'source', label: 'Source', done: mode === 'direct' || Boolean(salesOrderId) },
    { id: 'customer', label: 'Customer', done: Boolean(customerId) },
    { id: 'lines', label: 'Products', done: hasValidLines },
    { id: 'commercial', label: 'Commercial', done: Boolean(paymentTerms.trim() && deliveryTerms.trim()) },
  ], [mode, salesOrderId, customerId, hasValidLines, paymentTerms, deliveryTerms])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Line Items', value: String(lines.length), accent: 'green' as const, hint: hasValidLines ? formatCurrency(pricingSummary.grandTotal) : 'Add items' },
    { label: 'Grand Total', value: pricingSummary.grandTotal > 0 ? formatCurrency(pricingSummary.grandTotal) : '—', accent: 'violet' as const, hint: gstPreview ? gstSchemeLabel(gstPreview.scheme) : 'Select customer' },
    { label: 'Valid Until', value: validUntil ? formatDate(validUntil) : '—', accent: 'amber' as const, hint: customer?.customerName ?? 'Select customer' },
  ], [completionPercent, completionItems, lines.length, hasValidLines, pricingSummary.grandTotal, gstPreview, validUntil, customer?.customerName])

  const documentStrip = [
    { label: 'PI No.', value: 'Auto on save' },
    { label: 'Status', value: 'Draft' },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customerId) },
    { label: 'Source', value: mode === 'sales_order' ? (linkedSo?.salesOrderNo ?? 'Sales Order') : 'Direct', highlight: mode === 'sales_order' },
    { label: 'PI Date', value: formatDate(proformaDate) },
    { label: 'Valid Until', value: formatDate(validUntil), highlight: Boolean(validUntil) },
    { label: 'Lines', value: String(lines.length), highlight: lines.length > 0 },
    { label: 'Grand Total', value: pricingSummary.grandTotal > 0 ? formatCurrency(pricingSummary.grandTotal) : '—', highlight: pricingSummary.grandTotal > 0 },
  ]

  const validationGuideItems = useMemo(
    () => errors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [errors],
  )

  const recordTitle = customer?.customerName
    ?? linkedSo?.salesOrderNo
    ?? 'New Proforma Invoice'

  const factBox = (
    <EnterpriseBusinessFactBox
      completion={{ percent: completionPercent, items: completionItems }}
      aiInsights={[
        {
          id: 'ready',
          label: 'Readiness',
          value: completionPercent >= 75 ? 'Ready to save' : 'Incomplete',
          tone: completionPercent >= 75 ? 'success' as const : 'warning' as const,
        },
        {
          id: 'next',
          label: 'Suggested Next',
          value: mode === 'sales_order' && !salesOrderId
            ? 'Link a sales order'
            : !customerId
              ? 'Select customer'
              : !hasValidLines
                ? 'Add product lines'
                : 'Review commercial terms',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormMetrics metrics={formMetrics} className="dyn-form-metrics--factbox" />
      <EnterpriseFormContextPanel
        summaryTitle="Proforma Summary"
        actionsTitle="Quick Actions"
        summary={[
          { label: 'Status', value: 'Draft' },
          { label: 'Customer', value: customer?.customerName ?? '—' },
          { label: 'Mode', value: mode === 'sales_order' ? 'From SO' : 'Direct' },
          { label: 'Lines', value: String(lines.length) },
          { label: 'Taxable', value: formatCurrency(pricingSummary.taxableBeforeOverallDiscount) },
          ...(gstPreview ? [
            { label: 'GST Scheme', value: gstSchemeLabel(gstPreview.scheme) },
            ...(gstPreview.scheme === 'cgst_sgst'
              ? [
                  { label: 'CGST', value: formatCurrency(gstPreview.cgstAmount) },
                  { label: 'SGST', value: formatCurrency(gstPreview.sgstAmount) },
                ]
              : [{ label: 'IGST', value: formatCurrency(gstPreview.igstAmount) }]),
          ] : []),
          { label: 'Grand Total', value: formatCurrency(pricingSummary.grandTotal), highlight: true },
          ...(linkedSo ? [{ label: 'Sales Order', value: linkedSo.salesOrderNo }] : []),
        ]}
        actions={[
          {
            id: 'save',
            label: 'Save Proforma',
            icon: Receipt,
            primary: true,
            onClick: saveProforma,
            disabled: isSubmitting || !hasValidLines,
          },
          { id: 'list', label: 'Proforma Register', icon: FileText, onClick: () => navigate('/sales/proforma-invoices') },
          { id: 'orders', label: 'Sales Orders', icon: Building2, onClick: () => navigate('/sales/orders') },
        ]}
      />
      <p className="mt-3 rounded-lg border border-erp-border bg-erp-surface-alt/60 p-3 text-[12px] text-erp-muted">
        Save as draft — issue the proforma from the detail page. Tax invoice is created later from dispatch.
      </p>
    </EnterpriseBusinessFactBox>
  )

  const lineGrid = (
    <div className="so-pricing-panel so-pricing-panel--pro">
      <div className="so-pricing-table-wrap">
        <table className="so-pricing-table">
          <colgroup>
            <col className="so-pricing-col-idx" />
            <col className="so-pricing-col-product" />
            <col className="so-pricing-col-hsn" />
            <col className="so-pricing-col-qty" />
            <col className="so-pricing-col-price" />
            <col className="so-pricing-col-disc" />
            <col className="so-pricing-col-gst" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money" />
            <col className="so-pricing-col-money-wide" />
            <col className="so-pricing-col-action" />
          </colgroup>
          <thead>
            <tr>
              <th className="so-pricing-th so-pricing-th--center">#</th>
              <th className="so-pricing-th">Product</th>
              <th className="so-pricing-th">HSN</th>
              <th className="so-pricing-th so-pricing-th--right">Qty</th>
              <th className="so-pricing-th so-pricing-th--right">Unit price</th>
              <th className="so-pricing-th so-pricing-th--right">Disc %</th>
              <th className="so-pricing-th so-pricing-th--right">GST %</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Taxable</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">GST</th>
              <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Line total</th>
              <th className="so-pricing-th so-pricing-th--center" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {lineRows.map((row, idx) => {
              const built = buildLinesFromRows([row], items)[0]
              return (
                <tr key={row.key} className="so-pricing-row">
                  <td className="so-pricing-td so-pricing-td--center tabular-nums text-erp-muted">{idx + 1}</td>
                  <td className="so-pricing-td so-pricing-td--product">
                    <ErpSmartSelect
                      options={itemOptions}
                      value={row.itemId}
                      onChange={(v) => {
                        if (!v) return
                        const item = getItem(v)
                        const check = canUseItemInSales(v)
                        if (!check.ok) {
                          setErrors([check.error ?? 'Item is not allowed for sales'])
                          return
                        }
                        patchLine(row.key, {
                          itemId: v,
                          unitPrice: String(item?.defaultSalesRate ?? item?.standardRate ?? row.unitPrice),
                        })
                        void (async () => {
                          const { resolveCommercialLineTax } = await import('../../utils/commercialLineTax')
                          const { useMasterStore: ms } = await import('../../store/masterStore')
                          const store = ms.getState()
                          const snap = await resolveCommercialLineTax({
                            direction: 'SALES',
                            item: item ?? null,
                            hsnById: (hid) => store.getHsn(hid),
                            hsnByCode: (code) => store.getHsnByCode(code),
                            gstRates: store.gstRates,
                          })
                          patchLine(row.key, {
                            taxPct: String(snap.taxPct),
                            hsnCode: snap.hsnSacCode || item?.hsnCode || '',
                          })
                          if (!snap.resolved) {
                            setErrors([
                              snap.blockers[0] ??
                                'GST unresolved for selected item — set HSN / GST group / rate masters',
                            ])
                          } else {
                            setErrors([])
                          }
                        })()
                      }}
                      placeholder="Select sellable item…"
                      appearance="dropdown"
                      dropdownMinWidth={360}
                      emptyMessage="Only items allowed for sales can be selected."
                    />
                  </td>
                  <td className="so-pricing-td tabular-nums text-[12px] text-erp-muted">
                    {(row.hsnCode ?? '').trim()
                      || items.find((i) => i.id === row.itemId)?.hsnCode
                      || '—'}
                  </td>
                  <td className="so-pricing-td">
                    <Input type="number" min={1} className="so-pricing-input so-pricing-input--num" value={row.qty} onChange={(e) => patchLine(row.key, { qty: e.target.value })} />
                  </td>
                  <td className="so-pricing-td">
                    <Input type="number" min={0} className="so-pricing-input so-pricing-input--num" value={row.unitPrice} onChange={(e) => patchLine(row.key, { unitPrice: e.target.value })} />
                  </td>
                  <td className="so-pricing-td">
                    <Input type="number" min={0} max={100} className="so-pricing-input so-pricing-input--num" value={row.discountPct} onChange={(e) => patchLine(row.key, { discountPct: e.target.value })} />
                  </td>
                  <td className="so-pricing-td">
                    <select
                      className="erp-input so-pricing-input so-pricing-input--select"
                      value={row.taxPct}
                      onChange={(e) => patchLine(row.key, { taxPct: e.target.value })}
                    >
                      {GST_RATE_OPTIONS.map((rate) => (
                        <option key={rate} value={rate}>{rate}%</option>
                      ))}
                    </select>
                  </td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--calc tabular-nums">{built ? formatCurrency(built.taxableValue) : '—'}</td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--calc tabular-nums">{built ? formatCurrency(built.gstAmount) : '—'}</td>
                  <td className="so-pricing-td so-pricing-td--right so-pricing-td--total tabular-nums">
                    {built ? formatCurrency(built.lineTotal) : '—'}
                  </td>
                  <td className="so-pricing-td so-pricing-td--center">
                    <button
                      type="button"
                      className="so-pricing-remove"
                      onClick={() => removeLine(row.key)}
                      disabled={lineRows.length <= 1}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="so-pricing-toolbar">
        <button type="button" className="so-pricing-add" onClick={addLine}>
          <Plus className="h-4 w-4" /> Add item line
        </button>
        <p className="so-pricing-toolbar__hint">
          <span className="so-pricing-toolbar__count">{lineRows.length}</span>
          {' '}line{lineRows.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  )

  return (
    <>
      {toast ? <Toast message={toast} /> : null}
      <SalesCardFormShell
        title="New Proforma Invoice"
        badge="Sales"
        className="pi-form-page--zoho crm-lead-form-page crm-lead-form-page--zoho enterprise-workspace--dynamics-form enterprise-workspace--crm-smart-overview"
        recordNo="New"
        recordTitle={recordTitle}
        status="Draft"
        statusTone="info"
        stage={mode === 'sales_order' ? 'From Sales Order' : 'Direct'}
        createdDate={formatDate(proformaDate)}
        company={customer?.customerName}
        favoritePath="/sales/proforma-invoices/new"
        breadcrumbs={salesChildBreadcrumbs('Proforma Invoices', '/sales/proforma-invoices', 'New Proforma')}
        documentStrip={documentStrip}
        validationItems={validationGuideItems}
        validationErrors={validationGuideItems.length ? undefined : errors}
        factBox={factBox}
        collapsibleFactBox
        factBoxLabel="Smart Context"
        onSubmit={(e) => { handleSubmit(e) }}
        onSaveShortcut={() => { handleSubmit({ preventDefault: () => {} } as React.FormEvent) }}
        footer={(
          <ErpStickySaveBar
            cancelTo="/sales/proforma-invoices"
            submitLabel="Save Proforma"
            isSubmitting={isSubmitting || prefillLoading}
            onSave={() => saveProforma()}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete · {formatCurrency(pricingSummary.grandTotal)} grand total
                {validUntil ? ` · Valid until ${formatDate(validUntil)}` : ''}
              </span>
            )}
          />
        )}
      >
       <div className="erp-form-body crm-lead-form-body">
        <div className="crm-lead-zoho-layout pi-zoho-layout">
          <nav className="crm-lead-zoho-rail" aria-label="Proforma form sections">
            <p className="crm-lead-zoho-rail__eyebrow">New Proforma</p>
            <p className="crm-lead-zoho-rail__title">Sections</p>
            <ul className="crm-lead-zoho-rail__list">
              {completionItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn('crm-lead-zoho-rail__item', item.done && 'is-done')}
                    onClick={() => scrollToSection(item.id)}
                  >
                    <span className="crm-lead-zoho-rail__marker" aria-hidden>
                      {item.done ? <Check size={12} strokeWidth={2.5} /> : null}
                    </span>
                    <span className="crm-lead-zoho-rail__label">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="crm-lead-zoho-rail__progress" aria-label={`${completionPercent}% complete`}>
              <div className="crm-lead-zoho-rail__progress-meta">
                <span>Completion</span>
                <strong>{completionPercent}%</strong>
              </div>
              <div className="crm-lead-zoho-rail__bar">
                <div className="crm-lead-zoho-rail__bar-fill" style={{ width: `${completionPercent}%` }} />
              </div>
            </div>
          </nav>

          <div className="crm-lead-zoho-canvas pi-zoho-canvas">
        {prefillLoading ? (
          <div
            className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-900"
            role="status"
            aria-live="polite"
          >
            Loading sales order details…
          </div>
        ) : null}
        <div id="pi-section-source">
        <ErpCardSection
          title="Source & Dates"
          subtitle="Create directly or pull lines and terms from a sales order."
          icon={FileText}
          accent="blue"
          collapsible
          defaultOpen
          columns={2}
        >
          <ErpFieldRow label="Create from" colSpan={2}>
            <ErpSegmentedControl<PiCreateMode>
              name="Proforma create mode"
              value={mode}
              onChange={switchCreateMode}
              options={[
                {
                  value: 'direct',
                  label: 'Direct',
                  description: 'Pick customer and enter product lines manually.',
                  icon: PenLine,
                },
                {
                  value: 'sales_order',
                  label: 'From Sales Order',
                  description: 'Pull customer, terms, and lines from an open SO.',
                  icon: ShoppingBag,
                },
              ]}
            />
          </ErpFieldRow>
          {mode === 'sales_order' ? (
            <ErpFieldRow label="Sales Order" required colSpan={2} hint="Select an open sales order to pre-fill customer and lines">
              <ErpSmartSelect
                options={soOptions}
                value={salesOrderId}
                onChange={(v) => { if (v) applySoPrefill(v) }}
                placeholder={prefillLoading ? 'Loading sales order…' : 'Search sales order no, customer…'}
                appearance="dropdown"
                disabled={prefillLoading}
                resolveOrphanLabel={(id) =>
                  linkedSoMeta?.salesOrderId === id
                    ? linkedSoMeta.salesOrderNo
                    : salesOrders.find((s) => s.id === id)?.salesOrderNo
                }
              />
            </ErpFieldRow>
          ) : (
            <div className="col-span-2">
              <p className="pi-create-mode-hint">
                <Receipt className="h-4 w-4 shrink-0" aria-hidden />
                Direct mode — choose the bill-to customer below and add product lines in the pricing section.
              </p>
            </div>
          )}
          <ErpFieldRow label="Proforma Date">
            <Input type="date" value={proformaDate} onChange={(e) => setProformaDate(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Valid Until">
            <Input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </ErpFieldRow>
          {linkedSo ? (
            <ErpFieldRow label="Linked Sales Order" readOnly>
              <TableLink to={`/sales/orders/${linkedSo.salesOrderId}`}>{linkedSo.salesOrderNo}</TableLink>
            </ErpFieldRow>
          ) : null}
        </ErpCardSection>
        </div>

        <div id="pi-section-customer">
        <ErpCardSection
          title="Customer"
          subtitle="Bill-to account, GST registration, and customer PO reference."
          icon={Building2}
          accent="teal"
          collapsible
          defaultOpen
          columns={2}
        >
          <ErpFieldRow label="Customer" required>
            <ErpSmartSelect
              options={customerOptions}
              value={customerId}
              onChange={(v) => v && setCustomerId(v)}
              disabled={mode === 'sales_order' && Boolean(salesOrderId)}
              placeholder="Search customers…"
              appearance="dropdown"
            />
          </ErpFieldRow>
          {customer ? (
            <aside className="so-customer-card" aria-label="Selected customer">
              <div className="so-customer-card__header">
                <div className="so-customer-card__avatar" aria-hidden>
                  {customer.customerName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="so-customer-card__identity">
                  <div className="so-customer-card__title-row">
                    <h3 className="so-customer-card__name">{customer.customerName}</h3>
                    <span className="so-customer-card__code">{customer.customerCode}</span>
                  </div>
                  <p className="so-customer-card__location">
                    <span>
                      {[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}
                    </span>
                  </p>
                </div>
              </div>
              <dl className="so-customer-card__facts">
                <div className="so-customer-card__fact">
                  <dt>GSTIN</dt>
                  <dd className="tabular-nums">{customer.gstin?.trim() || '—'}</dd>
                </div>
                <div className="so-customer-card__fact">
                  <dt>Credit days</dt>
                  <dd className="tabular-nums">{customer.creditDays} days</dd>
                </div>
                <div className="so-customer-card__fact">
                  <dt>Credit limit</dt>
                  <dd className="tabular-nums">
                    {customer.creditLimit != null && customer.creditLimit > 0
                      ? formatCurrency(customer.creditLimit)
                      : 'No limit'}
                  </dd>
                </div>
              </dl>
            </aside>
          ) : null}
          <ErpFieldRow label="Customer PO">
            <Input value={customerPoNumber} onChange={(e) => setCustomerPoNumber(e.target.value)} placeholder="Optional customer PO reference" />
          </ErpFieldRow>
          <div className="col-span-full">
            <CommercialGstSupplyPanel
              value={gstSupply}
              onChange={setGstSupply}
              customerState={customer?.state}
              customerGstin={customer?.gstin}
              shipToState={shippingAddress || customer?.state}
              billToState={billingAddress || customer?.state}
              isServiceDocument={isServices}
            />
          </div>
        </ErpCardSection>
        </div>

        <div id="pi-section-lines">
        <ErpCardSection
          title="Product & Pricing"
          subtitle="Set quantity, price, discount and GST per product line."
          icon={ClipboardList}
          accent="violet"
          collapsible
          defaultOpen
          className="!max-w-none"
          columns={1}
        >
          {lineGrid}
          <CommercialOrderAdjustmentsBlock
            value={charges}
            onChange={setCharges}
            summary={pricingSummary}
            showFreight={showFreight}
            showExtendedCharges
            gstExtras={gstExtras}
          />
        </ErpCardSection>
        </div>

        <div id="pi-section-commercial">
        <ErpCardSection
          title="Commercial Terms"
          subtitle="Payment, delivery, and notes printed on the proforma."
          icon={Banknote}
          accent="green"
          collapsible
          defaultOpen
          columns={2}
        >
          <ErpFieldRow label="Payment Terms">
            <CommercialTermSelect
              termType="payment"
              value={paymentTerms}
              onChange={setPaymentTerms}
              placeholder="Select payment terms"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms">
            <CommercialTermSelect
              termType="delivery"
              value={deliveryTerms}
              onChange={setDeliveryTerms}
              placeholder="Select delivery terms"
            />
          </ErpFieldRow>
          {showLocationField ? (
            <LocationFieldRow
              value={locationId}
              onChange={(locId) => setLocationId(locId)}
              usage="sales"
              colSpan={2}
              label="Location Code"
              hint="Inherited from sales order when linked"
            />
          ) : null}
          <ErpFieldRow label="Remarks" className="col-span-2">
            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Special instructions for advance billing…" />
          </ErpFieldRow>
        </ErpCardSection>
        </div>
          </div>
        </div>
       </div>
      </SalesCardFormShell>
    </>
  )
}
