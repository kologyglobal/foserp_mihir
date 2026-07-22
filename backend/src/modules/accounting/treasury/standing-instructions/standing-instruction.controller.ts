import type { Request, Response } from 'express'
import { getRouteParam, getTenantId } from '../../../../types/request-context.js'
import { asyncHandler } from '../../../../utils/asyncHandler.js'
import { buildPaginationMeta } from '../../../../utils/pagination.js'
import { sendCreated, sendPaginated, sendSuccess } from '../../../../utils/response.js'
import * as service from './standing-instruction.service.js'
import { generateDueDrafts } from './standing-instruction-generation.service.js'
import type { ListStandingInstructionsQuery } from './standing-instruction.schemas.js'

export const listStandingInstructions = asyncHandler(async (req: Request, res: Response) => {
  const result = await service.listStandingInstructions(req, getTenantId(req), req.query as unknown as ListStandingInstructionsQuery)
  return sendPaginated(res, 'standing instructions listed', result.items, buildPaginationMeta(result.total, result.page, result.limit))
})

export const createStandingInstruction = asyncHandler(async (req: Request, res: Response) =>
  sendCreated(res, 'standing instruction created', await service.createStandingInstruction(req, getTenantId(req), req.body)))

export const getStandingInstruction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'standing instruction fetched', await service.getStandingInstruction(req, getTenantId(req), getRouteParam(req, 'id'))))

export const updateStandingInstruction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'standing instruction updated', await service.updateStandingInstruction(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const pauseStandingInstruction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'standing instruction paused', await service.pauseStandingInstruction(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const resumeStandingInstruction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'standing instruction resumed', await service.resumeStandingInstruction(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const cancelStandingInstruction = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'standing instruction cancelled', await service.cancelStandingInstruction(req, getTenantId(req), getRouteParam(req, 'id'), req.body)))

export const generateDueDraftsHandler = asyncHandler(async (req: Request, res: Response) =>
  sendSuccess(res, 'due standing instruction drafts generated', await generateDueDrafts(req, getTenantId(req), req.body)))
