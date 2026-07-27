import type { Prisma } from '@prisma/client'
import type { WidgetVisualization } from './widget-registry.js'

export interface WidgetLayoutInput {
  widgetKey: string
  positionX: number
  positionY: number
  width: number
  height: number
  visualization?: WidgetVisualization | null
  configurationJson?: Prisma.InputJsonValue | null
  filterJson?: Prisma.InputJsonValue | null
}

export interface CreateDashboardInput {
  name: string
  description?: string | null
  templateKey?: string | null
  widgets?: WidgetLayoutInput[]
  isShared?: boolean
  isDefault?: boolean
}

export interface UpdateDashboardInput {
  name?: string
  description?: string | null
  isShared?: boolean
  widgets?: WidgetLayoutInput[]
}

export interface WidgetQueryInput {
  widgetKey: string
  visualization?: WidgetVisualization
  filters?: Record<string, unknown>
  globalFilters?: Record<string, unknown>
}

export interface WidgetAlertItem {
  key?: string
  severity: 'info' | 'warning' | 'critical'
  title?: string
  message: string
  count?: number
  path?: string
  href?: string
}

export interface WidgetDataPayload {
  value: number | null
  previousValue: number | null
  changePercentage: number | null
  unit: string | null
  label: string | null
  items: Array<{ label: string; value: number | string; href?: string }>
  series: Array<{ name: string; data: number[] }>
  labels: string[]
  statusCounts: Record<string, number>
  alerts: WidgetAlertItem[]
  progress?: { current: number; target: number; pct: number } | null
  available?: boolean
  unavailableReason?: string | null
}

export interface WidgetQueryResult {
  widgetKey: string
  visualization: WidgetVisualization
  title: string
  drillDownPath: string | null
  data: WidgetDataPayload
  ok: boolean
  error?: string | null
}

/** FE layout shape (x/y/w/h). */
export interface DashboardWidgetDto {
  id: string
  widgetKey: string
  x: number
  y: number
  w: number
  h: number
  visualization: WidgetVisualization | string | null
  configuration?: unknown
  filters?: unknown
  createdAt?: string
  updatedAt?: string
}

export interface DashboardDto {
  id: string
  name: string
  description: string | null
  isDefault: boolean
  isShared: boolean
  userId?: string
  createdAt: string
  updatedAt: string
  widgets: DashboardWidgetDto[]
}

export function emptyWidgetData(label = '', unit: string | null = null): WidgetDataPayload {
  return {
    value: 0,
    previousValue: null,
    changePercentage: null,
    unit,
    label,
    items: [],
    series: [],
    labels: [],
    statusCounts: {},
    alerts: [],
    progress: null,
    available: true,
    unavailableReason: null,
  }
}

export function unavailableWidgetData(reason: string, label = '', unit: string | null = null): WidgetDataPayload {
  return {
    ...emptyWidgetData(label, unit),
    value: null,
    available: false,
    unavailableReason: reason,
  }
}
