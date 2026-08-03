/**
 * Phase 5D4 — in-process scheduler for BankConnector.scheduleCron.
 * Mirrors IndiaMART sync scheduler: minute-resolution ticks, no external queue.
 * Correctness for multi-instance: DB lease on BankConnector (syncLockUntil/token).
 */
import { logger } from '../../../../config/logger.js'
import { env } from '../../../../config/env.js'
import { isConnectorDueForCron } from './bank-connector-cron.js'
import * as repo from './bank-connector.repository.js'
import { syncBankConnectorCore } from './bank-connector.service.js'
import { BankConnectorSyncInProgressError } from './bank-connector.errors.js'

let timer: NodeJS.Timeout | null = null
let tickInProgress = false

export function isBankConnectorCronEnabled(): boolean {
  const raw = process.env.BANK_CONNECTOR_CRON_ENABLED
  if (raw === 'true') return true
  if (raw === 'false') return false
  if (env.BANK_CONNECTOR_CRON_ENABLED === true) return true
  if (env.BANK_CONNECTOR_CRON_ENABLED === false) return false
  return !env.isProd
}

/**
 * Lightweight in-process scheduler for enabled connectors with scheduleCron set.
 */
export function startBankConnectorCronScheduler(intervalMs = 60_000): void {
  if (timer) return
  if (!isBankConnectorCronEnabled()) {
    logger.info('Bank connector cron scheduler disabled')
    return
  }
  logger.info('Bank connector cron scheduler started', { intervalMs })
  timer = setInterval(() => {
    void tickBankConnectorCron()
  }, intervalMs)
  // Slight delay so DB pool is warm after listen()
  setTimeout(() => void tickBankConnectorCron(), 20_000)
}

export function stopBankConnectorCronScheduler(): void {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}

/** Exported for tests — runs one due-connector pass. */
export async function tickBankConnectorCron(now: Date = new Date()): Promise<{
  considered: number
  synced: number
  failed: number
  skippedLocked: number
}> {
  if (tickInProgress) return { considered: 0, synced: 0, failed: 0, skippedLocked: 0 }
  tickInProgress = true
  let considered = 0
  let synced = 0
  let failed = 0
  let skippedLocked = 0
  try {
    const rows = await repo.listScheduledEnabledConnectors()
    for (const row of rows) {
      if (!row.scheduleCron) continue
      considered += 1
      if (
        !isConnectorDueForCron({
          scheduleCron: row.scheduleCron,
          lastSyncAt: row.lastSyncAt,
          now,
        })
      ) {
        continue
      }
      try {
        await syncBankConnectorCore({
          tenantId: row.tenantId,
          connectorId: row.id,
          userId: row.updatedBy ?? row.createdBy,
          audit: { userId: row.updatedBy ?? row.createdBy },
          trigger: 'SCHEDULED',
        })
        synced += 1
      } catch (err) {
        if (err instanceof BankConnectorSyncInProgressError) {
          skippedLocked += 1
          continue
        }
        failed += 1
        logger.warn('Bank connector scheduled sync failed', {
          tenantId: row.tenantId,
          connectorId: row.id,
          code: row.code,
          message: (err as Error).message,
        })
      }
    }
  } catch (err) {
    logger.warn('Bank connector cron tick failed', { message: (err as Error).message })
  } finally {
    tickInProgress = false
  }
  return { considered, synced, failed, skippedLocked }
}
