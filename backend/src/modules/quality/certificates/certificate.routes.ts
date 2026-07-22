import { Router } from 'express'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import { z } from 'zod'
import * as controller from './certificate.controller.js'

const router = Router({ mergeParams: true })
const createSchema = z.object({
  certificateNumber: z.string().min(1).max(64), certificateType: z.enum(['SUPPLIER_TEST','MATERIAL_TEST','HEAT','DIMENSIONAL','INSPECTION_REPORT','PRESSURE_TEST','LEAK_TEST','ELECTRICAL_TEST','CALIBRATION','FINAL_QC','SUBCONTRACT','OTHER']),
  inspectionId: z.string().uuid().optional(), itemId: z.string().uuid().optional(), documentNumber: z.string().max(64).optional(),
  issueDate: z.string().datetime().optional(), expiryDate: z.string().datetime().optional(), supplierOrLab: z.string().max(200).optional(), attachmentRef: z.string().max(500).optional(), remarks: z.string().max(5000).optional(),
})
router.get('/', requirePermission('quality.view'), validateQuery(z.object({ inspectionId: z.string().uuid().optional() })), controller.list)
router.post('/', requirePermission('quality.create'), validateBody(createSchema), controller.create)
router.post('/:id/verify', validateParams(uuidParamSchema), requirePermission('quality.approve'), controller.verify)
export default router
