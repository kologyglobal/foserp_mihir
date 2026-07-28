import type { ExecutiveDashboardWidget } from '@prisma/client'
import { permissionSetIncludes } from '../../constants/permissions.js'
import {
  AuthorizationError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../utils/errors.js'
import * as repo from './dashboard.repository.js'
import type {
  CreateDashboardInput,
  DashboardDto,
  DashboardWidgetDto,
  UpdateDashboardInput,
  WidgetLayoutInput,
  WidgetQueryInput,
  WidgetQueryResult,
} from './dashboard.types.js'
import {
  DASHBOARD_TEMPLATE_BY_KEY,
  DASHBOARD_WIDGET_DEFINITIONS,
  getWidgetDefinition,
  type DashboardWidgetDefinition,
} from './widget-registry.js'
import { queryWidget, queryWidgetsBatch } from './widget-query.service.js'

function mapWidget(w: ExecutiveDashboardWidget): DashboardWidgetDto {
  return {
    id: w.id,
    widgetKey: w.widgetKey,
    x: w.positionX,
    y: w.positionY,
    w: w.width,
    h: w.height,
    visualization: w.visualization,
    configuration: w.configurationJson ?? undefined,
    filters: w.filterJson ?? undefined,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
  }
}

function mapDashboard(row: repo.DashboardWithWidgets): DashboardDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDefault: row.isDefault,
    isShared: row.isShared,
    userId: row.userId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    widgets: row.widgets.map(mapWidget),
  }
}

function asJsonInput(value: unknown): WidgetLayoutInput['configurationJson'] {
  if (value === undefined || value === null) return null
  return value as WidgetLayoutInput['configurationJson']
}

function normalizeLayouts(widgets: WidgetLayoutInput[]): WidgetLayoutInput[] {
  return widgets.map((w) => {
    const def = getWidgetDefinition(w.widgetKey)
    if (!def) {
      throw new ValidationError(`Unknown widget key: ${w.widgetKey}`)
    }
    return {
      widgetKey: w.widgetKey,
      positionX: w.positionX,
      positionY: w.positionY,
      width: w.width,
      height: w.height,
      visualization: w.visualization ?? def.defaultVisualization,
      configurationJson: asJsonInput(w.configurationJson),
      filterJson: asJsonInput(w.filterJson),
    }
  })
}

function expandTemplate(templateKey: string): WidgetLayoutInput[] {
  if (templateKey === 'blank') return []
  const template = DASHBOARD_TEMPLATE_BY_KEY.get(templateKey)
  if (!template) {
    throw new ValidationError(`Unknown template: ${templateKey}`)
  }
  return template.widgets.map((w) => ({
    widgetKey: w.widgetKey,
    positionX: w.x,
    positionY: w.y,
    width: w.w,
    height: w.h,
    visualization: w.visualization,
    configurationJson: null,
    filterJson: null,
  }))
}

function assertCanShare(permissions: readonly string[], isShared: boolean | undefined): void {
  if (isShared && !permissionSetIncludes(permissions, 'executive.dashboard.share')) {
    throw new AuthorizationError('Missing permission: executive.dashboard.share')
  }
}

export function listWidgetCatalog(permissions: readonly string[]): DashboardWidgetDefinition[] {
  return DASHBOARD_WIDGET_DEFINITIONS.filter((d) => permissionSetIncludes(permissions, d.permission))
}

export async function listDashboards(
  tenantId: string,
  userId: string,
  permissions?: readonly string[],
): Promise<DashboardDto[]> {
  const rows = await repo.listDashboards(tenantId, userId)
  return rows.map((row) => {
    if (!permissions) return mapDashboard(row)
    const widgets = row.widgets.filter((w) => {
      const def = getWidgetDefinition(w.widgetKey)
      return def ? permissionSetIncludes(permissions, def.permission) : false
    })
    return mapDashboard({ ...row, widgets })
  })
}

export async function getDashboard(
  tenantId: string,
  userId: string,
  id: string,
  permissions?: readonly string[],
): Promise<DashboardDto> {
  const row = await repo.findDashboard(tenantId, id, userId)
  if (!row) throw new NotFoundError('Dashboard not found')
  if (!permissions) return mapDashboard(row)
  const widgets = row.widgets.filter((w) => {
    const def = getWidgetDefinition(w.widgetKey)
    return def ? permissionSetIncludes(permissions, def.permission) : false
  })
  return mapDashboard({ ...row, widgets })
}

