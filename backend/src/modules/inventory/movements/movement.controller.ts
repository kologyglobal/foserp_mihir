import type { Request, Response } from 'express'
import { getTenantId } from '../../../types/request-context.js'
import { asyncHandler } from '../../../utils/asyncHandler.js'
import { sendCreated } from '../../../utils/response.js'
import * as service from './movement.service.js'
import type {
  AdjustmentMovementInput,
  FgDispatchIssueInput,
  FgReceiptInput,
  IssueToWorkOrderInput,
  PositiveQtyMovementInput,
  ReturnFromWorkOrderInput,
} from './movement.schemas.js'

export const postOpening = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postOpening(req, tenantId, req.body as PositiveQtyMovementInput)
  return sendCreated(res, 'Opening stock posted', movement)
})

export const postInward = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postInward(req, tenantId, req.body as PositiveQtyMovementInput)
  return sendCreated(res, 'Inward movement posted', movement)
})

export const postIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postIssue(req, tenantId, req.body as PositiveQtyMovementInput)
  return sendCreated(res, 'Issue movement posted', movement)
})

export const postAdjustment = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postAdjustment(req, tenantId, req.body as AdjustmentMovementInput)
  return sendCreated(res, 'Adjustment posted', movement)
})

export const postIssueToWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postIssueToWorkOrder(req, tenantId, req.body as IssueToWorkOrderInput)
  return sendCreated(res, 'Issue to work order posted', movement)
})

export const postReturnFromWorkOrder = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postReturnFromWorkOrder(req, tenantId, req.body as ReturnFromWorkOrderInput)
  return sendCreated(res, 'Return from work order posted', movement)
})

export const postFgReceipt = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postFgReceipt(req, tenantId, req.body as FgReceiptInput)
  return sendCreated(res, 'FG receipt posted', movement)
})

export const postFgDispatchIssue = asyncHandler(async (req: Request, res: Response) => {
  const tenantId = getTenantId(req)
  const movement = await service.postFgDispatchIssue(req, tenantId, req.body as FgDispatchIssueInput)
  return sendCreated(res, 'FG dispatch issue posted', movement)
})
