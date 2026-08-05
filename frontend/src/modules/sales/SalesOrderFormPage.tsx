import { useMemo, useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  Building2,
  ClipboardList,
  FileText,
  MapPin,
  Package,
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
import { apiFetchSalesOrder, apiUpdateSalesOrder } from '../../services/bridges/salesOrderApiBridge'
import { SalesOrderLinesEditor } from '../../components/sales/SalesOrderLinesEditor'
import {
  computeSoLineTotals,
  soLineDraftsFromOrder,
  soLineDraftsToApiPayload,
  type SoLineDraft,
} from '../../utils/salesOrderLineDraft'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { formatStatus } from '../../components/ui/Badge'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { locationDisplayLabel } from '../../utils/locationUtils'
import { resolveSalesOrderValue } from '../../components/sales/SalesOrder360Sections'
import { useTenantProfileStore } from '../../store/tenantProfileStore'
import { quotationNoWithRevision } from '../../utils/quotationEngine/revisionLabels'

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
  const getItem = useMasterStore((s) => s.getItem)
  const locations = useMasterStore((s) => s.locations)
  const [validationErrors, setValidationErrors] = useState<FieldErrorMap>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hydrated, setHydrated] = useState(!isApiMode())
  const [lines, setLines] = useState<SoLineDraft[]>([])

  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [customerPoDate, setCustomerPoDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [internalRemarks, setInternalRemarks] = useState('')
  const deliveryTimeOptions = useDeliveryTimeOptions()
  const { locationId, setLocationId } = useDocumentLocation('sales', so?.locationId)
  const showLocationField = !useTenantProfileStore((s) => s.isServices())

  useEffect(() => {
    if (!id || !isApiMode()) return
    void apiFetchSalesOrder(id).then((r) => {
      if (r.ok) setHydrated(true)
      else notify.error(r.error ?? 'Failed to load sales order')
    })
  }, [id])

  useEffect(() => {
    if (!so) return
    setLines(soLineDraftsFromOrder(so))
  }, [so?.id])

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
  }, [so, setLocationId])

  const customer = useMemo(
    () => (so ? customers.find((c) => c.id === so.customerId) : undefined),
    [so, customers],
  )
  const lineSummary = useMemo(() => {
    const totals = lines.map((line) => computeSoLineTotals(line))
    const totalQty = lines.reduce((s, l) => s + l.qty, 0)
    const grandTotal = totals.reduce((s, t) => s + t.lineTotal, 0)
    return { totalQty, grandTotal }
  }, [lines])

  const displayValue = so
    ? (lineSummary.grandTotal > 0 ? lineSummary.grandTotal : resolveSalesOrderValue(so))
    : 0

  const primaryItemName = lines[0]?.itemId ? getItem(lines[0].itemId)?.itemName : undefined
  const lineItemsLabel = lines.length > 1
    ? `${lines.length} lines`
    : (primaryItemName ?? '—')

  const linesDone = lines.length > 0
    && lines.every((l) => l.itemId && l.qty >= 1 && l.unitPrice > 0)

  const poDone = Boolean(customerPoNumber.trim())
  const deliveryDone = Boolean(expectedDeliveryDate)
  const commercialDone = Boolean(paymentTerms.trim() && deliveryTerms.trim() && deliveryTime.trim())

  const completionItems = useMemo(() => [
    { id: 'context', label: 'Order Context', done: Boolean(so?.customerId) },
    { id: 'lines', label: 'Line Items', done: linesDone },
    { id: 'po', label: 'PO & Delivery', done: poDone && deliveryDone },
    { id: 'commercial', label: 'Commercial', done: commercialDone },
  ], [so?.customerId, linesDone, poDone, deliveryDone, commercialDone])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  if (!id || !so || (isApiMode() && !hydrated)) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">{!so && hydrated ? 'Sales order not found.' : 'Loading sales order…'}</p>
        {(!so && hydrated) || !isApiMode() ? (
          <AppLink to={listPath} className="text-sm font-semibold text-erp-primary">
            Back to {fromCrm ? 'CRM sales orders' : 'sales orders'}
          </AppLink>
        ) : null}
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
    const errors = validateSalesOrderDraft({
      paymentTerms,
      deliveryTerms,
      deliveryTime,
      expectedDeliveryDate,
      customerPoDate,
    }).fieldErrors
    if (!lines.length) {
      errors.lines = 'Add at least one item line.'
    } else if (lines.some((l) => !l.itemId)) {
      errors.lines = 'Every line needs an item.'
    } else if (lines.some((l) => !l.qty || l.qty < 1)) {
      errors.lines = 'Line quantities must be at least 1.'
    } else if (lines.some((l) => l.unitPrice <= 0)) {
      errors.lines = 'Line unit prices must be greater than zero.'
    }
    return errors
  }

  async function handleSave(mode: 'save' | 'close' = 'save') {
    const errors = validateDraft()
    if (Object.keys(errors).length) {
      handleInvalidSubmit({
        errors,
        fieldOrder: ['lines', 'paymentTerms', 'deliveryTerms', 'deliveryTime', 'expectedDeliveryDate', 'customerPoDate'],
        onFieldErrors: setValidationErrors,
      })
      return
    }
    setValidationErrors({})

    setIsSubmitting(true)
    const locLabel = locations.find((l) => l.id === locationId)
    const primary = lines[0]
    const linePayload = soLineDraftsToApiPayload(lines, (itemId) => getItem(itemId)?.itemName)
    const patch = {
      itemId: primary?.itemId,
      qty: lines.reduce((s, l) => s + l.qty, 0),
      unitPrice: primary?.unitPrice,
      lines: linePayload,
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
    }
    const r = isApiMode()
      ? await apiUpdateSalesOrder(draftSo.id, patch)
      : updateDraft(draftSo.id, patch)
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
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Line items', value: lineItemsLabel },
    { label: 'Qty', value: formatNumber(lineSummary.totalQty || so.qty) },
    { label: 'Order Value', value: displayValue > 0 ? formatCurrency(displayValue) : '—', highlight: displayValue > 0 },
    { label: 'Customer PO', value: customerPoNumber.trim() || '—' },
    {
      label: 'Quotation Number (Reference)',
      value: so.quotationNo ? `${so.quotationNo} Rev ${so.quotationRevisionNo ?? 1}` : '—',
    },
  ]

  /** Secondary nav only — Save / Cancel live in the sticky footer (same as New Lead). */
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
          value: !poDone ? 'Enter customer PO' : !commercialDone ? 'Set commercial terms' : 'Save and confirm order',
          tone: 'info' as const,
        },
      ]}
    >
      <EnterpriseFormContextPanel
        summaryTitle="Draft Summary"
        actionsTitle="Quick Actions"
        summary={[
          { label: 'Customer', value: customer?.customerName ?? '—' },
          { label: 'Line items', value: lineItemsLabel },
          { label: 'Qty', value: formatNumber(lineSummary.totalQty || so.qty) },
          { label: 'Value', value: formatCurrency(displayValue), highlight: true },
          { label: 'Customer PO', value: customerPoNumber.trim() || '—' },
          { label: 'Delivery', value: expectedDeliveryDate ? formatDate(expectedDeliveryDate) : '—' },
          { label: 'Payment', value: paymentTerms.trim() || '—' },
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
                {completionPercent}% complete · Edit lines, PO, and commercial terms
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
            <Input value={customer?.customerName ?? '—'} readOnly className="erp-input" />
          </ErpFieldRow>
          {so.quotationNo ? (
            <ErpFieldRow label="Quotation Number (Reference)" readOnly colSpan={2}>
              <Input value={`${so.quotationNo} · Rev ${so.quotationRevisionNo ?? 1}`} readOnly className="erp-input" />
            </ErpFieldRow>
          ) : null}
        </ErpCardSection>

        <ErpCardSection
          id="so-edit-section-lines"
          title="Line Items"
          subtitle="Products, quantities, pricing, and GST."
          icon={Package}
          accent="violet"
          collapsible
          defaultOpen
        >
          {validationErrors.lines ? (
            <p className="mb-3 text-sm text-red-600">{validationErrors.lines}</p>
          ) : null}
          <SalesOrderLinesEditor lines={lines} onChange={setLines} />
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
              hint="Fulfilment location from Lead → Opportunity → Quotation chain"
            />
          ) : null}
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
