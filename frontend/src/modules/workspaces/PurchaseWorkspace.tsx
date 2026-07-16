import { useNavigate } from 'react-router-dom'
import { useMemo } from 'react'
import { FileText, Plus, Truck, ClipboardList, AlertTriangle } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { LiveAlertStrip, LiveWorkspaceSections } from '../../components/live-erp'
import { usePurchaseWorkspaceMetrics } from '../../utils/workspaceMetrics'
import { buildPurchaseLiveAlerts } from '../../utils/liveErpMetrics'
import { useLiveActivityMock } from '../../hooks/useLiveActivityMock'
import { formatDate } from '../../utils/dates/format'
import { PR_SOURCE_LABELS } from '../../types/purchase'
import { TableLink } from '../../components/ui/AppLink'

export function PurchaseWorkspacePage() {
  const navigate = useNavigate()
  const m = usePurchaseWorkspaceMetrics()
  const mockActivity = useLiveActivityMock(true, 3)
  const liveAlerts = useMemo(() => buildPurchaseLiveAlerts(), [m.vendorDelays, m.pendingApproval])
  const nextActions = useMemo(
    () => [
      { id: 'pr', label: 'Review Pending PRs', href: '/purchase/requisitions', priority: 'primary' as const },
      { id: 'po', label: 'Open PO Register', href: '/purchase/orders' },
      { id: 'grn', label: 'Post GRN', href: '/purchase/grns' },
    ],
    [],
  )

  return (
    <DynamicsModuleDashboard
      title="Purchase Command Center"
      subtitle="Procurement — PR → RFQ → PO → GRN. Track approvals, vendor delays, and materials at risk."
      badge="Purchase"
      favoritePath="/purchase"
      healthScore={m.vendorDelays > 0 ? 68 : 88}
      heroMetrics={[
        { id: 'pr', label: 'Pending PR', value: m.pendingPr, icon: ClipboardList, accent: 'blue', href: '/purchase/requisitions' },
        { id: 'approval', label: 'Pending Approval', value: m.pendingApproval, icon: FileText, accent: 'amber', href: '/purchase/requisitions' },
        { id: 'po', label: 'Open PO', value: m.openPo, icon: Truck, accent: 'indigo', href: '/purchase/orders' },
        { id: 'delay', label: 'Vendor Delays', value: m.vendorDelays, icon: AlertTriangle, accent: m.vendorDelays > 0 ? 'red' : 'green', href: '/purchase/orders' },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      liveSections={
        <LiveWorkspaceSections needsAttention={liveAlerts} recentlyUpdated={mockActivity} nextActions={nextActions} />
      }
      quickActions={
        <>
          <DynamicsCommandButton primary icon={<Plus className="h-4 w-4" />} onClick={() => navigate('/purchase/requisitions/new')}>
            Create Manual PR
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<FileText className="h-4 w-4" />} onClick={() => navigate('/purchase/requisitions')}>
            Requisitions
          </DynamicsCommandButton>
          <DynamicsCommandButton icon={<Truck className="h-4 w-4" />} onClick={() => navigate('/purchase/orders')}>
            Orders
          </DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/purchase/grns')}>GRN Register</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Expected This Week', value: m.expectedDeliveries, tone: 'primary', href: '/purchase/grns' },
        { label: 'Materials at Risk', value: m.atRisk.length, tone: m.atRisk.length ? 'critical' : 'success', href: '/purchase/orders' },
        { label: 'Recent PRs', value: m.recentPr.length, tone: 'neutral', href: '/purchase/requisitions' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Expected This Week" actions={<span className="dyn-entity-list-meta">{m.expectedDeliveries} delivery lines</span>}>
          <div className="dyn-action-grid">
            <DynamicsCommandButton onClick={() => navigate('/purchase/grns')}>GRN Register</DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => navigate('/purchase/rfqs')}>RFQ List</DynamicsCommandButton>
            <DynamicsCommandButton onClick={() => navigate('/purchase/reports')}>Reports</DynamicsCommandButton>
          </div>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Materials at Risk" actions={<span className="dyn-entity-list-meta">Delayed PO heatmap</span>} noPadding>
          <table className="erp-table">
            <thead><tr><th>PO</th><th>Vendor</th><th>Expected</th><th>Status</th></tr></thead>
            <tbody>
              {m.atRisk.map((po) => (
                <tr key={po.poId} className="bg-red-50/40">
                  <td><TableLink to={`/purchase/orders/${po.poId}`}>{po.poNo}</TableLink></td>
                  <td>{po.vendorName}</td>
                  <td>{formatDate(po.expectedDate)}</td>
                  <td><span className="text-[11px] font-semibold text-red-600">DELAYED</span></td>
                </tr>
              ))}
              {m.atRisk.length === 0 && (
                <tr><td colSpan={4} className="dyn-empty-hint">No delayed POs</td></tr>
              )}
            </tbody>
          </table>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>

      <DynamicsDashboardPanel title="Recent Requisitions" actions={<span className="dyn-entity-list-meta">MRP and manual requests</span>} noPadding>
        <table className="erp-table">
          <thead><tr><th>PR No</th><th>Source</th><th>Status</th><th>Lines</th><th>Required</th></tr></thead>
          <tbody>
            {m.recentPr.map((pr) => (
              <tr key={pr.id}>
                <td><TableLink to={`/purchase/requisitions/${pr.id}`}>{pr.prNo}</TableLink></td>
                <td>{PR_SOURCE_LABELS[pr.source]}</td>
                <td>{pr.status}</td>
                <td className="num">{pr.lines.length}</td>
                <td>{formatDate(pr.lines[0]?.requiredDate ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DynamicsDashboardPanel>
    </DynamicsModuleDashboard>
  )
}
