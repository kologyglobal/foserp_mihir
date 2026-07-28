import type { PermissionName } from '../../constants/permissions.js'

export const WIDGET_VISUALIZATIONS = [
  'KPI',
  'LINE',
  'BAR',
  'AREA',
  'DONUT',
  'PIE',
  'TABLE',
  'STATUS',
  'EXCEPTION',
  'PROGRESS',
] as const

export type WidgetVisualization = (typeof WIDGET_VISUALIZATIONS)[number]

export interface DashboardWidgetDefinition {
  key: string
  module: string
  name: string
  description: string
  supportedVisualizations: WidgetVisualization[]
  supportedFilters: string[]
  defaultSize: { w: number; h: number }
  permission: PermissionName
  drillDownPath: string
  defaultVisualization: WidgetVisualization
}

export const DASHBOARD_WIDGET_DEFINITIONS: DashboardWidgetDefinition[] = [
  {
    key: 'finance.revenue',
    module: 'finance',
    name: 'Revenue',
    description: 'Posted tax invoice grand totals (CRM commercial).',
    supportedVisualizations: ['KPI', 'LINE', 'BAR', 'AREA'],
    supportedFilters: ['fromDate', 'toDate', 'companyId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'crm.commercial.invoice.view',
    drillDownPath: '/crm/commercial/invoices',
    defaultVisualization: 'KPI',
  },
  {
    key: 'sales.order_book',
    module: 'sales',
    name: 'Order book',
    description: 'Open and confirmed sales order value.',
    supportedVisualizations: ['KPI', 'BAR', 'STATUS'],
    supportedFilters: ['companyId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'crm.sales_order.view',
    drillDownPath: '/crm/sales-orders',
    defaultVisualization: 'KPI',
  },
  {
    key: 'sales.order_intake',
    module: 'sales',
    name: 'Order intake',
    description: 'Sales orders created in the selected period.',
    supportedVisualizations: ['KPI', 'LINE', 'BAR'],
    supportedFilters: ['fromDate', 'toDate'],
    defaultSize: { w: 2, h: 2 },
    permission: 'crm.sales_order.view',
    drillDownPath: '/crm/sales-orders',
    defaultVisualization: 'KPI',
  },
  {
    key: 'finance.receivables',
    module: 'finance',
    name: 'Receivables',
    description: 'Open CRM tax invoice balance due.',
    supportedVisualizations: ['KPI', 'BAR', 'TABLE'],
    supportedFilters: ['companyId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'crm.commercial.invoice.view',
    drillDownPath: '/crm/commercial/invoices',
    defaultVisualization: 'KPI',
  },
  {
    key: 'finance.overdue_receivables',
    module: 'finance',
    name: 'Overdue receivables',
    description: 'Receivables past due date with remaining balance.',
    supportedVisualizations: ['KPI', 'TABLE', 'EXCEPTION'],
    supportedFilters: ['companyId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'crm.commercial.invoice.view',
    drillDownPath: '/crm/commercial/invoices',
    defaultVisualization: 'KPI',
  },
  {
    key: 'finance.payables',
    module: 'finance',
    name: 'Payables',
    description: 'Open AP outstanding (payable open items).',
    supportedVisualizations: ['KPI', 'BAR', 'TABLE'],
    supportedFilters: ['legalEntityId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'finance.ap.view',
    drillDownPath: '/finance/payables',
    defaultVisualization: 'KPI',
  },
  {
    key: 'finance.cash_position',
    module: 'finance',
    name: 'Cash position',
    description: 'Bank and cash book balances from treasury GL.',
    supportedVisualizations: ['KPI', 'DONUT', 'TABLE'],
    supportedFilters: ['legalEntityId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'finance.treasury.liquidity.view',
    drillDownPath: '/finance/treasury/liquidity',
    defaultVisualization: 'KPI',
  },
  {
    key: 'inventory.value',
    module: 'inventory',
    name: 'Inventory value',
    description: 'On-hand stock value (balance × avg rate / stockValue).',
    supportedVisualizations: ['KPI', 'BAR'],
    supportedFilters: ['warehouseId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'inventory.reports.view',
    drillDownPath: '/inventory/stock',
    defaultVisualization: 'KPI',
  },
  {
    key: 'inventory.low_stock',
    module: 'inventory',
    name: 'Low stock',
    description: 'Items at or below reorder level.',
    supportedVisualizations: ['KPI', 'TABLE', 'EXCEPTION'],
    supportedFilters: ['warehouseId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'inventory.reports.view',
    drillDownPath: '/inventory/stock',
    defaultVisualization: 'KPI',
  },
  {
    key: 'manufacturing.active_wo',
    module: 'manufacturing',
    name: 'Active work orders',
    description: 'Production orders in READY / IN_PROGRESS / ON_HOLD.',
    supportedVisualizations: ['KPI', 'STATUS', 'BAR'],
    supportedFilters: [],
    defaultSize: { w: 2, h: 2 },
    permission: 'manufacturing.reports.view',
    drillDownPath: '/manufacturing/work-orders',
    defaultVisualization: 'KPI',
  },
  {
    key: 'manufacturing.delayed_wo',
    module: 'manufacturing',
    name: 'Delayed work orders',
    description: 'Work orders past required completion or marked DELAYED.',
    supportedVisualizations: ['KPI', 'TABLE', 'EXCEPTION'],
    supportedFilters: [],
    defaultSize: { w: 2, h: 2 },
    permission: 'manufacturing.reports.view',
    drillDownPath: '/manufacturing/work-orders',
    defaultVisualization: 'KPI',
  },
  {
    key: 'manufacturing.production_today',
    module: 'manufacturing',
    name: 'Production today',
    description: 'Good quantity recorded on today’s production batches.',
    supportedVisualizations: ['KPI', 'BAR', 'PROGRESS'],
    supportedFilters: [],
    defaultSize: { w: 2, h: 2 },
    permission: 'manufacturing.reports.view',
    drillDownPath: '/manufacturing/daily-production',
    defaultVisualization: 'KPI',
  },
  {
    key: 'manufacturing.material_shortages',
    module: 'manufacturing',
    name: 'Material shortages',
    description: 'Production order material lines with SHORT status or shortage qty.',
    supportedVisualizations: ['KPI', 'TABLE', 'EXCEPTION'],
    supportedFilters: [],
    defaultSize: { w: 2, h: 2 },
    permission: 'manufacturing.reports.view',
    drillDownPath: '/manufacturing/materials',
    defaultVisualization: 'KPI',
  },
  {
    key: 'quality.ncr_open',
    module: 'quality',
    name: 'Open NCRs',
    description: 'Non-conformance reports not closed or cancelled.',
    supportedVisualizations: ['KPI', 'STATUS', 'TABLE'],
    supportedFilters: [],
    defaultSize: { w: 2, h: 2 },
    permission: 'quality.reports.view',
    drillDownPath: '/quality/ncr',
    defaultVisualization: 'KPI',
  },
  {
    key: 'quality.rejections',
    module: 'quality',
    name: 'Rejections',
    description: 'Rejected quantity on production orders / daily lines.',
    supportedVisualizations: ['KPI', 'BAR', 'LINE'],
    supportedFilters: ['fromDate', 'toDate'],
    defaultSize: { w: 2, h: 2 },
    permission: 'quality.reports.view',
    drillDownPath: '/quality/inspections',
    defaultVisualization: 'KPI',
  },
  {
    key: 'dispatch.pending',
    module: 'dispatch',
    name: 'Pending dispatch',
    description: 'Active dispatch requirements with remaining quantity.',
    supportedVisualizations: ['KPI', 'TABLE', 'STATUS'],
    supportedFilters: [],
    defaultSize: { w: 2, h: 2 },
    permission: 'dispatch.reports.view',
    drillDownPath: '/dispatch/requirements',
    defaultVisualization: 'KPI',
  },
  {
    key: 'purchase.commitments',
    module: 'purchase',
    name: 'Purchase commitments',
    description: 'Open purchase order total value.',
    supportedVisualizations: ['KPI', 'BAR', 'TABLE'],
    supportedFilters: ['vendorId'],
    defaultSize: { w: 2, h: 2 },
    permission: 'purchase.reports.view',
    drillDownPath: '/purchase/orders',
    defaultVisualization: 'KPI',
  },
  {
    key: 'crm.top_customers',
    module: 'crm',
    name: 'Top customers',
    description: 'Customers ranked by posted invoice revenue.',
    supportedVisualizations: ['TABLE', 'BAR', 'DONUT'],
    supportedFilters: ['fromDate', 'toDate', 'limit'],
    defaultSize: { w: 4, h: 3 },
    permission: 'crm.dashboard.view',
    drillDownPath: '/crm/companies',
    defaultVisualization: 'TABLE',
  },
  {
    key: 'sales.top_products',
    module: 'sales',
    name: 'Top products',
    description: 'Products ranked by sales order / invoice line qty and value.',
    supportedVisualizations: ['TABLE', 'BAR', 'DONUT'],
    supportedFilters: ['fromDate', 'toDate', 'limit'],
    defaultSize: { w: 4, h: 3 },
    permission: 'crm.sales_order.view',
    drillDownPath: '/crm/sales-orders',
    defaultVisualization: 'TABLE',
  },
  {
    key: 'executive.alerts',
    module: 'executive',
    name: 'Executive alerts',
    description: 'Aggregated operational exceptions for leadership.',
    supportedVisualizations: ['EXCEPTION', 'TABLE', 'STATUS'],
    supportedFilters: [],
    defaultSize: { w: 4, h: 3 },
    permission: 'executive.dashboard.view',
    drillDownPath: '/operations/exceptions',
    defaultVisualization: 'EXCEPTION',
  },
]

export const WIDGET_DEFINITION_BY_KEY = new Map(
  DASHBOARD_WIDGET_DEFINITIONS.map((d) => [d.key, d]),
)

export function getWidgetDefinition(key: string): DashboardWidgetDefinition | undefined {
  return WIDGET_DEFINITION_BY_KEY.get(key)
}

export interface DashboardTemplateWidget {
  widgetKey: string
  x: number
  y: number
  w: number
  h: number
  visualization: WidgetVisualization
}

export interface DashboardTemplate {
  key: string
  name: string
  description: string
  widgets: DashboardTemplateWidget[]
}

export const DASHBOARD_TEMPLATES: DashboardTemplate[] = [
  {
    key: 'ceo_overview',
    name: 'CEO overview',
    description: 'Cross-module leadership snapshot.',
    widgets: [
      { widgetKey: 'finance.revenue', x: 0, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'sales.order_book', x: 2, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.receivables', x: 4, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.cash_position', x: 6, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'manufacturing.active_wo', x: 0, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'inventory.value', x: 2, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'dispatch.pending', x: 4, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'quality.ncr_open', x: 6, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'executive.alerts', x: 0, y: 4, w: 8, h: 3, visualization: 'EXCEPTION' },
    ],
  },
  {
    key: 'sales_overview',
    name: 'Sales overview',
    description: 'Order book, intake, customers and products.',
    widgets: [
      { widgetKey: 'sales.order_book', x: 0, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'sales.order_intake', x: 2, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.revenue', x: 4, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.receivables', x: 6, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'crm.top_customers', x: 0, y: 2, w: 4, h: 3, visualization: 'TABLE' },
      { widgetKey: 'sales.top_products', x: 4, y: 2, w: 4, h: 3, visualization: 'TABLE' },
    ],
  },
  {
    key: 'factory_overview',
    name: 'Factory overview',
    description: 'Production, quality, inventory and dispatch.',
    widgets: [
      { widgetKey: 'manufacturing.active_wo', x: 0, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'manufacturing.delayed_wo', x: 2, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'manufacturing.production_today', x: 4, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'manufacturing.material_shortages', x: 6, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'quality.ncr_open', x: 0, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'quality.rejections', x: 2, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'inventory.low_stock', x: 4, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'dispatch.pending', x: 6, y: 2, w: 2, h: 2, visualization: 'KPI' },
    ],
  },
  {
    key: 'finance_overview',
    name: 'Finance overview',
    description: 'Revenue, AR/AP, cash and purchase commitments.',
    widgets: [
      { widgetKey: 'finance.revenue', x: 0, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.receivables', x: 2, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.overdue_receivables', x: 4, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.payables', x: 6, y: 0, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'finance.cash_position', x: 0, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'purchase.commitments', x: 2, y: 2, w: 2, h: 2, visualization: 'KPI' },
      { widgetKey: 'crm.top_customers', x: 4, y: 2, w: 4, h: 3, visualization: 'TABLE' },
    ],
  },
]

export const DASHBOARD_TEMPLATE_BY_KEY = new Map(DASHBOARD_TEMPLATES.map((t) => [t.key, t]))
