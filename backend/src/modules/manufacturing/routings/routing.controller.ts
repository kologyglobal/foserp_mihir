import type { Request, Response } from 'express'
import type {
  ManufacturingOperationDependency,
  ManufacturingRoutingOperation,
} from '@prisma/client'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'
import { dec } from '../shared/manufacturing.mappers.js'
import * as service from './routing.service.js'
import type {
  CompareRoutingVersionsQuery,
  CreateDependencyInput,
  CreateOperationInput,
  CreateRoutingInput,
  CreateRoutingVersionInput,
  CreateStageGroupInput,
  ListRoutingVersionsQuery,
  ListRoutingsQuery,
  UpdateOperationInput,
  UpdateRoutingVersionInput,
  UpdateStageGroupInput,
} from './routing.schemas.js'

function mapOperation(op: ManufacturingRoutingOperation) {
  return { ...op, setupTimeMinutes: dec(op.setupTimeMinutes), runTimeValue: dec(op.runTimeValue) }
}

function mapDependency(dep: ManufacturingOperationDependency) {
  return { ...dep, minimumCompletionPercent: dec(dep.minimumCompletionPercent) }
}

function mapVersionFull(full: {
  version: unknown
  stageGroups: unknown[]
  operations: ManufacturingRoutingOperation[]
  dependencies: ManufacturingOperationDependency[]
}) {
  return {
    ...(full.version as Record<string, unknown>),
    stageGroups: full.stageGroups,
    operations: full.operations.map(mapOperation),
    dependencies: full.dependencies.map(mapDependency),
  }
}

export const listRoutings = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const result = await service.listRoutings(tenantId, req.query as unknown as ListRoutingsQuery)
  return sendPaginated(res, 'Routings listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createRouting = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const item = await service.createRouting(req, tenantId, req.body as CreateRoutingInput)
  return sendCreated(res, 'Routing created', item)
})

export const getRouting = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const routingId = getRouteParam(req, 'routingId')
  const { routing, versions } = await service.getRouting(tenantId, routingId)
  return sendSuccess(res, 'Routing fetched', { ...routing, versions })
})

export const listRoutingVersions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const routingId = getRouteParam(req, 'routingId')
  const result = await service.listRoutingVersions(tenantId, routingId, req.query as unknown as ListRoutingVersionsQuery)
  return sendPaginated(res, 'Routing versions listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createRoutingVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const routingId = getRouteParam(req, 'routingId')
  const item = await service.createRoutingVersion(req, tenantId, routingId, req.body as CreateRoutingVersionInput)
  return sendCreated(res, 'Routing version created', item)
})

export const getRoutingVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const full = await service.getRoutingVersion(tenantId, versionId)
  return sendSuccess(res, 'Routing version fetched', mapVersionFull(full))
})

export const updateRoutingVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.updateRoutingVersionMeta(req, tenantId, versionId, req.body as UpdateRoutingVersionInput)
  return sendSuccess(res, 'Routing version updated', item)
})

export const createStageGroup = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.createStageGroup(req, tenantId, versionId, req.body as CreateStageGroupInput)
  return sendCreated(res, 'Stage group created', item)
})

export const createOperation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.createOperation(req, tenantId, versionId, req.body as CreateOperationInput)
  return sendCreated(res, 'Operation created', mapOperation(item))
})

export const createDependency = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.createDependency(req, tenantId, versionId, req.body as CreateDependencyInput)
  return sendCreated(res, 'Operation dependency created', mapDependency(item))
})

export const validateRoutingVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const result = await service.validateRoutingVersion(tenantId, versionId)
  return sendSuccess(res, 'Routing version validated', result)
})

export const activateRoutingVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.activateRoutingVersion(req, tenantId, versionId)
  return sendSuccess(res, 'Routing version activated', item)
})

export const reviseRoutingVersion = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const item = await service.reviseRoutingVersion(req, tenantId, versionId)
  return sendCreated(res, 'Routing version revised', item)
})

export const compareRoutingVersions = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const versionId = getRouteParam(req, 'versionId')
  const query = req.query as unknown as CompareRoutingVersionsQuery
  const fromId = query.from ?? versionId
  const result = await service.compareRoutingVersions(tenantId, fromId, query.to)
  return sendSuccess(res, 'Routing versions compared', result)
})

export const updateStageGroup = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const stageGroupId = getRouteParam(req, 'stageGroupId')
  const item = await service.updateStageGroup(req, tenantId, stageGroupId, req.body as UpdateStageGroupInput)
  return sendSuccess(res, 'Stage group updated', item)
})

export const deleteStageGroup = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const stageGroupId = getRouteParam(req, 'stageGroupId')
  await service.deleteStageGroup(req, tenantId, stageGroupId)
  return sendSuccess(res, 'Stage group deleted', null)
})

export const updateOperation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const operationId = getRouteParam(req, 'operationId')
  const item = await service.updateOperation(req, tenantId, operationId, req.body as UpdateOperationInput)
  return sendSuccess(res, 'Operation updated', mapOperation(item))
})

export const deleteOperation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const operationId = getRouteParam(req, 'operationId')
  await service.deleteOperation(req, tenantId, operationId)
  return sendSuccess(res, 'Operation deleted', null)
})

export const deleteDependency = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const dependencyId = getRouteParam(req, 'dependencyId')
  await service.deleteDependency(req, tenantId, dependencyId)
  return sendSuccess(res, 'Operation dependency deleted', null)
})
