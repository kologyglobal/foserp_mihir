import { createApp } from './app.js'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

async function main(): Promise<void> {
  await connectDatabase()
  const app = createApp()

  const server = app.listen(env.PORT, () => {
    logger.info(`FOS ERP backend listening on http://localhost:${env.PORT}`)
    if (env.isDev) {
      logger.info(`Swagger docs: http://localhost:${env.PORT}/api/docs`)
    }
  })

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received — shutting down`)
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
