import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendSuccess } from '../../utils/response.js'
import * as moduleService from './module.service.js'
import type { SetModuleFlagInput } from './module.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await moduleService.listModuleStatus(getTenantId(req))
  sendSuccess(res, 'Module status retrieved', result)
}

export async function setFlag(req: Request, res: Response): Promise<void> {
  const row = await moduleService.setModuleFlag(
    getTenantId(req),
    getRouteParam(req, 'moduleKey'),
    req.body as SetModuleFlagInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Module flag updated', row)
}
