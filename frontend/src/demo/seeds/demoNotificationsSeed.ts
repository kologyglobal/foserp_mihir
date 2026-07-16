import { buildNotifications } from '../../utils/workspaceMetrics'

/** Notifications are derived from store data — validate depth only */
export function seedDemoNotifications(): number {
  return buildNotifications().length
}
