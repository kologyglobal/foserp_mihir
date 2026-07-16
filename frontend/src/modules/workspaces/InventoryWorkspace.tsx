import { useNavigate } from 'react-router-dom'
import { Bookmark, Package, Boxes, AlertTriangle } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { useInventoryWorkspaceMetrics, formatMetricCurrency } from '../../utils/workspaceMetrics'
import { useMasterStore } from '../../store/masterStore'

export function InventoryWorkspacePage() {
  const navigate = useNavigate()
  const m = useInventoryWorkspaceMetrics()
  const getItem = useMasterStore((s) => s.getItem)

  return (
    <DynamicsModuleDashboard
      title="Inventory Command Center"
      subtitle="Stock positions, reservations, low-stock alerts, and warehouse operations."
      badge="Inventory"
      favoritePath="/inventory"
      healthScore={m.lowStock > 5 ? 62 : m.lowStock > 0 ? 78 : 92}
      heroMetrics={[
        { id: 'value', label: 'Inventory Value', value: formatMetricCurrency(m.inventoryValue), icon: Package, accent: 'green', href: '/inventory/ledger' },
        { id: 'sku', label: 'SKUs in Stock', value: m.skuCount, icon: Boxes, accent: 'blue', href: '/inventory/ledger' },
        { id: 'low', label: 'Low Stock Items', value: m.lowStock, icon: AlertTriangle, accent: m.lowStock > 0 ? 'amber' : 'green', href: '/inventory/ledger' },
        { id: 'res', label: 'Active Reservations', value: m.activeReservations, icon: Bookmark, accent: 'indigo', href: '/inventory/reservations' },
      ]}
      quickActions={
        <>
          <DynamicsCommandButton primary onClick={() => navigate('/inventory/ledger')}>Stock Ledger</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/inventory/inward')}>Material Inward</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/inventory/reservations')}>Reservations</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/inventory/opening-stock')}>Opening Stock</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Low Stock SKUs', value: m.lowStock, tone: m.lowStock > 0 ? 'warning' : 'success', href: '/inventory/ledger' },
        { label: 'Reserved Lines', value: m.activeReservations, tone: 'primary', href: '/inventory/reservations' },
        { label: 'Stock Value', value: formatMetricCurrency(m.inventoryValue), tone: 'neutral', href: '/inventory/ledger' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Quick Actions">
          <div className="dyn-action-grid">
            <DynamicsCommandButton onClick={() => navigate('/inventory/ledger')}>Stock Ledger</DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => navigate('/inventory/inward')}>Material Inward</DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => navigate('/inventory/reservations')}>Reservations</DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => navigate('/inventory/opening-stock')}>Opening Stock</DynamicsCommandButton>
          </div>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Low Stock Alert" actions={<span className="dyn-entity-list-meta">Below reorder level</span>} noPadding>
          <table className="erp-table">
            <thead><tr><th>Item</th><th className="text-right">On Hand</th><th className="text-right">Reorder</th></tr></thead>
            <tbody>
              {m.lowStockItems.map((row) => (
                <tr key={row.itemId}>
                  <td className="font-mono">{getItem(row.itemId)?.itemCode}</td>
                  <td className="num">{row.onHand}</td>
                  <td className="num">{getItem(row.itemId)?.reorderLevel}</td>
                </tr>
              ))}
              {m.lowStockItems.length === 0 && (
                <tr><td colSpan={3} className="dyn-empty-hint">No low stock items</td></tr>
              )}
            </tbody>
          </table>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}
