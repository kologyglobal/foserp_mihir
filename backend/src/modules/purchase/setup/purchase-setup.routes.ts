import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams } from '../../../middleware/validation.middleware.js'
import { z } from 'zod'
import * as controller from './purchase-setup.controller.js'
import {
  patchPurchaseSetupSchema,
  upsertPurchasePlantSetupSchema,
  upsertPurchaseSetupSchema,
} from './purchase-setup.validation.js'

const router = Router({ mergeParams: true })

const plantIdParamSchema = z.object({
  plantId: z.string().uuid(),
})

router.get('/', requirePermission('purchase.setup.view'), controller.getPurchaseSetup)

router.put(
  '/',
  requirePermission('purchase.setup.manage'),
  validateBody(upsertPurchaseSetupSchema),
  controller.putPurchaseSetup,
)

router.patch(
  '/',
  requirePermission('purchase.setup.manage'),
  validateBody(patchPurchaseSetupSchema),
  controller.patchPurchaseSetup,
)

router.get('/plants', requirePermission('purchase.setup.view'), controller.listPurchasePlantSetups)

router.get(
  '/plants/:plantId',
  requirePermission('purchase.setup.view'),
  validateParams(plantIdParamSchema),
  controller.getPurchasePlantSetup,
)

router.put(
  '/plants/:plantId',
  requirePermission('purchase.setup.manage'),
  validateParams(plantIdParamSchema),
  validateBody(upsertPurchasePlantSetupSchema),
  controller.putPurchasePlantSetup,
)

export default router
