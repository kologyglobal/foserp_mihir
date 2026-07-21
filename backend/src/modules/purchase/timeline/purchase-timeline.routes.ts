import { Router } from 'express'
import { requirePermission } from '../../../middleware/permission.middleware.js'
import { validateParams } from '../../../middleware/validation.middleware.js'
import { z } from 'zod'
import * as controller from './purchase-timeline.controller.js'
import { TIMELINE_ENTITY_MAP } from '../shared/purchase-audit.js'

const timelineParamsSchema = z.object({
  entityType: z.enum(
    Object.keys(TIMELINE_ENTITY_MAP) as [
      keyof typeof TIMELINE_ENTITY_MAP,
      ...(keyof typeof TIMELINE_ENTITY_MAP)[],
    ],
  ),
  entityId: z.string().uuid(),
})

/**
 * Permission is enforced per entity type inside a thin wrapper so one route
 * serves PR / Planning / RFQ / PO timelines.
 */
function requireTimelineView() {
  return (req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
    const entityType = req.params.entityType as keyof typeof TIMELINE_ENTITY_MAP
    const permission = TIMELINE_ENTITY_MAP[entityType]?.viewPermission
    if (!permission) {
      next()
      return
    }
    return requirePermission(permission)(req, res, next)
  }
}

const router = Router({ mergeParams: true })

router.get(
  '/:entityType/:entityId',
  validateParams(timelineParamsSchema),
  requireTimelineView(),
  controller.getTimeline,
)

export default router
