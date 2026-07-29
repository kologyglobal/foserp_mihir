import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  Check,
  ChevronRight,
  ClipboardList,
  Download,
  FileText,
  MapPin,
  PenLine,
  Plus,
  Printer,
  Receipt,
  Send,
  ShoppingBag,
  Trash2,
  XCircle,
  ArrowLeftRight,
} from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { ErpCardSection, ErpFieldGroup, ErpFieldRow } from '../../../components/erp/card-form'
import { FormActionBar } from '../../../components/erp/FormActionBar'
import { ErpSegmentedControl } from '../../../components/erp/ErpSegmentedControl'
import { ErpSmartSelect } from '../../../components/erp/ErpSmartSelect'
import { Select, Input, Textarea } from '../../../components/forms/Inputs'
import { CommercialTermSelect } from '../../../components/masters/GeographySelects'
import { TableLink } from '../../../components/ui/AppLink'
import { Toast } from '../../../components/ui/Toast'
import { SELECT_PLACEHOLDER } from '../../../components/forms/selectStandards'
import { useSellableItems } from '../../../hooks/useMasterLists'
import { canUseItemInSales } from '../../../utils/opportunityItemOptions'
import { salesCustomer360Path } from '../../../config/entity360Routes'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
} from '../../../design-system/workspace'
import { SalesCardFormShell } from '../../sales/SalesCardFormShell'
import { salesChildBreadcrumbs } from '../../../utils/salesNavigation'
import { useCrmCommercialStore } from '../../../store/crmCommercialStore'
import { useMasterStore } from '../../../store/masterStore'
import { useMrpStore } from '../../../store/mrpStore'
import { useProformaInvoiceStore } from '../../../store/proformaInvoiceStore'
import { formatCurrency } from '../../../utils/formatters/currency'
import { formatDate } from '../../../utils/dates/format'
import { canCrmPermission } from '../../../utils/permissions/crm'
import { downloadPaymentReceiptPdf } from '../../../utils/paymentReceiptExport'
import { notify } from '../../../store/toastStore'
import { isApiMode } from '../../../config/apiConfig'
import {
  apiCancelDraftInvoice,
  apiCreateInvoice,
  apiPostInvoice,
  apiReceiveProformaPayment,
} from '../../../services/bridges/crmCommercialApiBridge'
import type { CrmPaymentMode } from '../../../types/crmCommercial'
import {
  CRM_PAYMENT_MODE_LABELS,
  CRM_TAX_INVOICE_STATUS_LABELS,
  CRM_INVOICE_PAYMENT_STATUS_LABELS,
} from '../../../types/crmCommercial'
import { computeProformaLineTotals } from '../../../utils/proformaInvoiceLines'
import { computeGst, gstSchemeLabel } from '../../../utils/gstEngine'
import {
  blankTaxInvoiceLine,
  resolveTaxInvoiceFromCustomer,
  resolveTaxInvoiceFromProforma,
  resolveTaxInvoiceFromSalesOrder,
  type TaxInvoicePrefill,
} from '../../../utils/taxInvoicePrefill'
import { SalesTaxInvoiceListPage } from '../../sales/SalesTaxInvoiceListPage'
import { cn } from '../../../utils/cn'
import type { CrmCommercialLine } from '../../../types/crmCommercial'
import { DEFAULT_GST_RATE } from '../../../types/invoice'

type InvoiceCreateSource = 'sales_order' | 'proforma' | 'direct'

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

/** @deprecated Use SalesTaxInvoiceListPage — kept for older imports. */
export function CrmInvoiceListPage() {
  return <SalesTaxInvoiceListPage />
}

