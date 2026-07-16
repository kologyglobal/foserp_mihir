import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { RotateCcw, ShieldAlert, CheckCircle2 } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsDashboardGrid,
  DynamicsCommandButton,
} from '../../components/dynamics'
import { LiveAlertStrip, LiveWorkspaceSections } from '../../components/live-erp'
import { SmartEmptyState } from '../../components/premium/SmartEmptyState'
import { useQualityWorkspaceMetrics } from '../../utils/workspaceMetrics'
import { buildQualityLiveAlerts } from '../../utils/liveErpMetrics'
import { useLiveActivityMock } from '../../hooks/useLiveActivityMock'

export function QualityWorkspacePage() {
  const navigate = useNavigate()
  const m = useQualityWorkspaceMetrics()
  const mockActivity = useLiveActivityMock(true, 3)
  const liveAlerts = useMemo(() => buildQualityLiveAlerts(), [m.pendingInspections, m.openNcr])
  const nextActions = useMemo(
    () => [
      { id: 'inspect', label: 'Complete Inspection', href: '/quality/queue', priority: 'primary' as const },
      { id: 'rework', label: 'Raise Rework', href: '/quality/rework' },
      { id: 'ncr', label: 'Raise NCR', href: '/quality/ncr' },
      { id: 'release', label: 'Release Operation', href: '/work-orders' },
    ],
    [],
  )
  const defectTrend = m.defectTrend?.slice(-6) ?? []

  return (
    <DynamicsModuleDashboard
      title="Quality Command Center"
      subtitle="Inspections, NCR, rework, first-pass yield, and vendor quality"
      badge="Quality"
      favoritePath="/quality"
      healthScore={Math.max(50, 96 - m.openNcr * 5 - m.pendingInspections)}
      heroMetrics={[
        { id: 'pending', label: 'Pending QC', value: m.pendingInspections, icon: ShieldAlert, accent: 'amber', href: '/quality/queue' },
        { id: 'ncr', label: 'Critical NCR', value: m.openNcr, icon: ShieldAlert, accent: 'red', href: '/quality/ncr' },
        { id: 'rework', label: 'Rework Ageing', value: m.openRework, icon: RotateCcw, accent: 'orange', href: '/quality/rework' },
        { id: 'fpy', label: 'First Pass Yield', value: `${m.firstPassYieldPct}%`, accent: 'green', trend: m.firstPassYieldPct >= 90 ? 'On target' : 'Below target', trendUp: m.firstPassYieldPct >= 90 },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      emptyState={
        liveAlerts.length === 0 ? (
          <SmartEmptyState
            icon={CheckCircle2}
            title="No critical quality blockers"
            insight={`First-pass yield this week is ${m.firstPassYieldPct}%.`}
            healthNote="Inspection queue within SLA"
          />
        ) : undefined
      }
      liveSections={
        <LiveWorkspaceSections needsAttention={liveAlerts} recentlyUpdated={mockActivity} nextActions={nextActions} />
      }
      quickActions={
        <>
          <DynamicsCommandButton primary onClick={() => navigate('/quality/queue')}>QC Queue</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/quality/ncr')}>NCR Register</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/quality/rework')}>Rework Bench</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/quality/reports')}>Reports</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Pending Inspection', value: m.pendingInspections, tone: 'warning', href: '/quality/queue' },
        { label: 'Open NCR', value: m.openNcr, tone: m.ncrAgeingOver7Days > 0 ? 'critical' : 'warning', href: '/quality/ncr' },
        { label: 'First Pass Yield', value: `${m.firstPassYieldPct}%`, tone: m.firstPassYieldPct >= 90 ? 'success' : 'warning' },
        { label: 'Incoming QC', value: m.pendingIncoming, tone: 'primary', href: '/quality/incoming' },
      ]}
    >
      <DynamicsDashboardGrid>
        <DynamicsDashboardPanel title="Defect Trend">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={defectTrend}>
                <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DynamicsDashboardPanel>

        <DynamicsDashboardPanel title="NCR Aging" actions={<span className="dyn-entity-list-meta">{m.ncrAgeingOver7Days} over 7 days</span>}>
          <div className="dyn-snapshot-strip">
            <p>
              <strong>{m.openNcr}</strong> open NCR · <strong>{m.openRework}</strong> rework jobs
            </p>
            <DynamicsCommandButton primary onClick={() => navigate('/quality/ncr')}>
              Review NCR
            </DynamicsCommandButton>
          </div>
        </DynamicsDashboardPanel>
      </DynamicsDashboardGrid>
    </DynamicsModuleDashboard>
  )
}
