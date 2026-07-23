import type { Request, Response } from 'express'

import type {

  ManufacturingOperationDependency,

  ManufacturingRoutingOperation,

  ManufacturingRoutingVersion,

} from '@prisma/client'

import { getRouteParam, getTenantId } from '../../../types/request-context.js'

import { asyncHandler } from '../../../utils/asyncHandler.js'

import { buildPaginationMeta } from '../../../utils/pagination.js'

import { sendCreated, sendPaginated, sendSuccess } from '../../../utils/response.js'

import { dec } from '../shared/manufacturing.mappers.js'

import * as service from './routing.service.js'

import type {

  CloseRoutingVersionInput,

  CompareRoutingVersionsQuery,

  CreateDependencyInput,

  CreateOperationInput,

  CreateRoutingInput,

  CreateRoutingVersionInput,

  CreateStageGroupInput,

  ListRoutingVersionsQuery,

  ListRoutingsQuery,

  ReviseRoutingVersionInput,

  UpdateOperationInput,

  UpdateRoutingInput,

  UpdateRoutingVersionInput,

  UpdateStageGroupInput,

  GenerateStagesFromBomInput,

} from './routing.schemas.js'



export function mapVersionLifecycle(status: string): string {

  const labels: Record<string, string> = {

    DRAFT: 'UNDER_DEVELOPMENT',

    ACTIVE: 'CERTIFIED',

    ARCHIVED: 'CLOSED',

    SUPERSEDED: 'SUPERSEDED',

    INACTIVE: 'INACTIVE',

  }

  return labels[status] ?? status

}



export function mapRoutingVersion<T extends { status: string }>(version: T) {

  return { ...version, lifecycleLabel: mapVersionLifecycle(version.status) }

}



function mapOperation(op: ManufacturingRoutingOperation) {

  return { ...op, setupTimeMinutes: dec(op.setupTimeMinutes), runTimeValue: dec(op.runTimeValue) }

}



function mapDependency(dep: ManufacturingOperationDependency) {

  return { ...dep, minimumCompletionPercent: dec(dep.minimumCompletionPercent) }

}



function mapVersionFull(full: {

  version: ManufacturingRoutingVersion

  stageGroups: unknown[]

  operations: ManufacturingRoutingOperation[]

  dependencies: ManufacturingOperationDependency[]

}) {

  return {

    ...mapRoutingVersion(full.version),

    stageGroups: full.stageGroups,

    operations: full.operations.map(mapOperation),

    dependencies: full.dependencies.map(mapDependency),

  }

}



export const listRoutings = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const result = await service.listRoutings(tenantId, req.query as unknown as ListRoutingsQuery)

  const items = result.items.map((row) => {

    const { productItem, ...routing } = row as typeof row & {

      productItem?: { id: string; code: string; name: string } | null

    }

    return {

      ...routing,

      productItemCode: productItem?.code ?? null,

      productItemName: productItem?.name ?? null,

    }

  })

  return sendPaginated(res, 'Routings listed', items, buildPaginationMeta(result.total, result.page, result.limit))

})



export const createRouting = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const item = await service.createRouting(req, tenantId, req.body as CreateRoutingInput)

  return sendCreated(res, 'Routing created', item)

})



export const updateRouting = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const routingId = getRouteParam(req, 'routingId')

  const item = await service.updateRouting(req, tenantId, routingId, req.body as UpdateRoutingInput)

  return sendSuccess(res, 'Routing updated', item)

})

export const deleteRouting = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const routingId = getRouteParam(req, 'routingId')
  await service.softDeleteRouting(req, tenantId, routingId)
  return sendSuccess(res, 'Routing deleted', null)
})



export const getRouting = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const routingId = getRouteParam(req, 'routingId')

  const { routing, versions } = await service.getRouting(tenantId, routingId)

  return sendSuccess(res, 'Routing fetched', {

    ...routing,

    versions: versions.map(mapRoutingVersion),

  })

})



export const listRoutingVersions = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const routingId = getRouteParam(req, 'routingId')

  const result = await service.listRoutingVersions(tenantId, routingId, req.query as unknown as ListRoutingVersionsQuery)

  return sendPaginated(

    res,

    'Routing versions listed',

    result.items.map(mapRoutingVersion),

    buildPaginationMeta(result.total, result.page, result.limit),

  )

})



export const createRoutingVersion = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const routingId = getRouteParam(req, 'routingId')

  const item = await service.createRoutingVersion(req, tenantId, routingId, req.body as CreateRoutingVersionInput)

  return sendCreated(res, 'Routing version created', mapRoutingVersion(item))

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

  return sendSuccess(res, 'Routing version updated', mapRoutingVersion(item))

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

  return sendSuccess(res, 'Routing version activated', mapRoutingVersion(item))

})



export const certifyRoutingVersion = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const item = await service.certifyRoutingVersion(req, tenantId, versionId)

  return sendSuccess(res, 'Routing version certified', mapRoutingVersion(item))

})



export const closeRoutingVersion = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const item = await service.closeRoutingVersion(req, tenantId, versionId, req.body as CloseRoutingVersionInput)

  return sendSuccess(res, 'Routing version closed', mapRoutingVersion(item))

})



export const getRoutingWhereUsed = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const item = await service.getRoutingWhereUsed(tenantId, versionId)

  return sendSuccess(res, 'Routing where-used fetched', item)

})



export const reviseRoutingVersion = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const item = await service.reviseRoutingVersion(req, tenantId, versionId, req.body as ReviseRoutingVersionInput)

  return sendCreated(res, 'Routing version revised', mapRoutingVersion(item))

})



export const compareRoutingVersions = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const query = req.query as unknown as CompareRoutingVersionsQuery

  const fromId = query.from ?? versionId

  const result = await service.compareRoutingVersions(tenantId, fromId, query.to)

  return sendSuccess(res, 'Routing versions compared', {

    ...result,

    from: { ...result.from, lifecycleLabel: mapVersionLifecycle(result.from.status) },

    to: { ...result.to, lifecycleLabel: mapVersionLifecycle(result.to.status) },

  })

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



export const getRoutingBomContext = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const item = await service.getRoutingBomContext(tenantId, versionId)

  return sendSuccess(res, 'Routing BOM context fetched', item)

})



export const generateStagesFromBom = asyncHandler(async (req: Request, res: Response) => {

  const tenantId = getTenantId(req)

  const versionId = getRouteParam(req, 'versionId')

  const item = await service.generateStagesFromBom(

    req,

    tenantId,

    versionId,

    req.body as GenerateStagesFromBomInput,

  )

  return sendSuccess(res, 'Stages generated from BOM', item)

})

