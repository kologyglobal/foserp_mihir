import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { z } from 'zod'
import * as controller from './export.controller.js'
import { CRM_EXPORT_RESOURCES, crmExportQuerySchema } from './export.validation.js'

const router = Router({ mergeParams: true })

router.get(
  '/:resource',
  requirePermission('crm.export.execute'),
  validateParams(z.object({ resource: z.enum(CRM_EXPORT_RESOURCES) })),
  validateQuery(crmExportQuerySchema),
  controller.exportResource,
)

export default router
