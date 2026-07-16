import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowDownToLine, Package, ShoppingCart, TrendingDown } from 'lucide-react'
import { Entity360Shell, Entity360Panel } from '../../components/design-system/Entity360Shell'
import { FactBox } from '../../components/design-system/FactBox'
import { QuickActions } from '../../components/design-system/WorkspaceLayout'
import { Timeline } from '../../components/design-system/Timeline'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { ActiveBadge, TypeBadge } from '../../components/ui/StatusBadge'
import { TableLink } from '../../components/ui/AppLink'
import { useItem360 } from '../../utils/entity360Metrics'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { useMasterStore } from '../../store/masterStore'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { EntityDocumentsPanel } from '../../components/dms/EntityDocumentsPanel'

type Tab = 'overview' | 'inventory' | 'purchase' | 'consumption' | 'mrp' | 'transactions' | 'timeline'

export function Item360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useItem360(id)
  const getVendor = useMasterStore((s) => s.getVendor)
  const [tab, setTab] = useState<Tab>('overview')

  if (!data) return <p className="p-8 text-erp-muted">Item not found.</p>

  const { item } = data
  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'inventory', label: 'Inventory', count: data.warehouseBreakdown.length },
    { id: 'purchase', label: 'Purchase', count: data.openPo.length + data.openPr.length },
    { id: 'consumption', label: 'Consumption' },
    { id: 'mrp', label: 'MRP', count: data.mrpLines.length },
    { id: 'transactions', label: 'Transactions', count: data.movements.length },
    { id: 'timeline', label: 'Timeline' },
  ]

  return (
    <Entity360Shell
      title={item.itemName}
      subtitle={item.itemCode}
      backTo="/masters/items"
      backLabel="Item Master"
      editTo={`/masters/items/${item.id}/edit`}
      editLabel="Edit Master"
      favoritePath={`/masters/items/${item.id}`}
      insights={[
        { label: 'On Hand', value: formatNumber(data.onHand), accent: 'blue' },
        { label: 'Available', value: formatNumber(data.available), accent: 'green' },
        { label: 'Stock Value', value: formatCurrency(data.stockValue), accent: 'blue' },
        { label: 'MRP Shortage', value: formatNumber(data.shortage), accent: data.shortage > 0 ? 'red' : 'green' },
        { label: 'Open PO', value: data.openPo.length, accent: 'amber' },
      ]}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="Actions">
            <CommandBarButton icon={ArrowDownToLine} label="Material Inward" onClick={() => navigate('/inventory/inward')} primary />
            <CommandBarButton icon={Package} label="Stock Ledger" onClick={() => navigate(`/inventory/stock/${item.id}`)} />
            <CommandBarButton icon={ShoppingCart} label="Create PR" onClick={() => navigate('/purchase/requisitions/new')} />
            <CommandBarButton icon={TrendingDown} label="MRP Workbench" onClick={() => navigate('/mrp/workbench')} />
          </CommandBarGroup>
          <CommandBarGroup label="QR">
            <EntityQrToolbar
              entityType="ITEM_BATCH"
              entityId={item.id}
              displayCode={item.itemCode}
              metadata={{ itemId: item.id, itemCode: item.itemCode, itemName: item.itemName }}
              payload={{ item: item.itemCode }}
            />
          </CommandBarGroup>
        </CommandBar>
      }
      tabs={tabs}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      activity={data.activity}
      quickActions={
        <QuickActions actions={[
          { label: 'Issue to WO', onClick: () => navigate('/inventory/issue') },
          { label: 'Adjust Stock', onClick: () => navigate('/inventory/adjustment') },
          { label: 'View Reservations', onClick: () => navigate('/inventory/reservations') },
          { label: 'Run MRP', onClick: () => navigate('/mrp/run') },
        ]} />
      }
      factBoxes={
        <>
          <FactBox
            title="Overview"
            fields={[
              { label: 'Category', value: data.categoryName },
              { label: 'Status', value: <ActiveBadge isActive={item.isActive} /> },
              { label: 'UOM', value: data.uomName },
              { label: 'Type', value: <TypeBadge value={item.itemType} /> },
              { label: 'Preferred Vendor', value: data.preferredVendor },
              { label: 'Stock Value', value: formatCurrency(data.stockValue) },
            ]}
          />
          <FactBox
            title="Related Documents"
            fields={[
              { label: 'Open PR', value: data.openPr.length },
              { label: 'Open PO', value: data.openPo.length },
              { label: 'WO Usage', value: data.woUsage.length },
            ]}
          />
        </>
      }
    >
      {tab === 'overview' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Entity360Panel title="Inventory Snapshot">
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
              {[
                ['On Hand', data.onHand],
                ['Reserved', data.reserved],
                ['Available', data.available],
                ['In Transit', data.inTransit],
                ['Quarantine', data.quarantine],
                ['Reorder Level', item.reorderLevel],
              ].map(([label, val]) => (
                <div key={String(label)} className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-3">
                  <p className="text-[11px] font-semibold uppercase text-erp-muted">{label}</p>
                  <p className="mt-1 text-lg font-bold tabular-nums">{formatNumber(Number(val))}</p>
                </div>
              ))}
            </div>
          </Entity360Panel>
          <Entity360Panel title="Purchase Snapshot">
            <table className="erp-table">
              <tbody>
                <tr><td>Open PR</td><td className="num">{data.openPr.length}</td></tr>
                <tr><td>Open PO</td><td className="num">{data.openPo.length}</td></tr>
                <tr><td>Last Purchase Rate</td><td>{formatCurrency(data.lastRate)}</td></tr>
                <tr><td>Standard Rate</td><td>{formatCurrency(item.standardRate)}</td></tr>
              </tbody>
            </table>
          </Entity360Panel>
          <Entity360Panel title="Serialized Units">
            <div className="p-4">
              <SerialGenealogyPanel itemId={item.id} />
            </div>
          </Entity360Panel>
          <Entity360Panel title="Item Documents">
            <div className="p-4">
              <EntityDocumentsPanel entityType="item" entityId={item.id} entityLabel={item.itemCode} />
            </div>
          </Entity360Panel>
        </div>
      )}

      {tab === 'inventory' && (
        <Entity360Panel title="Warehouse Positions">
          <table className="erp-table">
            <thead><tr><th>Warehouse</th><th>On Hand</th><th>Reserved</th><th>Free</th><th>Value</th></tr></thead>
            <tbody>
              {data.warehouseBreakdown.map((p) => (
                <tr key={p.warehouseId}>
                  <td>{p.warehouseCode}</td>
                  <td className="num">{formatNumber(p.onHand)}</td>
                  <td className="num">{formatNumber(p.reservedQty)}</td>
                  <td className="num">{formatNumber(p.freeQty)}</td>
                  <td>{formatCurrency(p.stockValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'purchase' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Entity360Panel title="Open Purchase Orders">
            <table className="erp-table">
              <thead><tr><th>PO</th><th>Status</th></tr></thead>
              <tbody>
                {data.openPo.map((po) => (
                  <tr key={po.id}><td><TableLink to={`/purchase/orders/${po.id}`}>{po.poNo}</TableLink></td><td>{po.status}</td></tr>
                ))}
                {data.openPo.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-erp-muted">No open PO</td></tr>}
              </tbody>
            </table>
          </Entity360Panel>
          <Entity360Panel title="Vendor List">
            <table className="erp-table">
              <thead><tr><th>Vendor</th><th>Lead Time</th><th>Last Rate</th></tr></thead>
              <tbody>
                {data.vendorMaps.map((m) => (
                  <tr key={m.id}>
                    <td><TableLink to={`/masters/vendors/${m.vendorId}`}>{getVendor(m.vendorId)?.vendorName}</TableLink></td>
                    <td>{m.leadTimeDays} days</td>
                    <td>{formatCurrency(m.lastRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
        </div>
      )}

      {tab === 'consumption' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Entity360Panel title="Consumption Analytics">
            <div className="grid grid-cols-2 gap-3 p-4">
              <div className="rounded-lg border border-erp-border p-3"><p className="text-xs text-erp-muted">This Month</p><p className="text-xl font-bold">{formatNumber(data.consumedMonth)}</p></div>
              <div className="rounded-lg border border-erp-border p-3"><p className="text-xs text-erp-muted">This Quarter</p><p className="text-xl font-bold">{formatNumber(data.consumedQuarter)}</p></div>
            </div>
          </Entity360Panel>
          <Entity360Panel title="Top WO Usage">
            <table className="erp-table">
              <thead><tr><th>WO</th><th>Issued Qty</th></tr></thead>
              <tbody>
                {data.woUsage.map((w) => (
                  <tr key={w.woId}><td><TableLink to={`/work-orders/${w.woId}`}>{w.woNo}</TableLink></td><td className="num">{formatNumber(w.qty)}</td></tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
        </div>
      )}

      {tab === 'mrp' && (
        <Entity360Panel title="MRP Pegging">
          <table className="erp-table">
            <thead><tr><th>SO</th><th>Demand</th><th>Supply</th><th>Shortage</th><th>Required</th></tr></thead>
            <tbody>
              {data.mrpLines.map((m) => (
                <tr key={m.id}>
                  <td>{m.salesOrderNo}</td>
                  <td className="num">{formatNumber(m.requiredQty)}</td>
                  <td className="num">{formatNumber(m.freeStock)}</td>
                  <td className="num text-red-600">{formatNumber(m.shortageQty)}</td>
                  <td>{formatDate(m.requiredDate)}</td>
                </tr>
              ))}
              {data.mrpLines.length === 0 && <tr><td colSpan={5} className="py-6 text-center text-erp-muted">No MRP pegging — run MRP first</td></tr>}
            </tbody>
          </table>
        </Entity360Panel>
      )}

      {tab === 'transactions' && (
        <div className="space-y-4">
          {[
            ['GRN Receipts', data.grnMovements],
            ['Issues', data.issueMovements],
            ['Adjustments', data.adjustmentMovements],
            ['Transfers', data.transferMovements],
          ].map(([title, rows]) => (
            <Entity360Panel key={String(title)} title={String(title)}>
              <table className="erp-table">
                <thead><tr><th>Movement</th><th>Date</th><th>Qty</th><th>Reference</th></tr></thead>
                <tbody>
                  {(rows as typeof data.movements).slice(0, 8).map((m) => (
                    <tr key={m.id}>
                      <td className="font-mono text-xs">{m.movementNo}</td>
                      <td>{formatDate(m.movementDate)}</td>
                      <td className="num">{formatNumber(m.qty)}</td>
                      <td>{m.referenceNo || m.referenceType}</td>
                    </tr>
                  ))}
                  {(rows as typeof data.movements).length === 0 && <tr><td colSpan={4} className="py-4 text-center text-erp-muted">None</td></tr>}
                </tbody>
              </table>
            </Entity360Panel>
          ))}
        </div>
      )}

      {tab === 'timeline' && (
        <Entity360Panel title="Item Lifecycle">
          <div className="p-4">
            <Timeline
              events={[
                { id: 'created', label: 'Item Created', timestamp: formatDate(item.createdAt.slice(0, 10)), status: 'done' },
                ...data.grnMovements.slice(0, 2).map((m) => ({ id: m.id, label: 'Purchased (GRN)', timestamp: formatDate(m.movementDate), description: m.movementNo, status: 'done' as const })),
                ...data.issueMovements.slice(0, 2).map((m) => ({ id: m.id, label: 'Issued to Production', timestamp: formatDate(m.movementDate), description: m.referenceNo, status: 'done' as const })),
                ...data.issueMovements.slice(0, 1).map((m) => ({ id: `${m.id}-c`, label: 'Consumed', timestamp: formatDate(m.movementDate), status: 'current' as const })),
              ]}
            />
          </div>
        </Entity360Panel>
      )}
    </Entity360Shell>
  )
}
