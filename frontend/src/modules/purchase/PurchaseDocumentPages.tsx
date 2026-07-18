import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  BarChart3,
  CheckCircle,
  ClipboardList,
  FileEdit,
  Package,
  Paperclip,
  Printer,
  Send,
  Truck,
  XCircle,
} from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpStickySaveBar,
  ErpViewField,
  type ErpCardFormStatusItem,
} from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { ItemLookupSelect } from '../../components/lookups/ItemLookupSelect'
import { VendorLookupSelect } from '../../components/lookups/VendorLookupSelect'
import { Input } from '../../components/forms/Inputs'
import { ApprovalChainPanel } from '../../components/approval/ApprovalChainPanel'
import { GrnQrPanel } from '../../components/qr/GrnQrPanel'
import { GrnLineQrCell } from '../../components/qr/GrnLineQrCell'
import { TableLink } from '../../components/ui/AppLink'
import { Toast } from '../../components/ui/Toast'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { poIsAmendable } from '../../types/purchase'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { formatStatus } from '../../components/ui/Badge'
import { canPermission } from '../../utils/permissions'
import { workflowPostGrn } from '../../utils/qrWorkflow'
import { buildGrnDocumentAlerts, buildGrnNextActions, buildPoNextActions, computePoHealth } from '../../utils/liveErpMetrics'
import {
  buildGrnProcessNextActions,
  buildPoProcessNextActions,
  buildRfqProcessNextActions,
  grnProcessStep,
  grnStatusLabel,
  poProcessStep,
  poStatusLabel,
  rfqProcessStep,
  rfqStatusLabel,
} from '../../utils/purchaseStatusLabels'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import { PurchaseProcessStagePanel } from '@/components/purchase/PurchaseProcessMap'
import {
  PurchaseDataTable,
  PurchaseDocTimeline,
  PurchaseTableToolbar,
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseEnterpriseFactBox,
  PurchaseFormSectionNav,
  purchaseSectionId,
  purchaseStatusStripToDocumentStrip,
} from '@/components/purchase/PurchaseEnterpriseFormKit'

// ─── RFQ ────────────────────────────────────────────────────────────────────

