import { apiRequest, tenantPath } from './client'
import type {
  DashboardGlobalFilters,
  DashboardTemplateKey,
  DashboardWidgetDefinition,
  DashboardWidgetLayout,
  ExecutiveDashboardDto,
  WidgetQueryResult,
  WidgetVisualization,
} from '@/types/executiveDashboard'

type ApiWidget = {
  id: string
  widgetKey: string
  positionX?: number
  positionY?: number
  width?: number
  height?: number
  x?: number
  y?: number
  w?: number
  h?: number
  visualization?: WidgetVisualization | null
  configurationJson?: Record<string, unknown> | null
  filterJson?: Record<string, unknown> | null
  configuration?: Record<string, unknown>
  filters?: Record<string, unknown>
}

type ApiDashboard = Omit<ExecutiveDashboardDto, 'widgets'> & { widgets: ApiWidget[] }

function mapWidget(w: ApiWidget): DashboardWidgetLayout {
  return {
    id: w.id,
    widgetKey: w.widgetKey,
    x: w.x ?? w.positionX ?? 0,
    y: w.y ?? w.positionY ?? 0,
    w: w.w ?? w.width ?? 3,
    h: w.h ?? w.height ?? 2,
    visualization: (w.visualization ?? 'KPI') as WidgetVisualization,
    configuration: w.configuration ?? w.configurationJson ?? undefined,
    filters: w.filters ?? w.filterJson ?? undefined,
  }
}

function mapDashboard(d: ApiDashboard): ExecutiveDashboardDto {
  return {
    id: d.id,
    name: d.name,
    description: d.description,
    isDefault: d.isDefault,
    isShared: d.isShared,
    widgets: (d.widgets ?? []).map(mapWidget),
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }
}

function toApiWidgets(widgets: DashboardWidgetLayout[]) {
  return widgets.map((w) => ({
    id: w.id,
    widgetKey: w.widgetKey,
    positionX: w.x,
    positionY: w.y,
    width: w.w,
    height: w.h,
    visualization: w.visualization,
    configurationJson: w.configuration ?? null,
    filterJson: w.filters ?? null,
  }))
}

export async function fetchExecutiveWidgetCatalog() {
  return apiRequest<DashboardWidgetDefinition[]>(tenantPath('/executive/widgets'))
}

export async function queryExecutiveWidget(body: {
  widgetKey: string
  visualization?: WidgetVisualization
  filters?: Record<string, unknown>
  globalFilters?: Partial<DashboardGlobalFilters>
}) {
  return apiRequest<WidgetQueryResult>(tenantPath('/executive/widgets/query'), {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchExecutiveDashboards() {
  const res = await apiRequest<ApiDashboard[]>(tenantPath('/executive/dashboards'))
  return { ...res, data: (res.data ?? []).map(mapDashboard) }
}

export async function fetchExecutiveDashboard(id: string) {
  const res = await apiRequest<ApiDashboard>(tenantPath(`/executive/dashboards/${id}`))
  return { ...res, data: mapDashboard(res.data) }
}

export async function createExecutiveDashboard(body: {
  name: string
  description?: string | null
  templateKey?: DashboardTemplateKey
  isDefault?: boolean
  widgets?: Omit<DashboardWidgetLayout, 'id'>[]
}) {
  const res = await apiRequest<ApiDashboard>(tenantPath('/executive/dashboards'), {
    method: 'POST',
    body: JSON.stringify({
      ...body,
      widgets: body.widgets
        ? body.widgets.map((w) => ({
            widgetKey: w.widgetKey,
            positionX: w.x,
            positionY: w.y,
            width: w.w,
            height: w.h,
            visualization: w.visualization,
            configurationJson: w.configuration ?? null,
            filterJson: w.filters ?? null,
          }))
        : undefined,
    }),
  })
  return { ...res, data: mapDashboard(res.data) }
}

export async function updateExecutiveDashboard(
  id: string,
  body: {
    name?: string
    description?: string | null
    isShared?: boolean
    widgets?: DashboardWidgetLayout[]
  },
) {
  const res = await apiRequest<ApiDashboard>(tenantPath(`/executive/dashboards/${id}`), {
    method: 'PATCH',
    body: JSON.stringify({
      ...body,
      widgets: body.widgets ? toApiWidgets(body.widgets) : undefined,
    }),
  })
  return { ...res, data: mapDashboard(res.data) }
}

export async function duplicateExecutiveDashboard(id: string) {
  const res = await apiRequest<ApiDashboard>(tenantPath(`/executive/dashboards/${id}/duplicate`), {
    method: 'POST',
  })
  return { ...res, data: mapDashboard(res.data) }
}

export async function setDefaultExecutiveDashboard(id: string) {
  const res = await apiRequest<ApiDashboard>(tenantPath(`/executive/dashboards/${id}/set-default`), {
    method: 'POST',
  })
  return { ...res, data: mapDashboard(res.data) }
}

export async function deleteExecutiveDashboard(id: string) {
  return apiRequest<{ ok: boolean }>(tenantPath(`/executive/dashboards/${id}`), {
    method: 'DELETE',
  })
}
