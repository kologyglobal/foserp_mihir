import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Target,
  TrendingUp,
  FileText,
  Flame,
  AlertTriangle,
  Activity,
  Plus,
  LayoutDashboard,
  Users,
  User,
} from 'lucide-react'
import { DynamicsModuleDashboard, DynamicsDashboardGrid } from '../../components/dynamics'
import { ErpButton } from '../../components/erp/ErpButton'
import { useCrmStore } from '../../store/crmStore'
import { useSalesStore } from '../../store/salesStore'
import { useMasterStore } from '../../store/masterStore'
import { buildCrmDashboardMetrics, formatCrmCurrency } from '../../utils/crmMetrics'
import { buildCrmDashboardKpiStrip } from '../../utils/crmModuleKpis'
import { buildCrmNextActions } from '../../utils/crmNextActions'
import {
  type CrmDashboardViewMode,
  CRM_VIEW_MODE_LABELS,
  filterActivitiesByView,
  filterFollowUpsByView,
  filterOpportunitiesByView,
  getAvailableCrmViewModes,
  getDefaultCrmViewMode,
} from '../../utils/crmDashboardAccess'
import { enrichFollowUpStatus } from '../../utils/crmMetrics'
import { QuickFollowUpDrawer } from '../../components/crm/QuickFollowUpDrawer'
import { CrmPipelineHealthBoard } from '../../components/crm/CrmPipelineHealthBoard'
import {
  CrmActivityTrendChart,
  CrmDealOutcomesChart,
  CrmFollowUpUrgencyChart,
  CrmOwnerPipelineChart,
  CrmPipelineValueChart,
  CrmStageFunnelChart,
  CrmLeadStageFunnelChart,
} from '../../components/crm/CrmDashboardCharts'
import {
  CrmFollowUpsPanel,
  CrmHotOpportunitiesPanel,
  CrmNextActionsPanel,
  CrmQuotationApprovalPanel,
  CrmRecentActivitiesPanel,
  CrmRecentlyWonPanel,
  CrmStuckOpportunitiesPanel,
} from '../../components/crm/CrmDashboardPanels'
import {
  DashboardManagementFeed,
  DashboardQuickViewDrawer,
  useDashboardNavigation,
} from '../../components/dashboard'
import { buildCrmManagementFeed } from '../../utils/dashboardLiveFeed'
import { FioriSegmentedView, FioriToolbarShell } from '../../components/fiori'
import { applyApiDashboardOverlay, useCrmDashboardApiMetrics } from '../../hooks/useCrmDashboardApiMetrics'
import { applyApiDashboardPanelOverlay } from '../../utils/crmDashboardApiPanels'
import { buildCrmDashboardChartSeries } from '../../utils/crmDashboardApiCharts'
import { useApiMode } from '@/hooks/useApiMode'

