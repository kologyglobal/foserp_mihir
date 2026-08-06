import { useMemo, useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ClipboardList,
  FileText,
  MapPin,
  Save,
} from 'lucide-react'
import { ErpCardSection, ErpFieldRow, ErpStickySaveBar } from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
} from '../../design-system/workspace'
import { SalesCardFormShell } from './SalesCardFormShell'
import { salesBreadcrumbs } from '../../utils/salesNavigation'
import { crmBreadcrumbs } from '../../utils/crmNavigation'
import {
  CRM_SALES_ORDERS_PATH,
  buildSalesOrderEditUrl,
  isFromCrmSearchParam,
  resolveSalesOrderDetailPath,
} from '../../utils/crmSalesOrderNavigation'
import { CommercialTermSelect } from '../../components/masters/GeographySelects'
import { Input, Textarea, Select } from '../../components/forms/Inputs'
import { SELECT_PLACEHOLDER } from '../../components/forms/selectStandards'
import { useDeliveryTimeOptions } from '../../hooks/useCrmMasters'
import { AppLink } from '../../components/ui/AppLink'
import { notify } from '../../store/toastStore'
import { validateSalesOrderDraft } from '../../utils/validation/crmSchemas/salesOrderSchema'
import { handleInvalidSubmit, type FieldErrorMap } from '../../utils/formValidation'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { isApiMode } from '../../config/apiConfig'
import { apiUpdateSalesOrder, apiFetchSalesOrder } from '../../services/bridges/salesOrderApiBridge'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { formatStatus } from '../../components/ui/Badge'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { locationDisplayLabel } from '../../utils/locationUtils'
import { useTenantProfileStore } from '../../store/tenantProfileStore'
import { quotationNoWithRevision } from '../../utils/quotationEngine/revisionLabels'
import {
  SalesOrderLinesEditor,
  buildSoLineApiPayload,
  computeSoLineTotals,
  emptySoOrderCharges,
  newSoLineDraft,
  parseSoOrderCharges,
  serializeSoOrderCharges,
  soLinesFromOrder,
  summarizeSoLines,
  type SoLineDraft,
  type SoOrderCharges,
} from '../../components/sales/SalesOrderLinesEditor'
import { canUseItemInSales } from '../../utils/opportunityItemOptions'
import type { SalesOrderLine } from '../../types/mrp'
import {
  CommercialGstSupplyPanel,
  type CommercialGstSupplyValue,
} from '../../components/sales/CommercialGstSupplyPanel'
import { loadSellerStateCode } from '../../utils/sellerGstState'

export { SalesOrderNewPage } from './SalesOrderCreatePage'

