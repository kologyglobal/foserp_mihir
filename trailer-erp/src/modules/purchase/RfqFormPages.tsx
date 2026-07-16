import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Banknote, ClipboardList, Plus, Save, Truck, Users, X } from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpStickySaveBar,
} from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { ErpSmartSelect } from '../../components/erp/ErpSmartSelect'
import { Checkbox } from '../../components/forms/Inputs'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { useActiveVendors } from '../../hooks/useMasterLists'
import { formatNumber } from '../../utils/formatters/currency'
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

export function RfqCreateDocumentPage() {
  const navigate = useNavigate()
  const session = getSessionUser()
  const [searchParams] = useSearchParams()
  const initialPrId = searchParams.get('prId') ?? ''

  const requisitions = usePurchaseStore((s) => s.requisitions)
  const rfqs = usePurchaseStore((s) => s.rfqs)
  const createRfqFromPr = usePurchaseStore((s) => s.createRfqFromPr)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const getVendorMapsForItem = useMasterStore((s) => s.getVendorMapsForItem)
  const vendors = useActiveVendors()

  const [prId, setPrId] = useState(initialPrId)
  const [selectedVendors, setSelectedVendors] = useState<string[]>([])
  const [activeSection, setActiveSection] = useState('lines')
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

  const totalQty = pr?.lines.reduce((s, l) => s + l.qty, 0) ?? 0
  const canCreate = Boolean(prId && selectedVendors.length >= 2)

  const completionItems = useMemo(
    () => [
      { id: 'lines', label: 'Lines', done: Boolean(prId) },
      { id: 'vendors', label: 'Vendors', done: selectedVendors.length >= 2 },
      { id: 'terms', label: 'Terms', done: true },
    ],
    [prId, selectedVendors.length],
  )

  const completionPercent = Math.round(
    (completionItems.filter((i) => i.done).length / completionItems.length) * 100,
  )

  const sectionNavItems = useMemo(
    () => [
      { id: 'lines', label: 'PR & Lines', icon: ClipboardList, done: completionItems.find((i) => i.id === 'lines')?.done },
      { id: 'vendors', label: 'Vendors', icon: Users, done: completionItems.find((i) => i.id === 'vendors')?.done },
      { id: 'terms', label: 'Terms', icon: Banknote, done: true },
    ],
    [completionItems],
  )

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
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
      scrollToPurchaseSection('lines', setActiveSection)
      return
    }
    if (selectedVendors.length < 2) {
      show('Select at least 2 vendors for comparison')
      scrollToPurchaseSection('vendors', setActiveSection)
      return
    }
    const r = createRfqFromPr(prId, selectedVendors)
    if (r.ok && r.rfqId) navigate(`/purchase/rfqs/${r.rfqId}`)
    else show(r.error ?? 'Failed to create RFQ')
  }

  const documentStrip = [
    { label: 'Document', value: 'New RFQ', highlight: true },
    { label: 'PR Ref', value: pr?.prNo ?? '—' },
    { label: 'Lines', value: pr ? String(pr.lines.length) : '—' },
    { label: 'Total Qty', value: pr ? formatNumber(totalQty) : '—' },
    { label: 'Vendors', value: String(selectedVendors.length), highlight: selectedVendors.length >= 2 },
    { label: 'Buyer', value: session.name },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'create', label: 'Create RFQ', icon: Save, onClick: handleCreate, primary: true, disabled: !canCreate },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate('/purchase/rfqs') },
      ]}
    />
  )

  const formMetrics = useMemo(
    () => [
      { label: 'Completion', value: `${completionPercent}%`, accent: 'blue' as const },
      { label: 'PR Lines', value: pr ? String(pr.lines.length) : '—', accent: 'green' as const },
      { label: 'Vendors', value: String(selectedVendors.length), accent: selectedVendors.length >= 2 ? 'green' as const : 'amber' as const },
      { label: 'Total Qty', value: pr ? formatNumber(totalQty) : '—', accent: 'slate' as const },
    ],
    [completionPercent, pr, selectedVendors.length, totalQty],
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      metrics={formMetrics}
      summary={[
        { label: 'PR', value: pr ? <TableLink to={`/purchase/requisitions/${pr.id}`}>{pr.prNo}</TableLink> : '—' },
        { label: 'Lines', value: pr?.lines.length ?? '—' },
        { label: 'Vendors invited', value: selectedVendors.length, highlight: selectedVendors.length >= 2 },
        { label: 'Total Qty', value: pr ? formatNumber(totalQty) : '—' },
      ]}
      actions={[
        { id: 'create', label: 'Create RFQ', icon: Plus, primary: true, onClick: handleCreate, disabled: !canCreate },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate('/purchase/rfqs') },
      ]}
    />
  )

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      submitLabel="Create RFQ"
      cancelTo="/purchase/rfqs"
      onSave={handleCreate}
      hint={<span className="text-[12px] text-erp-muted">{completionPercent}% complete · Invite at least 2 vendors</span>}
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate('/purchase/rfqs')}>Back</ErpButton>
          <ErpButton type="button" variant="primary" icon={Plus} onClick={handleCreate} disabled={!canCreate}>Create RFQ</ErpButton>
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
        documentStrip={documentStrip}
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        stickyFooter={false}
      >
        <PurchaseFormSectionNav sections={sectionNavItems} activeId={activeSection} onSelect={setActiveSection} />

        <ErpCardSection
          id={purchaseSectionId('lines')}
          title="PR reference & lines"
          subtitle="Load items from an approved purchase requisition"
          icon={ClipboardList}
          accent="blue"
          collapsible
          defaultOpen
        >
          <ErpFieldRow label="PR reference" required>
            <ErpSmartSelect
              className="erp-input"
              options={prOptions}
              value={prId}
              onChange={(v) => setPrId(v || '')}
              allowEmpty
              placeholder="Select approved PR…"
            />
          </ErpFieldRow>
          <ErpFieldRow label="Lines" readOnly>{purchaseReadonlyValue(pr ? String(pr.lines.length) : '—')}</ErpFieldRow>
          <ErpFieldRow label="Total qty" readOnly>{purchaseReadonlyValue(pr ? formatNumber(totalQty) : '—')}</ErpFieldRow>

          {!pr && approvedPrs.length === 0 ? (
            <p className="col-span-2 text-sm text-erp-muted">
              No approved PRs available.{' '}
              <Link to="/purchase/requisitions" className="font-medium text-erp-primary hover:underline">Open requisitions</Link>
            </p>
          ) : null}

          {pr ? (
            <div className="col-span-2">
              <PurchaseTableToolbar>
                <span>Lines from <strong>{pr.prNo}</strong> · Total qty <strong>{formatNumber(totalQty)}</strong></span>
              </PurchaseTableToolbar>
              <PurchaseDataTable>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Description</th>
                    <th className="num">Qty</th>
                    <th>Warehouse</th>
                    <th>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {pr.lines.map((l, i) => {
                    const item = getItem(l.itemId)
                    return (
                      <tr key={l.id}>
                        <td className="num">{i + 1}</td>
                        <td className="font-mono">{item?.itemCode}</td>
                        <td>{item?.itemName}</td>
                        <td className="num">{formatNumber(l.qty)}</td>
                        <td>{getWarehouse(l.warehouseId)?.warehouseCode}</td>
                        <td>{formatDate(l.requiredDate)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </PurchaseDataTable>
            </div>
          ) : (
            <p className="col-span-2 text-sm text-erp-muted">Select a purchase requisition to preview lines.</p>
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
                    ? pr.lines.filter((l) => getVendorMapsForItem(l.itemId).some((m) => m.vendorId === v.id && m.isPreferred)).length
                    : 0
                  return (
                    <tr key={v.id} className={checked ? 'bg-erp-surface-alt' : undefined}>
                      <td>
                        <Checkbox label="" checked={checked} onChange={() => toggleVendor(v.id)} aria-label={`Invite ${v.vendorName}`} />
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
              <p className="mt-2 text-xs text-amber-700">Select {2 - selectedVendors.length} more vendor(s) to proceed.</p>
            ) : null}
          </div>
        </ErpCardSection>

        <ErpCardSection
          id={purchaseSectionId('terms')}
          title="Commercial terms"
          subtitle="Default RFQ commercial conditions"
          icon={Banknote}
          accent="amber"
          collapsible
        >
          <ErpFieldRow label="Payment terms" readOnly>{purchaseReadonlyValue('Net 30')}</ErpFieldRow>
          <ErpFieldRow label="Incoterms" readOnly>{purchaseReadonlyValue('Ex-Works')}</ErpFieldRow>
          <ErpFieldRow label="Quote validity" readOnly>{purchaseReadonlyValue('14 days from RFQ date')}</ErpFieldRow>
          <ErpFieldRow label="Currency" readOnly>{purchaseReadonlyValue('INR')}</ErpFieldRow>
        </ErpCardSection>
      </PurchaseCardFormShell>
    </>
  )
}
