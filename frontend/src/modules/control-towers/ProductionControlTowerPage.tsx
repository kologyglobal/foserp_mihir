import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { Factory, Gauge, PackageX, ShieldAlert, CheckCircle2 } from 'lucide-react'
import {
  DynamicsModuleDashboard,
  DynamicsDashboardPanel,
  DynamicsCommandButton,
  DynamicsTabs,
} from '../../components/dynamics'
import { DataGrid } from '../../components/design-system/DataGrid'
import { ProgressRing } from '../../components/design-system/WorkspaceLayout'
import { SmartEmptyState } from '../../components/premium/SmartEmptyState'
import { TableLink } from '../../components/ui/AppLink'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { LiveAlertStrip, LiveWorkspaceSections, LiveDataGridFooter } from '../../components/live-erp'
import { useProductionControlTower } from '../../utils/controlTowerMetrics'
import { buildProductionLiveAlerts, activityFromNotifications } from '../../utils/liveErpMetrics'
import { useNotifications } from '../../utils/workspaceMetrics'
import { useLiveActivityMock } from '../../hooks/useLiveActivityMock'
import { CONTROL_TOWER_ROUTES, wo360Path } from '../../config/controlTowerRoutes'
import { formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import type { WorkOrder, JobCard } from '../../types/workorder'
import type { MrpMaterialLine } from '../../types/mrp'

type QueueId = 'running' | 'late' | 'qc' | 'shortage' | 'wip' | 'today' | 'blocked' | 'rework'

export function ProductionControlTowerPage() {
  const navigate = useNavigate()
  const m = useProductionControlTower()
  const notifications = useNotifications()
  const mockActivity = useLiveActivityMock(true, 4)
  const [activeQueue, setActiveQueue] = useState<QueueId>('running')
  const [lastRefresh, setLastRefresh] = useState(() => Date.now())

  const liveAlerts = useMemo(() => buildProductionLiveAlerts(), [m.qcHolds, m.materialShortages, m.late])
  const recentActivity = useMemo(
    () => [...mockActivity, ...activityFromNotifications(notifications)].slice(0, 6),
    [mockActivity, notifications],
  )
  const nextActions = useMemo(
    () => [
      { id: 'qc', label: 'Open QC Queue', href: '/quality/queue', priority: 'primary' as const },
      { id: 'short', label: 'Review Material Shortages', href: '/mrp/planner' },
      { id: 'dispatch', label: 'Dispatch Ready Trailers', href: '/dispatch/register' },
      { id: 'shop', label: 'Shop Floor Queue', href: '/shop-floor' },
    ],
    [],
  )

  const woColumns = useMemo<ColumnDef<WorkOrder, unknown>[]>(
    () => [
      { accessorKey: 'woNo', header: 'WO', cell: ({ row }) => <TableLink to={wo360Path(row.original.id)}>{row.original.woNo}</TableLink> },
      { accessorKey: 'salesOrderNo', header: 'SO' },
      { accessorKey: 'outputItemCode', header: 'Output' },
      { accessorKey: 'plannedFinishDate', header: 'Finish', cell: ({ row }) => formatDate(row.original.plannedFinishDate) },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  )

  const jobCardColumns = useMemo<ColumnDef<JobCard, unknown>[]>(
    () => [
      { accessorKey: 'jobCardNo', header: 'Job Card', cell: ({ row }) => <TableLink to="/production/job-cards">{row.original.jobCardNo}</TableLink> },
      { accessorKey: 'woNo', header: 'WO' },
      { accessorKey: 'operationName', header: 'Operation' },
      { accessorKey: 'workCenterCode', header: 'Work Center' },
      { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    ],
    [],
  )

  const shortageColumns = useMemo<ColumnDef<MrpMaterialLine, unknown>[]>(
    () => [
      { accessorKey: 'itemCode', header: 'Item' },
      { accessorKey: 'salesOrderNo', header: 'SO' },
      { accessorKey: 'shortageQty', header: 'Shortage', cell: ({ row }) => formatNumber(row.original.shortageQty) },
      { accessorKey: 'requiredDate', header: 'Required', cell: ({ row }) => formatDate(row.original.requiredDate) },
    ],
    [],
  )

  const queueKpis: { id: QueueId; label: string }[] = [
    { id: 'running', label: 'Running' },
    { id: 'late', label: 'Late' },
    { id: 'qc', label: 'QC Holds' },
    { id: 'shortage', label: 'Shortages' },
    { id: 'wip', label: 'WIP by WC' },
    { id: 'today', label: "Today's Job Cards" },
    { id: 'blocked', label: 'Blocked Ops' },
    { id: 'rework', label: 'Rework' },
  ]

  return (
    <DynamicsModuleDashboard
      title="Production Command Center"
      subtitle="Shop floor live · Pune Plant · Shift A"
      badge="Control Tower"
      favoritePath={CONTROL_TOWER_ROUTES.production}
      healthScore={Math.max(55, 94 - m.late * 4 - m.qcHolds * 3 - m.materialShortages * 2)}
      heroMetrics={[
        { id: 'running', label: 'Running WOs', value: m.running, icon: Factory, accent: 'cyan', trend: 'Live', trendUp: true, onClick: () => setActiveQueue('running') },
        { id: 'late', label: 'Delayed Operations', value: m.late, icon: Gauge, accent: m.late ? 'red' : 'green', onClick: () => setActiveQueue('late') },
        { id: 'qc', label: 'QC Hold', value: m.qcHolds, icon: ShieldAlert, accent: 'orange', onClick: () => setActiveQueue('qc') },
        { id: 'short', label: 'Material Shortage', value: m.materialShortages, icon: PackageX, accent: m.materialShortages ? 'amber' : 'green', onClick: () => setActiveQueue('shortage') },
      ]}
      alert={liveAlerts.length > 0 ? <LiveAlertStrip alerts={liveAlerts} /> : undefined}
      emptyState={
        liveAlerts.length === 0 ? (
          <SmartEmptyState
            icon={CheckCircle2}
            title="No critical production blockers"
            insight="Shop floor is running within plan."
            healthNote="All work centers reporting"
          />
        ) : undefined
      }
      liveSections={
        <LiveWorkspaceSections needsAttention={liveAlerts} recentlyUpdated={recentActivity} nextActions={nextActions} />
      }
      quickActions={
        <>
          <DynamicsCommandButton
            primary
            icon={<Factory className="h-4 w-4" />}
            onClick={() => m.runningList[0] && navigate(wo360Path(m.runningList[0].id))}
          >
            Open WO 360
          </DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/production/job-cards')}>Job Cards</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/quality/inspections')}>QC Queue</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => setActiveQueue('shortage')}>Material Shortage</DynamicsCommandButton>
          <DynamicsCommandButton onClick={() => navigate('/dispatch/register')}>Dispatch Ready</DynamicsCommandButton>
        </>
      }
      kpiStrip={[
        { label: 'Rework Queue', value: m.reworkQueue, tone: m.reworkQueue ? 'warning' : 'success', onClick: () => setActiveQueue('rework') },
        { label: 'Capacity Util', value: `${m.capacityUtil}%`, tone: 'primary' },
        { label: 'Running WOs', value: m.running, tone: 'neutral', onClick: () => setActiveQueue('running') },
      ]}
    >
      <DynamicsTabs
        items={queueKpis.map((q) => ({ label: q.label, path: q.id }))}
        activePath={activeQueue}
        onChange={(id) => setActiveQueue(id as QueueId)}
      />

      <div className="dyn-dashboard-split">
        <DynamicsDashboardPanel title="Queue Detail" className="lg:col-span-2" noPadding>
          {activeQueue === 'running' && (
            <DataGrid
              data={m.runningList}
              columns={woColumns}
              compact
              emptyMessage="No work orders in production."
              footer={
                <LiveDataGridFooter
                  lastRefreshedAt={lastRefresh}
                  recordCount={m.runningList.length}
                  onRefresh={() => setLastRefresh(Date.now())}
                />
              }
            />
          )}
          {activeQueue === 'late' && <DataGrid data={m.lateList} columns={woColumns} compact emptyMessage="No late work orders." />}
          {activeQueue === 'qc' && (
            <div className="space-y-4 p-4">
              <DataGrid
                data={m.qcHoldList}
                columns={[
                  { accessorKey: 'inspectionNo', header: 'Inspection', cell: ({ row }) => <TableLink to={`/quality/inspections/${row.original.id}`}>{row.original.inspectionNo}</TableLink> },
                  { accessorKey: 'woNo', header: 'WO' },
                  { accessorKey: 'operationName', header: 'Operation' },
                  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
                ]}
                compact
                emptyMessage="No pending QC inspections."
              />
              <DataGrid data={m.qcHoldJobCards} columns={jobCardColumns} compact emptyMessage="No job cards on QC hold." />
            </div>
          )}
          {activeQueue === 'shortage' && <DataGrid data={m.shortageLines} columns={shortageColumns} compact emptyMessage="No MRP material shortages." />}
          {activeQueue === 'wip' && (
            <DataGrid
              data={m.wipByWorkCenter}
              columns={[
                { accessorKey: 'workCenterCode', header: 'Work Center' },
                { accessorKey: 'activeJobs', header: 'Active Jobs' },
                { accessorKey: 'inProgress', header: 'In Progress' },
              ]}
              compact
              emptyMessage="No WIP by work center."
            />
          )}
          {activeQueue === 'today' && <DataGrid data={m.todayJobCards} columns={jobCardColumns} compact emptyMessage="No job cards scheduled for today." />}
          {activeQueue === 'blocked' && (
            <DataGrid
              data={m.blockedOperations}
              columns={[
                { accessorKey: 'woNo', header: 'WO' },
                { accessorKey: 'operationName', header: 'Operation' },
                { accessorKey: 'sequenceNo', header: 'Seq' },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              ]}
              compact
              emptyMessage="No blocked operations."
            />
          )}
          {activeQueue === 'rework' && (
            <DataGrid
              data={m.reworkList}
              columns={[
                { accessorKey: 'reworkNo', header: 'Rework' },
                { accessorKey: 'woNo', header: 'WO' },
                { accessorKey: 'operationName', header: 'Operation' },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              ]}
              compact
              emptyMessage="Rework queue clear."
            />
          )}
        </DynamicsDashboardPanel>

        <div className="space-y-4">
          <DynamicsDashboardPanel title="Capacity Utilization">
            <div className="flex flex-col items-center gap-3 p-4">
              <ProgressRing value={m.capacityUtil} label="Shop Load" size={100} />
              <p className="text-center text-[12px] text-erp-muted">{m.running} WOs in production</p>
            </div>
          </DynamicsDashboardPanel>

          <DynamicsDashboardPanel title="WOs at Material Risk" noPadding>
            <DataGrid
              data={m.shortageWos}
              columns={[
                { accessorKey: 'woNo', header: 'WO', cell: ({ row }) => <TableLink to={wo360Path(row.original.id)}>{row.original.woNo}</TableLink> },
                { accessorKey: 'outputItemCode', header: 'Item' },
              ]}
              compact
              showPagination={false}
              emptyMessage="No WO material gaps."
            />
          </DynamicsDashboardPanel>
        </div>
      </div>
    </DynamicsModuleDashboard>
  )
}