export function SalesOrderEditPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const fromCrm = isFromCrmSearchParam(searchParams.get('fromCrm'))
  const listPath = fromCrm ? CRM_SALES_ORDERS_PATH : '/sales/orders'
  const detailPath = id ? resolveSalesOrderDetailPath(id, fromCrm) : listPath
  const editPath = id ? buildSalesOrderEditUrl(id, { fromCrm }) : listPath
  const so = useMrpStore((s) => (id ? s.salesOrders.find((o) => o.id === id) : undefined))
  const updateDraft = useMrpStore((s) => s.updateSalesOrderDraft)
  const customers = useMasterStore((s) => s.customers)
  const locations = useMasterStore((s) => s.locations)
  const getItem = useMasterStore((s) => s.getItem)
  const [validationErrors, setValidationErrors] = useState<FieldErrorMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [customerPoDate, setCustomerPoDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [internalRemarks, setInternalRemarks] = useState('')
  const [lines, setLines] = useState<SoLineDraft[]>(() => [newSoLineDraft('', 0)])
  const [charges, setCharges] = useState<SoOrderCharges>(() => emptySoOrderCharges())
  const [scopeNotes, setScopeNotes] = useState('')
  const [gstSupply, setGstSupply] = useState<CommercialGstSupplyValue>({
    placeOfSupply: '',
    placeOfSupplyOverride: false,
    placeOfSupplyOverrideReason: '',
    supplierStateCode: '',
  })

  useEffect(() => {
    let cancelled = false
    void loadSellerStateCode().then((code) => {
      if (cancelled || !code) return
      setGstSupply((prev) => {
        // Prefer document snapshot; fill from LE only when missing
        if (prev.supplierStateCode) return prev
        return { ...prev, supplierStateCode: code }
      })
    })
    return () => {
      cancelled = true
    }
  }, [])

  const deliveryTimeOptions = useDeliveryTimeOptions()
  const { locationId, setLocationId } = useDocumentLocation('sales', so?.locationId)
  const showLocationField = !useTenantProfileStore((s) => s.isServices())
  const showFreight = !useTenantProfileStore((s) => s.isServices())
  const isServices = useTenantProfileStore((s) => s.isServices())
  /** Prevent re-seeding editor after user edits when store reference changes. */
  const linesSeedKeyRef = useRef<string | null>(null)

  // Always hydrate full SO (incl. lines[]) in API mode ΓÇö list rows may be incomplete.
  useEffect(() => {
    if (!id || !isApiMode()) return
    let cancelled = false
    setDetailLoading(true)
    setLoadError(null)
    void apiFetchSalesOrder(id).then((r) => {
      if (cancelled) return
      setDetailLoading(false)
      if (!r.ok) setLoadError(r.error ?? 'Could not load sales order')
    })
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (!so) return
    setCustomerPoNumber(so.customerPoNumber ?? '')
    setCustomerPoDate(so.customerPoDate?.slice(0, 10) ?? '')
    setExpectedDeliveryDate(so.expectedDeliveryDate?.slice(0, 10) ?? so.requiredDate?.slice(0, 10) ?? '')
    setDeliveryLocation(so.deliveryLocation ?? '')
    setPaymentTerms(so.paymentTerms?.trim() || '30% advance, balance before dispatch')
    setDeliveryTerms(so.deliveryTerms?.trim() || 'Ex-works Pune')
    setDeliveryTime(so.deliveryTime?.trim() ?? '')
    setInternalRemarks(so.internalRemarks ?? '')
    if (so.locationId) setLocationId(so.locationId)
    setGstSupply((prev) => ({
      placeOfSupply: so.placeOfSupplyStateCode ?? so.placeOfSupply ?? '',
      placeOfSupplyOverride: Boolean(so.placeOfSupplyOverride),
      placeOfSupplyOverrideReason: so.placeOfSupplyOverrideReason ?? '',
      // Prefer SO snapshot; keep LE-seeded value when SO never stored supplier (no silent '27').
      supplierStateCode: so.supplierStateCode?.trim()
        ? so.supplierStateCode
        : prev.supplierStateCode,
    }))
  }, [so, setLocationId])

  // Seed product lines once per order; re-seed when API detail upgrades list stub ΓåÆ multi-lines.
  useEffect(() => {
    if (!so) return
    if (isApiMode() && detailLoading) return
    const lineCount = so.lines?.length ?? 0
    const seedKey = `${so.id}|L${lineCount}`
    const prev = linesSeedKeyRef.current
    if (prev === seedKey) return

    const isSameOrder = Boolean(prev?.startsWith(`${so.id}|`))
    const wasStub = prev === `${so.id}|L0`
    const upgradingToLines = wasStub && lineCount > 0
    if (isSameOrder && !upgradingToLines && prev !== null) return

    linesSeedKeyRef.current = seedKey
    setLines(soLinesFromOrder(so, getItem))
    setCharges(parseSoOrderCharges(so.commercialNotes))
    setScopeNotes(so.technicalNotes ?? '')
  }, [so, detailLoading, getItem])

  const customer = useMemo(
    () => (so ? customers.find((c) => c.id === so.customerId) : undefined),
    [so, customers],
  )

  const orderSummary = useMemo(
    () => summarizeSoLines(lines, getItem, charges, { showFreight }),
    [lines, getItem, charges, showFreight],
  )

  const primaryLine = lines[0]
  const primaryItem = primaryLine?.itemId ? getItem(primaryLine.itemId) : undefined
  const displayValue = orderSummary.grandTotal
  const totalQty = orderSummary.totalQty
  const productLabel =
    primaryItem?.itemName
    ?? lines.find((l) => l.itemId)?.itemId
    ?? 'ΓÇö'

  const poDone = Boolean(customerPoNumber.trim())
  const deliveryDone = Boolean(expectedDeliveryDate)
  const commercialDone = Boolean(paymentTerms.trim() && deliveryTerms.trim() && deliveryTime.trim())
  const hasValidLines =
    lines.length > 0 && lines.every((l) => l.itemId && l.qty >= 1 && l.unitPrice > 0)

  const completionItems = useMemo(() => [
    { id: 'context', label: 'Order Context', done: Boolean(so?.customerId) },
    { id: 'lines', label: 'Products', done: hasValidLines },
    { id: 'po', label: 'PO & Delivery', done: poDone && deliveryDone },
    { id: 'commercial', label: 'Commercial', done: commercialDone },
  ], [so?.customerId, hasValidLines, poDone, deliveryDone, commercialDone])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  if (!id || !so) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">
          {detailLoading
            ? 'Loading sales orderΓÇª'
            : loadError ?? 'Sales order not found.'}
        </p>
        <AppLink to={listPath} className="text-sm font-semibold text-erp-primary">
          Back to {fromCrm ? 'CRM sales orders' : 'sales orders'}
        </AppLink>
      </div>
    )
  }

  if (so.status !== 'open') {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Only draft sales orders can be edited. This order is {formatStatus(so.status)}.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <AppLink to={listPath} className="text-sm font-semibold text-erp-primary">
            Back to {fromCrm ? 'CRM sales orders' : 'sales orders'}
          </AppLink>
          <AppLink to={detailPath} className="text-sm font-semibold text-erp-primary">View order</AppLink>
        </div>
      </div>
    )
  }

  const draftSo = so

  function validateDraft(): FieldErrorMap {
    const fieldErrors = validateSalesOrderDraft({
      paymentTerms,
      deliveryTerms,
      deliveryTime,
      expectedDeliveryDate,
      customerPoDate,
    }).fieldErrors

    if (!lines.length || lines.every((l) => !l.itemId)) {
      fieldErrors.lines = 'Add at least one product line'
    } else {
      for (const line of lines) {
        if (!line.itemId) {
          fieldErrors.lines = 'Select a product on every line'
          break
        }
        if (line.qty < 1) {
          fieldErrors.lines = 'Quantity must be at least 1'
          break
        }
        const sellable = canUseItemInSales(line.itemId)
        if (!sellable.ok) {
          fieldErrors.lines = sellable.error ?? 'Item is not allowed for sales'
          break
        }
      }
    }
    return fieldErrors
  }

  function toDemoLines(): SalesOrderLine[] {
    return lines.map((l, idx) => {
      const totals = computeSoLineTotals(l)
      const item = getItem(l.itemId)
      return {
        id: l.id ?? crypto.randomUUID(),
        lineNo: idx + 1,
        productOrItem: item?.itemName ?? l.itemId,
        description: item?.itemName ?? '',
        itemId: l.itemId,
        productId: null,
        qty: l.qty,
        uom: 'NOS',
        unitPrice: l.unitPrice,
        discountPct: l.discountPct,
        taxPct: l.taxPct,
        taxableValue: totals.taxableValue,
        gstAmount: totals.gstAmount,
        lineTotal: totals.lineTotal,
        hsnCode: l.hsnCode || item?.hsnCode || null,
        hsnId: l.hsnId || item?.hsnId || null,
        taxScheme: l.taxScheme ?? null,
        cgstRate: l.cgstRate ?? null,
        sgstRate: l.sgstRate ?? null,
        igstRate: l.igstRate ?? null,
        utgstRate: l.utgstRate ?? null,
      }
    })
  }

  async function handleSave(mode: 'save' | 'close' = 'save') {
    const errors = validateDraft()
    if (Object.keys(errors).length) {
      handleInvalidSubmit({
        errors,
        fieldOrder: [
          'lines',
          'paymentTerms',
          'deliveryTerms',
          'deliveryTime',
          'expectedDeliveryDate',
          'customerPoDate',
        ],
        onFieldErrors: setValidationErrors,
      })
      return
    }
    setValidationErrors({})

    setIsSubmitting(true)
    const locLabel = locations.find((l) => l.id === locationId)
    const primary = lines[0]!
    const linePayload = buildSoLineApiPayload(lines, getItem)
    const commercial = {
      customerPoNumber: customerPoNumber.trim() || undefined,
      customerPoDate: customerPoDate || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      deliveryLocation: (locLabel ? locationDisplayLabel(locLabel) : deliveryLocation.trim()) || null,
      locationId: locationId || null,
      paymentTerms: paymentTerms.trim() || undefined,
      deliveryTerms: deliveryTerms.trim() || undefined,
      deliveryTime: deliveryTime.trim() || undefined,
      internalRemarks: internalRemarks.trim() || null,
      requiredDate: expectedDeliveryDate || draftSo.requiredDate,
      /** Full charges blob until SO has first-class charge columns. */
      commercialNotes: serializeSoOrderCharges(charges),
      technicalNotes: scopeNotes.trim() || null,
      placeOfSupply: gstSupply.placeOfSupplyOverride
        ? gstSupply.placeOfSupply || null
        : (customer?.state ?? gstSupply.placeOfSupply) || null,
      placeOfSupplyOverride: gstSupply.placeOfSupplyOverride || undefined,
      placeOfSupplyOverrideReason: gstSupply.placeOfSupplyOverride
        ? gstSupply.placeOfSupplyOverrideReason.trim() || null
        : null,
      supplierStateCode: gstSupply.supplierStateCode || null,
    }

    const r = isApiMode()
      ? await apiUpdateSalesOrder(draftSo.id, {
          ...commercial,
          lines: linePayload,
        })
      : updateDraft(draftSo.id, {
          ...commercial,
          qty: orderSummary.totalQty,
          unitPrice: primary.unitPrice,
          discountPct: primary.discountPct,
          itemId: primary.itemId,
          productId: primary.itemId,
          basicAmount: orderSummary.basicAmount,
          gstAmount: orderSummary.totalGst,
          grandTotal: orderSummary.grandTotal,
          lines: toDemoLines(),
        })
    setIsSubmitting(false)

    if (r.ok) {
      notify.success('Sales order saved')
      navigate(mode === 'close' ? listPath : detailPath)
      return
    }
    notify.error(r.error ?? 'Save failed')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleSave('save')
  }

  const documentStrip = [
    { label: 'SO No.', value: so.salesOrderNo, highlight: true },
    { label: 'Status', value: 'Draft' },
    { label: 'Customer', value: customer?.customerName ?? 'ΓÇö', highlight: Boolean(customer) },
    { label: 'Product', value: productLabel },
    { label: 'Qty', value: formatNumber(totalQty) },
    { label: 'Order Value', value: displayValue > 0 ? formatCurrency(displayValue) : 'ΓÇö', highlight: displayValue > 0 },
    { label: 'Customer PO', value: customerPoNumber.trim() || 'ΓÇö' },
    {
      label: 'Quotation Number (Reference)',
      value: so.quotationNo ? `${so.quotationNo} Rev ${so.quotationRevisionNo ?? 1}` : 'ΓÇö',
    },
  ]

  /** Secondary nav only ΓÇö Save / Cancel live in the sticky footer (same as New Lead). */
  const commandBar = (
    <ErpCardCommandBar
      inline
      moreActions={[
        { id: '360', label: 'View 360', icon: Building2, onClick: () => navigate(detailPath) },
        {
          id: 'list',
          label: fromCrm ? 'CRM Sales Orders' : 'All Sales Orders',
          icon: ClipboardList,
          onClick: () => navigate(listPath),
        },
      ]}
    />
  )

  const factBox = (
    <EnterpriseBusinessFactBox
      completion={{ percent: completionPercent, items: completionItems }}
      aiInsights={[
        {
          id: 'ready',
          label: 'Readiness',
          value: completionPercent >= 100 ? 'Ready to save' : 'Incomplete',
          tone: completionPercent >= 100 ? 'success' as const : 'warning' as const,
        },
        {
          id: 'next',
          label: 'Suggested Next',
          value: !hasValidLines
            ? 'Complete product lines'
            : !poDone
              ? 'Enter customer PO'
              : !commercialDone
                ? 'Set commercial terms'
                : 'Save and confirm order',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormContextPanel
        summaryTitle="Draft Summary"
        actionsTitle="Quick Actions"
        summary={[
          { label: 'Customer', value: customer?.customerName ?? 'ΓÇö' },
          { label: 'Lines', value: String(lines.length) },
          { label: 'Qty', value: formatNumber(totalQty) },
          { label: 'Value', value: formatCurrency(displayValue), highlight: true },
          { label: 'Customer PO', value: customerPoNumber.trim() || 'ΓÇö' },
          { label: 'Delivery', value: expectedDeliveryDate ? formatDate(expectedDeliveryDate) : 'ΓÇö' },
          { label: 'Payment', value: paymentTerms.trim() || 'ΓÇö' },
        ]}
        actions={[
          { id: 'save', label: 'Save Changes', icon: Save, primary: true, onClick: () => void handleSave('save'), disabled: isSubmitting },
          { id: '360', label: 'Order 360', icon: FileText, onClick: () => navigate(detailPath) },
        ]}
      />
      {so.quotationNo ? (
        <p className="mt-3 rounded-lg border border-erp-border bg-erp-surface-alt/60 p-3 text-[12px] text-erp-muted">
          Quotation <strong className="text-erp-text">{quotationNoWithRevision(so.quotationNo, so.quotationRevisionNo ?? 1)}</strong> is locked for this draft.
        </p>
      ) : null}
    </EnterpriseBusinessFactBox>
  )

  const breadcrumbs = fromCrm
    ? crmBreadcrumbs(
        { label: 'Sales Orders', to: CRM_SALES_ORDERS_PATH },
        { label: so.salesOrderNo, to: detailPath },
        { label: 'Edit' },
      )
    : salesBreadcrumbs(
        { label: 'Sales Orders', to: '/sales/orders' },
        { label: so.salesOrderNo, to: detailPath },
        { label: 'Edit' },
      )

  return (
    <>
      <SalesCardFormShell
        title="Edit Sales Order"
        badge={fromCrm ? 'CRM' : 'Sales'}
        className={`${ENTERPRISE_FORM_CLASS} crm-lead-form-page enterprise-workspace--crm-smart-overview`}
        recordNo={so.salesOrderNo}
        recordTitle={customer?.customerName ?? so.salesOrderNo}
        status="Draft"
        statusTone="info"
        stage="Open SO"
        createdDate={formatDate(so.orderDate ?? so.createdAt.slice(0, 10))}
        company={customer?.customerName}
        favoritePath={editPath}
        breadcrumbs={breadcrumbs}
        commandBar={commandBar}
        documentStrip={documentStrip}
        factBox={factBox}
        suppressFactBoxRecord
        collapsibleFactBox
        factBoxLabel="Smart Context"
        stickyFooter
        onSubmit={handleSubmit}
        onSaveShortcut={() => void handleSave('save')}
        onSaveCloseShortcut={() => void handleSave('close')}
        footer={(
          <ErpStickySaveBar
            sticky
            isSubmitting={isSubmitting}
            submitLabel="Save"
            cancelTo={detailPath}
            onSave={() => void handleSave('save')}
            onSaveAndClose={() => void handleSave('close')}
            hint={(
              <span className="text-[12px] text-erp-muted">
                {completionPercent}% complete ┬╖ Edit product lines, PO, and commercial terms
              </span>
            )}
          />
        )}
      >
        <ErpCardSection
          id="so-edit-section-context"
          title="Order Context"
          subtitle="Customer and quotation reference (read-only)."
          icon={Building2}
          accent="blue"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Sales Order No." readOnly>
            <Input value={so.salesOrderNo} readOnly className="erp-input" />
          </ErpFieldRow>
          <ErpFieldRow label="Customer" readOnly>
            <Input value={customer?.customerName ?? so.customerName ?? 'ΓÇö'} readOnly className="erp-input" />
          </ErpFieldRow>
          {so.quotationNo ? (
            <ErpFieldRow label="Quotation Number (Reference)" readOnly colSpan={2}>
              <Input value={`${so.quotationNo} ┬╖ Rev ${so.quotationRevisionNo ?? 1}`} readOnly className="erp-input" />
            </ErpFieldRow>
          ) : null}
        </ErpCardSection>

        <ErpCardSection
          id="so-edit-section-lines"
          title="Product & Pricing"
          subtitle="Add products, order adjustments (discount / freight / installation / other), and scope notes."
          icon={ClipboardList}
          accent="blue"
          collapsible
          defaultOpen
          className="!max-w-none so-pricing-section"
          columns={1}
        >
          <SalesOrderLinesEditor
            lines={lines}
            onChange={setLines}
            charges={charges}
            onChargesChange={setCharges}
            showFreight={showFreight}
            showExtendedCharges
            scopeNotes={scopeNotes}
            onScopeNotesChange={setScopeNotes}
            fieldError={validationErrors.lines}
          />
        </ErpCardSection>

        <ErpCardSection
          id="so-edit-section-po"
          title="PO & Delivery"
          subtitle="Customer purchase order and delivery schedule."
          icon={MapPin}
          accent="teal"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Customer PO Number">
            <Input value={customerPoNumber} onChange={(e) => setCustomerPoNumber(e.target.value)} className="erp-input" placeholder="e.g. PO/2026/1842" />
          </ErpFieldRow>
          <ErpFieldRow label="Customer PO Date">
            <Input type="date" value={customerPoDate} onChange={(e) => setCustomerPoDate(e.target.value)} className="erp-input" />
          </ErpFieldRow>
          <ErpFieldRow label="Expected Delivery Date">
            <Input type="date" value={expectedDeliveryDate} onChange={(e) => setExpectedDeliveryDate(e.target.value)} className="erp-input" />
          </ErpFieldRow>
          {showLocationField ? (
            <LocationFieldRow
              value={locationId}
              onChange={(locId) => {
                setLocationId(locId)
                const loc = locations.find((l) => l.id === locId)
                if (loc) setDeliveryLocation(locationDisplayLabel(loc))
              }}
              usage="sales"
              colSpan={2}
              label="Location Code"
              hint="Fulfilment location from Lead ΓåÆ Opportunity ΓåÆ Quotation chain"
            />
          ) : null}
        </ErpCardSection>

        <ErpCardSection
          id="so-edit-section-gst"
          title="GST Supply"
          subtitle="Auto Place of Supply and supply type (read-only). Authorised override when permitted."
          icon={Banknote}
          accent="teal"
          collapsible
          defaultOpen
          columns={1}
        >
          <CommercialGstSupplyPanel
            value={gstSupply}
            onChange={setGstSupply}
            customerState={customer?.state}
            customerGstin={customer?.gstin ?? (customer as { gstin?: string } | undefined)?.gstin}
            shipToState={deliveryLocation || customer?.state}
            billToState={customer?.state}
            isServiceDocument={isServices}
          />
        </ErpCardSection>

        <ErpCardSection
          id="so-edit-section-commercial"
          title="Commercial Terms"
          subtitle="Payment, delivery terms, lead time, and internal notes."
          icon={Banknote}
          accent="green"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Payment Terms" dataField="paymentTerms" fieldError={validationErrors.paymentTerms}>
            <CommercialTermSelect termType="payment" value={paymentTerms} onChange={setPaymentTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms" dataField="deliveryTerms" fieldError={validationErrors.deliveryTerms}>
            <CommercialTermSelect termType="delivery" value={deliveryTerms} onChange={setDeliveryTerms} />
          </ErpFieldRow>
          <ErpFieldRow
            label="Delivery Time / Lead Time"
            dataField="deliveryTime"
            fieldError={validationErrors.deliveryTime}
          >
            <Select
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              error={Boolean(validationErrors.deliveryTime)}
            >
              <option value="">{SELECT_PLACEHOLDER}</option>
              {deliveryTimeOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </Select>
          </ErpFieldRow>
          <ErpFieldRow label="Internal Remarks" colSpan={2} horizontal={false}>
            <Textarea rows={3} value={internalRemarks} onChange={(e) => setInternalRemarks(e.target.value)} className="erp-input" />
          </ErpFieldRow>
        </ErpCardSection>
      </SalesCardFormShell>
    </>
  )
}
