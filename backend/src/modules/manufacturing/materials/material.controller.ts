import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated, sendSuccess } from '../../../utils/response.js'
import * as positionService from './material-position.service.js'
import * as reconciliationService from './material-reconciliation.service.js'
import * as service from './material.service.js'
import type {
  AddMaterialRequirementInput,
  IssueMaterialInput,
  IssuePreviewInput,
  ReallocateReservationInput,
  ReleaseReservationInput,
  ReserveMaterialsInput,
  ReturnMaterialInput,
  ShortageRequisitionInput,
  UpdateMaterialRequirementInput,
} from './material.schemas.js'

export const listMaterials = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const materials = await service.listMaterials(tenantId, orderId)
  return sendSuccess(res, 'Materials listed', materials)
})

export const syncRequirements = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const result = await service.syncRequirements(req, tenantId, orderId)
  return sendSuccess(res, 'Material requirements synced', result)
})

export const addMaterialRequirement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const material = await service.addMaterialRequirement(
    req,
    tenantId,
    orderId,
    req.body as AddMaterialRequirementInput,
  )
  return sendCreated(res, 'Material requirement added', material)
})

export const updateMaterialRequirement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const materialId = getRouteParam(req, 'materialId')
  const material = await service.updateMaterialRequirement(
    req,
    tenantId,
    orderId,
    materialId,
    req.body as UpdateMaterialRequirementInput,
  )
  return sendSuccess(res, 'Material requirement updated', material)
})

export const removeMaterialRequirement = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const materialId = getRouteParam(req, 'materialId')
  const result = await service.removeMaterialRequirement(req, tenantId, orderId, materialId)
  return sendSuccess(res, 'Material requirement removed', result)
})

export const reserveMaterials = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const result = await service.reserveMaterials(req, tenantId, orderId, req.body as ReserveMaterialsInput)
  return sendSuccess(res, 'Materials reserved', result)
})

export const issueMaterial = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const material = await service.issueMaterial(req, tenantId, orderId, req.body as IssueMaterialInput)
  return sendCreated(res, 'Material issued', material)
})

export const previewIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const preview = await positionService.previewIssue(tenantId, orderId, req.body as IssuePreviewInput, req)
  return sendSuccess(res, 'Material issue preview', preview)
})

export const returnMaterial = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const material = await service.returnMaterial(req, tenantId, orderId, req.body as ReturnMaterialInput)
  return sendCreated(res, 'Material returned', material)
})

export const createShortageRequisition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const result = await service.createShortageRequisition(req, tenantId, orderId, req.body as ShortageRequisitionInput)
  return sendCreated(res, 'Shortage requisition created', result)
})

export const getMaterialsReadiness = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const readiness = await service.getMaterialsReadiness(tenantId, orderId)
  return sendSuccess(res, 'Materials readiness fetched', readiness)
})

export const getMaterialPosition = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const position = await positionService.getMaterialPosition(tenantId, orderId, req)
  return sendSuccess(res, 'Material position fetched', position)
})

export const getMaterialReconciliation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const reconciliation = await reconciliationService.getMaterialReconciliation(tenantId, orderId, req)
  return sendSuccess(res, 'Material reconciliation fetched', reconciliation)
})

export const releaseReservation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const result = await service.releaseReservation(req, tenantId, orderId, req.body as ReleaseReservationInput)
  return sendSuccess(res, 'Material reservations released', result)
})

export const reallocateReservation = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const orderId = getRouteParam(req, 'id')
  const result = await service.reallocateReservation(req, tenantId, orderId, req.body as ReallocateReservationInput)
  return sendSuccess(res, 'Material reservation reallocated', result)
})
