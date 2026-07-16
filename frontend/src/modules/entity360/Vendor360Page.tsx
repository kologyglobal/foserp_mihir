import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ShoppingCart, Star, Truck } from 'lucide-react'
import { Entity360Shell, Entity360Panel } from '../../components/design-system/Entity360Shell'
import { FactBox } from '../../components/design-system/FactBox'
import { QuickActions } from '../../components/design-system/WorkspaceLayout'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { ActiveBadge, TypeBadge } from '../../components/ui/StatusBadge'
import { TableLink } from '../../components/ui/AppLink'
import { useVendor360 } from '../../utils/entity360Metrics'
import { useVendorJobWorkMetrics } from '../../utils/workOrder360Metrics'
import { formatCurrency } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { useMasterStore } from '../../store/masterStore'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'

type Tab = 'overview' | 'purchase' | 'quality' | 'job_work' | 'spend' | 'performance'

export function Vendor360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useVendor360(id)
  const jobWork = useVendorJobWorkMetrics(id)
  const getItem = useMasterStore((s) => s.getItem)
  const [tab, setTab] = useState<Tab>('overview')

  if (!data) return <p className="p-8 text-erp-muted">Vendor not found.</p>

  const { vendor } = data

  return (
    <Entity360Shell
      title={vendor.vendorName}
      subtitle={vendor.vendorCode}
      backTo="/masters/vendors"
      editTo={`/masters/vendors/${vendor.id}/edit`}
      editLabel="Edit Master"
      favoritePath={`/masters/vendors/${vendor.id}`}
      insights={[
        { label: 'Rating', value: `${vendor.rating}/5`, accent: 'amber' },
        { label: 'Open PO', value: data.openPo.length, accent: 'blue' },
        { label: 'On-Time %', value: `${data.onTimePct}%`, accent: data.onTimePct >= 90 ? 'green' : 'amber' },
        { label: 'Quality Score', value: `${data.qualityPct}%`, accent: 'green' },
        { label: 'Spend (YTD)', value: formatCurrency(data.spendYear), accent: 'blue' },
      ]}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Procurement">
            <CommandBarButton icon={ShoppingCart} label="Create PO" onClick={() => navigate('/purchase/orders')} primary />
            <CommandBarButton icon={Truck} label="Open PO Report" onClick={() => navigate('/reports/purchase/open-po')} />
          </CommandBarGroup>
        </CommandBar>
      }
      tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'purchase', label: 'Purchase', count: data.openPo.length },
        { id: 'quality', label: 'Quality', count: data.vendorNcrs.length },
        { id: 'job_work', label: 'Job Work', count: jobWork?.openJwo.length ?? 0 },
        { id: 'spend', label: 'Spend Analysis' },
        { id: 'performance', label: 'Performance' },
      ]}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      activity={data.activity}
      quickActions={
        <QuickActions actions={[
          { label: 'New RFQ', onClick: () => navigate('/purchase/rfqs') },
          { label: 'GRN Register', onClick: () => navigate('/purchase/grns') },
          { label: 'Delayed PO Report', onClick: () => navigate('/reports/purchase/delayed-po') },
        ]} />
      }
      factBoxes={
        <>
          <FactBox title="Overview" fields={[
            { label: 'Rating', value: <><Star className="inline h-3 w-3 text-amber-500" /> {vendor.rating}/5</> },
            { label: 'Lead Time', value: `${vendor.defaultLeadTimeDays} days` },
            { label: 'Payment Terms', value: `${vendor.paymentTermsDays} days` },
            { label: 'Quality Score', value: `${data.qualityPct}%` },
            { label: 'Status', value: <ActiveBadge isActive={vendor.isActive} /> },
            { label: 'Type', value: <TypeBadge value={vendor.vendorType} color="orange" /> },
          ]} />
        </>
      }
    >
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Entity360Panel title="Vendor Profile">
            <div className="space-y-2 p-4 text-[13px]">
              <p><span className="text-erp-muted">GSTIN:</span> {vendor.gstin}</p>
              <p><span className="text-erp-muted">Location:</span> {vendor.city}, {vendor.state}</p>
              <p><span className="text-erp-muted">Contact:</span> {vendor.contactPerson} · {vendor.contactPhone}</p>
              <p><span className="text-erp-muted">Categories:</span> {vendor.suppliedCategories.join(', ')}</p>
            </div>
          </Entity360Panel>
          <Entity360Panel title="Supplied Items" >
            <table className="erp-table">
              <thead><tr><th>Item</th><th>Lead</th><th>Rate</th></tr></thead>
              <tbody>
                {data.maps.slice(0, 8).map((m) => (
                  <tr key={m.id}>
                    <td><TableLink to={`/masters/items/${m.itemId}`}>{getItem(m.itemId)?.itemCode}</TableLink></td>
                    <td>{m.leadTimeDays}d</td>
                    <td>{formatCurrency(m.lastRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
          <Entity360Panel title="Vendor Serial Numbers">
            <div className="p-4">
              <SerialGenealogyPanel vendorId={vendor.id} />
            </div>
          </Entity360Panel>
          <Entity360Panel title="Vendor Documents">
            <div className="p-4">
              <EntityDocumentsPanel entityType="vendor" entityId={vendor.id} entityLabel={vendor.vendorName} showHubLink />
            </div>
          </Entity360Panel>
        </div>
      )}

      {tab === 'purchase' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Entity360Panel title="Open PO">
            <table className="erp-table">
              <thead><tr><th>PO</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                {data.openPo.map((po) => (
                  <tr key={po.id}><td><TableLink to={`/purchase/orders/${po.id}`}>{po.poNo}</TableLink></td><td>{po.status}</td><td>{formatDate(po.createdAt.slice(0, 10))}</td></tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
          <Entity360Panel title="Pending Delivery">
            <table className="erp-table">
              <thead><tr><th>PO</th><th>Expected</th></tr></thead>
              <tbody>
                {data.pendingDelivery.map((d) => (
                  <tr key={d.poId}><td><TableLink to={`/purchase/orders/${d.poId}`}>{d.poNo}</TableLink></td><td className="text-red-600">{formatDate(d.expectedDate)}</td></tr>
                ))}
                {data.pendingDelivery.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-erp-muted">No delayed deliveries</td></tr>}
              </tbody>
            </table>
          </Entity360Panel>
        </div>
      )}

      {tab === 'quality' && (
        <Entity360Panel title="Quality & NCR">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Rejected Qty</p><p className="text-xl font-bold">{data.rejectedQty}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Open NCR</p><p className="text-xl font-bold">{data.vendorNcrs.length}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Quality Score</p><p className="text-xl font-bold">{data.qualityPct}%</p></div>
          </div>
          <table className="erp-table">
            <thead><tr><th>NCR</th><th>Status</th><th>Date</th></tr></thead>
            <tbody>
              {data.vendorNcrs.map((n) => (
                <tr key={n.id}><td><TableLink to={`/quality/ncr/${n.id}`}>{n.ncrNo}</TableLink></td><td>{n.status}</td><td>{formatDate(n.createdAt.slice(0, 10))}</td></tr>
              ))}
              {data.vendorNcrs.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-erp-muted">No vendor NCRs</td></tr>}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'job_work' && jobWork && (
        <Entity360Panel title="Job Work Performance">
          <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 lg:grid-cols-4">
            {[
              ['Open JWO', jobWork.openJwo.length],
              ['Material with Vendor', jobWork.materialWithVendor],
              ['Pending Return', jobWork.pendingReturn],
              ['Job Work Spend', formatCurrency(jobWork.jobWorkSpend)],
              ['Rejection %', `${jobWork.rejectionPct}%`],
              ['On-Time Return %', `${jobWork.onTimeReturnPct}%`],
              ['Avg Turnaround', `${jobWork.avgTurnaroundDays} days`],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-lg border p-3">
                <p className="text-xs text-erp-muted">{label}</p>
                <p className="text-xl font-bold">{val}</p>
              </div>
            ))}
          </div>
          <table className="erp-table">
            <thead><tr><th>JWO</th><th>WO</th><th>Balance</th><th>Status</th></tr></thead>
            <tbody>
              {jobWork.vendorJwos.slice(0, 10).map((j) => (
                <tr key={j.id}>
                  <td><TableLink to={`/job-work/${j.workOrderId}`}>{j.jwoNo}</TableLink></td>
                  <td>{j.sourceWoNo}</td>
                  <td className="num">{j.balanceQty}</td>
                  <td>{j.status}</td>
                </tr>
              ))}
              {jobWork.vendorJwos.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-center text-erp-muted">No job work orders for this vendor</td></tr>
              )}
            </tbody>
          </table>
          <p className="p-4 text-sm">
            <TableLink to={`/job-work/vendors/${id}`}>Open vendor job work workspace →</TableLink>
          </p>
        </Entity360Panel>
      )}

      {tab === 'spend' && (
        <Entity360Panel title="Spend Analysis">
          <div className="grid grid-cols-3 gap-3 p-4">
            <div className="rounded-lg border border-erp-border p-4"><p className="text-xs text-erp-muted">This Month</p><p className="text-xl font-bold">{formatCurrency(data.spendMonth)}</p></div>
            <div className="rounded-lg border border-erp-border p-4"><p className="text-xs text-erp-muted">This Quarter</p><p className="text-xl font-bold">{formatCurrency(data.spendQuarter)}</p></div>
            <div className="rounded-lg border border-erp-border p-4"><p className="text-xs text-erp-muted">This Year</p><p className="text-xl font-bold">{formatCurrency(data.spendYear)}</p></div>
          </div>
        </Entity360Panel>
      )}

      {tab === 'performance' && (
        <Entity360Panel title="Vendor Performance">
          <div className="grid grid-cols-2 gap-4 p-4 lg:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 text-center"><p className="text-xs text-erp-muted">On-Time Delivery</p><p className="text-3xl font-bold text-emerald-700">{data.onTimePct}%</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-center"><p className="text-xs text-erp-muted">Quality</p><p className="text-3xl font-bold text-blue-700">{data.qualityPct}%</p></div>
            <div className="rounded-xl border border-erp-border p-4 text-center"><p className="text-xs text-erp-muted">Closed PO</p><p className="text-3xl font-bold">{data.closedPo.length}</p></div>
          </div>
          <p className="px-4 pb-4 text-[13px] text-erp-muted">Price trend analysis available when PO history exceeds 6 months.</p>
        </Entity360Panel>
      )}
    </Entity360Shell>
  )
}
