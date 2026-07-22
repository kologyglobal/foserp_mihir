import type { Prisma } from '@prisma/client'
import { prisma } from '../../../config/database.js'
import { AuthorizationError, ConflictError, NotFoundError } from '../../../utils/errors.js'
import type { CreateSavedViewInput, UpdateSavedViewInput } from './saved-view.schemas.js'

function toJsonInput(value: unknown): Prisma.InputJsonValue | undefined {
  return value === undefined ? undefined : (value as unknown as Prisma.InputJsonValue)
}

function hasPermission(userPerms: string[], permission: string): boolean {
  return userPerms.includes('tenant.manage') || userPerms.includes(permission)
}

export async function listSavedViews(tenantId: string, userId: string, userPerms: string[], reportKey?: string) {
  const canSeeShared = hasPermission(userPerms, 'manufacturing.reports.shared_views')
  return prisma.savedReportView.findMany({
    where: {
      tenantId,
      isActive: true,
      deletedAt: null,
      ...(reportKey ? { reportKey } : {}),
      OR: [{ userId }, ...(canSeeShared ? [{ isShared: true }] : [])],
    },
    orderBy: [{ reportKey: 'asc' }, { name: 'asc' }],
  })
}

export async function getSavedView(tenantId: string, userId: string, userPerms: string[], id: string) {
  const view = await prisma.savedReportView.findFirst({
    where: { id, tenantId, isActive: true, deletedAt: null },
  })
  if (!view) throw new NotFoundError('Saved report view not found')
  const canSeeShared = hasPermission(userPerms, 'manufacturing.reports.shared_views')
  if (view.userId !== userId && !(view.isShared && canSeeShared)) {
    throw new AuthorizationError('You do not have access to this saved view')
  }
  return view
}

export async function createSavedView(
  tenantId: string,
  userId: string,
  userPerms: string[],
  input: CreateSavedViewInput,
) {
  if (input.isShared && !hasPermission(userPerms, 'manufacturing.reports.shared_views')) {
    throw new AuthorizationError('Missing permission: manufacturing.reports.shared_views')
  }

  const existing = await prisma.savedReportView.findFirst({
    where: { tenantId, userId, reportKey: input.reportKey, name: input.name, deletedAt: null },
  })
  if (existing) throw new ConflictError('A saved view with this name already exists for this report')

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.savedReportView.updateMany({
        where: { tenantId, userId, reportKey: input.reportKey, isDefault: true },
        data: { isDefault: false },
      })
    }
    return tx.savedReportView.create({
      data: {
        tenantId,
        userId,
        reportKey: input.reportKey,
        name: input.name,
        description: input.description,
        filtersJson: toJsonInput(input.filters) ?? {},
        sortingJson: toJsonInput(input.sorting),
        groupingJson: toJsonInput(input.grouping),
        visibleColumnsJson: toJsonInput(input.visibleColumns),
        pageSize: input.pageSize,
        chartPreferenceJson: toJsonInput(input.chartPreference),
        isDefault: input.isDefault,
        isShared: input.isShared,
        sharedRoleId: input.sharedRoleId,
      },
    })
  })
}

export async function updateSavedView(
  tenantId: string,
  userId: string,
  userPerms: string[],
  id: string,
  input: UpdateSavedViewInput,
) {
  const view = await prisma.savedReportView.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!view) throw new NotFoundError('Saved report view not found')
  if (view.userId !== userId) throw new AuthorizationError('You can only edit your own saved views')
  if (input.isShared && !hasPermission(userPerms, 'manufacturing.reports.shared_views')) {
    throw new AuthorizationError('Missing permission: manufacturing.reports.shared_views')
  }

  return prisma.$transaction(async (tx) => {
    if (input.isDefault) {
      await tx.savedReportView.updateMany({
        where: { tenantId, userId, reportKey: view.reportKey, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      })
    }
    return tx.savedReportView.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description,
        filtersJson: toJsonInput(input.filters),
        sortingJson: toJsonInput(input.sorting),
        groupingJson: toJsonInput(input.grouping),
        visibleColumnsJson: toJsonInput(input.visibleColumns),
        pageSize: input.pageSize,
        chartPreferenceJson: toJsonInput(input.chartPreference),
        isDefault: input.isDefault,
        isShared: input.isShared,
        sharedRoleId: input.sharedRoleId,
      },
    })
  })
}

export async function deleteSavedView(tenantId: string, userId: string, id: string) {
  const view = await prisma.savedReportView.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!view) throw new NotFoundError('Saved report view not found')
  if (view.userId !== userId) throw new AuthorizationError('You can only delete your own saved views')
  await prisma.savedReportView.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } })
}

export async function setDefaultSavedView(tenantId: string, userId: string, id: string) {
  const view = await prisma.savedReportView.findFirst({ where: { id, tenantId, deletedAt: null } })
  if (!view) throw new NotFoundError('Saved report view not found')
  if (view.userId !== userId) throw new AuthorizationError('You can only set your own saved views as default')

  return prisma.$transaction(async (tx) => {
    await tx.savedReportView.updateMany({
      where: { tenantId, userId, reportKey: view.reportKey, isDefault: true },
      data: { isDefault: false },
    })
    return tx.savedReportView.update({ where: { id }, data: { isDefault: true } })
  })
}
