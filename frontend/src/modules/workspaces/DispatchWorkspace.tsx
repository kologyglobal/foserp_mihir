import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { Timeline } from '../../components/design-system/Timeline'
import { LiveAlertStrip, LiveWorkspaceSections } from '../../components/live-erp'
import { SmartEmptyState } from '../../components/premium/SmartEmptyState'
import { useDispatchWorkspaceMetrics } from '../../utils/workspaceMetrics'
import { buildDispatchLiveAlerts } from '../../utils/liveErpMetrics'
import { useLiveActivityMock } from '../../hooks/useLiveActivityMock'
import { formatDate } from '../../utils/dates/format'
export function DispatchWorkspacePage() {
  const navigate = useNavigate()
  const m = useDispatchWorkspaceMetrics()
  const mockActivity = useLiveActivityMock(true, 3)
  const liveAlerts = useMemo(() => buildDispatchLiveAlerts(), [m.readyCount, m.podPending])
  const nextActions = useMemo(
    () => [
      { id: 'ready', label: 'Verify Final QC', href: '/quality/queue', priority: 'primary' as const },
      { id: 'scan', label: 'Scan Trailer QR', href: '/scan?mode=Dispatch' },
      { id: 'gate', label: 'Print Gate Pass', href: '/dispatch/register' },
      { id: 'pod', label: 'Confirm Dispatch / POD', href: '/dispatch/register' },
    ],
    [],
  )

  const scheduleEvents = m.schedule.map((row, i) => ({
    id: row.dispatchNo ?? String(i),
    label: `${row.salesOrderNo} · ${row.customerName}`,
    timestamp: formatDate(row.plannedDate),
    description: row.trailerNo || row.chassisNo,
    status: (i === 0 ? 'current' : 'pending') as 'current' | 'pending',
  }))

  return (
    <DynamicsModuleDashboard
      title="Dispatch Command Center"
      subtitle="Ready trailers, loading schedule, gate pass, and POD"
      badge="Dispatch"
      favoritePath="/dispatch"
      healthScore={Math.max(60, 90 - m.podPending * 3)}
      heroMetrics={[
        { id: 'ready', label: 'Dispatch Ready', value: m.readyCount, accent: 'green', href: '/dispatch/register', helper: m.readyCount > 0 ? `${m.readyCount} trailers ready` : undefined },
        { id: 'loading', label: 'Loading Today', value: m.loadingToday, accent: 'cyan', href: '/dispatch/register' },
        { id: 'dispatched', label: 'Dispatched Today', value: m.dispatchedToday, accent: 'blue', href: '/dispatch/register' },
        { id: 'pod', label: 'POD Pending', value: m.podPending, accent: 'amber', href: '/dispatch/register' },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      emptyState={
        liveAlerts.length === 0 ? (
          <SmartEmptyState
            icon={CheckCircle2}
            title="No dispatch risks right now"
            insight={m.readyCount > 0 ? `${m.readyCount} trailers are ready for dispatch.` : 'Schedule is clear for today.'}
            healthNote="Gate pass queue clear"
          />
        ) : undefined
      }
      liveSections={
        <LiveWorkspaceSections needsAttention={liveAlerts} recentlyUpdated={mockActivity} nextActions={nextActions} />
      }
      quickActions={
        <>
          <DynamicsCommandButton primary onClick={() => navigate('/dispatch/register')}>Dispatch Register</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/dispatch/plan')}>Dispatch Plan</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/dispatch/reports')}>Reports</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/scan?mode=Dispatch')}>Scan Trailer QR</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Ready to Dispatch', value: m.readyCount, tone: 'success', href: '/dispatch/register' },
        { label: 'Loading Today', value: m.loadingToday, tone: 'primary', href: '/dispatch/register' },
        { label: 'Dispatched Today', value: m.dispatchedToday, tone: 'neutral', href: '/dispatch/register' },
        { label: 'POD Pending', value: m.podPending, tone: m.podPending > 0 ? 'warning' : 'success', href: '/dispatch/register' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Dispatch Schedule" actions={<span className="dyn-entity-list-meta">Pending dispatch timeline</span>}>
          <Timeline events={scheduleEvents.length > 0 ? scheduleEvents : [{ id: 'none', label: 'No pending dispatches', status: 'pending' }]} />
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="Gate Pass Queue">
          <div className="dyn-snapshot-strip">
            <p>
              <strong>{m.readyCount}</strong> trailers ready · <strong>{m.podPending}</strong> POD pending
            </p>
            <DynamicsCommandButton primary onClick={() => navigate('/dispatch/register')}>
              Open Register
            </DynamicsCommandButton>
          </div>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}
