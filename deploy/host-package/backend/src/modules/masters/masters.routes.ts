import { Router, type NextFunction, type Request, type Response } from 'express'
import { authenticate } from '../../middleware/auth.middleware.js'
import { attachRequestContext } from '../../middleware/request-context.middleware.js'
import { requirePermission } from '../../middleware/permission.middleware.js'
import { resolveTenant, requireTenantAccess } from '../../middleware/tenant.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../middleware/validation.middleware.js'
import { tenantRouteParamSchema, uuidParamSchema } from '../../utils/pagination.js'
import { NotFoundError } from '../../utils/errors.js'
import { getMasterResource, masterPermission, MASTER_RESOURCE_SLUGS } from './master.registry.js'
import { masterResourceParamSchema } from './master.validation.js'
import * as controller from './master.controller.js'

const router = Router({ mergeParams: true })

router.use(
  authenticate,
  attachRequestContext,
  validateParams(tenantRouteParamSchema),
  resolveTenant,
  requireTenantAccess,
)

function requireMasterPermission(action: 'view' | 'create' | 'update' | 'delete') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const config = getMasterResource(String(req.params.resource))
    if (!config) return next(new NotFoundError(`Unknown master resource: ${req.params.resource}`))
    return requirePermission(masterPermission(action, config.permissionKey))(req, _res, next)
  }
}

function validateMasterBody(kind: 'create' | 'update') {
  return (req: Request, _res: Response, next: NextFunction) => {
    const config = getMasterResource(String(req.params.resource))
    if (!config) return next(new NotFoundError(`Unknown master resource: ${req.params.resource}`))
    const schema = kind === 'create' ? config.createSchema : config.updateSchema
    return validateBody(schema)(req, _res, next)
  }
}

function validateMasterListQuery(req: Request, _res: Response, next: NextFunction) {
  const config = getMasterResource(String(req.params.resource))
  if (!config) return next(new NotFoundError(`Unknown master resource: ${req.params.resource}`))
  return validateQuery(config.listQuerySchema)(req, _res, next)
}

const resourceParams = tenantRouteParamSchema.and(masterResourceParamSchema)

router.get(
  '/:resource',
  validateParams(resourceParams),
  requireMasterPermission('view'),
  validateMasterListQuery,
  controller.listMasters,
)

router.post(
  '/:resource',
  validateParams(resourceParams),
  requireMasterPermission('create'),
  validateMasterBody('create'),
  controller.createMaster,
)

router.get(
  '/:resource/:id',
  validateParams(resourceParams.and(uuidParamSchema)),
  requireMasterPermission('view'),
  controller.getMaster,
)

router.patch(
  '/:resource/:id',
  validateParams(resourceParams.and(uuidParamSchema)),
  requireMasterPermission('update'),
  validateMasterBody('update'),
  controller.updateMaster,
)

router.delete(
  '/:resource/:id',
  validateParams(resourceParams.and(uuidParamSchema)),
  requireMasterPermission('delete'),
  controller.deleteMaster,
)

router.post(
  '/:resource/:id/activate',
  validateParams(resourceParams.and(uuidParamSchema)),
  requireMasterPermission('update'),
  controller.activateMaster,
)

router.post(
  '/:resource/:id/deactivate',
  validateParams(resourceParams.and(uuidParamSchema)),
  requireMasterPermission('update'),
  controller.deactivateMaster,
)

export { MASTER_RESOURCE_SLUGS }
export default router
