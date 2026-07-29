import { logger } from '../../../../config/logger.js'
import { refreshSlaAndAlerts } from './indiamart.alerts.js'
import * as repo from './indiamart.repository.js'
import { runIndiaMartSync } from './indiamart.sync.js'

let timer: NodeJS.Timeout | null = null
let tickInProgress = false

/**
 * Lightweight in-process scheduler for IndiaMART sync + SLA refresh.
 */
export function startIndiaMartSyncScheduler(intervalMs = 60_000): void {
  if (timer) return
  logger.info('IndiaMART sync scheduler started', { intervalMs })
  timer = setInterval(() => {
    void tick()
  }, intervalMs)
  setTimeout(() => void tick(), 15_000)
}

export function stopIndiaMartSyncScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

async function tick(): Promise<void> {
  if (tickInProgress) return
  tickInProgress = true
  try {
    const due = await repo.listDueConnections()
    for (const connection of due) {
      try {
        await runIndiaMartSync({
          tenantId: connection.tenantId,
          userId: connection.updatedById ?? connection.createdById,
          triggerType: 'SCHEDULED',
        })
      } catch (err) {
        logger.warn('IndiaMART scheduled sync failed', {
          tenantId: connection.tenantId,
          message: (err as Error).message,
        })
      }
    }

    // SLA refresh for all connected tenants (even if sync not due)
    const connected = await repo.listDueConnections() // reuse limited set
    const allConnected = await (await import('../../../../config/prisma.js')).prisma.indiaMartConnection.findMany({
      where: { status: { in: ['CONNECTED', 'CONNECTION_FAILED'] } },
      take: 100,
    })
    for (const connection of allConnected.length ? allConnected : connected) {
      try {
        await refreshSlaAndAlerts(connection.tenantId, connection)
      } catch (err) {
        logger.warn('IndiaMART SLA refresh failed', {
          tenantId: connection.tenantId,
          message: (err as Error).message,
        })
      }
    }
  } catch (err) {
    logger.warn('IndiaMART scheduler tick failed', { message: (err as Error).message })
  } finally {
    tickInProgress = false
  }
}
