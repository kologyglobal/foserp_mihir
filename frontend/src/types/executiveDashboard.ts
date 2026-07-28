/** CEO / Executive dashboard widget contracts (presentation layer). */

export type WidgetModule =
  | 'CRM'
  | 'SALES'
  | 'PURCHASE'
  | 'INVENTORY'
  | 'MANUFACTURING'
  | 'QUALITY'
  | 'DISPATCH'
  | 'FINANCE'
  | 'EXECUTIVE'
  | 'CUSTOM'

export type WidgetVisualization =
  | 'KPI'
  | 'LINE'
  | 'BAR'
  | 'AREA'
  | 'DONUT'
  | 'PIE'
  | 'TABLE'
  | 'STATUS'
  | 'EXCEPTION'
  | 'PROGRESS'

export type DashboardDatePreset =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'this_quarter'
  | 'this_fy'
  | 'last_fy'
  | 'custom'

export interface DashboardWidgetDefinition {
  key: string
  module: WidgetModule
  name: string
  description?: string
  supportedVisualizations: WidgetVisualization[]
  supportedFilters: string[]
  defaultSize: { w: number; h: number }
  permission: string
}

export interface DashboardGlobalFilters {
  datePreset: DashboardDatePreset
  dateFrom?: string
  dateTo?: string
  legalEntityId?: string | null
  branchId?: string | null
  departmentId?: string | null
  compareWith?: 'previous_period' | 'previous_month' | 'previous_quarter' | 'previous_year' | null
}

export interface DashboardWidgetLayout {
  id: string
  widgetKey: string
  x: number
  y: number
  w: number
  h: number
  visualization: WidgetVisualization
  configuration?: Record<string, unknown>
  filters?: Record<string, unknown>
}

export interface ExecutiveDashboardDto {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isShared: boolean
  widgets: DashboardWidgetLayout[]
  createdAt: string
  updatedAt: string
}

export interface WidgetQueryResult {
  widgetKey: string
  visualization: WidgetVisualization
  title: string
  drillDownPath?: string | null
  error?: string | null
  data: {
    value?: number | null
    previousValue?: number | null
    changePercentage?: number | null
    unit?: string | null
    label?: string | null
    items?: Array<{ label: string; value: number | string; href?: string }>
    series?: Array<{ name: string; data: number[] }>
    labels?: string[]
    statusCounts?: Record<string, number>
    alerts?: Array<{ severity: 'critical' | 'warning' | 'info'; message: string; href?: string }>
    progress?: { current: number; target: number; pct: number }
  }
}

export type DashboardTemplateKey = 'ceo_overview' | 'sales_overview' | 'factory_overview' | 'finance_overview' | 'blank'
