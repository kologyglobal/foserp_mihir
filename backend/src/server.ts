import { createApp, setupDevSwagger } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/prisma.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import {
  startIndiaMartSyncScheduler,
  stopIndiaMartSyncScheduler,
} from './modules/crm/integrations/indiamart/indiamart.scheduler.js'
import {
  startBankConnectorCronScheduler,
  stopBankConnectorCronScheduler,
} from './modules/accounting/treasury/bank-connectors/bank-connector.scheduler.js'
import {
  startNotificationScheduler,
  stopNotificationScheduler,
} from './modules/notifications/notification.scheduler.js'

async function main(): Promise<void> {
  const app = createApp()
  await setupDevSwagger(app)

  // Bind the HTTP port before the DB handshake — some Node.js hosts (e.g. Hostinger)
  // kill the process if listen() isn't called within a few seconds, and a slow/unreachable
  // DB must not block that. Prisma also connects lazily on first query if this races.
  const server = app.listen(env.PORT, '0.0.0.0', () => {
    logger.info(`FOS ERP backend listening on 0.0.0.0:${env.PORT}`)
    if (env.isDev) {
      logger.info(`Swagger docs: http://localhost:${env.PORT}/api/docs`)
    }
  })

  connectDatabase()
    .then(() => {
      logger.info('Database connected')
      startIndiaMartSyncScheduler()
      startBankConnectorCronScheduler()
      startNotificationScheduler()
    })
    .catch((error) => {
      logger.error('Database connection failed at startup — will retry lazily on first query', error)
    })

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`)
    stopIndiaMartSyncScheduler()
    stopBankConnectorCronScheduler()
    stopNotificationScheduler()
    server.close(async () => {
      await disconnectDatabase()
      process.exit(0)
    })
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  logger.error('Failed to start server', error)
  process.exit(1)
})
