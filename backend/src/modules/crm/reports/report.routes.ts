import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './report.controller.js'
import { reportQuerySchema } from './report.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.report.view'), validateQuery(reportQuerySchema), controller.getReport)

export default router
