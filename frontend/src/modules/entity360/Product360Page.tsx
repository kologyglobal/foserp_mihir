import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Box, Factory, ShieldCheck, Truck } from 'lucide-react'
import { Entity360Shell, Entity360Panel } from '../../components/design-system/Entity360Shell'
import { FactBox } from '../../components/design-system/FactBox'
import { QuickActions } from '../../components/design-system/WorkspaceLayout'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { Badge } from '../../components/ui/Badge'
import { TableLink } from '../../components/ui/AppLink'
import { useProduct360 } from '../../utils/entity360Metrics'
import { PRODUCT_STATUS_LABELS } from '../../types/productMaster'
import { bom360Path } from '../../config/entity360Routes'
import { EntityDocumentsPanel, useEntityDocumentCount } from '../../components/dms/EntityDocumentsPanel'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
type Tab = 'overview' | 'revision' | 'bom' | 'routing' | 'cost' | 'quality' | 'sales' | 'production' | 'dispatch' | 'documents' | 'warranty'

export function Product360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useProduct360(id)
  const [tab, setTab] = useState<Tab>('overview')
  const docCount = useEntityDocumentCount('product', id)

  if (!data) return <p className="p-8 text-erp-muted">Product not found.</p>

  const { product } = data

  return (
    <Entity360Shell
      title={product.productName}
      subtitle={product.productCode}
      backTo="/masters/products"
      editTo={`/masters/products/${product.id}/edit`}
      editLabel="Edit Master"
      favoritePath={`/masters/products/${product.id}`}
      insights={[
        { label: 'Status', value: PRODUCT_STATUS_LABELS[product.status], accent: 'blue' },
        { label: 'Standard Cost', value: formatCurrency(data.standardCost), accent: 'green' },
        { label: 'FG On Hand', value: formatNumber(data.fgOnHand), accent: 'blue' },
        { label: 'Open SO', value: data.orders.length, accent: 'blue' },
        { label: 'Active WO', value: data.wos.filter((w) => !['closed', 'cancelled'].includes(w.status)).length, accent: 'amber' },
      ]}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Product">
            <CommandBarButton icon={Box} label="Released BOM" onClick={() => data.releasedBom && navigate(bom360Path(data.releasedBom.id))} primary />
            <CommandBarButton icon={Factory} label="Work Orders" onClick={() => navigate('/work-orders')} />
            <CommandBarButton icon={Truck} label="Dispatch" onClick={() => navigate('/dispatch/register')} />
          </CommandBarGroup>
        </CommandBar>
      }
      tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'revision', label: 'Revision', count: data.revisions.length },
        { id: 'bom', label: 'BOM', count: data.allBoms.length },
        { id: 'routing', label: 'Routing', count: data.routings.length },
        { id: 'cost', label: 'Cost' },
        { id: 'quality', label: 'Quality' },
        { id: 'sales', label: 'Sales', count: data.orders.length },
        { id: 'production', label: 'Production', count: data.wos.length },
        { id: 'dispatch', label: 'Dispatch', count: data.productDispatches.length },
        { id: 'documents', label: 'Documents', count: docCount },
        { id: 'warranty', label: 'Warranty' },
      ]}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      activity={data.activity}
      quickActions={
        <QuickActions actions={[
          { label: 'Run MRP', onClick: () => navigate('/mrp/run') },
          { label: 'Create WO', onClick: () => navigate('/work-orders/create-from-mrp') },
          { label: 'Sales Orders', onClick: () => navigate('/sales/orders') },
        ]} />
      }
      factBoxes={
        <>
          <FactBox title="Product Overview" fields={[
            { label: 'Family', value: product.productFamily },
            { label: 'Status', value: <Badge color="blue">{PRODUCT_STATUS_LABELS[product.status]}</Badge> },
            { label: 'FG Item', value: data.fgItem?.itemCode ?? '—' },
            { label: 'FG Stock', value: formatNumber(data.fgOnHand) },
          ]} />
          <FactBox title="Manufacturing Links" fields={[
            { label: 'Released BOM', value: data.releasedBom ? `${data.releasedBom.bomNo} Rev ${data.releasedBom.revision}` : '—' },
            { label: 'Routings', value: data.routings.length },
            { label: 'Revisions', value: data.revisions.length },
          ]} />
        </>
      }
    >
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Entity360Panel title="Product Intelligence">
            <div className="space-y-2 p-4 text-[13px]">
              <p>{product.specifications}</p>
              <p><span className="text-erp-muted">Capacity:</span> {product.capacity}</p>
              <p><span className="text-erp-muted">Standard Cost:</span> {formatCurrency(data.standardCost)}</p>
            </div>
          </Entity360Panel>
          <Entity360Panel title="Cross-Module Snapshot">
            <div className="grid grid-cols-2 gap-2 p-4">
              {[
                ['Sales Orders', data.orders.length],
                ['Work Orders', data.wos.length],
                ['Dispatches', data.productDispatches.length],
                ['BOM Revisions', data.allBoms.length],
              ].map(([l, v]) => (
                <div key={String(l)} className="rounded border p-2 text-center"><p className="text-[10px] uppercase text-erp-muted">{l}</p><p className="font-bold">{v}</p></div>
              ))}
            </div>
          </Entity360Panel>
        </div>
      )}

      {tab === 'revision' && (
        <Entity360Panel title="Product Revisions">
          <table className="erp-table">
            <thead><tr><th>Rev</th><th>Reason</th><th>Date</th><th>By</th></tr></thead>
            <tbody>
              {data.revisions.map((r) => (
                <tr key={r.id}><td>{r.revisionNo}</td><td>{r.revisionReason}</td><td>{formatDate(r.effectiveFrom)}</td><td>{r.engineeringOwner}</td></tr>
              ))}
              {data.revisions.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-erp-muted">No revision history</td></tr>}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'bom' && (
        <Entity360Panel title="BOM Versions">
          <table className="erp-table">
            <thead><tr><th>BOM</th><th>Revision</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.allBoms.map((b) => (
                <tr key={b.id}>
                  <td>{b.bomNo}</td><td>{b.revision}</td><td>{b.status}</td>
                  <td><TableLink to={bom360Path(b.id)}>Open BOM 360</TableLink></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'routing' && (
        <Entity360Panel title="Routing Versions">
          <table className="erp-table">
            <thead><tr><th>Routing</th><th>Revision</th><th>Status</th></tr></thead>
            <tbody>
              {data.routings.map((r) => (
                <tr key={r.id}><td>{r.routingNo}</td><td>{r.revision}</td><td>{r.status}</td></tr>
              ))}
              {data.routings.length === 0 && <tr><td colSpan={3} className="py-6 text-center text-erp-muted">No routings</td></tr>}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'cost' && (
        <Entity360Panel title="Standard Cost Breakdown">
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4">
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Material</p><p className="text-lg font-bold">{formatCurrency(data.costBreakdown.materialCost)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Labor</p><p className="text-lg font-bold">{formatCurrency(data.costBreakdown.laborCost)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Overhead</p><p className="text-lg font-bold">{formatCurrency(data.costBreakdown.overheadCost)}</p></div>
            <div className="rounded-lg border p-3"><p className="text-xs text-erp-muted">Machine</p><p className="text-lg font-bold">{formatCurrency(data.costBreakdown.machineCost)}</p></div>
          </div>
        </Entity360Panel>
      )}

      {tab === 'quality' && (
        <Entity360Panel title="Quality Control">
          <div className="space-y-2 p-4 text-[13px]">
            <p className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-erp-primary" /> Final inspection: {product.quality.finalInspectionPlanName ?? '—'}</p>
            <p>QC plan: {product.quality.qcPlanName || '—'}</p>
            <p>Customer approval: {product.quality.customerApprovalRequired ? 'Required' : 'Not required'}</p>
          </div>
        </Entity360Panel>
      )}

      {tab === 'sales' && (
        <Entity360Panel title="Sales Orders">
          <table className="erp-table">
            <thead><tr><th>SO</th><th>Qty</th><th>Required</th><th>Status</th></tr></thead>
            <tbody>
              {data.orders.map((so) => (
                <tr key={so.id}><td><TableLink to={`/sales/orders/${so.id}`}>{so.salesOrderNo}</TableLink></td><td className="num">{so.qty}</td><td>{formatDate(so.requiredDate)}</td><td>{so.status}</td></tr>
              ))}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'production' && (
        <Entity360Panel title="Production Work Orders">
          <table className="erp-table">
            <thead><tr><th>WO</th><th>Qty</th><th>Finish</th><th>Status</th></tr></thead>
            <tbody>
              {data.wos.map((wo) => (
                <tr key={wo.id}><td><TableLink to={`/work-orders/${wo.id}`}>{wo.woNo}</TableLink></td><td className="num">{wo.qty}</td><td>{formatDate(wo.plannedFinishDate)}</td><td>{wo.status}</td></tr>
              ))}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'dispatch' && (
        <Entity360Panel title="Dispatch History">
          <table className="erp-table">
            <thead><tr><th>Dispatch</th><th>Customer</th><th>Plan Date</th><th>Status</th></tr></thead>
            <tbody>
              {data.productDispatches.map((d) => (
                <tr key={d.id}><td><TableLink to={`/dispatch/${d.id}`}>{d.dispatchNo}</TableLink></td><td>{d.customerName}</td><td>{formatDate(d.plannedDate)}</td><td>{d.status}</td></tr>
              ))}
              {data.productDispatches.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-erp-muted">No dispatches yet</td></tr>}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'documents' && product.id && (
        <EntityDocumentsPanel entityType="product" entityId={product.id} />
      )}

      {tab === 'warranty' && (
        <Entity360Panel title="Warranty">
          <p className="p-6 text-[13px] text-erp-muted">Warranty cases and service history will appear here when the service module is enabled.</p>
        </Entity360Panel>
      )}
    </Entity360Shell>
  )
}
