import type { Request, Response } from 'express'
import type { ProductionAssignment } from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dateOnly, dec, isoDate } from '../shared/manufacturing.mappers.js'
import { resolveAssignmentAllowedActions } from './assignment-allowed-actions.js'
import * as service from './assignment.service.js'
import type {
  CancelAssignmentInput,
  CompleteAssignmentInput,
  CreateAssignmentInput,
  ListAssignmentsQuery,
  PauseAssignmentInput,
  ReassignAssignmentInput,
} from './assignment.schemas.js'

function mapAssignment(row: ProductionAssignment & Record<string, unknown>) {
  return {
    ...row,
    assignedQuantity: dec(row.assignedQuantity as never),
    completedQuantity: dec(row.completedQuantity as never),
    assignmentDate: dateOnly(row.assignmentDate as Date),
    plannedStartAt: isoDate(row.plannedStartAt as Date | null),
    plannedEndAt: isoDate(row.plannedEndAt as Date | null),
    acceptedAt: isoDate(row.acceptedAt as Date | null),
    startedAt: isoDate(row.startedAt as Date | null),
    pausedAt: isoDate(row.pausedAt as Date | null),
    completedAt: isoDate(row.completedAt as Date | null),
    cancelledAt: isoDate(row.cancelledAt as Date | null),
  }
}

export const listAssignments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listAssignments(tenantId, req.query as unknown as ListAssignmentsQuery)
  return sendPaginated(
    res,
    'Assignments listed',
    result.items.map((item) => ({
      ...mapAssignment(item as never),
      allowedActions: resolveAssignmentAllowedActions(req, item),
    })),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})

export const getAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.getAssignment(tenantId, id)
  return sendSuccess(res, 'Assignment fetched', {
    ...mapAssignment(item as never),
    allowedActions: resolveAssignmentAllowedActions(req, item),
  })
})

export const listAssignmentHistory = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const items = await service.listHistory(tenantId, id)
  return sendSuccess(res, 'Assignment history fetched', items.map((item) => mapAssignment(item as never)))
})

export const createAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.createAssignment(req, tenantId, req.body as CreateAssignmentInput)
  return sendCreated(res, 'Assignment created', {
    ...mapAssignment(result.assignment as never),
    warnings: result.warnings,
    allowedActions: resolveAssignmentAllowedActions(req, result.assignment),
  })
})

export const reassignAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.reassignAssignment(req, tenantId, id, req.body as ReassignAssignmentInput)
  return sendSuccess(res, 'Assignment reassigned', {
    ...mapAssignment(result.assignment as never),
    warnings: result.warnings,
    allowedActions: resolveAssignmentAllowedActions(req, result.assignment),
  })
})

export const cancelAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.cancelAssignment(req, tenantId, id, req.body as CancelAssignmentInput)
  return sendSuccess(res, 'Assignment cancelled', mapAssignment(item as never))
})

export const acceptAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.acceptAssignment(req, tenantId, id)
  return sendSuccess(res, 'Assignment accepted', mapAssignment(item as never))
})

export const startAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.startAssignment(req, tenantId, id)
  return sendSuccess(res, 'Assignment started', {
    ...mapAssignment(result.assignment as never),
    warnings: result.warnings,
  })
})

export const pauseAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.pauseAssignment(req, tenantId, id, req.body as PauseAssignmentInput)
  return sendSuccess(res, 'Assignment paused', mapAssignment(item as never))
})

export const resumeAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const item = await service.resumeAssignment(req, tenantId, id)
  return sendSuccess(res, 'Assignment resumed', mapAssignment(item as never))
})

export const completeAssignment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const id = getRouteParam(req, 'id')
  const result = await service.completeAssignment(req, tenantId, id, req.body as CompleteAssignmentInput)
  return sendSuccess(res, 'Assignment completed', {
    assignment: mapAssignment(result.assignment as never),
    ledgerEntryId: result.progress.ledgerEntry.id,
  })
})

export const listWorkOrderAssignments = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const workOrderId = getRouteParam(req, 'id')
  const result = await service.listByWorkOrder(tenantId, workOrderId, req.query as unknown as ListAssignmentsQuery)
  return sendPaginated(
    res,
    'Work order assignments listed',
    result.items.map((item) => mapAssignment(item as never)),
    buildPaginationMeta(result.total, result.page, result.limit),
  )
})
