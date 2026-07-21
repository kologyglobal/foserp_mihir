import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  Banknote,
  ClipboardList,
  Package,
  Save,
  Truck,
  X,
} from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpStickySaveBar,
  ErpQuickEntrySection,
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  useErpAdditionalInfo,
} from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useActiveWarehouses, useActiveLocations } from '../../hooks/useMasterLists'
import {
  filterLocationsByUsage,
  getDefaultLocation,
  locationDisplayLabel,
} from '../../utils/locationUtils'
import type { PurchaseRequisition } from '../../types/purchase'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { canPermission, getSessionUser } from '../../utils/permissions'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDataTable,
  PurchaseTableToolbar,
  purchaseReadonlyValue,
} from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseEnterpriseFactBox,
  PurchaseFormSectionNav,
  purchaseSectionId,
  scrollToPurchaseSection,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import { PurchaseCommercialTermField } from '@/components/purchase/PurchaseCommercialTermField'
import { useDeliveryTermOptions, usePaymentTermOptions } from '../../hooks/usePurchaseMasters'
import { PrLineItemsGrid, type PrLineRow } from '@/components/purchase/PrLineItemsGrid'
import { VendorLookupSelect } from '../../components/lookups/VendorLookupSelect'

type PoCreateMode = 'manual' | 'pr'

function openPrLines(pr: PurchaseRequisition, purchaseOrders: ReturnType<typeof usePurchaseStore.getState>['purchaseOrders']) {
  const converted = new Set(
    purchaseOrders
      .filter((po) => po.prId === pr.id)
      .flatMap((po) => po.lines.map((l) => l.prLineId))
      .filter(Boolean) as string[],
  )
  return pr.lines.filter((l) => !converted.has(l.id))
}

