import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Banknote,
  ClipboardList,
  FileText,
  Package,
  Save,
  Truck,
  Users,
  X,
} from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpStickySaveBar,
  ErpQuickEntrySection,
  ErpAdditionalInfoToggle,
  ErpAdditionalInfoPanel,
  ErpViewField,
  useErpAdditionalInfo,
} from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { Checkbox } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { CrmSmartOverviewPanel } from '@/components/crm/CrmSmartOverviewPanel'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useInventoryStore } from '../../store/inventoryStore'
import { useMasterStore } from '../../store/masterStore'
import { useActiveVendors, useActiveWarehouses, useActiveLocations } from '../../hooks/useMasterLists'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { canPermission, getSessionUser } from '../../utils/permissions'
import {
  filterLocationsByUsage,
  findLocationForWarehouse,
  locationDisplayLabel,
} from '../../utils/locationUtils'
import { PrLineItemsGrid, type PrLineRow } from '@/components/purchase/PrLineItemsGrid'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDataTable,
  PurchaseTableToolbar,
} from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseFormSectionNav,
  purchaseSectionId,
  purchaseStatusStripToDocumentStrip,
  scrollToPurchaseSection,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import { EnterpriseFormMetrics } from '../../design-system/workspace'

export function RfqCreateDocumentPage() {
  const navigate = useNavigate()
  const session = getSessionUser()
  const [searchParams] = useSearchParams()
  const initialPrId = searchParams.get('prId') ?? ''

  const requisitions = usePurchaseStore((s) => s.requisitions)
  const rfqs = usePurchaseStore((s) => s.rfqs)
  const createRfqFromPr = usePurchaseStore((s) => s.createRfqFromPr)
  const getItem = useMasterStore((s) => s.getItem)
  const getVendorMapsForItem = useMasterStore((s) => s.getVendorMapsForItem)
  const uoms = useMasterStore((s) => s.uoms)
  const vendors = useActiveVendors()
  const warehouses = useActiveWarehouses()
  const allLocations = useActiveLocations()
  const purchaseLocations = useMemo(() => filterLocationsByUsage(allLocations, 'purchase'), [allLocations])

  const [prId, setPrId] = useState(initialPrId)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState('quick')
  const {
    open: showAdditionalDetails,
    toggle: toggleAdditionalDetails,
    panelId: additionalPanelId,
  } = useErpAdditionalInfo()
  const [toast, setToast] = useState<string | null>(null)

  const approvedPrs = useMemo(
    () =>
      requisitions.filter((p) => {
        if (p.status !== 'approved') return false
        return !rfqs.some((r) => r.prId === p.id && r.status !== 'cancelled')
      }),
    [requisitions, rfqs],
  )

  const pr = useMemo(() => approvedPrs.find((p) => p.id === prId), [approvedPrs, prId])

  const prOptions = useMemo(
    () =>
      approvedPrs.map((p) => ({
        value: p.id,
        label: `${p.prNo} — ${p.lines.length} line${p.lines.length === 1 ? '' : 's'}`,
        searchText: `${p.prNo} ${p.source}`.toLowerCase(),
      })),
    [approvedPrs],
  )

  const warehouseOptions = useMemo(
    () => warehouses.map((w) => ({ value: w.id, label: w.warehouseName, searchText: w.warehouseName.toLowerCase() })),
    [warehouses],
  )

  const locationOptions = useMemo(
    () =>
      purchaseLocations.map((loc) => ({
        value: loc.id,
        label: locationDisplayLabel(loc),
        searchText: `${loc.locationCode} ${loc.locationName} ${loc.city}`.toLowerCase(),
      })),
    [purchaseLocations],
  )

  const gridLines = useMemo<PrLineRow[]>(() => {
    if (!pr) return []
    return pr.lines.map((l) => {
      const item = getItem(l.itemId)
      const uom = uoms.find((u) => u.id === item?.baseUomId)
      const locationId = findLocationForWarehouse(l.warehouseId, allLocations)?.id ?? ''
      return {
        key: l.id,
        itemId: l.itemId,
        itemCode: item?.itemCode,
        itemName: item?.itemName,
        uomId: item?.baseUomId,
        uomName: uom?.uomCode,
        locationId,
        warehouseId: l.warehouseId,
        vendorId: '',
        qty: String(l.qty),
        rate: String(item?.standardRate ?? 0),
        requiredDate: l.requiredDate,
        remarks: l.remarks ?? '',
      }
    })
  }, [pr, getItem, uoms, allLocations])

  const stockByItem = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of useInventoryStore.getState().getStockPositions()) {
      m.set(p.itemId, (m.get(p.itemId) ?? 0) + p.freeQty)
    }
    return m
  }, [gridLines])

  const totalQty = pr?.lines.reduce((s, l) => s + l.qty, 0) ?? 0
  const canCreate = Boolean(prId && selectedVendors.length >= 2)
  const hasPr = Boolean(prId && pr)

  const completionItems = useMemo(
    () => [
      { id: 'lines', label: 'Lines', done: hasPr },
      { id: 'vendors', label: 'Vendors', done: selectedVendors.length >= 2 },
      { id: 'terms', label: 'Terms', done: true },
    ],
    [hasPr, selectedVendors.length],
  )

  const completionPercent = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100,
  )

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function goToSection(id: string) {
    setActiveSection(id)
    scrollToPurchaseSection(id, setActiveSection)
  }

  function toggleVendor(vid: string) {
    setSelectedVendors((prev) => (prev.includes(vid) ? prev.filter((id) => id !== vid) : [...prev, vid]))
  }

  function handleCreate() {
    if (!canPermission('purchase', 'create')) {
      show('You do not have permission to create RFQs')
      return
    }
    if (!prId) {
      show('Select an approved purchase requisition')
      goToSection('lines')
      return
    }
    if (selectedVendors.length < 2) {
      show('Select at least 2 vendors for comparison')
      goToSection('vendors')
      return
    }
    const r = createRfqFromPr(prId, selectedVendors)
    if (r.ok && r.rfqId) navigate(`/purchase/rfqs/${r.rfqId}`)
    else show(r.error ?? 'Failed to create RFQ')
  }

  const statusStrip = [
    { label: 'Document', value: 'New RFQ', tone: 'info' as const },
    { label: 'PR Ref', value: pr?.prNo ?? '—', tone: 'neutral' as const },
    { label: 'Lines', value: pr ? String(pr.lines.length) : '—', tone: 'neutral' as const },
    { label: 'Total Qty', value: pr ? formatNumber(totalQty) : '—', tone: 'neutral' as const },
    {
      label: 'Vendors',
      value: String(selectedVendors.length),
      tone: selectedVendors.length >= 2 ? ('success' as const) : ('warning' as const),
    },
    { label: 'Buyer', value: session.name, tone: 'neutral' as const },
  ]

  const formMetrics = useMemo(
    () => [
      {
        label: 'Completion',
        value: `${completionPercent}%`,
        accent: 'blue' as const,
        hint: canCreate ? 'Ready to create' : 'Pick PR + 2 vendors',
      },
      {
        label: 'PR Lines',
        value: pr ? String(pr.lines.length) : '—',
        accent: 'green' as const,
        hint: pr ? `${formatNumber(totalQty)} total qty` : 'Select approved PR',
      },
      {
        label: 'Vendors',
        value: String(selectedVendors.length),
        accent: selectedVendors.length >= 2 ? ('green' as const) : ('amber' as const),
        hint: selectedVendors.length >= 2 ? 'Invite ready' : 'Need at least 2',
      },
      {
        label: 'Total Qty',
        value: pr ? formatNumber(totalQty) : '—',
        accent: 'slate' as const,
        hint: pr?.prNo ?? 'No PR',
      },
    ],
    [completionPercent, canCreate, pr, totalQty, selectedVendors.length],
  )

  const nextAction = !hasPr
    ? {
        id: 'pr',
        title: 'Select purchase requisition',
        description: 'Choose an approved PR to load demand lines into this RFQ.',
        ctaLabel: 'Go to PR',
      }
    : selectedVendors.length < 2
      ? {
          id: 'vendors',
          title: 'Invite vendors',
          description: `Select ${2 - selectedVendors.length} more vendor(s) for competitive quotes.`,
          ctaLabel: 'Go to vendors',
        }
      : {
          id: 'create',
          title: 'Create RFQ',
          description: 'Publish the RFQ and open the document for send / comparison.',
          ctaLabel: 'Create RFQ',
        }

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'create', label: 'Create RFQ', icon: Save, onClick: handleCreate, primary: true, disabled: !canCreate },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate('/purchase/rfqs') },
      ]}
    />
  )

  const factBox = (
    <CrmSmartOverviewPanel
      ariaLabel="Smart RFQ overview"
      title="New RFQ"
      chips={[
        { label: 'Draft', tone: 'info' },
        { label: pr ? pr.prNo : 'No PR', tone: pr ? 'success' : 'neutral' },
      ]}
      meta={[
        `Buyer: ${session.name}`,
        pr ? `Lines: ${pr.lines.length}` : 'Select PR',
        selectedVendors.length >= 2
          ? `${selectedVendors.length} vendors invited`
          : `${selectedVendors.length} of 2 vendors`,
      ]}
      progressLabel="RFQ readiness"
      progressPercent={completionPercent}
      signals={[
        ...(hasPr ? [] : [{ id: 'pr', label: 'Approved PR required', tone: 'warn' as const }]),
        ...(selectedVendors.length >= 2
          ? [{ id: 'vendors-ok', label: `${selectedVendors.length} vendors selected`, tone: 'ok' as const }]
          : [{ id: 'vendors', label: 'Invite at least 2 vendors', tone: 'warn' as const }]),
        ...(hasPr
          ? [{ id: 'qty', label: `Total qty ${formatNumber(totalQty)}`, tone: 'ok' as const }]
          : []),
      ]}
      nextAction={nextAction}
      onNextAction={() => {
        if (nextAction.id === 'pr') goToSection('quick')
        else if (nextAction.id === 'vendors') goToSection('vendors')
        else handleCreate()
      }}
      quickActions={[
        {
          id: 'list',
          label: 'All RFQs',
          icon: FileText,
          onClick: () => navigate('/purchase/rfqs'),
        },
        {
          id: 'prs',
          label: 'Requisitions',
          icon: ClipboardList,
          onClick: () => navigate('/purchase/requisitions'),
        },
      ]}
      keyDetails={[
        { label: 'RFQ No.', value: 'Auto on create' },
        { label: 'Status', value: 'Draft' },
        {
          label: 'PR',
          value: pr?.prNo ?? '—',
          muted: !pr,
        },
        { label: 'Lines', value: pr ? String(pr.lines.length) : '—' },
        { label: 'Total Qty', value: pr ? formatNumber(totalQty) : '—' },
        {
          label: 'Vendors',
          value: String(selectedVendors.length),
          muted: selectedVendors.length < 2,
        },
        { label: 'Currency', value: 'INR' },
      ]}
      aiInsight={
        hasPr
          ? selectedVendors.length >= 2
            ? 'Same create flow as CRM quotations: review PR lines, confirm invites, then Create RFQ.'
            : 'Prefer vendors mapped to PR items — preferred match count shows in the invite grid.'
          : 'Start with an approved PR — lines load in the CRM opportunity-style grid (read-only).'
      }
    />
  )

  const footer = (
    <ErpStickySaveBar
      sticky
      submitLabel="Create RFQ"
      cancelTo="/purchase/rfqs"
      onSave={handleCreate}
      hint={(
        <span className="text-[12px] text-erp-muted">
          {completionPercent}% complete · Ctrl+S Create · Esc Cancel · Invite at least 2 vendors
        </span>
      )}
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" icon={X} onClick={() => navigate('/purchase/rfqs')}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="primary" icon={Save} onClick={handleCreate} disabled={!canCreate}>
            Create RFQ
          </ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title="New Request for Quotation"
        description="Select an approved PR, invite vendors, and create an RFQ for competitive quotes"
        recordNo="New"
        status="Draft"
        statusTone="neutral"
        owner={session.name}
        createdDate={formatDate(new Date().toISOString())}
        createdBy={session.name}
        favoritePath="/purchase/rfqs/new"
        breadcrumbs={[
          { label: 'RFQs', to: '/purchase/rfqs' },
          { label: 'New' },
        ]}
        commandBar={commandBar}
        documentStrip={purchaseStatusStripToDocumentStrip(statusStrip)}
        className="enterprise-workspace--dynamics-form enterprise-workspace--crm-smart-overview"
        onSaveShortcut={handleCreate}
        onSaveCloseShortcut={handleCreate}
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        suppressFactBoxRecord
        stickyFooter
      >
        <PurchaseFormSectionNav
          sections={[
            { id: 'quick', label: 'Request', icon: ClipboardList, done: hasPr },
            { id: 'lines', label: 'Lines', icon: Package, done: hasPr },
            { id: 'vendors', label: 'Vendors', icon: Users, done: selectedVendors.length >= 2 },
            { id: 'terms', label: 'Terms', icon: Banknote, done: true },
          ]}
          activeId={activeSection}
          onSelect={setActiveSection}
        />

        <EnterpriseFormMetrics metrics={formMetrics} />

        <div id={purchaseSectionId('quick')}>
          <ErpQuickEntrySection
            id={purchaseSectionId('quick-fields')}
            subtitle="Pick the approved PR — lines load below; invite vendors in the next section."
          >
            <ErpFieldRow label="PR reference" required>
              <ErpSmartSelect
                compact
                className="erp-input"
                options={prOptions}
                value={prId}
                onChange={(v) => setPrId(v || '')}
                allowEmpty
                placeholder="Select approved PR…"
              />
            </ErpFieldRow>
            <ErpViewField label="Lines" value={pr ? String(pr.lines.length) : undefined} />
            <ErpViewField label="Total qty" value={pr ? formatNumber(totalQty) : undefined} />
            {pr ? (
              <ErpViewField
                label="PR link"
                value={<TableLink to={`/purchase/requisitions/${pr.id}`}>{pr.prNo}</TableLink>}
              />
            ) : null}
          </ErpQuickEntrySection>
        </div>

        <ErpCardSection
          id={purchaseSectionId('lines')}
          title="PR line items"
          subtitle="Read-only demand from the selected requisition — same dense grid as CRM quotations"
          icon={Package}
          accent="teal"
          className="col-span-2"
          columns={1}
          collapsible
          defaultOpen
        >
          {!pr && approvedPrs.length === 0 ? (
            <p className="text-sm text-erp-muted">
              No approved PRs available.{' '}
              <Link to="/purchase/requisitions" className="font-medium text-erp-primary hover:underline">Open requisitions</Link>
            </p>
          ) : null}

          {pr ? (
            <div className="col-span-3">
              <PurchaseTableToolbar>
                <span>
                  Lines from <strong>{pr.prNo}</strong> · Total qty <strong>{formatNumber(totalQty)}</strong>
                </span>
              </PurchaseTableToolbar>
              <PrLineItemsGrid
                lines={gridLines}
                onChange={() => undefined}
                locationOptions={locationOptions}
                warehouseOptions={warehouseOptions}
                stockByItem={stockByItem}
                readOnly
              />
            </div>
          ) : (
            <p className="text-sm text-erp-muted">Select a purchase requisition to preview lines.</p>
          )}
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('vendors')}
          title="Invite vendors"
          subtitle="Select at least 2 vendors for competitive comparison"
          icon={Truck}
          accent="green"
          collapsible
          defaultOpen
        >
          <div className="col-span-2">
            <PurchaseDataTable>
              <thead>
                <tr>
                  <th className="w-10" />
                  <th>Vendor</th>
                  <th>City</th>
                  <th>Rating</th>
                  <th>Payment terms</th>
                  <th>Preferred items</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v) => {
                  const checked = selectedVendors.includes(v.id)
                  const preferredCount = pr
                    ? pr.lines.filter((l) =>
                        getVendorMapsForItem(l.itemId).some((m) => m.vendorId === v.id && m.isPreferred),
                      ).length
                    : 0
                  return (
                    <tr key={v.id} className={checked ? 'bg-erp-surface-alt' : undefined}>
                      <td>
                        <Checkbox
                          label=""
                          checked={checked}
                          onChange={() => toggleVendor(v.id)}
                          aria-label={`Invite ${v.vendorName}`}
                        />
                      </td>
                      <td>{v.vendorName}</td>
                      <td>{v.city}</td>
                      <td>{'★'.repeat(Math.round(v.rating))}</td>
                      <td>{v.paymentTermsDays} days</td>
                      <td>{preferredCount > 0 ? `${preferredCount} ★` : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </PurchaseDataTable>
            {selectedVendors.length > 0 && selectedVendors.length < 2 ? (
              <p className="mt-2 text-xs text-amber-700">
                Select {2 - selectedVendors.length} more vendor(s) to proceed.
              </p>
            ) : null}
          </div>
        </ErpCardSection>

        <ErpAdditionalInfoToggle
          open={showAdditionalDetails}
          onToggle={toggleAdditionalDetails}
          panelId={additionalPanelId}
          sectionCount={1}
          summary="Default commercial conditions"
        />
        <ErpAdditionalInfoPanel open={showAdditionalDetails} id={additionalPanelId}>
          <ErpCardSection
            id={purchaseSectionId('terms')}
            title="Commercial terms"
            subtitle="Default RFQ commercial conditions"
            icon={Banknote}
            accent="amber"
            collapsible
            defaultOpen
          >
            <ErpViewField label="Payment terms" value="Net 30" />
            <ErpViewField label="Incoterms" value="Ex-Works" />
            <ErpViewField label="Quote validity" value="14 days from RFQ date" />
            <ErpViewField label="Currency" value="INR" />
          </ErpCardSection>
        </ErpAdditionalInfoPanel>
      </PurchaseCardFormShell>
    </>
  )
}
