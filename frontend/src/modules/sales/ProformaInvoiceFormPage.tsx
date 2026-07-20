import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
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
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import {
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
} from '../../design-system/workspace'
import { useProformaInvoiceStore } from '../../store/proformaInvoiceStore'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { useActiveCustomers, useActiveProducts } from '../../hooks/useMasterLists'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { computeProformaLineTotals } from '../../utils/proformaInvoiceLines'
import { resolveSalesOrderProformaPrefill } from '../../utils/proformaInvoicePrefill'
import type { ProformaInvoiceLine } from '../../types/proformaInvoice'
import { computeGst, gstSchemeLabel } from '../../utils/gstEngine'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { SalesCardFormShell } from './SalesCardFormShell'
import { salesChildBreadcrumbs } from '../../utils/salesNavigation'

type PiCreateMode = 'direct' | 'sales_order'

type PiLineRow = {
  key: string
  productId: string
  qty: string
  unitPrice: string
  discountPct: string
  taxPct: string
}

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

function round2(n: number) {
  return Math.round(n * 100) / 100
}

function toLineRows(lines: ProformaInvoiceLine[]): PiLineRow[] {
  return lines.map((l) => ({
    key: l.id,
    productId: l.productId,
    qty: String(l.qty),
    unitPrice: String(l.unitPrice),
    discountPct: String(l.discountPct),
    taxPct: String(l.taxPct),
  }))
}