export function CrmDashboardPage() {
  const apiMode = useApiMode()
  const navigate = useNavigate()
  const dashboardNav = useDashboardNavigation()
  const allOpportunities = useCrmStore((s) => s.opportunities)
  const allFollowUps = useCrmStore((s) => s.followUps)
  const allActivities = useCrmStore((s) => s.activities)
  const quotationDocuments = useCrmStore((s) => s.quotationDocuments)
  const allLeads = useSalesStore((s) => s.leads)
  const contacts = useCrmStore((s) => s.contacts)
  const completeFollowUp = useCrmStore((s) => s.completeFollowUp)
  const rescheduleFollowUp = useCrmStore((s) => s.rescheduleFollowUp)
  const customers = useMasterStore((s) => s.customers)
  const products = useMasterStore((s) => s.products)

  const availableModes = useMemo(() => getAvailableCrmViewModes(), [])
  const [viewMode, setViewMode] = useState<CrmDashboardViewMode>(getDefaultCrmViewMode())
  const [followUpOpen, setFollowUpOpen] = useState(false)

  const opportunities = useMemo(
    () => filterOpportunitiesByView(allOpportunities, viewMode),
    [allOpportunities, viewMode],
  )
  const followUps = useMemo(
    () => enrichFollowUpStatus(filterFollowUpsByView(allFollowUps, viewMode)),
    [allFollowUps, viewMode],
  )
  const activities = useMemo(
    () => filterActivitiesByView(allActivities, viewMode),
    [allActivities, viewMode],
  )

  const metrics = useMemo(
    () => buildCrmDashboardMetrics({
      opportunities,
      followUps,
      activities,
      quotationDocuments,
      leads: allLeads,
    }),
    [opportunities, followUps, activities, quotationDocuments, allLeads],
  )

  const { data: apiMetrics, loading: apiMetricsLoading, error: apiMetricsError, refetch: refetchApiMetrics } =
    useCrmDashboardApiMetrics('month')
  const apiChartSeries = useMemo(
    () => (apiMode ? buildCrmDashboardChartSeries(apiMetrics) : null),
    [apiMetrics, apiMode],
  )
  const useApiCharts = apiMode
  const displayMetrics = useMemo(
    () => (apiMode ? applyApiDashboardOverlay(metrics, apiMetrics) : metrics),
    [metrics, apiMetrics, apiMode],
  )

  const displayPanelMetrics = useMemo(
    () => (apiMode ? applyApiDashboardPanelOverlay(displayMetrics, apiMetrics) : metrics),
    [displayMetrics, metrics, apiMetrics, apiMode],
  )

  const nextActions = useMemo(
    () => buildCrmNextActions(viewMode === 'my' ? 6 : 8),
    [opportunities, followUps, quotationDocuments, activities, viewMode],
  )

  const lookup = useMemo(
    () => ({
      customerName: (id: string) => customers.find((c) => c.id === id)?.customerName ?? id,
      productName: (id: string) => products.find((p) => p.id === id)?.productName ?? id,
    }),
    [customers, products],
  )

  const approvalPending = apiMode
    ? (apiMetrics?.panels?.pendingApprovalCount ?? displayPanelMetrics.quotationsPending)
    : quotationDocuments.filter((d) => d.status === 'pending_approval').length
  const maxHotValue = Math.max(...displayPanelMetrics.hotOpportunities.map((o) => o.value), 1)

  const pipelineHealth = useMemo(() => {
    const stuckPenalty = Math.min(20, displayPanelMetrics.stuckOpportunities.length * 3)
    const overloadPenalty = displayMetrics.followUpsDueToday > 12 ? 8 : 0
    return Math.max(0, Math.min(100, Math.round(displayMetrics.conversionRate + 32 - stuckPenalty - overloadPenalty)))
  }, [displayMetrics.conversionRate, displayMetrics.followUpsDueToday, displayPanelMetrics.stuckOpportunities.length])

  const subtitle =
    viewMode === 'ceo'
      ? 'Company pipeline · forecast · approvals · risk'
      : viewMode === 'manager'
        ? 'Team pipeline · follow-up discipline · stuck deals'
        : 'My follow-ups · my opportunities · my next actions'

  const dashboardKpiStrip = useMemo(
    () => buildCrmDashboardKpiStrip(displayMetrics, approvalPending),
    [displayMetrics, approvalPending],
  )

  const crmViewTabs = useMemo(
    () =>
      availableModes.map((mode) => ({
        id: mode,
        label: CRM_VIEW_MODE_LABELS[mode],
        icon: (mode === 'ceo' ? LayoutDashboard : mode === 'manager' ? Users : User) as typeof LayoutDashboard,
      })),
    [availableModes],
  )

  const managementFeed = useMemo(
    () =>
      buildCrmManagementFeed({
        opportunities,
        followUps,
        activities,
        quotationDocuments,
        leads: allLeads,
        resolveCustomerName: (id) => customers.find((c) => c.id === id)?.customerName ?? id,
      }),
    [opportunities, followUps, activities, quotationDocuments, allLeads, customers],
  )

  return (
    <>
      <DynamicsModuleDashboard
        variant="fiori"
        breadcrumb={[
          { label: 'Home', href: '/home' },
          { label: 'CRM', href: '/crm' },
          { label: 'Command Center' },
        ]}
        title="CRM Command Center"
        subtitle={subtitle}
        badge="CRM"
        favoritePath="/crm"
        showFactoryLive={false}
        heroLayout="uniform"
        healthScore={pipelineHealth}
        healthLabel="Pipeline health"
        healthSublabel="Win rate · velocity · follow-ups"
        kpiColumns={5}
        heroMetrics={[
          {
            id: 'pipe',
            label: 'Pipeline Value',
            value: formatCrmCurrency(displayMetrics.pipelineValue),
            helper: `${displayMetrics.openOpportunities} active opportunities${apiMetricsLoading && apiMode ? ' · syncing…' : ''}`,
            icon: TrendingUp,
            accent: 'green',
            href: '/crm/opportunities',
          },
          {
            id: 'forecast',
            label: 'Weighted Forecast',
            value: formatCrmCurrency(displayMetrics.weightedForecast),
            helper: 'Probability-adjusted',
            icon: Target,
            accent: 'blue',
            href: '/crm/forecast',
          },
          {
            id: 'hot',
            label: 'Hot Deal Value',
            value: formatCrmCurrency(displayPanelMetrics.hotDealValue),
            helper: `${displayPanelMetrics.hotOpportunities.length} high-value deals`,
            icon: Flame,
            accent: 'amber',
            href: '/crm/opportunities',
          },
          {
            id: 'stuck',
            label: 'Stuck Deal Value',
            value: formatCrmCurrency(displayPanelMetrics.stuckDealValue),
            helper:
              displayPanelMetrics.stuckOpportunities.length > 0
                ? `${displayPanelMetrics.stuckOpportunities.length} need attention`
                : 'Pipeline moving',
            icon: AlertTriangle,
            accent: displayPanelMetrics.stuckOpportunities.length > 0 ? 'red' : 'indigo',
            href: '/crm/opportunities',
          },
        ]}
        kpiStrip={dashboardKpiStrip}
        quickActions={
          <FioriToolbarShell
            tabs={
              <FioriSegmentedView<CrmDashboardViewMode>
                tabs={crmViewTabs}
                value={viewMode}
                onChange={setViewMode}
                ariaLabel="CRM dashboard view"
              />
            }
            actions={
              <>
                <ErpButton type="button" size="sm" variant="secondary" icon={Activity} onClick={() => navigate('/crm/opportunities?view=activities')}>
                  Activities
                </ErpButton>
                <ErpButton type="button" size="sm" variant="secondary" icon={FileText} onClick={() => navigate('/crm/quotations')}>
                  Quotations
                </ErpButton>
                <ErpButton type="button" size="sm" variant="secondary" onClick={() => navigate('/crm/guided-deal')}>
                  Guided deal
                </ErpButton>
                <ErpButton type="button" size="sm" icon={Plus} onClick={() => setFollowUpOpen(true)}>
                  Schedule follow-up
                </ErpButton>
              </>
            }
          />
        }
      >
        <div className="crm-dashboard-zones">
          <DashboardManagementFeed
            items={managementFeed}
            title="Activity stream"
            subtitle="Real-time updates across leads, pipeline, quotations & follow-ups"
            navigation={dashboardNav}
          />

          <CrmPipelineHealthBoard
            opportunities={opportunities}
            onStageClick={(stageId, stageLabel) => {
              const stageOpps = opportunities.filter((o) => o.stage === stageId)
              dashboardNav.openQuickView(
                {
                  title: `${stageLabel} pipeline`,
                  subtitle: `${stageOpps.length} opportunities`,
                  fields: stageOpps.slice(0, 6).map((o) => ({
                    label: o.opportunityName,
                    value: formatCrmCurrency(o.value),
                    href: `/crm/opportunities/${o.id}`,
                  })),
                  primaryAction: { label: 'View all in list', href: `/crm/opportunities?stage=${stageId}` },
                },
                `/crm/opportunities?stage=${stageId}`,
              )
            }}
          />

          <DynamicsDashboardGrid>
            <CrmStageFunnelChart
              opportunities={useApiCharts ? undefined : opportunities}
              data={apiChartSeries?.stageFunnel}
            />
            <CrmLeadStageFunnelChart
              funnel={apiChartSeries?.leadStageFunnel ?? (useApiCharts ? [] : metrics.leadStageFunnel)}
            />
            <CrmPipelineValueChart
              opportunities={useApiCharts ? undefined : opportunities}
              data={apiChartSeries?.pipelineChart}
            />
          </DynamicsDashboardGrid>

          <DynamicsDashboardGrid>
            <CrmDealOutcomesChart
              openCount={
                apiChartSeries?.dealOutcomeMeta.openCount
                ?? (useApiCharts ? 0 : displayMetrics.openOpportunities)
              }
              wonCount={
                apiChartSeries?.dealOutcomeMeta.wonCount
                ?? (useApiCharts ? 0 : displayMetrics.dealsWon)
              }
              lostCount={
                apiChartSeries?.dealOutcomeMeta.lostCount
                ?? (useApiCharts ? 0 : displayMetrics.dealsLost)
              }
              conversionRate={
                apiChartSeries?.dealOutcomeMeta.conversionRate
                ?? (useApiCharts ? 0 : displayMetrics.conversionRate)
              }
              weightedForecast={
                apiChartSeries?.dealOutcomeMeta.weightedForecast
                ?? (useApiCharts ? 0 : displayMetrics.weightedForecast)
              }
              data={apiChartSeries?.dealOutcomes}
            />
            <CrmActivityTrendChart
              activities={useApiCharts ? undefined : activities}
              data={apiChartSeries?.activityTrend}
            />
            <CrmFollowUpUrgencyChart
              followUps={useApiCharts ? undefined : followUps}
              data={apiChartSeries?.followUpUrgency}
            />
          </DynamicsDashboardGrid>

          <section className="crm-zone" aria-label="Action zone">
            <h2 className="crm-zone-title">Action zone</h2>
            <DynamicsDashboardGrid>
              <CrmFollowUpsPanel
                followUps={displayPanelMetrics.todaysFollowUps}
                customers={customers}
                contacts={contacts}
                opportunities={opportunities}
                onSchedule={() => setFollowUpOpen(true)}
                onComplete={(id) => completeFollowUp(id, 'Done from dashboard')}
                onReschedule={(id, d, t) => rescheduleFollowUp(id, d, t)}
              />
              <CrmNextActionsPanel actions={nextActions} />
            </DynamicsDashboardGrid>
            <DynamicsDashboardGrid>
              <CrmQuotationApprovalPanel
                documents={displayPanelMetrics.pendingApprovalQuotations}
                customers={customers}
                opportunities={opportunities}
                loading={apiMode && apiMetricsLoading && !apiMetrics}
                error={apiMode ? apiMetricsError : null}
                onRetry={apiMode ? () => void refetchApiMetrics() : undefined}
              />
            </DynamicsDashboardGrid>
          </section>

          <section className="crm-zone" aria-label="Risk zone">
            <h2 className="crm-zone-title">Risk zone</h2>
            <DynamicsDashboardGrid>
              <CrmStuckOpportunitiesPanel insights={displayPanelMetrics.stuckInsights} />
            </DynamicsDashboardGrid>
          </section>

          <section className="crm-zone" aria-label="Intelligence zone">
            <h2 className="crm-zone-title">Intelligence zone</h2>
            <DynamicsDashboardGrid>
              <CrmOwnerPipelineChart
                opportunities={useApiCharts ? undefined : opportunities}
                data={apiChartSeries?.ownerPipeline}
              />
              <CrmHotOpportunitiesPanel
                opportunities={displayPanelMetrics.hotOpportunities}
                lookup={lookup}
                maxValue={maxHotValue}
              />
            </DynamicsDashboardGrid>
            <div className="dyn-dashboard-split">
              <CrmRecentActivitiesPanel activities={displayPanelMetrics.recentActivities} lookup={lookup} />
              <CrmRecentlyWonPanel deals={displayPanelMetrics.recentlyWonDeals} lookup={lookup} />
            </div>
          </section>
        </div>
      </DynamicsModuleDashboard>

      <QuickFollowUpDrawer open={followUpOpen} onClose={() => setFollowUpOpen(false)} />
      <DashboardQuickViewDrawer
        open={!!dashboardNav.quickView}
        view={dashboardNav.quickView}
        fallbackHref={dashboardNav.quickViewHref}
        onClose={dashboardNav.closeQuickView}
      />
    </>
  )
}
