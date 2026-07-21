import { Router, type NextFunction, type Request, type Response } from 'express'
import { NotFoundError } from '../../utils/errors.js'
import mastersRoutes from './masters.routes.js'

/**
 * Inventory setup alias: /inventory/{plants|warehouses|storage-locations|bins}
 * Same registry-driven CRUD as /masters/:resource, restricted to the
 * Plant → Warehouse → Storage Location → Bin hierarchy.
 */
const INVENTORY_RESOURCES = new Set(['plants', 'warehouses', 'storage-locations', 'bins'])

const router = Router({ mergeParams: true })

router.use('/:resource', (req: Request, _res: Response, next: NextFunction) => {
  if (!INVENTORY_RESOURCES.has(String(req.params.resource))) {
    return next(new NotFoundError(`Unknown inventory resource: ${req.params.resource}`))
  }
  return next()
})

router.use(mastersRoutes)

export default router