export async function createDashboard(
  tenantId: string,
  userId: string,
  permissions: readonly string[],
  input: CreateDashboardInput,
): Promise<DashboardDto> {
  assertCanShare(permissions, input.isShared)

  if (await repo.nameExists(tenantId, userId, input.name)) {
    throw new ConflictError(`Dashboard name already exists: ${input.name}`)
  }

  let widgets: WidgetLayoutInput[] = []
  if (input.templateKey) {
    widgets = expandTemplate(input.templateKey)
  }
  if (input.widgets?.length) {
    widgets = normalizeLayouts(input.widgets)
  }

  const ownedCount = await repo.countOwnedDashboards(tenantId, userId)
  const isDefault = ownedCount === 0 ? true : Boolean(input.isDefault)

  if (isDefault) {
    await repo.clearDefaultForUser(tenantId, userId)
  }

  const row = await repo.createDashboard({
    tenantId,
    userId,
    name: input.name,
    description: input.description,
    isShared: input.isShared ?? false,
    isDefault,
    widgets,
  })
  return mapDashboard(row)
}

export async function updateDashboard(
  tenantId: string,
  userId: string,
  permissions: readonly string[],
  id: string,
  input: UpdateDashboardInput,
): Promise<DashboardDto> {
  const owned = await repo.findOwnedDashboard(tenantId, id, userId)
  if (!owned) throw new NotFoundError('Dashboard not found')

  assertCanShare(permissions, input.isShared)

  if (input.name && input.name !== owned.name) {
    if (await repo.nameExists(tenantId, userId, input.name, id)) {
      throw new ConflictError(`Dashboard name already exists: ${input.name}`)
    }
  }

  if (input.name !== undefined || input.description !== undefined || input.isShared !== undefined) {
    await repo.updateDashboardMeta(tenantId, id, userId, {
      name: input.name,
      description: input.description,
      isShared: input.isShared,
    })
  }

  if (input.widgets) {
    await repo.replaceWidgets(tenantId, id, normalizeLayouts(input.widgets))
  }

  const refreshed = await repo.findOwnedDashboard(tenantId, id, userId)
  if (!refreshed) throw new NotFoundError('Dashboard not found')
  return mapDashboard(refreshed)
}

export async function deleteDashboard(tenantId: string, userId: string, id: string): Promise<{ ok: boolean }> {
  const ok = await repo.softDeleteDashboard(tenantId, id, userId)
  if (!ok) throw new NotFoundError('Dashboard not found')
  return { ok: true }
}

export async function duplicateDashboard(
  tenantId: string,
  userId: string,
  id: string,
): Promise<DashboardDto> {
  const source = await repo.findDashboard(tenantId, id, userId)
  if (!source) throw new NotFoundError('Dashboard not found')

  let name = `${source.name} (copy)`
  let suffix = 2
  while (await repo.nameExists(tenantId, userId, name)) {
    name = `${source.name} (copy ${suffix})`
    suffix += 1
  }

  const widgets: WidgetLayoutInput[] = source.widgets.map((w) => ({
    widgetKey: w.widgetKey,
    positionX: w.positionX,
    positionY: w.positionY,
    width: w.width,
    height: w.height,
    visualization: w.visualization as WidgetLayoutInput['visualization'],
    configurationJson: asJsonInput(w.configurationJson),
    filterJson: asJsonInput(w.filterJson),
  }))

  const row = await repo.createDashboard({
    tenantId,
    userId,
    name,
    description: source.description,
    isShared: false,
    isDefault: false,
    widgets,
  })
  return mapDashboard(row)
}

export async function setDefaultDashboard(
  tenantId: string,
  userId: string,
  id: string,
): Promise<DashboardDto> {
  const row = await repo.setDefaultDashboard(tenantId, id, userId)
  if (!row) throw new NotFoundError('Dashboard not found')
  return mapDashboard(row)
}

export async function queryWidgetData(
  tenantId: string,
  permissions: readonly string[],
  input: WidgetQueryInput & { queries?: WidgetQueryInput[] },
): Promise<WidgetQueryResult | WidgetQueryResult[]> {
  if (input.queries?.length) {
    return queryWidgetsBatch(tenantId, permissions, input.queries)
  }
  return queryWidget(tenantId, permissions, input)
}
