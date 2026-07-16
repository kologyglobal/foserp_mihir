import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateQuery } from '../../../middleware/validation.middleware.js'
import * as controller from './search.controller.js'
import { searchQuerySchema } from './search.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.search.view'), validateQuery(searchQuerySchema), controller.search)

export default router
