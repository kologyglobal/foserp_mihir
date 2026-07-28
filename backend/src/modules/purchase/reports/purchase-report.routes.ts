import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import * as controller from './purchase-report.controller.js'

const router = Router({ mergeParams: true })

router.get('/grni', requirePermission('purchase.reports.view'), controller.getGrniReport)

export default router
