import type { Request, Response } from 'express'
import { auditFromRequest } from '../../services/audit.service.js'
import { getContext, getRouteParam, getTenantId } from '../../types/request-context.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../utils/response.js'
import * as responsibilityService from './responsibility.service.js'
import type {
  AssignResponsibilityInput,
  CreateResponsibilityInput,
  ListResponsibilitiesQuery,
  UpdateResponsibilityInput,
} from './responsibility.validation.js'

function auditMeta(req: Request) {
  const ctx = getContext(req)
  return { ...auditFromRequest(req), userId: ctx.userId }
}

export async function list(req: Request, res: Response): Promise<void> {
  const result = await responsibilityService.listResponsibilities(
    getTenantId(req),
    req.query as unknown as ListResponsibilitiesQuery,
  )
  sendPaginated(res, 'Responsibilities retrieved', result.items, result.meta)
}

export async function create(req: Request, res: Response): Promise<void> {
  const row = await responsibilityService.createResponsibility(
    getTenantId(req),
    req.body as CreateResponsibilityInput,
    auditMeta(req),
  )
  sendCreated(res, 'Responsibility created', row)
}

export async function update(req: Request, res: Response): Promise<void> {
  const row = await responsibilityService.updateResponsibility(
    getTenantId(req),
    getRouteParam(req, 'responsibilityId'),
    req.body as UpdateResponsibilityInput,
    auditMeta(req),
  )
  sendSuccess(res, 'Responsibility updated', row)
}

export async function remove(req: Request, res: Response): Promise<void> {
  const row = await responsibilityService.deleteResponsibility(
    getTenantId(req),
    getRouteParam(req, 'responsibilityId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Responsibility deleted', row)
}

export async function listForUser(req: Request, res: Response): Promise<void> {
  const rows = await responsibilityService.listUserResponsibilities(
    getTenantId(req),
    getRouteParam(req, 'userId'),
  )
  sendSuccess(res, 'User responsibilities retrieved', rows)
}

export async function assignToUser(req: Request, res: Response): Promise<void> {
  const row = await responsibilityService.assignUserResponsibility(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    req.body as AssignResponsibilityInput,
    auditMeta(req),
  )
  sendCreated(res, 'Responsibility assigned', row)
}

export async function removeFromUser(req: Request, res: Response): Promise<void> {
  const row = await responsibilityService.removeUserResponsibility(
    getTenantId(req),
    getRouteParam(req, 'userId'),
    getRouteParam(req, 'assignmentId'),
    auditMeta(req),
  )
  sendSuccess(res, 'Responsibility assignment removed', row)
}
