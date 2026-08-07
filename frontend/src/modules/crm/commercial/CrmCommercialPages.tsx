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
  PenLine,
  Plus,
  Printer,
  Trash2,
  ArrowLeftRight,
} from 'lucide-react'
import { OperationalPageShell } from '../../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../../components/erp/ErpCommandBar'
import { ErpButton } from '../../../components/erp/ErpButton'
import { ErpCardSection, ErpFieldGroup, ErpFieldRow } from '../../../components/erp/card-form'
import { FormActionBar } from '../../../components/erp/FormActionBar'
import { ErpSegmentedControl } from '../../../components/erp/ErpSegmentedControl'
import { ErpSmartSelect } from '../../../components/erp/ErpSmartSelect'
import { Select, Input, Textarea } from '../../../components/forms/Inputs'
import { CommercialTermSelect } from '../../../components/masters/GeographySelects'
import { TableLink } from '../../../components/ui/AppLink'
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
  apiCreateInvoice,
  apiGetInvoice,
  apiReceiveProformaPayment,
  apiUpdateInvoice,
} from '../../../services/bridges/crmCommercialApiBridge'
import type { CrmPaymentMode } from '../../../types/crmCommercial'
import {
  CRM_PAYMENT_MODE_LABELS,
  CRM_RECEIPT_MIGRATION_STATUS_LABELS,
} from '../../../types/crmCommercial'
import { computeProformaLineTotals } from '../../../utils/proformaInvoiceLines'
import { computeGst, gstSchemeLabel } from '../../../utils/gstEngine'
import {
  blankTaxInvoiceLine,
  ensureTaxInvoiceFromProforma,
  ensureTaxInvoiceFromSalesOrder,
  prefillFromExistingTaxInvoice,
  resolveTaxInvoiceFromCustomer,
  type TaxInvoicePrefill,
} from '../../../utils/taxInvoicePrefill'
import { SalesTaxInvoiceListPage } from '../../sales/SalesTaxInvoiceListPage'
import { cn } from '../../../utils/cn'
import type { CrmCommercialLine } from '../../../types/crmCommercial'
import { resolveGstStateCode } from '../../../utils/gstStateCode'
import { loadSellerStateCode } from '../../../utils/sellerGstState'
import {
  CommercialGstSupplyPanel,
  type CommercialGstSupplyValue,
} from '../../../components/sales/CommercialGstSupplyPanel'
import { CommercialOrderAdjustmentsBlock } from '../../../components/erp/CommercialOrderAdjustmentsBlock'
import {
  chargesToAdjustments,
  emptySoOrderCharges,
  type SoOrderCharges,
} from '../../../components/sales/SalesOrderLinesEditor'
import { calcProductPricingSummary } from '../../../utils/opportunityLineCalc'
import { useTenantProfileStore } from '../../../store/tenantProfileStore'
import {
  formatTaxSchemeLabel,
  resolveHsnSacDisplay,
} from '../../../utils/commercialLineSnapshot'

type InvoiceCreateSource = 'sales_order' | 'proforma' | 'direct'

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28] as const

/** @deprecated Use SalesTaxInvoiceListPage — kept for older imports. */
export function CrmInvoiceListPage() {
  return <SalesTaxInvoiceListPage />
}

export { CrmInvoiceDetailPage, CrmInvoicePrintPage } from './CrmTaxInvoiceDetailPage'

type GstSupplySnapshot = {
  placeOfSupply?: string | null
  supplierStateCode?: string | null
}

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Rebuild tax header from lines + live GST supply (LE seller + PoS).
 * Prefer line CGST/SGST/IGST components when present so Tax & totals matches the product grid.
 */
function recomputePrefill(
  prefill: TaxInvoicePrefill,
  lines: CrmCommercialLine[],
  supply?: GstSupplySnapshot,
): TaxInvoicePrefill {
  const withNos = lines.map((line, idx) => ({ ...line, lineNo: idx + 1 }))
  const taxable = withNos.reduce((s, l) => s + l.taxableValue, 0)
  const avgRate = withNos.length
    ? withNos.reduce((s, l) => s + l.taxPct, 0) / withNos.length
    : 0

  const supplierStateCode =
    resolveGstStateCode(supply?.supplierStateCode) ??
    resolveGstStateCode(prefill.supplierStateCode) ??
    null

  const placeOfSupplyCode =
    resolveGstStateCode(supply?.placeOfSupply) ??
    resolveGstStateCode(prefill.placeOfSupplyStateCode) ??
    resolveGstStateCode(prefill.placeOfSupply) ??
    resolveGstStateCode(prefill.customerState)

  const placeOfSupplyLabel =
    placeOfSupplyCode ||
    supply?.placeOfSupply ||
    prefill.placeOfSupplyStateCode ||
    prefill.placeOfSupply ||
    prefill.customerState ||
    ''

  const lineCgst = withNos.reduce((s, l) => s + (Number(l.cgstAmount) || 0), 0)
  const lineSgst = withNos.reduce((s, l) => s + (Number(l.sgstAmount) || 0), 0)
  const lineIgst = withNos.reduce((s, l) => s + (Number(l.igstAmount) || 0), 0)
  const lineComponentTax = lineCgst + lineSgst + lineIgst

  let gst = computeGst(
    taxable,
    placeOfSupplyLabel,
    avgRate,
    supplierStateCode ?? undefined,
  )

  if (lineComponentTax > 0) {
    const scheme =
      lineIgst > 0 && lineCgst + lineSgst === 0
        ? ('igst' as const)
        : ('cgst_sgst' as const)
    const totalTax = roundMoney(lineComponentTax)
    gst = {
      scheme,
      taxableAmount: roundMoney(taxable),
      cgstRate: scheme === 'cgst_sgst' ? avgRate / 2 : 0,
      cgstAmount: roundMoney(lineCgst),
      sgstRate: scheme === 'cgst_sgst' ? avgRate / 2 : 0,
      sgstAmount: roundMoney(lineSgst),
      igstRate: scheme === 'igst' ? avgRate : 0,
      igstAmount: roundMoney(lineIgst),
      totalTax,
      grandTotal: roundMoney(taxable + totalTax),
    }
  } else if (withNos.some((l) => (l.taxScheme ?? '').toLowerCase() === 'igst')) {
    // Line scheme is IGST but component columns empty — still honor line scheme.
    const totalTax = withNos.reduce((s, l) => s + (Number(l.gstAmount) || 0), 0)
    gst = {
      scheme: 'igst',
      taxableAmount: roundMoney(taxable),
      cgstRate: 0,
      cgstAmount: 0,
      sgstRate: 0,
      sgstAmount: 0,
      igstRate: avgRate,
      igstAmount: roundMoney(totalTax),
      totalTax: roundMoney(totalTax),
      grandTotal: roundMoney(taxable + totalTax),
    }
  }

  return {
    ...prefill,
    lines: withNos,
    placeOfSupply: placeOfSupplyLabel || prefill.placeOfSupply,
    placeOfSupplyStateCode: placeOfSupplyCode || prefill.placeOfSupplyStateCode,
    supplierStateCode: supplierStateCode || prefill.supplierStateCode,
    gstScheme: gst.scheme,
    supplyType: gst.scheme === 'igst' ? 'INTER_STATE' : 'INTRA_STATE',
    gst,
  }
}

