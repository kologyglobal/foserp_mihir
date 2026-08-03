import type { Request, Response } from 'express'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { asyncHandler } from '../../utils/asyncHandler.js'
import { sendSuccess } from '../../utils/response.js'
import * as service from './notification.service.js'
import type {
  ListNotificationsQuery,
  PutPreferencesInput,
  SnoozeNotificationInput,
} from './notification.validation.js'

export const list = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.listForUser(
    tenantId,
    userId,
    req.query as unknown as ListNotificationsQuery,
  )
  sendSuccess(res, 'Notifications', {
    items: data.items,
    pagination: {
      page: data.page,
      pageSize: data.limit,
      total: data.total,
      totalPages: Math.max(1, Math.ceil(data.total / data.limit)),
    },
    counts: data.counts,
  })
})

export const unreadCount = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.unreadCount(tenantId, userId)
  sendSuccess(res, 'Unread count', data)
})

export const summary = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.summary(tenantId, userId)
  sendSuccess(res, 'Notification summary', data)
})

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.markRead(tenantId, userId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Notification marked read', data)
})

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.markAllRead(tenantId, userId)
  sendSuccess(res, 'All notifications marked read', data)
})

export const resolve = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.resolve(tenantId, userId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Notification resolved', data)
})

export const dismiss = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.dismiss(tenantId, userId, getRouteParam(req, 'id'))
  sendSuccess(res, 'Notification dismissed', data)
})

export const snooze = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.snooze(
    tenantId,
    userId,
    getRouteParam(req, 'id'),
    req.body as SnoozeNotificationInput,
  )
  sendSuccess(res, 'Notification snoozed', data)
})

export const getPreferences = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.listPreferences(tenantId, userId)
  sendSuccess(res, 'Notification preferences', data)
})

export const putPreferences = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const { userId } = getContext(req)
  const data = await service.putPreferences(
    tenantId,
    userId,
    req.body as PutPreferencesInput,
  )
  sendSuccess(res, 'Notification preferences saved', data)
})

export const getTenantSettings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const data = await service.getTenantSettings(tenantId)
  sendSuccess(res, 'Notification tenant settings', data)
})
