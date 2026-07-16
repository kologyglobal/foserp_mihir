import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateBody, validateParams, validateQuery } from '../../../middleware/validation.middleware.js'
import { uuidParamSchema } from '../../../utils/pagination.js'
import * as controller from './pipeline.controller.js'
import { createPipelineSchema, listPipelinesQuerySchema, updatePipelineSchema } from './pipeline.validation.js'

const router = Router({ mergeParams: true })

router.get('/', requirePermission('crm.pipeline.view'), validateQuery(listPipelinesQuerySchema), controller.listPipelines)
router.post('/', requirePermission('crm.pipeline.manage'), validateBody(createPipelineSchema), controller.createPipeline)
router.get('/:id', requirePermission('crm.pipeline.view'), validateParams(uuidParamSchema), controller.getPipeline)
router.patch('/:id', requirePermission('crm.pipeline.manage'), validateParams(uuidParamSchema), validateBody(updatePipelineSchema), controller.updatePipeline)
router.delete('/:id', requirePermission('crm.pipeline.manage'), validateParams(uuidParamSchema), controller.deletePipeline)

export default router