function buildLinesFromRows(rows: PiLineRow[], products: ReturnType<typeof useMasterStore.getState>['products']): ProformaInvoiceLine[] {
  return rows
    .filter((r) => r.productId && Number(r.qty) > 0)
    .map((row, idx) => {
      const product = products.find((p) => p.id === row.productId)
      const qty = Number(row.qty) || 0
      const unitPrice = Number(row.unitPrice) || 0
      const discountPct = Number(row.discountPct) || 0
      const taxPct = Number(row.taxPct) || 18
      const totals = computeProformaLineTotals({ qty, unitPrice, discountPct, taxPct })
      return {
        id: row.key,
        lineNo: idx + 1,
        productId: row.productId,
        itemCode: product?.productCode ?? '',
        description: product?.productName ?? '',
        hsnCode: product?.hsnCode ?? '',
        qty,
        uom: 'Nos',
        unitPrice,
        discountPct,
        taxPct,
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
  const products = useActiveProducts()
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getProduct = useMasterStore((s) => s.getProduct)

  const today = new Date().toISOString().slice(0, 10)
  const [activeSection, setActiveSection] = useState('source')
  const [mode, setMode] = useState<PiCreateMode>(initialSoId ? 'sales_order' : 'direct')
  const [salesOrderId, setSalesOrderId] = useState(initialSoId)
  const [customerId, setCustomerId] = useState(() => {
    const prefill = initialSoId ? resolveSalesOrderProformaPrefill(initialSoId) : null
    return prefill?.customerId ?? ''
  })
  const [proformaDate, setProformaDate] = useState(today)
  const [validUntil, setValidUntil] = useState('')
  const [paymentTerms, setPaymentTerms] = useState(() => {
    const prefill = initialSoId ? resolveSalesOrderProformaPrefill(initialSoId) : null
    return prefill?.paymentTerms ?? ''
  })
  const [deliveryTerms, setDeliveryTerms] = useState(() => {
    const prefill = initialSoId ? resolveSalesOrderProformaPrefill(initialSoId) : null
    return prefill?.deliveryTerms ?? ''
  })
  const [customerPoNumber, setCustomerPoNumber] = useState(() => {
    const prefill = initialSoId ? resolveSalesOrderProformaPrefill(initialSoId) : null
    return prefill?.customerPoNumber ?? ''
  })
  const [remarks, setRemarks] = useState('')
  const { locationId, setLocationId } = useDocumentLocation(
    'sales',
    initialSoId ? resolveSalesOrderProformaPrefill(initialSoId)?.locationId : null,
  )
  const [lineRows, setLineRows] = useState<PiLineRow[]>(() => {
    const prefill = initialSoId ? resolveSalesOrderProformaPrefill(initialSoId) : null
    if (prefill?.lines.length) return toLineRows(prefill.lines)
    return [{
      key: crypto.randomUUID(),
      productId: '',
      qty: '1',
      unitPrice: '0',
      discountPct: '0',
      taxPct: '18',
    }]
  })
  const [toast, setToast] = useState<string | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const linkedSo = useMemo(
    () => (salesOrderId ? resolveSalesOrderProformaPrefill(salesOrderId) : null),
    [salesOrderId],
  )

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

  const productOptions = useMemo(
    () => products.map((p) => ({
      value: p.id,
      label: `${p.productCode} · ${p.productName}`,
      searchText: `${p.productCode} ${p.productName}`.toLowerCase(),
    })),
    [products],
  )

  const customer = customerId ? getCustomer(customerId) : undefined
  const lines = useMemo(() => buildLinesFromRows(lineRows, products), [lineRows, products])
  const taxable = useMemo(() => lines.reduce((s, l) => s + l.taxableValue, 0), [lines])
  const gstPreview = useMemo(
    () => (customer ? computeGst(taxable, customer.state) : null),
    [taxable, customer],
  )

  const pricingSummary = useMemo(() => {
    const totalQty = lines.reduce((s, l) => s + l.qty, 0)
    const basicAmount = round2(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0))
    const subtotal = round2(taxable)
    const totalLineDiscount = round2(basicAmount - subtotal)
    const gstByRate = new Map<number, number>()
    for (const line of lines) {
      gstByRate.set(line.taxPct, round2((gstByRate.get(line.taxPct) ?? 0) + line.gstAmount))
    }
    const lineGst = round2(lines.reduce((s, l) => s + l.gstAmount, 0))
    const grandTotal = gstPreview?.grandTotal ?? round2(subtotal + lineGst)
    return { totalQty, basicAmount, subtotal, totalLineDiscount, gstByRate, lineGst, grandTotal }
  }, [lines, taxable, gstPreview])

  const hasValidLines = lines.length > 0 && lines.every((l) => l.productId && l.qty > 0 && l.unitPrice > 0)

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function applySoPrefill(soId: string) {
    const prefill = resolveSalesOrderProformaPrefill(soId)
    if (!prefill) return
    setMode('sales_order')
    setSalesOrderId(soId)
    setCustomerId(prefill.customerId)
    setPaymentTerms(prefill.paymentTerms)
    setDeliveryTerms(prefill.deliveryTerms)
    setCustomerPoNumber(prefill.customerPoNumber ?? '')
    if (prefill.locationId) setLocationId(prefill.locationId)
    setLineRows(toLineRows(prefill.lines))
  }

  function switchCreateMode(next: PiCreateMode) {
    setMode(next)
    if (next === 'direct') {
      setSalesOrderId('')
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
        productId: '',
        qty: '1',
        unitPrice: '0',
        discountPct: '0',
        taxPct: '18',
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
    if (!paymentTerms.trim()) errs.push('Payment terms are required.')
    if (!deliveryTerms.trim()) errs.push('Delivery terms are required.')
    if (lines.length === 0) errs.push('Add at least one line with product and quantity.')
    return errs
  }

  function saveProforma() {
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
      remarks,
      locationId: locationId || null,
      lines,
    }

    const r = mode === 'sales_order' && salesOrderId
      ? createFromSalesOrder(salesOrderId, payload)
      : createDirect({ ...payload, salesOrderId: mode === 'sales_order' ? salesOrderId : null })

    setIsSubmitting(false)
    if (r.ok && r.id) navigate(`/sales/proforma-invoices/${r.id}`)
    else show(r.error ?? 'Failed to create proforma invoice')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    saveProforma()
  }

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`pi-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const completionItems = useMemo(() => [
    { id: 'source', label: 'Source', done: mode === 'direct' || Boolean(salesOrderId) },
    { id: 'customer', label: 'Customer', done: Boolean(customerId) },
    { id: 'lines', label: 'Products', done: hasValidLines },
    { id: 'commercial', label: 'Commercial', done: Boolean(paymentTerms.trim() && deliveryTerms.trim()) },
  ], [mode, salesOrderId, customerId, hasValidLines, paymentTerms, deliveryTerms])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const sectionNavItems = useMemo(() => [
    { id: 'source', label: 'Source', icon: FileText, done: completionItems.find((i) => i.id === 'source')?.done },
    { id: 'customer', label: 'Customer', icon: Building2, done: completionItems.find((i) => i.id === 'customer')?.done },
    { id: 'lines', label: 'Products', icon: ClipboardList, done: completionItems.find((i) => i.id === 'lines')?.done },
    { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
  ], [completionItems])

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Line Items', value: String(lines.length), accent: 'green' as const, hint: hasValidLines ? formatCurrency(pricingSummary.grandTotal) : 'Add products' },
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
          { label: 'Taxable', value: formatCurrency(pricingSummary.subtotal) },
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
    <div className="col-span-2 overflow-x-auto erp-line-items-grid">
      <table className="w-full min-w-[960px] text-[12px] erp-line-items-grid__table">
        <thead>
          <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-left text-[11px] uppercase tracking-wide text-erp-muted">
            <th className="px-2 py-2 erp-line-items-grid__sticky-sr">#</th>
            <th className="px-2 py-2 erp-line-items-grid__sticky-product">Product</th>
            <th className="px-2 py-2 text-right">Qty</th>
            <th className="px-2 py-2 text-right">Unit Price</th>
            <th className="px-2 py-2 text-right">Disc %</th>
            <th className="px-2 py-2">GST %</th>
            <th className="px-2 py-2 text-right">Taxable</th>
            <th className="px-2 py-2 text-right">GST</th>
            <th className="px-2 py-2 text-right">Line Total</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {lineRows.map((row, idx) => {
            const built = buildLinesFromRows([row], products)[0]
            return (
              <tr key={row.key} className="border-b border-erp-border/60">
                <td className="px-2 py-2 tabular-nums text-erp-muted erp-line-items-grid__sticky-sr">{idx + 1}</td>
                <td className="px-2 py-2 min-w-[220px] erp-line-items-grid__sticky-product">
                  <ErpSmartSelect
                    options={productOptions}
                    value={row.productId}
                    onChange={(v) => {
                      if (!v) return
                      const p = getProduct(v)
                      patchLine(row.key, { productId: v, unitPrice: String(p?.standardPrice ?? row.unitPrice) })
                    }}
                    placeholder="Select product…"
                    appearance="dropdown"
                  />
                </td>
                <td className="px-2 py-2">
                  <Input type="number" min={1} className="text-right w-20" value={row.qty} onChange={(e) => patchLine(row.key, { qty: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <Input type="number" min={0} className="text-right w-28" value={row.unitPrice} onChange={(e) => patchLine(row.key, { unitPrice: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <Input type="number" min={0} max={100} className="text-right w-16" value={row.discountPct} onChange={(e) => patchLine(row.key, { discountPct: e.target.value })} />
                </td>
                <td className="px-2 py-2">
                  <select
                    className="erp-input h-9 w-full"
                    value={row.taxPct}
                    onChange={(e) => patchLine(row.key, { taxPct: e.target.value })}
                  >
                    {GST_RATE_OPTIONS.map((rate) => (
                      <option key={rate} value={rate}>{rate}%</option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-2 text-right tabular-nums">{built ? formatCurrency(built.taxableValue) : '—'}</td>
                <td className="px-2 py-2 text-right tabular-nums">{built ? formatCurrency(built.gstAmount) : '—'}</td>
                <td className="px-2 py-2 text-right font-semibold tabular-nums text-erp-primary">
                  {built ? formatCurrency(built.lineTotal) : '—'}
                </td>
                <td className="px-2 py-2">
                  <button
                    type="button"
                    className="rounded p-1 text-erp-muted hover:bg-erp-danger/10 hover:text-erp-danger"
                    onClick={() => removeLine(row.key)}
                    disabled={lineRows.length <= 1}
                    aria-label="Remove line"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <button
        type="button"
        className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-erp-primary hover:underline"
        onClick={addLine}
      >
        <Plus className="h-3.5 w-3.5" /> Add product line
      </button>
    </div>
  )

  return (
    <>
      {toast ? <Toast message={toast} /> : null}
      <SalesCardFormShell
        title="New Proforma Invoice"
        badge="Sales"
        className="enterprise-workspace--dynamics-form"
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
            isSubmitting={isSubmitting}
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
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
        />

        <ErpCardSection
          id="pi-section-source"
          title="Source & Dates"
          subtitle="Create directly or pull lines and terms from a sales order."
          icon={FileText}
          accent="blue"
          collapsible
          defaultOpen
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
                placeholder="Search sales order no, customer…"
                appearance="dropdown"
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

        <ErpCardSection
          id="pi-section-customer"
          title="Customer"
          subtitle="Bill-to account, GST registration, and customer PO reference."
          icon={Building2}
          accent="teal"
          collapsible
          defaultOpen
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
        </ErpCardSection>

        <ErpCardSection
          id="pi-section-lines"
          title="Product & Pricing"
          subtitle="Set quantity, price, discount and GST per product line."
          icon={ClipboardList}
          accent="violet"
          collapsible
          defaultOpen
          className="!max-w-none"
        >
          {lineGrid}
          <div className="col-span-2 flex justify-end pt-2">
            <div className="quo-editor-price__summary so-direct-order-summary">
              <div className="quo-editor-price__summary-row">
                <span>Total Quantity</span>
                <span className="tabular-nums">{pricingSummary.totalQty}</span>
              </div>
              <div className="quo-editor-price__summary-row">
                <span>Basic Amount</span>
                <span className="tabular-nums">{formatCurrency(pricingSummary.basicAmount)}</span>
              </div>
              {pricingSummary.totalLineDiscount > 0 ? (
                <div className="quo-editor-price__summary-row">
                  <span>Line Discount</span>
                  <span className="tabular-nums">−{formatCurrency(pricingSummary.totalLineDiscount)}</span>
                </div>
              ) : null}
              <div className="quo-editor-price__summary-row">
                <span>Taxable Amount</span>
                <span className="tabular-nums">{formatCurrency(pricingSummary.subtotal)}</span>
              </div>
              {[...pricingSummary.gstByRate.entries()]
                .sort(([a], [b]) => a - b)
                .map(([rate, amount]) => (
                  <div key={rate} className="quo-editor-price__summary-row">
                    <span>GST @ {rate}%</span>
                    <span className="tabular-nums">{formatCurrency(amount)}</span>
                  </div>
                ))}
              {gstPreview ? (
                <>
                  <div className="quo-editor-price__summary-row">
                    <span>GST Scheme</span>
                    <span>{gstSchemeLabel(gstPreview.scheme)}</span>
                  </div>
                  {gstPreview.scheme === 'cgst_sgst' ? (
                    <>
                      <div className="quo-editor-price__summary-row">
                        <span>CGST</span>
                        <span className="tabular-nums">{formatCurrency(gstPreview.cgstAmount)}</span>
                      </div>
                      <div className="quo-editor-price__summary-row">
                        <span>SGST</span>
                        <span className="tabular-nums">{formatCurrency(gstPreview.sgstAmount)}</span>
                      </div>
                    </>
                  ) : (
                    <div className="quo-editor-price__summary-row">
                      <span>IGST</span>
                      <span className="tabular-nums">{formatCurrency(gstPreview.igstAmount)}</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="quo-editor-price__summary-row">
                  <span>Total GST</span>
                  <span className="tabular-nums">{formatCurrency(pricingSummary.lineGst)}</span>
                </div>
              )}
              <div className="quo-editor-price__summary-row quo-editor-price__summary-row--total">
                <span>Grand Total</span>
                <span className="tabular-nums">{formatCurrency(pricingSummary.grandTotal)}</span>
              </div>
            </div>
          </div>
        </ErpCardSection>

        <ErpCardSection
          id="pi-section-commercial"
          title="Commercial Terms"
          subtitle="Payment, delivery, and notes printed on the proforma."
          icon={Banknote}
          accent="green"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Payment Terms" required className="col-span-2">
            <Textarea rows={2} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms" required className="col-span-2">
            <Textarea rows={2} value={deliveryTerms} onChange={(e) => setDeliveryTerms(e.target.value)} />
          </ErpFieldRow>
          <LocationFieldRow
            value={locationId}
            onChange={(locId) => setLocationId(locId)}
            usage="sales"
            colSpan={2}
            label="Location Code"
            hint="Inherited from sales order when linked"
          />
          <ErpFieldRow label="Remarks" className="col-span-2">
            <Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Special instructions for advance billing…" />
          </ErpFieldRow>
        </ErpCardSection>
      </SalesCardFormShell>
    </>
  )
}
