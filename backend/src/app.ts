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
import purchaseRoutes from './modules/purchase/purchase.routes.js'
import mastersRoutes from './modules/masters/masters.routes.js'
import masterImportRoutes from './modules/masters/imports/import.routes.js'
import masterExportRoutes from './modules/masters/exports/export.routes.js'
import lookupRoutes from './modules/masters/lookups.routes.js'
import inventoryMastersRoutes from './modules/masters/inventory-masters.routes.js'
import itemRoutes, { itemLookupRouter } from './modules/items/item.routes.js'
import vendorRoutes, { vendorLookupRouter } from './modules/vendors/vendor.routes.js'
import accountingRoutes from './modules/accounting/accounting.routes.js'
import manufacturingRoutes from './modules/manufacturing/manufacturing.routes.js'
import inventoryRoutes from './modules/inventory/inventory.routes.js'
import qualityRoutes from './modules/quality/quality.routes.js'
import dispatchRoutes from './modules/dispatch/dispatch.routes.js'
import gateRoutes from './modules/gate/gate.routes.js'
import opsReportsRoutes from './modules/ops-reports/ops-reports.routes.js'
import operationalExceptionRoutes from './modules/ops-reports/exceptions/exception.routes.js'
import roleRoutes from './modules/roles/role.routes.js'
import tenantRoutes from './modules/tenants/tenant.routes.js'
import userRoutes from './modules/users/user.routes.js'
import { sendError, sendSuccess } from './utils/response.js'
import { swaggerSpec } from './config/swagger.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  // CSP off when the same process also serves the Vite SPA (host-package / single-host deploy)
  app.use(helmet({ contentSecurityPolicy: false }))
  const corsOrigins = env.isDev
    ? [
        ...new Set([
          env.FRONTEND_URL,
          'http://localhost:5173',
          'http://127.0.0.1:5173',
          'http://localhost:5174',
          'http://127.0.0.1:5174',
        ]),
      ]
    : [env.FRONTEND_URL]
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
  // Attachments are posted as JSON+base64 (~4/3 decoded size). Keep body limit above CRM_MAX_UPLOAD_BYTES.
  const jsonBodyLimitBytes = Math.ceil(env.CRM_MAX_UPLOAD_BYTES * (4 / 3)) + 2 * 1024 * 1024
  app.use(express.json({ limit: jsonBodyLimitBytes }))
  app.use(express.urlencoded({ extended: true, limit: jsonBodyLimitBytes }))

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
  // Stock routes must run before the inventory-master alias router, whose
  // `/:resource` guard intentionally rejects unknown master resource names.
  app.use('/api/v1/tenants/:tenantId/inventory', inventoryRoutes)
  app.use('/api/v1/tenants/:tenantId/inventory', inventoryMastersRoutes)
  app.use('/api/v1/tenants/:tenantId/lookups/items', itemLookupRouter)
  app.use('/api/v1/tenants/:tenantId/lookups/vendors', vendorLookupRouter)
  app.use('/api/v1/tenants/:tenantId/lookups', lookupRoutes)
  app.use('/api/v1/tenants/:tenantId/accounting', accountingRoutes)
  app.use('/api/v1/tenants/:tenantId/manufacturing', manufacturingRoutes)
  app.use('/api/v1/tenants/:tenantId/purchase', purchaseRoutes)
  app.use('/api/v1/tenants/:tenantId/quality', qualityRoutes)
  app.use('/api/v1/tenants/:tenantId/dispatch', dispatchRoutes)
  app.use('/api/v1/tenants/:tenantId/gate', gateRoutes)
  // Phase 7D — reporting foundation (manufacturing/quality/dispatch reports, saved views, exception centre)
  app.use('/api/v1/tenants/:tenantId/reports', opsReportsRoutes)
  app.use('/api/v1/tenants/:tenantId/operations/exceptions', operationalExceptionRoutes)

  // Tenant slug aliases
  app.use('/api/v1/t/:tenantSlug/users', userRoutes)
  app.use('/api/v1/t/:tenantSlug/roles', roleRoutes)
  app.use('/api/v1/t/:tenantSlug/crm', crmRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/items', itemRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/vendors', vendorRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/imports', masterImportRoutes)
  app.use('/api/v1/t/:tenantSlug/masters/exports', masterExportRoutes)
  app.use('/api/v1/t/:tenantSlug/masters', mastersRoutes)
  app.use('/api/v1/t/:tenantSlug/inventory', inventoryRoutes)
  app.use('/api/v1/t/:tenantSlug/inventory', inventoryMastersRoutes)
  app.use('/api/v1/t/:tenantSlug/lookups/items', itemLookupRouter)
  app.use('/api/v1/t/:tenantSlug/lookups/vendors', vendorLookupRouter)
  app.use('/api/v1/t/:tenantSlug/lookups', lookupRoutes)
  app.use('/api/v1/t/:tenantSlug/accounting', accountingRoutes)
  app.use('/api/v1/t/:tenantSlug/manufacturing', manufacturingRoutes)
  app.use('/api/v1/t/:tenantSlug/purchase', purchaseRoutes)
  app.use('/api/v1/t/:tenantSlug/quality', qualityRoutes)
  app.use('/api/v1/t/:tenantSlug/dispatch', dispatchRoutes)
  app.use('/api/v1/t/:tenantSlug/gate', gateRoutes)
  app.use('/api/v1/t/:tenantSlug/reports', opsReportsRoutes)
  app.use('/api/v1/t/:tenantSlug/operations/exceptions', operationalExceptionRoutes)

  // Unknown API routes must return JSON 404 — never Express default HTML and
  // never the SPA shell (Phase 8C Wave 1 / 8B-R-015 SPA gate).
  app.all(/^\/api(?:\/|$).*/, (req, res) => {
    sendError(res, 404, `API route not found: ${req.method} ${req.path}`)
  })

  // Single-host production: serve Vite build from public/ (same origin as /api).
  // Docker Compose leaves this unused (frontend nginx container serves the SPA).
  const frontendCandidates = [
    process.env.FRONTEND_DIST,
    path.resolve(process.cwd(), 'public'),
    path.resolve(process.cwd(), '../public'),
    path.resolve(process.cwd(), '../frontend/dist'),
  ].filter(Boolean) as string[]
  const frontendDist = frontendCandidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')))
  if (frontendDist) {
    app.use(express.static(frontendDist, { index: false, maxAge: env.isProd ? '1h' : 0 }))
    // SPA fallback for browser refresh on deep routes (/crm/leads, /sales/orders/:id, …).
    // Never apply to /api — those must stay JSON.
    app.get(/^(?!\/api(?:\/|$)).*/, (_req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'))
    })
  }

  app.use(errorMiddleware)

  return app
}