export function CrmInvoiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const invoice = useCrmCommercialStore((s) => (id ? s.invoices.find((i) => i.id === id) : undefined))
  const postInvoice = useCrmCommercialStore((s) => s.postInvoice)
  const cancelDraftInvoice = useCrmCommercialStore((s) => s.cancelDraftInvoice)
  const allAllocations = useCrmCommercialStore((s) => s.allocations)
  const allocations = useMemo(
    () => (id ? allAllocations.filter((a) => a.invoiceId === id && !a.reversedAt) : []),
    [allAllocations, id],
  )
  const [toast, setToast] = useState<string | null>(null)

  if (!invoice) {
    return (
      <OperationalPageShell title="Invoice not found" breadcrumbs={[{ label: 'Sales', to: '/sales' }, { label: 'Not found' }]}>
        <Link to="/sales/invoices" className="text-sm font-semibold text-erp-primary">Back to invoices</Link>
      </OperationalPageShell>
    )
  }

  function act(label: string, fn: () => { ok: boolean; error?: string } | Promise<{ ok: boolean; error?: string }>) {
    void Promise.resolve(fn()).then((r) => {
      setToast(r.ok ? label : (r.error ?? 'Action failed'))
    })
  }

  return (
    <>
      <Toast message={toast} />
      <OperationalPageShell
        variant="dynamics"
        badge="Sales"
        title={invoice.invoiceNo}
        description={`${invoice.customerName} · ${CRM_TAX_INVOICE_STATUS_LABELS[invoice.status]}`}
        breadcrumbs={[
          { label: 'Sales', to: '/sales' },
          { label: 'Tax Invoices', to: '/sales/invoices' },
          { label: invoice.invoiceNo },
        ]}
        favoritePath={`/sales/invoices/${invoice.id}`}
        commandBar={(
          <ErpCommandBar
            sticky={false}
            primaryAction={
              invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.post')
                ? {
                    id: 'post',
                    label: 'Post Invoice',
                    icon: Send,
                    onClick: () =>
                      act('Invoice posted', () =>
                        isApiMode() ? apiPostInvoice(invoice.id) : postInvoice(invoice.id),
                      ),
                  }
                : invoice.balanceDue > 0 && invoice.status !== 'cancelled' && invoice.status !== 'draft'
                  ? {
                      id: 'alloc',
                      label: 'Allocate Payment',
                      icon: ArrowLeftRight,
                      onClick: () => navigate(`/sales/payment-allocation?customerId=${invoice.customerId}&invoiceId=${invoice.id}`),
                    }
                  : undefined
            }
            secondaryActions={[
              ...(invoice.status === 'draft' && canCrmPermission('crm.commercial.invoice.cancel')
                ? [{
                    id: 'cancel',
                    label: 'Cancel Draft',
                    icon: XCircle,
                    onClick: () =>
                      act('Draft cancelled', () =>
                        isApiMode() ? apiCancelDraftInvoice(invoice.id) : cancelDraftInvoice(invoice.id),
                      ),
                  }]
                : []),
              { id: 'customer', label: 'Customer 360', icon: FileText, onClick: () => navigate(salesCustomer360Path(invoice.customerId)) },
            ]}
          />
        )}
        insights={[
          { label: 'Status', value: CRM_TAX_INVOICE_STATUS_LABELS[invoice.status], accent: invoice.status === 'paid' ? 'green' : 'amber' },
          { label: 'Total', value: formatCurrency(invoice.gst.grandTotal), accent: 'blue' },
          { label: 'Paid', value: formatCurrency(invoice.amountPaid), accent: 'green' },
          { label: 'Balance', value: formatCurrency(invoice.balanceDue), accent: 'amber' },
        ]}
      >
        <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
          <div className="space-y-4">
            <ErpCardSection title="Invoice lines">
              <div className="col-span-2 overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead>
                    <tr className="border-b border-erp-border text-erp-muted">
                      <th className="py-2 pr-3">Item</th>
                      <th className="py-2 pr-3">Qty</th>
                      <th className="py-2 pr-3">Rate</th>
                      <th className="py-2 pr-3">Tax %</th>
                      <th className="py-2">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.lines.map((line) => (
                      <tr key={line.id} className="border-b border-erp-border/60">
                        <td className="py-2 pr-3">
                          <div className="font-medium">{line.itemCode}</div>
                          <div className="text-[12px] text-erp-muted">{line.description}</div>
                        </td>
                        <td className="py-2 pr-3">{line.qty} {line.uom}</td>
                        <td className="py-2 pr-3">{formatCurrency(line.unitPrice)}</td>
                        <td className="py-2 pr-3">{line.taxPct}%</td>
                        <td className="py-2">{formatCurrency(line.lineTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ErpCardSection>
            <ErpCardSection title="Allocation history">
              <div className="col-span-2 space-y-2">
                {allocations.length === 0 ? (
                  <p className="text-[13px] text-erp-muted">No allocations yet.</p>
                ) : (
                  allocations.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded border border-erp-border px-3 py-2 text-[13px]">
                      <span>
                        {formatDate(a.allocationDate)} · {a.receiptNo}
                        {a.reversedAt ? <span className="ml-2 text-erp-danger">(Reversed)</span> : null}
                      </span>
                      <span className="font-semibold">{formatCurrency(a.amount)}</span>
                    </div>
                  ))
                )}
              </div>
            </ErpCardSection>
          </div>
          <aside className="space-y-4">
            <ErpCardSection title="References">
              <ErpFieldRow label="Customer" readOnly>
                <TableLink to={salesCustomer360Path(invoice.customerId)}>{invoice.customerName}</TableLink>
              </ErpFieldRow>
              {invoice.salesOrderId ? (
                <ErpFieldRow label="Sales Order" readOnly>
                  <TableLink to={`/crm/sales-orders/${invoice.salesOrderId}`}>{invoice.salesOrderNo}</TableLink>
                </ErpFieldRow>
              ) : null}
              {invoice.quotationId ? (
                <ErpFieldRow label="Quotation" readOnly>
                  <TableLink to={`/crm/quotations/${invoice.quotationId}`}>{invoice.quotationNo ?? invoice.quotationId}</TableLink>
                </ErpFieldRow>
              ) : null}
              {invoice.proformaInvoiceId ? (
                <ErpFieldRow label="Proforma" readOnly>
                  <TableLink to={`/sales/proforma-invoices/${invoice.proformaInvoiceId}`}>{invoice.proformaNo}</TableLink>
                </ErpFieldRow>
              ) : null}
              <ErpFieldRow label="Payment status" readOnly>
                {CRM_INVOICE_PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
              </ErpFieldRow>
              <ErpFieldRow label="Delivery" readOnly>{invoice.deliveryTerms || '—'}</ErpFieldRow>
              <ErpFieldRow label="Payment terms" readOnly>{invoice.paymentTerms || '—'}</ErpFieldRow>
            </ErpCardSection>
          </aside>
        </div>
      </OperationalPageShell>
    </>
  )
}

function recomputePrefill(prefill: TaxInvoicePrefill, lines: CrmCommercialLine[]): TaxInvoicePrefill {
  const withNos = lines.map((line, idx) => ({ ...line, lineNo: idx + 1 }))
  const taxable = withNos.reduce((s, l) => s + l.taxableValue, 0)
  const avgRate = withNos.length
    ? withNos.reduce((s, l) => s + l.taxPct, 0) / withNos.length
    : DEFAULT_GST_RATE
  return {
    ...prefill,
    lines: withNos,
    gst: computeGst(taxable, prefill.customerState, avgRate),
  }
}

function patchPrefillLineQty(prefill: TaxInvoicePrefill, lineId: string, qtyRaw: string): TaxInvoicePrefill {
  const qty = Number(qtyRaw)
  const lines = prefill.lines.map((line) => {
    if (line.id !== lineId) return line
    const nextQty = Number.isFinite(qty)
      ? Math.max(0, line.maxQty != null ? Math.min(qty, line.maxQty) : qty)
      : 0
    const totals = computeProformaLineTotals({ ...line, qty: nextQty })
    return { ...line, qty: nextQty, ...totals }
  })
  return recomputePrefill(prefill, lines)
}

function patchPrefillLine(
  prefill: TaxInvoicePrefill,
  lineId: string,
  patch: Partial<CrmCommercialLine>,
): TaxInvoicePrefill {
  const lines = prefill.lines.map((line) => {
    if (line.id !== lineId) return line
    const next = { ...line, ...patch }
    const totals = computeProformaLineTotals(next)
    return { ...next, ...totals }
  })
  return recomputePrefill(prefill, lines)
}

export function CrmInvoiceCreatePage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const salesOrderId = params.get('salesOrderId')
  const proformaId = params.get('proformaId')
  const customerIdParam = params.get('customerId')

  const createInvoice = useCrmCommercialStore((s) => s.createInvoice)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const proformas = useProformaInvoiceStore((s) => s.proformaInvoices)
  const customers = useMasterStore((s) => s.customers)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getItem = useMasterStore((s) => s.getItem)
  const sellableItems = useSellableItems()

  const [sourceType, setSourceType] = useState<InvoiceCreateSource>(
    salesOrderId ? 'sales_order' : proformaId ? 'proforma' : 'direct',
  )
  const [selectedSo, setSelectedSo] = useState(salesOrderId ?? '')
  const [selectedPi, setSelectedPi] = useState(proformaId ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState(customerIdParam ?? '')
  const [prefill, setPrefill] = useState<TaxInvoicePrefill | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const isDirect = sourceType === 'direct' || prefill?.source === 'direct'

  const confirmedSos = useMemo(
    () => salesOrders.filter((s) => s.status !== 'open' && s.status !== 'closed'),
    [salesOrders],
  )
  const issuedPis = useMemo(() => proformas.filter((p) => p.status === 'issued'), [proformas])

  const soOptions = useMemo(
    () =>
      confirmedSos.map((so) => ({
        value: so.id,
        label: `${so.salesOrderNo} — ${getCustomer(so.customerId)?.customerName ?? so.customerId}`,
        searchText: `${so.salesOrderNo} ${getCustomer(so.customerId)?.customerName ?? ''}`.toLowerCase(),
      })),
    [confirmedSos, getCustomer],
  )
  const piOptions = useMemo(
    () =>
      issuedPis.map((pi) => ({
        value: pi.id,
        label: `${pi.proformaNo} — ${pi.customerName}`,
        searchText: `${pi.proformaNo} ${pi.customerName}`.toLowerCase(),
      })),
    [issuedPis],
  )
  const customerOptions = useMemo(
    () =>
      customers
        .filter((c) => c.isActive)
        .map((c) => ({
          value: c.id,
          label: c.customerName,
          searchText: `${c.customerName} ${c.customerCode ?? ''}`.toLowerCase(),
        })),
    [customers],
  )
  const itemOptions = useMemo(
    () =>
      sellableItems.map((i) => ({
        value: i.id,
        label: `${i.itemCode} · ${i.itemName}`,
        searchText: `${i.itemCode} ${i.itemName}`.toLowerCase(),
      })),
    [sellableItems],
  )

  const activeLines = useMemo(
    () =>
      prefill
        ? prefill.lines.filter((l) => l.qty > 0 && Boolean(l.itemId || l.itemCode) && l.unitPrice >= 0)
        : [],
    [prefill],
  )
  const canCreate = Boolean(
    prefill &&
      activeLines.length > 0 &&
      activeLines.every((l) => l.itemId || l.itemCode) &&
      !creating,
  )

  const sourceDone = Boolean(
    (sourceType === 'sales_order' && selectedSo && prefill) ||
      (sourceType === 'proforma' && selectedPi && prefill) ||
      (sourceType === 'direct' && selectedCustomer && prefill),
  )
  const linesDone = activeLines.length > 0
  const completionItems = useMemo(
    () => [
      { id: 'source', label: 'Source document', done: sourceDone },
      { id: 'customer', label: 'Customer & Commercial', done: Boolean(prefill) },
      { id: 'lines', label: 'Invoice lines', done: linesDone },
      { id: 'totals', label: 'Tax & Totals', done: canCreate },
    ],
    [sourceDone, prefill, linesDone, canCreate],
  )
  const completionPercent = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100,
  )

  function clearLoaded() {
    setPrefill(null)
  }

  function loadFromSalesOrder(soId: string) {
    if (!soId) {
      clearLoaded()
      setError(null)
      return
    }
    const result = resolveTaxInvoiceFromSalesOrder(soId)
    if (!result.ok) {
      clearLoaded()
      setError(result.error)
      return
    }
    setPrefill(result.data)
    setError(null)
  }

  function loadFromProforma(piId: string) {
    if (!piId) {
      clearLoaded()
      setError(null)
      return
    }
    const result = resolveTaxInvoiceFromProforma(piId)
    if (!result.ok) {
      clearLoaded()
      setError(result.error)
      return
    }
    setPrefill(result.data)
    setError(null)
  }

  function loadFromCustomer(customerId: string) {
    if (!customerId) {
      clearLoaded()
      setError(null)
      return
    }
    const result = resolveTaxInvoiceFromCustomer(customerId)
    if (!result.ok) {
      clearLoaded()
      setError(result.error)
      return
    }
    setSelectedSo('')
    setPrefill(result.data)
    setError(null)
  }

  function switchSourceType(next: InvoiceCreateSource) {
    setSourceType(next)
    clearLoaded()
    setError(null)
    if (next !== 'sales_order') setSelectedSo('')
    if (next !== 'proforma') setSelectedPi('')
    if (next !== 'direct') setSelectedCustomer('')
  }

  function addDirectLine() {
    if (!prefill) return
    setPrefill(recomputePrefill(prefill, [...prefill.lines, blankTaxInvoiceLine(prefill.lines.length + 1)]))
  }

  function removeDirectLine(lineId: string) {
    if (!prefill || prefill.lines.length <= 1) return
    setPrefill(recomputePrefill(prefill, prefill.lines.filter((l) => l.id !== lineId)))
  }

  function selectDirectItem(lineId: string, itemId: string) {
    if (!prefill || !itemId) return
    const check = canUseItemInSales(itemId)
    if (!check.ok) {
      setError(check.error ?? 'Item is not allowed for sales')
      return
    }
    const item = getItem(itemId)
    setError(null)
    setPrefill(
      patchPrefillLine(prefill, lineId, {
        itemId,
        itemCode: item?.itemCode ?? '',
        description: item?.itemName ?? '',
        hsnCode: item?.hsnCode ?? '',
        uom: 'Nos',
        unitPrice: item?.defaultSalesRate ?? item?.standardRate ?? 0,
        taxPct: DEFAULT_GST_RATE,
      }),
    )
  }

  useEffect(() => {
    if (salesOrderId) loadFromSalesOrder(salesOrderId)
    else if (proformaId) loadFromProforma(proformaId)
    else if (customerIdParam) loadFromCustomer(customerIdParam)
    // Initial deep-link preload only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function persistDraft(
    localCreate: () => { ok: boolean; error?: string; id?: string },
  ): Promise<{ ok: boolean; error?: string; id?: string }> {
    if (!isApiMode()) return localCreate()

    const local = localCreate()
    if (!local.ok || !local.id) return local
    const draft = useCrmCommercialStore.getState().getInvoice(local.id)
    useCrmCommercialStore.setState((s) => ({
      invoices: s.invoices.filter((i) => i.id !== local.id),
    }))
    if (!draft) return { ok: false, error: 'Draft invoice missing after create' }
    return apiCreateInvoice({
      customerId: draft.customerId,
      source: draft.source,
      salesOrderId: draft.salesOrderId,
      salesOrderNo: draft.salesOrderNo,
      proformaInvoiceId: draft.proformaInvoiceId,
      proformaNo: draft.proformaNo,
      quotationId: draft.quotationId,
      quotationNo: draft.quotationNo,
      paymentTerms: draft.paymentTerms,
      deliveryTerms: draft.deliveryTerms,
      customerPoNumber: draft.customerPoNumber,
      billingAddress: draft.billingAddress,
      shippingAddress: draft.shippingAddress,
      remarks: draft.remarks,
      customerState: draft.customerState,
      lines: draft.lines,
    })
  }

  async function handleCreate() {
    setError(null)
    if (!prefill || activeLines.length === 0) {
      setError(
        isDirect
          ? 'Select a customer and add at least one product line before saving.'
          : 'Select a source document to load the invoice first.',
      )
      return
    }

    setCreating(true)
    const result = await persistDraft(() =>
      createInvoice({
        customerId: prefill.customerId,
        source: prefill.source,
        salesOrderId: prefill.salesOrderId,
        proformaInvoiceId: prefill.proformaInvoiceId,
        quotationId: prefill.quotationId,
        quotationNo: prefill.quotationNo,
        paymentTerms: prefill.paymentTerms,
        deliveryTerms: prefill.deliveryTerms,
        customerPoNumber: prefill.customerPoNumber,
        billingAddress: prefill.billingAddress,
        shippingAddress: prefill.shippingAddress,
        remarks: prefill.remarks,
        lines: activeLines,
      }),
    )

    setCreating(false)
    if (!result.ok || !result.id) {
      setError(result.error ?? 'Could not create invoice')
      return
    }
    notify.success('Draft invoice created')
    navigate(`/sales/invoices/${result.id}`)
  }

  function scrollToInvoiceSection(sectionId: string) {
    document.getElementById(`ti-section-${sectionId}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }

  const factBox = (
    <EnterpriseBusinessFactBox
      completion={{ percent: completionPercent, items: completionItems }}
      aiInsights={[
        {
          id: 'ready',
          label: 'Readiness',
          value: canCreate ? 'Ready to create draft' : sourceDone ? 'Review lines & totals' : 'Select a source',
          tone: canCreate ? ('success' as const) : ('warning' as const),
        },
        {
          id: 'next',
          label: 'Suggested Next',
          value: !sourceDone
            ? 'Choose SO, proforma, or direct customer'
            : !linesDone
              ? isDirect
                ? 'Add product lines with qty > 0'
                : 'Set at least one line qty > 0'
              : 'Create draft invoice',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormContextPanel
        summaryTitle="Invoice preview"
        actionsTitle="Quick actions"
        summary={[
          { label: 'Customer', value: prefill?.customerName ?? '—' },
          {
            label: 'Document',
            value: prefill?.salesOrderNo ?? prefill?.proformaNo ?? (isDirect && prefill ? 'Direct' : '—'),
          },
          { label: 'Active lines', value: String(activeLines.length) },
          {
            label: 'Grand total',
            value: prefill ? formatCurrency(prefill.gst.grandTotal) : '—',
            highlight: true,
          },
          {
            label: 'Tax scheme',
            value: prefill ? gstSchemeLabel(prefill.gst.scheme) : '—',
          },
        ]}
        actions={[
          {
            id: 'create',
            label: creating ? 'Creating…' : 'Create Draft Invoice',
            icon: canCreate ? ChevronRight : Plus,
            primary: true,
            onClick: () => void handleCreate(),
            disabled: !canCreate,
          },
          {
            id: 'list',
            label: 'Tax Invoice Register',
            icon: ClipboardList,
            onClick: () => navigate('/sales/invoices'),
          },
        ]}
      />
      <p className="mt-3 rounded-lg border border-erp-border bg-erp-surface-alt/60 p-3 text-[12px] text-erp-muted">
        Direct invoices need only a customer and product lines. From SO/proforma, partial quantities stay available for another invoice. Drafts can be cancelled before posting.
      </p>
    </EnterpriseBusinessFactBox>
  )

  return (
    <SalesCardFormShell
      title="Create Tax Invoice"
      badge="Sales"
      className={`${ENTERPRISE_FORM_CLASS} crm-lead-form-page crm-lead-form-page--zoho crm-sales-invoice-form-page--zoho enterprise-workspace--crm-smart-overview`}
      recordNo="New"
      recordTitle={prefill?.customerName ?? 'Tax Invoice'}
      status="Draft"
      statusTone="info"
      stage={
        sourceType === 'sales_order'
          ? 'From Sales Order'
          : sourceType === 'proforma'
            ? 'From Proforma'
            : 'Direct'
      }
      createdDate={formatDate(new Date().toISOString().slice(0, 10))}
      company={prefill?.customerName}
      favoritePath="/sales/invoices/new"
      breadcrumbs={salesChildBreadcrumbs('Tax Invoices', '/sales/invoices', 'New Invoice')}
      validationErrors={error ? [error] : undefined}
      factBox={factBox}
      suppressFactBoxRecord
      collapsibleFactBox
      factBoxLabel="Smart Context"
      hideRecordBar
      stickyFooter
      onSubmit={(e) => {
        e.preventDefault()
        void handleCreate()
      }}
      onSaveShortcut={() => void handleCreate()}
      footer={(
        <FormActionBar
          sticky
          busy={creating}
          disabled={!canCreate}
          disabledReason={!sourceDone ? (isDirect ? 'Select a customer' : 'Select a source document') : !linesDone ? 'Add at least one product line' : undefined}
          dirty={Boolean(selectedSo || selectedPi || selectedCustomer || prefill)}
          saveLabel="Create Draft Invoice"
          onCancel={() => navigate('/sales/invoices')}
          onSave={() => void handleCreate()}
          hint={(
            <span className="text-[12px] text-erp-muted">
              {completionPercent}% complete
              {prefill ? ` · ${formatCurrency(prefill.gst.grandTotal)} grand total` : ' · Select a source to continue'}
            </span>
          )}
        />
      )}
    >
      <div className="erp-form-body crm-lead-form-body crm-sales-invoice-create-body">
        <div className="crm-lead-zoho-layout">
          <nav className="crm-lead-zoho-rail" aria-label="Tax invoice form sections">
            <p className="crm-lead-zoho-rail__eyebrow">Create Tax Invoice</p>
            <p className="crm-lead-zoho-rail__title">Sections</p>
            <ul className="crm-lead-zoho-rail__list">
              {completionItems.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={cn('crm-lead-zoho-rail__item', item.done && 'is-done')}
                    onClick={() => scrollToInvoiceSection(item.id)}
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

          <div className="crm-lead-form-flow crm-lead-zoho-canvas">
      <div id="ti-section-source" className="crm-lead-quick-entry crm-lead-zoho-block">
      <ErpFieldGroup label="Tax Invoice Information" columns={4} className="crm-lead-zoho-section">
        <ErpFieldRow label="Create from" colSpan={3} horizontal={false}>
          <ErpSegmentedControl<InvoiceCreateSource>
            name="Tax invoice create source"
            value={sourceType}
            onChange={switchSourceType}
            options={[
              {
                value: 'sales_order',
                label: 'Sales Order',
                description: 'Pull remaining qty and terms from a confirmed SO.',
                icon: ShoppingBag,
              },
              {
                value: 'proforma',
                label: 'Proforma',
                description: 'Convert an issued proforma into a tax invoice.',
                icon: Receipt,
              },
              {
                value: 'direct',
                label: 'Direct',
                description: 'Pick a customer and enter product lines — no SO or proforma needed.',
                icon: Building2,
              },
            ]}
          />
        </ErpFieldRow>

        {sourceType === 'sales_order' ? (
          <ErpFieldRow
            label="Sales Order"
            required
            colSpan={3}
            horizontal={false}
            hint="Confirmed sales orders only — open drafts are excluded"
          >
            <ErpSmartSelect
              options={soOptions}
              value={selectedSo}
              onChange={(v) => {
                const id = v ?? ''
                setSelectedSo(id)
                loadFromSalesOrder(id)
              }}
              placeholder="Search sales order no, customer…"
              appearance="dropdown"
              emptyMessage="No confirmed sales orders available."
            />
          </ErpFieldRow>
        ) : null}

        {sourceType === 'proforma' ? (
          <ErpFieldRow
            label="Proforma Invoice"
            required
            colSpan={3}
            horizontal={false}
            hint="Issued proformas only"
          >
            <ErpSmartSelect
              options={piOptions}
              value={selectedPi}
              onChange={(v) => {
                const id = v ?? ''
                setSelectedPi(id)
                loadFromProforma(id)
              }}
              placeholder="Search proforma no, customer…"
              appearance="dropdown"
              emptyMessage="No issued proformas available."
            />
          </ErpFieldRow>
        ) : null}

        {sourceType === 'direct' ? (
          <ErpFieldRow
            label="Customer"
            required
            colSpan={3}
            horizontal={false}
            hint="Loads bill-to details from the customer master. Add product lines below."
          >
            <ErpSmartSelect
              options={customerOptions}
              value={selectedCustomer}
              onChange={(v) => {
                const id = v ?? ''
                setSelectedCustomer(id)
                loadFromCustomer(id)
              }}
              placeholder="Search customers…"
              appearance="dropdown"
            />
          </ErpFieldRow>
        ) : null}

        {!prefill && !error ? (
          <div className="col-span-full">
            <p className="pi-create-mode-hint">
              <PenLine className="h-4 w-4 shrink-0" aria-hidden />
              {sourceType === 'direct'
                ? 'Select a customer to start a direct tax invoice, then add product lines.'
                : 'Select a source above to auto-load customer, taxes, addresses, and invoice lines.'}
            </p>
          </div>
        ) : null}
      </ErpFieldGroup>
      </div>

      {prefill ? (
        <>
          <div id="ti-section-customer">
          <ErpCardSection
            title="Customer & commercial"
            subtitle={
              isDirect
                ? 'Bill-to account from customer master. Edit commercial terms as needed.'
                : 'Bill-to account and commercial terms inherited from the source document.'
            }
            icon={Building2}
            accent="teal"
            collapsible
            defaultOpen
            columns={4}
          >
            <aside className="so-customer-card col-span-full" aria-label="Selected customer">
              <div className="so-customer-card__header">
                <div className="so-customer-card__avatar" aria-hidden>
                  {prefill.customerName
                    .split(/\s+/)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="so-customer-card__identity">
                  <div className="so-customer-card__title-row">
                    <h3 className="so-customer-card__name">{prefill.customerName}</h3>
                    <TableLink
                      to={salesCustomer360Path(prefill.customerId)}
                      className="so-customer-card__360"
                    >
                      Customer 360
                    </TableLink>
                  </div>
                  <dl className="so-customer-card__facts">
                    <div className="so-customer-card__fact">
                      <dt>GSTIN</dt>
                      <dd>{prefill.customerGstin || '—'}</dd>
                    </div>
                    <div className="so-customer-card__fact">
                      <dt>Place of supply</dt>
                      <dd>{prefill.customerState || '—'}</dd>
                    </div>
                    <div className="so-customer-card__fact">
                      <dt>Customer PO</dt>
                      <dd>
                        {isDirect ? (
                          <Input
                            value={prefill.customerPoNumber ?? ''}
                            onChange={(e) =>
                              setPrefill({ ...prefill, customerPoNumber: e.target.value || null })
                            }
                            placeholder="Optional PO reference"
                          />
                        ) : (
                          prefill.customerPoNumber || '—'
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </aside>

            {isDirect ? (
              <>
                <ErpFieldRow label="Payment terms" horizontal={false}>
                  <CommercialTermSelect
                    termType="payment"
                    value={prefill.paymentTerms}
                    onChange={(v) => setPrefill({ ...prefill, paymentTerms: v })}
                    placeholder="Select payment terms"
                  />
                </ErpFieldRow>
                <ErpFieldRow label="Delivery terms" horizontal={false}>
                  <CommercialTermSelect
                    termType="delivery"
                    value={prefill.deliveryTerms}
                    onChange={(v) => setPrefill({ ...prefill, deliveryTerms: v })}
                    placeholder="Select delivery terms"
                  />
                </ErpFieldRow>
              </>
            ) : (
              <>
                <ErpFieldRow label="Payment terms" readOnly>{prefill.paymentTerms || '—'}</ErpFieldRow>
                <ErpFieldRow label="Delivery terms" readOnly>{prefill.deliveryTerms || '—'}</ErpFieldRow>
              </>
            )}
            {prefill.salesOrderNo ? (
              <ErpFieldRow label="Sales Order" readOnly>
                <TableLink to={`/sales/orders/${prefill.salesOrderId}`}>{prefill.salesOrderNo}</TableLink>
              </ErpFieldRow>
            ) : null}
            {prefill.proformaNo ? (
              <ErpFieldRow label="Proforma" readOnly>
                <TableLink to={`/sales/proforma-invoices/${prefill.proformaInvoiceId}`}>{prefill.proformaNo}</TableLink>
              </ErpFieldRow>
            ) : null}
            {prefill.quotationNo ? (
              <ErpFieldRow label="Quotation Number (Reference)" readOnly>
                {prefill.quotationNo}
              </ErpFieldRow>
            ) : null}
          </ErpCardSection>
          </div>

          <div id="ti-section-addresses">
          <ErpCardSection
            title="Addresses"
            subtitle="Billing and shipping addresses from the source document."
            icon={MapPin}
            accent="slate"
            collapsible
            defaultOpen
          >
            <ErpFieldRow label="Billing" readOnly colSpan={2} horizontal={false}>
              <p className="rounded-lg border border-erp-border bg-erp-surface-alt/40 px-3 py-2.5 text-[13px] text-erp-text whitespace-pre-wrap">
                {prefill.billingAddress || prefill.customerAddress || '—'}
              </p>
            </ErpFieldRow>
            <ErpFieldRow label="Shipping" readOnly colSpan={2} horizontal={false}>
              <p className="rounded-lg border border-erp-border bg-erp-surface-alt/40 px-3 py-2.5 text-[13px] text-erp-text whitespace-pre-wrap">
                {prefill.shippingAddress || '—'}
              </p>
            </ErpFieldRow>
          </ErpCardSection>
          </div>

          <div id="ti-section-lines">
          <ErpCardSection
            title="Product & Pricing"
            subtitle={
              isDirect
                ? 'Add sellable items and set quantity, rate, and tax.'
                : 'Adjust quantity for a partial invoice (capped at remaining).'
            }
            icon={ClipboardList}
            accent="green"
            collapsible
            defaultOpen
            className="!max-w-none"
            columns={1}
          >
            {isDirect ? (
              <div className="col-span-full so-pricing-panel so-pricing-panel--pro">
                <div className="so-pricing-table-wrap">
                  <table className="so-pricing-table">
                    <thead>
                      <tr>
                        <th className="so-pricing-th so-pricing-th--center">#</th>
                        <th className="so-pricing-th">Product</th>
                        <th className="so-pricing-th so-pricing-th--right">Qty</th>
                        <th className="so-pricing-th so-pricing-th--right">Unit price</th>
                        <th className="so-pricing-th so-pricing-th--right">Disc %</th>
                        <th className="so-pricing-th so-pricing-th--right">GST %</th>
                        <th className="so-pricing-th so-pricing-th--right">Line total</th>
                        <th className="so-pricing-th so-pricing-th--center" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {prefill.lines.map((line, idx) => (
                        <tr key={line.id} className="so-pricing-row">
                          <td className="so-pricing-td so-pricing-td--center tabular-nums text-erp-muted">
                            {idx + 1}
                          </td>
                          <td className="so-pricing-td so-pricing-td--product">
                            <ErpSmartSelect
                              options={itemOptions}
                              value={line.itemId}
                              onChange={(v) => {
                                if (v) selectDirectItem(line.id, v)
                              }}
                              placeholder="Select sellable item…"
                              appearance="dropdown"
                              dropdownMinWidth={360}
                              emptyMessage="Only items allowed for sales can be selected."
                            />
                          </td>
                          <td className="so-pricing-td">
                            <Input
                              type="number"
                              min={0}
                              step="1"
                              className="so-pricing-input so-pricing-input--num"
                              value={String(line.qty)}
                              onChange={(e) =>
                                setPrefill(patchPrefillLineQty(prefill, line.id, e.target.value))
                              }
                            />
                          </td>
                          <td className="so-pricing-td">
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="so-pricing-input so-pricing-input--num"
                              value={String(line.unitPrice)}
                              onChange={(e) =>
                                setPrefill(
                                  patchPrefillLine(prefill, line.id, {
                                    unitPrice: Number(e.target.value) || 0,
                                  }),
                                )
                              }
                            />
                          </td>
                          <td className="so-pricing-td">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              className="so-pricing-input so-pricing-input--num"
                              value={String(line.discountPct)}
                              onChange={(e) =>
                                setPrefill(
                                  patchPrefillLine(prefill, line.id, {
                                    discountPct: Number(e.target.value) || 0,
                                  }),
                                )
                              }
                            />
                          </td>
                          <td className="so-pricing-td">
                            <select
                              className="erp-input so-pricing-input so-pricing-input--select"
                              value={line.taxPct}
                              onChange={(e) =>
                                setPrefill(
                                  patchPrefillLine(prefill, line.id, {
                                    taxPct: Number(e.target.value) || DEFAULT_GST_RATE,
                                  }),
                                )
                              }
                            >
                              {GST_RATE_OPTIONS.map((rate) => (
                                <option key={rate} value={rate}>
                                  {rate}%
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="so-pricing-td so-pricing-td--right so-pricing-td--total tabular-nums">
                            {formatCurrency(line.lineTotal)}
                          </td>
                          <td className="so-pricing-td so-pricing-td--center">
                            <button
                              type="button"
                              className="so-pricing-remove"
                              onClick={() => removeDirectLine(line.id)}
                              disabled={prefill.lines.length <= 1}
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="so-pricing-toolbar">
                  <button type="button" className="so-pricing-add" onClick={addDirectLine}>
                    <Plus className="h-4 w-4" /> Add item line
                  </button>
                  <p className="so-pricing-toolbar__hint">
                    <span className="so-pricing-toolbar__count">{prefill.lines.length}</span>
                    {' '}line{prefill.lines.length === 1 ? '' : 's'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="col-span-full overflow-x-auto erp-line-items-grid">
                <table className="w-full min-w-[720px] text-[12px] erp-line-items-grid__table">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-left text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Max</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2">Tax %</th>
                      <th className="px-2 py-2 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prefill.lines.map((line) => (
                      <tr key={line.id} className="border-b border-erp-border/60">
                        <td className="px-2 py-2">
                          <div className="font-medium text-erp-text">{line.itemCode || '—'}</div>
                          <div className="text-[11px] text-erp-muted">{line.description}</div>
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={line.maxQty ?? undefined}
                            step="1"
                            className="ml-auto w-24 text-right"
                            value={String(line.qty)}
                            onChange={(e) => setPrefill(patchPrefillLineQty(prefill, line.id, e.target.value))}
                          />
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums text-erp-muted">
                          {line.maxQty ?? line.qty} {line.uom}
                        </td>
                        <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
                        <td className="py-2 px-2">{line.taxPct}%</td>
                        <td className="py-2 px-2 text-right font-semibold tabular-nums text-erp-primary">
                          {formatCurrency(line.lineTotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ErpCardSection>
          </div>

          <div id="ti-section-totals">
          <ErpCardSection
            title="Tax & totals"
            subtitle="GST breakdown and grand total for the quantities above."
            icon={Banknote}
            accent="amber"
            collapsible
            defaultOpen
            columns={4}
          >
            <ErpFieldRow label="Taxable" readOnly>{formatCurrency(prefill.gst.taxableAmount)}</ErpFieldRow>
            <ErpFieldRow label="Scheme" readOnly>{gstSchemeLabel(prefill.gst.scheme)}</ErpFieldRow>
            {prefill.gst.scheme === 'cgst_sgst' ? (
              <>
                <ErpFieldRow label="CGST" readOnly>{formatCurrency(prefill.gst.cgstAmount)}</ErpFieldRow>
                <ErpFieldRow label="SGST" readOnly>{formatCurrency(prefill.gst.sgstAmount)}</ErpFieldRow>
              </>
            ) : (
              <ErpFieldRow label="IGST" readOnly>{formatCurrency(prefill.gst.igstAmount)}</ErpFieldRow>
            )}
            <ErpFieldRow label="Grand total" readOnly>
              <span className="text-base font-semibold text-erp-primary">
                {formatCurrency(prefill.gst.grandTotal)}
              </span>
            </ErpFieldRow>
            {prefill.remarks ? (
              <ErpFieldRow label="Remarks" readOnly colSpan={2} horizontal={false}>
                <p className="text-[13px] text-erp-text whitespace-pre-wrap">{prefill.remarks}</p>
              </ErpFieldRow>
            ) : null}
          </ErpCardSection>
          </div>
        </>
      ) : null}
          </div>
        </div>
      </div>
    </SalesCardFormShell>
  )
}

/** Receive payment against a proforma — form page. */
export function ProformaReceivePaymentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const proforma = useProformaInvoiceStore((s) => (id ? s.getProforma(id) : undefined))
  const allReceipts = useCrmCommercialStore((s) => s.receipts)
  const summary = useMemo(() => {
    if (!proforma) return null
    const amountReceived = allReceipts
      .filter((r) => r.proformaInvoiceId === proforma.id)
      .reduce((s, r) => s + r.amount, 0)
    const totalAmount = proforma.gst.grandTotal
    return {
      totalAmount,
      amountReceived,
      balanceAmount: Math.max(0, totalAmount - amountReceived),
      paymentStatus:
        amountReceived <= 0.009
          ? ('unpaid' as const)
          : amountReceived + 0.009 >= totalAmount
            ? ('fully_paid' as const)
            : ('partially_paid' as const),
    }
  }, [proforma, allReceipts])
  const receive = useCrmCommercialStore((s) => s.receiveProformaPayment)

  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().slice(0, 10))
  const [paymentMode, setPaymentMode] = useState<CrmPaymentMode | ''>('')
  const [transactionRef, setTransactionRef] = useState('')
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [attachmentName, setAttachmentName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!proforma || !summary) {
    return (
      <OperationalPageShell title="Proforma not found">
        <Link to="/sales/proforma-invoices" className="text-sm font-semibold text-erp-primary">Back</Link>
      </OperationalPageShell>
    )
  }

  async function submit() {
    setError(null)
    if (!paymentMode) {
      setError('Select a payment mode.')
      return
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount received.')
      return
    }
    const payload = {
      proformaInvoiceId: proforma!.id,
      receiptDate,
      paymentMode,
      transactionRef,
      amount: amt,
      remarks,
      attachmentName,
    }
    const result = isApiMode()
      ? await apiReceiveProformaPayment({
          ...payload,
          customerId: proforma!.customerId,
          proformaNo: proforma!.proformaNo,
          proformaGrandTotal: proforma!.gst.grandTotal,
        })
      : receive(payload)
    if (!result.ok) {
      setError(result.error ?? 'Failed to record receipt')
      return
    }
    notify.success(`Receipt recorded`)
    navigate(`/sales/proforma-invoices/${proforma!.id}`)
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Sales"
      title="Receive Payment"
      description={`Against ${proforma.proformaNo} · Balance ${formatCurrency(summary.balanceAmount)}`}
      breadcrumbs={[
        { label: 'Proforma Invoices', to: '/sales/proforma-invoices' },
        { label: proforma.proformaNo, to: `/sales/proforma-invoices/${proforma.id}` },
        { label: 'Receive Payment' },
      ]}
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{ id: 'save', label: 'Save Receipt', icon: Banknote, onClick: submit }}
          secondaryActions={[{ id: 'back', label: 'Cancel', onClick: () => navigate(`/sales/proforma-invoices/${proforma.id}`) }]}
        />
      )}
      insights={[
        { label: 'Proforma Amount', value: formatCurrency(summary.totalAmount), accent: 'blue' },
        { label: 'Received', value: formatCurrency(summary.amountReceived), accent: 'green' },
        { label: 'Balance', value: formatCurrency(summary.balanceAmount), accent: 'amber' },
      ]}
    >
      <ErpCardSection title="Payment receipt">
        <ErpFieldRow label="Receipt Number" readOnly>Auto-generated on save</ErpFieldRow>
        <ErpFieldRow label="Receipt Date" required>
          <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
        </ErpFieldRow>
        <ErpFieldRow label="Customer" readOnly>{proforma.customerName}</ErpFieldRow>
        <ErpFieldRow label="Proforma Reference" readOnly>{proforma.proformaNo}</ErpFieldRow>
        <ErpFieldRow label="Payment Mode" required>
          <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as CrmPaymentMode | '')}>
            <option value="">{SELECT_PLACEHOLDER}</option>
            {(Object.keys(CRM_PAYMENT_MODE_LABELS) as CrmPaymentMode[]).map((m) => (
              <option key={m} value={m}>{CRM_PAYMENT_MODE_LABELS[m]}</option>
            ))}
          </Select>
        </ErpFieldRow>
        <ErpFieldRow label="Transaction Reference">
          <Input value={transactionRef} onChange={(e) => setTransactionRef(e.target.value)} placeholder="UTR / Cheque / UPI ref" />
        </ErpFieldRow>
        <ErpFieldRow label="Amount Received" required>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={String(summary.balanceAmount)}
          />
        </ErpFieldRow>
        <ErpFieldRow label="Remarks">
          <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
        </ErpFieldRow>
        <ErpFieldRow label="Attachment (optional)">
          <Input
            type="file"
            onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
          />
          {attachmentName ? <span className="text-[12px] text-erp-muted">{attachmentName}</span> : null}
        </ErpFieldRow>
        {error ? <p className="col-span-2 text-[13px] text-erp-danger">{error}</p> : null}
      </ErpCardSection>
    </OperationalPageShell>
  )
}

/** @deprecated Use SalesPaymentAllocationPage — kept for older imports / CRM legacy routes. */
export { SalesPaymentAllocationPage as CrmPaymentAllocationPage } from '../../sales/SalesPaymentAllocationPage'

export function CrmReceiptDetailPage() {
  const { id } = useParams()
  const receipt = useCrmCommercialStore((s) => (id ? s.receipts.find((r) => r.id === id) : undefined))
  const allAllocations = useCrmCommercialStore((s) => s.allocations)
  const allocations = useMemo(
    () => (id ? allAllocations.filter((a) => a.receiptId === id && !a.reversedAt) : []),
    [allAllocations, id],
  )
  const customer = useMasterStore((s) =>
    receipt ? s.customers.find((c) => c.id === receipt.customerId) : undefined,
  )
  const navigate = useNavigate()

  async function handleDownloadPdf() {
    if (!receipt) return
    notify.info('Preparing PDF…')
    const party = customer
      ? {
          address: [
            customer.addressLine1,
            customer.addressLine2,
            [customer.city, customer.state, customer.pincode].filter(Boolean).join(', '),
          ]
            .filter(Boolean)
            .join('\n') || undefined,
          gstin: customer.gstin || undefined,
          state: customer.state || undefined,
        }
      : null
    const result = await downloadPaymentReceiptPdf({
      receipt,
      allocations,
      customer: party,
    })
    if (result.ok) notify.success(`Downloaded ${result.fileName}`)
    else notify.error(result.error)
  }

  if (!receipt) {
    return (
      <OperationalPageShell title="Receipt not found">
        <Link to="/sales/payment-allocation" className="text-sm font-semibold text-erp-primary">Back</Link>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      variant="dynamics"
      badge="Sales"
      title={receipt.receiptNo}
      description={`${receipt.customerName} · ${CRM_PAYMENT_MODE_LABELS[receipt.paymentMode]}`}
      breadcrumbs={[
        { label: 'Sales', to: '/sales' },
        { label: 'Payment Allocation', to: '/sales/payment-allocation' },
        { label: receipt.receiptNo },
      ]}
      commandBar={(
        <ErpCommandBar
          sticky={false}
          primaryAction={{
            id: 'alloc',
            label: 'Allocate',
            icon: ArrowLeftRight,
            onClick: () => navigate(`/sales/payment-allocation?customerId=${receipt.customerId}`),
          }}
          secondaryActions={[
            {
              id: 'print',
              label: 'Print',
              icon: Printer,
              pin: true,
              onClick: () => navigate(`/sales/receipts/${receipt.id}/print`),
            },
            {
              id: 'pdf',
              label: 'Download PDF',
              icon: Download,
              pin: true,
              onClick: () => void handleDownloadPdf(),
            },
          ]}
        />
      )}
      insights={[
        { label: 'Amount', value: formatCurrency(receipt.amount), accent: 'blue' },
        { label: 'Unallocated', value: formatCurrency(receipt.unallocatedAmount), accent: 'amber' },
        { label: 'Date', value: formatDate(receipt.receiptDate), accent: 'slate' },
      ]}
    >
      <ErpCardSection title="Receipt details">
        <ErpFieldRow label="Customer" readOnly>
          <TableLink to={salesCustomer360Path(receipt.customerId)}>{receipt.customerName}</TableLink>
        </ErpFieldRow>
        {receipt.proformaInvoiceId ? (
          <ErpFieldRow label="Proforma" readOnly>
            <TableLink to={`/sales/proforma-invoices/${receipt.proformaInvoiceId}`}>{receipt.proformaNo}</TableLink>
          </ErpFieldRow>
        ) : null}
        <ErpFieldRow label="Transaction ref" readOnly>{receipt.transactionRef || '—'}</ErpFieldRow>
        <ErpFieldRow label="Remarks" readOnly>{receipt.remarks || '—'}</ErpFieldRow>
        <ErpFieldRow label="Attachment" readOnly>{receipt.attachmentName || '—'}</ErpFieldRow>
      </ErpCardSection>
      <ErpCardSection title="Allocations" className="mt-4">
        <div className="col-span-2 space-y-2">
          {allocations.length === 0 ? (
            <p className="text-[13px] text-erp-muted">Not allocated to any invoice yet.</p>
          ) : (
            allocations.map((a) => (
              <div key={a.id} className="flex justify-between rounded border border-erp-border px-3 py-2 text-[13px]">
                <span>{a.invoiceNo} · {formatDate(a.allocationDate)}</span>
                <span className="font-semibold">{formatCurrency(a.amount)}</span>
              </div>
            ))
          )}
        </div>
      </ErpCardSection>
    </OperationalPageShell>
  )
}
