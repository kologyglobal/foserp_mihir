import { useCallback, useEffect, useState } from 'react'
import { useApiMode } from '@/hooks/useApiMode'
import {
  fetchNotificationSummary,
  fetchNotificationUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  resolveNotification,
  snoozeNotification,
  type AppNotification,
  type NotificationCounts,
} from '@/services/api/notificationsApi'

const POLL_MS = 60_000

const EMPTY_COUNTS: NotificationCounts = {
  unread: 0,
  critical: 0,
  high: 0,
  snoozed: 0,
}

export function useAppNotifications(opts?: { enabled?: boolean }) {
  const apiMode = useApiMode()
  const enabled = opts?.enabled !== false && apiMode
  const [recent, setRecent] = useState<AppNotification[]>([])
  const [counts, setCounts] = useState<NotificationCounts>(EMPTY_COUNTS)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!enabled) return
    setLoading(true)
    setError(null)
    try {
      const summary = await fetchNotificationSummary()
      setRecent(summary.recent)
      setCounts(summary.counts)
    } catch (err) {
      setError((err as Error).message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [enabled])

  const refreshCount = useCallback(async () => {
    if (!enabled) return
    try {
      const { unread } = await fetchNotificationUnreadCount()
      setCounts((c) => ({ ...c, unread }))
    } catch {
      /* ignore poll errors */
    }
  }, [enabled])

  useEffect(() => {
    if (!enabled) return
    void refresh()
    const t = window.setInterval(() => void refreshCount(), POLL_MS)
    return () => window.clearInterval(t)
  }, [enabled, refresh, refreshCount])

  const markRead = useCallback(
    async (id: string) => {
      if (!enabled) return
      await markNotificationRead(id)
      setRecent((rows) =>
        rows.map((r) => (r.id === id ? { ...r, status: 'READ' as const, readAt: new Date().toISOString() } : r)),
      )
      setCounts((c) => ({ ...c, unread: Math.max(0, c.unread - 1) }))
    },
    [enabled],
  )

  const markAllRead = useCallback(async () => {
    if (!enabled) return
    await markAllNotificationsRead()
    setRecent((rows) => rows.map((r) => ({ ...r, status: 'READ' as const })))
    setCounts((c) => ({ ...c, unread: 0, critical: 0, high: 0 }))
  }, [enabled])

  const resolve = useCallback(
    async (id: string) => {
      if (!enabled) return
      await resolveNotification(id)
      setRecent((rows) => rows.filter((r) => r.id !== id))
      await refreshCount()
    },
    [enabled, refreshCount],
  )

  const snooze = useCallback(
    async (id: string, minutes = 60) => {
      if (!enabled) return
      await snoozeNotification(id, { minutes })
      setRecent((rows) => rows.filter((r) => r.id !== id))
      await refreshCount()
    },
    [enabled, refreshCount],
  )

  return {
    apiMode: enabled,
    recent,
    counts,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
    resolve,
    snooze,
  }
}
