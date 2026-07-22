import { Router } from 'express'
import { authenticate } from '../../../middleware/auth.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { attachRequestContext } from '../../../middleware/request-context.middleware.js'
import { requireTenantAccess, resolveTenant } from '../../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './tracking-master.controller.js'
import {
  createLotSchema,
  createSerialSchema,
  listLotsSchema,
  listSerialsSchema,
  patchLotStatusSchema,
  patchSerialStatusSchema,
} from './tracking-master.schemas.js'

export const lotRoutes = Router({ mergeParams: true })
export const serialRoutes = Router({ mergeParams: true })

for (const router of [lotRoutes, serialRoutes]) {
  router.use(authenticate, attachRequestContext, validateParams(tenantRouteParamSchema), resolveTenant, requireTenantAccess)
}

lotRoutes.get('/', requirePermission('inventory.batch.view'), validateQuery(listLotsSchema), controller.listLots)
lotRoutes.post('/', requirePermission('inventory.batch.manage'), validateBody(createLotSchema), controller.createLot)
lotRoutes.get('/:id', requirePermission('inventory.batch.view'), validateParams(uuidParamSchema), controller.getLot)
lotRoutes.patch('/:id/status', requirePermission('inventory.batch.manage'), validateParams(uuidParamSchema), validateBody(patchLotStatusSchema), controller.patchLotStatus)

serialRoutes.get('/', requirePermission('inventory.serial.view'), validateQuery(listSerialsSchema), controller.listSerials)
serialRoutes.post('/', requirePermission('inventory.serial.manage'), validateBody(createSerialSchema), controller.createSerial)
serialRoutes.get('/:id', requirePermission('inventory.serial.view'), validateParams(uuidParamSchema), controller.getSerial)
serialRoutes.patch('/:id/status', requirePermission('inventory.serial.manage'), validateParams(uuidParamSchema), validateBody(patchSerialStatusSchema), controller.patchSerialStatus)
