import type { ExecutiveDashboard, ExecutiveDashboardWidget, Prisma } from '@prisma/client'
import { prisma } from '../../config/prisma.js'
import type { WidgetLayoutInput } from './dashboard.types.js'

export type DashboardWithWidgets = ExecutiveDashboard & { widgets: ExecutiveDashboardWidget[] }

function jsonOrUndefined(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined
  return value as Prisma.InputJsonValue
}

export async function listDashboards(tenantId: string, userId: string): Promise<DashboardWithWidgets[]> {
  return prisma.executiveDashboard.findMany({
    where: {
      tenantId,
      deletedAt: null,
      OR: [{ userId }, { isShared: true }],
    },
    include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
    orderBy: [{ isDefault: 'desc' }, { updatedAt: 'desc' }],
  })
}

export async function findDashboard(
  tenantId: string,
  id: string,
  userId: string,
): Promise<DashboardWithWidgets | null> {
  return prisma.executiveDashboard.findFirst({
    where: {
      id,
      tenantId,
      deletedAt: null,
      OR: [{ userId }, { isShared: true }],
    },
    include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
  })
}

export async function findOwnedDashboard(
  tenantId: string,
  id: string,
  userId: string,
): Promise<DashboardWithWidgets | null> {
  return prisma.executiveDashboard.findFirst({
    where: { id, tenantId, userId, deletedAt: null },
    include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
  })
}

export async function countOwnedDashboards(tenantId: string, userId: string): Promise<number> {
  return prisma.executiveDashboard.count({
    where: { tenantId, userId, deletedAt: null },
  })
}

export async function createDashboard(params: {
  tenantId: string
  userId: string
  name: string
  description?: string | null
  isShared?: boolean
  isDefault?: boolean
  widgets: WidgetLayoutInput[]
}): Promise<DashboardWithWidgets> {
  const { tenantId, userId, name, description, isShared, isDefault, widgets } = params
  return prisma.executiveDashboard.create({
    data: {
      tenantId,
      userId,
      name,
      description: description ?? null,
      isShared: isShared ?? false,
      isDefault: isDefault ?? false,
      widgets: {
        create: widgets.map((w) => ({
          tenantId,
          widgetKey: w.widgetKey,
          positionX: w.positionX,
          positionY: w.positionY,
          width: w.width,
          height: w.height,
          visualization: w.visualization ?? null,
          configurationJson: jsonOrUndefined(w.configurationJson),
          filterJson: jsonOrUndefined(w.filterJson),
        })),
      },
    },
    include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
  })
}

export async function updateDashboardMeta(
  tenantId: string,
  id: string,
  userId: string,
  data: { name?: string; description?: string | null; isShared?: boolean },
): Promise<DashboardWithWidgets> {
  await prisma.executiveDashboard.updateMany({
    where: { id, tenantId, userId, deletedAt: null },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.isShared !== undefined ? { isShared: data.isShared } : {}),
    },
  })
  const row = await findOwnedDashboard(tenantId, id, userId)
  if (!row) throw new Error('Dashboard not found after update')
  return row
}

export async function replaceWidgets(
  tenantId: string,
  dashboardId: string,
  widgets: WidgetLayoutInput[],
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.executiveDashboardWidget.deleteMany({ where: { tenantId, dashboardId } })
    if (widgets.length === 0) return
    await tx.executiveDashboardWidget.createMany({
      data: widgets.map((w) => ({
        tenantId,
        dashboardId,
        widgetKey: w.widgetKey,
        positionX: w.positionX,
        positionY: w.positionY,
        width: w.width,
        height: w.height,
        visualization: w.visualization ?? null,
        configurationJson: jsonOrUndefined(w.configurationJson),
        filterJson: jsonOrUndefined(w.filterJson),
      })),
    })
  })
}

export async function softDeleteDashboard(tenantId: string, id: string, userId: string): Promise<boolean> {
  const owned = await prisma.executiveDashboard.findFirst({
    where: { id, tenantId, userId, deletedAt: null },
    select: { id: true, name: true },
  })
  if (!owned) return false
  // Free unique (tenantId, userId, name) for future creates.
  const tombstone = `${owned.name.slice(0, 150)}__del__${Date.now()}`
  const result = await prisma.executiveDashboard.updateMany({
    where: { id, tenantId, userId, deletedAt: null },
    data: { deletedAt: new Date(), isDefault: false, name: tombstone },
  })
  return result.count > 0
}

export async function clearDefaultForUser(tenantId: string, userId: string): Promise<void> {
  await prisma.executiveDashboard.updateMany({
    where: { tenantId, userId, deletedAt: null, isDefault: true },
    data: { isDefault: false },
  })
}

export async function setDefaultDashboard(
  tenantId: string,
  id: string,
  userId: string,
): Promise<DashboardWithWidgets | null> {
  return prisma.$transaction(async (tx) => {
    const owned = await tx.executiveDashboard.findFirst({
      where: { id, tenantId, userId, deletedAt: null },
    })
    if (!owned) return null
    await tx.executiveDashboard.updateMany({
      where: { tenantId, userId, deletedAt: null, isDefault: true },
      data: { isDefault: false },
    })
    await tx.executiveDashboard.update({
      where: { id },
      data: { isDefault: true },
    })
    return tx.executiveDashboard.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: { widgets: { orderBy: [{ positionY: 'asc' }, { positionX: 'asc' }] } },
    })
  })
}

export async function nameExists(
  tenantId: string,
  userId: string,
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const row = await prisma.executiveDashboard.findFirst({
    where: {
      tenantId,
      userId,
      name,
      deletedAt: null,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  })
  return Boolean(row)
}