export function PoCreateDocumentPage() {
  const navigate = useNavigate()
  const session = getSessionUser()
  const [searchParams] = useSearchParams()
  const initialPrId = searchParams.get('prId') ?? ''
  const initialVendorId = searchParams.get('vendorId') ?? ''
  const initialMode: PoCreateMode = initialPrId || searchParams.get('mode') === 'pr' ? 'pr' : 'manual'

  const requisitions = usePurchaseStore((s) => s.requisitions)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const createPoFromPr = usePurchaseStore((s) => s.createPoFromPr)
  const createManualPo = usePurchaseStore((s) => s.createManualPo)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const getVendor = useMasterStore((s) => s.getVendor)
  const getVendorMapsForItem = useMasterStore((s) => s.getVendorMapsForItem)
  const warehouses = useActiveWarehouses()
  const allLocations = useActiveLocations()
  const purchaseLocations = useMemo(() => filterLocationsByUsage(allLocations, 'purchase'), [allLocations])
  const defaultPurchaseLocation = useMemo(() => getDefaultLocation(purchaseLocations), [purchaseLocations])

  const paymentTermOptions = usePaymentTermOptions()
  const deliveryTermOptions = useDeliveryTermOptions()

  const defaultRequiredDate = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)

  const [mode, setMode] = useState<PoCreateMode>(initialMode)
  const [prId, setPrId] = useState(initialPrId)
  const [vendorId, setVendorId] = useState(initialVendorId)
  const [paymentTerms, setPaymentTerms] = useState(() => paymentTermOptions[0]?.text ?? 'Net 30 Days')
  const [deliveryTerms, setDeliveryTerms] = useState(() => deliveryTermOptions[0]?.label ?? 'Ex Works')
  const [activeSection, setActiveSection] = useState('quick')
  const [toast, setToast] = useState<string | null>(null)
  const {
    open: showAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo()
  const [manualLines, setManualLines] = useState<PrLineRow[]>(() => [
    {
      key: crypto.randomUUID(),
      itemId: '',
      locationId: defaultPurchaseLocation?.id ?? '',
      warehouseId: defaultPurchaseLocation?.warehouseId ?? warehouses[0]?.id ?? '',
      vendorId: '',
      qty: '1',
      rate: '0',
      requiredDate: defaultRequiredDate,
      remarks: '',
    },
  ])

  const eligiblePrs = useMemo(
    () =>
      requisitions.filter((p) => {
        if (p.status !== 'approved' && p.status !== 'converted') return false
        return openPrLines(p, purchaseOrders).length > 0
      }),
    [requisitions, purchaseOrders],
  )

  const pr = useMemo(() => eligiblePrs.find((p) => p.id === prId), [eligiblePrs, prId])
  const openLines = useMemo(() => (pr ? openPrLines(pr, purchaseOrders) : []), [pr, purchaseOrders])

  const prOptions = useMemo(
    () =>
      eligiblePrs.map((p) => {
        const open = openPrLines(p, purchaseOrders)
        return {
          value: p.id,
          label: `${p.prNo} — ${open.length} open line${open.length === 1 ? '' : 's'}`,
          searchText: `${p.prNo} ${p.source}`.toLowerCase(),
        }
      }),
    [eligiblePrs, purchaseOrders],
  )

  const poPreview = useMemo(() => {
    if (mode !== 'pr' || !pr || !vendorId) return []
    return openLines
      .filter((l) => getVendorMapsForItem(l.itemId).some((m) => m.vendorId === vendorId))
      .map((l) => {
        const item = getItem(l.itemId)
        const vm = getVendorMapsForItem(l.itemId).find((m) => m.vendorId === vendorId)
        const rate = vm?.lastRate ?? item?.standardRate ?? 0
        return { line: l, item, rate, amount: l.qty * rate }
      })
  }, [mode, pr, vendorId, openLines, getItem, getVendorMapsForItem])

  const prVendorIds = useMemo(
    () =>
      [...new Set(
        openLines.flatMap((l) => getVendorMapsForItem(l.itemId).map((m) => m.vendorId)),
      )],
    [openLines, getVendorMapsForItem],
  )

  const stockByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of useInventoryStore.getState().getStockPositions()) {
      m.set(p.itemId, (m.get(p.itemId) ?? 0) + p.freeQty)
    }
    return m
  }, [manualLines])

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.warehouseName, searchText: w.warehouseName.toLowerCase() })),
    [warehouses],
  )

  const locationOptions = useMemo(
    () =>
      purchaseLocations.map((loc) => ({
        value: loc.id,
        label: locationDisplayLabel(loc),
        searchText: `${loc.locationCode} ${loc.locationName}`.toLowerCase(),
      })),
    [purchaseLocations],
  )

  const manualTotalAmount = manualLines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)
  const manualValidLines = manualLines.filter((l) => l.itemId && l.warehouseId && Number(l.qty) > 0)

  const totalAmount = mode === 'manual' ? manualTotalAmount : poPreview.reduce((s, r) => s + r.amount, 0)
  const totalQty = mode === 'manual'
    ? manualLines.reduce((s, l) => s + (Number(l.qty) || 0), 0)
    : poPreview.reduce((s, r) => s + r.line.qty, 0)

  const canCreate =
    mode === 'manual'
      ? Boolean(vendorId) && manualValidLines.length > 0
      : Boolean(prId && vendorId && poPreview.length > 0)

  const completionItems = useMemo(
    () => [
      {
        id: 'lines',
        label: 'Lines',
        done: mode === 'manual' ? manualValidLines.length > 0 : Boolean(prId && openLines.length > 0),
      },
      { id: 'vendor', label: 'Vendor', done: Boolean(vendorId) },
      { id: 'commercial', label: 'Commercial', done: Boolean(paymentTerms && deliveryTerms) },
    ],
    [mode, manualValidLines.length, prId, openLines.length, vendorId, paymentTerms, deliveryTerms],
  )

  const completionPercent = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100,
  )

  const sectionNavItems = useMemo(
    () => [
      { id: 'quick', label: 'Quick Entry', icon: ClipboardList, done: completionItems.find((i) => i.id === 'lines')?.done && completionItems.find((i) => i.id === 'vendor')?.done },
      { id: 'lines', label: 'Lines', icon: Package, done: completionItems.find((i) => i.id === 'lines')?.done },
      { id: 'vendor', label: 'Vendor', icon: Truck, done: completionItems.find((i) => i.id === 'vendor')?.done },
      { id: 'commercial', label: 'Commercial', icon: Banknote, done: completionItems.find((i) => i.id === 'commercial')?.done },
    ],
    [completionItems],
  )

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function switchMode(next: PoCreateMode) {
    setMode(next)
    if (next === 'manual') setPrId('')
    else setVendorId('')
  }

  function handleCreate() {
    if (!canPermission('purchase', 'create')) {
      show('You do not have permission to create purchase orders')
      return
    }

    if (mode === 'manual') {
      if (!vendorId) {
        show('Select a vendor')
        scrollToPurchaseSection('vendor', setActiveSection)
        return
      }
      if (manualValidLines.length === 0) {
        show('Add at least one line with item, warehouse, and quantity')
        scrollToPurchaseSection('lines', setActiveSection)
        return
      }
      const r = createManualPo({
        vendorId,
        paymentTerms,
        lines: manualValidLines.map((l) => ({
          itemId: l.itemId,
          warehouseId: l.warehouseId,
          qty: Number(l.qty),
          rate: Number(l.rate) || 0,
          requiredDate: l.requiredDate || defaultRequiredDate,
        })),
      })
      if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`)
      else show(r.error ?? 'Failed to create PO')
      return
    }

    if (!prId) {
      show('Select an approved purchase requisition')
      scrollToPurchaseSection('lines', setActiveSection)
      return
    }
    if (!vendorId) {
      show('Select a vendor')
      scrollToPurchaseSection('vendor', setActiveSection)
      return
    }
    const r = createPoFromPr(prId, vendorId, undefined, paymentTerms)
    if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`)
    else show(r.error ?? 'Failed to create PO')
  }

  const createLabel = mode === 'manual' ? 'Create PO' : 'Create Direct PO'

  const documentStrip = [
    { label: 'Document', value: 'New PO', highlight: true },
    { label: 'Source', value: mode === 'manual' ? 'Manual' : 'From PR' },
    { label: 'PR Ref', value: mode === 'pr' ? (pr?.prNo ?? '—') : '—' },
    { label: 'Vendor', value: vendorId ? getVendor(vendorId)?.vendorName ?? '—' : '—', highlight: Boolean(vendorId) },
    { label: 'Lines', value: String(mode === 'manual' ? manualValidLines.length : poPreview.length) },
    { label: 'Amount', value: formatCurrency(totalAmount), highlight: totalAmount > 0 },
    { label: 'Buyer', value: session.name },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'create', label: createLabel, icon: Save, onClick: handleCreate, primary: true, disabled: !canCreate },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate('/purchase/orders') },
      ]}
      moreActions={[
        { id: 'browse-pr', label: 'Browse Requisitions', icon: ClipboardList, onClick: () => navigate('/purchase/requisitions') },
      ]}
    />
  )

  const formMetrics = useMemo(
    () => [
      { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const, hint: `${completionItems.filter((i) => i.done).length} of ${completionItems.length} sections` },
      { label: 'PO Lines', value: String(mode === 'manual' ? manualValidLines.length : poPreview.length), accent: 'green' as const },
      { label: 'Total Qty', value: formatNumber(totalQty), accent: 'slate' as const },
      { label: 'Est. Value', value: formatCurrency(totalAmount), accent: 'amber' as const, highlight: totalAmount > 0 },
    ],
    [completionPercent, completionItems, mode, manualValidLines.length, poPreview.length, totalQty, totalAmount],
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      metrics={formMetrics}
      summary={[
        { label: 'Source', value: mode === 'manual' ? 'Manual PO' : 'From PR' },
        { label: 'PR', value: pr ? <TableLink to={`/purchase/requisitions/${pr.id}`}>{pr.prNo}</TableLink> : '—' },
        { label: 'Vendor', value: vendorId ? getVendor(vendorId)?.vendorName ?? '—' : '—', highlight: Boolean(vendorId) },
        { label: 'Payment', value: paymentTerms },
        { label: 'Delivery', value: deliveryTerms },
        { label: 'Amount', value: formatCurrency(totalAmount), highlight: true },
      ]}
      actions={[
        { id: 'create', label: createLabel, icon: Save, primary: true, onClick: handleCreate, disabled: !canCreate },
        { id: 'pr-list', label: 'Browse PRs', icon: ClipboardList, onClick: () => navigate('/purchase/requisitions') },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate('/purchase/orders') },
      ]}
    />
  )

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      submitLabel={createLabel}
      cancelTo="/purchase/orders"
      onSave={handleCreate}
      onSaveAndClose={() => navigate('/purchase/orders')}
      hint={(
        <span className="text-[12px] text-erp-muted">
          {completionPercent}% complete · {mode === 'manual' ? 'Manual PO — no PR/RFQ required' : 'Direct PO from approved requisition'}
        </span>
      )}
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate('/purchase/orders')}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="primary" icon={Truck} disabled={!canCreate} onClick={handleCreate}>
            {createLabel}
          </ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title="New Purchase Order"
        description={
          mode === 'manual'
            ? 'Create a PO with line items — no requisition or RFQ required'
            : 'Create a PO from an approved requisition without RFQ'
        }
        recordNo="New"
        recordTitle="Purchase Order"
        status="Draft"
        statusTone="neutral"
        owner={session.name}
        createdDate={formatDate(new Date().toISOString())}
        createdBy={session.name}
        favoritePath="/purchase/orders/new"
        breadcrumbs={[
          { label: 'Orders', to: '/purchase/orders' },
          { label: 'New PO' },
        ]}
        commandBar={commandBar}
        documentStrip={documentStrip}
        className="enterprise-workspace--crm-smart-overview"
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        stickyFooter={false}
      >
        <PurchaseFormSectionNav
          sections={sectionNavItems}
          activeId={activeSection}
          onSelect={setActiveSection}
        />

        <div id={purchaseSectionId('quick')}>
          <ErpQuickEntrySection
            id={purchaseSectionId('quick-fields')}
            subtitle="Choose source, vendor, and essentials — expand Additional Information for commercial terms."
          >
            <ErpFieldRow label="Create from" colSpan={2}>
              <div className="flex flex-wrap gap-2">
                <ErpButton
                  type="button"
                  size="sm"
                  variant={mode === 'manual' ? 'primary' : 'secondary'}
                  onClick={() => switchMode('manual')}
                >
                  Manual PO
                </ErpButton>
                <ErpButton
                  type="button"
                  size="sm"
                  variant={mode === 'pr' ? 'primary' : 'secondary'}
                  onClick={() => switchMode('pr')}
                >
                  From PR
                </ErpButton>
              </div>
            </ErpFieldRow>
            {mode === 'pr' ? (
              <ErpFieldRow label="PR reference" required>
                <ErpSmartSelect
                  className="erp-input"
                  options={prOptions}
                  value={prId}
                  onChange={(v) => {
                    setPrId(v || '')
                    setVendorId('')
                  }}
                  allowEmpty
                  placeholder="Select approved PR…"
                />
              </ErpFieldRow>
            ) : null}
            <ErpFieldRow label="Vendor" required>
              <VendorLookupSelect
                className="erp-input"
                value={vendorId}
                onChange={(sel) => setVendorId(sel?.vendorId ?? '')}
                allowEmpty
                restrictToIds={mode === 'pr' ? prVendorIds : undefined}
                placeholder={mode === 'manual' ? 'Select vendor…' : pr ? 'Select vendor…' : 'Select PR first'}
                disabled={mode === 'pr' && !pr}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Est. Value" readOnly>
              {purchaseReadonlyValue(formatCurrency(totalAmount))}
            </ErpFieldRow>
          </ErpQuickEntrySection>
        </div>

        <ErpCardSection
          id={purchaseSectionId('lines')}
          title="Line items"
          subtitle="Manual entry or lines from the selected requisition"
          icon={Package}
          accent="blue"
          collapsible
          defaultOpen
        >
          {mode === 'manual' ? (
            <div className="col-span-2">
              <PrLineItemsGrid
                lines={manualLines}
                onChange={setManualLines}
                locationOptions={locationOptions}
                warehouseOptions={warehouseOptions}
                stockByItem={stockByItem}
                compact
              />
            </div>
          ) : (
            <>
              {!pr && eligiblePrs.length === 0 ? (
                <p className="col-span-2 text-sm text-erp-muted">
                  No approved PRs with open lines. Switch to <strong>Manual PO</strong> or{' '}
                  <Link to="/purchase/requisitions" className="font-medium text-erp-primary hover:underline">
                    open requisitions
                  </Link>
                  .
                </p>
              ) : null}
              {pr ? (
                <>
                  <PurchaseTableToolbar>
                    <span>
                      From <strong>{pr.prNo}</strong> · {openLines.length} open line(s)
                    </span>
                  </PurchaseTableToolbar>
                  <div className="col-span-2">
                    <PurchaseDataTable>
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>Item</th>
                          <th>Description</th>
                          <th className="text-right">Qty</th>
                          <th>Warehouse</th>
                          <th>Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {openLines.map((l, i) => {
                          const item = getItem(l.itemId)
                          return (
                            <tr key={l.id}>
                              <td>{i + 1}</td>
                              <td className="font-mono">{item?.itemCode}</td>
                              <td>{item?.itemName}</td>
                              <td className="text-right tabular-nums">{formatNumber(l.qty)}</td>
                              <td>{getWarehouse(l.warehouseId)?.warehouseCode}</td>
                              <td>{formatDate(l.requiredDate)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </PurchaseDataTable>
                  </div>
                </>
              ) : (
                <p className="col-span-2 text-sm text-erp-muted">Select a purchase requisition above to preview lines.</p>
              )}
            </>
          )}
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('vendor')}
          title="Vendor details"
          subtitle={mode === 'manual' ? 'Supplier for this purchase order' : 'Supplier mapped to PR items'}
          icon={Truck}
          accent="green"
          collapsible
          defaultOpen={false}
        >
          {mode === 'pr' && pr && prVendorIds.length === 0 ? (
            <p className="col-span-2 text-sm text-amber-700">
              No vendors mapped to open PR items. Update vendor–item maps in masters.
            </p>
          ) : null}
          {mode === 'pr' && vendorId && poPreview.length > 0 ? (
            <ErpFieldRow label="Lines for vendor" readOnly>
              {purchaseReadonlyValue(`${poPreview.length} of ${openLines.length}`)}
            </ErpFieldRow>
          ) : (
            <p className="col-span-2 text-sm text-erp-muted">Vendor is set in Quick Entry. Use this section for mapping notes.</p>
          )}
        </ErpCardSection>

        <ErpAdditionalInfoToggle
          open={showAdditionalDetails}
          onToggle={toggleAdditionalDetails}
          panelId={additionalPanelId}
          sectionCount={1}
          summary="Payment, delivery, and currency"
        />
        <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
          <ErpCardSection
            id={purchaseSectionId('commercial')}
            title="Commercial terms"
            subtitle="Payment and delivery terms from purchase masters"
            icon={Banknote}
            accent="amber"
            collapsible
            defaultOpen
          >
            <ErpFieldRow label="Payment terms">
              <PurchaseCommercialTermField kind="payment-terms" label="Payment Terms" value={paymentTerms} onChange={setPaymentTerms} />
            </ErpFieldRow>
            <ErpFieldRow label="Delivery terms">
              <PurchaseCommercialTermField kind="delivery-terms" label="Delivery Terms" value={deliveryTerms} onChange={setDeliveryTerms} />
            </ErpFieldRow>
            <ErpFieldRow label="Currency" readOnly>
              {purchaseReadonlyValue('INR')}
            </ErpFieldRow>
            <ErpFieldRow label="Estimated PO value" readOnly>
              {purchaseReadonlyValue(formatCurrency(totalAmount))}
            </ErpFieldRow>
          </ErpCardSection>
        </ErpAdditionalInfoPanel>
      </PurchaseCardFormShell>
    </>
  )
}
