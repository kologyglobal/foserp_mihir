import { useMemo, useState, useEffect } from 'react'
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
import { CrmFormSaveCommandBar } from '../../components/crm/CrmFormSaveCommandBar'
import { FactBoxPaneAiToggle } from '../../components/erp/card-form/FactBoxPaneAiToggle'
import {
  ENTERPRISE_FORM_CLASS,
  EnterpriseBusinessFactBox,
  EnterpriseFormContextPanel,
  EnterpriseFormMetrics,
  EnterpriseFormSectionNav,
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
import { Input, Textarea } from '../../components/forms/Inputs'
import { AppLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { useMrpStore } from '../../store/mrpStore'
import { useMasterStore } from '../../store/masterStore'
import { isApiMode } from '../../config/apiConfig'
import { apiUpdateSalesOrder } from '../../services/bridges/salesOrderApiBridge'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { formatStatus } from '../../components/ui/Badge'
import { LocationFieldRow } from '../../components/masters/LocationFieldRow'
import { useDocumentLocation } from '../../hooks/useDocumentLocation'
import { locationDisplayLabel } from '../../utils/locationUtils'
import { resolveSalesOrderValue } from '../../components/sales/SalesOrder360Sections'

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
  const products = useMasterStore((s) => s.products)
  const locations = useMasterStore((s) => s.locations)
  const [toast, setToast] = useState<string | null>(null)
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSection, setActiveSection] = useState('context')

  const [customerPoNumber, setCustomerPoNumber] = useState('')
  const [customerPoDate, setCustomerPoDate] = useState('')
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('')
  const [deliveryLocation, setDeliveryLocation] = useState('')
  const [paymentTerms, setPaymentTerms] = useState('')
  const [deliveryTerms, setDeliveryTerms] = useState('')
  const [internalRemarks, setInternalRemarks] = useState('')
  const { locationId, setLocationId } = useDocumentLocation('sales', so?.locationId)

  useEffect(() => {
    if (!so) return
    setCustomerPoNumber(so.customerPoNumber ?? '')
    setCustomerPoDate(so.customerPoDate?.slice(0, 10) ?? '')
    setExpectedDeliveryDate(so.expectedDeliveryDate?.slice(0, 10) ?? so.requiredDate?.slice(0, 10) ?? '')
    setDeliveryLocation(so.deliveryLocation ?? '')
    setPaymentTerms(so.paymentTerms?.trim() || '30% advance, balance before dispatch')
    setDeliveryTerms(so.deliveryTerms?.trim() || 'Ex-works Pune')
    setInternalRemarks(so.internalRemarks ?? '')
    if (so.locationId) setLocationId(so.locationId)
  }, [so, setLocationId])

  const customer = useMemo(
    () => (so ? customers.find((c) => c.id === so.customerId) : undefined),
    [so, customers],
  )
  const product = useMemo(
    () => (so ? products.find((p) => p.id === so.productId) : undefined),
    [so, products],
  )

  const displayValue = so ? resolveSalesOrderValue(so, product) : 0

  const poDone = Boolean(customerPoNumber.trim())
  const deliveryDone = Boolean(expectedDeliveryDate)
  const commercialDone = Boolean(paymentTerms.trim() && deliveryTerms.trim())

  const completionItems = useMemo(() => [
    { id: 'context', label: 'Order Context', done: Boolean(so?.customerId && so?.productId) },
    { id: 'po', label: 'PO & Delivery', done: poDone && deliveryDone },
    { id: 'commercial', label: 'Commercial', done: commercialDone },
  ], [so?.customerId, so?.productId, poDone, deliveryDone, commercialDone])

  const completionPercent = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100)

  const sectionNavItems = useMemo(() => [
    { id: 'context', label: 'Order Context', icon: Building2, done: completionItems.find((i) => i.id === 'context')?.done },
    { id: 'po', label: 'PO & Delivery', icon: MapPin, done: completionItems.find((i) => i.id === 'po')?.done },
    { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
  ], [completionItems])

  const formMetrics = useMemo(() => [
    { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
    { label: 'Customer', value: customer?.customerName?.slice(0, 20) ?? '—', accent: customer ? 'green' as const : 'amber' as const, hint: customer?.customerCode ?? 'Locked' },
    { label: 'Order Value', value: displayValue > 0 ? formatCurrency(displayValue) : '—', accent: 'violet' as const, hint: `${formatNumber(so?.qty ?? 0)} × ${product?.productName ?? 'Product'}` },
    { label: 'Delivery', value: expectedDeliveryDate ? formatDate(expectedDeliveryDate) : '—', accent: 'amber' as const, hint: so ? formatStatus(so.status === 'open' ? 'draft' : so.status) : 'Draft' },
  ], [completionPercent, completionItems, customer, displayValue, so, product, expectedDeliveryDate])

  const validationGuideItems = useMemo(
    () => validationErrors.map((err, i) => ({ id: `err-${i}`, label: err, message: err })),
    [validationErrors],
  )

  function scrollToSection(sectionId: string) {
    setActiveSection(sectionId)
    document.getElementById(`so-edit-section-${sectionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!id || !so) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">Sales order not found.</p>
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

  function validateDraft(): string[] {
    const errors: string[] = []
    if (!paymentTerms.trim()) errors.push('Payment terms are required.')
    if (!deliveryTerms.trim()) errors.push('Delivery terms are required.')
    if (expectedDeliveryDate && Number.isNaN(Date.parse(expectedDeliveryDate))) {
      errors.push('Expected delivery date is invalid.')
    }
    if (customerPoDate && Number.isNaN(Date.parse(customerPoDate))) {
      errors.push('Customer PO date is invalid.')
    }
    return errors
  }

  async function handleSave(mode: 'save' | 'close' = 'save') {
    const errors = validateDraft()
    setValidationErrors(errors)
    if (errors.length) return

    setIsSubmitting(true)
    const locLabel = locations.find((l) => l.id === locationId)
    const patch = {
      customerPoNumber: customerPoNumber.trim() || undefined,
      customerPoDate: customerPoDate || null,
      expectedDeliveryDate: expectedDeliveryDate || null,
      deliveryLocation: (locLabel ? locationDisplayLabel(locLabel) : deliveryLocation.trim()) || null,
      locationId: locationId || null,
      paymentTerms: paymentTerms.trim() || undefined,
      deliveryTerms: deliveryTerms.trim() || undefined,
      internalRemarks: internalRemarks.trim() || null,
      requiredDate: expectedDeliveryDate || draftSo.requiredDate,
    }
    const r = isApiMode()
      ? await apiUpdateSalesOrder(draftSo.id, patch)
      : updateDraft(draftSo.id, patch)
    setIsSubmitting(false)

    if (r.ok) {
      navigate(mode === 'close' ? listPath : detailPath)
      return
    }
    setToast(r.error ?? 'Save failed')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    void handleSave('save')
  }

  const documentStrip = [
    { label: 'SO No.', value: so.salesOrderNo, highlight: true },
    { label: 'Status', value: 'Draft' },
    { label: 'Customer', value: customer?.customerName ?? '—', highlight: Boolean(customer) },
    { label: 'Product', value: product?.productName ?? '—' },
    { label: 'Qty', value: formatNumber(so.qty) },
    { label: 'Order Value', value: displayValue > 0 ? formatCurrency(displayValue) : '—', highlight: displayValue > 0 },
    { label: 'Customer PO', value: customerPoNumber.trim() || '—' },
    { label: 'Quotation', value: so.quotationNo ? `${so.quotationNo} Rev ${so.quotationRevisionNo ?? 1}` : '—' },
  ]

  const commandBar = (
    <CrmFormSaveCommandBar
      isSubmitting={isSubmitting}
      onSave={() => void handleSave('save')}
      onSaveAndClose={() => void handleSave('close')}
      onCancel={() => navigate(detailPath)}
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
          { label: 'Product', value: product?.productName ?? '—' },
          { label: 'Qty', value: formatNumber(so.qty) },
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
          Quotation <strong className="text-erp-text">{so.quotationNo}</strong> Rev {so.quotationRevisionNo ?? 1} is locked for this draft.
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
        className={ENTERPRISE_FORM_CLASS}
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
        validationItems={validationGuideItems.length ? validationGuideItems : undefined}
        validationErrors={validationGuideItems.length ? undefined : validationErrors}
        factBox={factBox}
        collapsibleFactBox
        factBoxLabel="Details"
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
                {completionPercent}% complete · Customer and product lines are locked on draft edit
              </span>
            )}
          />
        )}
      >
        <EnterpriseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={scrollToSection}
          trailing={<FactBoxPaneAiToggle />}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        <ErpCardSection
          id="so-edit-section-context"
          title="Order Context"
          subtitle="Customer, product, and quotation reference (read-only)."
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
          <ErpFieldRow label="Product" readOnly>
            <Input value={product?.productName ?? so.productId} readOnly className="erp-input" />
          </ErpFieldRow>
          <ErpFieldRow label="Quantity" readOnly>
            <Input value={formatNumber(so.qty)} readOnly className="erp-input" />
          </ErpFieldRow>
          <ErpFieldRow label="Order Value" readOnly>
            <Input value={formatCurrency(displayValue)} readOnly className="erp-input" />
          </ErpFieldRow>
          {so.quotationNo ? (
            <ErpFieldRow label="Quotation Reference" readOnly colSpan={2}>
              <Input value={`${so.quotationNo} · Rev ${so.quotationRevisionNo ?? 1}`} readOnly className="erp-input" />
            </ErpFieldRow>
          ) : null}
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
        </ErpCardSection>

        <ErpCardSection
          id="so-edit-section-commercial"
          title="Commercial Terms"
          subtitle="Payment, delivery terms, and internal notes."
          icon={Banknote}
          accent="green"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="Payment Terms" required>
            <CommercialTermSelect termType="payment" value={paymentTerms} onChange={setPaymentTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Delivery Terms" required>
            <CommercialTermSelect termType="delivery" value={deliveryTerms} onChange={setDeliveryTerms} />
          </ErpFieldRow>
          <ErpFieldRow label="Internal Remarks" colSpan={2} horizontal={false}>
            <Textarea rows={3} value={internalRemarks} onChange={(e) => setInternalRemarks(e.target.value)} className="erp-input" />
          </ErpFieldRow>
        </ErpCardSection>
      </SalesCardFormShell>

      {toast ? <Toast message={toast} variant="error" /> : null}
    </>
  )
}
