import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, ClipboardList, Package, Plus, Star, Truck } from 'lucide-react'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpButton } from '../../components/erp/ErpButton'
import { ErpCardSection } from '../../components/erp/card-form/ErpCardSection'
import { ErpStickySaveBar } from '../../components/erp/card-form/ErpStickySaveBar'
import { ErpViewField } from '../../components/erp/card-form/ErpViewField'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { purchaseBreadcrumbs } from '../../utils/purchaseNavigation'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { PURCHASE_RETURN_REASON_LABELS, computeLandedCostPerUnit } from '../../types/purchase'
import { TableLink } from '../../components/ui/AppLink'
import { Input } from '../../components/forms/Inputs'
import type { ReactNode } from 'react'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDataTable,
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseEnterpriseFactBox,
  PurchaseFormSectionNav,
  purchaseSectionId,
} from '@/components/purchase/PurchaseEnterpriseFormKit'
import { formatStatus } from '../../components/ui/Badge'

function PurchaseTable({ headers, rows }: { headers: string[]; rows: ReactNode[][] }) {
  return (
    <PurchaseDataTable>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={headers.length} className="dyn-empty-hint">
              No records
            </td>
          </tr>
        ) : (
          rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j}>{c}</td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </PurchaseDataTable>
  )
}

export function VendorQuotationListPage() {
  const navigate = useNavigate()
  const quotes = usePurchaseStore((s) => s.vendorQuotations)
  const rfqs = usePurchaseStore((s) => s.rfqs)
  const vendors = useMasterStore((s) => s.vendors)
  const [search, setSearch] = useState('')

  const rows = useMemo(
    () =>
      quotes.filter((q) => {
        const v = vendors.find((x) => x.id === q.vendorId)
        const rfq = rfqs.find((r) => r.id === q.rfqId)
        const hay = `${q.vendorQuoteNo} ${v?.vendorName} ${rfq?.rfqNo}`.toLowerCase()
        return !search || hay.includes(search.toLowerCase())
      }),
    [quotes, rfqs, vendors, search],
  )

  return (
    <OperationalPageShell
      title="Vendor Quotations"
      description="Record vendor responses against RFQs"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Vendor Quotations')}
      favoritePath="/purchase/vendor-quotations"
      commandBar={<ErpButton icon={Plus} onClick={() => navigate('/purchase/rfqs')}>From RFQ</ErpButton>}
      filterBar={<Input placeholder="Search quotes…" value={search} onChange={(e) => setSearch(e.target.value)} />}
      insights={[
        { label: 'Quotes', value: quotes.length, accent: 'blue' },
        { label: 'Filtered', value: rows.length, accent: 'slate' },
      ]}
    >
      <PurchaseTable
        headers={['Vendor Quote No', 'RFQ No', 'Vendor', 'Quote Date', 'Valid Till', 'Total Value', 'Status']}
        rows={rows.map((q) => [
          <TableLink key={q.id} to={`/purchase/vendor-quotations/${q.id}`}>{q.vendorQuoteNo}</TableLink>,
          rfqs.find((r) => r.id === q.rfqId)?.rfqNo ?? '—',
          vendors.find((v) => v.id === q.vendorId)?.vendorName ?? q.vendorId,
          formatDate(q.quoteDate),
          formatDate(q.validTill),
          formatCurrency(q.totalValue),
          formatStatus(q.status),
        ])}
      />
    </OperationalPageShell>
  )
}

