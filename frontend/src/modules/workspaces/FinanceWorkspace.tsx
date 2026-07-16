import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Receipt, IndianRupee, AlertCircle, FileCheck } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { LiveAlertStrip, LiveWorkspaceSections } from '../../components/live-erp'
import { useInvoiceStore } from '../../store/invoiceStore'
import { buildFinanceLiveAlerts } from '../../utils/liveErpMetrics'
import { useLiveActivityMock } from '../../hooks/useLiveActivityMock'
import { formatCurrency } from '../../utils/formatters/currency'
export function FinanceWorkspacePage() {
  const navigate = useNavigate()
  const invoices = useInvoiceStore((s) => s.invoices)
  const mockActivity = useLiveActivityMock(true, 2)
  const posted = invoices.filter((i) => i.status === 'posted')
  const unpaid = invoices.filter((i) => ['posted', 'partial'].includes(i.status) && i.paymentStatus !== 'paid')
  const totalValue = posted.reduce((s, i) => s + i.gst.grandTotal, 0)
  const outstanding = unpaid.reduce((s, i) => s + i.balanceDue, 0)
  const liveAlerts = useMemo(() => buildFinanceLiveAlerts(), [unpaid.length, outstanding])
  const nextActions = useMemo(
    () => [
      { id: 'payment', label: 'Record Payment', href: '/invoices/register', priority: 'primary' as const },
      { id: 'overdue', label: 'Review Overdue', href: '/invoices/register' },
      { id: 'dispatch', label: 'Unbilled Dispatch', href: '/dispatch/register' },
    ],
    [],
  )

  return (
    <DynamicsModuleDashboard
      title="Finance Command Center"
      subtitle="GST invoices, collections, and receivables linked to dispatch."
      badge="Finance"
      favoritePath="/invoices"
      healthScore={unpaid.length > 5 ? 72 : 90}
      heroMetrics={[
        { id: 'posted', label: 'Invoices Posted', value: posted.length, icon: FileCheck, accent: 'blue', href: '/invoices/register' },
        { id: 'value', label: 'Invoice Value', value: formatCurrency(totalValue), icon: IndianRupee, accent: 'green', href: '/invoices/register' },
        { id: 'out', label: 'Outstanding', value: formatCurrency(outstanding), icon: Receipt, accent: 'amber', href: '/invoices/register' },
        { id: 'unpaid', label: 'Unpaid Count', value: unpaid.length, icon: AlertCircle, accent: unpaid.length > 0 ? 'red' : 'green', href: '/invoices/register' },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      liveSections={
        <LiveWorkspaceSections needsAttention={liveAlerts} recentlyUpdated={mockActivity} nextActions={nextActions} />
      }
      quickActions={
        <>
          <DynamicsCommandButton primary onClick={() => navigate('/invoices/register')}>Invoice Register</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/invoices')}>Finance Workspace</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/reports/sales/open-orders')}>Open Orders Report</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Posted Invoices', value: posted.length, tone: 'primary', href: '/invoices/register' },
        { label: 'Outstanding AR', value: formatCurrency(outstanding), tone: outstanding > 0 ? 'warning' : 'success', href: '/invoices/register' },
        { label: 'Unpaid Invoices', value: unpaid.length, tone: unpaid.length ? 'critical' : 'success', href: '/invoices/register' },
      ]}
    >
      <DynamicsDashboardPanel title="Collections Snapshot">
        <div className="dyn-snapshot-strip">
          <p>
            <strong>{posted.length}</strong> posted invoices · outstanding{' '}
            <strong>{formatCurrency(outstanding)}</strong>
          </p>
          <DynamicsCommandButton primary onClick={() => navigate('/invoices/register')}>
            Open Register
          </DynamicsCommandButton>
        </div>
      </DynamicsDashboardPanel>
    </DynamicsModuleDashboard>
  )
}
