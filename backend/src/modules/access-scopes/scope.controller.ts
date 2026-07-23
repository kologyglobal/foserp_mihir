import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendSuccess } from '../../utils/response.js'
import * as scopeService from './scope.service.js'
import type { ReplaceUserScopesInput } from './scope.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function getUserScopes(req: Request, res: Response): Promise<void> {
  const scope = await scopeService.loadUserDataScope(getTenantId(req), getRouteParam(req, 'userId'))
  sendSuccess(res, 'User scopes retrieved', scope)
}

export async function replaceUserScopes(req: Request, res: Response): Promise<void> {
  const scope = await scopeService.replaceUserScopes(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    req.body as ReplaceUserScopesInput,
    auditMeta(req),
  )
  sendSuccess(res, 'User scopes updated', scope)
}
