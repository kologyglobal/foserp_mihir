import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import fs from 'node:fs'
import path from 'node:path'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env.js'
import { prisma } from './config/database.js'
import { errorMiddleware } from './middleware/error.middleware.js'
import authRoutes from './modules/auth/auth.routes.js'
import crmRoutes from './modules/crm/crm.routes.js'
import mastersRoutes from './modules/masters/masters.routes.js'
import masterImportRoutes from './modules/masters/imports/import.routes.js'
import masterExportRoutes from './modules/masters/exports/export.routes.js'
import lookupRoutes from './modules/masters/lookups.routes.js'
import itemRoutes, { itemLookupRouter } from './modules/items/item.routes.js'
import vendorRoutes, { vendorLookupRouter } from './modules/vendors/vendor.routes.js'
import roleRoutes from './modules/roles/role.routes.js'
import tenantRoutes from './modules/tenants/tenant.routes.js'
import userRoutes from './modules/users/user.routes.js'
import { sendSuccess } from './utils/response.js'
import { swaggerSpec } from './config/swagger.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  // CSP off when serving the Vite SPA from the same origin in production
  app.use(helmet({ contentSecurityPolicy: false }))
  const corsOrigins = env.isDev
    ? [...new Set([env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'])]
    : [...new Set([env.FRONTEND_URL])]
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || corsOrigins.includes(origin)) {
          callback(null, origin ?? corsOrigins[0])
        } else {
          callback(null, false)
        }
      },
      credentials: true,
    }),
  )
  app.use(express.json({ limit: '1mb' }))
  app.use(express.urlencoded({ extended: true }))

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many authentication attempts' },
  })

  app.get('/api/v1/health', async (_req, res) => {
    let database: 'connected' | 'disconnected' = 'disconnected'
    try {
      await prisma.$queryRaw`SELECT 1`
      database = 'connected'
    } catch {
      database = 'disconnected'
    }
    return sendSuccess(res, 'FOS ERP backend is running', {
      database,
      environment: env.NODE_ENV,
    })
  })

  if (env.isDev) {
    app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))
  }

  app.use('/api/v1/auth', authLimiter, authRoutes)

  app.use('/api/v1/tenants', tenantRoutes)
  app.use('/api/v1/tenants/:tenantId/users', userRoutes)
  app.use('/api/v1/tenants/:tenantId/roles', roleRoutes)
  app.use('/api/v1/tenants/:tenantId/crm', crmRoutes)
  app.use('/api/v1/tenants/:tenantId/masters/items', itemRoutes)
  app.use('/api/v1/tenants/:tenantId/masters/vendors', vendorRoutes)
  app.use('/api/v1/tenants/:tenantId/masters/imports', masterImportRoutes)
  app.use('/api/v1/tenants/:tenantId/masters/exports', masterExportRoutes)
  app.use('/api/v1/tenants/:tenantId/masters', mastersRoutes)
  app.use('/api/v1/tenants/:tenantId/lookups/items', itemLookupRouter)
  app.use('/api/v1/tenants/:tenantId/lookups/vendors', vendorLookupRouter)
  app.use('/api/v1/tenants/:tenantId/lookups', lookupRoutes)

  // Tenant slug aliases
  app.use('/api/v1/t/:tenantSlug/users', userRoutes)
  app.use('/api/v1/t/:tenantSlug/roles', roleRoutes)
  app.use('/api/v1/t/:tenantSlug/crm', crmRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/items', itemRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/vendors', vendorRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/imports', masterImportRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/exports', masterExportRoutes)
  app.use('/api/v1/t/:tenantSlug/masters', mastersRoutes)
  app.use('/api/v1/t/:tenantSlug/lookups/items', itemLookupRouter)
  app.use('/api/v1/t/:tenantSlug/lookups/vendors', vendorLookupRouter)
  app.use('/api/v1/t/:tenantSlug/lookups', lookupRoutes)

  // Single-host production: serve Vite build (same origin as /api)
  const frontendCandidates = [
    process.env.FRONTEND_DIST,
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), '../public'),
    path.resolve(process.cwd(), '../frontend/dist'),
  ].filter(Boolean) as string[]
  const frontendDist = frontendCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')))
  if (frontendDist) {
    app.use(express.static(frontendDist, { index: false, maxAge: env.isProd ? '1h' : 0 }))
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'))
    })
  }

  app.use(errorMiddleware)

  return app
}
