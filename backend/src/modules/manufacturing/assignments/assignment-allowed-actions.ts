import type { Request } from 'express'
import type { ProductionAssignment, ProductionAssignmentStatus } from '@prisma/client'

function can(req: Request, permission: string) {
  const permissions = req.context?.permissions ?? []
  return permissions.includes('tenant.manage') || permissions.includes(permission)
}

function isOwnAssignment(req: Request, assignment: Pick<ProductionAssignment, 'userId'>) {
  return assignment.userId === req.context?.userId
}

export function resolveAssignmentAllowedActions(
  req: Request,
  assignment: Pick<ProductionAssignment, 'status' | 'userId'>,
) {
  const status = assignment.status as ProductionAssignmentStatus
  const own = isOwnAssignment(req, assignment)
  const manage = can(req, 'manufacturing.assignment.manage')
  const reassign = can(req, 'manufacturing.assignment.reassign')
  const canOperate = own || manage

  return {
    accept: status === 'ASSIGNED' && canOperate && (can(req, 'manufacturing.operator.start') || manage),
    start: status === 'ACCEPTED' && canOperate && (can(req, 'manufacturing.operator.start') || manage),
    pause: status === 'IN_PROGRESS' && canOperate && (can(req, 'manufacturing.operator.pause') || manage),
    resume: status === 'PAUSED' && canOperate && (can(req, 'manufacturing.operator.start') || manage),
    complete: (status === 'IN_PROGRESS' || status === 'PAUSED') && canOperate && (can(req, 'manufacturing.operator.complete') || manage),
    cancel: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED'].includes(status) && manage,
    reassign: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'PAUSED'].includes(status) && reassign,
  }
}
