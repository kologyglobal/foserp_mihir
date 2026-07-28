import { getErpExecutiveAnalytics } from '../../services/erpAnalyticsService'
import { getExecutiveDashboardData, getProductionControlTowerData } from '../../utils/controlTowerMetrics'
import { useCrmStore } from '../../store/crmStore'
import { useMasterStore } from '../../store/masterStore'
import { useMrpStore } from '../../store/mrpStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useQualityStore } from '../../store/qualityStore'
import { useDispatchStore } from '../../store/dispatchStore'
import type { WidgetQueryResult, WidgetVisualization } from '../../types/executiveDashboard'
import { getWidgetDefinition } from './executiveWidgetCatalog'

/** Demo-mode widget query — uses existing store metrics. */
export function queryWidgetDemo(
  widgetKey: string,
  visualization: WidgetVisualization = 'KPI',
): WidgetQueryResult {
  const def = getWidgetDefinition(widgetKey)
  const title = def?.name ?? widgetKey
  const a = getErpExecutiveAnalytics()
  const exec = getExecutiveDashboardData()
  const prod = getProductionControlTowerData()

  const base = (data: WidgetQueryResult['data'], drillDownPath?: string): WidgetQueryResult => ({
    widgetKey,
    visualization,
    title,
    drillDownPath: drillDownPath ?? null,
    data,
  })

  switch (widgetKey) {
    case 'finance.revenue':
      return base({ value: a.invoicedYtd, unit: 'INR', label: 'Invoiced YTD' }, '/accounting/money-in/invoices')
    case 'finance.receivables':
      return base({ value: a.outstandingAr, unit: 'INR', label: 'Outstanding AR' }, '/accounting/money-in/outstanding')
    case 'finance.overdue_receivables':
      return base({ value: a.overdueAr, unit: 'INR', label: `${a.overdueCount} overdue` }, '/accounting/money-in/outstanding')
    case 'finance.payables':
      return base({ value: 0, unit: 'INR', label: 'Open AP' }, '/accounting/money-out/vendor-invoices')
    case 'finance.cash_position':
      return base({ value: null, label: 'Connect treasury for live cash', unit: 'INR' }, '/accounting/bank-cash')
    case 'sales.order_book':
      return base({ value: a.orderBookValue, unit: 'INR', label: `${a.orderBookCount} open` }, '/sales/orders')
    case 'sales.order_intake':
      return base({ value: a.orderBookValue, unit: 'INR', label: 'Order book' }, '/sales/orders')
    case 'sales.top_products': {
      const sos = useMrpStore.getState().salesOrders.slice(0, 5)
      return base({
        items: sos.map((s) => ({
          label: s.salesOrderNo,
          value: s.grandTotal ?? 0,
          href: `/sales/orders/${s.id}`,
        })),
      }, '/sales/orders')
    }
    case 'crm.top_customers': {
      const cos = useMasterStore.getState().customers.slice(0, 5)
      return base({
        items: cos.map((c) => ({
          label: c.customerName,
          value: '—',
          href: `/crm/companies/${c.id}`,
        })),
      }, '/crm/companies')
    }
    case 'crm.pipeline_value': {
      const opps = useCrmStore.getState().opportunities
      const value = opps.reduce((s, o) => {
        const raw = o as { estimatedValue?: number; value?: number }
        return s + (Number(raw.estimatedValue ?? raw.value) || 0)
      }, 0)
      return base({ value, unit: 'INR', label: `${opps.length} opportunities` }, '/crm/opportunities')
    }
    case 'purchase.commitments': {
      const pos = usePurchaseStore.getState().purchaseOrders.filter((p) => !['closed', 'cancelled'].includes(p.status))
      const value = pos.reduce(
        (s, p) => s + p.lines.reduce((lineSum, line) => lineSum + line.qty * line.rate, 0),
        0,
      )
      return base({ value, unit: 'INR', label: `${pos.length} open POs` }, '/purchase/orders')
    }
    case 'purchase.pending_pr': {
      const n = usePurchaseStore.getState().requisitions.filter((r) => r.status === 'submitted').length
      return base({ value: n, label: 'Awaiting approval' }, '/purchase/requisitions')
    }
    case 'inventory.value':
      return base({ value: exec.fgValue + exec.wipValue, unit: 'INR', label: 'FG + WIP' }, '/inventory/ledger')
    case 'inventory.low_stock':
      return base({ value: a.materialShortages, label: 'Shortage signals' }, '/inventory/stock')
    case 'manufacturing.active_wo':
      return base(
        visualization === 'STATUS'
          ? { statusCounts: { 'On track': prod.running, Late: prod.late, 'QC hold': prod.qcHolds, Rework: prod.reworkQueue } }
          : { value: a.runningWorkOrders, label: 'Running WOs' },
        '/manufacturing/work-orders',
      )
    case 'manufacturing.delayed_wo':
      return base({ value: prod.late, label: 'Past planned finish' }, '/manufacturing/work-orders')
    case 'manufacturing.production_today':
      return base({
        value: prod.running,
        progress: {
          current: prod.running,
          target: Math.max(prod.running + 5, 10),
          pct: Math.min(100, (prod.running / Math.max(prod.running + 5, 10)) * 100),
        },
        label: 'Active production',
      }, '/manufacturing/control-room')
    case 'manufacturing.material_shortages':
      return base({ value: a.materialShortages, label: 'MRP shortages' }, '/manufacturing/production-plan')
    case 'quality.ncr_open':
      return base({ value: a.openNcr, label: 'Open NCRs' }, '/quality/ncr')
    case 'quality.rejections': {
      const qc = useQualityStore.getState().getMetrics?.() as { rejected?: number } | undefined
      return base({ value: qc?.rejected ?? a.openNcr, label: 'Rejection / NCR signal' }, '/quality/reports')
    }
    case 'dispatch.pending': {
      const d = useDispatchStore.getState().dispatches.filter((x) => !['delivered', 'closed', 'cancelled'].includes(x.status))
      return base({ value: d.length, label: 'Open dispatches' }, '/dispatch/register')
    }
    case 'executive.alerts': {
      const alerts: NonNullable<WidgetQueryResult['data']['alerts']> = []
      if (a.delayedOrders) alerts.push({ severity: 'critical', message: `${a.delayedOrders} delayed sales orders`, href: '/sales/orders' })
      if (prod.late) alerts.push({ severity: 'critical', message: `${prod.late} delayed work orders`, href: '/manufacturing/work-orders' })
      if (a.openNcr) alerts.push({ severity: 'warning', message: `${a.openNcr} open NCRs`, href: '/quality/ncr' })
      if (a.overdueCount) alerts.push({ severity: 'critical', message: `${a.overdueCount} overdue receivables`, href: '/accounting/money-in/outstanding' })
      if (a.materialShortages) alerts.push({ severity: 'warning', message: `${a.materialShortages} material shortages`, href: '/manufacturing/production-plan' })
      if (!alerts.length) alerts.push({ severity: 'info', message: 'No critical exceptions right now' })
      return base({ alerts }, '/inbox')
    }
    default:
      return { widgetKey, visualization, title, error: 'Widget not available', data: {} }
  }
}