export function RfqDocumentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const rfq = usePurchaseStore((s) => (id ? s.getRfq(id) : undefined))
  const pr = usePurchaseStore((s) => (rfq ? s.getPr(rfq.prId) : undefined))
  const linkedPo = usePurchaseStore((s) => s.purchaseOrders.find((p) => p.rfqId === rfq?.id))
  const addRfqQuote = usePurchaseStore((s) => s.addRfqQuote)
  const createPoFromRfq = usePurchaseStore((s) => s.createPoFromRfq)
  const setRfqRecommendation = usePurchaseStore((s) => s.setRfqRecommendation)
  const sendRfq = usePurchaseStore((s) => s.sendRfq)
  const closeRfq = usePurchaseStore((s) => s.closeRfq)
  const cancelRfq = usePurchaseStore((s) => s.cancelRfq)
  const getVendorComparison = usePurchaseStore((s) => s.getVendorComparison)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const getVendor = useMasterStore((s) => s.getVendor)

  const [activeSection, setActiveSection] = useState('general')
  const [quoteVendor, setQuoteVendor] = useState('')
  const [quoteItem, setQuoteItem] = useState('')
  const [quoteRate, setQuoteRate] = useState('')
  const [quoteLead, setQuoteLead] = useState('14')
  const [poVendor, setPoVendor] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  if (!rfq) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        RFQ not found. <Link to="/purchase/rfqs">Back to RFQs</Link>
      </div>
    )
  }

  const totalQty = rfq.lines.reduce((s, l) => s + l.qty, 0)
  const quotesCount = rfq.quotes.length
  const comparison = getVendorComparison(rfq.id)
  const isTerminal = rfq.status === 'closed' || rfq.status === 'cancelled'
  const vendorsResponded = new Set(rfq.quotes.map((q) => q.vendorId)).size
  const quoteCoveragePct =
    rfq.lines.length && rfq.vendorIds.length
      ? Math.round((quotesCount / (rfq.lines.length * rfq.vendorIds.length)) * 100)
      : 0

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={
        rfq.status === 'draft'
          ? [{ id: 'send', label: 'Send RFQ to Vendors', icon: Send, onClick: () => { const r = sendRfq(rfq.id); if (r.ok) show('RFQ sent to approved vendors'); else show(r.error ?? 'Failed') }, primary: true, disabled: rfq.status !== 'draft' }]
          : [{ id: 'po', label: 'Create Purchase Order', icon: Truck, onClick: () => { const r = createPoFromRfq(rfq.id, poVendor); if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`); else show(r.error ?? 'Failed') }, primary: true, disabled: !poVendor || isTerminal || Boolean(linkedPo) }]
      }
      reportActions={[
        { id: 'compare', label: 'Tech & Commercial Compare', icon: BarChart3, onClick: () => navigate(`/purchase/comparison/${rfq.id}`), disabled: quotesCount < 2 },
      ]}
      moreActions={[
        ...(rfq.status === 'draft' ? [] : [{ id: 'po-alt', label: 'Create Purchase Order', icon: Truck, onClick: () => { const r = createPoFromRfq(rfq.id, poVendor); if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`); else show(r.error ?? 'Failed') }, disabled: !poVendor || isTerminal || Boolean(linkedPo) }]),
        { id: 'attachments', label: 'Attachments', icon: Paperclip, onClick: () => setActiveSection('documents') },
        { id: 'print', label: 'Print', icon: Printer, onClick: () => {}, disabled: true },
        { id: 'close', label: 'Close', icon: CheckCircle, onClick: () => { const r = closeRfq(rfq.id); if (r.ok) show('RFQ closed'); else show(r.error ?? 'Failed') }, disabled: isTerminal || Boolean(linkedPo) },
        { id: 'cancel', label: 'Cancel', icon: XCircle, onClick: () => { const r = cancelRfq(rfq.id); if (r.ok) show('RFQ cancelled'); else show(r.error ?? 'Failed') }, disabled: isTerminal || Boolean(linkedPo), danger: true },
      ]}
    />
  )

  const rfqNextProcess = buildRfqProcessNextActions(rfq)
  const statusStrip: ErpCardFormStatusItem[] = [
    { label: 'RFQ No', value: rfq.rfqNo, tone: 'neutral' },
    { label: 'Status', value: rfqStatusLabel(rfq.status), tone: rfq.status === 'quoted' ? 'success' : rfq.status === 'sent' ? 'warning' : 'neutral' },
    { label: 'PR Ref', value: pr?.prNo ?? '—', tone: 'neutral' },
    { label: 'Vendors', value: String(rfq.vendorIds.length), tone: 'info' },
    { label: 'Quotes', value: String(quotesCount), tone: 'info' },
    { label: 'Created By', value: rfq.createdByName, tone: 'neutral' },
    { label: 'Created On', value: formatDate(rfq.createdAt), tone: 'neutral' },
  ]

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      hint="F4 Lookup · Esc Back"
      actions={(
        <ErpButtonGroup>
          {rfq.status === 'draft' ? (
            <ErpButton type="button" variant="primary" icon={Send} onClick={() => { const r = sendRfq(rfq.id); if (r.ok) show('RFQ sent to vendors'); else show(r.error ?? 'Failed') }}>
              Send to Vendors
            </ErpButton>
          ) : null}
          <ErpButton type="button" variant="secondary" icon={BarChart3} disabled={quotesCount < 2} onClick={() => navigate(`/purchase/comparison/${rfq.id}`)}>
            Tech &amp; Commercial Compare
          </ErpButton>
          <ErpButton type="button" variant="primary" icon={Truck} disabled={!poVendor || isTerminal || Boolean(linkedPo)} onClick={() => { const r = createPoFromRfq(rfq.id, poVendor); if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`); else show(r.error ?? 'Failed') }}>
            Create Purchase Order
          </ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      title="RFQ insight"
      metrics={[
        { label: 'Lines', value: String(rfq.lines.length), accent: 'blue' },
        { label: 'Total Qty', value: formatNumber(totalQty), accent: 'violet' },
        { label: 'Quotes', value: String(quotesCount), accent: 'green', highlight: quotesCount > 0 },
        { label: 'Coverage', value: `${quoteCoveragePct}%`, accent: 'amber' },
      ]}
      summary={[
        { label: 'RFQ', value: rfq.rfqNo },
        { label: 'Status', value: rfqStatusLabel(rfq.status), highlight: rfq.status === 'quoted' },
        { label: 'Next Action', value: rfqNextProcess[0]?.label ?? '—', highlight: Boolean(rfqNextProcess[0]) },
        { label: 'Invited', value: rfq.vendorIds.length },
        { label: 'Responded', value: vendorsResponded },
        { label: 'PR', value: pr ? <TableLink to={`/purchase/requisitions/${pr.id}`}>{pr.prNo}</TableLink> : '—' },
        { label: 'Open PO', value: linkedPo ? <TableLink to={`/purchase/orders/${linkedPo.id}`}>{linkedPo.poNo}</TableLink> : '—' },
        { label: 'Vendor Selected', value: rfq.recommendedVendorId ? getVendor(rfq.recommendedVendorId)?.vendorName ?? '—' : '—' },
      ]}
      actions={[
        { id: 'send', label: 'Send RFQ', icon: Send, primary: true, onClick: () => { const r = sendRfq(rfq.id); if (r.ok) show('RFQ sent to approved vendors'); else show(r.error ?? 'Failed') }, disabled: rfq.status !== 'draft' },
        { id: 'compare', label: 'Compare', icon: BarChart3, onClick: () => navigate(`/purchase/comparison/${rfq.id}`), disabled: quotesCount < 2 },
      ]}
    />
  )

  const sectionContent: Record<string, ReactNode> = {
    general: (
      <>
        <ErpCardSection
          id={purchaseSectionId('general')}
          title="General"
          subtitle="RFQ header and workflow status"
          icon={ClipboardList}
          accent="blue"
          columns={2}
          collapsible
          defaultOpen
        >
          <ErpViewField label="RFQ No" value={rfq.rfqNo} />
          <ErpViewField label="Status" value={rfqStatusLabel(rfq.status)} />
          <ErpViewField label="PR Reference">
            {pr ? <TableLink to={`/purchase/requisitions/${pr.id}`} className="erp-view-field__link">{pr.prNo}</TableLink> : undefined}
          </ErpViewField>
          <ErpViewField label="Vendors Invited" value={String(rfq.vendorIds.length)} />
          <ErpViewField label="Vendor Quotations Received" value={String(quotesCount)} />
          <ErpViewField label="Vendor Selected" value={rfq.recommendedVendorId ? getVendor(rfq.recommendedVendorId)?.vendorName : undefined} />
          <ErpViewField label="Created By" value={rfq.createdByName} />
          <ErpViewField label="Created On" value={formatDate(rfq.createdAt)} />
        </ErpCardSection>
        <p className="text-xs text-erp-muted">
          Created by {rfq.createdByName} on {formatDate(rfq.createdAt)}
          {rfq.modifiedAt ? ` · Modified by ${rfq.modifiedByName ?? '—'} on ${formatDate(rfq.modifiedAt)}` : ''}
        </p>
      </>
    ),
    items: (
      <ErpCardSection id={purchaseSectionId('items')} title="Item lines" subtitle="RFQ line items and lowest quotes" icon={Package} accent="teal" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          <PurchaseTableToolbar>
            <span>
              <strong className="text-erp-text">{rfq.lines.length}</strong> item line{rfq.lines.length === 1 ? '' : 's'} · Total qty{' '}
              <strong className="text-erp-text">{formatNumber(totalQty)}</strong>
            </span>
          </PurchaseTableToolbar>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Description</th>
                <th className="num">Qty</th>
                <th>Warehouse</th>
                <th className="num">Lowest Quote</th>
              </tr>
            </thead>
            <tbody>
              {rfq.lines.map((l, i) => {
                const item = getItem(l.itemId)
                const lineQuotes = rfq.quotes.filter((q) => q.itemId === l.itemId)
                const lowest = lineQuotes.length ? Math.min(...lineQuotes.map((q) => q.quotedRate)) : null
                return (
                  <tr key={l.id}>
                    <td className="num">{i + 1}</td>
                    <td className="font-mono">{item?.itemCode}</td>
                    <td>{item?.itemName}</td>
                    <td className="num">{formatNumber(l.qty)}</td>
                    <td>{getWarehouse(l.warehouseId)?.warehouseCode}</td>
                    <td className="num">{lowest != null ? formatCurrency(lowest) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
    vendors: (
      <ErpCardSection id={purchaseSectionId('vendors')} title="Invited vendors" subtitle="Vendor response status and coverage" icon={Truck} accent="violet" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          <PurchaseTableToolbar>
            <span>
              <strong className="text-erp-text">{rfq.vendorIds.length}</strong> vendor{rfq.vendorIds.length === 1 ? '' : 's'} invited ·{' '}
              <strong className="text-erp-text">{vendorsResponded}</strong> responded
            </span>
          </PurchaseTableToolbar>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>City</th>
                <th>Rating</th>
                <th className="num">Quotes</th>
                <th className="num">Coverage</th>
                <th>Payment Terms</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rfq.vendorIds.map((vid) => {
                const v = getVendor(vid)
                const vQuotes = rfq.quotes.filter((q) => q.vendorId === vid)
                const coverage = rfq.lines.length ? Math.round((vQuotes.length / rfq.lines.length) * 100) : 0
                const responded = vQuotes.length > 0
                return (
                  <tr key={vid}>
                    <td>
                      {v?.vendorName ?? vid}
                      {rfq.recommendedVendorId === vid ? ' ★' : ''}
                    </td>
                    <td>{v?.city ?? '—'}</td>
                    <td>{v ? '★'.repeat(Math.round(v.rating)) : '—'}</td>
                    <td className="num">{vQuotes.length}</td>
                    <td className="num">{coverage}%</td>
                    <td>{v ? `${v.paymentTermsDays} days` : '—'}</td>
                    <td>{responded ? (coverage >= 100 ? 'Complete' : 'Partial') : rfq.status === 'sent' ? 'Pending' : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
    terms: (
      <ErpCardSection id={purchaseSectionId('terms')} title="Commercial terms" subtitle="Payment and delivery conditions" icon={ClipboardList} accent="amber" columns={2} collapsible defaultOpen>
        <ErpViewField label="Payment Terms" value="Net 30" />
        <ErpViewField label="Incoterms" value="Ex-Works" />
        <ErpViewField label="Validity" value="14 days from RFQ date" />
        <ErpViewField label="Currency" value="INR" />
      </ErpCardSection>
    ),
    responses: (
      <ErpCardSection id={purchaseSectionId('responses')} title="Vendor responses" subtitle="Record and review vendor quotes" icon={Send} accent="green" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          {rfq.status === 'draft' ? (
            <div className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
              Send RFQ to vendors before recording responses.
            </div>
          ) : null}
          <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-5">
            <ErpFieldRow label="Vendor" horizontal={false}>
              <VendorLookupSelect
                compact
                allowEmpty
                value={quoteVendor}
                onChange={(sel) => setQuoteVendor(sel?.vendorId ?? '')}
                restrictToIds={rfq.vendorIds}
                disabled={rfq.status === 'draft' || isTerminal}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Item" horizontal={false}>
              <ItemLookupSelect
                compact
                allowEmpty
                value={quoteItem}
                onChange={(sel) => setQuoteItem(sel?.itemId ?? '')}
                disabled={rfq.status === 'draft' || isTerminal}
              />
            </ErpFieldRow>
            <ErpFieldRow label="Rate" horizontal={false}>
              <Input value={quoteRate} onChange={(e) => setQuoteRate(e.target.value)} placeholder="0.00" disabled={rfq.status === 'draft' || isTerminal} />
            </ErpFieldRow>
            <ErpFieldRow label="Lead Days" horizontal={false}>
              <Input value={quoteLead} onChange={(e) => setQuoteLead(e.target.value)} disabled={rfq.status === 'draft' || isTerminal} />
            </ErpFieldRow>
            <div className="flex items-end">
              <ErpButton
                type="button"
                variant="primary"
                className="w-full"
                disabled={!quoteVendor || !quoteItem || !quoteRate || rfq.status === 'draft' || isTerminal}
                onClick={() => {
                  addRfqQuote(rfq.id, quoteVendor, quoteItem, {
                    rate: parseFloat(quoteRate),
                    leadTimeDays: parseInt(quoteLead, 10) || 0,
                    freightAmount: 0,
                    gstPct: 18,
                  })
                  show('Quote recorded')
                }}
              >
                Add Quote
              </ErpButton>
            </div>
          </div>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Item</th>
                <th className="num">Rate</th>
                <th>Lead</th>
                <th className="num">Freight</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rfq.quotes.map((q, i) => (
                <tr key={`${q.vendorId}-${q.itemId}-${i}`}>
                  <td>{getVendor(q.vendorId)?.vendorName}</td>
                  <td className="font-mono">{getItem(q.itemId)?.itemCode}</td>
                  <td className="num">{formatCurrency(q.quotedRate)}</td>
                  <td>{q.leadTimeDays}d</td>
                  <td className="num">{formatCurrency(q.freightAmount)}</td>
                  <td>
                    <ErpButton
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setRfqRecommendation(rfq.id, q.vendorId, `Recommended for ${getItem(q.itemId)?.itemCode}`)
                        show('Vendor recommended')
                      }}
                    >
                      Recommend
                    </ErpButton>
                  </td>
                </tr>
              ))}
              {rfq.quotes.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-erp-muted">
                    No vendor responses yet
                  </td>
                </tr>
              )}
            </tbody>
          </PurchaseDataTable>
          <div className="mt-3 grid grid-cols-1 items-end gap-3 sm:grid-cols-[130px_1fr_auto]">
            <span className="text-sm text-erp-muted text-right">Award PO</span>
            <VendorLookupSelect
              compact
              allowEmpty
              value={poVendor}
              onChange={(sel) => setPoVendor(sel?.vendorId ?? '')}
              restrictToIds={rfq.vendorIds}
              placeholder="Winning vendor…"
              disabled={isTerminal || Boolean(linkedPo)}
            />
            <ErpButton
              type="button"
              variant="primary"
              disabled={!poVendor || isTerminal || Boolean(linkedPo)}
              onClick={() => {
                const r = createPoFromRfq(rfq.id, poVendor)
                if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`)
                else show(r.error ?? 'Failed')
              }}
            >
              Create PO
            </ErpButton>
          </div>
        </div>
      </ErpCardSection>
    ),
    comparison: (
      <ErpCardSection id={purchaseSectionId('comparison')} title="Quote comparison" subtitle="Side-by-side vendor pricing matrix" icon={BarChart3} accent="violet" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          <PurchaseTableToolbar>
            <span>
              Quote matrix · <strong className="text-erp-text">{comparison.length}</strong> quote{comparison.length === 1 ? '' : 's'} · Coverage{' '}
              <strong className="text-erp-text">{quoteCoveragePct}%</strong>
            </span>
            <ErpButton type="button" variant="secondary" size="sm" disabled={quotesCount < 2} onClick={() => navigate(`/purchase/comparison/${rfq.id}`)}>
              Full Comparison
            </ErpButton>
          </PurchaseTableToolbar>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>Item</th>
                {rfq.vendorIds.map((vid) => (
                  <th key={vid} className="num">
                    {getVendor(vid)?.vendorName ?? vid}
                  </th>
                ))}
                <th className="num">Lowest</th>
              </tr>
            </thead>
            <tbody>
              {rfq.lines.map((l) => {
                const item = getItem(l.itemId)
                const lineQuotes = rfq.quotes.filter((q) => q.itemId === l.itemId)
                const lowest = lineQuotes.length ? Math.min(...lineQuotes.map((q) => q.quotedRate)) : null
                return (
                  <tr key={l.id}>
                    <td>
                      <span className="font-mono">{item?.itemCode}</span>
                      <div className="text-[10px] text-erp-muted">{item?.itemName}</div>
                    </td>
                    {rfq.vendorIds.map((vid) => {
                      const q = rfq.quotes.find((x) => x.vendorId === vid && x.itemId === l.itemId)
                      const isLowest = q && lowest != null && q.quotedRate === lowest
                      return (
                        <td key={vid} className={`num ${isLowest ? 'text-green-700 font-semibold' : ''}`}>
                          {q ? formatCurrency(q.quotedRate) : '—'}
                        </td>
                      )
                    })}
                    <td className="num font-semibold">{lowest != null ? formatCurrency(lowest) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </PurchaseDataTable>
          {comparison.length >= 2 ? (
            <PurchaseDataTable className="mt-4">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Vendor</th>
                  <th>Item</th>
                  <th className="num">Rate</th>
                  <th className="num">Landed Cost</th>
                  <th>Delivery</th>
                </tr>
              </thead>
              <tbody>
                {comparison.slice(0, 8).map((row) => (
                  <tr key={`${row.vendorId}-${row.itemId}`}>
                    <td className="num">{row.rank}</td>
                    <td>
                      {row.vendorName}
                      {row.isPreferred ? ' ★' : ''}
                    </td>
                    <td className="font-mono">{row.itemCode}</td>
                    <td className="num">{formatCurrency(row.quotedRate)}</td>
                    <td className="num">{formatCurrency(row.landedCostPerUnit)}</td>
                    <td>{formatDate(row.deliveryDate)}</td>
                  </tr>
                ))}
              </tbody>
            </PurchaseDataTable>
          ) : (
            <p className="mt-4 py-4 text-center text-xs text-erp-muted">Need at least 2 quotes for ranked comparison.</p>
          )}
        </div>
      </ErpCardSection>
    ),
    documents: (
      <ErpCardSection id={purchaseSectionId('documents')} title="Documents" subtitle="RFQ attachments and specifications" icon={Paperclip} accent="slate" collapsible defaultOpen={false}>
        <ul className="col-span-2 list-disc space-y-1 pl-5 text-sm text-erp-muted">
          <li>RFQ specification sheet</li>
          <li>Drawing attachments from PR</li>
          <li>Vendor quotation PDFs</li>
        </ul>
        <p className="col-span-2 text-xs text-erp-muted">Demo mode — purchase attachments are not API-backed.</p>
      </ErpCardSection>
    ),
    timeline: (
      <ErpCardSection id={purchaseSectionId('timeline')} title="Timeline" subtitle="Document lifecycle events" icon={ClipboardList} accent="slate" collapsible defaultOpen={false}>
        <PurchaseDocTimeline
          events={[
            { t: 'Created', d: rfq.createdAt, u: rfq.createdByName },
            { t: 'Sent to Vendors', d: rfq.status !== 'draft' ? rfq.modifiedAt ?? rfq.createdAt : null, u: rfq.modifiedByName },
            { t: 'Quotes Received', d: rfq.quotes.length > 0 ? rfq.modifiedAt : null, u: rfq.modifiedByName },
            { t: 'PO Created', d: linkedPo?.createdAt, u: linkedPo?.createdByName },
            { t: 'Closed', d: rfq.status === 'closed' ? rfq.modifiedAt : null, u: rfq.modifiedByName },
          ]}
        />
      </ErpCardSection>
    ),
  }

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title="Request for Quotation"
        description="RFQ sent to approved vendors → quotations → comparison → vendor selected → PO"
        recordNo={rfq.rfqNo}
        status={rfqStatusLabel(rfq.status)}
        statusTone={purchaseStatusTone(rfq.status)}
        owner={rfq.createdByName}
        createdDate={formatDate(rfq.createdAt)}
        createdBy={rfq.createdByName}
        modifiedDate={rfq.modifiedAt ? formatDate(rfq.modifiedAt) : undefined}
        modifiedBy={rfq.modifiedByName ?? undefined}
        favoritePath={`/purchase/rfqs/${id}`}
        breadcrumbs={[
          { label: 'RFQs', to: '/purchase/rfqs' },
          { label: rfq.rfqNo },
        ]}
        backLink={{ to: '/purchase/rfqs', label: 'Back to RFQs' }}
        commandBar={commandBar}
        documentStrip={purchaseStatusStripToDocumentStrip(statusStrip)}
        detailMode
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        stickyFooter={false}
      >
        <PurchaseProcessStagePanel
          currentStep={rfqProcessStep(rfq)}
          statusLabel={rfqStatusLabel(rfq.status)}
          nextActions={rfqNextProcess}
        />
        <PurchaseFormSectionNav
          sections={[
            { id: 'general', label: 'General', icon: ClipboardList },
            { id: 'items', label: 'Items', icon: Package },
            { id: 'vendors', label: 'Vendors', icon: Truck },
            { id: 'terms', label: 'Terms', icon: ClipboardList },
            { id: 'responses', label: 'Responses', icon: Send },
            { id: 'comparison', label: 'Comparison', icon: BarChart3 },
            { id: 'documents', label: 'Documents', icon: Paperclip },
            { id: 'timeline', label: 'Timeline', icon: ClipboardList },
          ]}
          activeId={activeSection}
          onSelect={setActiveSection}
        />
        {sectionContent.general}
        {sectionContent.items}
        {sectionContent.vendors}
        {sectionContent.terms}
        {sectionContent.responses}
        {sectionContent.comparison}
        {sectionContent.documents}
        {sectionContent.timeline}
      </PurchaseCardFormShell>
    </>
  )
}

// ─── Purchase Order ─────────────────────────────────────────────────────────

export function PurchaseOrderDocumentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const po = usePurchaseStore((s) => (id ? s.getPo(id) : undefined))
  const submitPo = usePurchaseStore((s) => s.submitPo)
  const approvePo = usePurchaseStore((s) => s.approvePo)
  const sendPo = usePurchaseStore((s) => s.sendPo)
  const releasePo = usePurchaseStore((s) => s.releasePo)
  const closePo = usePurchaseStore((s) => s.closePo)
  const grns = usePurchaseStore((s) => s.grns)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const getVendor = useMasterStore((s) => s.getVendor)

  const [activeSection, setActiveSection] = useState('general')
  const [toast, setToast] = useState<string | null>(null)

  if (!po) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        PO not found. <Link to="/purchase/orders">Back to orders</Link>
      </div>
    )
  }

  const vendor = getVendor(po.vendorId)
  const poValue = po.lines.reduce((s, l) => s + l.qty * l.rate, 0)
  const totalOrdered = po.lines.reduce((s, l) => s + l.qty, 0)
  const totalReceived = po.lines.reduce((s, l) => s + l.receivedQty, 0)
  const relatedGrns = grns.filter((g) => g.poId === po.id)
  const sourcePr = po.prId ? usePurchaseStore.getState().getPr(po.prId) : undefined
  const sourceRfq = po.rfqId ? usePurchaseStore.getState().getRfq(po.rfqId) : undefined
  const canApprove = canPermission('purchase', 'approve')
  const poHealth = computePoHealth(po)
  const poNextActions = buildPoNextActions(po)
  const receiptPct = totalOrdered > 0 ? `${Math.round((totalReceived / totalOrdered) * 100)}%` : '0%'

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function receiveAll() {
    const lines = po!.lines
      .filter((l) => l.receivedQty < l.qty)
      .map((l) => ({ poLineId: l.id, receivedQty: l.qty - l.receivedQty }))
    const r = workflowPostGrn(po!.id, lines)
    show(r.ok ? `GRN posted` : r.error ?? 'Failed')
  }

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={
        po.status === 'draft'
          ? [{ id: 'submit', label: 'Submit for PO Approval', icon: Send, onClick: () => { const r = submitPo(po.id); show(r.ok ? 'Submitted for approval' : r.error ?? '') }, primary: true, disabled: po.status !== 'draft' }]
          : po.status === 'submitted'
            ? [{ id: 'approve', label: 'Approve PO', icon: CheckCircle, onClick: () => { const r = approvePo(po.id) as { ok: boolean; error?: string; pendingNextApprover?: string }; if (!r.ok) show(r.error ?? ''); else if (r.pendingNextApprover) show(`Pending ${r.pendingNextApprover}`); else show('PO approved') }, primary: true, disabled: !canApprove || po.status !== 'submitted' }]
            : [{ id: 'grn', label: 'Gate Entry & GRN', icon: Package, onClick: receiveAll, primary: true, disabled: !['sent', 'partial', 'released'].includes(po.status) }]
      }
      moreActions={[
        { id: 'release', label: 'Release PO', icon: CheckCircle, onClick: () => { const r = releasePo(po.id); show(r.ok ? 'PO approved and released' : r.error ?? '') }, disabled: po.status !== 'approved' },
        { id: 'send', label: 'Send / Await Confirmation', icon: Send, onClick: () => { const r = sendPo(po.id); show(r.ok ? 'Sent — awaiting vendor confirmation (demo)' : r.error ?? '') }, disabled: !['approved', 'released'].includes(po.status) },
        { id: 'grn-alt', label: 'Gate Entry & GRN', icon: Package, onClick: receiveAll, disabled: !['sent', 'partial', 'released'].includes(po.status) },
        { id: 'amend', label: 'Amend', icon: FileEdit, onClick: () => navigate(`/purchase/orders/${po.id}/amend`), disabled: !poIsAmendable(po) },
        { id: 'print', label: 'Print', icon: Printer, onClick: () => navigate(`/purchase/orders/${po.id}/print`) },
        { id: 'close', label: 'Close Purchase Order', icon: CheckCircle, onClick: () => { const r = closePo(po.id); show(r.ok ? 'Purchase order closed' : r.error ?? '') }, disabled: po.status !== 'received' },
      ]}
    />
  )

  const poProcessNext = buildPoProcessNextActions(po)
  const statusStrip: ErpCardFormStatusItem[] = [
    { label: 'PO No', value: po.poNo, tone: 'neutral' },
    { label: 'Status', value: poStatusLabel(po.status), tone: po.status === 'approved' || po.status === 'released' ? 'success' : po.status === 'submitted' ? 'warning' : 'neutral' },
    { label: 'Vendor', value: vendor?.vendorName ?? '—', tone: 'neutral' },
    { label: 'Value', value: formatCurrency(poValue), tone: 'info' },
    { label: 'Expected', value: formatDate(po.expectedDate), tone: 'neutral' },
    { label: 'Receipt', value: receiptPct, tone: 'info' },
    { label: 'Revision', value: String(po.revisionNo), tone: 'neutral' },
  ]

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      hint="Alt+S Save · Esc Back"
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={FileEdit} disabled={!poIsAmendable(po)} onClick={() => navigate(`/purchase/orders/${po.id}/amend`)}>Amend PO</ErpButton>
          <ErpButton type="button" variant="secondary" icon={Package} disabled={!['sent', 'partial', 'released'].includes(po.status)} onClick={receiveAll}>Gate Entry &amp; GRN</ErpButton>
          <ErpButton type="button" variant="secondary" icon={Printer} onClick={() => navigate(`/purchase/orders/${po.id}/print`)}>Print</ErpButton>
          <ErpButton type="button" variant="primary" icon={Send} disabled={po.status !== 'draft'} onClick={() => { const r = submitPo(po.id); show(r.ok ? 'Submitted for approval' : r.error ?? '') }}>Submit for Approval</ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      title="PO insight"
      metrics={[
        { label: 'Lines', value: String(po.lines.length), accent: 'blue' },
        { label: 'PO Value', value: formatCurrency(poValue), accent: 'green', highlight: true },
        { label: 'Receipt', value: receiptPct, accent: 'blue' },
        { label: 'Open Qty', value: formatNumber(totalOrdered - totalReceived), accent: 'amber' },
      ]}
      summary={[
        { label: 'PO', value: po.poNo },
        { label: 'Status', value: poStatusLabel(po.status), highlight: po.status === 'approved' || po.status === 'released' },
        { label: 'Vendor', value: vendor?.vendorName ?? '—' },
        { label: 'Health', value: poHealth },
        { label: 'GRN Count', value: relatedGrns.length },
        { label: 'PR Ref', value: sourcePr?.prNo ?? '—' },
        { label: 'Next Action', value: poProcessNext[0]?.label ?? poNextActions[0]?.label ?? '—', highlight: Boolean(poProcessNext[0] ?? poNextActions[0]) },
      ]}
      actions={[
        { id: 'grn', label: 'Gate Entry & GRN', icon: Package, primary: true, onClick: receiveAll, disabled: !['sent', 'partial', 'released'].includes(po.status) },
        { id: 'amend', label: 'Amend', icon: FileEdit, onClick: () => navigate(`/purchase/orders/${po.id}/amend`), disabled: !poIsAmendable(po) },
      ]}
    />
  )

  const sectionContent: Record<string, ReactNode> = {
    general: (
      <>
        <ErpCardSection id={purchaseSectionId('general')} title="General" subtitle="PO header, vendor, and references" icon={ClipboardList} accent="blue" columns={2} collapsible defaultOpen>
          <ErpViewField label="PO No" value={po.poNo} />
          <ErpViewField label="Revision" value={`Rev ${po.revisionNo}`} />
          <ErpViewField label="Status" value={poStatusLabel(po.status)} />
          <ErpViewField label="Vendor" value={vendor?.vendorName} />
          <ErpViewField label="Order Date" value={formatDate(po.orderDate)} />
          <ErpViewField label="Expected Delivery" value={formatDate(po.expectedDate)} />
          <ErpViewField label="Payment Terms" value={po.paymentTerms || 'Net 30'} />
          <ErpViewField label="PO Value" value={formatCurrency(poValue)} />
          <ErpViewField label="PR Reference">
            {sourcePr ? <TableLink to={`/purchase/requisitions/${sourcePr.id}`} className="erp-view-field__link">{sourcePr.prNo}</TableLink> : undefined}
          </ErpViewField>
          <ErpViewField label="RFQ Reference">
            {sourceRfq ? <TableLink to={`/purchase/rfqs/${sourceRfq.id}`} className="erp-view-field__link">{sourceRfq.rfqNo}</TableLink> : undefined}
          </ErpViewField>
          <ErpViewField label="Created By" value={po.createdByName} />
          <ErpViewField label="Approved By" value={po.approvedByName ?? undefined} />
        </ErpCardSection>
        <p className="text-xs text-erp-muted">
          Created by {po.createdByName} on {formatDate(po.createdAt)}
          {po.approvedAt ? ` · Approved ${formatDate(po.approvedAt)}` : ''}
          {po.sentAt ? ` · Sent ${formatDate(po.sentAt)}` : ''}
          {' · Revision '}{po.revisionNo}
        </p>
      </>
    ),
    lines: (
      <ErpCardSection id={purchaseSectionId('lines')} title="Order lines" subtitle="Items, quantities, and receipt progress" icon={Package} accent="teal" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          <PurchaseTableToolbar>
            <span>
              <strong className="text-erp-text">{po.lines.length}</strong> lines · Value{' '}
              <strong className="text-erp-text">{formatCurrency(poValue)}</strong> · Received{' '}
              <strong className="text-erp-text">{receiptPct}</strong>
            </span>
          </PurchaseTableToolbar>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Description</th>
                <th>Warehouse</th>
                <th className="num">Qty</th>
                <th className="num">Received</th>
                <th className="num">Open</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l, i) => {
                const item = getItem(l.itemId)
                const open = Math.max(0, l.qty - l.receivedQty)
                return (
                  <tr key={l.id}>
                    <td className="num">{i + 1}</td>
                    <td className="font-mono">{item?.itemCode}</td>
                    <td>{item?.itemName}</td>
                    <td>{getWarehouse(l.warehouseId)?.warehouseCode}</td>
                    <td className="num">{formatNumber(l.qty)}</td>
                    <td className="num">{formatNumber(l.receivedQty)}</td>
                    <td className="num">{formatNumber(open)}</td>
                    <td className="num">{formatCurrency(l.rate)}</td>
                    <td className="num">{formatCurrency(l.qty * l.rate)}</td>
                    <td>{formatDate(l.requiredDate)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-erp-surface-alt">
                <td colSpan={8}>Total</td>
                <td className="num">{formatCurrency(poValue)}</td>
                <td />
              </tr>
            </tfoot>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
    delivery: (
      <ErpCardSection id={purchaseSectionId('delivery')} title="Delivery" subtitle="Shipping and fulfillment" icon={Truck} accent="amber" columns={2} collapsible defaultOpen>
        <ErpViewField label="Expected Date" value={formatDate(po.expectedDate)} />
        <ErpViewField label="Incoterms" value="Ex-Works Pune" />
        <ErpViewField label="Ship To" value={getWarehouse(po.lines[0]?.warehouseId)?.warehouseName} />
        <ErpViewField label="Fulfillment" value={receiptPct} />
      </ErpCardSection>
    ),
    commercial: (
      <ErpCardSection id={purchaseSectionId('commercial')} title="Commercial" subtitle="Payment terms and value" icon={ClipboardList} accent="violet" columns={2} collapsible defaultOpen>
        <ErpViewField label="Payment Terms" value={po.paymentTerms || 'Net 30'} />
        <ErpViewField label="Currency" value="INR" />
        <ErpViewField label="PO Value" value={formatCurrency(poValue)} />
        <ErpViewField label="Vendor Credit" value={vendor ? `${vendor.paymentTermsDays} days` : undefined} />
      </ErpCardSection>
    ),
    tax: (
      <ErpCardSection id={purchaseSectionId('tax')} title="Tax" subtitle="GST and statutory charges" icon={ClipboardList} accent="slate" columns={2} collapsible defaultOpen={false}>
        <ErpViewField label="GST" value="18% (item level)" />
        <ErpViewField label="Freight" value="As per quote" />
        <ErpViewField label="TDS" value="As applicable" />
      </ErpCardSection>
    ),
    approval: (
      <ErpCardSection id={purchaseSectionId('approval')} title="Approval" subtitle="Workflow status and sign-off" icon={CheckCircle} accent="green" columns={2} className="col-span-2" collapsible defaultOpen>
        <ErpViewField label="Approval Status" value={po.approvedByName ? 'Approved' : po.status === 'submitted' ? 'Pending' : undefined} />
        <ErpViewField label="Approved By" value={po.approvedByName ?? undefined} />
        <ErpViewField label="Approved Date" value={po.approvedAt ? formatDate(po.approvedAt) : undefined} />
        {(po.status === 'submitted' || po.status === 'draft') ? (
          <div className="col-span-2 mt-3">
            <ApprovalChainPanel documentType="purchase_order" entityId={po.id} />
          </div>
        ) : null}
      </ErpCardSection>
    ),
    receipts: (
      <ErpCardSection id={purchaseSectionId('receipts')} title="Receipts" subtitle="GRNs posted against this PO" icon={Package} accent="teal" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>GRN No</th>
                <th>Date</th>
                <th>Status</th>
                <th className="num">Lines</th>
                <th>QC</th>
              </tr>
            </thead>
            <tbody>
              {relatedGrns.map((g) => (
                <tr key={g.id}>
                  <td><TableLink to={`/purchase/grn/${g.id}`}>{g.grnNo}</TableLink></td>
                  <td>{formatDate(g.grnDate)}</td>
                  <td>{formatStatus(g.status)}</td>
                  <td className="num">{g.lines.length}</td>
                  <td>{g.qcRequired ? 'Required' : '—'}</td>
                </tr>
              ))}
              {relatedGrns.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-erp-muted">No receipts posted yet</td>
                </tr>
              )}
            </tbody>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
    documents: (
      <ErpCardSection id={purchaseSectionId('documents')} title="Documents" subtitle="PO attachments and amendments" icon={Paperclip} accent="slate" collapsible defaultOpen={false}>
        <ul className="col-span-2 list-disc space-y-1 pl-5 text-sm text-erp-muted">
          <li>PO print PDF</li>
          <li>Vendor acknowledgement</li>
          <li>Amendment history ({po.revisions.length} revision{po.revisions.length === 1 ? '' : 's'})</li>
        </ul>
        <p className="col-span-2 text-xs text-erp-muted">Demo mode — purchase attachments are not API-backed.</p>
      </ErpCardSection>
    ),
    timeline: (
      <ErpCardSection id={purchaseSectionId('timeline')} title="Timeline" subtitle="PO lifecycle events" icon={ClipboardList} accent="slate" collapsible defaultOpen={false}>
        <PurchaseDocTimeline
          events={[
            { t: 'Created', d: po.createdAt, u: po.createdByName },
            { t: 'Approved', d: po.approvedAt, u: po.approvedByName },
            { t: 'Sent', d: po.sentAt, u: '—' },
            ...relatedGrns.map((g) => ({ t: `GRN ${g.grnNo}`, d: g.grnDate, u: g.createdByName })),
          ]}
        />
      </ErpCardSection>
    ),
    audit: (
      <ErpCardSection id={purchaseSectionId('audit')} title="Amendment audit" subtitle="Revision history" icon={FileEdit} accent="amber" className="col-span-2" collapsible defaultOpen={false}>
        <div className="col-span-2">
          {po.revisions.length === 0 ? (
            <p className="text-xs text-erp-muted">Rev {po.revisionNo} — no prior amendments.</p>
          ) : (
            <PurchaseDataTable>
              <thead>
                <tr>
                  <th>Revision</th>
                  <th>Amended By</th>
                  <th>Date</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {po.revisions.map((rev) => (
                  <tr key={rev.revisionNo}>
                    <td>Rev {rev.revisionNo}</td>
                    <td>{rev.amendedByName}</td>
                    <td>{formatDate(rev.amendedAt)}</td>
                    <td>{rev.reason}</td>
                  </tr>
                ))}
              </tbody>
            </PurchaseDataTable>
          )}
        </div>
      </ErpCardSection>
    ),
  }

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title="Purchase Order"
        description="PO created → approved & released → vendor confirmation → delivery → GRN. Invoice match & payment are Planned."
        recordNo={`${po.poNo} · Rev ${po.revisionNo}`}
        status={poStatusLabel(po.status)}
        statusTone={purchaseStatusTone(po.status)}
        owner={po.createdByName}
        createdDate={formatDate(po.createdAt)}
        createdBy={po.createdByName}
        modifiedDate={po.modifiedAt ? formatDate(po.modifiedAt) : undefined}
        modifiedBy={po.modifiedByName ?? undefined}
        favoritePath={`/purchase/orders/${id}`}
        breadcrumbs={[
          { label: 'Purchase Orders', to: '/purchase/orders' },
          { label: po.poNo },
        ]}
        backLink={{ to: '/purchase/orders', label: 'Back to Purchase Orders' }}
        commandBar={commandBar}
        documentStrip={purchaseStatusStripToDocumentStrip(statusStrip)}
        detailMode
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        stickyFooter={false}
      >
        <PurchaseProcessStagePanel
          currentStep={poProcessStep(po)}
          statusLabel={poStatusLabel(po.status)}
          nextActions={poProcessNext}
        />
        <PurchaseFormSectionNav
          sections={[
            { id: 'general', label: 'General', icon: ClipboardList },
            { id: 'lines', label: 'Lines', icon: Package },
            { id: 'delivery', label: 'Delivery', icon: Truck },
            { id: 'commercial', label: 'Commercial', icon: ClipboardList },
            { id: 'approval', label: 'Approval', icon: CheckCircle },
            { id: 'receipts', label: 'Receipts', icon: Package },
            { id: 'documents', label: 'Documents', icon: Paperclip },
            { id: 'timeline', label: 'Timeline', icon: ClipboardList },
            { id: 'audit', label: 'Audit', icon: FileEdit },
          ]}
          activeId={activeSection}
          onSelect={setActiveSection}
        />
        {sectionContent.general}
        {sectionContent.lines}
        {sectionContent.delivery}
        {sectionContent.commercial}
        {sectionContent.tax}
        {sectionContent.approval}
        {sectionContent.receipts}
        {sectionContent.documents}
        {sectionContent.timeline}
        {sectionContent.audit}
      </PurchaseCardFormShell>
    </>
  )
}

// ─── GRN ────────────────────────────────────────────────────────────────────

export function GrnDocumentPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const grn = usePurchaseStore((s) => (id ? s.getGrn(id) : undefined))
  const getVendor = useMasterStore((s) => s.getVendor)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)

  const [activeSection, setActiveSection] = useState('general')

  if (!grn) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        GRN not found. <Link to="/purchase/grn">Back to register</Link>
      </div>
    )
  }

  const totalReceived = grn.lines.reduce((s, l) => s + l.receivedQty, 0)
  const totalAccepted = grn.lines.reduce((s, l) => s + l.acceptedQty, 0)
  const totalRejected = grn.lines.reduce((s, l) => s + l.rejectedQty, 0)
  const grnValue = grn.lines.reduce((s, l) => s + l.receivedQty * l.rate, 0)
  const grnNextActions = buildGrnNextActions(grn)
  const grnAlerts = buildGrnDocumentAlerts(grn)

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print(), primary: true },
      ]}
      moreActions={[
        { id: 'po', label: 'View PO', icon: Truck, onClick: () => navigate(`/purchase/orders/${grn.poId}`) },
        {
          id: 'qc',
          label: 'Quality Inspection',
          icon: CheckCircle,
          onClick: () => grn.incomingInspectionId && navigate(`/quality/inspections/${grn.incomingInspectionId}`),
          disabled: !grn.incomingInspectionId,
        },
      ]}
    />
  )

  const grnProcessNext = buildGrnProcessNextActions(grn)
  const statusStrip: ErpCardFormStatusItem[] = [
    { label: 'GRN No', value: grn.grnNo, tone: 'neutral' },
    { label: 'Status', value: grnStatusLabel(grn.status), tone: grn.status === 'posted' ? 'success' : grn.status === 'pending_qc' ? 'warning' : 'neutral' },
    { label: 'PO', value: grn.poNo, tone: 'neutral' },
    { label: 'Vendor', value: getVendor(grn.vendorId)?.vendorName ?? '—', tone: 'neutral' },
    { label: 'Received', value: formatNumber(totalReceived), tone: 'info' },
    { label: 'Value', value: formatCurrency(grnValue), tone: 'success' },
    { label: 'QC', value: grn.qcRequired ? 'Required' : 'No', tone: grn.qcRequired ? 'warning' : 'neutral' },
  ]

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      hint="Esc Back"
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="secondary" icon={Truck} onClick={() => navigate(`/purchase/orders/${grn.poId}`)}>View PO</ErpButton>
          <ErpButton type="button" variant="primary" icon={Printer} onClick={() => window.print()}>Print</ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      title="GRN insight"
      metrics={[
        { label: 'Lines', value: String(grn.lines.length), accent: 'blue' },
        { label: 'Received', value: formatNumber(totalReceived), accent: 'blue' },
        { label: 'Value', value: formatCurrency(grnValue), accent: 'green', highlight: true },
        { label: 'QC', value: grn.qcRequired ? 'Required' : 'No', accent: grn.qcRequired ? 'amber' : 'violet' },
      ]}
      summary={[
        { label: 'GRN', value: grn.grnNo },
        { label: 'Status', value: grnStatusLabel(grn.status), highlight: grn.status === 'posted' },
        { label: 'PO', value: grn.poNo },
        { label: 'Vendor', value: getVendor(grn.vendorId)?.vendorName ?? '—' },
        { label: 'Accepted', value: formatNumber(totalAccepted) },
        { label: 'Rejected', value: formatNumber(totalRejected) },
        { label: 'Next Action', value: grnProcessNext[0]?.label ?? grnNextActions[0]?.label ?? '—', highlight: Boolean(grnProcessNext[0] ?? grnNextActions[0]) },
      ]}
      actions={[
        { id: 'po', label: 'View PO', icon: Truck, primary: true, onClick: () => navigate(`/purchase/orders/${grn.poId}`) },
        { id: 'print', label: 'Print', icon: Printer, onClick: () => window.print() },
      ]}
    />
  )

  const sectionContent: Record<string, ReactNode> = {
    general: (
      <>
        <ErpCardSection id={purchaseSectionId('general')} title="General" subtitle="Gate entry, GRN header, and receipt details" icon={ClipboardList} accent="blue" columns={2} collapsible defaultOpen>
          <ErpViewField label="GRN No" value={grn.grnNo} />
          <ErpViewField label="Status" value={grnStatusLabel(grn.status)} />
          <ErpViewField label="GRN Date" value={formatDate(grn.grnDate)} />
          <ErpViewField label="Vendor" value={getVendor(grn.vendorId)?.vendorName} />
          <ErpViewField label="Warehouse" value={getWarehouse(grn.warehouseId)?.warehouseName} />
          <ErpViewField label="PO Reference">
            <TableLink to={`/purchase/orders/${grn.poId}`} className="erp-view-field__link">{grn.poNo}</TableLink>
          </ErpViewField>
          <ErpViewField label="QC Required" value={grn.qcRequired ? 'Yes' : 'No'} />
          <ErpViewField label="Receipt Value" value={formatCurrency(grnValue)} />
          <ErpViewField label="Posted At" value={grn.postedAt ? formatDate(grn.postedAt.slice(0, 10)) : undefined} />
          <ErpViewField label="Tolerance" value={`${grn.excessTolerancePct}%`} />
        </ErpCardSection>
        <div className="mb-3">
          <GrnQrPanel grnId={grn.id} grnNo={grn.grnNo} />
        </div>
        <p className="text-xs text-erp-muted">
          Created by {grn.createdByName} on {formatDate(grn.createdAt)}
          {grn.postedAt ? ` · Posted ${formatDate(grn.postedAt)}` : ''}
        </p>
      </>
    ),
    lines: (
      <ErpCardSection id={purchaseSectionId('lines')} title="Receipt lines" subtitle="Received quantities and QR codes" icon={Package} accent="teal" className="col-span-2" collapsible defaultOpen>
        <div className="col-span-2">
          <PurchaseTableToolbar>
            <span>
              <strong className="text-erp-text">{grn.lines.length}</strong> lines · Received{' '}
              <strong className="text-erp-text">{formatNumber(totalReceived)}</strong> · Value{' '}
              <strong className="text-erp-text">{formatCurrency(grnValue)}</strong>
            </span>
          </PurchaseTableToolbar>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Description</th>
                <th>Warehouse</th>
                <th className="num">Received</th>
                <th className="num">Accepted</th>
                <th className="num">Rejected</th>
                <th className="num">Quarantine</th>
                <th className="num">Rate</th>
                <th className="num">Amount</th>
                <th>QR</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l, i) => {
                const item = getItem(l.itemId)
                return (
                  <tr key={l.id}>
                    <td className="num">{i + 1}</td>
                    <td className="font-mono">{item?.itemCode}</td>
                    <td>{item?.itemName}</td>
                    <td>{getWarehouse(l.warehouseId)?.warehouseCode}</td>
                    <td className="num">{formatNumber(l.receivedQty)}</td>
                    <td className="num">{formatNumber(l.acceptedQty)}</td>
                    <td className="num">{formatNumber(l.rejectedQty)}</td>
                    <td className="num">{formatNumber(l.quarantineQty)}</td>
                    <td className="num">{formatCurrency(l.rate)}</td>
                    <td className="num">{formatCurrency(l.receivedQty * l.rate)}</td>
                    <td>
                      <GrnLineQrCell grnId={grn.id} lineId={l.id} acceptedQty={l.acceptedQty || l.receivedQty} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-erp-surface-alt">
                <td colSpan={9}>Total</td>
                <td className="num">{formatCurrency(grnValue)}</td>
                <td />
              </tr>
            </tfoot>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
    gate: (
      <ErpCardSection id={purchaseSectionId('gate')} title="Gate entry" subtitle="Material delivered → gate entry (Planned fields) + GRN" icon={Truck} accent="amber" columns={2} collapsible defaultOpen>
        <ErpViewField label="Gate Entry No" value="Planned — not assigned in demo" />
        <ErpViewField label="Vehicle No" value="Planned" />
        <ErpViewField label="LR / Challan" value="Planned" />
        <ErpViewField label="Received By" value={grn.createdByName} />
        <p className="col-span-2 text-xs text-erp-muted">
          Canonical step 13: Gate Entry and GRN. GRN lines and posting are available in demo; formal gate-pass capture is Planned.
        </p>
      </ErpCardSection>
    ),
    qc: (
      <ErpCardSection id={purchaseSectionId('qc')} title="Quality inspection" subtitle="Canonical step 14 — inspection before stock post" icon={CheckCircle} accent="green" columns={2} collapsible defaultOpen>
        <ErpViewField label="QC Required" value={grn.qcRequired ? 'Yes' : 'No'} />
        <ErpViewField label="Accepted Qty" value={formatNumber(totalAccepted)} />
        <ErpViewField label="Rejected Qty" value={formatNumber(totalRejected)} />
        <ErpViewField label="Inspection">
          {grn.incomingInspectionId ? (
            <TableLink to={`/quality/inspections/${grn.incomingInspectionId}`} className="erp-view-field__link">View inspection</TableLink>
          ) : grn.status === 'pending_qc' ? (
            <TableLink to="/quality/incoming" className="erp-view-field__link">Open incoming QC queue</TableLink>
          ) : undefined}
        </ErpViewField>
      </ErpCardSection>
    ),
    lot: (
      <ErpCardSection id={purchaseSectionId('lot')} title="Lot tracking" subtitle="Material QR codes" icon={Package} accent="violet" collapsible defaultOpen={false}>
        <p className="col-span-2 text-xs text-erp-muted">Material QR codes are generated per receipt line — see the QR column on Lines.</p>
      </ErpCardSection>
    ),
    putaway: (
      <ErpCardSection id={purchaseSectionId('putaway')} title="Accepted stock posted" subtitle="Canonical step 15 — demo stock post (inventory ledger deferred)" icon={Package} accent="teal" columns={2} collapsible defaultOpen>
        <ErpViewField label="Target Warehouse" value={getWarehouse(grn.warehouseId)?.warehouseName} />
        <ErpViewField label="Stock Post" value={grn.status === 'posted' ? 'Accepted stock posted (demo)' : 'Pending QC / post'} />
      </ErpCardSection>
    ),
    documents: (
      <ErpCardSection id={purchaseSectionId('documents')} title="Documents" subtitle="Receipt attachments" icon={Paperclip} accent="slate" collapsible defaultOpen={false}>
        <ul className="col-span-2 list-disc space-y-1 pl-5 text-sm text-erp-muted">
          <li>Delivery challan</li>
          <li>Vendor invoice copy — step 16 Planned (finance / AP)</li>
          <li>Inspection sheet</li>
        </ul>
        <p className="col-span-2 text-xs text-erp-muted">Demo mode — purchase attachments are not API-backed. Invoice matching and payment are Planned.</p>
      </ErpCardSection>
    ),
    timeline: (
      <ErpCardSection id={purchaseSectionId('timeline')} title="Timeline" subtitle="GRN lifecycle events" icon={ClipboardList} accent="slate" collapsible defaultOpen={false}>
        <PurchaseDocTimeline
          events={[
            { t: 'Created', d: grn.createdAt, u: grn.createdByName },
            { t: 'Posted', d: grn.postedAt, u: grn.createdByName },
          ]}
        />
      </ErpCardSection>
    ),
  }

  return (
    <PurchaseCardFormShell
      title="Gate Entry & GRN"
      description="Material delivered → gate entry (stub) → GRN → quality inspection → accepted stock posted (demo)"
      recordNo={grn.grnNo}
      status={grnStatusLabel(grn.status)}
      statusTone={purchaseStatusTone(grn.status)}
      owner={grn.createdByName}
      createdDate={formatDate(grn.createdAt)}
      createdBy={grn.createdByName}
      favoritePath={`/purchase/grn/${id}`}
      breadcrumbs={[
        { label: 'Gate Entry & GRN', to: '/purchase/grn' },
        { label: grn.grnNo },
      ]}
      backLink={{ to: '/purchase/grn', label: 'Back to Goods Receipts' }}
      commandBar={commandBar}
      documentStrip={purchaseStatusStripToDocumentStrip(statusStrip)}
      detailMode
      factBox={factBox}
      footer={footer}
      collapsibleFactBox
      stickyFooter={false}
    >
      <PurchaseProcessStagePanel
        currentStep={grnProcessStep(grn)}
        statusLabel={grnStatusLabel(grn.status)}
        nextActions={grnProcessNext}
      />
      <PurchaseFormSectionNav
        sections={[
          { id: 'general', label: 'General', icon: ClipboardList },
          { id: 'lines', label: 'Lines', icon: Package },
          { id: 'gate', label: 'Gate', icon: Truck },
          { id: 'qc', label: 'QC', icon: CheckCircle },
          { id: 'putaway', label: 'Stock post', icon: Package },
          { id: 'documents', label: 'Documents', icon: Paperclip },
          { id: 'timeline', label: 'Timeline', icon: ClipboardList },
        ]}
        activeId={activeSection}
        onSelect={setActiveSection}
      />
      {grnAlerts.length > 0 ? (
        <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {grnAlerts.map((a) => a.message).join(' · ')}
        </div>
      ) : null}
      {sectionContent.general}
      {sectionContent.lines}
      {sectionContent.gate}
      {sectionContent.qc}
      {sectionContent.lot}
      {sectionContent.putaway}
      {sectionContent.documents}
      {sectionContent.timeline}
    </PurchaseCardFormShell>
  )
}
