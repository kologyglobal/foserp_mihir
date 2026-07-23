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
      { id: 'payment', label: 'Record Payment', href: '/accounting/money-in/invoices', priority: 'primary' as const },
      { id: 'overdue', label: 'Review Overdue', href: '/accounting/money-in/invoices' },
      { id: 'dispatch', label: 'Unbilled Dispatch', href: '/dispatch/register' },
    ],
    [],
  )

  return (
    <DynamicsModuleDashboard
      title="Finance Command Center"
      subtitle="GST invoices, collections, and receivables linked to dispatch."
      badge="Finance"
      favoritePath="/accounting/money-in"
      healthScore={unpaid.length > 5 ? 72 : 90}
      heroMetrics={[
        { id: 'posted', label: 'Invoices Posted', value: posted.length, icon: FileCheck, accent: 'blue', href: '/accounting/money-in/invoices' },
        { id: 'value', label: 'Invoice Value', value: formatCurrency(totalValue), icon: IndianRupee, accent: 'green', href: '/accounting/money-in/invoices' },
        { id: 'out', label: 'Outstanding', value: formatCurrency(outstanding), icon: Receipt, accent: 'amber', href: '/accounting/money-in/invoices' },
        { id: 'unpaid', label: 'Unpaid Count', value: unpaid.length, icon: AlertCircle, accent: unpaid.length > 0 ? 'red' : 'green', href: '/accounting/money-in/invoices' },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      liveSections={
        <LiveWorkspaceSections needsAttention={liveAlerts} recentlyUpdated={mockActivity} nextActions={nextActions} />
      }
      quickActions={
        <>
          <DynamicsCommandButton primary onClick={() => navigate('/accounting/money-in/invoices')}>Invoice Register</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/accounting')}>Finance Workspace</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/sales/orders')}>Open Orders</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Posted Invoices', value: posted.length, tone: 'primary', href: '/accounting/money-in/invoices' },
        { label: 'Outstanding AR', value: formatCurrency(outstanding), tone: outstanding > 0 ? 'warning' : 'success', href: '/accounting/money-in/invoices' },
        { label: 'Unpaid Invoices', value: unpaid.length, tone: unpaid.length ? 'critical' : 'success', href: '/accounting/money-in/invoices' },
      ]}
    >
      <DynamicsDashboardPanel title="Collections Snapshot">
        <div className="dyn-snapshot-strip">
          <p>
            <strong>{posted.length}</strong> posted invoices · outstanding{' '}
            <strong>{formatCurrency(outstanding)}</strong>
          </p>
          <DynamicsCommandButton primary onClick={() => navigate('/accounting/money-in/invoices')}>
            Open Register
          </DynamicsCommandButton>
        </div>
      </DynamicsDashboardPanel>
    </DynamicsModuleDashboard>
  )
}
