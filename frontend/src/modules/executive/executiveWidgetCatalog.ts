import type { DashboardTemplateKey, DashboardWidgetDefinition, DashboardWidgetLayout, WidgetVisualization } from '../../types/executiveDashboard'

/** Frontend catalog mirrors backend registry for demo mode + library UI. */
export const EXECUTIVE_WIDGET_CATALOG: DashboardWidgetDefinition[] = [
  { key: 'finance.revenue', module: 'FINANCE', name: 'Revenue', description: 'Posted tax invoice revenue', supportedVisualizations: ['KPI', 'LINE', 'BAR'], supportedFilters: ['dateRange', 'legalEntity'], defaultSize: { w: 3, h: 2 }, permission: 'reports.view' },
  { key: 'finance.receivables', module: 'FINANCE', name: 'Receivables', description: 'Open AR balance', supportedVisualizations: ['KPI'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'reports.view' },
  { key: 'finance.overdue_receivables', module: 'FINANCE', name: 'Overdue Receivables', supportedVisualizations: ['KPI', 'TABLE'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'reports.view' },
  { key: 'finance.payables', module: 'FINANCE', name: 'Payables', supportedVisualizations: ['KPI'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'reports.view' },
  { key: 'finance.cash_position', module: 'FINANCE', name: 'Cash Position', supportedVisualizations: ['KPI'], supportedFilters: ['legalEntity', 'branch'], defaultSize: { w: 3, h: 2 }, permission: 'reports.view' },
  { key: 'sales.order_book', module: 'SALES', name: 'Sales Order Book', supportedVisualizations: ['KPI', 'BAR'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'crm.sales_order.view' },
  { key: 'sales.order_intake', module: 'SALES', name: 'Order Intake', supportedVisualizations: ['KPI', 'LINE'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'crm.sales_order.view' },
  { key: 'sales.top_products', module: 'SALES', name: 'Top Products', supportedVisualizations: ['TABLE', 'BAR'], supportedFilters: ['dateRange'], defaultSize: { w: 6, h: 3 }, permission: 'crm.sales_order.view' },
  { key: 'crm.top_customers', module: 'CRM', name: 'Top Customers', supportedVisualizations: ['TABLE', 'BAR'], supportedFilters: ['dateRange'], defaultSize: { w: 6, h: 3 }, permission: 'crm.company.view' },
  { key: 'crm.pipeline_value', module: 'CRM', name: 'Pipeline Value', supportedVisualizations: ['KPI'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'crm.opportunity.view' },
  { key: 'purchase.commitments', module: 'PURCHASE', name: 'Purchase Commitments', supportedVisualizations: ['KPI', 'TABLE'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'purchase.reports.view' },
  { key: 'purchase.pending_pr', module: 'PURCHASE', name: 'Pending PR', supportedVisualizations: ['KPI'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'purchase.requisition.view' },
  { key: 'inventory.value', module: 'INVENTORY', name: 'Inventory Value', supportedVisualizations: ['KPI'], supportedFilters: ['branch'], defaultSize: { w: 3, h: 2 }, permission: 'inventory.reports.view' },
  { key: 'inventory.low_stock', module: 'INVENTORY', name: 'Low Stock / Stockout Risk', supportedVisualizations: ['KPI', 'TABLE', 'EXCEPTION'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'inventory.reports.view' },
  { key: 'manufacturing.active_wo', module: 'MANUFACTURING', name: 'Active Work Orders', supportedVisualizations: ['KPI', 'STATUS'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'manufacturing.reports.view' },
  { key: 'manufacturing.delayed_wo', module: 'MANUFACTURING', name: 'Delayed Work Orders', supportedVisualizations: ['KPI', 'TABLE'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'manufacturing.reports.view' },
  { key: 'manufacturing.production_today', module: 'MANUFACTURING', name: 'Production Today', supportedVisualizations: ['KPI', 'PROGRESS'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'manufacturing.reports.view' },
  { key: 'manufacturing.material_shortages', module: 'MANUFACTURING', name: 'Material Shortages', supportedVisualizations: ['KPI', 'EXCEPTION'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'manufacturing.reports.view' },
  { key: 'quality.ncr_open', module: 'QUALITY', name: 'Open NCR', supportedVisualizations: ['KPI'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'quality.reports.view' },
  { key: 'quality.rejections', module: 'QUALITY', name: 'Quality Rejections', supportedVisualizations: ['KPI', 'LINE'], supportedFilters: ['dateRange'], defaultSize: { w: 3, h: 2 }, permission: 'quality.reports.view' },
  { key: 'dispatch.pending', module: 'DISPATCH', name: 'Pending Dispatch', supportedVisualizations: ['KPI', 'TABLE'], supportedFilters: [], defaultSize: { w: 3, h: 2 }, permission: 'dispatch.reports.view' },
  { key: 'executive.alerts', module: 'EXECUTIVE', name: 'Executive Alerts', description: 'Cross-module exceptions', supportedVisualizations: ['EXCEPTION'], supportedFilters: [], defaultSize: { w: 12, h: 3 }, permission: 'executive.dashboard.view' },
]

const TEMPLATE_LAYOUTS: Record<Exclude<DashboardTemplateKey, 'blank'>, Array<{ widgetKey: string; x: number; y: number; w: number; h: number; visualization: WidgetVisualization }>> = {
  ceo_overview: [
    { widgetKey: 'finance.revenue', x: 0, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.cash_position', x: 3, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.receivables', x: 6, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.payables', x: 9, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'sales.order_book', x: 0, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'manufacturing.active_wo', x: 3, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'inventory.value', x: 6, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.overdue_receivables', x: 9, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'executive.alerts', x: 0, y: 4, w: 12, h: 3, visualization: 'EXCEPTION' },
  ],
  sales_overview: [
    { widgetKey: 'finance.revenue', x: 0, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'sales.order_intake', x: 3, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'crm.pipeline_value', x: 6, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'sales.order_book', x: 9, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'crm.top_customers', x: 0, y: 2, w: 6, h: 3, visualization: 'TABLE' },
    { widgetKey: 'sales.top_products', x: 6, y: 2, w: 6, h: 3, visualization: 'TABLE' },
  ],
  factory_overview: [
    { widgetKey: 'manufacturing.production_today', x: 0, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'manufacturing.active_wo', x: 3, y: 0, w: 3, h: 2, visualization: 'STATUS' },
    { widgetKey: 'manufacturing.delayed_wo', x: 6, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'manufacturing.material_shortages', x: 9, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'quality.ncr_open', x: 0, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'inventory.value', x: 3, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'dispatch.pending', x: 6, y: 2, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'executive.alerts', x: 0, y: 4, w: 12, h: 3, visualization: 'EXCEPTION' },
  ],
  finance_overview: [
    { widgetKey: 'finance.revenue', x: 0, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.cash_position', x: 3, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.receivables', x: 6, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.payables', x: 9, y: 0, w: 3, h: 2, visualization: 'KPI' },
    { widgetKey: 'finance.overdue_receivables', x: 0, y: 2, w: 6, h: 3, visualization: 'TABLE' },
    { widgetKey: 'purchase.commitments', x: 6, y: 2, w: 6, h: 3, visualization: 'TABLE' },
  ],
}

export function buildTemplateWidgets(template: DashboardTemplateKey): DashboardWidgetLayout[] {
  if (template === 'blank') return []
  return TEMPLATE_LAYOUTS[template].map((w) => ({
    id: crypto.randomUUID(),
    ...w,
  }))
}

export function getWidgetDefinition(key: string): DashboardWidgetDefinition | undefined {
  return EXECUTIVE_WIDGET_CATALOG.find((w) => w.key === key)
}

export const DASHBOARD_TEMPLATE_OPTIONS: { key: DashboardTemplateKey; label: string; description: string }[] = [
  { key: 'blank', label: 'Blank dashboard', description: 'Start empty and add widgets' },
  { key: 'ceo_overview', label: 'CEO Overview', description: 'Revenue, cash, AR/AP, operations, alerts' },
  { key: 'sales_overview', label: 'Sales Overview', description: 'Revenue, intake, pipeline, customers' },
  { key: 'factory_overview', label: 'Factory Overview', description: 'Production, WO, quality, dispatch' },
  { key: 'finance_overview', label: 'Finance Overview', description: 'Cash, AR/AP, commitments' },
]
