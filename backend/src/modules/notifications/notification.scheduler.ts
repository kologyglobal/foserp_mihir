import { logger } from '../../config/logger.js'
import { runNotificationDueScan } from './notification.jobs.js'

let timer: NodeJS.Timeout | null = null
let tickInProgress = false

/** Due-time + risk scans every 15 minutes (initial release). */
export function startNotificationScheduler(intervalMs = 15 * 60_000): void {
  if (timer) return
  logger.info('CRM notification scheduler started', { intervalMs })
  timer = setInterval(() => {
    void tick()
  }, intervalMs)
  // First run after short warm-up
  setTimeout(() => void tick(), 45_000)
}

export function stopNotificationScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function tick(): Promise<void> {
  if (tickInProgress) return
  tickInProgress = true
  try {
    await runNotificationDueScan()
  } catch (err) {
    logger.warn('notification scheduler tick failed', { message: (err as Error).message })
  } finally {
    tickInProgress = false
  }
}
