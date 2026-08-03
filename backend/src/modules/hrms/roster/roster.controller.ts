import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import { loadHrScope } from '../hrms-scope.js'
import * as service from './roster.service.js'
import type {
  BulkAssignInput,
  ClearOverrideInput,
  CopyAssignmentInput,
  CreateAssignmentInput,
  RosterGridQuery,
} from './roster.schemas.js'

function auditMeta(req: Request) {
  return {
    userId: req.context?.userId,
    ipAddress: req.ip,
    userAgent: req.get('user-agent'),
  }
}

export const grid = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.getRosterGrid(
    getTenantId(req),
    req.query as unknown as RosterGridQuery,
    scope,
  )
  return sendSuccess(res, 'Roster grid loaded', item)
})

export const create = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.createAssignment(
    getTenantId(req),
    req.body as CreateAssignmentInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Shift assignment created', item)
})

export const bulk = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.bulkAssign(
    getTenantId(req),
    req.body as BulkAssignInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Bulk shift assignments created', item)
})

export const copy = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.copyAssignment(
    getTenantId(req),
    req.body as CopyAssignmentInput,
    scope,
    auditMeta(req),
  )
  return sendCreated(res, 'Shift copied across dates', item)
})

export const clear = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.clearOverrides(
    getTenantId(req),
    req.body as ClearOverrideInput,
    scope,
    auditMeta(req),
  )
  return sendSuccess(res, 'Roster overrides cleared', item)
})

export const effective = asyncHandler(async (req: Request, res: Response) => {
  const scope = await loadHrScope(req)
  const item = await service.resolveEffectiveShift(
    getTenantId(req),
    String(req.query.employeeId),
    String(req.query.date),
    scope,
  )
  return sendSuccess(res, 'Effective shift resolved', item)
})