function patchPrefillLineQty(
  prefill: TaxInvoicePrefill,
  lineId: string,
  qtyRaw: string,
  supply?: GstSupplySnapshot,
): TaxInvoicePrefill {
  const qty = Number(qtyRaw)
  const lines = prefill.lines.map((line) => {
    if (line.id !== lineId) return line
    const nextQty = Number.isFinite(qty)
      ? Math.max(0, line.maxQty != null ? Math.min(qty, line.maxQty) : qty)
      : 0
    const totals = computeProformaLineTotals({ ...line, qty: nextQty })
    return { ...line, qty: nextQty, ...totals }
  })
  return recomputePrefill(prefill, lines, supply)
}

function patchPrefillLine(
  prefill: TaxInvoicePrefill,
  lineId: string,
  patch: Partial<CrmCommercialLine>,
  supply?: GstSupplySnapshot,
): TaxInvoicePrefill {
  const lines = prefill.lines.map((line) => {
    if (line.id !== lineId) return line
    const next = { ...line, ...patch }
    const totals = computeProformaLineTotals(next)
    return { ...next, ...totals }
  })
  return recomputePrefill(prefill, lines, supply)
}

export function CrmInvoiceEditPage() {
  return <CrmInvoiceCreatePage mode="edit" />
}

export function CrmInvoiceCreatePage({ mode = 'create' }: { mode?: 'create' | 'edit' }) {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const [params] = useSearchParams()
  const isEdit = mode === 'edit'
  const salesOrderId = isEdit ? null : params.get('salesOrderId')
  const proformaId = isEdit ? null : params.get('proformaId')
  const customerIdParam = isEdit ? null : params.get('customerId')

  const createInvoice = useCrmCommercialStore((s) => s.createInvoice)
  const updateInvoice = useCrmCommercialStore((s) => s.updateInvoice)
  const getInvoice = useCrmCommercialStore((s) => s.getInvoice)
  const salesOrders = useMrpStore((s) => s.salesOrders)
  const proformas = useProformaInvoiceStore((s) => s.proformaInvoices)
  const customers = useMasterStore((s) => s.customers)
  const getCustomer = useMasterStore((s) => s.getCustomer)
  const getItem = useMasterStore((s) => s.getItem)
  const sellableItems = useSellableItems()
  const canMutate = canCrmPermission('crm.commercial.invoice.create')

  const [sourceType, setSourceType] = useState<InvoiceCreateSource>(
    salesOrderId ? 'sales_order' : proformaId ? 'proforma' : 'direct',
  )
  const [selectedSo, setSelectedSo] = useState(salesOrderId ?? '')
  const [selectedPi, setSelectedPi] = useState(proformaId ?? '')
  const [selectedCustomer, setSelectedCustomer] = useState(customerIdParam ?? '')
  const [invoiceMeta, setInvoiceMeta] = useState<{
    id: string
    invoiceNo: string
    invoiceDate: string
    dueDate: string
  } | null>(null)
  const [prefill, setPrefill] = useState<TaxInvoicePrefill | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [prefillLoading, setPrefillLoading] = useState(
    Boolean(isEdit || salesOrderId || proformaId || customerIdParam),
  )
  const [gstSupply, setGstSupply] = useState<CommercialGstSupplyValue>(() => ({
    placeOfSupply: '',
    placeOfSupplyOverride: false,
    placeOfSupplyOverrideReason: '',
    /** Filled from default Legal Entity; do not seed from customer. */
    supplierStateCode: '',
  }))
  const [charges, setCharges] = useState<SoOrderCharges>(() => emptySoOrderCharges())
  const showFreight = !useTenantProfileStore((s) => s.isServices())

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

  // Place of supply from document / customer only — never treat POS as seller state.
  // Supplier state is always the live Legal Entity (above), not SO/PI historical snapshots
  // (legacy SOs may have carried a wrong Gujarat seed).
  useEffect(() => {
    if (!prefill) return
    setGstSupply((prev) => {
      if (prev.placeOfSupplyOverride) return prev
      const fromUpstream =
        resolveGstStateCode(prefill.placeOfSupplyStateCode) ??
        resolveGstStateCode(prefill.placeOfSupply) ??
        resolveGstStateCode(prefill.customerState) ??
        ''
      if (fromUpstream === prev.placeOfSupply) return prev
      return {
        ...prev,
        placeOfSupply: fromUpstream || prev.placeOfSupply,
      }
    })
  }, [
    prefill?.customerId,
    prefill?.customerState,
    prefill?.placeOfSupply,
    prefill?.placeOfSupplyStateCode,
  ])

  // Keep Tax & totals aligned with GST supply panel (LE seller + place of supply).
  // Line qty/tax edits already recompute with supplyForTotals; this only applies supply changes (LE load, PoS seed, override).
  useEffect(() => {
    if (!prefill) return
    if (!gstSupply.supplierStateCode && !gstSupply.placeOfSupply) return
    setPrefill((prev) => {
      if (!prev) return prev
      const next = recomputePrefill(prev, prev.lines, {
        placeOfSupply: gstSupply.placeOfSupply,
        supplierStateCode: gstSupply.supplierStateCode,
      })
      if (
        next.gst.scheme === prev.gst.scheme &&
        next.gst.cgstAmount === prev.gst.cgstAmount &&
        next.gst.sgstAmount === prev.gst.sgstAmount &&
        next.gst.igstAmount === prev.gst.igstAmount &&
        next.supplierStateCode === prev.supplierStateCode &&
        (next.placeOfSupplyStateCode || '') === (prev.placeOfSupplyStateCode || '')
      ) {
        return prev
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- supply-driven only
  }, [gstSupply.supplierStateCode, gstSupply.placeOfSupply, gstSupply.placeOfSupplyOverride, prefill?.customerId])

  const isDirect = sourceType === 'direct' || prefill?.source === 'direct'

  const supplyForTotals = useMemo(
    () => ({
      placeOfSupply: gstSupply.placeOfSupply,
      supplierStateCode: gstSupply.supplierStateCode,
    }),
    [gstSupply.placeOfSupply, gstSupply.supplierStateCode],
  )

  const onGstSupplyChange = (next: CommercialGstSupplyValue) => {
    setGstSupply(next)
    setPrefill((prev) =>
      prev
        ? recomputePrefill(prev, prev.lines, {
            placeOfSupply: next.placeOfSupply,
            supplierStateCode: next.supplierStateCode,
          })
        : prev,
    )
  }

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

  /** Order adjustments + order summary (PO-style) driven by live lines + charge options. */
  const orderPricing = useMemo(() => {
    if (!prefill) return null
    const asOppLines = prefill.lines.map((line) => ({
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
    const summary = calcProductPricingSummary(
      asOppLines,
      chargesToAdjustments(charges, showFreight),
    )
    const scheme = prefill.gst.scheme
    const totalGst = summary.totalGst
    const half = roundMoney(totalGst / 2)
    const gstExtras =
      scheme === 'igst'
        ? {
            schemeLabel: gstSchemeLabel('igst'),
            cgstAmount: 0,
            sgstAmount: 0,
            igstAmount: totalGst,
          }
        : {
            schemeLabel: gstSchemeLabel('cgst_sgst'),
            cgstAmount: half,
            sgstAmount: roundMoney(totalGst - half),
            igstAmount: 0,
          }
    return { summary, gstExtras }
  }, [prefill, charges, showFreight])

  const canSave = Boolean(
    canMutate &&
      prefill &&
      activeLines.length > 0 &&
      activeLines.every((l) => l.itemId || l.itemCode) &&
      !creating &&
      !prefillLoading &&
      (!isEdit || invoiceMeta),
  )

  const sourceDone = Boolean(
    isEdit
      ? Boolean(prefill)
      : (sourceType === 'sales_order' && selectedSo && prefill) ||
          (sourceType === 'proforma' && selectedPi && prefill) ||
          (sourceType === 'direct' && selectedCustomer && prefill),
  )
  const linesDone = activeLines.length > 0
  const completionItems = useMemo(
    () => [
      { id: 'source', label: isEdit ? 'Invoice' : 'Source document', done: sourceDone },
      { id: 'customer', label: 'Customer & Commercial', done: Boolean(prefill) },
      { id: 'lines', label: 'Invoice lines', done: linesDone },
      { id: 'totals', label: 'Tax & Totals', done: canSave },
    ],
    [sourceDone, prefill, linesDone, canSave, isEdit],
  )
  const completionPercent = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100,
  )

  function clearLoaded() {
    setPrefill(null)
    setCharges(emptySoOrderCharges())
  }

  async function loadFromSalesOrder(soId: string, opts?: { announceSuccess?: boolean }) {
    if (!soId) {
      clearLoaded()
      setError(null)
      setPrefillLoading(false)
      return
    }
    setPrefillLoading(true)
    setError(null)
    try {
      const result = await ensureTaxInvoiceFromSalesOrder(soId)
      if (!result.ok) {
        clearLoaded()
        setError(result.error)
        notify.error(result.error)
        return
      }
      setPrefill(result.data)
      setError(null)
      if (opts?.announceSuccess) {
        notify.success(`Filled from sales order ${result.data.salesOrderNo ?? soId}`)
      }
    } finally {
      setPrefillLoading(false)
    }
  }

  async function loadFromProforma(piId: string, opts?: { announceSuccess?: boolean }) {
    if (!piId) {
      clearLoaded()
      setError(null)
      setPrefillLoading(false)
      return
    }
    setPrefillLoading(true)
    setError(null)
    try {
      const result = await ensureTaxInvoiceFromProforma(piId)
      if (!result.ok) {
        clearLoaded()
        setError(result.error)
        notify.error(result.error)
        return
      }
      setPrefill(result.data)
      setError(null)
      if (opts?.announceSuccess) {
        notify.success(`Filled from proforma ${result.data.proformaNo ?? piId}`)
      }
    } finally {
      setPrefillLoading(false)
    }
  }

  function loadFromCustomer(customerId: string) {
    if (!customerId) {
      clearLoaded()
      setError(null)
      setPrefillLoading(false)
      return
    }
    setPrefillLoading(false)
    const result = resolveTaxInvoiceFromCustomer(customerId)
    if (!result.ok) {
      clearLoaded()
      setError(result.error)
      notify.error(result.error)
      return
    }
    setSelectedSo('')
    setPrefill(result.data)
    setError(null)
  }

  function switchSourceType(next: InvoiceCreateSource) {
    if (isEdit) return
    setSourceType(next)
    clearLoaded()
    setError(null)
    setPrefillLoading(false)
    if (next !== 'sales_order') setSelectedSo('')
    if (next !== 'proforma') setSelectedPi('')
    if (next !== 'direct') setSelectedCustomer('')
  }

  function applyExistingInvoice(invoice: NonNullable<ReturnType<typeof getInvoice>>) {
    const result = prefillFromExistingTaxInvoice(invoice)
    if (!result.ok) {
      setError(result.error)
      notify.error(result.error)
      setPrefill(null)
      setInvoiceMeta(null)
      return false
    }
    const src: InvoiceCreateSource =
      invoice.source === 'sales_order' || invoice.source === 'proforma' ? invoice.source : 'direct'
    setSourceType(src)
    setSelectedSo(invoice.salesOrderId ?? '')
    setSelectedPi(invoice.proformaInvoiceId ?? '')
    setSelectedCustomer(invoice.customerId)
    setInvoiceMeta({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      invoiceDate: invoice.invoiceDate.slice(0, 10),
      dueDate: invoice.dueDate.slice(0, 10),
    })
    setPrefill(result.data)
    setError(null)
    return true
  }

  async function loadExistingInvoice(id: string) {
    setPrefillLoading(true)
    setError(null)
    try {
      let invoice = getInvoice(id)
      if (!invoice && isApiMode()) {
        const res = await apiGetInvoice(id)
        if (!res.ok || !res.data) {
          setError(res.error ?? 'Invoice not found')
          notify.error(res.error ?? 'Invoice not found')
          return
        }
        invoice = res.data
      }
      if (!invoice) {
        setError('Invoice not found')
        notify.error('Invoice not found')
        return
      }
      if (invoice.status !== 'draft') {
        notify.error('Only draft invoices can be edited')
        navigate(`/sales/invoices/${invoice.id}`, { replace: true })
        return
      }
      applyExistingInvoice(invoice)
    } finally {
      setPrefillLoading(false)
    }
  }

  function addDirectLine() {
    if (!prefill) return
    setPrefill(recomputePrefill(prefill, [...prefill.lines, blankTaxInvoiceLine(prefill.lines.length + 1)], supplyForTotals))
  }

  function removeDirectLine(lineId: string) {
    if (!prefill || prefill.lines.length <= 1) return
    setPrefill(recomputePrefill(prefill, prefill.lines.filter((l) => l.id !== lineId), supplyForTotals))
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
    void (async () => {
      const { resolveCommercialLineTax } = await import('../../../utils/commercialLineTax')
      const { useMasterStore: ms } = await import('../../../store/masterStore')
      const store = ms.getState()
      const snap = await resolveCommercialLineTax({
        direction: 'SALES',
        item: item ?? null,
        companyStateCode: gstSupply.supplierStateCode || undefined,
        partyState: prefill.customerState,
        partyGstin: prefill.customerGstin,
        placeOfSupply: gstSupply.placeOfSupply || prefill.customerState,
        hsnById: (hid) => store.getHsn(hid),
        hsnByCode: (code) => store.getHsnByCode(code),
        gstRates: store.gstRates,
      })
      const taxPct = snap.resolved ? snap.taxPct : 0
      if (!snap.resolved && snap.blockers.length) {
        notify.warning(snap.blockers[0] ?? 'GST could not be resolved from masters')
      }
      setPrefill(
        patchPrefillLine(
          prefill,
          lineId,
          {
            itemId,
            itemCode: item?.itemCode ?? '',
            description: item?.itemName ?? '',
            hsnCode: snap.hsnSacCode || item?.hsnCode || '',
            uom: 'Nos',
            unitPrice: item?.defaultSalesRate ?? item?.standardRate ?? 0,
            taxPct,
            taxScheme: snap.taxScheme,
            cgstRate: snap.cgstRate,
            sgstRate: snap.sgstRate,
            igstRate: snap.igstRate,
          },
          supplyForTotals,
        ),
      )
    })()
  }

  useEffect(() => {
    if (isEdit) {
      if (!editId) {
        setPrefillLoading(false)
        setError('Invoice not found')
        return
      }
      void loadExistingInvoice(editId)
      return
    }
    if (salesOrderId) void loadFromSalesOrder(salesOrderId)
    else if (proformaId) void loadFromProforma(proformaId)
    else if (customerIdParam) loadFromCustomer(customerIdParam)
    else setPrefillLoading(false)
    // Initial deep-link / edit preload only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editId])

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
      invoiceDate: draft.invoiceDate,
      dueDate: draft.dueDate,
      placeOfSupply: gstSupply.placeOfSupply || draft.placeOfSupply || null,
      placeOfSupplyStateCode: gstSupply.placeOfSupply || null,
      supplierStateCode: gstSupply.supplierStateCode || null,
      lines: draft.lines,
    })
  }

  async function persistUpdate(
    localUpdate: () => { ok: boolean; error?: string; id?: string },
  ): Promise<{ ok: boolean; error?: string; id?: string }> {
    if (!isApiMode()) return localUpdate()
    if (!prefill || !invoiceMeta) return { ok: false, error: 'Invoice is not loaded' }
    return apiUpdateInvoice(invoiceMeta.id, {
      customerId: prefill.customerId,
      source: prefill.source,
      salesOrderId: prefill.salesOrderId,
      salesOrderNo: prefill.salesOrderNo,
      proformaInvoiceId: prefill.proformaInvoiceId,
      proformaNo: prefill.proformaNo,
      quotationId: prefill.quotationId,
      quotationNo: prefill.quotationNo,
      paymentTerms: prefill.paymentTerms,
      deliveryTerms: prefill.deliveryTerms,
      customerPoNumber: prefill.customerPoNumber,
      billingAddress: prefill.billingAddress,
      shippingAddress: prefill.shippingAddress,
      remarks: prefill.remarks,
      customerState: prefill.customerState,
      invoiceDate: invoiceMeta.invoiceDate,
      dueDate: invoiceMeta.dueDate,
      placeOfSupply: gstSupply.placeOfSupply || prefill.placeOfSupply || null,
      placeOfSupplyStateCode: gstSupply.placeOfSupply || prefill.placeOfSupplyStateCode || null,
      supplierStateCode: gstSupply.supplierStateCode || prefill.supplierStateCode || null,
      lines: activeLines,
    })
  }

  async function handleCreate() {
    setError(null)
    if (!canMutate) {
      setError('You do not have permission to edit tax invoices.')
      return
    }
    if (!prefill || activeLines.length === 0) {
      setError(
        isEdit
          ? 'Add at least one product line before saving.'
          : isDirect
            ? 'Select a customer and add at least one product line before saving.'
            : 'Select a source document to load the invoice first.',
      )
      return
    }

    setCreating(true)
    const payload = {
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
      invoiceDate: invoiceMeta?.invoiceDate,
      dueDate: invoiceMeta?.dueDate,
      placeOfSupply: gstSupply.placeOfSupply || prefill.placeOfSupply || null,
      placeOfSupplyStateCode: gstSupply.placeOfSupply || prefill.placeOfSupplyStateCode || null,
      supplierStateCode: gstSupply.supplierStateCode || prefill.supplierStateCode || null,
      supplyType: prefill.supplyType ?? null,
      gstScheme: prefill.gstScheme ?? null,
      lines: activeLines,
    }
    const result = isEdit && invoiceMeta
      ? await persistUpdate(() => updateInvoice(invoiceMeta.id, payload))
      : await persistDraft(() => createInvoice(payload))

    setCreating(false)
    if (!result.ok || !result.id) {
      setError(result.error ?? (isEdit ? 'Could not update invoice' : 'Could not create invoice'))
      return
    }
    notify.success(isEdit ? 'Draft invoice updated' : 'Draft invoice created')
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
          value: canSave
            ? isEdit
              ? 'Ready to save draft'
              : 'Ready to create draft'
            : sourceDone
              ? 'Review lines & totals'
              : isEdit
                ? 'Loading invoice…'
                : 'Select a source',
          tone: canSave ? ('success' as const) : ('warning' as const),
        },
        {
          id: 'next',
          label: 'Suggested Next',
          value: !sourceDone
            ? isEdit
              ? 'Open a draft invoice to edit'
              : 'Choose SO, proforma, or direct customer'
            : !linesDone
              ? isDirect
                ? 'Add product lines with qty > 0'
                : 'Set at least one line qty > 0'
              : isEdit
                ? 'Save draft invoice'
                : 'Create draft invoice',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormContextPanel
        summaryTitle="Invoice preview"
        actionsTitle="Quick actions"
        summary={[
          { label: 'Customer', value: prefill?.customerName ?? '-' },
          {
            label: 'Document',
            value:
              invoiceMeta?.invoiceNo ??
              prefill?.salesOrderNo ??
              prefill?.proformaNo ??
              (isDirect && prefill ? 'Direct' : '-'),
          },
          { label: 'Active lines', value: String(activeLines.length) },
          {
            label: 'Grand total',
            value: prefill
              ? formatCurrency(orderPricing?.summary.grandTotal ?? prefill.gst.grandTotal)
              : '-',
            highlight: true,
          },
          {
            label: 'Tax scheme',
            value: prefill ? gstSchemeLabel(prefill.gst.scheme) : '-',
          },
        ]}
        actions={[
          {
            id: 'create',
            label: creating
              ? isEdit
                ? 'Saving…'
                : 'Creating…'
              : isEdit
                ? 'Save Draft Invoice'
                : 'Create Draft Invoice',
            icon: canSave ? ChevronRight : Plus,
            primary: true,
            onClick: () => void handleCreate(),
            disabled: !canSave,
          },
          {
            id: 'list',
            label: isEdit && invoiceMeta ? 'Back to invoice' : 'Tax Invoice Register',
            icon: ClipboardList,
            onClick: () =>
              navigate(isEdit && invoiceMeta ? `/sales/invoices/${invoiceMeta.id}` : '/sales/invoices'),
          },
        ]}
      />
      <p className="mt-3 rounded-lg border border-erp-border bg-erp-surface-alt/60 p-3 text-[12px] text-erp-muted">
        {isEdit
          ? 'Only draft invoices can be edited. Posted invoices are view-only — cancel or create a credit note if corrections are needed after posting.'
          : 'Direct invoices need only a customer and product lines. From SO/proforma, partial quantities stay available for another invoice. Drafts can be cancelled before posting.'}
      </p>
    </EnterpriseBusinessFactBox>
  )

  if (isEdit && !canMutate) {
    return (
      <OperationalPageShell title="Edit Tax Invoice">
        <p className="text-sm text-erp-muted">You do not have permission to edit tax invoices.</p>
        <ErpButton type="button" variant="ghost" onClick={() => navigate('/sales/invoices')}>
          Back to register
        </ErpButton>
      </OperationalPageShell>
    )
  }

  return (
    <SalesCardFormShell
      title={isEdit ? 'Edit Tax Invoice' : 'Create Tax Invoice'}
      badge="Sales"
      className={`${ENTERPRISE_FORM_CLASS} crm-lead-form-page crm-lead-form-page--zoho crm-sales-invoice-form-page--zoho enterprise-workspace--crm-smart-overview`}
      recordNo={invoiceMeta?.invoiceNo ?? 'New'}
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
      createdDate={formatDate(invoiceMeta?.invoiceDate ?? new Date().toISOString().slice(0, 10))}
      company={prefill?.customerName}
      favoritePath={isEdit && invoiceMeta ? `/sales/invoices/${invoiceMeta.id}/edit` : '/sales/invoices/new'}
      breadcrumbs={salesChildBreadcrumbs(
        'Tax Invoices',
        '/sales/invoices',
        isEdit ? invoiceMeta?.invoiceNo ?? 'Edit' : 'New Invoice',
      )}
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
          busy={creating || prefillLoading}
          disabled={!canSave || prefillLoading}
          disabledReason={
            prefillLoading
              ? isEdit
                ? 'Loading invoice…'
                : 'Loading source document…'
              : !canMutate
                ? 'You do not have permission to edit tax invoices'
                : !sourceDone
                  ? isEdit
                    ? 'Invoice not loaded'
                    : isDirect
                      ? 'Select a customer'
                      : 'Select a source document'
                  : !linesDone
                    ? 'Add at least one product line'
                    : undefined
          }
          dirty={Boolean(selectedSo || selectedPi || selectedCustomer || prefill)}
          saveLabel={isEdit ? 'Save Draft Invoice' : 'Create Draft Invoice'}
          onCancel={() =>
            navigate(isEdit && invoiceMeta ? `/sales/invoices/${invoiceMeta.id}` : '/sales/invoices')
          }
          onSave={() => void handleCreate()}
          hint={(
            <span className="text-[12px] text-erp-muted">
              {completionPercent}% complete
              {prefill
                ? ` · ${formatCurrency(orderPricing?.summary.grandTotal ?? prefill.gst.grandTotal)} grand total`
                : isEdit
                  ? ' · Loading draft…'
                  : ' · Select a source to continue'}
            </span>
          )}
        />
      )}
    >
      <div className="erp-form-body crm-lead-form-body crm-sales-invoice-create-body">
        <div className="crm-lead-zoho-layout">
          <nav className="crm-lead-zoho-rail" aria-label="Tax invoice form sections">
            <p className="crm-lead-zoho-rail__eyebrow">{isEdit ? 'Edit Tax Invoice' : 'Create Tax Invoice'}</p>
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
      {prefillLoading ? (
        <div
          className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[13px] text-sky-900"
          role="status"
          aria-live="polite"
        >
          {isEdit ? 'Loading draft invoice…' : 'Loading source document details…'}
        </div>
      ) : null}
      <div id="ti-section-source" className="crm-lead-quick-entry crm-lead-zoho-block">
      <ErpFieldGroup label="Tax Invoice Information" columns={4} className="crm-lead-zoho-section">
        {isEdit ? (
          <>
            <ErpFieldRow label="Invoice No." colSpan={2} horizontal={false} readOnly>
              {invoiceMeta?.invoiceNo ?? '-'}
            </ErpFieldRow>
            <ErpFieldRow label="Source" colSpan={2} horizontal={false} readOnly>
              {sourceType === 'sales_order'
                ? 'Sales Order'
                : sourceType === 'proforma'
                  ? 'Proforma'
                  : 'Direct'}
            </ErpFieldRow>
            {prefill?.salesOrderNo ? (
              <ErpFieldRow label="Sales Order" colSpan={2} horizontal={false} readOnly>
                <TableLink to={`/sales/orders/${prefill.salesOrderId}`}>{prefill.salesOrderNo}</TableLink>
              </ErpFieldRow>
            ) : null}
            {prefill?.proformaNo ? (
              <ErpFieldRow label="Proforma" colSpan={2} horizontal={false} readOnly>
                <TableLink to={`/sales/proforma-invoices/${prefill.proformaInvoiceId}`}>
                  {prefill.proformaNo}
                </TableLink>
              </ErpFieldRow>
            ) : null}
          </>
        ) : (
          <>
            <ErpFieldRow label="Create from" colSpan={2} horizontal={false}>
              <ErpSegmentedControl<InvoiceCreateSource>
                variant="pills"
                name="Tax invoice create source"
                value={sourceType}
                onChange={switchSourceType}
                options={[
                  { value: 'direct', label: 'Direct' },
                  { value: 'sales_order', label: 'Sales Order' },
                  { value: 'proforma', label: 'Proforma' },
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
                    void loadFromSalesOrder(id, { announceSuccess: true })
                  }}
                  placeholder={prefillLoading ? 'Loading sales order…' : 'Search sales order no, customer…'}
                  appearance="dropdown"
                  emptyMessage="No confirmed sales orders available."
                  disabled={prefillLoading}
                  resolveOrphanLabel={(id) =>
                    prefill?.salesOrderId === id
                      ? prefill.salesOrderNo ?? undefined
                      : salesOrders.find((s) => s.id === id)?.salesOrderNo
                  }
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
                    void loadFromProforma(id, { announceSuccess: true })
                  }}
                  placeholder={prefillLoading ? 'Loading proforma…' : 'Search proforma no, customer…'}
                  appearance="dropdown"
                  emptyMessage="No issued proformas available."
                  disabled={prefillLoading}
                  resolveOrphanLabel={(id) =>
                    prefill?.proformaInvoiceId === id
                      ? prefill.proformaNo ?? undefined
                      : proformas.find((p) => p.id === id)?.proformaNo
                  }
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

            {!prefill && !error && !prefillLoading ? (
              <div className="col-span-full">
                <p className="pi-create-mode-hint">
                  <PenLine className="h-4 w-4 shrink-0" aria-hidden />
                  {sourceType === 'direct'
                    ? 'Select a customer to start a direct tax invoice, then add product lines.'
                    : 'Select a source above to auto-load customer, taxes, addresses, and invoice lines.'}
                </p>
              </div>
            ) : null}
          </>
        )}
      </ErpFieldGroup>
      </div>

      {prefill ? (
        <>
          <div id="ti-section-customer">
          <ErpCardSection
            title="Customer & commercial"
            subtitle={
              isDirect
                ? 'Bill-to party, commercial terms, and addresses.'
                : 'Inherited from the source document — adjust terms if needed.'
            }
            icon={Building2}
            accent="teal"
            collapsible
            defaultOpen
            columns={1}
            className="ti-create-commercial"
          >
            <div className="ti-create-commercial__body col-span-full">
              <aside className="ti-create-party" aria-label="Selected customer">
                <div className="ti-create-party__avatar" aria-hidden>
                  {prefill.customerName
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </div>
                <div className="ti-create-party__main">
                  <div className="ti-create-party__title-row">
                    <h3 className="ti-create-party__name">{prefill.customerName}</h3>
                    <TableLink
                      to={salesCustomer360Path(prefill.customerId)}
                      className="ti-create-party__360"
                    >
                      Customer 360
                    </TableLink>
                  </div>
                  <div className="ti-create-party__chips">
                    <span className="ti-create-party__chip">
                      <span className="ti-create-party__chip-label">GSTIN</span>
                      {prefill.customerGstin || '-'}
                    </span>
                    <span className="ti-create-party__chip">
                      <span className="ti-create-party__chip-label">Place of supply</span>
                      {prefill.customerState || '-'}
                    </span>
                    {prefill.salesOrderNo ? (
                      <span className="ti-create-party__chip">
                        <span className="ti-create-party__chip-label">SO</span>
                        <TableLink to={`/sales/orders/${prefill.salesOrderId}`}>
                          {prefill.salesOrderNo}
                        </TableLink>
                      </span>
                    ) : null}
                    {prefill.proformaNo ? (
                      <span className="ti-create-party__chip">
                        <span className="ti-create-party__chip-label">PI</span>
                        <TableLink to={`/sales/proforma-invoices/${prefill.proformaInvoiceId}`}>
                          {prefill.proformaNo}
                        </TableLink>
                      </span>
                    ) : null}
                    {prefill.quotationNo ? (
                      <span className="ti-create-party__chip">
                        <span className="ti-create-party__chip-label">Quote</span>
                        {prefill.quotationNo}
                      </span>
                    ) : null}
                  </div>
                </div>
              </aside>

              <div className="ti-create-commercial__grid">
                {isDirect ? (
                  <>
                    <label className="ti-create-field">
                      <span className="ti-create-field__label">Payment terms</span>
                      <CommercialTermSelect
                        termType="payment"
                        value={prefill.paymentTerms}
                        onChange={(v) => setPrefill({ ...prefill, paymentTerms: v })}
                        placeholder="Select payment terms"
                      />
                    </label>
                    <label className="ti-create-field">
                      <span className="ti-create-field__label">Delivery terms</span>
                      <CommercialTermSelect
                        termType="delivery"
                        value={prefill.deliveryTerms}
                        onChange={(v) => setPrefill({ ...prefill, deliveryTerms: v })}
                        placeholder="Select delivery terms"
                      />
                    </label>
                    <label className="ti-create-field">
                      <span className="ti-create-field__label">Customer PO</span>
                      <Input
                        value={prefill.customerPoNumber ?? ''}
                        onChange={(e) =>
                          setPrefill({ ...prefill, customerPoNumber: e.target.value || null })
                        }
                        placeholder="Optional PO reference"
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <div className="ti-create-field ti-create-field--readonly">
                      <span className="ti-create-field__label">Payment terms</span>
                      <span className="ti-create-field__value">{prefill.paymentTerms || '-'}</span>
                    </div>
                    <div className="ti-create-field ti-create-field--readonly">
                      <span className="ti-create-field__label">Delivery terms</span>
                      <span className="ti-create-field__value">{prefill.deliveryTerms || '-'}</span>
                    </div>
                    <div className="ti-create-field ti-create-field--readonly">
                      <span className="ti-create-field__label">Customer PO</span>
                      <span className="ti-create-field__value">{prefill.customerPoNumber || '-'}</span>
                    </div>
                  </>
                )}
              </div>

              <div className="ti-create-addresses">
                <div className="ti-create-address">
                  <p className="ti-create-address__label">Bill to</p>
                  <p className="ti-create-address__body">
                    {prefill.billingAddress || prefill.customerAddress || '-'}
                  </p>
                </div>
                <div className="ti-create-address">
                  <p className="ti-create-address__label">Ship to</p>
                  <p className="ti-create-address__body">
                    {prefill.shippingAddress || prefill.customerAddress || '-'}
                  </p>
                </div>
              </div>

              <div className="mt-4 col-span-full">
                <CommercialGstSupplyPanel
                  value={gstSupply}
                  onChange={onGstSupplyChange}
                  customerState={prefill.customerState}
                  customerGstin={prefill.customerGstin}
                  shipToState={prefill.shippingAddress || prefill.customerState}
                  billToState={prefill.billingAddress || prefill.customerState}
                />
              </div>
            </div>
          </ErpCardSection>
          </div>

          <div id="ti-section-lines">
          <ErpCardSection
            title="Product & Pricing"
            subtitle={
              isDirect
                ? 'HSN/SAC and GST resolve from tax masters when you pick an item (CGST+SGST / IGST / UTGST).'
                : 'HSN and scheme carry from SO/PI. Adjust quantity for a partial invoice (capped at remaining).'
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
                    <colgroup>
                      <col className="so-pricing-col-idx" />
                      <col className="so-pricing-col-product" />
                      <col className="so-pricing-col-hsn" />
                      <col className="so-pricing-col-qty" />
                      <col className="so-pricing-col-price" />
                      <col className="so-pricing-col-disc" />
                      <col className="so-pricing-col-gst" />
                      <col className="so-pricing-col-scheme" />
                      <col className="so-pricing-col-money" />
                      <col className="so-pricing-col-money" />
                      <col className="so-pricing-col-money-wide" />
                      <col className="so-pricing-col-action" />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="so-pricing-th so-pricing-th--center">#</th>
                        <th className="so-pricing-th">Product</th>
                        <th className="so-pricing-th">HSN/SAC</th>
                        <th className="so-pricing-th so-pricing-th--right">Qty</th>
                        <th className="so-pricing-th so-pricing-th--right">Unit price</th>
                        <th className="so-pricing-th so-pricing-th--right">Disc %</th>
                        <th className="so-pricing-th so-pricing-th--right">GST %</th>
                        <th className="so-pricing-th">Scheme</th>
                        <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Taxable</th>
                        <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">GST</th>
                        <th className="so-pricing-th so-pricing-th--right so-pricing-th--calc">Line total</th>
                        <th className="so-pricing-th so-pricing-th--center" aria-label="Actions" />
                      </tr>
                    </thead>
                    <tbody>
                      {prefill.lines.map((line, idx) => {
                        const item = line.itemId ? getItem(line.itemId) : undefined
                        const hsn = resolveHsnSacDisplay(line, item)
                        return (
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
                          <td className="so-pricing-td tabular-nums text-[12px] text-erp-muted">
                            {hsn.code || '-'}
                            {!hsn.fromSnapshot && hsn.code ? (
                              <span className="ml-1 text-[10px] text-amber-700" title="From item master">
                                live
                              </span>
                            ) : null}
                          </td>
                          <td className="so-pricing-td">
                            <Input
                              type="number"
                              min={0}
                              step="1"
                              className="so-pricing-input so-pricing-input--num"
                              value={String(line.qty)}
                              onChange={(e) =>
                                setPrefill(patchPrefillLineQty(prefill, line.id, e.target.value, supplyForTotals))
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
                                  patchPrefillLine(
                                    prefill,
                                    line.id,
                                    {
                                      unitPrice: Number(e.target.value) || 0,
                                    },
                                    supplyForTotals,
                                  ),
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
                                  patchPrefillLine(
                                    prefill,
                                    line.id,
                                    {
                                      discountPct: Number(e.target.value) || 0,
                                    },
                                    supplyForTotals,
                                  ),
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
                                  patchPrefillLine(
                                    prefill,
                                    line.id,
                                    {
                                      taxPct: Number(e.target.value) || 0,
                                    },
                                    supplyForTotals,
                                  ),
                                )
                              }
                            >
                              {GST_RATE_OPTIONS.map((rate) => (
                                <option key={rate} value={rate}>
                                  {rate}%
                                </option>
                              ))}
                              {!GST_RATE_OPTIONS.includes(line.taxPct as (typeof GST_RATE_OPTIONS)[number]) ? (
                                <option value={line.taxPct}>{line.taxPct}%</option>
                              ) : null}
                            </select>
                          </td>
                          <td className="so-pricing-td text-[11px] text-erp-muted">
                            {formatTaxSchemeLabel(line.taxScheme)}
                          </td>
                          <td className="so-pricing-td so-pricing-td--right tabular-nums text-erp-muted">
                            {formatCurrency(line.taxableValue)}
                          </td>
                          <td className="so-pricing-td so-pricing-td--right tabular-nums text-erp-muted">
                            {formatCurrency(line.gstAmount)}
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
                        )
                      })}
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
                    {' · '}GST from tax masters on item pick
                  </p>
                </div>
              </div>
            ) : (
              <div className="col-span-full overflow-x-auto erp-line-items-grid">
                <table className="w-full min-w-[820px] text-[12px] erp-line-items-grid__table">
                  <thead>
                    <tr className="border-b border-erp-border bg-erp-surface-alt/60 text-left text-[11px] uppercase tracking-wide text-erp-muted">
                      <th className="px-2 py-2">Item</th>
                      <th className="px-2 py-2">HSN/SAC</th>
                      <th className="px-2 py-2">Scheme</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Max</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-2 py-2">Tax %</th>
                      <th className="px-2 py-2 text-right">Line total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prefill.lines.map((line) => {
                      const item = line.itemId ? getItem(line.itemId) : undefined
                      const hsn = resolveHsnSacDisplay(line, item)
                      return (
                      <tr key={line.id} className="border-b border-erp-border/60">
                        <td className="px-2 py-2">
                          <div className="font-medium text-erp-text">{line.itemCode || '-'}</div>
                          <div className="text-[11px] text-erp-muted">{line.description}</div>
                        </td>
                        <td className="px-2 py-2 font-mono text-[11px] text-erp-muted">
                          {hsn.code || '-'}
                        </td>
                        <td className="px-2 py-2 text-[11px] text-erp-muted">
                          {formatTaxSchemeLabel(line.taxScheme)}
                        </td>
                        <td className="px-2 py-2">
                          <Input
                            type="number"
                            min={0}
                            max={line.maxQty ?? undefined}
                            step="1"
                            className="ml-auto w-24 text-right"
                            value={String(line.qty)}
                            onChange={(e) =>
                              setPrefill(
                                patchPrefillLineQty(prefill, line.id, e.target.value, supplyForTotals),
                              )
                            }
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
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </ErpCardSection>
          </div>

          <div id="ti-section-totals">
          <ErpCardSection
            title="Order adjustments & summary"
            subtitle="Same charge options and GST scheme as sales orders — discount, freight, installation, other charges, and CGST/SGST or IGST."
            icon={Banknote}
            accent="amber"
            collapsible
            defaultOpen
            columns={1}
            className="!max-w-none"
          >
            {orderPricing ? (
              <CommercialOrderAdjustmentsBlock
                value={charges}
                onChange={setCharges}
                summary={orderPricing.summary}
                showFreight={showFreight}
                showExtendedCharges
                gstExtras={orderPricing.gstExtras}
              />
            ) : null}
            {prefill.remarks ? (
              <div className="mt-3 rounded-lg border border-erp-border bg-erp-surface-alt/40 px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">Remarks</p>
                <p className="mt-1 text-[13px] text-erp-text whitespace-pre-wrap">{prefill.remarks}</p>
              </div>
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
      notify.error('Select a payment mode.')
      return
    }
    const amt = Number(amount)
    if (!Number.isFinite(amt) || amt <= 0) {
      setError('Enter a valid amount received.')
      notify.error('Enter a valid amount received.')
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
      const msg = result.error ?? 'Failed to record receipt'
      setError(msg)
      notify.error(msg)
      return
    }
    notify.success(`Receipt recorded — map it to tax invoices from Payment Allocation when ready`)
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
      <ErpCardSection
        title="Payment receipt"
        subtitle="Record the customer remittance against this proforma."
        columns={1}
        className="pi-receive-section"
      >
        <div className="pi-receive col-span-full">
          <aside className="pi-receive-context" aria-label="Payment context">
            <div className="pi-receive-context__avatar" aria-hidden>
              {proforma.customerName
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase()}
            </div>
            <div className="pi-receive-context__main">
              <div className="pi-receive-context__title-row">
                <h3 className="pi-receive-context__name">{proforma.customerName}</h3>
                <TableLink
                  to={salesCustomer360Path(proforma.customerId)}
                  className="pi-receive-context__360"
                >
                  Customer 360
                </TableLink>
              </div>
              <div className="pi-receive-context__chips">
                <span className="pi-receive-chip">
                  <span className="pi-receive-chip__label">Proforma</span>
                  <TableLink to={`/sales/proforma-invoices/${proforma.id}`}>
                    {proforma.proformaNo}
                  </TableLink>
                </span>
                {proforma.salesOrderNo ? (
                  <span className="pi-receive-chip">
                    <span className="pi-receive-chip__label">SO</span>
                    {proforma.salesOrderId ? (
                      <TableLink to={`/sales/orders/${proforma.salesOrderId}`}>
                        {proforma.salesOrderNo}
                      </TableLink>
                    ) : (
                      proforma.salesOrderNo
                    )}
                  </span>
                ) : null}
                <span className="pi-receive-chip pi-receive-chip--balance">
                  <span className="pi-receive-chip__label">Balance</span>
                  {formatCurrency(summary.balanceAmount)}
                </span>
              </div>
            </div>
          </aside>

          <section className="pi-receive-group" aria-labelledby="pi-receive-identity">
            <h4 id="pi-receive-identity" className="pi-receive-group__title">Receipt identity</h4>
            <div className="pi-receive-grid">
              <div className="pi-receive-field pi-receive-field--readonly">
                <span className="pi-receive-field__label">Receipt number</span>
                <span className="pi-receive-field__value">Auto-generated on save</span>
              </div>
              <label className="pi-receive-field">
                <span className="pi-receive-field__label">
                  Receipt date <span className="pi-receive-field__req" aria-hidden>*</span>
                </span>
                <Input type="date" value={receiptDate} onChange={(e) => setReceiptDate(e.target.value)} />
              </label>
            </div>
          </section>

          <section className="pi-receive-group" aria-labelledby="pi-receive-payment">
            <h4 id="pi-receive-payment" className="pi-receive-group__title">Payment</h4>
            <div className="pi-receive-grid">
              <label className="pi-receive-field">
                <span className="pi-receive-field__label">
                  Payment mode <span className="pi-receive-field__req" aria-hidden>*</span>
                </span>
                <Select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as CrmPaymentMode | '')}>
                  <option value="">{SELECT_PLACEHOLDER}</option>
                  {(Object.keys(CRM_PAYMENT_MODE_LABELS) as CrmPaymentMode[]).map((m) => (
                    <option key={m} value={m}>{CRM_PAYMENT_MODE_LABELS[m]}</option>
                  ))}
                </Select>
              </label>
              <label className="pi-receive-field">
                <span className="pi-receive-field__label">
                  Amount received <span className="pi-receive-field__req" aria-hidden>*</span>
                </span>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={String(summary.balanceAmount)}
                />
              </label>
              <label className="pi-receive-field pi-receive-field--wide">
                <span className="pi-receive-field__label">Transaction reference</span>
                <Input
                  value={transactionRef}
                  onChange={(e) => setTransactionRef(e.target.value)}
                  placeholder="UTR / Cheque / UPI ref"
                />
              </label>
            </div>
          </section>

          <section className="pi-receive-group" aria-labelledby="pi-receive-notes">
            <h4 id="pi-receive-notes" className="pi-receive-group__title">Notes &amp; attachment</h4>
            <div className="pi-receive-grid">
              <label className="pi-receive-field pi-receive-field--wide">
                <span className="pi-receive-field__label">Remarks</span>
                <Textarea value={remarks} onChange={(e) => setRemarks(e.target.value)} rows={3} />
              </label>
              <label className="pi-receive-field pi-receive-field--wide">
                <span className="pi-receive-field__label">Attachment (optional)</span>
                <Input
                  type="file"
                  onChange={(e) => setAttachmentName(e.target.files?.[0]?.name ?? null)}
                />
                {attachmentName ? (
                  <span className="pi-receive-field__hint">{attachmentName}</span>
                ) : null}
              </label>
            </div>
          </section>

          {error ? <p className="pi-receive-error" role="alert">{error}</p> : null}
        </div>
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
  const migrationStatus = receipt?.accountingMigrationStatus ?? 'UNREVIEWED'
  const accountingControlled =
    Boolean(receipt?.accountingReceiptId) ||
    migrationStatus === 'DRAFT_CREATED' ||
    migrationStatus === 'MIGRATED'

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
          primaryAction={
            accountingControlled && receipt.accountingReceiptId
              ? {
                  id: 'open-ar',
                  label: migrationStatus === 'MIGRATED' ? 'Open Posted Receipt' : 'Open Accounting Draft',
                  icon: FileText,
                  onClick: () => navigate(`/accounting/money-in/receipts/${receipt.accountingReceiptId}`),
                }
              : canCrmPermission('crm.commercial.receipt.accounting_draft.create')
                ? {
                    id: 'record-mi',
                    label: 'Record in Money In',
                    icon: Banknote,
                    onClick: () =>
                      navigate(
                        `/accounting/money-in/receipts/new?customerId=${receipt.customerId}&crmPaymentReceiptId=${receipt.id}`,
                      ),
                  }
                : {
                    id: 'alloc',
                    label: 'Allocate',
                    icon: ArrowLeftRight,
                    onClick: () => navigate(`/sales/payment-allocation?customerId=${receipt.customerId}`),
                  }
          }
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
        {
          label: 'Books',
          value: CRM_RECEIPT_MIGRATION_STATUS_LABELS[migrationStatus],
          accent: migrationStatus === 'MIGRATED' ? 'green' : 'slate',
        },
      ]}
    >
      <div className="mb-4 rounded border border-erp-border bg-erp-surface-muted/30 px-3 py-2 text-[13px]">
        <span className="font-semibold text-erp-text">
          {CRM_RECEIPT_MIGRATION_STATUS_LABELS[migrationStatus]}
        </span>
        <span className="text-erp-muted">
          {' '}
          — CRM receipts never post GL. Use Money In for statutory customer receipts and allocations.
        </span>
      </div>
      <ErpCardSection title="Receipt details">
        <ErpFieldRow label="Customer" readOnly>
          <TableLink to={salesCustomer360Path(receipt.customerId)}>{receipt.customerName}</TableLink>
        </ErpFieldRow>
        {receipt.proformaInvoiceId ? (
          <ErpFieldRow label="Proforma" readOnly>
            <TableLink to={`/sales/proforma-invoices/${receipt.proformaInvoiceId}`}>{receipt.proformaNo}</TableLink>
          </ErpFieldRow>
        ) : null}
        <ErpFieldRow label="Transaction ref" readOnly>{receipt.transactionRef || '-'}</ErpFieldRow>
        <ErpFieldRow label="Remarks" readOnly>{receipt.remarks || '-'}</ErpFieldRow>
        <ErpFieldRow label="Attachment" readOnly>{receipt.attachmentName || '-'}</ErpFieldRow>
      </ErpCardSection>
      <ErpCardSection title="Accounting handoff" className="mt-4">
        <ErpFieldRow label="Migration status" readOnly>
          {CRM_RECEIPT_MIGRATION_STATUS_LABELS[migrationStatus]}
        </ErpFieldRow>
        <ErpFieldRow label="Accounting receipt" readOnly>
          {receipt.accountingReceiptId ? (
            <TableLink to={`/accounting/money-in/receipts/${receipt.accountingReceiptId}`}>
              {receipt.accountingReceiptId}
            </TableLink>
          ) : (
            '-'
          )}
        </ErpFieldRow>
        <ErpFieldRow label="Migration error" readOnly>
          {receipt.accountingMigrationError || '-'}
        </ErpFieldRow>
      </ErpCardSection>
      <ErpCardSection title="Allocations" className="mt-4">
        <div className="col-span-2 space-y-2">
          {allocations.length === 0 ? (
            <p className="text-[13px] text-erp-muted">Not allocated to any commercial invoice yet.</p>
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
