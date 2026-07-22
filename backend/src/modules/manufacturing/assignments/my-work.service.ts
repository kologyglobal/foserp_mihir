import type { Request } from 'express'
import { AuthorizationError } from '../../../utils/errors.js'
import { resolveAssignmentAllowedActions } from './assignment-allowed-actions.js'
import * as repo from './assignment.repository.js'
import type { ListMyWorkQuery } from './assignment.schemas.js'

export async function listMyWork(req: Request, tenantId: string, query: ListMyWorkQuery) {
  const authUserId = req.context?.userId ?? ''
  const permissions = req.context?.permissions ?? []
  const canViewOthers = permissions.includes('manufacturing.assignment.view') || permissions.includes('tenant.manage')

  let targetUserId = authUserId
  if (query.userId && query.userId !== authUserId) {
    if (!canViewOthers) throw new AuthorizationError('Cannot view another user\'s assignments')
    targetUserId = query.userId
  }

  const result = await repo.listAssignments(tenantId, {
    ...query,
    userId: targetUserId,
  })

  return {
    ...result,
    items: result.items.map((assignment) => ({
      ...assignment,
      allowedActions: resolveAssignmentAllowedActions(req, assignment),
    })),
  }
}