export function VendorQuotationDetailPage() {
  const { id } = useParams()
  const quote = usePurchaseStore((s) => (id ? s.getVendorQuotation(id) : undefined))
  const rfq = usePurchaseStore((s) => (quote ? s.getRfq(quote.rfqId) : undefined))
  const vendor = useMasterStore((s) => s.vendors.find((v) => v.id === quote?.vendorId))
  const [activeSection, setActiveSection] = useState('general')
  const navigate = useNavigate()

  if (!quote) {
    return (
      <OperationalPageShell title="Vendor Quotation" variant="dynamics" breadcrumbs={purchaseBreadcrumbs('Not Found')}>
        <p>Quote not found.</p>
      </OperationalPageShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title="Vendor Quotation"
      description="Vendor response detail and conversion to PO"
      recordNo={quote.vendorQuoteNo}
      status={formatStatus(quote.status)}
      statusTone={purchaseStatusTone(quote.status)}
      company={vendor?.vendorName}
      favoritePath={`/purchase/vendor-quotations/${quote.id}`}
      breadcrumbs={[
        { label: 'Vendor Quotations', to: '/purchase/vendor-quotations' },
        { label: quote.vendorQuoteNo },
      ]}
      detailMode
      documentStrip={[
        { label: 'Quote', value: quote.vendorQuoteNo, highlight: true },
        { label: 'RFQ', value: rfq?.rfqNo ?? '—' },
        { label: 'Vendor', value: vendor?.vendorName ?? '—' },
        { label: 'Total', value: formatCurrency(quote.totalValue), highlight: true },
      ]}
      factBox={
        <PurchaseEnterpriseFactBox
          title="Quote insight"
          summary={[
            { label: 'Quote', value: quote.vendorQuoteNo },
            { label: 'Vendor', value: vendor?.vendorName ?? '—' },
            { label: 'RFQ', value: rfq?.rfqNo ?? '—' },
            { label: 'Total', value: formatCurrency(quote.totalValue), highlight: true },
          ]}
          actions={[
            { id: 'compare', label: 'Compare', icon: ClipboardList, onClick: () => navigate(`/purchase/comparison/${quote.rfqId}`) },
            {
              id: 'po',
              label: 'Create PO',
              icon: Truck,
              primary: true,
              onClick: () => navigate(`/purchase/orders/new?rfqId=${quote.rfqId}&vendorId=${quote.vendorId}`),
            },
          ]}
        />
      }
      footer={
        <ErpStickySaveBar
          sticky={false}
          actions={
            <>
              <ErpButton onClick={() => navigate(`/purchase/comparison/${quote.rfqId}`)}>Include in Comparison</ErpButton>
              <ErpButton
                variant="primary"
                onClick={() => navigate(`/purchase/orders/new?rfqId=${quote.rfqId}&vendorId=${quote.vendorId}`)}
              >
                Create PO
              </ErpButton>
            </>
          }
        />
      }
      collapsibleFactBox
    >
      <PurchaseFormSectionNav
        sections={[
          { id: 'general', label: 'General', icon: ClipboardList },
          { id: 'lines', label: 'Lines', icon: Package },
        ]}
        activeId={activeSection}
        onSelect={setActiveSection}
      />
      <ErpCardSection
        id={purchaseSectionId('general')}
        title="General"
        subtitle="Quote header and commercial snapshot"
        icon={ClipboardList}
        accent="blue"
        columns={2}
        collapsible
        defaultOpen
      >
        <ErpViewField label="RFQ">
          {rfq ? (
            <TableLink to={`/purchase/rfqs/${rfq.id}`} className="erp-view-field__link">
              {rfq.rfqNo}
            </TableLink>
          ) : undefined}
        </ErpViewField>
        <ErpViewField label="Vendor" value={vendor?.vendorName} />
        <ErpViewField label="Payment Terms" value={quote.paymentTerms} />
        <ErpViewField label="Total" value={formatCurrency(quote.totalValue)} />
        <ErpViewField label="Quote Date" value={formatDate(quote.quoteDate)} />
        <ErpViewField label="Valid Till" value={formatDate(quote.validTill)} />
      </ErpCardSection>
      <ErpCardSection
        id={purchaseSectionId('lines')}
        title="Quoted Lines"
        subtitle="Item rates and landed cost"
        icon={Package}
        accent="teal"
        collapsible
        defaultOpen
      >
        <div className="col-span-2">
          <PurchaseTable
            headers={['Item', 'Qty', 'Rate', 'Landed', 'Delivery Days']}
            rows={quote.lines.map((l) => {
              const item = useMasterStore.getState().getItem(l.itemId)
              return [
                item?.itemCode ?? l.itemId,
                l.qty,
                formatCurrency(l.quotedRate),
                formatCurrency(computeLandedCostPerUnit(l.quotedRate, l.qty, l.freightAmount, l.gstPct)),
                l.deliveryDays,
              ]
            })}
          />
        </div>
      </ErpCardSection>
    </PurchaseCardFormShell>
  )
}

export function QuotationComparisonPage() {
  const { rfqId } = useParams()
  const rfq = usePurchaseStore((s) => (rfqId ? s.getRfq(rfqId) : undefined))
  const getVendorComparison = usePurchaseStore((s) => s.getVendorComparison)
  const comparison = useMemo(
    () => (rfq ? getVendorComparison(rfq.id) : []),
    [rfq, getVendorComparison, rfq?.quotes.length],
  )
  const vendors = useMasterStore((s) => s.vendors)
  const createPoFromRfq = usePurchaseStore((s) => s.createPoFromRfq)
  const setRfqRecommendation = usePurchaseStore((s) => s.setRfqRecommendation)
  const navigate = useNavigate()

  const lowest = comparison[0]
  const fastest = [...comparison].sort((a, b) => a.leadTimeDays - b.leadTimeDays)[0]
  const bestRated = comparison.find((c) => c.isPreferred) ?? comparison[0]

  if (!rfq) {
    return (
      <OperationalPageShell title="Comparison" variant="dynamics" breadcrumbs={purchaseBreadcrumbs('Not Found')}>
        <p>RFQ not found.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title="Quotation Comparison"
      description={`RFQ ${rfq.rfqNo} — compare vendor quotes side by side`}
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Comparison', { label: 'RFQs', to: '/purchase/rfqs' })}
      favoritePath={`/purchase/comparison/${rfq.id}`}
      insights={[
        { label: 'Quotes', value: comparison.length, accent: 'blue' },
        { label: 'Lowest', value: lowest?.vendorName ?? '—', accent: 'green' },
        { label: 'Fastest', value: fastest?.vendorName ?? '—', accent: 'amber' },
      ]}
      commandBar={
        lowest ? (
          <ErpButton
            variant="primary"
            onClick={() => {
              setRfqRecommendation(rfq.id, lowest.vendorId, 'Lowest landed cost selected from comparison')
              const r = createPoFromRfq(rfq.id, lowest.vendorId)
              if (r.ok && r.poId) navigate(`/purchase/orders/${r.poId}`)
            }}
          >
            Create PO — {lowest.vendorName}
          </ErpButton>
        ) : null
      }
    >
      <div className="mb-4 grid gap-4 md:grid-cols-3">
        <div className="rounded border border-erp-border bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase text-erp-muted">Lowest Landed Cost</p>
          <p className="font-bold text-erp-text">{lowest?.vendorName ?? '—'}</p>
        </div>
        <div className="rounded border border-erp-border bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase text-erp-muted">Fastest Delivery</p>
          <p className="font-bold text-erp-text">{fastest?.vendorName ?? '—'}</p>
        </div>
        <div className="rounded border border-erp-border bg-white px-4 py-3">
          <p className="text-xs font-semibold uppercase text-erp-muted">Best Vendor Rating</p>
          <p className="flex items-center gap-1 font-bold text-erp-text">
            {bestRated?.vendorName ?? '—'} <Star className="h-3.5 w-3.5 text-amber-500" />
          </p>
        </div>
      </div>
      <PurchaseTable
        headers={['Rank', 'Vendor', 'Item', 'Unit Rate', 'Landed Cost', 'Delivery Days', 'Payment Terms', '']}
        rows={comparison.map((r) => [
          r.rank,
          r.vendorName,
          r.itemCode,
          formatCurrency(r.quotedRate),
          formatCurrency(r.landedCostPerUnit),
          r.leadTimeDays,
          r.paymentTerms,
          <ErpButton
            key={r.vendorId}
            size="sm"
            onClick={() => {
              setRfqRecommendation(rfq.id, r.vendorId, 'Selected from comparison')
              const res = createPoFromRfq(rfq.id, r.vendorId)
              if (res.ok && res.poId) navigate(`/purchase/orders/${res.poId}`)
            }}
          >
            Select <ArrowRight className="ml-1 h-3 w-3" />
          </ErpButton>,
        ])}
      />
      <p className="mt-4 text-sm text-erp-muted">
        Vendors invited: {rfq.vendorIds.map((id) => vendors.find((v) => v.id === id)?.vendorName ?? id).join(', ')}
      </p>
    </OperationalPageShell>
  )
}

export function PurchaseReturnListPage() {
  const returns = usePurchaseStore((s) => s.purchaseReturns)
  const vendors = useMasterStore((s) => s.vendors)
  const navigate = useNavigate()

  return (
    <OperationalPageShell
      title="Purchase Returns"
      description="Return rejected or excess material to vendors"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Returns')}
      favoritePath="/purchase/returns"
      insights={[{ label: 'Returns', value: returns.length, accent: 'blue' }]}
      commandBar={<ErpButton onClick={() => navigate('/purchase/grn')}>Create from GRN</ErpButton>}
    >
      <PurchaseTable
        headers={['Return No', 'Date', 'Vendor', 'Reason', 'Status']}
        rows={returns.map((r) => [
          <TableLink key={r.id} to={`/purchase/returns/${r.id}`}>{r.returnNo}</TableLink>,
          formatDate(r.returnDate),
          vendors.find((v) => v.id === r.vendorId)?.vendorName ?? r.vendorId,
          PURCHASE_RETURN_REASON_LABELS[r.returnReason],
          formatStatus(r.status),
        ])}
      />
    </OperationalPageShell>
  )
}

export function PurchaseReturnDetailPage() {
  const { id } = useParams()
  const ret = usePurchaseStore((s) => (id ? s.getPurchaseReturn(id) : undefined))
  const approve = usePurchaseStore((s) => s.approvePurchaseReturn)
  const dispatch = usePurchaseStore((s) => s.dispatchPurchaseReturn)
  const vendor = useMasterStore((s) => s.vendors.find((v) => v.id === ret?.vendorId))

  if (!ret) {
    return (
      <OperationalPageShell title="Purchase Return" variant="dynamics" breadcrumbs={purchaseBreadcrumbs('Not Found')}>
        <p>Return not found.</p>
      </OperationalPageShell>
    )
  }

  return (
    <OperationalPageShell
      title={ret.returnNo}
      description={PURCHASE_RETURN_REASON_LABELS[ret.returnReason]}
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs(ret.returnNo, { label: 'Returns', to: '/purchase/returns' })}
      favoritePath={`/purchase/returns/${ret.id}`}
      commandBar={
        <>
          {ret.status === 'draft' && <ErpButton onClick={() => approve(ret.id)}>Approve</ErpButton>}
          {ret.status === 'approved' && (
            <ErpButton variant="primary" onClick={() => dispatch(ret.id)}>
              Dispatch Return
            </ErpButton>
          )}
        </>
      }
    >
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ErpViewField label="Vendor" value={vendor?.vendorName} />
        <ErpViewField label="Status" value={formatStatus(ret.status)} />
        <ErpViewField label="Return Date" value={formatDate(ret.returnDate)} />
        <ErpViewField label="Reason" value={PURCHASE_RETURN_REASON_LABELS[ret.returnReason]} />
      </div>
      <PurchaseTable
        headers={['Item', 'Return Qty', 'Reason']}
        rows={ret.lines.map((l) => {
          const item = useMasterStore.getState().getItem(l.itemId)
          return [item?.itemCode ?? l.itemId, l.returnQty, PURCHASE_RETURN_REASON_LABELS[l.reason]]
        })}
      />
    </OperationalPageShell>
  )
}

export function VendorPerformancePage() {
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const grns = usePurchaseStore((s) => s.grns)
  const vendors = useMasterStore((s) => s.vendors)
  const getVendorPerformanceReport = usePurchaseStore((s) => s.getVendorPerformanceReport)
  const rows = useMemo(
    () => getVendorPerformanceReport(),
    [purchaseOrders, grns, vendors, getVendorPerformanceReport],
  )

  return (
    <OperationalPageShell
      title="Vendor Performance"
      description="Vendor scorecard from PO, GRN and QC history"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Vendor Performance')}
      favoritePath="/purchase/vendor-performance"
      insights={[{ label: 'Vendors', value: rows.length, accent: 'blue' }]}
    >
      <PurchaseTable
        headers={['Vendor', 'On-Time %', 'Rejection %', 'Avg Lead', 'Price Var %', 'Total PO', 'Open PO', 'Rating', 'Last Purchase']}
        rows={rows.map((r) => [
          <Link key={r.vendorId} to={`/entity360/vendors/${r.vendorId}/360`}>{r.vendorName}</Link>,
          `${r.onTimePct}%`,
          `${r.rejectionPct ?? 0}%`,
          r.avgLeadDays,
          `${r.priceVariancePct ?? 0}%`,
          formatCurrency(r.totalPoValue ?? 0),
          formatCurrency(r.openPoValue ?? 0),
          `${r.rating ?? 4}/5`,
          r.lastPurchaseDate ? formatDate(r.lastPurchaseDate) : '—',
        ])}
      />
    </OperationalPageShell>
  )
}

export function PurchaseComparisonIndexPage() {
  const navigate = useNavigate()
  const allRfqs = usePurchaseStore((s) => s.rfqs)
  const rfqs = useMemo(() => allRfqs.filter((r) => r.quotes.length > 0), [allRfqs])

  return (
    <OperationalPageShell
      title="Quotation Comparison"
      badge="Purchase"
      variant="dynamics"
      breadcrumbs={purchaseBreadcrumbs('Comparison')}
      favoritePath="/purchase/comparison"
      insights={[{ label: 'RFQs with quotes', value: rfqs.length, accent: 'blue' }]}
    >
      <p className="mb-3 text-sm text-erp-muted">Select an RFQ with vendor responses to compare.</p>
      <PurchaseTable
        headers={['RFQ No', 'Status', 'Quotes']}
        rows={rfqs.map((r) => [
          <TableLink key={r.id} to={`/purchase/comparison/${r.id}`}>{r.rfqNo}</TableLink>,
          formatStatus(r.status),
          r.quotes.length,
        ])}
      />
      {rfqs[0] && (
        <ErpButton className="mt-3" onClick={() => navigate(`/purchase/comparison/${rfqs[0]!.id}`)}>
          Open Latest Comparison
        </ErpButton>
      )}
    </OperationalPageShell>
  )
}
