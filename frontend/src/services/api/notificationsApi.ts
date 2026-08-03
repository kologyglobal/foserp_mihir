import { apiRequest, tenantPath } from './client'

export type AppNotificationPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'POSITIVE'
export type AppNotificationStatus = 'UNREAD' | 'READ' | 'RESOLVED' | 'SNOOZED' | 'DISMISSED'

export interface AppNotification {
  id: string
  category: string
  type: string
  priority: AppNotificationPriority
  title: string
  message: string
  entityType: string | null
  entityId: string | null
  entityCode: string | null
  entityName: string | null
  actionUrl: string | null
  primaryAction: string | null
  secondaryAction: string | null
  status: AppNotificationStatus
  readAt: string | null
  resolvedAt: string | null
  snoozedUntil: string | null
  sourceEventId: string | null
  deduplicationKey: string | null
  escalationLevel: number
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface NotificationCounts {
  unread: number
  critical: number
  high: number
  snoozed: number
}

export interface NotificationListData {
  items: AppNotification[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
  counts: NotificationCounts
}

export interface NotificationPreference {
  notificationType: string
  inAppEnabled: boolean
  emailEnabled: boolean
  mobilePushEnabled: boolean
  whatsappEnabled: boolean
  dailyDigestEnabled: boolean
  reminderMinutesBefore: number | null
  escalationEnabled: boolean
  muteUntil: string | null
  isMandatory: boolean
}

function base(path = '') {
  return tenantPath(`/notifications${path}`)
}

export async function fetchNotifications(params?: {
  page?: number
  limit?: number
  status?: string
  category?: string
  priority?: string
  unreadOnly?: boolean
}): Promise<NotificationListData> {
  const q = new URLSearchParams()
  if (params?.page) q.set('page', String(params.page))
  if (params?.limit) q.set('limit', String(params.limit))
  if (params?.status) q.set('status', params.status)
  if (params?.category) q.set('category', params.category)
  if (params?.priority) q.set('priority', params.priority)
  if (params?.unreadOnly) q.set('unreadOnly', 'true')
  const qs = q.toString()
  const res = await apiRequest<NotificationListData>(`${base()}${qs ? `?${qs}` : ''}`)
  return res.data
}

export async function fetchNotificationUnreadCount(): Promise<{ unread: number }> {
  const res = await apiRequest<{ unread: number }>(base('/unread-count'))
  return res.data
}

export async function fetchNotificationSummary(): Promise<{
  counts: NotificationCounts
  recent: AppNotification[]
}> {
  const res = await apiRequest<{ counts: NotificationCounts; recent: AppNotification[] }>(
    base('/summary'),
  )
  return res.data
}

export async function markNotificationRead(id: string): Promise<AppNotification> {
  const res = await apiRequest<AppNotification>(base(`/${id}/read`), { method: 'PATCH' })
  return res.data
}

export async function markAllNotificationsRead(): Promise<{ count: number }> {
  const res = await apiRequest<{ count: number }>(base('/read-all'), { method: 'PATCH' })
  return res.data
}

export async function resolveNotification(id: string): Promise<AppNotification> {
  const res = await apiRequest<AppNotification>(base(`/${id}/resolve`), { method: 'PATCH' })
  return res.data
}

export async function dismissNotification(id: string): Promise<AppNotification> {
  const res = await apiRequest<AppNotification>(base(`/${id}/dismiss`), { method: 'PATCH' })
  return res.data
}

export async function snoozeNotification(
  id: string,
  body: { until?: string; minutes?: number },
): Promise<AppNotification> {
  const res = await apiRequest<AppNotification>(base(`/${id}/snooze`), {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  return res.data
}

export async function fetchNotificationPreferences(): Promise<NotificationPreference[]> {
  const res = await apiRequest<NotificationPreference[]>(base('/preferences'))
  return res.data
}

export async function putNotificationPreferences(
  items: Array<Partial<NotificationPreference> & { notificationType: string }>,
): Promise<NotificationPreference[]> {
  const res = await apiRequest<NotificationPreference[]>(base('/preferences'), {
    method: 'PUT',
    body: JSON.stringify({ items }),
  })
  return res.data
}
